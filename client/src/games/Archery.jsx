
import React,{useState} from 'react';

export default function Archery({ socket, matchId, state }){
  const S = state || { A:[], B:[], turn:'A', bestOf:5 };
  const [shot,setShot]=useState(0.7);
  function shoot(){ socket.emit('archery:shoot', { matchId, shot: Number(shot) }); }
  const sum = a=> (a||[]).reduce((x,y)=>x+y,0);
  return <div className='space-y-2'>
    <div className='text-sm opacity-70'>Turn: {S.turn} • Best of {S.bestOf||5}</div>
    <input type='range' min='0' max='1' step='0.01' value={shot} onChange={e=>setShot(e.target.value)} />
    <button onClick={shoot} className='px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700'>Shoot</button>
    <div className='text-sm'>A: {S.A?.join(', ')} (total {sum(S.A)})</div>
    <div className='text-sm'>B: {S.B?.join(', ')} (total {sum(S.B)})</div>
  </div>
}
