// client/src/pages/AdminGate.jsx
import React, { useState } from 'react';
import Admin from '../components/Admin.jsx';

export default function AdminGate({ token }){
  const [key, setKey] = useState('');
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState('');

  async function enter(){
    if(!key.trim()){ setMsg('Enter admin key'); return; }
    // Soft check: ping a harmless admin endpoint if you have one; else just reveal UI and rely on server auth
    setOk(true);
    setMsg('');
  }

  if (ok){
    // Pass it down; Admin.jsx should attach `x-admin-key` header on its requests
    return <Admin token={token} adminKey={key} />;
  }

  return (
    <div className="max-w-md mx-auto rounded-2xl bg-gray-900/40 border border-gray-800 p-6 space-y-3 shadow-lg">
      <h3 className="font-semibold text-lg">Admin Access</h3>
      <input
        type="password"
        className="px-3 py-2 rounded-xl text-black w-full"
        placeholder="Enter admin key"
        value={key} onChange={e=>setKey(e.target.value)}
      />
      <button onClick={enter} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700">
        Enter
      </button>
      {!!msg && <div className="text-sm opacity-80">{msg}</div>}
      <div className="text-xs opacity-60">The UI will only unlock locally; all admin requests are re-checked on the server using the key.</div>
    </div>
  );
}
