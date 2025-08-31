// client/src/components/AuthBar.jsx
import React, { useEffect, useState } from 'react';
import { API_BASE } from '../api';

async function fetchJSON(path, { token, method = 'GET', body } = {}) {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) {
    let msg;
    try { msg = await r.text(); } catch {}
    throw new Error(`${method} ${path} -> ${r.status}${msg ? `: ${msg}` : ''}`);
  }
  return r.json();
}

export default function AuthBar({
  token,
  setToken,
  user,
  setUser,
  balance,
  setBalance,
  compact = false,
}) {
  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [demoBalance, setDemoBalance] = useState(0);

  async function doRegister() {
    setBusy(true); setErr('');
    try {
      const r = await fetchJSON('/api/auth/register', {
        method: 'POST',
        body: { username },
      });
      localStorage.setItem('token', r.token);
      setToken(r.token);
      setUser(r.user);
    } catch {
      setErr('Registration failed (username taken or invalid).');
    } finally { setBusy(false); }
  }

  async function doLogin() {
    setBusy(true); setErr('');
    try {
      const r = await fetchJSON('/api/auth/login', {
        method: 'POST',
        body: { username },
      });
      localStorage.setItem('token', r.token);
      setToken(r.token);
      setUser(r.user);
    } catch {
      localStorage.removeItem('token');
      setToken('');
      setErr('Login failed (username not found).');
    } finally { setBusy(false); }
  }

  async function refresh() {
    try {
      const me = await fetchJSON('/api/me', { token });
      setUser(me.user);
    } catch {}

    try {
      const w = await fetchJSON('/api/wallet', { token });
      setBalance?.(w.balance ?? 0);
      setDemoBalance(w.demo_balance ?? 0);
    } catch {}
  }

  useEffect(() => { if (token) refresh(); }, [token]);

  function logout() {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
  }

  // Compact (mobile) variant
  if (compact) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        {!token ? (
          <>
            <div className="flex gap-2" role="tablist" aria-label="Auth mode">
              <button
                role="tab"
                aria-selected={mode === 'register'}
                className={'px-2 py-1 rounded ' + (mode === 'register' ? 'bg-gray-800' : 'bg-gray-900 hover:bg-gray-800/60')}
                onClick={() => setMode('register')}
              >
                Register
              </button>
              <button
                role="tab"
                aria-selected={mode === 'login'}
                className={'px-2 py-1 rounded ' + (mode === 'login' ? 'bg-gray-800' : 'bg-gray-900 hover:bg-gray-800/60')}
                onClick={() => setMode('login')}
              >
                Login
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'register' ? 'Choose username' : 'Enter username'}
                className="px-2 py-1 rounded text-black"
                aria-label="Username"
              />
              <button
                onClick={mode === 'register' ? doRegister : doLogin}
                disabled={busy || !username}
                className={'px-3 py-1 rounded ' + (mode === 'register'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-blue-600 hover:bg-blue-700') + ' disabled:opacity-50'}
              >
                {busy ? '...' : (mode === 'register' ? 'Register' : 'Login')}
              </button>
            </div>

            {err && <div className="text-xs text-red-400">{err}</div>}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="truncate">@{user?.username ?? '...'}</div>
              <div className="px-2 py-0.5 rounded bg-gray-800 text-xs">
                ₦{balance ?? 0} <span className="opacity-70">(demo ₦{demoBalance})</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={refresh} className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700">Refresh</button>
              <button onClick={logout} className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700">Logout</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full (desktop) variant
  return (
    <div className="p-2 rounded-xl bg-gray-900/40 border border-gray-800">
      {!token ? (
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-gray-900/60 border border-gray-800 overflow-hidden">
            <button
              className={'px-3 py-1 text-sm ' + (mode === 'register' ? 'bg-gray-800' : 'hover:bg-gray-800/60')}
              onClick={() => setMode('register')}
            >
              Register
            </button>
            <button
              className={'px-3 py-1 text-sm ' + (mode === 'login' ? 'bg-gray-800' : 'hover:bg-gray-800/60')}
              onClick={() => setMode('login')}
            >
              Login
            </button>
          </div>

          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={mode === 'register' ? 'Choose username' : 'Enter username'}
            className="px-2 py-1 rounded text-black w-52"
            aria-label="Username"
          />
          <button
            onClick={mode === 'register' ? doRegister : doLogin}
            disabled={busy || !username}
            className={'px-3 py-1 rounded ' + (mode === 'register'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-blue-600 hover:bg-blue-700') + ' disabled:opacity-50'}
          >
            {busy ? '...' : (mode === 'register' ? 'Register' : 'Login')}
          </button>

          {err && <div className="text-xs text-red-400">{err}</div>}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="px-2 py-1 rounded bg-gray-800 text-sm">@{user?.username ?? '...'}</div>
          <div className="px-2 py-1 rounded bg-gray-800 text-sm">
            Balance: ₦{balance ?? 0} <span className="opacity-70">(demo ₦{demoBalance})</span>
          </div>
          <button onClick={refresh} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700">Refresh</button>
          <button onClick={logout} className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700">Logout</button>
        </div>
      )}
    </div>
  );
}
