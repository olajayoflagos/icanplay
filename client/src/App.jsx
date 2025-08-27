import React,{useEffect,useState} from 'react';
import AuthBar from './components/AuthBar.jsx';
import Wallet from './components/Wallet.jsx';
import CreateMatch from './components/CreateMatch.jsx';
import JoinMatch from './components/JoinMatch.jsx';
import Admin from './components/Admin.jsx';
import OpenMatches from './components/OpenMatches.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import VoicePanel from './components/VoicePanel.jsx';
import { useSocket } from './useSocket';

import Chess from './games/Chess.jsx';
import Checkers from './games/Checkers.jsx';
import Ludo from './games/Ludo.jsx';
import Whot from './games/Whot.jsx';
import Archery from './games/Archery.jsx';
import PoolLite from './games/PoolLite.jsx';

export default function App(){
  const [token,setToken] = useState(localStorage.getItem('token')||'');
  const [user,setUser] = useState(null);
  const [balance,setBalance] = useState(0);
  const [view,setView] = useState('home'); // home | match | admin
  const [match,setMatch] = useState(null);
  const [gstate,setGstate] = useState(null);

  const sockRef = useSocket(token, (s)=>{
    s.on('match:state', (m)=>{ setMatch(m); setView('match'); });
    s.on('chess:update', setGstate);
    s.on('checkers:update', setGstate);
    s.on('whot:update', setGstate);
    s.on('ludo:update', setGstate);
    s.on('archery:update', setGstate);
    s.on('pool:update', setGstate);
    s.on('match:settled', (p)=>{ alert('Match settled. Winner: '+p.winner+' | Payout ₦'+p.payout); });
  });

  // When we have a match, ensure we’re in the room
  useEffect(()=>{ if(match?.id && sockRef.current){ sockRef.current.emit('match:joinRoom', { id: match.id }); } },[match?.id, sockRef.current]);

  function onCreated(m){
    setMatch(m);
    setTimeout(()=> sockRef.current?.emit('match:joinRoom', { id: m.id }), 100);
  }
  function onJoined(m){
    setMatch(m);
    setTimeout(()=> sockRef.current?.emit('match:joinRoom', { id: m.id }), 100);
  }

  // Lobby handlers
  function joinById(id){
    // uses REST POST /api/matches/:id/join — we already have a Join form; keep quick action via that component or leave as is
    alert('Use "Join Match" with this ID: '+id);
  }
  function watchById(id){
    sockRef.current?.emit('match:spectateJoin', { id });
    setView('match');
  }

  function GameView(){
    if (!match) return null;
    const props = { socket: sockRef.current, matchId: match.id, state: gstate };
    if (match.game==='chess') return <Chess {...props} />;
    if (match.game==='checkers') return <Checkers {...props} />;
    if (match.game==='whot') return <Whot {...props} />;
    if (match.game==='ludo') return <Ludo {...props} />;
    if (match.game==='archery') return <Archery {...props} />;
    if (match.game==='pool8lite') return <PoolLite {...props} />;
    return <div>Unknown game</div>;
  }

  const meIsPlayer = !!(user && match && (user.id===match.creator_user_id || user.id===match.taker_user_id));

  return <div className='max-w-5xl mx-auto p-4 space-y-4'>
    <AuthBar token={token} setToken={setToken} user={user} setUser={setUser} balance={balance} setBalance={setBalance} />

    <div className='flex gap-2'>
      <button onClick={()=>setView('home')} className={'px-3 py-1 rounded '+(view==='home'?'bg-gray-700':'bg-gray-800 hover:bg-gray-700')}>Home</button>
      <button onClick={()=>setView('admin')} className={'px-3 py-1 rounded '+(view==='admin'?'bg-gray-700':'bg-gray-800 hover:bg-gray-700')}>Admin</button>
      {match && <button onClick={()=>setView('match')} className={'px-3 py-1 rounded '+(view==='match'?'bg-gray-700':'bg-gray-800 hover:bg-gray-700')}>Match</button>}
    </div>

    {view==='home' && <div className='grid md:grid-cols-2 gap-4'>
      <div className='space-y-4'>
        <Wallet token={token} onBalance={setBalance} />
        <CreateMatch token={token} onCreated={onCreated} />
        <JoinMatch token={token} onJoined={onJoined} />
        <OpenMatches token={token} socket={sockRef.current} onJoin={joinById} onWatch={watchById} />
      </div>
      <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3'>
        <h3 className='font-semibold mb-2'>How it works</h3>
        <ol className='list-decimal ml-5 space-y-1 text-sm opacity-80'>
          <li>Register a username (no KYC for now).</li>
          <li>Deposit demo funds or connect Paystack on server for real money.</li>
          <li>Create a match, share the Match ID; opponent joins.</li>
          <li>Spectators can watch LIVE and chat (players + spectators see chat).</li>
          <li>Players can enable voice to talk (spectators listen via chat only).</li>
        </ol>
      </div>
    </div>}

    {view==='match' && match && <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3 space-y-3'>
      <div className='flex items-center justify-between'>
        <div>
          <div className='font-semibold'>Match</div>
          <div className='text-sm opacity-80'>
            ID: {match.id} • {match.game} • Stake ₦{match.stake} • Status {match.status}
          </div>
        </div>
        <button onClick={()=>{ setMatch(null); setGstate(null); setView('home'); }} className='px-3 py-1 rounded bg-red-600 hover:bg-red-700'>Leave</button>
      </div>

      <div className='grid md:grid-cols-3 gap-3'>
        <div className='md:col-span-2'><GameView /></div>
        <div className='space-y-3'>
          <ChatPanel socket={sockRef.current} match={match} />
          <VoicePanel socket={sockRef.current} match={match} meIsPlayer={meIsPlayer} />
        </div>
      </div>
    </div>}

    {view==='admin' && <Admin token={token} />}
  </div>
}
