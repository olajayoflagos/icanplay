/**
 * Whot Rules Engine
 * - Nigerian house rules version
 */

import { v4 as uuid } from 'uuid';

const SUITS = ['circle', 'cross', 'triangle', 'star', 'square'];
const VALUES = [1,2,3,4,5,7,8,10,11,12,13,14]; // typical values
const WHOT_COUNT = 5; // 5x Whot(20)

function makeDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const v of VALUES) deck.push({ id: uuid(), suit: s, value: v });
  }
  for (let i=0; i<WHOT_COUNT; i++) {
    deck.push({ id: uuid(), suit: 'whot', value: 20 });
  }
  return shuffle(deck);
}

function shuffle(arr) {
  return arr.map(v => [Math.random(), v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
}

export function initialState(players) {
  const deck = makeDeck();
  const hands = {};
  for (const p of players) {
    hands[p] = deck.splice(0,5); // 5 cards each
  }
  const discard = [deck.pop()];
  return {
    players,
    turnIndex: 0,
    hands,
    deck,
    discard,
    pendingEffect: null,  // e.g. { type:'PICK2', count:2 }
    calledSuit: null,
    result: null,
    history: []
  };
}

function currentPlayer(state) {
  return state.players[state.turnIndex];
}

/**
 * Check if card can be played
 */
function canPlay(state, card) {
  const top = state.discard[state.discard.length-1];
  if (card.suit==='whot') return true; // always
  if (state.calledSuit) {
    return card.suit===state.calledSuit;
  }
  return card.suit===top.suit || card.value===top.value;
}

/**
 * Advance turn
 */
function nextTurn(state) {
  state.turnIndex = (state.turnIndex+1) % state.players.length;
}

/**
 * Apply special effects
 */
function applySpecial(state, card) {
  switch(card.value) {
    case 1: // Hold On
      nextTurn(state); break;
    case 2: // Pick 2
      state.pendingEffect = { type:'PICK', count:2 }; break;
    case 5: // Pick 3
      state.pendingEffect = { type:'PICK', count:3 }; break;
    case 8: // Suspension
      nextTurn(state); break;
    case 14: // General Market
      for (const p of state.players) {
        drawCards(state, p, 1);
      }
      break;
    case 20: // Whot
      state.calledSuit = null; // must be set by player explicitly
      break;
  }
}

function drawCards(state, playerId, n) {
  for (let i=0;i<n;i++) {
    if (!state.deck.length) {
      // reshuffle discard minus top
      const top = state.discard.pop();
      state.deck = shuffle(state.discard);
      state.discard = [top];
    }
    const card = state.deck.pop();
    if (card) state.hands[playerId].push(card);
  }
}

/**
 * Player plays a card
 */
export function playCard(state, playerId, cardId, declaredSuit=null) {
  if (state.result) return { error:'game_over' };
  const cur = currentPlayer(state);
  if (playerId!==cur) return { error:'not_your_turn' };

  const hand = state.hands[playerId];
  const card = hand.find(c=>c.id===cardId);
  if (!card) return { error:'no_such_card' };

  if (!canPlay(state, card)) return { error:'illegal_play' };

  // remove from hand
  state.hands[playerId] = hand.filter(c=>c.id!==cardId);
  state.discard.push(card);

  // handle whot suit call
  if (card.value===20) {
    if (!declaredSuit) return { error:'must_call_suit' };
    state.calledSuit = declaredSuit;
  } else {
    state.calledSuit = null;
  }

  applySpecial(state, card);

  // win?
  if (!state.hands[playerId].length) {
    state.result = { winner: playerId, draw:false, reason:'shed_all' };
  }

  state.history.push({ move:'play', by:playerId, card });

  nextTurn(state);
  return { nextState: state };
}

/**
 * Player draws from deck
 */
export function draw(state, playerId) {
  if (state.result) return { error:'game_over' };
  const cur = currentPlayer(state);
  if (playerId!==cur) return { error:'not_your_turn' };

  // pending effect
  if (state.pendingEffect?.type==='PICK') {
    drawCards(state, playerId, state.pendingEffect.count);
    state.pendingEffect = null;
  } else {
    drawCards(state, playerId, 1);
  }

  state.history.push({ move:'draw', by:playerId });

  nextTurn(state);
  return { nextState: state };
}

/**
 * Forfeit match
 */
export function forfeit(state, playerId) {
  if (state.result) return { error:'game_over' };
  state.result = { winner:null, draw:true, reason:`${playerId} forfeited` };
  return { nextState: state };
}