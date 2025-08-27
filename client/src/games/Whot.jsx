
import React,{useState} from 'react';

export default function Whot({ socket, matchId, state }){
  const S = state || { A:[], B:[], pile:[], call:null, turn:'A' };
  const [call,setCall]=useState('★');

  function play(side, idx){
    socket.emit('whot:play', { matchId, index: idx, called: call });
  }
  function draw(){ socket.emit('whot:draw', { matchId }); }

  const top = S.pile?.[S.pile.length-1];
  const Card = ({c}) => <span className='px-2 py-1 rounded bg-gray-800'>{c.s}{c.n}</span>;

  return <div className='space-y-2'>
    <div className='text-sm opacity-70'>Turn: {S.turn} • Call: {S.call||'—'} • Top: {top? (top.s+top.n):'—'}</div>
    <div className='flex gap-3 items-center'>
      <label>Call suit for WHOT: 
        <select value={call} onChange={e=>setCall(e.target.value)} className='ml-2 px-2 py-1 rounded text-black'>
          <option>★</option><option>■</option><option>▲</option><option>●</option>
        </select>
      </label>
      <button onClick={draw} className='px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700'>Draw</button>
    </div>
    <div>
      <div className='font-semibold mt-2'>A</div>
      <div className='flex flex-wrap gap-2'>{(S.A||[]).map((c,i)=>(
        <button key={'A'+i} onClick={()=>play('A',i)} className='px-2 py-1 rounded bg-gray-700 hover:bg-gray-600'>{c.s}{c.n}</button>
      ))}</div>
    </div>
    <div>
      <div className='font-semibold mt-2'>B</div>
      <div className='flex flex-wrap gap-2'>{(S.B||[]).map((c,i)=>(
        <button key={'B'+i} onClick={()=>play('B',i)} className='px-2 py-1 rounded bg-gray-700 hover:bg-gray-600'>{c.s}{c.n}</button>
      ))}</div>
    </div>
  </div>
}
