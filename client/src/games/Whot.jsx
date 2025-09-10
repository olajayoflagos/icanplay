import React, { useEffect, useState } from "react";
import clsx from "clsx";

/**
 * Whot.jsx
 *
 * Socket events:
 *  - emit "whot:play" { matchId, card, callSuit? }
 *  - emit "whot:draw" { matchId }
 *  - listen "whot:update" { hands, pile, turn, deckCount, players, status, lastMove }
 */

const SUITS = ["circle", "cross", "triangle", "star", "square", "whot"];
const SUIT_ICONS = {
  circle: "⚪",
  cross: "✚",
  triangle: "▲",
  star: "★",
  square: "■",
  whot: "WHOT"
};

function CardView({ card, onClick, disabled }) {
  if (!card) return null;
  const { suit, value } = card;
  const isWhot = suit === "whot";
  return (
    <div
      onClick={() => !disabled && onClick?.()}
      className={clsx(
        "w-16 h-24 rounded-lg shadow-lg cursor-pointer flex flex-col items-center justify-center",
        "border-2",
        isWhot ? "bg-purple-600 text-white border-purple-800" : "bg-white border-gray-400"
      )}
    >
      <div className="text-xs font-bold">{value}</div>
      <div className="text-lg">{SUIT_ICONS[suit]}</div>
    </div>
  );
}

export default function Whot({ socket, matchId, state }) {
  const [hand, setHand] = useState([]);
  const [pile, setPile] = useState([]);
  const [deckCount, setDeckCount] = useState(0);
  const [turn, setTurn] = useState(null);
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState("ongoing");
  const [lastMove, setLastMove] = useState(null);
  const [callSuit, setCallSuit] = useState(null);

  useEffect(() => {
    if (!socket) return;
    function onUpdate(s) {
      setHand(s.hands?.me || []);
      setPile(s.pile || []);
      setDeckCount(s.deckCount || 0);
      setTurn(s.turn);
      setPlayers(s.players || []);
      setStatus(s.status || "ongoing");
      setLastMove(s.lastMove || null);
      setCallSuit(s.callSuit || null);
    }
    socket.on("whot:update", onUpdate);
    return () => socket.off("whot:update", onUpdate);
  }, [socket]);

  const topPile = pile[pile.length - 1] || null;

  function canPlay(card) {
    if (!topPile) return true;
    if (card.suit === "whot") return true;
    if (card.suit === topPile.suit) return true;
    if (card.value === topPile.value) return true;
    return false;
  }

  function playCard(card) {
    if (card.suit === "whot") {
      const chosen = prompt("Choose a suit (circle, cross, triangle, star, square)");
      if (!SUITS.includes(chosen)) return;
      socket?.emit("whot:play", { matchId, card, callSuit: chosen });
    } else {
      socket?.emit("whot:play", { matchId, card });
    }
  }

  function drawCard() {
    socket?.emit("whot:draw", { matchId });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">🃏 Whot</div>
          <div className="text-xs opacity-70">Match: {matchId}</div>
        </div>
        <div className="text-sm">
          Turn: <span className="font-medium">{turn}</span>
        </div>
      </div>

      {/* Pile + deck */}
      <div className="flex items-center gap-6">
        <div>
          <div className="font-semibold text-sm mb-1">Pile (Top)</div>
          {topPile ? <CardView card={topPile} /> : <div className="w-16 h-24 bg-gray-600 rounded-lg" />}
          {callSuit && <div className="text-xs mt-1">Suit called: {callSuit}</div>}
        </div>
        <div>
          <div className="font-semibold text-sm mb-1">Deck</div>
          <div
            onClick={drawCard}
            className="w-16 h-24 bg-gray-400 rounded-lg shadow-lg flex items-center justify-center cursor-pointer"
          >
            {deckCount}
          </div>
        </div>
      </div>

      {/* Player Hand */}
      <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
        <div className="font-semibold mb-2">Your Hand</div>
        <div className="flex flex-wrap gap-2">
          {hand.map((c, idx) => (
            <CardView
              key={idx}
              card={c}
              disabled={!canPlay(c)}
              onClick={() => canPlay(c) && playCard(c)}
            />
          ))}
        </div>
        {!hand.length && <div className="text-sm opacity-70">You have no cards (check win condition).</div>}
      </div>

      {/* Players */}
      <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
        <div className="font-semibold mb-2">Players</div>
        <div className="space-y-1 text-sm">
          {players.map((p, i) => (
            <div
              key={p.id || i}
              className={clsx(
                "flex items-center justify-between",
                turn === p.id ? "bg-amber-600/20" : ""
              )}
            >
              <div>{p.username || "Player"}</div>
              <div className="opacity-70">{p.handCount} cards</div>
            </div>
          ))}
        </div>
      </div>

      {/* Last move */}
      <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
        <div className="font-semibold mb-2">Last Move</div>
        <div className="text-sm">
          {lastMove ? (
            <div>
              {lastMove.player}: played {lastMove.card?.value} {lastMove.card?.suit}
            </div>
          ) : (
            <div className="opacity-70">No moves yet</div>
          )}
        </div>
      </div>

      {/* Status */}
      {status !== "ongoing" && (
        <div className="text-center font-semibold text-lg text-emerald-400">
          Game ended: {status}
        </div>
      )}
    </div>
  );
}