I Can Play Server v4.3 patches
----------------------------------

Files included:
- server/index.js            (drop-in replacement; adds pause/resume + registers wallet/payout routes)
- server/_wallet.js          (wallet routes: demo vs real deposit, balances, payout recipient)
- server/migrations/010_payout_recipient.sql (creates payout_destinations table if missing)

How to apply:
1) Backup your current server/index.js
2) Replace it with the provided index.js
3) Add the provided _wallet.js beside it
4) Place 010_payout_recipient.sql in your migrations folder (or append to your migration runner)
5) Run migrations:  npm run migrate
6) Restart the server

ENV needed:
- PAYSTACK_SECRET=sk_live_or_test_xxx
- PUBLIC_BASE_URL=https://your-server-url
- CLIENT_ORIGIN=https://your-client-url
- ADMIN_KEY=... (for admin UI)

Notes:
- Deposits without email go to USER_DEMO.
- Deposits with email go through Paystack /transaction/initialize (real funds).
- Arena pause/resume is enforced: max 5 pauses per player; engines ignore moves when paused.
