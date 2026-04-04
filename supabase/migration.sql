-- Run this in Supabase SQL Editor to create the game_tables table

create table if not exists game_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  is_private boolean default false,
  status text default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  max_players int default 7,
  min_bet int default 10,
  max_bet int default 500,
  deck_count int default 6,
  game_state jsonb default '{}'::jsonb,
  deck_data text default '',
  created_by text not null,
  creator_id text not null,
  player_count int default 0,
  created_at timestamptz default now()
);

-- Index for fast lobby queries
create index if not exists idx_game_tables_status on game_tables (status)
  where status = 'waiting';

create index if not exists idx_game_tables_invite_code on game_tables (invite_code);

-- RLS: allow all operations via anon key (game auth is handled at the app level)
alter table game_tables enable row level security;

create policy "Allow all reads" on game_tables
  for select using (true);

create policy "Allow all inserts" on game_tables
  for insert with check (true);

create policy "Allow all updates" on game_tables
  for update using (true);

create policy "Allow all deletes" on game_tables
  for delete using (true);
