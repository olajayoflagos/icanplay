import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * Archery Game Component
 * Props:
 *  - socket: socket.io client instance
 *  - matchId: current match id
 *  - state: latest server-synced state
 */
export default function Archery({ socket, matchId, state }) {
  const [myShots, setMyShots] = useState([]);
  const [oppShots, setOppShots] = useState([]);
  const [turn, setTurn] = useState(null);
  const [lastShot, setLastShot] = useState(null);

  useEffect(() => {
    if (state?.shots) {
      setMyShots(state.myShots || []);
      setOppShots(state.opponentShots || []);
      setTurn(state.turn);
    }
  }, [state]);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (s) => {
      setMyShots(s.myShots || []);
      setOppShots(s.opponentShots || []);
      setTurn(s.turn);
      setLastShot(s.lastShot || null);
    };
    socket.on("archery:update", onUpdate);
    return () => socket.off("archery:update", onUpdate);
  }, [socket]);

  function shoot() {
    socket?.emit("archery:shoot", { matchId });
  }

  const myTotal = myShots.reduce((a, b) => a + b, 0);
  const oppTotal = oppShots.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-xl">🏹 Archery Arena</h2>
        <div className="text-sm opacity-70">Turn: {turn || "—"}</div>
      </div>

      {/* Target board */}
      <div className="flex justify-center relative">
        <div className="relative w-64 h-64 rounded-full flex items-center justify-center">
          {/* Rings */}
          {["bg-red-600", "bg-blue-600", "bg-yellow-400", "bg-white"].map(
            (color, i) => (
              <div
                key={i}
                className={`absolute rounded-full ${color}`}
                style={{
                  width: `${64 - i * 16}vmin`,
                  height: `${64 - i * 16}vmin`,
                  maxWidth: `${256 - i * 64}px`,
                  maxHeight: `${256 - i * 64}px`,
                }}
              />
            )
          )}

          {/* Arrow animation */}
          {lastShot && (
            <motion.div
              key={lastShot.time}
              initial={{ y: -200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 120 }}
              className="absolute w-2 h-8 bg-black rotate-45"
              style={{
                top: `${50 + lastShot.offsetY}%`,
                left: `${50 + lastShot.offsetX}%`,
              }}
            />
          )}
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-gray-900/40 border border-gray-800 p-4">
          <div className="font-semibold mb-1">You</div>
          <div className="text-sm">Shots: {myShots.join(", ") || "—"}</div>
          <div className="font-bold text-lg">Total: {myTotal}</div>
        </div>
        <div className="rounded-xl bg-gray-900/40 border border-gray-800 p-4">
          <div className="font-semibold mb-1">Opponent</div>
          <div className="text-sm">{oppShots.join(", ") || "—"}</div>
          <div className="font-bold text-lg">Total: {oppTotal}</div>
        </div>
      </div>

      {/* Shoot button */}
      <div className="flex justify-center">
        <button
          onClick={shoot}
          disabled={turn !== "ME"}
          className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          🎯 Shoot Arrow
        </button>
      </div>
    </div>
  );
}