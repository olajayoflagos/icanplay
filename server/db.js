
// server/db.js
import pkg from 'pg';
import { v4 as uuid } from 'uuid';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;
const wantSSL = process.env.PGSSLMODE?.toLowerCase() === 'require' || process.env.DATABASE_SSL === '1';

export const pool = new Pool({
  connectionString,
  ssl: wantSSL ? { rejectUnauthorized: false } : false
});

export async function q(text, params){
  const { rows } = await pool.query(text, params);
  return rows;
}
export async function withTx(fn){ const c=await pool.connect(); try { await c.query('begin'); const r=await fn(c); await c.query('commit'); return r } catch(e){ await c.query('rollback'); throw e } finally { c.release() } }
export async function postTx(c, ttype, ref, entries, key=null){ if (key){ const ex=await c.query('select id from ledger_transactions where idempotency_key=$1',[key]); if (ex.rows.length) return ex.rows[0].id; } const id=uuid(); await c.query('insert into ledger_transactions(id, ttype, ref, idempotency_key) values ($1,$2,$3,$4)', [id, ttype, ref||null, key]); for(const e of entries){ await c.query('insert into ledger_entries(tx_id, account_type, user_id, amount_cents) values ($1,$2,$3,$4)', [id, e.account_type, e.user_id||null, e.amount_cents]); } return id }
export async function getBalanceCents(user_id){ const r=await q('select balance_cents from user_balances where user_id=$1',[user_id]); return r[0]?.balance_cents||0 }