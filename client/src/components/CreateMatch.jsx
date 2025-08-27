
import React,{useState} from 'react';
import { api } from '../api';

const GAMES = ['chess','checkers','ludo','whot','archery','pool8lite'];

export default function CreateMatch({ token, onCreated }){
  const [game,setGame]=useState('chess');
  const [stake,setStake]=useState(0);
  const [demo,setDemo]=useState(true);

  async function create(){
    const r=await api(token).post('/api/matches', { game, stake: Number(stake), demo });
    onCreated && onCreated(r.data);
  }

  return <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3 space-y-2'>
    <h3 className='font-semibold'>Create Match</h3>
    <div className='flex flex-wrap gap-2'>
      <select value={game} onChange={e=>setGame(e.target.value)} className='px-2 py-1 rounded text-black'>
        {GAMES.map(g=><option key={g} value={g}>{g}</option>)}
      </select>
      <label className='flex items-center gap-2'>Stake ₦
        <input type='number' className='px-2 py-1 rounded text-black w-24' value={stake} onChange={e=>setStake(e.target.value)} />
      </label>
      <label className='flex items-center gap-2'>
        <input type='checkbox' checked={demo} onChange={e=>setDemo(e.target.checked)} />
        Demo (no real money)
      </label>
      <button onClick={create} className='px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700'>Create</button>
    </div>
  </div>
}
