// client/src/games/Checkers.jsx
import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

/**
 * Checkers.jsx
 *
 * Props:
 *  - socket: socket.io client instance
 *  - matchId: current match id
 *  - state: server-provided state object (may contain board, turn, lastMove, status, players)
 *
 * Socket contract (example):
 *  - emit "checkers:move" -> { matchId, moves: [ { from: 'b6', to: 'c5' }, ... ] }
 *  - listen "checkers:update" -> { board, turn, lastMove, status, players }
 *
 * Board representation:
 *  - board is an object mapping square => piece, e.g. { "b6": { color:'A'|'B', king: true|false }, ... }
 *  - squares are algebraic like "a1".."h8"
 *
 * This component implements local move legality (mandatory captures, multi-jumps).
 */

const FILES = ["a","b","c","d","e","f","g","h"];
const RANKS = [8,7,6,5,4,3,2,1];

function algebra(file, rank){ return `${file}${rank}`; }

function initialBoard(){
  // Setup standard checkers: rows 1-3 for B, rows 6-8 for A on dark squares
  const board = {};
  // Dark squares are those where (file idx + rank) % 2 === 1 (if a1 is light)
  FILES.forEach((f, fi) => {
    RANKS.forEach((r, ri) => {
      const isDark = (fi + r) % 2 === 1;
      if(!isDark) return;
      const sq = algebra(f, r);
      if (r >= 6) {
        // player A (usually bottom) on ranks 6-8
        if (r >= 6) board[sq] = { color: 'A', king: false };
      } else if (r <= 3) {
        // player B on ranks 1-3
        if (r <= 3) board[sq] = { color: 'B', king: false };
      }
    });
  });
  return board;
}

function cloneBoard(b){
  return JSON.parse(JSON.stringify(b || {}));
}

function getPiece(board, sq){ return board[sq] || null; }
function setPiece(board, sq, piece){
  if(piece) board[sq] = piece; else delete board[sq];
}

// Convert file char to index 0..7
function fileIndex(file){ return FILES.indexOf(file); }

function parseSquare(sq){
  const file = sq[0];
  const rank = Number(sq[1]);
  return { file, rank, fidx: fileIndex(file) };
}

function neighborsDiagonal(fileIdx, rank, dir){
  // dir array of row deltas, col deltas
  // returns list of {fileIdx, rank}
  return dir.map(d => ({ f: fileIdx + d.dx, r: rank + d.dy })).filter(x => x.f>=0 && x.f<8 && x.r>=1 && x.r<=8);
}

/**
 * Move generation rules:
 * - Men move forward diagonally (A: up (rank-1) or down? We'll define A starts at bottom on ranks 6-8 and moves "up" to lower ranks)
 *   To keep consistent: A moves towards rank 1 (decreasing rank), B moves towards rank 8 (increasing rank).
 * - Captures jump over opponent piece into empty square; captures are mandatory.
 * - Multi-jumps supported.
 *
 * We'll produce functions:
 *  - findAllMoves(board, color) -> { normal: [ {from,to}... ], captures: [ { from, sequence:[to,to,...], jumped:[sq,...] } ... ] }
 *  - legal moves from a selected piece, taking into account mandatory capture requirement.
 */

function isDarkSquare(fileIdx, rank){
  return (fileIdx + rank) % 2 === 1;
}

function inBounds(f, r){ return f>=0 && f<8 && r>=1 && r<=8; }

// Directions for diagonal moves for men and kings
const DIRS = {
  A: [ // player A moves "up" toward rank 1 => dy = -1
    { dx: -1, dy: -1 }, { dx: 1, dy: -1 }
  ],
  B: [ // player B moves "down" toward rank 8 => dy = +1
    { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
  ],
  KING: [ // kings can move both directions
    { dx:-1, dy:-1 }, { dx:1, dy:-1 }, { dx:-1, dy:1 }, { dx:1, dy:1 }
  ]
};

// helper: square from fileIdx + rank
function squareFrom(fi, rank){ return `${FILES[fi]}${rank}`; }

// collect capture sequences recursively
function findJumpsFrom(board, fromSq, piece){
  const { fidx, rank } = parseSquare(fromSq);
  const color = piece.color;
  const dirs = piece.king ? DIRS.KING : DIRS[color];
  const oppColor = color === 'A' ? 'B' : 'A';
  const results = [];

  function dfs(currFi, currRank, boardState, seq, jumped){
    let found = false;
    for(const d of dirs){
      const midFi = currFi + d.dx;
      const midRank = currRank + d.dy;
      const destFi = currFi + 2*d.dx;
      const destRank = currRank + 2*d.dy;
      if(!inBounds(midFi, midRank) || !inBounds(destFi, destRank)) continue;
      const midSq = squareFrom(midFi, midRank);
      const destSq = squareFrom(destFi, destRank);
      const midPiece = getPiece(boardState, midSq);
      const destPiece = getPiece(boardState, destSq);
      if(midPiece && midPiece.color === oppColor && !destPiece){
        // can jump
        // clone board state locally to mark removal and move piece
        const nb = cloneBoard(boardState);
        setPiece(nb, midSq, null);
        setPiece(nb, squareFrom(currFi, currRank), null);
        setPiece(nb, destSq, { color: piece.color, king: piece.king }); // kinging handled later
        // continue jumping from dest
        const newSeq = seq.concat(destSq);
        const newJumped = jumped.concat(midSq);
        const deeper = dfs(destFi, destRank, nb, newSeq, newJumped);
        if(!deeper.length) {
          // no further jumps found, record this sequence
          results.push({ from: fromSq, sequence: newSeq.slice(), jumped: newJumped.slice() });
        } else {
          // deeper pushes results via recursion; flagged found
          found = true;
        }
      }
    }
    return found ? results : []; // if found deeper, results has the deep ones
  }

  dfs(fidx, rank, board, [], []);
  return results;
}

function findAllMoves(board, color){
  const moves = [];
  const captures = [];
  // iterate pieces
  for(const f of FILES){
    for(const r of RANKS.slice().reverse()){ // RANKS is descending; order not important
      const sq = algebra(f, r);
      const p = getPiece(board, sq);
      if(!p || p.color !== color) continue;
      // capture sequences
      const jumps = findJumpsFrom(board, sq, p);
      if(jumps.length) {
        for(const j of jumps) captures.push(j);
      } else {
        // non-capture moves
        const dirs = p.king ? DIRS.KING : DIRS[color];
        const { fidx, rank } = parseSquare(sq);
        for(const d of dirs){
          const nf = fidx + d.dx;
          const nr = rank + d.dy;
          if(!inBounds(nf, nr)) continue;
          const toSq = squareFrom(nf, nr);
          if(!getPiece(board, toSq)) moves.push({ from: sq, to: toSq });
        }
      }
    }
  }
  return { normal: moves, captures };
}

// apply a sequence of moves (multi-jump) to board, return new board
function applyMoveSequence(board, sequenceObj){
  // sequenceObj: either {from,to} for normal or {from, sequence:[to,...], jumped:[sq,...]}
  const nb = cloneBoard(board);
  if(sequenceObj.sequence && sequenceObj.sequence.length){
    const from = sequenceObj.from;
    const seq = sequenceObj.sequence;
    // move piece along sequence, removing jumped
    let piece = getPiece(nb, from);
    setPiece(nb, from, null);
    for(const jmp of sequenceObj.jumped || []){
      setPiece(nb, jmp, null);
    }
    const finalSq = seq[seq.length - 1];
    // kinging: if man reaches opponent back rank
    if(!piece.king){
      const r = Number(finalSq[1]);
      if(piece.color === 'A' && r === 1) piece.king = true;
      if(piece.color === 'B' && r === 8) piece.king = true;
    }
    setPiece(nb, finalSq, piece);
  } else {
    const from = sequenceObj.from;
    const to = sequenceObj.to;
    const piece = getPiece(nb, from);
    setPiece(nb, from, null);
    // if a jump (distance 2), remove middle piece
    const pf = fileIndex(from[0]); const pr = Number(from[1]);
    const tf = fileIndex(to[0]); const tr = Number(to[1]);
    if(Math.abs(pf - tf) === 2 && Math.abs(pr - tr) === 2){
      const midf = (pf + tf) / 2;
      const midr = (pr + tr) / 2;
      setPiece(nb, squareFrom(midf, midr), null);
    }
    // kinging
    if(!piece.king){
      if(piece.color === 'A' && Number(to[1]) === 1) piece.king = true;
      if(piece.color === 'B' && Number(to[1]) === 8) piece.king = true;
    }
    setPiece(nb, to, piece);
  }
  return nb;
}

// UI helpers: piece dots / king crown
function PieceView({ piece }){
  if(!piece) return null;
  return (
    <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center",
                       piece.color==='A' ? "bg-amber-400 text-black" : "bg-gray-800 text-white",
                       "shadow-md")}>
      {piece.king ? <span className="text-sm font-bold">♔</span> : <span className="text-sm font-semibold">●</span>}
    </div>
  );
}

export default function Checkers({ socket, matchId, state }){
  // board as object mapping sq->piece
  const [board, setBoard] = useState(initialBoard());
  const [turn, setTurn] = useState('A'); // A starts by convention
  const [selected, setSelected] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]); // array of target squares (for normal moves) or sequences for captures
  const [captureMode, setCaptureMode] = useState(false); // true if captures required globally
  const [lastMove, setLastMove] = useState(null);
  const [status, setStatus] = useState('ongoing');
  const [players, setPlayers] = useState({ A: null, B: null });
  const [busy, setBusy] = useState(false);

  useEffect(()=>{
    if(state && state.board){
      setBoard(state.board);
      setTurn(state.turn || 'A');
      setLastMove(state.lastMove || null);
      setStatus(state.status || 'ongoing');
      if(state.players) setPlayers(state.players);
      // reset selection
      setSelected(null);
      setLegalTargets([]);
      setCaptureMode(false);
    }
  }, [state]);

  // Recompute capture/move availability when board or turn changes
  useEffect(()=>{
    const all = findAllMoves(board, turn);
    const hasCaptures = all.captures && all.captures.length > 0;
    setCaptureMode(hasCaptures);
    // Clear selection & legal targets if previously invalid
    if(selected){
      // ensure previously selected still belongs to current player and has legal moves
      const piece = getPiece(board, selected);
      if(!piece || piece.color !== turn){
        setSelected(null);
        setLegalTargets([]);
      } else {
        // compute legal for this piece
        if(hasCaptures){
          const pieceJumps = findJumpsFrom(board, selected, piece);
          setLegalTargets(pieceJumps);
        } else {
          const normals = findAllMoves(board, turn).normal.filter(m => m.from === selected);
          setLegalTargets(normals);
        }
      }
    } else {
      setLegalTargets([]);
    }
  }, [board, turn]);

  // socket listener for server authoritative updates
  useEffect(()=>{
    if(!socket) return;
    function onUpdate(s){
      if(s.board) setBoard(s.board);
      if(s.turn) setTurn(s.turn);
      if(s.lastMove) setLastMove(s.lastMove);
      if(s.status) setStatus(s.status);
      if(s.players) setPlayers(s.players);
      // clear selection
      setSelected(null); setLegalTargets([]); setCaptureMode(false);
    }
    socket.on('checkers:update', onUpdate);
    return ()=> socket.off('checkers:update', onUpdate);
  }, [socket]);

  function onSquareClick(file, rank){
    if(status !== 'ongoing') return;
    const sq = algebra(file, rank);
    const piece = getPiece(board, sq);
    // If there's an ongoing capture multi-jump (selected and legalTargets have sequences), allow only those
    if(selected && legalTargets && legalTargets.length){
      // If captureMode, legalTargets are objects { from, sequence, jumped }
      const captureSeqTarget = legalTargets.find(t => t.sequence && t.sequence.includes(sq));
      // if clicked on a sequence destination (last or intermediate), handle accordingly: only accept last in sequence
      if(captureMode && captureSeqTarget){
        const final = captureSeqTarget.sequence[captureSeqTarget.sequence.length - 1];
        if(final === sq){
          performCaptureMove(captureSeqTarget);
          return;
        }
      }
      // if normal move mode and legalTargets are {from,to}
      const normal = legalTargets.find(t => t.to === sq);
      if(!captureMode && normal){
        performNormalMove(normal);
        return;
      }
    }

    // Otherwise, if clicking own piece, select it and show legal moves
    if(piece && piece.color === turn){
      setSelected(sq);
      if(captureMode){
        const jumps = findJumpsFrom(board, sq, piece);
        setLegalTargets(jumps);
      } else {
        const normals = findAllMoves(board, turn).normal.filter(m => m.from === sq);
        setLegalTargets(normals);
      }
      return;
    }

    // clicking elsewhere clears selection
    setSelected(null);
    setLegalTargets([]);
  }

  async function performNormalMove(moveObj){
    // moveObj: { from, to }
    setBusy(true);
    try{
      const nextBoard = applyMoveSequence(board, moveObj);
      // optimistic update
      setBoard(nextBoard);
      setTurn(turn === 'A' ? 'B' : 'A');
      setLastMove(moveObj);
      setSelected(null); setLegalTargets([]);
      // emit to server
      socket?.emit('checkers:move', { matchId, moves: [moveObj] }, (ack) => {
        setBusy(false);
        if(ack && ack.error){
          // revert if server rejects and sends board
          if(ack.board) setBoard(ack.board);
          else setBoard(board); // naive revert
          setTurn(turn);
          setLastMove(null);
          setSelected(null);
          setLegalTargets([]);
        }
      });
    }catch(e){
      setBusy(false);
      console.error(e);
    }
  }

  async function performCaptureMove(captureObj){
    // captureObj: { from, sequence:[to1,to2], jumped:[sq1,sq2] }
    setBusy(true);
    try{
      const nextBoard = applyMoveSequence(board, captureObj);
      setBoard(nextBoard);
      // after a full multi-jump, turn passes
      setTurn(turn === 'A' ? 'B' : 'A');
      setLastMove(captureObj);
      setSelected(null); setLegalTargets([]);
      socket?.emit('checkers:move', { matchId, moves: [captureObj] }, (ack) => {
        setBusy(false);
        if(ack && ack.error){
          if(ack.board) setBoard(ack.board);
          else setBoard(board);
          setTurn(turn);
          setLastMove(null);
        }
      });
    }catch(e){
      setBusy(false);
      console.error(e);
    }
  }

  // resign / offer draw
  function resign(){
    socket?.emit('checkers:resign', { matchId });
  }
  function offerDraw(){
    socket?.emit('checkers:offerDraw', { matchId });
  }

  // Render helpers
  function squareBg(fi, rank){
    return (fi + rank) % 2 === 1 ? "bg-gray-800" : "bg-gray-200";
  }

  function isLegalDest(sq){
    if(!legalTargets) return false;
    if(captureMode){
      return legalTargets.some(t => t.sequence && t.sequence[ t.sequence.length - 1 ] === sq);
    } else {
      return legalTargets.some(t => t.to === sq);
    }
  }

  function renderBoard(){
    return (
      <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-3">
        <div className="grid grid-cols-9 gap-0 select-none">
          <div className="w-6 h-6" />
          {FILES.map(f => <div key={f} className="w-12 h-6 flex items-center justify-center text-xs opacity-70">{f}</div>)}
          {RANKS.map((rank, rIdx) => (
            <React.Fragment key={rank}>
              <div className="w-6 h-12 flex items-center justify-center text-xs opacity-70">{rank}</div>
              {FILES.map((file, fi) => {
                const sq = algebra(file, rank);
                const p = getPiece(board, sq);
                const dark = (fi + rank) % 2 === 1;
                const selectedClass = selected === sq ? "ring-2 ring-amber-400" : "";
                const legalDest = isLegalDest(sq);
                const last = lastMove && (lastMove.from === sq || (lastMove.to && lastMove.to === sq || (lastMove.sequence && lastMove.sequence.includes(sq))));
                return (
                  <div
                    key={sq}
                    onClick={() => onSquareClick(file, rank)}
                    className={clsx("w-12 h-12 flex items-center justify-center cursor-pointer relative",
                                   dark ? "bg-gray-700" : "bg-gray-100",
                                   selectedClass,
                                   last ? "ring-1 ring-sky-500" : "")}
                  >
                    {/* legal move indicator */}
                    {legalDest && !p && <div className="absolute bottom-2 w-2 h-2 rounded-full bg-emerald-400" />}
                    {p && <PieceView piece={p} />}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
          <div className="w-6 h-6" />
          {FILES.map(f => <div key={f} className="w-12 h-6 flex items-center justify-center text-xs opacity-70">{f}</div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">⛀ Checkers</div>
          <div className="text-xs opacity-70">Match: <span className="font-mono">{matchId}</span></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm">Turn: <span className="font-medium">{turn === 'A' ? 'White (A)' : 'Black (B)'}</span></div>
          <div className="text-sm opacity-80">Status: <span className="font-medium">{status}</span></div>
          <div className="flex gap-2">
            <button onClick={offerDraw} className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-sm">Offer Draw</button>
            <button onClick={resign} className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-sm">Resign</button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          {renderBoard()}
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-3">
            <div className="font-semibold mb-2">Players</div>
            <div className="text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs opacity-70">White (A)</div>
                  <div className="font-medium">{players.A?.username || "Waiting..."}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs opacity-70">Side</div>
                  <div className="font-medium">A</div>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-800 my-3" />
            <div className="text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs opacity-70">Black (B)</div>
                  <div className="font-medium">{players.B?.username || "Waiting..."}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs opacity-70">Side</div>
                  <div className="font-medium">B</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-3">
            <div className="font-semibold mb-2">Last Move</div>
            <div className="text-sm">
              {lastMove ? (
                lastMove.sequence ? (
                  <div>From {lastMove.from} → {lastMove.sequence.join(' → ')}</div>
                ) : (
                  <div>{lastMove.from} → {lastMove.to}</div>
                )
              ) : <div className="opacity-70 text-xs">No moves yet</div>}
            </div>
            <div className="mt-3">
              <button onClick={() => socket?.emit('checkers:requestState', { matchId })} className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-700">Refresh</button>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-3">
            <div className="font-semibold mb-2">Tips</div>
            <ul className="text-sm list-disc ml-5 opacity-80">
              <li>Captures are mandatory — you will see jump sequences.</li>
              <li>Kings move both directions and continue jumping.</li>
              <li>Multi-jumps will be performed in a single action.</li>
            </ul>
          </div>
        </div>
      </div>

      {busy && <div className="text-xs opacity-70">Processing move…</div>}
    </div>
  );
}