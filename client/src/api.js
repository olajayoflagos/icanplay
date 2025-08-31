import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export function api(token, adminKey) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (adminKey) headers['x-admin-key'] = adminKey;
  return axios.create({ baseURL: API_BASE, headers });
}

export { API_BASE };
