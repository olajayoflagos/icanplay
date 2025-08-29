import React, { useMemo, useState } from 'react';
import PasskeySettings from '../components/PasskeySettings.jsx';
import axios from 'axios';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function Settings({ token, onBalance }){
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <PasskeySettings token={token} />
      <WithdrawalDetails token={token} />
    </div>
  );
}

function WithdrawalDetails({ token }){
  const api = useMemo(()=>axios.create({
    baseURL: API,
    headers: token? { Authorization: 'Bearer '+token } : {}
  }), [token]);

  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save(){
    setBusy(true); setMsg('');
    try{
      const r = await api.post('/api/payouts/recipient', {
        bank_code: bankCode,
        account_number: accountNumber,
        account_name: accountName || undefined
      });
      setMsg('Payout account saved. New/changed details may be usable after a short cooling window.');
    }catch(e){
      setMsg(e.response?.data?.error || 'Save failed');
    }finally{ setBusy(false); }
  }

  return (
    <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg space-y-3">
      <h3 className="font-semibold">Withdrawal Account</h3>
      <div className="grid md:grid-cols-2 gap-3">
        <input value={bankCode} onChange={e=>setBankCode(e.target.value)} placeholder="Bank Code (e.g. 058)"
               className="px-3 py-2 rounded-xl text-black w-full" />
        <input value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} placeholder="Account Number"
               className="px-3 py-2 rounded-xl text-black w-full" />
        <input value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Account Name (optional)"
               className="px-3 py-2 rounded-xl text-black w-full md:col-span-2" />
      </div>
      <button onClick={save} disabled={busy} className={'px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 '+(busy?'opacity-60 cursor-not-allowed':'')}>
        {busy ? 'Saving…' : 'Save Payout Account'}
      </button>
      {!!msg && <div className="text-sm opacity-90">{msg}</div>}
      <div className="text-xs opacity-60">Changing payout details may require a security cool-off and always needs Passkey + PIN for withdrawals.</div>
    </div>
  );
}
