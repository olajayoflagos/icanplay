
import React,{useState} from 'react';
import { api } from '../api';

export default function Wallet({ token, onBalance }){
  const [amount,setAmount]=useState(500);
  const [email,setEmail]=useState('');

  async function deposit(){
    const r = await api(token).post('/api/wallet/deposit/initiate', { amount, email, idempotency: 'dep-'+Date.now() });
    if (r.data.demo){
      onBalance && onBalance(r.data.balance);
      alert('Demo credited ₦'+r.data.credited);
    } else {
      window.location.href = r.data.authorization_url;
    }
  }

  return <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3 space-y-2'>
    <h3 className='font-semibold'>Wallet</h3>
    <div className='flex gap-2 items-center'>
      <input type='number' min='1' value={amount} onChange={e=>setAmount(e.target.value)} className='px-2 py-1 rounded text-black w-28'/>
      <input type='email' value={email} onChange={e=>setEmail(e.target.value)} placeholder='email (optional)' className='px-2 py-1 rounded text-black'/>
      <button onClick={deposit} className='px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700'>Deposit</button>
    </div>
    <p className='text-xs text-gray-400'>Without PAYSTACK_SECRET, this credits demo funds instantly.</p>
  </div>
}
