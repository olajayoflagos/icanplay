// server/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import crypto from 'crypto';
import axios from 'axios';
import pino from 'pino';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { v4 as uuid } from 'uuid';
import { pool, q, withTx, postTx, getBalanceCents } from './db.js';
import { flag, stakeRatioCheck, betVelocityCheck, correlateDevice } from './risk.js';
import { Chess, initCheckers, applyCheckersMove, initWhot, whotPlay, whotDraw, whotTickTimeout, initLudo, ludoRoll, ludoMove, archeryScore, poolShotSuccess } from './engines.js';
import { withIdempotency } from './idempotency.js';
import { getRakePercent, getFeatures, setConfig } from './config.js';
import { swissPair, knockoutPair } from './tournaments.js';

// NEW: WebAuthn + wallet registrar
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import registerWallet from './_wallet.js';

const log = pino({ level: process.env.NODE_ENV==='production' ? 'info' : 'debug' });
const app = express();
app.use(helmet());
app.use(express.json({ verify: (req,res,buf)=>{ req.rawBody=buf } }));

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });

// keyed rate limit (user token else IP)
function keyGen(req,res){ const token=(req.headers.authorization||'').replace('Bearer ','')||''; return token||req.ip }
const limiter = rateLimit({ windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS||60000), max: Number(process.env.RATE_LIMIT_MAX||120), keyGenerator: keyGen });
app.use('/api/', limiter);
app.use('/api/', withIdempotency);

function adminOnly(req,res,next){ if((req.headers['x-admin-key']||'')!== (process.env.ADMIN_KEY||'')) return res.status(401).json({error:'unauthorized'}); next() }

// Auth helper (augmented with device correlation; returns {id, username, withdraw_pin_hash?})
async function auth(req){
  const token=(req.headers.authorization||'').replace('Bearer ','');
  if(!token) return null;
  const u=(await q('select id, username, withdraw_pin_hash from users where id=$1',[token]))[0];
  if(!u) return null;
  const device_id=req.headers['x-device-id']?.toString()?.slice(0,64)||null;
  const ip=req.headers['x-forwarded-for']?.split(',')[0]?.trim()||req.socket.remoteAddress;
  if(device_id){
    await q('insert into user_devices(id,user_id,device_id,last_ip) values ($1,$2,$3,$4) on conflict do nothing',[uuid(),u.id,device_id,ip]);
    await q('update user_devices set last_seen=now(), last_ip=$1 where user_id=$2 and device_id=$3',[ip,u.id,device_id]);
    await correlateDevice(device_id);
  }
  return u;
}

// ---- Match state helpers ----
async function ensureState(match){
  const last=(await q('select state from match_states where match_id=$1 order by id desc limit 1',[match.id]))[0]?.state;
  if(last) return last;
  let S=null;
  if(match.game==='chess'){ const ch=new Chess(); S={ fen: ch.fen() } }
  if(match.game==='checkers'){ S=initCheckers() }
  if(match.game==='whot'){ S=initWhot() }
  if(match.game==='ludo'){ S=initLudo() }
  if(match.game==='archery'){ S={ seed: uuid().replace(/-/g,''), A:[], B:[], shots:0, bestOf:5, turn:'A' } }
  if(match.game==='pool8lite'){ S={ A:0,B:0,turn:'A' } }
  await q('insert into match_states(match_id,state) values ($1,$2)',[match.id,S]);
  return S;
}
async function saveState(match_id, state){ await q('insert into match_states(match_id,state) values ($1,$2)',[match_id,state]) }
const sideOf = (m, uid) => uid===m.creator_user_id ? 'A' : (uid===m.taker_user_id ? 'B' : null);
const roleOf = (m, uid) => uid===m.creator_user_id ? 'PLAYER_A' : (uid===m.taker_user_id ? 'PLAYER_B' : 'SPECTATOR');

async function settleMatch(m, winner){
  if(m.status!=='LIVE') return;
  const fresh=(await q('select * from matches where id=$1',[m.id]))[0];
  if(!fresh||fresh.status!=='LIVE') return;
  if(!fresh.demo && fresh.stake_cents>0){
    await withTx(async (c)=>{
      if(winner==='DRAW'){
        await postTx(c,'REFUND',m.id,[
          {account_type:'ESCROW',user_id:null,amount_cents:-fresh.escrow_cents},
          {account_type:'USER_CASH',user_id:fresh.creator_user_id,amount_cents:fresh.stake_cents},
          {account_type:'USER_CASH',user_id:fresh.taker_user_id,amount_cents:fresh.stake_cents}
        ])
      } else {
        const winUser=winner==='A'?fresh.creator_user_id:fresh.taker_user_id;
        await postTx(c,'SETTLE',m.id,[
          {account_type:'ESCROW',user_id:null,amount_cents:-fresh.escrow_cents},
          {account_type:'HOUSE_CASH',user_id:null,amount_cents:fresh.rake_cents},
          {account_type:'USER_CASH',user_id:winUser,amount_cents:fresh.payout_cents}
        ])
      }
    })
  }
  await q('update matches set status=$1, updated_at=now() where id=$2',['SETTLED',m.id]);
  io.to(fresh.room).emit('match:settled',{ id:m.id, winner, rake:fresh.rake_cents/100, payout:fresh.payout_cents/100 })
}

// ===== REST: auth/wallet kept same =====
app.post('/api/auth/register', async (req,res)=>{
  const { username } = req.body||{};
  if(!username) return res.status(400).json({error:'Username required'});
  const uname=String(username).trim().toLowerCase();
  if(!/^[a-z0-9_]{3,16}$/.test(uname)) return res.status(400).json({error:'3-16 chars, letters/numbers/_ only'});
  const exists=await q('select 1 from users where username=$1',[uname]);
  if(exists.length) return res.status(409).json({error:'Username taken'});
  const id=uuid();
  await q('insert into users(id,username) values ($1,$2)',[id,uname]);
  res.json({ token:id, user:{ id, username:uname } })
});
app.get('/api/me', async (req,res)=>{ const u=await auth(req); if(!u) return res.status(401).json({error:'Unauthorized'}); res.json({ user:u }) });
app.get('/api/wallet', async (req,res)=>{ const u=await auth(req); if(!u) return res.status(401).json({error:'Unauthorized'}); const bal=await getBalanceCents(u.id); const house=(await q("select coalesce(sum(case when account_type='HOUSE_CASH' then amount_cents else 0 end),0) as c from ledger_entries",[]))[0]?.c||0; res.json({ balance:bal/100, house:house/100 }) });

// ===== NEW: Lobby list =====
app.get('/api/matches', async (req,res)=>{
  const status=(req.query.status||'OPEN').toUpperCase();
  const rows = await q(
    `select id, game, demo, stake_cents, status, allow_spectators
     from matches where status=$1 order by created_at desc limit 100`, [status]
  );
  res.json(rows.map(r=>({ ...r, stake: r.stake_cents/100 })));
});

// ===================
// NEW: WebAuthn routes
// ===================

// In-memory stores for challenges + recent-auth window
const regChallenges = new Map();    // userId -> challenge
const authChallenges = new Map();   // userId -> challenge
const recentAuth = new Map();       // userId -> expiresAt (ms)
function webauthnOk(userId){ const t = recentAuth.get(userId) || 0; return t > Date.now(); }
function markWebauthn(userId, minutes=5){ recentAuth.set(userId, Date.now() + minutes*60*1000); }

// Register passkey: options
app.get('/api/webauthn/register/options', async (req,res)=>{
  const u = await auth(req); if(!u) return res.sendStatus(401);
  const rpID = (new URL(process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`)).hostname;
  const opts = await generateRegistrationOptions({
    rpName: 'I Can Play',
    rpID,
    userID: u.id,
    userName: u.username,
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
    attestationType: 'none',
  });
  regChallenges.set(u.id, opts.challenge);
  res.json(opts);
});

// Register passkey: verify
app.post('/api/webauthn/register/verify', async (req,res)=>{
  const u = await auth(req); if(!u) return res.sendStatus(401);
  const expectedChallenge = regChallenges.get(u.id);
  if(!expectedChallenge) return res.sendStatus(400);
  const expectedOrigin = CLIENT_ORIGIN;
  const expectedRPID = (new URL(process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`)).hostname;

  const vr = await verifyRegistrationResponse({
    response: req.body,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
  });
  if(!vr.verified) return res.sendStatus(400);

  const { credentialID, credentialPublicKey, counter, transports } = vr.registrationInfo;
  await q(
    `insert into user_passkeys(id,user_id,credential_id,public_key,counter,transports)
     values (gen_random_uuid(),$1,$2,$3,$4,$5)
     on conflict (user_id, credential_id) do update set public_key=$3,counter=$4,transports=$5`,
    [u.id, Buffer.from(credentialID), Buffer.from(credentialPublicKey), counter, transports || []]
  );
  regChallenges.delete(u.id);
  res.json({ ok:true });
});

// Assert passkey: options
app.get('/api/webauthn/assert/options', async (req,res)=>{
  const u = await auth(req); if(!u) return res.sendStatus(401);
  const rpID = (new URL(process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`)).hostname;
  const creds = await q('select credential_id from user_passkeys where user_id=$1',[u.id]);
  const opts = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: creds.map(c=>({ id: c.credential_id, type:'public-key' }))
  });
  authChallenges.set(u.id, opts.challenge);
  res.json(opts);
});

// Assert passkey: verify
app.post('/api/webauthn/assert/verify', async (req,res)=>{
  const u = await auth(req); if(!u) return res.sendStatus(401);
  const expectedChallenge = authChallenges.get(u.id);
  if(!expectedChallenge) return res.sendStatus(400);
  const expectedOrigin = CLIENT_ORIGIN;
  const expectedRPID = (new URL(process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`)).hostname;

  const rawId = req.body?.rawId;
  const cred = (await q('select * from user_passkeys where user_id=$1 and credential_id=$2',
    [u.id, Buffer.from(rawId, 'base64url')]))[0];
  if(!cred) return res.sendStatus(400);

  const vr = await verifyAuthenticationResponse({
    response: req.body,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
    authenticator: {
      credentialID: cred.credential_id,
      credentialPublicKey: cred.public_key,
      counter: cred.counter
    }
  });

  if(!vr.verified) return res.sendStatus(401);
  await q('update user_passkeys set counter=$1 where user_id=$2 and credential_id=$3',
    [vr.authenticationInfo.newCounter, u.id, cred.credential_id]);

  authChallenges.delete(u.id);
  markWebauthn(u.id, 5); // allow sensitive actions for 5 minutes
  res.json({ ok:true });
});

// ===================
// Wallet routes wiring
// ===================

// REMOVE the old side-effect import if present:
// import './_wallet.js';

// Register wallet routes (deposit, webhook, payout, withdraw w/ passkey+PIN)
registerWallet(app, { auth, q, withTx, postTx, getBalanceCents, webauthnOk: (uid)=>webauthnOk(uid), PORT });

// ===== Admin endpoints kept same (config/disputes/withdrawals/tournaments) =====
// (use your previous code here — unchanged)

// ===== Sockets =====
io.use(async (socket,next)=>{
  const token=socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ','') || '';
  if(!token) return next(new Error('auth'));
  const u=(await q('select id, username from users where id=$1',[token]))[0];
  if(!u) return next(new Error('auth'));
  socket.user=u; next();
});

io.on('connection',(socket)=>{
  const user=socket.user;

  socket.on('match:joinRoom', async ({ id })=>{
    const m=(await q('select * from matches where id=$1',[id]))[0]; if(!m) return;
    socket.join(m.room);
    const S=await ensureState(m);
    socket.emit('match:state',{
      id:m.id, room:m.room, game:m.game, demo:m.demo,
      stake:m.stake_cents/100, status:m.status,
      escrow:m.escrow_cents/100, rake:m.rake_cents/100, payout:m.payout_cents/100,
      creator_user_id: m.creator_user_id, taker_user_id: m.taker_user_id
    });
    io.to(m.room).emit(`${m.game}:update`, S);
  });

  // ===== NEW: Spectator Join =====
  socket.on('match:spectateJoin', async ({ id })=>{
    const m=(await q('select * from matches where id=$1',[id]))[0]; if(!m||!m.allow_spectators) return;
    socket.join(m.room);
    const S=await ensureState(m);
    socket.emit('match:state',{
      id:m.id, room:m.room, game:m.game, demo:m.demo,
      stake:m.stake_cents/100, status:m.status,
      escrow:m.escrow_cents/100, rake:m.rake_cents/100, payout:m.payout_cents/100,
      creator_user_id: m.creator_user_id, taker_user_id: m.taker_user_id
    });
    io.to(m.room).emit(`${m.game}:update`, S);
  });

  // ===== Games (same as before) =====
  // chess
  socket.on('chess:move', async ({ matchId, from, to })=>{
    const m=(await q('select * from matches where id=$1',[matchId]))[0]; if(!m||m.status!=='LIVE') return;
    const side = sideOf(m, user.id); if (!side) return;
    const last=(await q('select state from match_states where match_id=$1 order by id desc limit 1',[matchId]))[0]?.state || { fen: new (new Chess()).fen() };
    const ch=new Chess(last.fen);
    const turnSide = ch.turn()==='w' ? 'A' : 'B';
    if (side!==turnSide) return;
    try{
      const mv=ch.move({ from, to, promotion:'q' }); if(!mv) return;
      const S={ fen: ch.fen() };
      await saveState(matchId,S); io.to(m.room).emit('chess:update',S);
      if(ch.isGameOver()){
        const winner = ch.isDraw() ? 'DRAW' : (ch.turn()==='w' ? 'B' : 'A');
        await settleMatch(m,winner);
      }
    }catch{}
  });
  // checkers
  socket.on('checkers:move', async ({ matchId, from, to })=>{
    const m=(await q('select * from matches where id=$1',[matchId]))[0]; if(!m||m.status!=='LIVE') return;
    const side = sideOf(m, user.id); if (!side) return;
    const last=(await q('select state from match_states where match_id=$1 order by id desc limit 1',[matchId]))[0]?.state || initCheckers();
    const who = side==='A' ? 'r' : 'b';
    const r=applyCheckersMove(last, who, from, to); if(!r.ok) return;
    await saveState(matchId,r.state); io.to(m.room).emit('checkers:update',r.state);
    if(r.winner){ await settleMatch(m, r.winner); }
  });
  // whot
  socket.on('whot:play', async ({ matchId, index, called })=>{
    const m=(await q('select * from matches where id=$1',[matchId]))[0]; if(!m||m.status!=='LIVE') return;
    const side = sideOf(m, user.id); if (!side) return;
    const last=(await q('select state from match_states where match_id=$1 order by id desc limit 1',[matchId]))[0]?.state || initWhot();
    const r=whotPlay(last, side, index, called); if(!r.ok) return;
    await saveState(matchId,r.state); io.to(m.room).emit('whot:update',r.state);
    if(r.winner){ await settleMatch(m, r.winner); }
  });
  socket.on('whot:draw', async ({ matchId })=>{
    const m=(await q('select * from matches where id=$1',[matchId]))[0]; if(!m||m.status!=='LIVE') return;
    const side = sideOf(m, user.id); if (!side) return;
    const last=(await q('select state from match_states where match_id=$1 order by id desc limit 1',[matchId]))[0]?.state || initWhot();
    const r=whotDraw(last, side); if(!r.ok) return;
    await saveState(matchId,r.state); io.to(m.room).emit('whot:update',r.state);
  });
  // ludo
  socket.on('ludo:roll', async ({ matchId })=>{
    const m=(await q('select * from matches where id=$1',[matchId]))[0]; if(!m||m.status!=='LIVE') return;
    const side = sideOf(m, user.id); if (!side) return;
    const S=(await q('select state from match_states where match_id=$1 order by id desc limit 1',[matchId]))[0]?.state || initLudo();
    if (S.turn!==side) return;
    S.die = ludoRoll(S); await saveState(matchId,S); io.to(m.room).emit('ludo:update',S);
  });
  socket.on('ludo:move', async ({ matchId, idx })=>{
    const m=(await q('select * from matches where id=$1',[matchId]))[0]; if(!m||m.status!=='LIVE') return;
    const side = sideOf(m, user.id); if (!side) return;
    const S=(await q('select state from match_states where match_id=$1 order by id desc limit 1',[matchId]))[0]?.state || initLudo();
    const r=ludoMove(S, side, idx); if(!r.ok) return;
    await saveState(matchId,r.state); io.to(m.room).emit('ludo:update',r.state);
    if(r.winner){ await settleMatch(m, r.winner); }
  });
  // archery
  socket.on('archery:shoot', async ({ matchId, shot })=>{
    const m=(await q('select * from matches where id=$1',[matchId]))[0]; if(!m||m.status!=='LIVE') return;
    const side = sideOf(m, user.id); if (!side) return;
    const S=(await q('select state from match_states where match_id=$1 order by id desc limit 1',[matchId]))[0]?.state || { seed: uuid().replace(/-/g,''), A:[], B:[], shots:0, bestOf:5, turn:'A' };
    if (S.turn!==side) return;
    const score = archeryScore(S.seed, Number(shot||0));
    (side==='A'?S.A:S.B).push(score); S.shots += 1; S.turn = side==='A'?'B':'A';
    await saveState(matchId,S); io.to(m.room).emit('archery:update',S);
    if (S.A.length>=S.bestOf && S.B.length>=S.bestOf){
      const a=S.A.reduce((x,y)=>x+y,0), b=S.B.reduce((x,y)=>x+y,0);
      const w=a===b ? 'DRAW' : (a>b?'A':'B'); await settleMatch(m, w);
    }
  });
  // pool-lite
  socket.on('pool:shot', async ({ matchId, power })=>{
    const m=(await q('select * from matches where id=$1',[matchId]))[0]; if(!m||m.status!=='LIVE') return;
    const side = sideOf(m, user.id); if (!side) return;
    const S=(await q('select state from match_states where match_id=$1 order by id desc limit 1',[matchId]))[0]?.state || { A:0,B:0,turn:'A' };
    if (S.turn!==side) return;
    const ok = poolShotSuccess(Number(power||0.7));
    if (ok){ if (side==='A') S.A++; else S.B++; } else { S.turn = side==='A'?'B':'A'; }
    await saveState(matchId,S); io.to(m.room).emit('pool:update',S);
    if (S.A>=8 || S.B>=8){
      await settleMatch(m, S.A===S.B ? 'DRAW' : (S.A>S.B?'A':'B'));
    }
  });

  // ===== NEW: Chat =====
  socket.on('chat:send', async ({ matchId, kind, text, emoji })=>{
    const m=(await q('select * from matches where id=$1',[matchId]))[0]; if(!m) return;
    const role = roleOf(m, user.id);
    if (role==='SPECTATOR' && !m.allow_spectator_chat) return;
    if (kind==='text'){ if(!text || text.length>500) return; }
    if (kind==='emoji'){ if(!emoji) return; }
    const id=uuid();
    await q('insert into match_chat_messages(id,match_id,user_id,role,kind,text,emoji) values ($1,$2,$3,$4,$5,$6,$7)',
      [id, matchId, user.id, role, kind, text||null, emoji||null]);
    io.to(m.room).emit('chat:new', { id, match_id:matchId, user:{ id:user.id, username:user.username }, role, kind, text, emoji, createdAt: Date.now() });
  });

  socket.on('chat:history', async ({ matchId })=>{
    const rows = await q(
      `select c.id, c.match_id, c.role, c.kind, c.text, c.emoji, extract(epoch from c.created_at)*1000 as createdAt,
              u.id as user_id, u.username
       from match_chat_messages c left join users u on u.id=c.user_id
       where match_id=$1 order by created_at desc limit 50`, [matchId]
    );
    socket.emit('chat:history', rows.reverse());
  });

  // ===== NEW: Voice signaling (players only) =====
  function isPlayer(m, uid){ return uid===m.creator_user_id || uid===m.taker_user_id }
  async function relay(kind, payload){
    const { matchId } = payload || {}; if(!matchId) return;
    const m=(await q('select * from matches where id=$1',[matchId]))[0]; if(!m||!m.allow_voice) return;
    if (!isPlayer(m, user.id)) return; // only players can send
    io.to(m.room).emit(kind, { ...payload, from: user.id });
  }
  socket.on('rtc:offer',   p => relay('rtc:offer', p));
  socket.on('rtc:answer',  p => relay('rtc:answer', p));
  socket.on('rtc:candidate', p => relay('rtc:candidate', p));
  socket.on('rtc:end',     p => relay('rtc:end', p));
});

server.listen(PORT, ()=> log.info({ msg:'I Can Play server listening', PORT }));
