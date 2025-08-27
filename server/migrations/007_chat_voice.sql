-- Chat + Spectator + Voice flags

alter table matches
  add column if not exists allow_spectators boolean not null default true,
  add column if not exists allow_spectator_chat boolean not null default true,
  add column if not exists allow_voice boolean not null default true;

create table if not exists match_chat_messages(
  id uuid primary key,
  match_id uuid references matches(id),
  user_id uuid references users(id),
  role text not null,           -- 'PLAYER_A' | 'PLAYER_B' | 'SPECTATOR'
  kind text not null,           -- 'text' | 'emoji'
  text text,
  emoji text,
  created_at timestamptz default now()
);
create index if not exists idx_chat_match_time on match_chat_messages(match_id, created_at desc);
