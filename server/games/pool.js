/**
 * Pool 8-Ball Lite rules engine
 * Simplified: no spin, no cushions. Just ball categories + 8-ball win.
 */

export function initialState() {
  return {
    balls: {
      solids: [1,2,3,4,5,6,7],
      stripes: [9,10,11,12,13,14,15],
      eight: [8],
      pocketed: []
    },
    turn: null,             // 'A' or 'B'
    assignments: {},        // { A: 'solids'|'stripes', B: 'solids'|'stripes' }
    result: null,           // { winner, draw, reason }
    history: []             // { player, action, result }
  };
}

/**
 * Assign players to sides of the match
 */
export function assignPlayers(state, creatorId, takerId) {
  return {
    ...state,
    creatorId,
    takerId,
    turn: 'A'
  };
}

/**
 * Apply a shot
 * @param {object} state current game state
 * @param {object} action { ballsPocketed: number[], foul: boolean }
 * @param {string} playerId socket.user.id
 */
export function applyAction(state, action, playerId) {
  if (state.result) return { error: 'game_over' };

  const role = playerId === state.creatorId ? 'A' : 
               playerId === state.takerId   ? 'B' : null;
  if (!role) return { error: 'spectators_cannot_play' };
  if (role !== state.turn) return { error: 'not_your_turn' };

  const next = JSON.parse(JSON.stringify(state));
  let turnKeeps = false;
  let foul = !!action.foul;
  let winner = null;
  let draw = false;
  let reason = '';

  // Pocket balls
  for (const b of action.ballsPocketed||[]) {
    if (!next.balls.pocketed.includes(b)) {
      next.balls.pocketed.push(b);
    }
  }

  // Assign groups if not set yet
  if (!next.assignments.A && !next.assignments.B) {
    if (action.ballsPocketed?.some(b=>next.balls.solids.includes(b))) {
      next.assignments[role] = 'solids';
      next.assignments[role==='A'?'B':'A'] = 'stripes';
    }
    if (action.ballsPocketed?.some(b=>next.balls.stripes.includes(b))) {
      next.assignments[role] = 'stripes';
      next.assignments[role==='A'?'B':'A'] = 'solids';
    }
  }

  const myGroup = next.assignments[role];

  // Handle 8-ball
  if (action.ballsPocketed?.includes(8)) {
    const myRemaining = (next.balls[myGroup]||[]).filter(b=>!next.balls.pocketed.includes(b));
    if (myRemaining.length === 0 && !foul) {
      winner = playerId;
      reason = '8ball_pocketed';
    } else {
      winner = (role==='A'?state.takerId:state.creatorId);
      reason = 'early_8ball';
    }
  }

  // Check if player cleared all their balls
  const myRemaining = (next.balls[myGroup]||[]).filter(b=>!next.balls.pocketed.includes(b));
  if (myRemaining.length === 0 && !winner) {
    // Wait until 8-ball pocketed for win
  }

  // Fouls → opponent gets turn
  if (foul) {
    next.turn = role==='A'?'B':'A';
  } else {
    // Keep turn if you pocketed at least one of your own balls
    if (action.ballsPocketed?.some(b=> (next.balls[myGroup]||[]).includes(b))) {
      turnKeeps = true;
    }
    if (!turnKeeps) {
      next.turn = role==='A'?'B':'A';
    }
  }

  if (winner) {
    next.result = { winner, draw:false, reason };
  }

  // Max 48h cutoff is enforced by server, not here.

  next.history.push({ player: role, action, foul, winner, draw });
  return { nextState: next, winner, draw, error: null };
}