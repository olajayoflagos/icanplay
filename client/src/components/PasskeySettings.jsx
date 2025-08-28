import React, { useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

function toJSON(cred){
  return {
    id: cred.id,
    rawId: btoa(String.fromCharCode(...new Uint8Array(cred.rawId))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
    type: cred.type,
    response: {
      clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(cred.response.clientDataJSON))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
      attestationObject: cred.response.attestationObject ? btoa(String.fromCharCode(...new Uint8Array(cred.response.attestationObject))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') : undefined,
      authenticatorData: cred.response.authenticatorData ? btoa(String.fromCharCode(...new Uint8Array(cred.response.authenticatorData))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') : undefined,
      signature: cred.response.signature ? btoa(String.fromCharCode(...new Uint8Array(cred.response.signature))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') : undefined,
      userHandle: cred.response.userHandle ? btoa(String.fromCharCode(...new Uint8Array(cred.response.userHandle))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') : undefined,
      publicKeyAlgorithm: cred.response.publicKeyAlgorithm
    },
    clientExtensionResults: cred.getClientExtensionResults?.() || {}
  };
}

export default function PasskeySettings({ token }){
  const api = axios.create({ baseURL: API, headers: token? {Authorization:'Bearer '+token}:{}} );
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');

  async function enablePasskey(){
    setMsg('Starting…');
    const { data: opts } = await api.get('/api/webauthn/register/options');
    opts.challenge = Uint8Array.from(atob(opts.challenge.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    opts.user.id = Uint8Array.from(String(opts.user.id), c => c.charCodeAt(0));
    const cred = await navigator.credentials.create({ publicKey: opts });
    const payload = toJSON(cred);
    await api.post('/api/webauthn/register/verify', payload);
    setMsg('Passkey enabled on this device ✅');
  }

  async function setWithdrawalPin(){
    if(!/^\d{6}$/.test(pin)) { setMsg('PIN must be 6 digits'); return; }
    await api.post('/api/security/pin/set', { pin });
    setMsg('Withdrawal PIN set ✅');
    setPin('');
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900/60 to-black p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Security</h3>
        <span className="text-xs opacity-70">Passkey + PIN</span>
      </div>
      <div className="grid gap-2">
        <button onClick={enablePasskey} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow">
          Enable Face/Touch on this device
        </button>
        <div className="flex gap-2">
          <input value={pin} onChange={e=>setPin(e.target.value)} placeholder="Set 6-digit PIN"
            className="px-3 py-2 rounded-xl text-black flex-1" maxLength={6}/>
          <button onClick={setWithdrawalPin} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow">
            Save PIN
          </button>
        </div>
        {!!msg && <div className="text-sm opacity-80">{msg}</div>}
      </div>
      <p className="text-xs opacity-60">
        You’ll need Face/Touch <em>and</em> your PIN for withdrawals or payout changes.
      </p>
    </div>
  );
}
