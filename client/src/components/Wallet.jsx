import React, { useEffect, useState } from 'react';
import axios from 'axios';
const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function Wallet({ token, onBalance }){
  const api = axios.create({ baseURL: API, headers: token? {Authorization:'Bearer '+token}:{}} );
  const [realBal, setRealBal] = useState(0);
  const [demoBal, setDemoBal] = useState(0);
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load(){
    try{
      const r = await api.get('/api/wallet');
      setRealBal(r.data.balance||0);
      setDemoBal(r.data.demo_balance||0);
      onBalance?.(r.data.balance||0);
    }catch{}
  }
  useEffect(()=>{ if(token) load(); },[token]);

  async function deposit(){
    setBusy(true); setMsg('');
    try{
      const r = await api.post('/api/wallet/deposit/initiate', {
        amount: Number(amount||0),
        email: email || undefined,
        idempotency: 'dep-'+Date.now()
      });
      if (r.data?.demo){
        setMsg(`Demo credited ₦${r.data.credited}. Demo balance: ₦${r.data.demo_balance}`);
        setAmount(''); setEmail('');
        await load();
      } else if (r.data?.authorization_url){
        window.location.href = r.data.authorization_url; // Paystack hosted page
      } else {
        setMsg('Deposit started.');
      }
    }catch(e){
      setMsg(e.response?.data?.error || 'Deposit failed.');
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-black/30 border border-gray-800 p-3">
          <div className="text-xs opacity-70">Real Balance</div>
          <div className="text-xl font-bold">₦{realBal}</div>
        </div>
        <div className="rounded-xl bg-black/30 border border-gray-800 p-3">
          <div className="text-xs opacity-70">Demo Balance</div>
          <div className="text-xl font-bold">₦{demoBal}</div>
        </div>
      </div>

      <div className="rounded-xl bg-black/30 border border-gray-800 p-3 space-y-2">
        <div className="text-sm opacity-70">Deposit</div>
        <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder='Amount (₦)'
               className='px-3 py-2 rounded-xl text-black w-full'/>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder='Email (Paystack receipt — leave empty for Demo credit)'
               className='px-3 py-2 rounded-xl text-black w-full'/>
        <button onClick={deposit} disabled={busy}
                className={'px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 '+(busy?'opacity-60 cursor-not-allowed':'')}>
          {busy ? 'Working…' : (email ? 'Deposit to Real (Paystack)' : 'Credit Demo')}
        </button>
        {!!msg && <div className='text-xs opacity-90'>{msg}</div>}
      </div>
    </div>
  );
}
