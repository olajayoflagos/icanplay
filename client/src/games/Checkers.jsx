
import React,{useState} from 'react';

export default function Checkers({ socket, matchId, state }){
  const [from,setFrom]=useState(null);
  const board = state?.board || Array.from({length:8},()=>Array(8).fill(null));

  function onCell(r,c){
    if(from){ socket.emit('checkers:move', { matchId, from, to:[r,c] }); setFrom(null); }
    else setFrom([r,c]);
  }

  return <div className='inline-block'>
    <div className='grid grid-cols-8 border-2 border-gray-700 rounded overflow-hidden'>
      {board.map((row,r)=>(row.map((cell,c)=>{
        const dark=(r+c)%2===1, sel=from && from[0]===r && from[1]===c;
        return <div key={r+'-'+c} onClick={()=>dark && onCell(r,c)} className={'w-10 h-10 flex items-center justify-center cursor-pointer ' + (dark?'bg-amber-700':'bg-amber-300') + (sel?' ring-2 ring-yellow-400':'')}>
          {cell && <div className={'w-6 h-6 rounded-full '+(cell.toLowerCase()==='r'?'bg-red-500':'bg-black') } title={cell}></div>}
        </div>
      })))}
    </div>
    <div className='text-sm mt-2 opacity-70'>Select from → to (forced captures handled server-side).</div>
  </div>
}
