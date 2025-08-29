import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import ChatPanel from '../components/ChatPanel.jsx';
import VoicePanel from '../components/VoicePanel.jsx';

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
  const startedFlag = location.state?.started;

  const [game, setGame] = useState(GAME_LIST[0].key);
  const [openReal, setOpenReal] = useState([]);
  const [openDemo, setOpenDemo] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');

  const api = useMemo(()=>axios.create({
    baseURL: API,
    headers: token? { Authorization:'Bearer '+token } : {}
  }), [token]);

  async function refreshOpen(){
    const r = await api.get('/api/matches?status=OPEN');
    const rows = r.data || [];
    setOpenReal(rows.filter(m=>!m.demo));
    setOpenDemo(rows.filter(m=>m.demo));
  }

  useEffect(()=>{
    refreshOpen();
    const t = setInterval(refreshOpen, 7000);
    return ()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    if (startedFlag) setStatusMsg('Game started!');
  }, [startedFlag]);

  function joinRoom(id){
    socket?.emit('match:joinRoom', { id });
    setStatusMsg('Joined match. Loading…');
  }
  function spectate(id){
    socket?.emit('match:spectateJoin', { id });
    setStatusMsg('Spectating…');
  }

  function pause(matchId){
    socket?.emit('match:pause', { matchId }, (resp)=>{
      setStatusMsg(resp?.error ? resp.error : 'Paused');
    });
  }
  function resume(matchId){
    socket?.emit('match:resume', { matchId }, (resp)=>{
      setStatusMsg(resp?.error ? resp.error : 'Resumed');
    });
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
            <li>Use the dropdown to preview any game.</li>
            <li>Open matches are split into Real/Demo below.</li>
            <li>Spectators can watch and chat; voice is players-only.</li>
          </ul>
        </div>
      </div>

      <GameDummy game={game} />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg">
          <h3 className="font-semibold mb-3">Open Matches — Real</h3>
          <div className="space-y-2 max-h-[24rem] overflow-auto">
            {openReal.map(m=>(
              <div key={m.id} className="p-3 rounded-xl bg-gray-800/60 flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-semibold">{m.game}</div>
                  <div className="opacity-80">Stake ₦{m.stake} • {m.status}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>joinRoom(m.id)} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700">Join</button>
                  <button onClick={()=>spectate(m.id)} className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600">Watch</button>
                </div>
              </div>
            ))}
            {!openReal.length && <div className="text-sm opacity-70">No open real matches.</div>}
          </div>
        </div>

        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg">
          <h3 className="font-semibold mb-3">Open Matches — Demo</h3>
          <div className="space-y-2 max-h-[24rem] overflow-auto">
            {openDemo.map(m=>(
              <div key={m.id} className="p-3 rounded-xl bg-gray-800/60 flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-semibold">{m.game}</div>
                  <div className="opacity-80">Stake ₦{m.stake} • {m.status}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>joinRoom(m.id)} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700">Join</button>
                  <button onClick={()=>spectate(m.id)} className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600">Watch</button>
                </div>
              </div>
            ))}
            {!openDemo.length && <div className="text-sm opacity-70">No open demo matches.</div>}
          </div>
        </div>
      </div>

      {match && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
            <div className="text-sm opacity-80">Your game UI renders on the Match page; keep this Arena for discovery and controls.</div>
          </div>
          <div className="space-y-3">
            <ChatPanel socket={socket} match={match} />
            <VoicePanel socket={socket} match={match} meIsPlayer={meIsPlayer} />
          </div>
        </div>
      )}
    </div>
  );
}
