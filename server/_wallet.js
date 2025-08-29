import axios from 'axios';
import { v4 as uuid } from 'uuid';
import { q, withTx, postTx, getBalanceCents } from './db.js';

export function registerWalletRoutes(app){
  // wallet balances: include demo_balance
  app.get('/api/wallet', async (req,res)=>{
    try{
      const token=(req.headers.authorization||'').replace('Bearer ',''); if(!token) return res.status(401).json({error:'Unauthorized'});
      const u=(await q('select id, username from users where id=$1',[token]))[0]; if(!u) return res.status(401).json({error:'Unauthorized'});
      const realCents = await getBalanceCents(u.id);
      const demo = (await q(
        "select coalesce(sum(amount_cents),0) as c from ledger_entries where account_type='USER_DEMO' and user_id=$1",
        [u.id]
      ))[0]?.c || 0;
      const house=(await q("select coalesce(sum(case when account_type='HOUSE_CASH' then amount_cents else 0 end),0) as c from ledger_entries",[]))[0]?.c||0;
      res.json({ balance:realCents/100, demo_balance: demo/100, house:house/100 });
    }catch(e){
      res.status(500).json({ error:'Failed to load wallet' });
    }
  });

  // deposit initiate: demo if no email; else Paystack initialize
  app.post('/api/wallet/deposit/initiate', async (req,res)=>{
    try{
      const token=(req.headers.authorization||'').replace('Bearer ',''); if(!token) return res.status(401).json({error:'Unauthorized'});
      const u=(await q('select id, username from users where id=$1',[token]))[0]; if(!u) return res.status(401).json({error:'Unauthorized'});
      const { amount, email } = req.body||{};
      const cents = Math.floor(Number(amount||0)*100);
      if (cents<=0) return res.status(400).json({ error:'Invalid amount' });

      if (!email){
        await withTx(async (c)=>{
          await postTx(c, 'DEMO_TOPUP', null, [
            { account_type:'USER_DEMO', user_id:u.id, amount_cents:cents }
          ]);
        });
        const demoBal = (await q(
          "select coalesce(sum(amount_cents),0) as c from ledger_entries where account_type='USER_DEMO' and user_id=$1",
          [u.id]
        ))[0]?.c || 0;
        return res.json({ demo:true, credited: cents/100, demo_balance: demoBal/100 });
      }

      // Paystack initialize for real funds
      const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET||'';
      if (!PAYSTACK_SECRET) return res.status(400).json({ error:'Paystack not configured' });
      const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';

      const initResp = await axios.post('https://api.paystack.co/transaction/initialize', {
        email,
        amount: cents,
        currency: 'NGN',
        metadata: { user_id: u.id }
      }, {
        headers: { Authorization: 'Bearer '+PAYSTACK_SECRET }
      });

      return res.json({
        authorization_url: initResp.data?.data?.authorization_url,
        reference: initResp.data?.data?.reference
      });
    }catch(e){
      const msg = e.response?.data?.message || e.message || 'Failed';
      res.status(400).json({ error: msg });
    }
  });

  // payout recipient create/update (for withdrawal destination)
  app.post('/api/payouts/recipient', async (req,res)=>{
    try{
      const token=(req.headers.authorization||'').replace('Bearer ',''); if(!token) return res.status(401).json({error:'Unauthorized'});
      const u=(await q('select id, username from users where id=$1',[token]))[0]; if(!u) return res.status(401).json({error:'Unauthorized'});
      const { bank_code, account_number, account_name } = req.body||{};
      if (!bank_code || !account_number) return res.status(400).json({ error:'bank_code and account_number required' });

      const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET||'';
      if (!PAYSTACK_SECRET) return res.status(400).json({ error:'Paystack not configured' });

      // Create transfer recipient at Paystack
      const r = await axios.post('https://api.paystack.co/transferrecipient', {
        type: 'nuban',
        name: account_name || u.username,
        account_number,
        bank_code,
        currency: 'NGN'
      }, { headers: { Authorization: 'Bearer '+PAYSTACK_SECRET } });

      const code = r.data?.data?.recipient_code;
      const id = uuid();
      // cool-off window (e.g., 12 hours)
      await q(`insert into payout_destinations(id,user_id,provider,recipient_code,display,status,usable_after)
               values ($1,$2,'paystack',$3,$4,'PENDING', now() + interval '12 hours')
               on conflict (user_id, recipient_code) do update set display=$4, status='PENDING', usable_after=now() + interval '12 hours'`,
               [id, u.id, code, `${bank_code}-${account_number}`]);
      res.json({ ok:true, recipient_code: code });
    }catch(e){
      const msg = e.response?.data?.message || e.message || 'Failed';
      res.status(400).json({ error: msg });
    }
  });
}
