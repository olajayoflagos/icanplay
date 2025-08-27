
import React,{useState,useEffect} from 'react';
import { api } from '../api';

export default function Admin({ token }){
  const [adminKey,setAdminKey]=useState(localStorage.getItem('admin_key')||'');
  const [cfg,setCfg]=useState(null);
  const [rake,setRake]=useState(10);
  const [features,setFeatures]=useState({});

  const [disputes,setDisputes]=useState([]);
  const [withdrawals,setWithdrawals]=useState([]);
  const [risk,setRisk]=useState([]);

  // tournaments
  const [tid,setTid]=useState('');
  const [tname,setTname]=useState('I Can Play Tournament');
  const [ttype,setTtype]=useState('KNOCKOUT');
  const [buyin,setBuyin]=useState(0);
  const [enrollUser,setEnrollUser]=useState('');

  function withAdmin(){ return api(token, adminKey) }
  function saveKey(){ localStorage.setItem('admin_key', adminKey); alert('Admin key saved'); }

  async function loadConfig(){
    try{ const r=await withAdmin().get('/api/admin/config'); setCfg(r.data); setRake(r.data.rake_percent); setFeatures(r.data.features||{}); }catch(e){ alert('Admin auth failed'); }
  }
  async function updateConfig(){
    try{ await withAdmin().post('/api/admin/config', { rake_percent: Number(rake), features }); await loadConfig(); }catch(e){ alert('Update failed') }
  }
  async function loadDisputes(){ const r=await withAdmin().get('/api/admin/disputes'); setDisputes(r.data) }
  async function loadWithdrawals(){ const r=await withAdmin().get('/api/admin/withdrawals'); setWithdrawals(r.data) }
  async function loadRisk(){ const r=await withAdmin().get('/api/admin/risk-flags'); setRisk(r.data) }
  async function reviewWithdrawal(id, decision){ await withAdmin().post(`/api/withdrawals/${id}/review`, { decision, reviewer: 'admin-ui' }); await loadWithdrawals(); }

  async function createTournament(){
    const r=await withAdmin().post('/api/admin/tournaments', { name:tname, ttype, buy_in_cents: Math.floor(buyin*100) });
    setTid(r.data.id);
  }
  async function enroll(){ await withAdmin().post(`/api/admin/tournaments/${tid}/enroll`, { user_id: enrollUser }); alert('Enrolled'); }
  async function pairSwiss(){ const r=await withAdmin().post(`/api/admin/tournaments/${tid}/pair`, { mode:'SWISS', game:'chess' }); alert('Created matches: '+r.data.created.length) }
  async function pairKO(){ const r=await withAdmin().post(`/api/admin/tournaments/${tid}/pair`, { mode:'KO', game:'chess' }); alert('Created matches: '+r.data.created.length) }

  useEffect(()=>{ if(adminKey) loadConfig(); },[]);

  return <div className='space-y-4'>
    <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3 space-y-2'>
      <div className='flex gap-2 items-center'>
        <input value={adminKey} onChange={e=>setAdminKey(e.target.value)} placeholder='x-admin-key' className='px-2 py-1 rounded text-black w-[340px]'/>
        <button onClick={saveKey} className='px-3 py-1 rounded bg-slate-600 hover:bg-slate-700'>Save</button>
        <button onClick={loadConfig} className='px-3 py-1 rounded bg-blue-600 hover:bg-blue-700'>Load Config</button>
      </div>
      {cfg && <div className='space-y-2'>
        <div className='flex gap-3 items-center'>
          <label>Rake % <input type='number' value={rake} onChange={e=>setRake(e.target.value)} className='px-2 py-1 rounded text-black w-20 ml-2'/></label>
          <label className='flex items-center gap-2'>
            <input type='checkbox' checked={!!features.archery} onChange={e=>setFeatures({...features, archery:e.target.checked})}/> Archery
          </label>
          <label className='flex items-center gap-2'>
            <input type='checkbox' checked={!!features.pool8lite} onChange={e=>setFeatures({...features, pool8lite:e.target.checked})}/> 8-Ball Lite
          </label>
          <label className='flex items-center gap-2'>
            <input type='checkbox' checked={!!features.tournaments} onChange={e=>setFeatures({...features, tournaments:e.target.checked})}/> Tournaments
          </label>
          <label className='flex items-center gap-2'>
            <input type='checkbox' checked={!!features.swiss} onChange={e=>setFeatures({...features, swiss:e.target.checked})}/> Swiss
          </label>
          <button onClick={updateConfig} className='px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700'>Update</button>
        </div>
      </div>}
    </div>

    <div className='grid md:grid-cols-3 gap-4'>
      <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3'>
        <h3 className='font-semibold mb-2'>Disputes</h3>
        <button onClick={loadDisputes} className='mb-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700'>Refresh</button>
        <div className='space-y-2 max-h-64 overflow-auto'>
          {disputes.map(d=>(<div key={d.id} className='p-2 rounded bg-gray-800'>
            <div className='text-xs'>{d.id}</div>
            <div className='text-sm'>{d.reason}</div>
            <div className='text-xs opacity-70'>{d.status}</div>
          </div>))}
        </div>
      </div>

      <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3'>
        <h3 className='font-semibold mb-2'>Withdrawals</h3>
        <button onClick={loadWithdrawals} className='mb-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700'>Refresh</button>
        <div className='space-y-2 max-h-64 overflow-auto'>
          {withdrawals.map(w=>(<div key={w.id} className='p-2 rounded bg-gray-800 space-y-1'>
            <div className='text-xs'>{w.id}</div>
            <div className='text-sm'>₦{(w.amount_cents/100).toFixed(2)} — {w.status}</div>
            {w.status==='PENDING' && <div className='flex gap-2'>
              <button onClick={()=>reviewWithdrawal(w.id,'APPROVE')} className='px-2 py-1 rounded bg-emerald-600'>Approve</button>
              <button onClick={()=>reviewWithdrawal(w.id,'REJECT')} className='px-2 py-1 rounded bg-red-600'>Reject</button>
            </div>}
          </div>))}
        </div>
      </div>

      <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3'>
        <h3 className='font-semibold mb-2'>Risk Flags</h3>
        <button onClick={loadRisk} className='mb-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700'>Refresh</button>
        <div className='space-y-2 max-h-64 overflow-auto'>
          {risk.map(r=>(<div key={r.id} className='p-2 rounded bg-gray-800 text-sm'>
            <div className='text-xs'>{r.id}</div>
            <div className='opacity-80'>{r.ftype}</div>
            <pre className='text-[10px] opacity-70 whitespace-pre-wrap'>{JSON.stringify(r.details)}</pre>
          </div>))}
        </div>
      </div>
    </div>

    <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3 space-y-2'>
      <h3 className='font-semibold'>Tournaments</h3>
      <div className='flex flex-wrap gap-2 items-center'>
        <input value={tname} onChange={e=>setTname(e.target.value)} className='px-2 py-1 rounded text-black' placeholder='Name'/>
        <select value={ttype} onChange={e=>setTtype(e.target.value)} className='px-2 py-1 rounded text-black'>
          <option>KNOCKOUT</option><option>SWISS</option>
        </select>
        <label>Buy-in ₦ <input type='number' value={buyin} onChange={e=>setBuyin(e.target.value)} className='px-2 py-1 rounded text-black w-24 ml-2'/></label>
        <button onClick={createTournament} className='px-3 py-1 rounded bg-indigo-600'>Create</button>
        <div className='text-sm opacity-70'>ID: {tid||'—'}</div>
      </div>
      <div className='flex flex-wrap gap-2 items-center'>
        <input value={enrollUser} onChange={e=>setEnrollUser(e.target.value)} className='px-2 py-1 rounded text-black w-[320px]' placeholder='user_id to enroll'/>
        <button onClick={enroll} className='px-3 py-1 rounded bg-slate-600'>Enroll</button>
        <button onClick={pairSwiss} className='px-3 py-1 rounded bg-emerald-600'>Pair Swiss</button>
        <button onClick={pairKO} className='px-3 py-1 rounded bg-purple-600'>Pair Knockout</button>
      </div>
    </div>
  </div>
}
