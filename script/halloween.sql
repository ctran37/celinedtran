-- ============================================================
--  Halloween bar-crawl bingo (/halloween).
--
--  Honor system, no logins: anyone with the publishable key can read,
--  add and remove rows. That's fine for a one-night game among friends;
--  don't put anything here you'd mind the world reading.
--
--  Boards are NOT stored. Each board is derived from (room, player_id),
--  so only the squares a player has ticked live here.
--
--  Run once: Supabase dashboard -> SQL Editor -> paste -> Run.
--  Safe to re-run.
-- ============================================================

create table if not exists public.halloween_players (
  room       text not null,
  player_id  uuid not null,
  name       text not null,
  created_at timestamptz not null default now(),
  primary key (room, player_id),
  constraint hw_players_room_len check (char_length(room) between 1 and 32),
  constraint hw_players_name_len check (char_length(name) between 1 and 24)
);

create table if not exists public.halloween_marks (
  room       text not null,
  player_id  uuid not null,
  square     integer not null,                       -- index into the square pool
  bar        integer not null check (bar between 1 and 12),
  created_at timestamptz not null default now(),
  primary key (room, player_id, square),
  constraint hw_marks_room_len check (char_length(room) between 1 and 32)
);

create index if not exists halloween_marks_room_idx on public.halloween_marks (room);

alter table public.halloween_players enable row level security;
alter table public.halloween_marks   enable row level security;

drop policy if exists "hw players read"   on public.halloween_players;
drop policy if exists "hw players insert" on public.halloween_players;
drop policy if exists "hw marks read"     on public.halloween_marks;
drop policy if exists "hw marks insert"   on public.halloween_marks;
drop policy if exists "hw marks delete"   on public.halloween_marks;

create policy "hw players read"   on public.halloween_players for select using (true);
create policy "hw players insert" on public.halloween_players for insert with check (true);
create policy "hw marks read"     on public.halloween_marks   for select using (true);
create policy "hw marks insert"   on public.halloween_marks   for insert with check (true);
create policy "hw marks delete"   on public.halloween_marks   for delete using (true);

-- Reset a room after the night (SQL Editor runs as owner):
--   delete from public.halloween_marks   where room = 'halloween-2026';
--   delete from public.halloween_players where room = 'halloween-2026';
