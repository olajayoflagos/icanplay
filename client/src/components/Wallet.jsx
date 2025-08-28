// client/src/components/Wallet.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

function b64uToBytes(b64u){
  const s = b64u.replace(/-/g,'+').replace(/_/g,'/');
  const pad = s.length%4===2?'==':s.length%4===3?'=':'';
  const bin = atob(s+pad);
  return Uint8Array.from(bin, c=>c.charCodeAt(0));
}
function toJSON(cred){
  const obj = {
    id: cred.id,
    rawId: btoa(String.fromCharCode(...new Uint8Array(cred.rawId))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
    type: cred.type,
    response: {
      clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(cred.response.clientDataJSON))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
      authenticatorData: cred.response.authenticatorData ? btoa(String.fromCharCode(...new Uint8Array(cred.response.authenticatorData))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') : undefined,
      signature: cred.response.signature ? btoa(String.fromCharCode(...new Uint8Array(cred.response.signature))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') : undefined,
      userHandle: cred.response.userHandle ? btoa(String.fromCharCode(...new Uint8Array(cred.response.userHandle))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') : undefined,
      attestationObject: cred.response.attestationObject ? btoa(String.fromCharCode(...new Uint8Array(cred.response.attestationObject))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') : undefined
    },
    clientExtensionResults: cred.getClientExtensionResults?.() || {}
  };
  return obj;
}

export default function Wallet({ token, onBalance }){
  const api = axios.create({ baseURL: API, headers: token? {Authorization:'Bearer '+token}:{}} );
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [payouts, setPayouts] = useState([]);
  const [payoutId, setPayoutId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load(){
    try{
      const r = await api.get('/api/wallet');
      setBalance(r.data.balance||0);
      onBalance?.(r.data.balance||0);
      // load payouts (simple: get from admin/user endpoint if you have; else leave manual)
      // optional: you can implement GET /api/payouts to list
      // for now, keep empty unless you add that route
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
        setMsg(`Credited ₦${r.data.credited}. Balance: ₦${r.data.balance}`);
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

  async function assertPasskey(){
    const { data: opts } = await api.get('/api/webauthn/assert/options');
    // Only challenge needs decoding; allowCredentials can remain as is for server-side b64url Buffer parse
    const publicKey = { ...opts, challenge: b64uToBytes(opts.challenge) };
    const assertion = await navigator.credentials.get({ publicKey });
    await api.post('/api/webauthn/assert/verify', toJSON(assertion));
  }

  async function withdraw(){
    if (!/^\d+(\.\d{1,2})?$/.test(String(amount||''))) { setMsg('Enter a valid amount'); return; }
    if (!/^\d{6}$/.test(String(pin||''))) { setMsg('Enter your 6-digit PIN'); return; }
    if (!payoutId) { setMsg('Choose a payout destination first'); return; }

    setBusy(true); setMsg('');
    try{
      // Biometric (Face/Touch) first
      await assertPasskey();

      // Then withdraw with PIN
      const r = await api.post('/api/wallet/withdraw', {
        amount: Number(amount||0),
        payout_id: payoutId,
        pin,
        idempotency: 'wd-'+Date.now()
      });
      if (r.data?.queued){
        setMsg('Withdrawal queued for review.');
        setAmount(''); setPin('');
        await load();
      } else {
        setMsg('Withdrawal submitted.');
      }
    }catch(e){
      const er = e.response?.data?.error || e.message;
      setMsg(er === 'biometric-required' ? 'Please enable Face/Touch in Security card.' : er);
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className='rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg space-y-3'>
      <div className='flex items-center justify-between'>
        <h3 className='font-semibold'>Wallet</h3>
        <div className='text-sm opacity-80'>Balance: <span className='font-mono'>₦{balance}</span></div>
      </div>

      <div className='grid md:grid-cols-2 gap-3'>
        <div className='space-y-2'>
          <div className='text-sm opacity-70'>Deposit</div>
          <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder='Amount (₦)'
                 className='px-3 py-2 rounded-xl text-black w-full'/>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder='Email (Paystack receipt)'
                 className='px-3 py-2 rounded-xl text-black w-full'/>
          <button onClick={deposit} disabled={busy} className={'px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow '+(busy?'opacity-60 cursor-not-allowed':'')}>
            {busy ? 'Working…' : 'Deposit'}
          </button>
        </div>

        <div className='space-y-2'>
          <div className='text-sm opacity-70'>Withdraw</div>
          {/* payout select (you can wire GET /api/payouts to populate this) */}
          <select value={payoutId} onChange={e=>setPayoutId(e.target.value)} className='px-3 py-2 rounded-xl text-black w-full'>
            <option value=''>Select payout destination</option>
            {payouts.map(p=> <option key={p.id} value={p.id}>{p.display} ({p.status})</option>)}
          </select>
          <input value={pin} onChange={e=>setPin(e.target.value)} placeholder='6-digit PIN'
                 className='px-3 py-2 rounded-xl text-black w-full' maxLength={6}/>
          <button onClick={withdraw} disabled={busy} className={'px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow '+(busy?'opacity-60 cursor-not-allowed':'')}>
            {busy ? 'Working…' : 'Withdraw'}
          </button>
        </div>
      </div>

      {!!msg && <div className='text-sm opacity-90'>{msg}</div>}
      <div className='text-xs opacity-60'>Tip: withdrawals require Face/Touch + your 6-digit PIN.</div>
    </div>
  );
}
