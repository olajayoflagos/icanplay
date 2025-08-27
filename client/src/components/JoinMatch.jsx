
import React,{useState} from 'react';
import { api } from '../api';

export default function JoinMatch({ token, onJoined }){
  const [matchId,setMatchId]=useState('');

  async function join(){
    const r=await api(token).post(`/api/matches/${matchId}/join`, {});
    onJoined && onJoined({ ...r.data, id: matchId });
  }

  return <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3 space-y-2'>
    <h3 className='font-semibold'>Join Match</h3>
    <div className='flex gap-2 items-center'>
      <input value={matchId} onChange={e=>setMatchId(e.target.value)} placeholder='match id (uuid)' className='px-2 py-1 rounded text-black w-[340px]'/>
      <button onClick={join} className='px-3 py-1 rounded bg-purple-600 hover:bg-purple-700'>Join</button>
    </div>
    <p className='text-xs text-gray-400'>Ask the match creator for the match ID they received.</p>
  </div>
}
