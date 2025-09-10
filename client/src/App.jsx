// client/src/App.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSocket } from './useSocket';

import NavBar from './components/NavBar.jsx';
import WhatsAppFAB from './components/WhatsAppFAB.jsx';

import Landing from './pages/Landing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Settings from './pages/Settings.jsx';
import AdminGate from './pages/AdminGate.jsx';
import Arena from './pages/Arena.jsx';
import Match from './pages/Match.jsx'; // <-- NEW dedicated match page

// (These are still useful if you keep in-app listeners for game updates)
import ChatPanel from './components/ChatPanel.jsx';
import VoicePanel from './components/VoicePanel.jsx';

import Chess from './games/Chess.jsx';
import Checkers from './games/Checkers.jsx';
import Ludo from './games/Ludo.jsx';
import Whot from './games/Whot.jsx';
import Archery from './games/Archery.jsx';
import PoolLite from './games/PoolLite.jsx';

export default function App(){
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser]   = useState(null);
  const [balance, setBalance] = useState(0);

  const [match, setMatch] = useState(null);
  const [gstate, setGstate] = useState(null);

  // Socket
  const sockRef = useSocket(token, (s)=>{
    // generic match state (server sends this on room join)
    s.on('match:state', (m)=>{ setMatch(m); });

    // per-game updates (keeping these if your games emit by channel)
    s.on('chess:update', setGstate);
    s.on('checkers:update', setGstate);
    s.on('whot:update', setGstate);
    s.on('ludo:update', setGstate);
    s.on('archery:update', setGstate);
    s.on('pool:update', setGstate);

    s.on('match:settled', (p)=>{
      alert('Match settled. Winner: '+p.winner+' | Payout ₦'+p.payout);
    });
  });

  // Re-join the room whenever match.id changes (defensive)
  useEffect(()=>{
    if (match?.id && sockRef.current){
      sockRef.current.emit('match:joinRoom', { id: match.id });
    }
  }, [match?.id, sockRef.current]);

  // Kept for backwards-compat (not used by the new /match/:id route)
  function GameView(){
    if (!match) return <div className="text-sm opacity-70">No match selected yet.</div>;
    const props = { socket: sockRef.current, matchId: match.id, state: gstate };
    if (match.game==='chess') return <Chess {...props} />;
    if (match.game==='checkers') return <Checkers {...props} />;
    if (match.game==='whot') return <Whot {...props} />;
    if (match.game==='ludo') return <Ludo {...props} />;
    if (match.game==='archery') return <Archery {...props} />;
    if (match.game==='pool8lite') return <PoolLite {...props} />;
    return <div>Unknown game</div>;
  }

  const meIsPlayer = !!(user && match && (user.id===match?.creator_user_id || user.id===match?.taker_user_id));

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-b from-[#0b0f1a] to-black text-gray-100">
        <NavBar
          token={token}
          setToken={setToken}
          user={user}
          setUser={setUser}
          balance={balance}
          setBalance={setBalance}
        />

        <div className="max-w-6xl mx-auto px-3 md:px-4 py-4">
          <Routes>
            <Route path="/" element={<Landing />} />

            <Route
              path="/dashboard"
              element={
                <Dashboard
                  token={token}
                  onBalance={setBalance}
                  socket={sockRef.current}
                  onCreated={(m)=>{
                    // Keep legacy join + let Arena/Match handle navigation
                    setMatch(m);
                    setTimeout(()=>sockRef.current?.emit('match:joinRoom', { id: m.id }), 100);
                  }}
                  onJoined={(m)=>{
                    setMatch(m);
                    setTimeout(()=>sockRef.current?.emit('match:joinRoom', { id: m.id }), 100);
                  }}
                  onWatch={(id)=> sockRef.current?.emit('match:spectateJoin', { id })}
                  setMatch={setMatch}
                />
              }
            />

            <Route
              path="/arena"
              element={
                <Arena
                  token={token}
                  socket={sockRef.current}
                  match={match}
                  setMatch={setMatch}
                  gstate={gstate}
                  meIsPlayer={meIsPlayer}
                />
              }
            />

            {/* NEW: Dedicated match route used by Arena when the server emits match:state */}
            <Route
              path="/match/:id"
              element={<Match socket={sockRef.current} token={token} />}
            />

            <Route path="/settings" element={<Settings token={token} onBalance={setBalance} />} />
            <Route path="/admin" element={<AdminGate token={token} />} />

            {/* Optional legacy /match without id (kept to avoid 404 if linked somewhere) */}
            <Route
              path="/match"
              element={
                <div className='rounded-2xl bg-gray-900/40 border border-gray-800 p-4 space-y-3 shadow-lg'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <div className='font-semibold'>Match</div>
                      {match ? (
                        <div className='text-sm opacity-80'>
                          ID: {match.id} • {match.game} • Stake ₦{match.stake} • Status {match.status}
                        </div>
                      ) : (
                        <div className='text-sm opacity-60'>No match joined yet.</div>
                      )}
                    </div>
                    {match && (
                      <button
                        onClick={()=>{ setMatch(null); setGstate(null); }}
                        className='px-3 py-1 rounded bg-red-600 hover:bg-red-700'
                      >
                        Leave
                      </button>
                    )}
                  </div>

                  <div className='grid md:grid-cols-3 gap-3'>
                    <div className='md:col-span-2'><GameView /></div>
                    <div className='space-y-3'>
                      {match && (
                        <>
                          <ChatPanel socket={sockRef.current} match={match} />
                          <VoicePanel socket={sockRef.current} match={match} meIsPlayer={meIsPlayer} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <WhatsAppFAB />
      </div>
    </BrowserRouter>
  );
}