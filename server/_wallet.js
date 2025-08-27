import 'dotenv/config';
import crypto from 'crypto';
import axios from 'axios';
import { q, withTx, postTx, getBalanceCents } from './db.js';

// --- WALLET: deposit (demo or Paystack), webhook verification ---
app.post('/api/wallet/deposit/initiate', async (req,res)=>{
  const u = await auth(req); if(!u) return res.status(401).json({error:'Unauthorized'});
  const { amount, email, idempotency } = req.body||{};
  const kobo = Math.max(100, Math.floor(Number(amount||0)*100));

  // If no Paystack key, credit demo immediately
  if (!process.env.PAYSTACK_SECRET){
    await withTx(async (c)=>{
      await postTx(c,'DEPOSIT','DEMO',[
        {account_type:'USER_CASH',user_id:u.id,amount_cents:kobo},
        {account_type:'PROCESSOR_CLEARING',user_id:null,amount_cents:-kobo}
      ], idempotency||null);
    });
    const bal = await getBalanceCents(u.id);
    return res.json({ demo:true, credited:kobo/100, balance:bal/100 });
  }

  // Real Paystack initialize
  try{
    const init = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        amount:kobo,
        email: email || `${u.username}@icanplay.local`,
        callback_url:`${process.env.PUBLIC_BASE_URL||('http://localhost:'+PORT)}/api/wallet/deposit/callback`,
        metadata:{ user_id:u.id }
      },
      { headers:{ Authorization:`Bearer ${process.env.PAYSTACK_SECRET}` } }
    );
    res.json(init.data.data);
  }catch(e){
    console.error(e.response?.data||e.message);
    res.status(500).json({error:'Paystack init failed'});
  }
});

app.post('/api/webhooks/paystack', async (req,res)=>{
  // HMAC + optional IP allowlist
  if (!process.env.PAYSTACK_SECRET) return res.send('ok-demo');

  const signature = req.headers['x-paystack-signature']||'';
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET)
                     .update(req.rawBody).digest('hex');
  if (hash !== signature) return res.status(401).send('invalid signature');

  const allow=(process.env.PAYSTACK_IP_WHITELIST||'').split(',').map(s=>s.trim()).filter(Boolean);
  if (allow.length){
    const ip=req.headers['x-forwarded-for']?.split(',')[0]?.trim()||req.socket.remoteAddress;
    if(!allow.includes(ip)) return res.status(401).send('ip not allowed');
  }

  const ev = req.body;
  if (ev?.event === 'charge.success'){
    const user_id = ev.data?.metadata?.user_id;
    const kobo = ev.data?.amount||0;
    const ref = ev.data?.reference;
    if (user_id && kobo>0){
      await withTx(async (c)=>{
        await postTx(c,'DEPOSIT',ref,[
          {account_type:'USER_CASH',user_id:user_id,amount_cents:kobo},
          {account_type:'PROCESSOR_CLEARING',user_id:null,amount_cents:-kobo}
        ], `paystack:${ref}`);
      });
    }
  }
  res.send('ok');
});
