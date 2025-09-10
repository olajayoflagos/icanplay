// client/src/components/CreateMatch.jsx
import React,{useState} from 'react';
import { api } from '../api';

const GAMES = ['chess','checkers','ludo','whot','archery','pool8lite'];

export default function CreateMatch({ token, onCreated }){
  const [game,setGame]=useState('chess');
  const [stake,setStake]=useState(0);
  const [demo,setDemo]=useState(true);
  const [lastMatch, setLastMatch] = useState(null); // {id, game, demo, stake}

  async function create(){
    const r = await api(token).post('/api/matches', { game, stake: Number(stake), demo });
    const m = r.data;
    setLastMatch(m);
    onCreated && onCreated(m); // your Dashboard already navigates to Arena with state
  }

  async function copyId(){
    if(!lastMatch?.id) return;
    try { await navigator.clipboard.writeText(lastMatch.id); alert('Match ID copied'); }
    catch { alert('Could not copy, please copy it manually.'); }
  }

  return (
    <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3 space-y-3'>
      <h3 className='font-semibold'>Create Match</h3>

      <div className='flex flex-wrap gap-2 items-center'>
        <select value={game} onChange={e=>setGame(e.target.value)} className='px-2 py-1 rounded text-black'>
          {GAMES.map(g=><option key={g} value={g}>{g}</option>)}
        </select>

        <label className='flex items-center gap-2'>
          Stake ₦
          <input type='number' className='px-2 py-1 rounded text-black w-24'
                 value={stake} onChange={e=>setStake(e.target.value)} />
        </label>

        <label className='flex items-center gap-2'>
          <input type='checkbox' checked={demo} onChange={e=>setDemo(e.target.checked)} />
          Demo (no real money)
        </label>

        <button onClick={create} className='px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700'>Create</button>
      </div>

      {lastMatch && (
        <div className="rounded-lg bg-black/30 border border-gray-800 p-3 text-sm">
          <div className="font-semibold mb-1">Match Created</div>
          <div>Game: <b>{lastMatch.game}</b> • Mode: <b>{lastMatch.demo ? 'Demo' : 'Real'}</b> • Stake: ₦{lastMatch.stake}</div>
          <div className="mt-1 break-all">
            Match ID: <code className="px-2 py-0.5 bg-gray-800 rounded">{lastMatch.id}</code>
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={copyId} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600">Copy ID</button>
          </div>
        </div>
      )}
    </div>
  );
}