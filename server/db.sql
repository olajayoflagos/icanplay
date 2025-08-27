
create table if not exists users(id uuid primary key, username text unique not null, created_at timestamptz default now());
create table if not exists user_payouts(user_id uuid primary key references users(id), processor text, recipient_code text, meta jsonb);
create table if not exists user_devices(id uuid primary key, user_id uuid references users(id), device_id text not null, last_ip text, last_seen timestamptz default now());
create table if not exists user_events(id bigserial primary key, user_id uuid references users(id), etype text not null, meta jsonb, created_at timestamptz default now());
create table if not exists app_config(key text primary key, value jsonb not null, updated_at timestamptz default now());
insert into app_config(key,value) values ('rake_percent','10') on conflict do nothing;
insert into app_config(key,value) values ('features','{}') on conflict do nothing;
create table if not exists idempotency_keys(id text primary key, method text not null, path text not null, user_id uuid, status_code int, response jsonb, created_at timestamptz default now());
create table if not exists matches(id uuid primary key, room text not null, game text not null, demo boolean not null default false, stake_cents int not null default 0, status text not null, creator_user_id uuid references users(id), taker_user_id uuid references users(id), escrow_cents int not null default 0, rake_cents int not null default 0, payout_cents int not null default 0, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists match_states(id bigserial primary key, match_id uuid references matches(id), state jsonb not null, created_at timestamptz default now());
create table if not exists ledger_transactions(id uuid primary key, ttype text not null, ref text, idempotency_key text unique, created_at timestamptz default now());
create table if not exists ledger_entries(id bigserial primary key, tx_id uuid references ledger_transactions(id) on delete cascade, account_type text not null, user_id uuid null references users(id), amount_cents int not null);
create index if not exists idx_ledger_entries_tx on ledger_entries(tx_id);
create or replace function ensure_tx_balanced() returns trigger as $$
declare s integer; begin select coalesce(sum(amount_cents),0) into s from ledger_entries where tx_id = coalesce(NEW.tx_id, OLD.tx_id); if s <> 0 then raise exception 'Ledger tx % not balanced: sum=%', coalesce(NEW.tx_id, OLD.tx_id), s; end if; return null; end; $$ language plpgsql;
drop trigger if exists trg_ledger_tx_balanced on ledger_entries;
create constraint trigger trg_ledger_tx_balanced after insert or update or delete on ledger_entries deferrable initially deferred for each row execute procedure ensure_tx_balanced();
create or replace view user_balances as select u.id as user_id, coalesce(sum(case when le.account_type='USER_CASH' then le.amount_cents else 0 end),0) as balance_cents from users u left join ledger_entries le on le.user_id=u.id group by u.id;
create table if not exists disputes(id uuid primary key, match_id uuid references matches(id), opened_by uuid references users(id), reason text, status text not null default 'OPEN', resolution text, created_at timestamptz default now(), updated_at timestamptz default now(), evidence_url text);
create table if not exists risk_flags(id uuid primary key, user_id uuid references users(id), ftype text not null, details jsonb, created_at timestamptz default now());
create table if not exists withdrawals(id uuid primary key, user_id uuid references users(id), amount_cents int not null, status text not null default 'PENDING', created_at timestamptz default now(), reviewed_by text, reviewed_at timestamptz, processor_ref text);
create table if not exists tournaments(id uuid primary key, ttype text not null, status text not null default 'PENDING', name text, buy_in_cents int not null default 0, rake_percent int not null default 10, round int not null default 0, created_at timestamptz default now());
create table if not exists tournament_players(id uuid primary key, tournament_id uuid references tournaments(id), user_id uuid references users(id), score int not null default 0, broke int not null default 0, unique(tournament_id,user_id));
create table if not exists tournament_matches(id uuid primary key, tournament_id uuid references tournaments(id), round int not null, match_id uuid references matches(id), a_user_id uuid references users(id), b_user_id uuid references users(id), result text);
