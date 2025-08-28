
import { Pool } from 'pg'; import { v4 as uuid } from 'uuid';
const isLocal =
  /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '') ||
  process.env.DATABASE_URL?.includes('@localhost');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
export async function q(t,p){ const { rows } = await pool.query(t,p); return rows; }
export async function withTx(fn){ const c=await pool.connect(); try { await c.query('begin'); const r=await fn(c); await c.query('commit'); return r } catch(e){ await c.query('rollback'); throw e } finally { c.release() } }
export async function postTx(c, ttype, ref, entries, key=null){ if (key){ const ex=await c.query('select id from ledger_transactions where idempotency_key=$1',[key]); if (ex.rows.length) return ex.rows[0].id; } const id=uuid(); await c.query('insert into ledger_transactions(id, ttype, ref, idempotency_key) values ($1,$2,$3,$4)', [id, ttype, ref||null, key]); for(const e of entries){ await c.query('insert into ledger_entries(tx_id, account_type, user_id, amount_cents) values ($1,$2,$3,$4)', [id, e.account_type, e.user_id||null, e.amount_cents]); } return id }
export async function getBalanceCents(user_id){ const r=await q('select balance_cents from user_balances where user_id=$1',[user_id]); return r[0]?.balance_cents||0 }
