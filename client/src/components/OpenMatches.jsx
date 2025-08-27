import React,{useEffect,useState} from 'react';
import axios from 'axios';
const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function OpenMatches({ token, onJoin, onWatch, socket }){
  const [open,setOpen]=useState([]);
  const [live,setLive]=useState([]);

  async function load(){
    const i = axios.create({ baseURL: API, headers: token? {Authorization:'Bearer '+token}: {} });
    const [a,b] = await Promise.all([
      i.get('/api/matches?status=OPEN'),
      i.get('/api/matches?status=LIVE')
    ]);
    setOpen(a.data); setLive(b.data);
  }

  useEffect(()=>{ load(); },[]);

  return <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3 space-y-3'>
    <div className='flex items-center justify-between'>
      <h3 className='font-semibold'>Open Matches</h3>
      <button onClick={load} className='px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-sm'>Refresh</button>
    </div>
    <div className='grid md:grid-cols-2 gap-3'>
      <List title='OPEN' data={open} action={(m)=>onJoin && onJoin(m.id)} actionLabel='Join'/>
      <List title='LIVE' data={live} action={(m)=>onWatch && onWatch(m.id)} actionLabel='Watch'/>
    </div>
  </div>
}

function List({ title, data, action, actionLabel }){
  return <div>
    <div className='text-sm opacity-70 mb-1'>{title}</div>
    <div className='space-y-2 max-h-72 overflow-auto pr-1'>
      {data.map(m=>(
        <div key={m.id} className='p-2 rounded bg-gray-800 flex items-center justify-between'>
          <div className='text-sm'>
            <div className='font-mono text-xs opacity-70'>{m.id}</div>
            <div>{m.game} • ₦{m.stake} • {m.status}</div>
          </div>
          <button onClick={()=>action(m)} className='px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-sm'>{actionLabel}</button>
        </div>
      ))}
      {data.length===0 && <div className='text-sm opacity-60'>None</div>}
    </div>
  </div>
}
