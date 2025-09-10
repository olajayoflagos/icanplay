/**
 * Archery Game Engine
 * - 1 vs 1 or more players (supports 2–4 players)
 * - Each match has ROUNDS (default 5)
 * - Each round each player shoots N arrows (default 3)
 * - Target scoring: 10 (bullseye) → 1 (outer) → 0 (miss)
 * - Winner = highest total score
 */

import { v4 as uuid } from 'uuid';

const DEFAULT_ROUNDS = 5;
const ARROWS_PER_ROUND = 3;
const MAX_SCORE = 10; // bullseye

/**
 * Create initial game state
 */
export function initialState(players, rounds=DEFAULT_ROUNDS) {
  const scores = {};
  for (const p of players) {
    scores[p] = { total: 0, rounds: [] }; // rounds: [ [arrow1, arrow2, ...], ...]
  }
  return {
    players,
    roundIndex: 0,
    arrowIndex: 0,
    scores,
    turnIndex: 0,
    rounds,
    history: [],
    result: null
  };
}

function currentPlayer(state) {
  return state.players[state.turnIndex];
}

/**
 * Shoot an arrow
 */
export function shoot(state, playerId, score) {
  if (state.result) return { error: 'game_over' };
  const cur = currentPlayer(state);
  if (cur !== playerId) return { error: 'not_your_turn' };
  if (score < 0 || score > MAX_SCORE) return { error: 'invalid_score' };

  const roundIdx = state.roundIndex;
  const arrowIdx = state.arrowIndex;

  if (!state.scores[playerId].rounds[roundIdx]) {
    state.scores[playerId].rounds[roundIdx] = [];
  }

  state.scores[playerId].rounds[roundIdx][arrowIdx] = score;
  state.scores[playerId].total += score;

  state.history.push({ move:'shoot', by:playerId, round:roundIdx, arrow:arrowIdx, score });

  // Advance arrow
  state.arrowIndex++;

  // If player finished arrows this round
  if (state.arrowIndex >= ARROWS_PER_ROUND) {
    state.arrowIndex = 0;
    state.turnIndex = (state.turnIndex+1) % state.players.length;

    // If all players finished arrows → next round
    if (state.turnIndex === 0) {
      state.roundIndex++;
    }
  }

  // Check game end
  if (state.roundIndex >= state.rounds) {
    const winner = decideWinner(state);
    state.result = winner;
  }

  return { nextState: state };
}

/**
 * Decide winner
 */
function decideWinner(state) {
  let max = -1;
  let winners = [];
  for (const p of state.players) {
    const t = state.scores[p].total;
    if (t > max) {
      max = t;
      winners = [p];
    } else if (t === max) {
      winners.push(p);
    }
  }
  if (winners.length === 1) {
    return { winner: winners[0], score: max, reason:'highest_score' };
  } else {
    return { draw:true, winners, score: max, reason:'tie' };
  }
}

/**
 * Forfeit
 */
export function forfeit(state, playerId) {
  state.result = { draw:true, reason:`${playerId} forfeited` };
  return { nextState: state };
}