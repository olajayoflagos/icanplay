import React,{useEffect,useRef,useState} from 'react';

export default function ChatPanel({ socket, match }){
  const [items,setItems]=useState([]);
  const [text,setText]=useState('');
  const endRef = useRef(null);

  useEffect(()=>{
    if(!socket || !match?.id) return;
    const onNew = (msg)=>{ if(msg.match_id===match.id) setItems(x=>[...x, msg]); };
    const onHist = (rows)=> setItems(rows);
    socket.on('chat:new', onNew);
    socket.on('chat:history', onHist);
    socket.emit('chat:history', { matchId: match.id });
    return ()=>{ socket.off('chat:new', onNew); socket.off('chat:history', onHist); }
  },[socket, match?.id]);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}); },[items]);

  function send(){
    const t = text.trim(); if(!t) return;
    socket.emit('chat:send', { matchId: match.id, kind:'text', text:t });
    setText('');
  }
  function react(emoji){
    socket.emit('chat:send', { matchId: match.id, kind:'emoji', emoji });
  }

  return <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3 flex flex-col h-80'>
    <div className='text-sm opacity-70 mb-2'>Chat</div>
    <div className='flex-1 overflow-auto space-y-1 pr-1'>
      {items.map(m=>(
        <div key={m.id} className='text-sm'>
          <span className='opacity-60 mr-1'>{m.user?.username || m.role}</span>
          {m.kind==='text' ? <span>{m.text}</span> : <span>{m.emoji}</span>}
        </div>
      ))}
      <div ref={endRef}></div>
    </div>
    <div className='mt-2 flex items-center gap-2'>
      <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder='Type message...' className='px-2 py-1 rounded text-black flex-1'/>
      <button onClick={send} className='px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700'>Send</button>
      <button onClick={()=>react('👍')} className='px-2 py-1 rounded bg-gray-800'>👍</button>
      <button onClick={()=>react('🔥')} className='px-2 py-1 rounded bg-gray-800'>🔥</button>
      <button onClick={()=>react('😂')} className='px-2 py-1 rounded bg-gray-800'>😂</button>
    </div>
  </div>
}
