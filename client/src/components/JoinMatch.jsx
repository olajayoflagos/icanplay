// client/src/components/JoinMatch.jsx
import React,{useState} from 'react';
import { api } from '../api';

export default function JoinMatch({ token, onJoined }){
  const [matchId,setMatchId]=useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function join(){
    setBusy(true); setErr('');
    try{
      const r = await api(token).post(`/api/matches/${matchId}/join`, {});
      onJoined && onJoined({ ...r.data, id: matchId });
    }catch(e){
      setErr(e.response?.data?.error || 'Join failed');
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3 space-y-2'>
      <h3 className='font-semibold'>Join Match</h3>
      <div className='flex flex-wrap gap-2 items-center'>
        <input value={matchId} onChange={e=>setMatchId(e.target.value)} placeholder='paste match id (uuid)'
               className='px-2 py-1 rounded text-black w-[340px]'/>
        <button onClick={join} disabled={!matchId || busy}
                className='px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-60'>
          {busy ? 'Joining…' : 'Join'}
        </button>
      </div>
      <p className='text-xs text-gray-400'>
        After joining you’ll be redirected to Arena and auto-connected to the game.
      </p>
      {err && <div className='text-xs text-red-400'>{err}</div>}
    </div>
  );
}