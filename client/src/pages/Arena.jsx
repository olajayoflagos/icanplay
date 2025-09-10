import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

const GAME_LIST = [
  { key:'chess', label:'Chess' },
  { key:'checkers', label:'Checkers' },
  { key:'ludo', label:'Ludo' },
  { key:'whot', label:'Whot' },
  { key:'archery', label:'Archery' },
  { key:'pool8lite', label:'8-Ball Lite' },
];

function GameDummy({ game }){
  const desc = {
    chess:'Classic 8x8 chess. Capture the king via checkmate.',
    checkers:'Diagonal jumps, forced captures, multi-jumps allowed.',
    ludo:'Roll to bring tokens home; captures and safe squares.',
    whot:'Card shedding with special calls (20, 14 etc.).',
    archery:'Best-of series; aim for higher ring score.',
    pool8lite:'Pocket balls, race-to-8 simplified.',
  }[game] || 'Game preview';
  return (
    <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
      <div className="font-semibold mb-1">{GAME_LIST.find(g=>g.key===game)?.label || 'Game'}</div>
      <div className="text-sm opacity-80">{desc}</div>
      <div className="mt-3 rounded-xl bg-black/30 border border-gray-800 p-3 text-xs opacity-70">
        Dummy preview (controls or tutorial can go here).
      </div>
    </div>
  );
}

export default function Arena({ token, socket, match, setMatch, gstate, meIsPlayer }){
  const location = useLocation();
  const navigate = useNavigate();
  const focusId = location.state?.focusMatchId || null;

  const [game, setGame] = useState(GAME_LIST[0].key);
  const [realList, setRealList] = useState([]); // OPEN + LIVE (real)
  const [demoList, setDemoList] = useState([]); // OPEN + LIVE (demo)
  const [statusMsg, setStatusMsg] = useState('');
  const [lastJoinedId, setLastJoinedId] = useState(null);

  const api = useMemo(()=>axios.create({
    baseURL: API,
    headers: token ? { Authorization:'Bearer '+token } : {}
  }), [token]);

  async function refreshMatches(){
    const get = (status)=> api.get(`/api/matches?status=${status}`).then(r=>r.data||[]).catch(()=>[]);
    const [openRows, liveRows] = await Promise.all([get('OPEN'), get('LIVE')]);
    const merged = [...openRows, ...liveRows].reduce((acc, m)=>{ acc[m.id] = m; return acc; }, {});
    const all = Object.values(merged);
    setRealList(all.filter(m=>!m.demo));
    setDemoList(all.filter(m=>m.demo));
  }

  useEffect(()=>{
    refreshMatches();
    const t = setInterval(refreshMatches, 7000);
    return ()=>clearInterval(t);
  },[]);

  // socket listeners: when room joins, server emits match:state
  useEffect(()=>{
    if(!socket) return;

    const onState = (s)=>{
      setMatch?.(s);
      setStatusMsg('');
      setLastJoinedId(s.id);
      // Go to dedicated match page where the real game UI renders
      navigate(`/match/${s.id}`);
    };

    const onPresence = (_)=>{};
    const onConnectError = (err)=> setStatusMsg('Connection error: '+(err?.message||''));

    socket.on('match:state', onState);
    socket.on('presence:join', onPresence);
    socket.on('connect_error', onConnectError);

    return ()=>{
      socket.off('match:state', onState);
      socket.off('presence:join', onPresence);
      socket.off('connect_error', onConnectError);
    };
  }, [socket, setMatch, navigate]);

  // auto-join if we were sent here from Create/Join
  useEffect(()=>{
    if (focusId && socket){
      socket.emit('match:joinRoom', { id: focusId });
      setStatusMsg('Joined match. Loading…');
      setLastJoinedId(focusId);
    }
  }, [focusId, socket]);

  function joinRoom(id){
    if (!socket) return;
    socket.emit('match:joinRoom', { id });
    setStatusMsg('Joined match. Loading…');
    setLastJoinedId(id);
  }
  function spectate(id){
    if (!socket) return;
    socket.emit('match:spectateJoin', { id });
    setStatusMsg('Spectating…');
    setLastJoinedId(id);
  }
  function pause(id){
    if (!socket) return;
    socket.emit('match:pause', { matchId:id }, (resp)=> setStatusMsg(resp?.error || 'Paused'));
  }
  function resume(id){
    if (!socket) return;
    socket.emit('match:resume', { matchId:id }, (resp)=> setStatusMsg(resp?.error || 'Resumed'));
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
          <label className="block text-sm mb-1 opacity-80">Select game</label>
          <select value={game} onChange={e=>setGame(e.target.value)} className="px-3 py-2 rounded-xl text-black w-full">
            {GAME_LIST.map(g=> <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
          {!!statusMsg && <div className="text-xs opacity-80 mt-2">{statusMsg}</div>}
        </div>

        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
          <div className="font-semibold mb-2">Match Controls</div>
          {match ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={()=>pause(match.id)} className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700">Pause</button>
              <button onClick={()=>resume(match.id)} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700">Resume</button>
            </div>
          ) : (
            <div className="text-sm opacity-70">Join or create a match to enable controls.</div>
          )}
          <div className="text-xs opacity-60 mt-2">Each player has up to 5 pauses per match.</div>
        </div>

        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
          <div className="font-semibold mb-2">Quick Tips</div>
          <ul className="list-disc ml-5 text-sm opacity-80 space-y-1">
            <li>Open & live matches are combined below.</li>
            <li>Lists are split by Real vs Demo.</li>
            <li>Join to start receiving live state.</li>
          </ul>
        </div>
      </div>

      <GameDummy game={game} />

      <div className="grid md:grid-cols-2 gap-4">
        {/* REAL (OPEN + LIVE) */}
        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg">
          <h3 className="font-semibold mb-3">Real (Open & Live)</h3>
          <div className="space-y-2 max-h-[24rem] overflow-auto">
            {realList.map(m=>(
              <div key={m.id} className="p-3 rounded-xl bg-gray-800/60 flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-semibold capitalize">{m.game}</div>
                  <div className="opacity-80">Stake ₦{m.stake} • {m.status}</div>
                  <div className="opacity-70 text-xs break-all">ID: {m.id}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>joinRoom(m.id)} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700">Join</button>
                  <button onClick={()=>spectate(m.id)} className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600">Watch</button>
                </div>
              </div>
            ))}
            {!realList.length && <div className="text-sm opacity-70">No real matches yet.</div>}
          </div>
        </div>

        {/* DEMO (OPEN + LIVE) */}
        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg">
          <h3 className="font-semibold mb-3">Demo (Open & Live)</h3>
          <div className="space-y-2 max-h-[24rem] overflow-auto">
            {demoList.map(m=>(
              <div key={m.id} className="p-3 rounded-xl bg-gray-800/60 flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-semibold capitalize">{m.game}</div>
                  <div className="opacity-80">Stake ₦{m.stake} • {m.status}</div>
                  <div className="opacity-70 text-xs break-all">ID: {m.id}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>joinRoom(m.id)} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700">Join</button>
                  <button onClick={()=>spectate(m.id)} className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600">Watch</button>
                </div>
              </div>
            ))}
            {!demoList.length && <div className="text-sm opacity-70">No demo matches yet.</div>}
          </div>
        </div>
      </div>

      {lastJoinedId && (
        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
          <div className="text-sm">
            Connected to match: <span className="font-semibold break-all">{lastJoinedId}</span>
          </div>
          {!match && <div className="text-xs opacity-70 mt-1">Waiting for match state…</div>}
        </div>
      )}
    </div>
  );
}