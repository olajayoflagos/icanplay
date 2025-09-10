import { Chess } from 'chess.js';

/**
 * Initialize a fresh chess state
 */
export function initialState() {
  const chess = new Chess();
  return {
    fen: chess.fen(),      // Forsyth–Edwards Notation
    history: [],           // moves in SAN (Standard Algebraic Notation)
    turn: chess.turn(),    // 'w' or 'b'
    result: null           // { winner, draw, reason }
  };
}

/**
 * Apply a player action (move) to the current state
 * @param {object} state - current game state {fen, history, turn, result}
 * @param {object} action - { from: "e2", to: "e4", promotion?: "q" }
 * @param {string} playerId - socket.user.id
 */
export function applyAction(state, action, playerId) {
  if (state.result) {
    return { error: 'game_over' };
  }

  const chess = new Chess(state.fen);

  // Enforce turn
  const isWhiteTurn = chess.turn() === 'w';
  const playerColor = state.whiteId === playerId ? 'w' :
                      state.blackId === playerId ? 'b' : null;
  if (!playerColor) return { error: 'spectators_cannot_move' };
  if (playerColor !== chess.turn()) return { error: 'not_your_turn' };

  // Attempt move
  const move = chess.move({
    from: action.from,
    to: action.to,
    promotion: action.promotion || 'q'
  });

  if (!move) return { error: 'illegal_move' };

  const nextState = {
    fen: chess.fen(),
    history: [...state.history, move.san],
    turn: chess.turn(),
    result: null
  };

  let winner = null;
  let draw = false;
  let reason = '';

  if (chess.isCheckmate()) {
    winner = playerId;
    reason = 'checkmate';
  } else if (chess.isStalemate()) {
    draw = true;
    reason = 'stalemate';
  } else if (chess.isThreefoldRepetition()) {
    draw = true;
    reason = 'threefold';
  } else if (chess.isInsufficientMaterial()) {
    draw = true;
    reason = 'material';
  } else if (chess.isDraw()) {
    draw = true;
    reason = 'draw';
  }

  if (winner || draw) {
    nextState.result = { winner, draw, reason };
  }

  return { nextState, winner, draw, error: null };
}

/**
 * Attach players to a new match
 */
export function assignPlayers(state, creatorId, takerId) {
  return {
    ...state,
    whiteId: creatorId,
    blackId: takerId
  };
}