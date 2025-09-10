// client/src/games/Chess.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Chess as ChessEngine } from "chess.js"; // npm i chess.js
import clsx from "clsx";

/**
 * Chess.jsx
 *
 * Props:
 *  - socket: socket.io client instance
 *  - matchId: current match id
 *  - state: server-provided state object (may contain fen, pgn, turn, players, lastMove, clocks)
 *
 * Basic socket contract (example):
 *  - emit "chess:move" -> { matchId, from, to, promotion? }
 *  - listen "chess:update" -> { fen, pgn, lastMove:{from,to}, turn, status, players:{A,B}, clocks:{A:secs,B:secs} }
 *
 * This component is intentionally self-contained and does not rely on external UI libs (Tailwind classes used).
 */

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

// Simple SVG piece icons (monochrome). Adjust styling via CSS/Tailwind if you prefer images.
const PIECE_SVGS = {
  p: (w = 36) => (
    <svg viewBox="0 0 45 45" width={w} height={w}>
      <g fill="none" fillRule="evenodd" stroke="#000" strokeWidth="1.5">
        <path
          d="M22.5 11c-3.2 0-6 2.6-6 6 0 1.5.9 3.4 2.8 5.4 1.9 2 3 3.9 3.2 5.8H16.5c-2.2 0-4 1.8-4 4v2h20v-2c0-2.2-1.8-4-4-4h-6.5c.3-1.9 1.3-3.8 3.2-5.8 1.9-2 2.8-3.9 2.8-5.4 0-3.4-2.8-6-6-6z"
          fill="#111"
        />
      </g>
    </svg>
  ),
  r: (w = 36) => (
    <svg viewBox="0 0 45 45" width={w} height={w}>
      <g fill="#111">
        <path d="M9 39h27v-3H9v3zM12 9h21v6H12zM14 15h17v5H14z" />
        <path d="M12 20c2-2 4-3 6-3h6c2 0 4 1 6 3v10H12V20z" />
      </g>
    </svg>
  ),
  n: (w = 36) => (
    <svg viewBox="0 0 45 45" width={w} height={w}>
      <g fill="#111">
        <path d="M15 30c2-4 6-6 9-6 3 0 7 2 9 6v3H15v-3zM18 9c0 3 3 4 6 4s6-1 6-4-3-4-6-4-6 1-6 4z" />
      </g>
    </svg>
  ),
  b: (w = 36) => (
    <svg viewBox="0 0 45 45" width={w} height={w}>
      <g fill="#111">
        <path d="M22.5 11c-5 0-9 4-9 9 0 2 1 4 2.5 5.5S21 28 22.5 28s6.5-1.5 6.5-2.5S30 22 30 20c0-5-4-9-7.5-9zM12 35h21v3H12z" />
      </g>
    </svg>
  ),
  q: (w = 36) => (
    <svg viewBox="0 0 45 45" width={w} height={w}>
      <g fill="#111">
        <circle cx="22.5" cy="14" r="3" />
        <path d="M12 30c2-6 7-9 10.5-9S33 24 35 30v6H12v-6z" />
      </g>
    </svg>
  ),
  k: (w = 36) => (
    <svg viewBox="0 0 45 45" width={w} height={w}>
      <g fill="#111">
        <path d="M22.5 9v6M19 12h7M15 24c3-6 6-9 7.5-9 1.5 0 4.5 3 7.5 9 0 0-12 0-15 0zM12 36h21v3H12z" stroke="#111" strokeWidth="1.2" />
      </g>
    </svg>
  ),
};

function pieceSvg(piece) {
  // piece like "p", "P", "r", etc.
  if (!piece) return null;
  const color = piece === piece.toLowerCase() ? "black" : "white";
  const key = piece.toLowerCase();
  const svg = PIECE_SVGS[key];
  if (!svg) return null;
  // Wrap so we can tint for white/black
  return (
    <div className={clsx("flex items-center justify-center", color === "white" ? "text-white" : "text-black")}>
      {svg(44)}
    </div>
  );
}

function algebra(file, rank) {
  return `${file}${rank}`;
}

export default function Chess({ socket, matchId, state }) {
  const engine = useMemo(() => new ChessEngine(), []);
  const [boardFEN, setBoardFEN] = useState(engine.fen());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]); // e.g. ['e2e4', 'e2e3']
  const [turn, setTurn] = useState(null); // 'w' or 'b'
  const [status, setStatus] = useState("idle");
  const [pgn, setPgn] = useState("");
  const [lastMove, setLastMove] = useState(null);
  const [promotion, setPromotion] = useState(null); // {from,to}
  const [players, setPlayers] = useState({ A: null, B: null });
  const [clocks, setClocks] = useState({ A: null, B: null });

  // Sync engine with incoming state (server authoritative)
  useEffect(() => {
    if (!state) return;
    // Accept several possible shapes
    if (state.fen) {
      try {
        engine.load(state.fen);
      } catch {}
    } else if (state.pgn) {
      try {
        engine.load_pgn(state.pgn);
      } catch {}
    } else if (state.full && state.full.pgn) {
      try {
        engine.load_pgn(state.full.pgn);
      } catch {}
    } else if (state.moves && Array.isArray(state.moves)) {
      // apply moves sequentially
      const temp = new Chess();
      try {
        state.moves.forEach((m) => temp.move(m));
        engine.load(temp.fen());
      } catch {}
    } else if (state.move && state.move.from && state.move.to) {
      engine.move({ from: state.move.from, to: state.move.to, promotion: state.move.promotion || undefined });
    }
    setBoardFEN(engine.fen());
    setTurn(engine.turn());
    setPgn(engine.pgn());
    setStatus(state.status || (engine.in_checkmate() ? "checkmate" : engine.in_draw() ? "draw" : "ongoing"));
    setLastMove(state.lastMove || null);
    if (state.players) setPlayers(state.players);
    if (state.clocks) setClocks(state.clocks);
    // clear selection on update
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [state, engine]);

  // socket listener for live updates (if backend pushes them)
  useEffect(() => {
    if (!socket) return;
    const onUpdate = (s) => {
      // same shape logic as above; reuse: set boardFEN if provided
      if (s.fen) {
        try {
          engine.load(s.fen);
          setBoardFEN(engine.fen());
          setTurn(engine.turn());
          setPgn(engine.pgn());
        } catch {}
      }
      if (s.pgn) {
        try {
          engine.load_pgn(s.pgn);
          setBoardFEN(engine.fen());
          setTurn(engine.turn());
          setPgn(engine.pgn());
        } catch {}
      }
      if (s.lastMove) setLastMove(s.lastMove);
      if (s.status) setStatus(s.status);
      if (s.players) setPlayers(s.players);
      if (s.clocks) setClocks(s.clocks);
      setSelectedSquare(null);
      setLegalMoves([]);
    };
    socket.on("chess:update", onUpdate);
    return () => {
      socket.off("chess:update", onUpdate);
    };
  }, [socket, engine]);

  // Helper: read board as 2D array of squares with piece
  const board = useMemo(() => {
    const rows = engine.board(); // returns array of ranks [rank8...rank1], each rank is array of 8 squares either null or {type, color}
    return rows;
  }, [boardFEN, engine]);

  function onSquareClick(file, rank) {
    const sq = algebra(file, rank);
    const piece = engine.get(sq);
    const myTurn = engine.turn() === "w" ? "A" : "B"; // server should map players -> sides; this is just local display logic
    // If promotion flow active, ignore clicks outside promotion
    if (promotion) return;

    // If square is a selected legal move target
    const moveNotation = legalMoves.find((m) => m.endsWith(sq));
    if (selectedSquare && moveNotation) {
      // If promotion needed, detect (pawn to last rank)
      const from = selectedSquare;
      const to = sq;
      const isPawnPromotion = engine.get(from)?.type === "p" && (to.endsWith("8") || to.endsWith("1"));
      if (isPawnPromotion) {
        setPromotion({ from, to });
        return;
      }
      doMove(from, to);
      return;
    }

    // If clicking on a piece of either color, select and show legal moves
    if (piece) {
      const moves = engine.moves({ square: sq, verbose: true }) || [];
      const movesStr = moves.map((m) => `${m.from}${m.to}`);
      setSelectedSquare(sq);
      setLegalMoves(movesStr);
      return;
    }

    // otherwise clear
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  function doMove(from, to, promotionPiece = null) {
    try {
      const moveOpts = { from, to, promotion: promotionPiece || undefined };
      // Use engine to test legality locally first
      const res = engine.move(moveOpts);
      if (!res) {
        console.warn("Illegal move attempted locally", moveOpts);
        setLegalMoves([]); setSelectedSquare(null);
        return;
      }
      // update UI immediately (optimistic). Server must validate and broadcast back.
      setBoardFEN(engine.fen());
      setPgn(engine.pgn());
      setTurn(engine.turn());
      setLastMove({ from, to, promotion: promotionPiece || undefined });
      setSelectedSquare(null);
      setLegalMoves([]);

      // Emit to server
      socket?.emit("chess:move", { matchId, from, to, promotion: promotionPiece || undefined }, (ack) => {
        // If server responds with error, revert (server should broadcast authoritative state anyway)
        if (ack && ack.error) {
          // simple naive revert: reload from ack.fen if provided, or undo one move
          if (ack.fen) {
            try { engine.load(ack.fen); setBoardFEN(engine.fen()); setPgn(engine.pgn()); setTurn(engine.turn()); }
            catch {}
          } else {
            engine.undo();
            setBoardFEN(engine.fen());
            setPgn(engine.pgn());
            setTurn(engine.turn());
          }
          setStatus(ack.error || "move_rejected");
        }
      });
    } catch (e) {
      console.error(e);
    }
  }

  // Promotion action UI
  function confirmPromotion(piece) {
    if (!promotion) return;
    const { from, to } = promotion;
    setPromotion(null);
    doMove(from, to, piece); // piece: 'q','r','b','n'
  }

  // Resign / Offer draw
  function doResign() {
    socket?.emit("chess:resign", { matchId });
  }
  function offerDraw() {
    socket?.emit("chess:offerDraw", { matchId });
  }

  // Board rendering helpers
  function squareColor(fileIdx, rankIdx) {
    return (fileIdx + rankIdx) % 2 === 0 ? "bg-gray-300/10" : "bg-gray-700/60";
  }

  function isLegalTarget(sq) {
    return legalMoves.some((m) => m.endsWith(sq));
  }

  function isLastMoveSquare(sq) {
    if (!lastMove) return false;
    return lastMove.from === sq || lastMove.to === sq;
  }

  // Convert engine piece ({type,color}) -> string like 'p' or 'P' to choose icon color
  function toPieceChar(pieceObj) {
    if (!pieceObj) return null;
    const t = pieceObj.type;
    return pieceObj.color === "w" ? t.toUpperCase() : t.toLowerCase();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">♟️ Chess</div>
          <div className="text-xs opacity-70">Match: <span className="font-mono text-sm">{matchId}</span></div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm">
            Turn: <span className="font-medium">{turn === "w" ? "White" : turn === "b" ? "Black" : "—"}</span>
          </div>
          <div className="text-sm opacity-80">Status: <span className="font-medium">{status}</span></div>
          <div className="flex gap-2">
            <button onClick={offerDraw} className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-sm">Offer Draw</button>
            <button onClick={doResign} className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-sm">Resign</button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Board */}
        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-3">
          <div className="grid grid-cols-9 gap-0 select-none">
            {/* Top file labels */}
            <div className="w-6 h-6" />
            {FILES.map((f) => (
              <div key={f} className="w-12 h-6 flex items-center justify-center text-xs opacity-70">{f}</div>
            ))}
            {/* Board rows */}
            {RANKS.map((rank, rankIdx) => (
              <React.Fragment key={rank}>
                {/* Rank label */}
                <div className="w-6 h-12 flex items-center justify-center text-xs opacity-70">{rank}</div>
                {FILES.map((file, fileIdx) => {
                  const sq = algebra(file, rank);
                  const pieceObj = engine.get(sq);
                  const pieceChar = toPieceChar(pieceObj);
                  const bgClass = squareColor(fileIdx, rankIdx);
                  const highlight = selectedSquare === sq ? "outline-2 outline-white/40" : "";
                  const legal = isLegalTarget(sq);
                  const last = isLastMoveSquare(sq);
                  return (
                    <div
                      key={sq}
                      onClick={() => onSquareClick(file, rank)}
                      className={clsx("w-12 h-12 relative flex items-center justify-center cursor-pointer", bgClass, highlight, last ? "ring-2 ring-amber-500" : "")}
                    >
                      {/* legal move dot */}
                      {legal && !pieceChar && <div className="absolute bottom-2 w-2 h-2 rounded-full bg-emerald-400" />}
                      {/* piece */}
                      {pieceChar && <div className={pieceChar === pieceChar.toUpperCase() ? "text-white" : "text-black"}>{pieceSvg(pieceChar)}</div>}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
            {/* bottom file labels */}
            <div className="w-6 h-6" />
            {FILES.map((f) => (
              <div key={f} className="w-12 h-6 flex items-center justify-center text-xs opacity-70">{f}</div>
            ))}
          </div>
        </div>

        {/* Sidebar: history, last move, players */}
        <div className="flex-1 space-y-3">
          <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-3">
            <div className="font-semibold mb-2">Players</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-80">White (A)</div>
                <div className="font-medium">{players.A?.username || "Waiting..."}</div>
              </div>
              <div className="text-right">
                <div className="text-sm opacity-80">Clock</div>
                <div className="font-medium">{clocks.A ? `${Math.floor(clocks.A/60)}:${String(clocks.A%60).padStart(2,"0")}` : "—:—"}</div>
              </div>
            </div>
            <div className="border-t border-gray-800 my-3" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-80">Black (B)</div>
                <div className="font-medium">{players.B?.username || "Waiting..."}</div>
              </div>
              <div className="text-right">
                <div className="text-sm opacity-80">Clock</div>
                <div className="font-medium">{clocks.B ? `${Math.floor(clocks.B/60)}:${String(clocks.B%60).padStart(2,"0")}` : "—:—"}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-3">
            <div className="font-semibold mb-2">Move History</div>
            <div className="max-h-48 overflow-auto text-sm">
              {pgn ? (
                <pre className="whitespace-pre-wrap break-words text-xs opacity-90">{pgn}</pre>
              ) : (
                <div className="text-xs opacity-70">No moves yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-3">
            <div className="font-semibold mb-2">Controls</div>
            <div className="flex gap-2">
              <button
                onClick={() => { socket?.emit("chess:requestState", { matchId }); }}
                className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-700"
              >
                Refresh
              </button>
              <button
                onClick={() => { socket?.emit("chess:offerRematch", { matchId }); }}
                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700"
              >
                Offer Rematch
              </button>
            </div>
            {lastMove && (
              <div className="text-xs opacity-80 mt-2">Last: {lastMove.from} → {lastMove.to}{lastMove.promotion ? ` (${lastMove.promotion})` : ""}</div>
            )}
          </div>
        </div>
      </div>

      {/* Promotion modal */}
      {promotion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPromotion(null)} />
          <div className="relative bg-gray-900/95 border border-gray-800 rounded-xl p-4 w-80">
            <div className="font-semibold mb-2">Choose promotion</div>
            <div className="flex gap-2">
              {["q", "r", "b", "n"].map((p) => (
                <button
                  key={p}
                  onClick={() => confirmPromotion(p)}
                  className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700"
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}