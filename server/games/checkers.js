/**
 * Checkers rules engine
 * Supports: 8x8 board, forced captures, multi-jumps, kings.
 */

export function initialState() {
  const board = [];

  // 8×8, 12 pieces each (red at top, black at bottom)
  for (let r = 0; r < 8; r++) {
    board[r] = Array(8).fill(null);
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) board[r][c] = { side: 'B', king: false }; // Black
        else if (r > 4) board[r][c] = { side: 'R', king: false }; // Red
      }
    }
  }

  return {
    board,
    turn: 'R',         // Red moves first
    result: null,      // { winner, draw, reason }
    history: []
  };
}

/**
 * Utility: check if a move is inside board
 */
function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

/**
 * Get all legal moves for side
 */
function legalMoves(state, side) {
  const moves = [];
  const dirs = {
    R: [[-1, -1], [-1, 1]],
    B: [[1, -1], [1, 1]]
  };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (!piece || piece.side !== side) continue;

      const directions = piece.king ? [...dirs.R, ...dirs.B] : dirs[side];

      for (const [dr, dc] of directions) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && !state.board[nr][nc]) {
          // Simple move
          moves.push({ from:[r,c], to:[nr,nc], capture:null });
        }
        const jr = r + dr*2, jc = c + dc*2;
        if (
          inBounds(jr, jc) &&
          !state.board[jr][jc] &&
          state.board[nr][nc] &&
          state.board[nr][nc].side !== side
        ) {
          // Jump capture
          moves.push({ from:[r,c], to:[jr,jc], capture:[nr,nc] });
        }
      }
    }
  }

  // Forced capture rule
  const captures = moves.filter(m=>m.capture);
  return captures.length ? captures : moves;
}

/**
 * Apply a move
 * @param {object} state current state
 * @param {object} move { from:[r,c], to:[r,c] }
 * @param {string} playerId
 */
export function applyMove(state, move, playerId, creatorId, takerId) {
  if (state.result) return { error: 'game_over' };

  const side = state.turn;
  const role = (playerId === creatorId ? 'R' : (playerId === takerId ? 'B' : null));
  if (role !== side) return { error: 'not_your_turn' };

  const legal = legalMoves(state, side);
  const found = legal.find(m =>
    m.from[0]===move.from[0] && m.from[1]===move.from[1] &&
    m.to[0]===move.to[0] && m.to[1]===move.to[1]
  );
  if (!found) return { error: 'illegal_move' };

  const next = JSON.parse(JSON.stringify(state));
  const piece = next.board[move.from[0]][move.from[1]];
  next.board[move.from[0]][move.from[1]] = null;
  next.board[move.to[0]][move.to[1]] = piece;

  // Capture
  if (found.capture) {
    const [cr, cc] = found.capture;
    next.board[cr][cc] = null;

    // Multi-jump check
    const pieceAtNew = next.board[move.to[0]][move.to[1]];
    const more = legalMoves(next, side).filter(m =>
      m.from[0]===move.to[0] && m.from[1]===move.to[1] && m.capture
    );
    if (more.length) {
      next.turn = side; // same side continues
    } else {
      next.turn = side==='R'?'B':'R';
    }
  } else {
    next.turn = side==='R'?'B':'R';
  }

  // King promotion
  if (piece.side==='R' && move.to[0]===0) piece.king = true;
  if (piece.side==='B' && move.to[0]===7) piece.king = true;

  // Check win
  const opp = side==='R'?'B':'R';
  const oppMoves = legalMoves(next, opp);
  const oppPieces = next.board.flat().filter(p=>p?.side===opp);
  if (!oppPieces.length || !oppMoves.length) {
    next.result = { winner: playerId, draw:false, reason:'no_moves' };
  }

  next.history.push({ side, move });
  return { nextState: next };
}