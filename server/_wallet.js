// server/_wallet.js
import 'dotenv/config';
import crypto from 'crypto';
import axios from 'axios';
import bcrypt from 'bcryptjs';

/**
 * Register wallet routes on the provided Express app.
 * Expects helpers from index.js (auth, q, withTx, postTx, getBalanceCents, webauthnOk).
 */
export default function registerWallet(app, { auth, q, withTx, postTx, getBalanceCents, webauthnOk, PORT }) {

  // ---- Deposit (demo or Paystack) ----
  app.post('/api/wallet/deposit/initiate', async (req, res) => {
    const u = await auth(req); if (!u) return res.status(401).json({ error: 'Unauthorized' });
    const { amount, email, idempotency } = req.body || {};
    const kobo = Math.max(100, Math.floor(Number(amount || 0) * 100));

    // Demo mode (no PAYSTACK_SECRET): immediate credit
    if (!process.env.PAYSTACK_SECRET) {
      await withTx(async (c) => {
        await postTx(c, 'DEPOSIT', 'DEMO', [
          { account_type: 'USER_CASH', user_id: u.id, amount_cents: kobo },
          { account_type: 'PROCESSOR_CLEARING', user_id: null, amount_cents: -kobo }
        ], idempotency || null);
      });
      const bal = await getBalanceCents(u.id);
      return res.json({ demo: true, credited: kobo / 100, balance: bal / 100 });
    }

    // Real Paystack flow
    try {
      const init = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          amount: kobo,
          email: email || `${u.username}@icanplay.local`,
          callback_url: `${process.env.PUBLIC_BASE_URL || ('http://localhost:' + PORT)}/api/wallet/deposit/callback`,
          metadata: { user_id: u.id }
        },
        { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` } }
      );
      res.json(init.data.data);
    } catch (e) {
      console.error(e.response?.data || e.message);
      res.status(500).json({ error: 'Paystack init failed' });
    }
  });

  // ---- Paystack webhook (deposit) ----
  app.post('/api/webhooks/paystack', async (req, res) => {
    if (!process.env.PAYSTACK_SECRET) return res.send('ok-demo');

    // Optional IP allowlist
    const allow = (process.env.PAYSTACK_IP_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
    if (allow.length) {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
      if (!allow.includes(ip)) return res.status(401).send('ip not allowed');
    }

    // HMAC signature
    const signature = req.headers['x-paystack-signature'] || '';
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET)
      .update(req.rawBody).digest('hex');
    if (hash !== signature) return res.status(401).send('invalid signature');

    const ev = req.body;
    if (ev?.event === 'charge.success') {
      const user_id = ev.data?.metadata?.user_id;
      const kobo = ev.data?.amount || 0;
      const ref = ev.data?.reference;
      if (user_id && kobo > 0) {
        await withTx(async (c) => {
          await postTx(c, 'DEPOSIT', ref, [
            { account_type: 'USER_CASH', user_id, amount_cents: kobo },
            { account_type: 'PROCESSOR_CLEARING', user_id: null, amount_cents: -kobo }
          ], `paystack:${ref}`);
        });
      }
    }
    res.send('ok');
  });

  app.get('/api/wallet/deposit/callback', (req, res) => {
    res.send('Deposit processed. You can close this tab.');
  });

  // ---- PIN set / change ----
  app.post('/api/security/pin/set', async (req, res) => {
    const u = await auth(req); if (!u) return res.sendStatus(401);
    const { pin } = req.body || {};
    if (!/^\d{6}$/.test(String(pin || ''))) return res.status(400).json({ error: 'PIN must be 6 digits' });
    const hash = await bcrypt.hash(String(pin), 10);
    await q('update users set withdraw_pin_hash=$1 where id=$2', [hash, u.id]);
    res.json({ ok: true });
  });

  // ---- Add/Change payout destination (Paystack recipient) ----
  app.post('/api/payouts/recipient', async (req, res) => {
    const u = await auth(req); if (!u) return res.sendStatus(401);
    const { bank_code, account_number, account_name } = req.body || {};
    if (!process.env.PAYSTACK_SECRET) {
      // demo: fake recipient
      const id = crypto.randomUUID();
      await q(`insert into payout_destinations(id,user_id,provider,recipient_code,display,status,usable_after)
               values ($1,$2,'paystack',$3,$4,'PENDING', now() + interval '72 hours')`,
        [id, u.id, 'demo_recipient', `${bank_code || '000'}-${account_number || '0000000000'}`]);
      return res.json({ id, status: 'PENDING', usable_after_hours: 72 });
    }
    try {
      // Create Recipient
      const pr = await axios.post('https://api.paystack.co/transferrecipient', {
        type: 'nuban', name: account_name || u.username, account_number, bank_code, currency: 'NGN'
      }, { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` } });
      const recipient_code = pr.data?.data?.recipient_code;
      const id = crypto.randomUUID();
      await q(`insert into payout_destinations(id,user_id,provider,recipient_code,display,status,usable_after)
               values ($1,$2,'paystack',$3,$4,'PENDING', now() + interval '72 hours')`,
        [id, u.id, recipient_code, `${account_name || ''} ${bank_code}-${account_number}`]);
      res.json({ id, recipient_code, status: 'PENDING' });
    } catch (e) {
      console.error(e.response?.data || e.message);
      res.status(500).json({ error: 'recipient-create-failed' });
    }
  });

  // ---- Withdraw (requires recent WebAuthn + PIN) ----
  app.post('/api/wallet/withdraw', async (req, res) => {
    const u = await auth(req); if (!u) return res.sendStatus(401);
    const { pin, amount, payout_id, idempotency } = req.body || {};
    const cents = Math.max(100, Math.floor(Number(amount || 0) * 100));

    // 1) recent WebAuthn assertion
    if (!webauthnOk(u.id)) return res.status(401).json({ error: 'biometric-required' });

    // 2) Check PIN
    const row = (await q('select withdraw_pin_hash from users where id=$1', [u.id]))[0];
    if (!row?.withdraw_pin_hash) return res.status(403).json({ error: 'pin-not-set' });
    const okPin = await bcrypt.compare(String(pin || ''), row.withdraw_pin_hash);
    if (!okPin) {
      await q('insert into withdraw_attempts(id,user_id,ok) values ($1,$2,false)', [crypto.randomUUID(), u.id]);
      return res.status(401).json({ error: 'pin-invalid' });
    }

    // 3) Payout destination usability
    const pd = (await q('select * from payout_destinations where id=$1 and user_id=$2', [payout_id, u.id]))[0];
    if (!pd) return res.status(404).json({ error: 'payout-not-found' });
    if (pd.status !== 'ACTIVE' || !(pd.usable_after && new Date(pd.usable_after).getTime() <= Date.now()))
      return res.status(403).json({ error: 'payout-not-usable' });

    // 4) Balance & limits
    const bal = await getBalanceCents(u.id);
    if (cents > bal) return res.status(400).json({ error: 'insufficient-funds' });

    // Example simple daily cap (₦50k) — adjust to config if needed
    const day = (await q('select withdraw_day_cents, withdraw_day_at from users where id=$1', [u.id]))[0] || {};
    const today = new Date().toISOString().slice(0, 10);
    const used = (day.withdraw_day_at === today ? (day.withdraw_day_cents || 0) : 0);
    if (used + cents > 5000000) return res.status(403).json({ error: 'daily-cap' }); // 50,000 NGN

    // 5) Book a PENDING withdrawal (manual review flow)
    await withTx(async (c) => {
      // Ledger: move funds to PENDING_WITHDRAWALS
      await postTx(c, 'WITHDRAW_REQUEST', `wd:${crypto.randomUUID()}`, [
        { account_type: 'USER_CASH', user_id: u.id, amount_cents: -cents },
        { account_type: 'PENDING_WITHDRAWALS', user_id: null, amount_cents: cents }
      ], idempotency || null);

      // Update daily tally
      if (day.withdraw_day_at === today) {
        await c.query('update users set withdraw_day_cents=$1 where id=$2', [used + cents, u.id]);
      } else {
        await c.query('update users set withdraw_day_cents=$1, withdraw_day_at=$2 where id=$3', [cents, today, u.id]);
      }

      // In a real flow: enqueue payout job (Paystack transfer) for admin approval
    });

    res.json({ queued: true });
  });
}
