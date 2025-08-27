
import { q, withTx } from './db.js';
export async function withIdempotency(req, res, next){
  const key = req.headers['idempotency-key']; if (!key || req.method!=='POST') return next();
  const token = (req.headers.authorization||'').replace('Bearer ', '') || null;
  const existing = await q('select status_code, response from idempotency_keys where id=$1 and method=$2 and path=$3 and (user_id::text=$4 or $4 is null)', [key, req.method, req.path, token]);
  if (existing.length){ const { status_code, response } = existing[0]; return res.status(status_code).json(response); }
  const _json = res.json.bind(res);
  res.json = async (body)=>{ try{ await withTx(async (c)=>{ await c.query('insert into idempotency_keys(id, method, path, user_id, status_code, response) values ($1,$2,$3,$4,$5,$6)', [key, req.method, req.path, token, res.statusCode||200, body]); }) }catch{}; return _json(body) };
  next();
}
