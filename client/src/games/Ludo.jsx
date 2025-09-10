import React, { useEffect, useState } from "react";
import clsx from "clsx";

/**
 * Ludo.jsx
 *
 * Socket events:
 *  - emit "ludo:roll" { matchId }
 *  - emit "ludo:move" { matchId, tokenId }
 *  - listen "ludo:update" { players, turn, lastRoll, tokens, status }
 */

const COLORS = ["red", "blue", "green", "yellow"];
const COLOR_CLASSES = {
  red: "bg-red-600",
  blue: "bg-blue-600",
  green: "bg-green-600",
  yellow: "bg-yellow-500"
};

function Token({ token, onClick, isTurn }) {
  return (
    <div
      onClick={() => isTurn && onClick?.()}
      className={clsx(
        "w-6 h-6 rounded-full flex items-center justify-center cursor-pointer",
        COLOR_CLASSES[token.color],
        isTurn ? "ring-2 ring-white animate-pulse" : ""
      )}
      title={`${token.color} ${token.index}`}
    />
  );
}

function Dice({ value, onRoll, disabled }) {
  return (
    <div
      onClick={() => !disabled && onRoll?.()}
      className={clsx(
        "w-16 h-16 rounded-xl border-2 flex items-center justify-center cursor-pointer select-none",
        disabled ? "opacity-50 cursor-not-allowed bg-gray-600" : "bg-white text-black"
      )}
    >
      {value || "🎲"}
    </div>
  );
}

export default function Ludo({ socket, matchId, state }) {
  const [players, setPlayers] = useState([]);
  const [turn, setTurn] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [lastRoll, setLastRoll] = useState(null);
  const [status, setStatus] = useState("ongoing");

  useEffect(() => {
    if (!socket) return;
    function onUpdate(s) {
      setPlayers(s.players || []);
      setTurn(s.turn);
      setTokens(s.tokens || []);
      setLastRoll(s.lastRoll || null);
      setStatus(s.status || "ongoing");
    }
    socket.on("ludo:update", onUpdate);
    return () => socket.off("ludo:update", onUpdate);
  }, [socket]);

  function roll() {
    socket?.emit("ludo:roll", { matchId });
  }

  function move(tokenId) {
    socket?.emit("ludo:move", { matchId, tokenId });
  }

  const me = players.find((p) => p.me);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-lg">🎲 Ludo</div>
          <div className="text-xs opacity-70">Match {matchId}</div>
        </div>
        <div className="text-sm">
          Turn: <span className="font-medium">{turn}</span>
        </div>
      </div>

      {/* Dice */}
      <div className="flex items-center gap-3">
        <Dice value={lastRoll} onRoll={roll} disabled={turn !== me?.id || status !== "ongoing"} />
        <div className="text-sm opacity-70">Click to roll when it’s your turn</div>
      </div>

      {/* Board */}
      <div className="grid grid-cols-15 gap-0.5 bg-gray-800 p-2 rounded-xl overflow-auto">
        {Array.from({ length: 15 * 15 }).map((_, idx) => {
          const row = Math.floor(idx / 15);
          const col = idx % 15;

          const tokenHere = tokens.find((t) => t.row === row && t.col === col);

          let bg = "bg-gray-700";
          if (row < 6 && col < 6) bg = COLOR_CLASSES.red;
          if (row < 6 && col > 8) bg = COLOR_CLASSES.blue;
          if (row > 8 && col < 6) bg = COLOR_CLASSES.green;
          if (row > 8 && col > 8) bg = COLOR_CLASSES.yellow;

          return (
            <div key={idx} className={clsx("w-5 h-5 md:w-6 md:h-6 flex items-center justify-center", bg)}>
              {tokenHere && (
                <Token
                  token={tokenHere}
                  isTurn={turn === me?.id}
                  onClick={() => move(tokenHere.id)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Players */}
      <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-3">
        <div className="font-semibold mb-2">Players</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {players.map((p) => (
            <div
              key={p.id}
              className={clsx(
                "flex items-center justify-between rounded px-2 py-1",
                turn === p.id ? "bg-amber-600/30" : "bg-gray-800/40"
              )}
            >
              <span>{p.username}</span>
              <span className="opacity-70">{p.tokensHome}/4 home</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status */}
      {status !== "ongoing" && (
        <div className="text-center text-lg font-bold text-emerald-400">Game ended: {status}</div>
      )}
    </div>
  );
}