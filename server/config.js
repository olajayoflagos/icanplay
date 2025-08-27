
import { q } from './db.js';
export async function getRakePercent(){ const row=(await q("select value from app_config where key='rake_percent'",[]))[0]; if(row&&row.value) return parseInt(row.value,10); return parseInt(process.env.DEFAULT_RAKE_PERCENT||'10',10) }
export async function getFeatures(){ const row=(await q("select value from app_config where key='features'",[]))[0]; if(row&&row.value) return row.value; try{ return JSON.parse(process.env.FEATURES_JSON||'{}') }catch{ return {} } }
export async function setConfig(key, value){ await q('insert into app_config(key,value,updated_at) values ($1,$2,now()) on conflict (key) do update set value=$2, updated_at=now()', [key, value]) }
