
import React,{useMemo,useState} from 'react';

const files = ['a','b','c','d','e','f','g','h'];

function fenToBoard(fen){
  const rows = fen.split(' ')[0].split('/');
  return rows.map(r=>{
    const row=[];
    for(const ch of r){
      if(/[1-8]/.test(ch)){ for(let i=0;i<parseInt(ch);i++) row.push('') }
      else row.push(ch);
    }
    return row;
  });
}
// convert row,col (0..7) to algebraic like 'e2'
function rcToAlg(r,c){ return files[c] + (8 - r); }

export default function Chess({ socket, matchId, state }){
  const board = useMemo(()=> fenToBoard(state?.fen || '8/8/8/8/8/8/8/8 w - - 0 1'), [state?.fen]);
  const [from,setFrom]=useState(null);

  function onCell(r,c){
    if(from){ const move={ from: rcToAlg(from[0],from[1]), to: rcToAlg(r,c) }; socket.emit('chess:move', { matchId, ...move }); setFrom(null); }
    else setFrom([r,c]);
  }

  return <div className='inline-block'>
    <div className='grid grid-cols-8 border-2 border-gray-700 rounded overflow-hidden'>
      {board.map((row,r)=>(row.map((cell,c)=>{
        const dark = (r+c)%2===1;
        const sel = from && from[0]===r && from[1]===c;
        return <div key={r+'-'+c} onClick={()=>onCell(r,c)} className={'w-10 h-10 flex items-center justify-center cursor-pointer text-lg ' + (sel?'bg-yellow-500':(dark?'bg-green-700':'bg-green-500')) }>
          {cell}
        </div>
      })))}
    </div>
    <div className='text-sm mt-2 opacity-70'>Click a piece then a destination.</div>
  </div>
}
