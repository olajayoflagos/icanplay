-- Withdrawal PIN + payout allowlist + attempts

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS withdraw_pin_hash text;

create table if not exists payout_destinations(
  id uuid primary key,
  user_id uuid references users(id),
  provider text not null,           -- 'paystack'
  recipient_code text not null,
  display text,
  status text not null default 'PENDING',   -- PENDING | ACTIVE | BLOCKED
  usable_after timestamptz,
  created_at timestamptz default now()
);

create table if not exists withdraw_attempts(
  id uuid primary key,
  user_id uuid references users(id),
  ok boolean,
  created_at timestamptz default now()
);
