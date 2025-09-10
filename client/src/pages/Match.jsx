// client/src/pages/Match.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Import your existing game UIs
import Chess from '../games/Chess.jsx';
import Checkers from '../games/Checkers.jsx';
import Ludo from '../games/Ludo.jsx';
import Whot from '../games/Whot.jsx';
import Archery from '../games/Archery.jsx';
import PoolLite from '../games/PoolLite.jsx';

// Map match.game -> component
const GAME_COMPONENTS = {
  chess: Chess,
  checkers: Checkers,
  ludo: Ludo,
  whot: Whot,
  archery: Archery,
  pool8lite: PoolLite,
};

export default function Match({ socket, token }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);     // { id, game, demo, stake, status, ... }
  const [gstate, setGstate] = useState(null);   // latest game state payload if you emit it
  const [msg, setMsg] = useState('Connecting…');

  useEffect(() => {
    if (!socket || !id) return;

    // Ask the server for current match room state
    socket.emit('match:joinRoom', { id });

    const onState = (s) => {
      setMatch(s);
      setMsg('');
    };

    // If you also emit server-side updates like 'match:update' with a state object
    const onUpdate = (payload) => {
      setGstate(payload?.state ?? payload);
    };

    const onDisconnect = () => setMsg('Disconnected. Reconnecting…');
    const onErr = (e) => setMsg(e?.message || 'Socket error');

    socket.on('match:state', onState);
    socket.on('match:update', onUpdate);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onErr);

    return () => {
      socket.off('match:state', onState);
      socket.off('match:update', onUpdate);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onErr);
    };
  }, [socket, id]);

  if (!socket) {
    return (
      <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
        <div className="text-sm">No socket connection. Go back to Arena.</div>
        <button onClick={()=>navigate('/arena')} className="mt-3 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600">
          Back to Arena
        </button>
      </div>
    );
  }

  // Pick the correct game component
  const Game = match ? (GAME_COMPONENTS[match.game] || (() => (
    <div className="p-4 text-sm">Unknown game: {match.game}</div>
  ))) : null;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            {match ? (
              <>
                <div className="font-semibold capitalize">{match.game} {match.demo ? '(Demo)' : '(Real)'}</div>
                <div className="opacity-80">Match ID: <span className="break-all">{match.id}</span></div>
                <div className="opacity-80">Stake: ₦{match.stake} • Status: {match.status}</div>
              </>
            ) : (
              <div className="opacity-80">{msg}</div>
            )}
          </div>
          <button onClick={()=>navigate('/arena')} className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600">
            Back to Arena
          </button>
        </div>
      </div>

      {/* Render the game UI when we know which game it is */}
      {!!Game && (
        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-2 md:p-4">
          <Game
            socket={socket}
            token={token}
            match={match}
            state={gstate}
            // pass more props your game components expect, e.g. meIsPlayer, onMove, etc.
          />
        </div>
      )}
    </div>
  );
}