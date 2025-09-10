import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function Wallet({ token, onBalance }) {
  const api = useMemo(
    () => axios.create({ baseURL: API, headers: token ? { Authorization: 'Bearer ' + token } : {} }),
    [token]
  );

  const [realBal, setRealBal] = useState(0);
  const [demoBal, setDemoBal] = useState(0);

  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const fmt = (n) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
      Number.isFinite(n) ? n : 0
    );

  async function load() {
    if (!token) return;
    try {
      const r = await api.get('/api/wallet');
      const real = r.data.balance ?? 0;
      const demo = r.data.demo_balance ?? 0;
      setRealBal(real);
      setDemoBal(demo);
      onBalance?.(real);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = !busy && token && Number(amount) > 0;

  async function deposit() {
    setMsg('');
    setErr('');

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr('Enter a valid amount.');
      return;
    }

    setBusy(true);
    try {
      const r = await api.post('/api/wallet/deposit/initiate', {
        amount: amt,
        email: email || undefined,
        idempotency: 'dep-' + Date.now(),
      });

      if (r.data?.demo) {
        setMsg(`Demo credited ${fmt(r.data.credited)}. Demo balance: ${fmt(r.data.demo_balance)}`);
        setAmount('');
        setEmail('');
        await load();
      } else if (r.data?.authorization_url) {
        // Paystack hosted page
        window.location.href = r.data.authorization_url;
      } else {
        setMsg('Deposit started.');
      }
    } catch (e) {
      setErr(e.response?.data?.error || 'Deposit failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-black/30 border border-gray-800 p-3">
          <div className="text-xs opacity-70">Real Balance</div>
          <div className="text-xl font-bold">{fmt(realBal)}</div>
        </div>
        <div className="rounded-xl bg-black/30 border border-gray-800 p-3">
          <div className="text-xs opacity-70">Demo Balance</div>
          <div className="text-xl font-bold">{fmt(demoBal)}</div>
        </div>
      </div>

      {/* Deposit */}
      <div className="rounded-xl bg-black/30 border border-gray-800 p-3 space-y-3">
        <div className="text-sm opacity-70">Deposit</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (₦)"
            className="px-3 py-2 rounded-xl text-black w-full"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email for Paystack (leave empty to credit Demo)"
            className="px-3 py-2 rounded-xl text-black w-full"
          />
        </div>

        <button
          onClick={deposit}
          disabled={!canSubmit}
          className={
            'w-full sm:w-auto px-4 py-2 rounded-xl ' +
            (email ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700') +
            ' disabled:opacity-50 disabled:cursor-not-allowed'
          }
        >
          {busy ? 'Working…' : email ? 'Deposit to Real (Paystack)' : 'Credit Demo'}
        </button>

        {msg && <div className="text-xs text-emerald-300">{msg}</div>}
        {err && <div className="text-xs text-rose-400">{err}</div>}

        {!token && (
          <div className="text-xs text-amber-300">
            Login or register to view balances and make deposits.
          </div>
        )}
      </div>
    </div>
  );
}