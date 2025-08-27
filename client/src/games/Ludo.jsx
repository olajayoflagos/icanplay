
import React from 'react';

export default function Ludo({ socket, matchId, state }){
  const S = state || { A:[], B:[], turn:'A', die:null };
  function roll(){ socket.emit('ludo:roll', { matchId }); }
  function move(i){ socket.emit('ludo:move', { matchId, idx:i }); }
  function tokens(side){ return (S[side]||[]).map((t,i)=>(<button key={i} onClick={()=>move(i)} className='px-2 py-1 rounded bg-gray-700 hover:bg-gray-600'>{side}{i}:{t.pos}</button>)); }
  return <div className='space-y-2'>
    <div className='text-sm opacity-70'>Turn: {S.turn} • Die: {S.die??'—'}</div>
    <button onClick={roll} className='px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700'>Roll</button>
    <div className='flex gap-4 mt-2'>
      <div className='space-y-1'>{tokens('A')}</div>
      <div className='space-y-1'>{tokens('B')}</div>
    </div>
  </div>
}
