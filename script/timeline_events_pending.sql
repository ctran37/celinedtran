-- ============================================================
--  "Pending" events for the /juan page — plans that aren't
--  confirmed yet. They show up dashed instead of solid.
--
--  Run once: Supabase dashboard -> SQL Editor -> paste -> Run.
--  Safe to re-run.
-- ============================================================

alter table public.timeline_events
  add column if not exists pending boolean not null default false;

-- Existing events keep pending = false, i.e. they stay confirmed.

-- Check it took:
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'timeline_events'
order by ordinal_position;