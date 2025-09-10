import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { Server } from 'socket.io';
import { v4 as uuid } from 'uuid';
import pino from 'pino';

import { q, withTx, postTx, getBalanceCents } from './db.js';
import * as settlement from './settlement.js';
import * as chess from './games/chess.js';
import * as checkers from './games/checkers.js';
import * as whot from './games/whot.js';
import * as ludo from './games/ludo.js';
import * as archery from './games/archery.js';
import * as pool from './games/pool.js';

const log = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*', credentials: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });

const GAME_ENGINES = { chess, checkers, whot, ludo, archery, pool };

// ------------- AUTH -------------
async function auth(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;
  const u = (await q('select id, username from users where id=$1', [token]))[0];
  return u || null;
}

// ------------- API ROUTES (trimmed for brevity) -------------
app.get('/api/health', (_, res) => res.json({ ok: true }));
// keep your /auth, /wallet, /matches routes from before here

// ------------- SOCKET HANDLERS -------------
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '') || '';
    if (!token) return next(new Error('auth'));
    const u = (await q('select id, username from users where id=$1', [token]))[0];
    if (!u) return next(new Error('auth'));
    socket.user = u;
    next();
  } catch { next(new Error('auth')); }
});

io.on('connection', (socket) => {
  const user = socket.user;

  // Join as player
  socket.on('match:joinRoom', async ({ id }) => {
    const m = (await q('select * from matches where id=$1', [id]))[0];
    if (!m) return;
    socket.join(m.room);
    socket.emit('match:state', m);
    socket.to(m.room).emit('presence:join', { user: user.id });
  });

  // Spectator
  socket.on('match:spectateJoin', async ({ id }) => {
    const m = (await q('select * from matches where id=$1', [id]))[0];
    if (!m || m.allow_spectators === false) return;
    socket.join(m.room);
    socket.emit('match:state', m);
  });

  // Game action
  socket.on('game:action', async ({ matchId, action }, ack) => {
    try {
      const m = (await q('select * from matches where id=$1', [matchId]))[0];
      if (!m || m.status !== 'LIVE') return ack?.({ error: 'not_live' });

      const engine = GAME_ENGINES[m.game];
      if (!engine) return ack?.({ error: 'unknown_game' });

      // Load current state (persisted or fallback to default)
      const current = (await q('select state from match_states where match_id=$1', [m.id]))[0]?.state || engine.initialState();

      const { nextState, winner, draw, error } = engine.applyAction(current, action, user.id);
      if (error) return ack?.({ error });

      // Save new state
      await q(
        `insert into match_states(match_id,state,updated_at)
         values ($1,$2,now())
         on conflict (match_id) do update set state=$2,updated_at=now()`,
        [m.id, nextState]
      );

      // Broadcast state
      io.to(m.room).emit(`${m.game}:update`, nextState);

      // Handle settlement if game over
      if (winner || draw) {
        await settlement.settleMatch(m, winner, draw);
        io.to(m.room).emit('match:settled', { winner, draw });
      }

      ack?.({ ok: true });
    } catch (e) {
      log.error(e);
      ack?.({ error: 'action_failed' });
    }
  });

  // Pause/Resume/Forfeit
  socket.on('match:pause', (d, ack) => settlement.handlePause(io, socket, d, ack));
  socket.on('match:resume', (d, ack) => settlement.handleResume(io, socket, d, ack));
  socket.on('match:forfeit', (d, ack) => settlement.handleForfeit(io, socket, d, ack));
});

// Auto-expire stale matches
setInterval(() => settlement.expireMatches(io), 60 * 60 * 1000);

server.listen(process.env.PORT || 4000, () => log.info('Server started'));