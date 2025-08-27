
import React,{useState} from 'react';

export default function PoolLite({ socket, matchId, state }){
  const S = state || { A:0, B:0, turn:'A' };
  const [power,setPower]=useState(0.7);
  function shoot(){ socket.emit('pool:shot', { matchId, power: Number(power) }); }
  return <div className='space-y-2'>
    <div className='text-sm opacity-70'>Turn: {S.turn}</div>
    <input type='range' min='0' max='1' step='0.01' value={power} onChange={e=>setPower(e.target.value)} />
    <button onClick={shoot} className='px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700'>Shoot</button>
    <div className='text-sm'>Score A: {S.A} &nbsp; | &nbsp; Score B: {S.B}</div>
  </div>
}
