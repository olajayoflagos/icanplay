import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import axios from 'axios';
import crypto from 'crypto';
import pino from 'pino';
import { Server } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { q, withTx, postTx, getBalanceCents } from './db.js';
import { runSettlements } from './settlement.js';

const log = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });

const app = express();
app.use(helmet());
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });

// ---------- helpers ----------
async function auth(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;
  const u = (await q('select id, username from users where id=$1', [token]))[0];
  return u || null;
}
const roleOf = (m, uid) => (uid === m.creator_user_id ? 'PLAYER_A' : (uid === m.taker_user_id ? 'PLAYER_B' : 'SPECTATOR'));
const sideOf = (m, uid) => (uid === m.creator_user_id ? 'A' : (uid === m.taker_user_id ? 'B' : null));

// ---------- health ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- auth ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const uname = String(req.body?.username || '').trim().toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/.test(uname)) return res.status(400).json({ error: '3-16 chars, letters/numbers/_ only' });
    const exists = await q('select 1 from users where username=$1', [uname]);
    if (exists.length) return res.status(409).json({ error: 'Username taken' });
    const id = uuid();
    await q('insert into users(id,username) values ($1,$2)', [id, uname]);
    return res.json({ token: id, user: { id, username: uname } });
  } catch (e) { return res.status(500).json({ error: 'register_failed' }); }
});

// simple username → token login (no password yet)
app.post('/api/auth/login', async (req, res) => {
  try {
    const uname = String(req.body?.username || '').trim().toLowerCase();
    if (!uname) return res.status(400).json({ error: 'username_required' });
    const u = (await q('select id, username from users where username=$1', [uname]))[0];
    if (!u) return res.status(404).json({ error: 'not_found' });
    return res.json({ token: u.id, user: u });
  } catch (e) { return res.status(500).json({ error: 'login_failed' }); }
});

app.get('/api/me', async (req, res) => {
  const u = await auth(req);
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: u });
});

// ---------- wallet ----------
app.get('/api/wallet', async (req, res) => {
  const u = await auth(req);
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  const real = await getBalanceCents(u.id);
  const demo = (await q(
    "select coalesce(sum(amount_cents),0) as c from ledger_entries where account_type='USER_DEMO' and user_id=$1",
    [u.id]
  ))[0]?.c || 0;
  const house = (await q(
    "select coalesce(sum(case when account_type='HOUSE_CASH' then amount_cents else 0 end),0) as c from ledger_entries",
    []
  ))[0]?.c || 0;
  res.json({ balance: real / 100, demo_balance: Number(demo) / 100, house: Number(house) / 100 });
});

app.post('/api/wallet/deposit/initiate', async (req, res) => {
  try {
    const u = await auth(req);
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    const cents = Math.floor(Number(req.body?.amount || 0) * 100);
    if (cents <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const email = req.body?.email;

    // Demo top-up
    if (!email) {
      await withTx(async (c) => {
        await postTx(c, 'DEMO_TOPUP', null, [
          { account_type: 'USER_DEMO', user_id: u.id, amount_cents: cents },
          { account_type: 'OFFCHAIN_DEMO_BANK', user_id: null, amount_cents: -cents }
        ]);
      });
      const demo = (await q(
        "select coalesce(sum(amount_cents),0) as c from ledger_entries where account_type='USER_DEMO' and user_id=$1",
        [u.id]
      ))[0]?.c || 0;
      return res.json({ demo: true, credited: cents / 100, demo_balance: Number(demo) / 100 });
    }

    // Real deposit via Paystack
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET || '';
    if (!PAYSTACK_SECRET) return res.status(400).json({ error: 'Paystack not configured' });
    const r = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      { email, amount: cents, currency: 'NGN', metadata: { user_id: u.id } },
      { headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET } }
    );
    return res.json({
      authorization_url: r.data?.data?.authorization_url,
      reference: r.data?.data?.reference
    });
  } catch {
    return res.status(500).json({ error: 'deposit_init_failed' });
  }
});

// Paystack webhook (credits REAL funds)
app.post('/api/wallet/deposit/webhook', async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET || '';
    if (!secret) return res.sendStatus(400);

    // Optional IP allowlist
    const allowed = (process.env.PAYSTACK_IP_WHITELIST || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const ip = (req.headers['x-forwarded-for']?.split(',')[0]?.trim())
      || req.socket.remoteAddress;
    if (allowed.length && !allowed.includes(ip)) return res.sendStatus(403);

    // HMAC verify
    const signature = req.headers['x-paystack-signature'];
    const hash = crypto.createHmac('sha512', secret).update(req.rawBody).digest('hex');
    if (signature !== hash) return res.sendStatus(401);

    const event = JSON.parse(req.rawBody.toString('utf8'));
    if (event?.event !== 'charge.success') return res.sendStatus(200);

    const data = event.data || {};
    const user_id = data?.metadata?.user_id;
    const amount_cents = Number(data?.amount || 0); // Paystack sends kobo
    const reference = String(data?.reference || '');

    if (!user_id || !amount_cents || !reference) return res.sendStatus(400);

    await withTx(async (c) => {
      await postTx(c, 'DEPOSIT', reference, [
        { account_type: 'PROCESSOR_CLEARING', user_id: null, amount_cents: -amount_cents },
        { account_type: 'USER_CASH', user_id: user_id, amount_cents: amount_cents }
      ], reference);
    });

    res.sendStatus(200);
  } catch (e) {
    log.error(e);
    res.sendStatus(500);
  }
});

// Save/Update payout recipient (Paystack)
app.post('/api/payouts/recipient', async (req, res) => {
  try {
    const u = await auth(req);
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    const { bank_code, account_number, account_name } = req.body || {};
    if (!bank_code || !account_number) return res.status(400).json({ error: 'bank_code and account_number required' });
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET || '';
    if (!PAYSTACK_SECRET) return res.status(400).json({ error: 'Paystack not configured' });

    const r = await axios.post('https://api.paystack.co/transferrecipient', {
      type: 'nuban',
      name: account_name || u.username,
      account_number,
      bank_code,
      currency: 'NGN'
    }, { headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET } });

    const code = r.data?.data?.recipient_code;
    await q(
      `insert into payout_destinations(id,user_id,provider,recipient_code,display,status,usable_after)
       values ($1,$2,'paystack',$3,$4,'PENDING', now() + interval '12 hours')
       on conflict (user_id, recipient_code)
       do update set display=$4, status='PENDING', usable_after=now() + interval '12 hours'`,
      [uuid(), u.id, code, `${bank_code}-${account_number}`]
    );
    res.json({ ok: true, recipient_code: code });
  } catch {
    res.status(500).json({ error: 'recipient_save_failed' });
  }
});

// ---------- matches ----------
app.post('/api/matches', async (req, res) => {
  try {
    const u = await auth(req);
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    const { game = 'chess', stake = 0, demo = true, allow_spectators = true } = req.body || {};
    const id = uuid();
    const room = 'room_' + id;
    const stake_cents = Math.floor(Number(stake || 0) * 100);
    const rake_cents = demo ? 0 : Math.floor(stake_cents * 0.10);
    const escrow_cents = demo ? 0 : stake_cents * 2;
    const payout_cents = demo ? 0 : (stake_cents * 2 - rake_cents);

    await q(
      `insert into matches(id,room,game,demo,stake_cents,escrow_cents,rake_cents,payout_cents,status,creator_user_id,allow_spectators)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'OPEN',$9,$10)`,
      [id, room, game, !!demo, stake_cents, escrow_cents, rake_cents, payout_cents, u.id, !!allow_spectators]
    );
    res.json({ id, game, demo: !!demo, stake: stake_cents / 100, status: 'OPEN' });
  } catch {
    res.status(500).json({ error: 'create_match_failed' });
  }
});

app.post('/api/matches/:id/join', async (req, res) => {
  try {
    const u = await auth(req);
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    const id = req.params.id;
    const m = (await q('select * from matches where id=$1', [id]))[0];
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (m.status !== 'OPEN') return res.status(400).json({ error: 'Not open' });

    await q('update matches set taker_user_id=$1, status=$2, updated_at=now() where id=$3', [u.id, 'LIVE', id]);
    res.json({ id: m.id, game: m.game, demo: m.demo, stake: m.stake_cents / 100, status: 'LIVE' });
  } catch {
    res.status(500).json({ error: 'join_failed' });
  }
});

app.get('/api/matches', async (req, res) => {
  try {
    const status = (req.query.status || 'OPEN').toUpperCase();
    const rows = await q(
      'select id,game,demo,stake_cents,status from matches where status=$1 order by created_at desc limit 100',
      [status]
    );
    res.json(rows.map(r => ({ id: r.id, game: r.game, demo: r.demo, stake: r.stake_cents / 100, status: r.status })));
  } catch {
    res.status(500).json({ error: 'list_failed' });
  }
});

// fetch a single match (useful for /match/:id deep links)
app.get('/api/matches/:id', async (req, res) => {
  try {
    const m = (await q('select * from matches where id=$1', [req.params.id]))[0];
    if (!m) return res.status(404).json({ error: 'Not found' });
    res.json({
      id: m.id, room: m.room, game: m.game, demo: m.demo, stake: m.stake_cents / 100,
      status: m.status, creator_user_id: m.creator_user_id, taker_user_id: m.taker_user_id
    });
  } catch {
    res.status(500).json({ error: 'get_failed' });
  }
});

// ---------- sockets ----------
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
      '';
    if (!token) return next(new Error('auth'));
    const u = (await q('select id, username from users where id=$1', [token]))[0];
    if (!u) return next(new Error('auth'));
    socket.user = u;
    next();
  } catch {
    next(new Error('auth'));
  }
});

io.on('connection', (socket) => {
  const user = socket.user;

  socket.on('match:joinRoom', async ({ id }) => {
    const m = (await q('select * from matches where id=$1', [id]))[0];
    if (!m) return;
    socket.join(m.room);
    socket.emit('match:state', {
      id: m.id,
      room: m.room,
      game: m.game,
      demo: m.demo,
      stake: m.stake_cents / 100,
      status: m.status,
      creator_user_id: m.creator_user_id,
      taker_user_id: m.taker_user_id
    });
    socket.to(m.room).emit('presence:join', { user: user.id });
  });

  socket.on('match:spectateJoin', async ({ id }) => {
    const m = (await q('select * from matches where id=$1', [id]))[0];
    const allowed = m?.allow_spectators ?? true;
    if (!m || !allowed) return;
    socket.join(m.room);
    socket.emit('match:state', {
      id: m.id,
      room: m.room,
      game: m.game,
      demo: m.demo,
      stake: m.stake_cents / 100,
      status: m.status,
      creator_user_id: m.creator_user_id,
      taker_user_id: m.taker_user_id
    });
  });

  // optional UX handlers
  socket.on('match:pause', async ({ matchId }, ack) => {
    try {
      const m = (await q('select * from matches where id=$1', [matchId]))[0];
      if (!m) return ack?.({ error: 'not_found' });
      io.to(m.room).emit('match:paused', { by: user.id });
      ack?.({ ok: true });
    } catch (e) {
      ack?.({ error: 'pause_failed' });
    }
  });

  socket.on('match:resume', async ({ matchId }, ack) => {
    try {
      const m = (await q('select * from matches where id=$1', [matchId]))[0];
      if (!m) return ack?.({ error: 'not_found' });
      io.to(m.room).emit('match:resumed', { by: user.id });
      ack?.({ ok: true });
    } catch (e) {
      ack?.({ error: 'resume_failed' });
    }
  });
});

// ---------- auto-cancel stale OPEN matches (>= 14 days) ----------
async function cancelStaleOpenMatches() {
  const rows = await q(
    `select * from matches
     where status='OPEN' and created_at < now() - interval '14 days'
     order by created_at asc
     limit 200`
  );

  for (const m of rows) {
    try {
      await withTx(async (c) => {
        await c.query('update matches set status=$1, updated_at=now() where id=$2', ['CANCELLED', m.id]);

        if (!m.demo && m.creator_user_id && m.taker_user_id && Number(m.escrow_cents) > 0) {
          const rake = Number(m.rake_cents || 0);
          const total = Number(m.escrow_cents || 0);
          const toSplit = total - rake;
          const each = Math.floor(toSplit / 2);

          await postTx(
            c,
            'CANCEL',
            `CANCEL_${m.id}`,
            [
              ...(rake > 0 ? [{ account_type: 'HOUSE_CASH', user_id: null, amount_cents: rake }] : []),
              { account_type: 'USER_CASH', user_id: m.creator_user_id, amount_cents: each },
              { account_type: 'USER_CASH', user_id: m.taker_user_id, amount_cents: each },
              { account_type: 'ESCROW', user_id: null, amount_cents: -total }
            ],
            `stale_cancel_${m.id}`
          );
        }
      });
      log.info({ msg: 'auto_cancelled_match', id: m.id });
    } catch (e) {
      log.error({ msg: 'auto_cancel_failed', id: m.id, err: e?.message });
    }
  }
}

// run hourly
setInterval(cancelStaleOpenMatches, 60 * 60 * 1000);

// run settlement engine every 5 minutes
setInterval(runSettlements, 5 * 60 * 1000);

// ---------- start ----------
server.listen(PORT, () => log.info({ msg: 'I Can Play server listening', PORT }));