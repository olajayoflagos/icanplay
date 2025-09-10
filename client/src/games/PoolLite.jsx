import React, { useRef, useEffect, useState } from "react";
import clsx from "clsx";

/**
 * PoolLite.jsx (8-Ball Lite)
 *
 * Socket events:
 *  - emit "pool:shoot" { matchId, angle, power }
 *  - listen "pool:update" { balls, turn, lastShot, status }
 */

const TABLE_WIDTH = 600;
const TABLE_HEIGHT = 320;
const BALL_RADIUS = 10;
const COLORS = [
  "#ffffff", // cue
  "#ff0000", "#0000ff", "#008000", "#ffff00", "#ff00ff", "#00ffff", "#ff8800", // solids
  "#aa0000", "#000088", "#004400", "#888800", "#880088", "#008888", "#884400", // stripes
  "#000000" // 8-ball
];

export default function PoolLite({ socket, matchId, state }) {
  const canvasRef = useRef(null);
  const [balls, setBalls] = useState([]);
  const [turn, setTurn] = useState(null);
  const [status, setStatus] = useState("ongoing");
  const [aim, setAim] = useState({ angle: 0, power: 0 });
  const [dragging, setDragging] = useState(false);

  // subscribe to socket updates
  useEffect(() => {
    if (!socket) return;
    const onUpdate = (s) => {
      setBalls(s.balls || []);
      setTurn(s.turn);
      setStatus(s.status || "ongoing");
    };
    socket.on("pool:update", onUpdate);
    return () => socket.off("pool:update", onUpdate);
  }, [socket]);

  // draw table + balls
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    // table
    ctx.fillStyle = "#0a5c2f";
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    // pockets
    const pockets = [
      [0, 0],
      [TABLE_WIDTH / 2, 0],
      [TABLE_WIDTH, 0],
      [0, TABLE_HEIGHT],
      [TABLE_WIDTH / 2, TABLE_HEIGHT],
      [TABLE_WIDTH, TABLE_HEIGHT]
    ];
    ctx.fillStyle = "#000";
    pockets.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fill();
    });

    // balls
    balls.forEach((b, i) => {
      ctx.fillStyle = COLORS[b.color] || "#fff";
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#222";
      ctx.stroke();
    });

    // aim line (cue ball only)
    const cue = balls.find((b) => b.isCue);
    if (cue && dragging) {
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.moveTo(cue.x, cue.y);
      ctx.lineTo(
        cue.x + Math.cos(aim.angle) * (aim.power * 2),
        cue.y + Math.sin(aim.angle) * (aim.power * 2)
      );
      ctx.stroke();
    }
  }, [balls, aim, dragging]);

  // aim handling
  function onMouseDown(e) {
    setDragging(true);
    updateAim(e);
  }
  function onMouseMove(e) {
    if (dragging) updateAim(e);
  }
  function onMouseUp() {
    if (dragging) {
      setDragging(false);
      socket?.emit("pool:shoot", { matchId, angle: aim.angle, power: aim.power });
    }
  }

  function updateAim(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const cue = balls.find((b) => b.isCue);
    if (!cue) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = mx - cue.x;
    const dy = my - cue.y;
    const angle = Math.atan2(dy, dx);
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) / 3, 50); // cap
    setAim({ angle, power });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">🎱 Pool Lite</div>
        <div className="text-sm">Turn: {turn}</div>
      </div>

      <canvas
        ref={canvasRef}
        width={TABLE_WIDTH}
        height={TABLE_HEIGHT}
        className="border-4 border-green-900 rounded-lg shadow-lg w-full max-w-3xl mx-auto"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      />

      <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-3 text-sm">
        <div className="font-semibold mb-2">Game Info</div>
        <div>Status: {status}</div>
        <div className="opacity-70">Drag back from cue ball to aim, release to shoot.</div>
      </div>
    </div>
  );
}