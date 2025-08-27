
import React,{useState,useEffect} from 'react';
import { api } from '../api';

export default function AuthBar({ token, setToken, user, setUser, balance, setBalance }){
  const [username,setUsername] = useState('');

  async function register(){
    const r = await api().post('/api/auth/register', { username });
    setToken(r.data.token); setUser(r.data.user);
    localStorage.setItem('token', r.data.token);
  }
  async function fetchMe(){ try{ const r=await api(token).get('/api/me'); setUser(r.data.user);}catch{} }
  async function fetchBalance(){ try{ const r=await api(token).get('/api/wallet'); setBalance(r.data.balance);}catch{} }

  useEffect(()=>{ if(token){ fetchMe(); fetchBalance(); } },[token]);

  return <div className='p-3 rounded-xl bg-gray-900/40 border border-gray-800 flex items-center justify-between'>
    <div className='font-semibold'>I Can Play</div>
    {!token ? (
      <div className='flex gap-2 items-center'>
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder='choose username' className='px-2 py-1 rounded text-black'/>
        <button onClick={register} className='px-3 py-1 rounded bg-green-600 hover:bg-green-700'>Register</button>
      </div>
    ) : (
      <div className='flex gap-3 items-center'>
        <div>@{user?.username||'...'}</div>
        <div className='px-2 py-1 rounded bg-gray-800'>Balance: ₦{balance}</div>
        <button onClick={fetchBalance} className='px-2 py-1 rounded bg-blue-600 hover:bg-blue-700'>Refresh</button>
        <button onClick={()=>{ localStorage.removeItem('token'); setToken(''); setUser(null); }} className='px-2 py-1 rounded bg-red-600 hover:bg-red-700'>Logout</button>
      </div>
    )}
  </div>
}
