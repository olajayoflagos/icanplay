/**
 * Ludo Game Engine
 * - 2–4 players
 * - Each has 4 tokens
 * - Dice roll (1–6)
 * - Roll 6 → extra turn & can bring new token out
 * - Tokens move clockwise around 52-track board then into home column
 * - Capture: landing on opponent’s token sends it back to base
 * - Safe squares: some indexes (e.g. 0, 8, 13, 21, 26, 34, 39, 47) can’t be captured
 * - Win: all 4 tokens in home
 */

import { v4 as uuid } from 'uuid';

const COLORS = ['red', 'green', 'yellow', 'blue'];
const TOKENS_PER_PLAYER = 4;
const TRACK_LENGTH = 52;
const HOME_LENGTH = 6;
const SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];

/**
 * Build initial state
 */
export function initialState(players) {
  const tokens = {};
  for (const p of players) {
    tokens[p] = [];
    for (let i=0; i<TOKENS_PER_PLAYER; i++) {
      tokens[p].push({
        id: uuid(),
        pos: 'BASE',   // BASE | 0–51 (track) | HOME:0–5
        finished: false
      });
    }
  }
  return {
    players,
    turnIndex: 0,
    tokens,
    dice: null,
    history: [],
    result: null
  };
}

function currentPlayer(state) {
  return state.players[state.turnIndex];
}

/**
 * Roll dice
 */
export function rollDice(state, playerId) {
  if (state.result) return { error:'game_over' };
  const cur = currentPlayer(state);
  if (cur!==playerId) return { error:'not_your_turn' };

  const value = 1 + Math.floor(Math.random()*6);
  state.dice = value;
  state.history.push({ move:'roll', by:playerId, value });
  return { value };
}

/**
 * Move a token
 */
export function moveToken(state, playerId, tokenId) {
  if (state.result) return { error:'game_over' };
  const cur = currentPlayer(state);
  if (cur!==playerId) return { error:'not_your_turn' };
  if (!state.dice) return { error:'must_roll_first' };

  const t = state.tokens[playerId].find(x=>x.id===tokenId);
  if (!t) return { error:'no_such_token' };
  if (t.finished) return { error:'already_finished' };

  let move = state.dice;

  // If token is in base
  if (t.pos==='BASE') {
    if (move!==6) return { error:'need_6_to_leave_base' };
    t.pos = startPosFor(playerId);
    capture(state, playerId, t.pos);
  } else if (typeof t.pos==='number') {
    // normal track movement
    let next = (t.pos + move) % TRACK_LENGTH;
    const endEntry = homeEntryFor(playerId);

    // Check if entering home stretch
    if (willEnterHome(t.pos, move, endEntry)) {
      let stepsToEntry = (endEntry - t.pos + TRACK_LENGTH) % TRACK_LENGTH;
      let inHome = move - stepsToEntry - 1;
      if (inHome>=0 && inHome<HOME_LENGTH) {
        t.pos = `HOME:${inHome}`;
        if (inHome===HOME_LENGTH-1) t.finished = true;
      } else {
        return { error:'cannot_move' };
      }
    } else {
      t.pos = next;
      capture(state, playerId, next);
    }
  } else if (String(t.pos).startsWith('HOME')) {
    const idx = parseInt(t.pos.split(':')[1],10);
    const next = idx + move;
    if (next<HOME_LENGTH) {
      t.pos = `HOME:${next}`;
      if (next===HOME_LENGTH-1) t.finished = true;
    } else {
      return { error:'cannot_move_home' };
    }
  }

  state.history.push({ move:'move', by:playerId, token:t.id, dice:state.dice, pos:t.pos });

  // check win
  if (state.tokens[playerId].every(x=>x.finished)) {
    state.result = { winner: playerId, reason:'all_finished' };
  }

  // next turn (unless 6)
  if (state.dice!==6) {
    state.turnIndex = (state.turnIndex+1) % state.players.length;
  }
  state.dice = null;
  return { nextState: state };
}

/**
 * Capture opponent tokens
 */
function capture(state, playerId, pos) {
  if (SAFE_SQUARES.includes(pos)) return;
  for (const p of state.players) {
    if (p===playerId) continue;
    for (const t of state.tokens[p]) {
      if (t.pos===pos && !t.finished) {
        t.pos = 'BASE';
        state.history.push({ move:'capture', by:playerId, victim:p, token:t.id });
      }
    }
  }
}

/**
 * Helpers
 */
function startPosFor(playerId) {
  const i = hashIndex(playerId);
  return [0, 13, 26, 39][i]; // red=0, green=13, yellow=26, blue=39
}
function homeEntryFor(playerId) {
  const i = hashIndex(playerId);
  return [50, 11, 24, 37][i];
}
function willEnterHome(cur, move, entry) {
  if (cur<=entry && cur+move>entry) return true;
  if (cur>entry && (cur+move)%TRACK_LENGTH>entry && (cur+move)>=TRACK_LENGTH) return true;
  return false;
}
function hashIndex(id) {
  return Math.abs([...id].reduce((a,c)=>a+c.charCodeAt(0),0)) % 4;
}

/**
 * Forfeit
 */
export function forfeit(state, playerId) {
  state.result = { draw:true, reason:`${playerId} forfeited` };
  return { nextState: state };
}