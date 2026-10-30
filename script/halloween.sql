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

-- Which bar each player is currently at. The scoreboard uses it to know a bar
-- is over the moment someone taps "Next bar", even before they tick anything.
alter table public.halloween_players
  add column if not exists bar integer not null default 1 check (bar between 1 and 12);

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
drop policy if exists "hw players update" on public.halloween_players;
drop policy if exists "hw marks read"     on public.halloween_marks;
drop policy if exists "hw marks insert"   on public.halloween_marks;
drop policy if exists "hw marks delete"   on public.halloween_marks;

create policy "hw players read"   on public.halloween_players for select using (true);
create policy "hw players insert" on public.halloween_players for insert with check (true);
create policy "hw players update" on public.halloween_players for update using (true) with check (true);
create policy "hw marks read"     on public.halloween_marks   for select using (true);
create policy "hw marks insert"   on public.halloween_marks   for insert with check (true);
create policy "hw marks delete"   on public.halloween_marks   for delete using (true);

-- Reset button. Players have no delete policy, so the only way to wipe a game
-- from the page is this function, which checks a password server-side.
-- EDIT 'CHANGE_ME' to your password before running, and don't commit the real one.
create or replace function public.halloween_reset(pw text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if pw is distinct from 'CHANGE_ME' then
    raise exception 'wrong password';
  end if;
  delete from public.halloween_marks   where room = 'halloween-2026';
  delete from public.halloween_players where room = 'halloween-2026';
end;
$$;

revoke all on function public.halloween_reset(text) from public;
grant execute on function public.halloween_reset(text) to anon, authenticated;

-- Reset a room after the night (SQL Editor runs as owner):
--   delete from public.halloween_marks   where room = 'halloween-2026';
--   delete from public.halloween_players where room = 'halloween-2026';
