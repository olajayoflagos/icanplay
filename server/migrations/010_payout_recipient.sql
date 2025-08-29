-- 010_payout_recipient.sql
-- Safe (re)create structures used by payout recipient + demo balance

CREATE TABLE IF NOT EXISTS payout_destinations(
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  provider text NOT NULL,
  recipient_code text NOT NULL,
  display text,
  status text NOT NULL DEFAULT 'PENDING',
  usable_after timestamptz,
  created_at timestamptz DEFAULT now()
);

-- USER_DEMO uses ledger_entries.account_type='USER_DEMO' (no enum change needed).
