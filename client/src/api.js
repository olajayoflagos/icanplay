// client/src/api.js
import axios from 'axios';

// Named export used by sockets & fetch helpers
export const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

// Axios factory — usage: api(token) or api(token, adminKey)
export function api(token, adminKey) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (adminKey) headers['x-admin-key'] = adminKey;
  return axios.create({ baseURL: API, headers });
}

// (Optional) simple helpers — keep if you still use them elsewhere
export const GAMES = ['chess','checkers','ludo','whot','archery','pool8lite'];

export async function register(username){
  const r = await fetch(`${API}/api/auth/register`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ username })
  });
  return r.json();
}
export async function me(token){
  const r = await fetch(`${API}/api/me`, { headers:{ Authorization:`Bearer ${token}` }});
  return r.json();
}
export async function wallet(token){
  const r = await fetch(`${API}/api/wallet`, { headers:{ Authorization:`Bearer ${token}` }});
  return r.json();
}
export async function depositInit(token, amount, email){
  const r = await fetch(`${API}/api/wallet/deposit/initiate`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
    body: JSON.stringify({ amount, email })
  });
  return r.json();
}
export async function createMatch(token, game, stake, demo){
  const r = await fetch(`${API}/api/matches`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
    body: JSON.stringify({ game, stake, demo })
  });
  return r.json();
}
export async function joinMatch(token, id){
  const r = await fetch(`${API}/api/matches/${id}/join`, {
    method:'POST',
    headers:{ Authorization:`Bearer ${token}` }
  });
  return r.json();
}
