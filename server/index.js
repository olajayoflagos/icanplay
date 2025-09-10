// server/index.js
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
import { settleMatch, autoSettleIfOverdue } from './settlement.js';

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
const roleOf = (m, uid) =>
  uid === m.creator_user_id ? 'PLAYER_A' : (uid === m.taker_user_id ? 'PLAYER_B' : 'SPECTATOR');

// ---------- health ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- auth ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const uname = String(req.body?.username || '').trim().toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/.test(uname))
      return res.status(400).json({ error: '3-16 chars, letters/numbers/_ only' });
    const exists = await q('select 1 from users where username=$1', [uname]);
    if (exists.length) return res.status(409).json({ error: 'Username taken' });
    const id = uuid();
    await q('insert into users(id,username) values ($1,$2)', [id, uname]);
    return res.json({ token: id, user: { id, username: uname } });
  } catch (e) {
    return res.status(500).json({ error: 'register_failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const uname = String(req.body?.username || '').trim().toLowerCase();
    if (!uname) return res.status(400).json({ error: 'username_required' });
    const u = (await q('select id, username from users where username=$1', [uname]))[0];
    if (!u) return res.status(404).json({ error: 'not_found' });
    return res.json({ token: u.id, user: u });
  } catch (e) {
    return res.status(500).json({ error: 'login_failed' });
  }
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

  const realCents = await getBalanceCents(u.id) || 0;
  const demoCents = (await q(
    "select coalesce(sum(amount_cents),0) as c from ledger_entries where account_type='USER_DEMO' and user_id=$1",
    [u.id]
  ))[0]?.c || 0;
  const houseCents = (await q(
    "select coalesce(sum(case when account_type='HOUSE_CASH' then amount_cents else 0 end),0) as c from ledger_entries",
    []
  ))[0]?.c || 0;

  res.json({
    balance: Number(realCents) / 100,
    demo_balance: Number(demoCents) / 100,
    house: Number(houseCents) / 100,
    user: u
  });
});

app.post('/api/wallet/deposit/initiate', async (req, res) => {
  try {
    const u = await auth(req);
    if (!u) return res.status(401).json({ error: 'Unauthorized' });

    const cents = Math.floor(Number(req.body?.amount || 0) * 100);
    if (cents <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const email = req.body?.email;

    // DEMO TOP-UP
    if (!email) {
      await withTx(async (c) => {
        await postTx(c, 'DEMO_TOPUP', null, [
          { account_type: 'USER_DEMO', user_id: u.id, amount_cents: cents },
          { account_type: 'OFFCHAIN_DEMO_BANK', user_id: null, amount_cents: -cents }
        ]);
      });
      const demoCents = (await q(
        "select coalesce(sum(amount_cents),0) as c from ledger_entries where account_type='USER_DEMO' and user_id=$1",
        [u.id]
      ))[0]?.c || 0;
      return res.json({
        demo: true,
        credited: cents / 100,
        demo_balance: Number(demoCents) / 100
      });
    }

    // REAL DEPOSIT VIA PAYSTACK
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
  } catch (err) {
    log.error({ msg: 'deposit_initiate_failed', err: err?.message });
    return res.status(500).json({ error: 'deposit_init_failed' });
  }
});

app.post('/api/wallet/deposit/webhook', async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET || '';
    if (!secret) return res.sendStatus(400);

    const signature = req.headers['x-paystack-signature'];
    const hash = crypto.createHmac('sha512', secret).update(req.rawBody).digest('hex');
    if (signature !== hash) return res.sendStatus(401);

    const event = JSON.parse(req.rawBody.toString('utf8'));
    if (event?.event !== 'charge.success') return res.sendStatus(200);

    const data = event.data || {};
    const user_id = data?.metadata?.user_id;
    const amount_cents = Number(data?.amount || 0);
    const reference = String(data?.reference || '');

    if (!user_id || !amount_cents || !reference) return res.sendStatus(400);

    await withTx(async (c) => {
      await postTx(
        c,
        'DEPOSIT',
        reference,
        [
          { account_type: 'PROCESSOR_CLEARING', user_id: null, amount_cents: -amount_cents },
          { account_type: 'USER_CASH', user_id, amount_cents }
        ],
        reference
      );
    });

    res.sendStatus(200);
  } catch (e) {
    log.error({ msg: 'webhook_failed', err: e?.message });
    res.sendStatus(500);
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
    socket.emit('match:state', m);
    socket.to(m.room).emit('presence:join', { user: user.id });
  });

  socket.on('match:spectateJoin', async ({ id }) => {
    const m = (await q('select * from matches where id=$1', [id]))[0];
    const allowed = m?.allow_spectators ?? true;
    if (!m || !allowed) return;
    socket.join(m.room);
    socket.emit('match:state', m);
  });

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

// ---------- auto-cancel stale OPEN matches ----------
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
      });
      log.info({ msg: 'auto_cancelled_match', id: m.id });
    } catch (e) {
      log.error({ msg: 'auto_cancel_failed', id: m.id, err: e?.message });
    }
  }
}
setInterval(cancelStaleOpenMatches, 60 * 60 * 1000);

// ---------- auto-settle overdue matches ----------
setInterval(() => {
  autoSettleIfOverdue(io, null, { logger: log });
}, 60 * 60 * 1000);

// ---------- start ----------
server.listen(PORT, () => log.info({ msg: 'I Can Play server listening', PORT }));