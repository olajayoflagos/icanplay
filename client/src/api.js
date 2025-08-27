
import axios from 'axios';
const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
export function api(token, adminKey){
  const i = axios.create({ baseURL: API });
  i.interceptors.request.use(cfg=>{
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    if (adminKey) cfg.headers['x-admin-key'] = adminKey;
    cfg.headers['x-device-id'] = localStorage.getItem('device_id') || 'web-'+Math.random().toString(36).slice(2);
    localStorage.setItem('device_id', cfg.headers['x-device-id']);
    return cfg;
  });
  return i;
}
export { API };
