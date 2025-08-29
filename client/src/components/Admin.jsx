// client/src/components/Admin.jsx
import React,{useState,useEffect} from 'react';
import { api } from '../api';

export default function Admin({ token, adminKey }){
  // If somehow rendered without a key, show nothing
  if (!adminKey) return <div className="text-sm opacity-70">Admin key required.</div>;

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

  // attach x-admin-key to every call
  function withAdmin(){
    const inst = api(token);
    inst.defaults.headers['x-admin-key'] = adminKey;
    return inst;
  }

  async function loadConfig(){
    try{
      const r = await withAdmin().get('/api/admin/config');
      setCfg(r.data);
      setRake(r.data.rake_percent);
      setFeatures(r.data.features||{});
    }catch(e){
      alert('Admin auth failed');
    }
  }
  async function updateConfig(){
    try{
      await withAdmin().post('/api/admin/config', { rake_percent: Number(rake), features });
      await loadConfig();
    }catch(e){ alert('Update failed') }
  }
  async function loadDisputes(){ const r=await withAdmin().get('/api/admin/disputes'); setDisputes(r.data) }
  async function loadWithdrawals(){ const r=await withAdmin().get('/api/admin/withdrawals'); setWithdrawals(r.data) }
  async function loadRisk(){ const r=await withAdmin().get('/api/admin/risk-flags'); setRisk(r.data) }
  async function reviewWithdrawal(id, decision){
    await withAdmin().post(`/api/withdrawals/${id}/review`, { decision, reviewer: 'admin-ui' });
    await loadWithdrawals();
  }

  async function createTournament(){
    const r=await withAdmin().post('/api/admin/tournaments', { name:tname, ttype, buy_in_cents: Math.floor(buyin*100) });
    setTid(r.data.id);
  }
  async function enroll(){ await withAdmin().post(`/api/admin/tournaments/${tid}/enroll`, { user_id: enrollUser }); alert('Enrolled'); }
  async function pairSwiss(){ const r=await withAdmin().post(`/api/admin/tournaments/${tid}/pair`, { mode:'SWISS', game:'chess' }); alert('Created matches: '+r.data.created.length) }
  async function pairKO(){ const r=await withAdmin().post(`/api/admin/tournaments/${tid}/pair`, { mode:'KO', game:'chess' }); alert('Created matches: '+r.data.created.length) }

  useEffect(()=>{ loadConfig(); /* load initial admin data if you want */ },[]);

  return <div className='space-y-4'>
    {/* Config */}
    <div className='rounded-2xl bg-gray-900/40 border border-gray-800 p-4 space-y-3 shadow-lg'>
      <div className='flex items-center justify-between'>
        <h3 className='font-semibold'>Site Config</h3>
        <button onClick={loadConfig} className='px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700'>Refresh</button>
      </div>
      {cfg ? (
        <div className='flex flex-wrap gap-3 items-center'>
          <label className="flex items-center gap-2">Rake %
            <input type='number' value={rake} onChange={e=>setRake(e.target.value)} className='px-2 py-1 rounded text-black w-20'/>
          </label>
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
          <button onClick={updateConfig} className='px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700'>Update</button>
        </div>
      ) : (
        <div className='text-sm opacity-80'>Config not loaded yet.</div>
      )}
    </div>

    {/* Disputes */}
    <div className='grid md:grid-cols-3 gap-4'>
      <div className='rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg'>
        <div className='flex items-center justify-between mb-2'>
          <h3 className='font-semibold'>Disputes</h3>
          <button onClick={loadDisputes} className='px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700'>Refresh</button>
        </div>
        <div className='space-y-2 max-h-64 overflow-auto'>
          {disputes.map(d=>(
            <div key={d.id} className='p-2 rounded bg-gray-800'>
              <div className='text-xs'>{d.id}</div>
              <div className='text-sm'>{d.reason}</div>
              <div className='text-xs opacity-70'>{d.status}</div>
            </div>
          ))}
          {!disputes.length && <div className="text-sm opacity-70">No disputes.</div>}
        </div>
      </div>

      {/* Withdrawals */}
      <div className='rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg'>
        <div className='flex items-center justify-between mb-2'>
          <h3 className='font-semibold'>Withdrawals</h3>
          <button onClick={loadWithdrawals} className='px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700'>Refresh</button>
        </div>
        <div className='space-y-2 max-h-64 overflow-auto'>
          {withdrawals.map(w=>(
            <div key={w.id} className='p-2 rounded bg-gray-800 space-y-1'>
              <div className='text-xs'>{w.id}</div>
              <div className='text-sm'>₦{(w.amount_cents/100).toFixed(2)} — {w.status}</div>
              {w.status==='PENDING' && <div className='flex gap-2'>
                <button onClick={()=>reviewWithdrawal(w.id,'APPROVE')} className='px-2 py-1 rounded bg-emerald-600'>Approve</button>
                <button onClick={()=>reviewWithdrawal(w.id,'REJECT')} className='px-2 py-1 rounded bg-red-600'>Reject</button>
              </div>}
            </div>
          ))}
          {!withdrawals.length && <div className="text-sm opacity-70">No withdrawals.</div>}
        </div>
      </div>

      {/* Risk */}
      <div className='rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg'>
        <div className='flex items-center justify-between mb-2'>
          <h3 className='font-semibold'>Risk Flags</h3>
          <button onClick={loadRisk} className='px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700'>Refresh</button>
        </div>
        <div className='space-y-2 max-h-64 overflow-auto'>
          {risk.map(r=>(
            <div key={r.id} className='p-2 rounded bg-gray-800 text-sm'>
              <div className='text-xs'>{r.id}</div>
              <div className='opacity-80'>{r.ftype}</div>
              <pre className='text-[10px] opacity-70 whitespace-pre-wrap'>{JSON.stringify(r.details)}</pre>
            </div>
          ))}
          {!risk.length && <div className="text-sm opacity-70">No risk flags.</div>}
        </div>
      </div>
    </div>

    {/* Tournaments */}
    <div className='rounded-2xl bg-gray-900/40 border border-gray-800 p-4 space-y-3 shadow-lg'>
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
