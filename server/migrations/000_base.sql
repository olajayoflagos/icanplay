-- 000_base.sql
create extension if not exists "uuid-ossp";

create table if not exists users(
  id uuid primary key,
  username text unique not null,
  created_at timestamptz default now()
);

create table if not exists user_devices(
  id uuid primary key,
  user_id uuid references users(id),
  device_id text,
  last_ip text,
  last_seen timestamptz default now()
);

create table if not exists ledger_entries(
  id bigserial primary key,
  account_type text not null,
  user_id uuid,
  amount_cents bigint not null,
  ref text,
  etype text,
  created_at timestamptz default now()
);

create table if not exists matches(
  id uuid primary key,
  room text not null,
  game text not null,
  demo boolean not null default true,
  stake_cents bigint not null default 0,
  escrow_cents bigint not null default 0,
  rake_cents bigint not null default 0,
  payout_cents bigint not null default 0,
  status text not null default 'OPEN',
  allow_spectators boolean default true,
  allow_voice boolean default true,
  creator_user_id uuid references users(id),
  taker_user_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists match_states(
  id bigserial primary key,
  match_id uuid references matches(id),
  state jsonb not null,
  created_at timestamptz default now()
);

create table if not exists match_chat_messages(
  id uuid primary key,
  match_id uuid references matches(id),
  user_id uuid references users(id),
  role text,
  kind text,
  text text,
  emoji text,
  created_at timestamptz default now()
);

create table if not exists payout_destinations(
  id uuid primary key,
  user_id uuid references users(id),
  provider text not null,
  recipient_code text not null,
  display text,
  status text not null default 'PENDING',
  usable_after timestamptz,
  created_at timestamptz default now()
);

create table if not exists config(
  id serial primary key,
  rake_percent int not null default 10,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists withdrawals(
  id uuid primary key,
  user_id uuid references users(id),
  amount_cents bigint not null,
  status text not null default 'PENDING',
  created_at timestamptz default now()
);
