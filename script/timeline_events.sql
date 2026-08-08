-- ============================================================
--  Timeline events for the /juan page.
--  Run this once in the Supabase dashboard → SQL Editor.
-- ============================================================

create table if not exists public.timeline_events (
  id          uuid primary key default gen_random_uuid(),
  start_date  date not null,
  end_date    date not null,
  category    text not null default 'other',
  person      text not null default 'both',
  emoji       text default '',
  text        text not null,
  created_at  timestamptz not null default now()
);

-- If the table already existed from an earlier run, add the new column.
alter table public.timeline_events add column if not exists person text not null default 'both';

-- Enable Row Level Security and open read/write to the anon
-- (publishable) key. This site has no login, so anyone with the
-- page can add/remove events. That's fine for a private personal
-- page; if you'd rather gate writes, see the note in the chat.
alter table public.timeline_events enable row level security;

drop policy if exists "timeline public read"   on public.timeline_events;
drop policy if exists "timeline public insert" on public.timeline_events;
drop policy if exists "timeline public update" on public.timeline_events;
drop policy if exists "timeline public delete" on public.timeline_events;

create policy "timeline public read"   on public.timeline_events for select using (true);
create policy "timeline public insert" on public.timeline_events for insert with check (true);
-- update needs BOTH: `using` picks which rows may be edited, `with check`
-- validates the new values. Without this policy an edit returns "200, zero
-- rows" — it looks like it saved but changes nothing.
create policy "timeline public update" on public.timeline_events for update using (true) with check (true);
create policy "timeline public delete" on public.timeline_events for delete using (true);

-- Let realtime broadcast changes so both devices update live.
alter publication supabase_realtime add table public.timeline_events;

-- ---- seed events (edit / remove freely once loaded) ----
insert into public.timeline_events (start_date, end_date, category, person, emoji, text) values
  ('2026-08-20', '2026-08-22', 'visit',     'both', '',   'Last days before the airport'),
  ('2026-08-22', '2026-08-22', 'milestone', 'both', '✈️', 'Goodbye-for-now day'),
  ('2026-12-18', '2026-12-18', 'visit',     'both', '🤗', 'Reunited!');