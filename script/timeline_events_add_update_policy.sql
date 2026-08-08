-- ============================================================
--  Adds the missing UPDATE policy so events can be EDITED
--  (the original setup only allowed read / insert / delete).
--
--  Run this once: Supabase dashboard → SQL Editor → paste → Run.
--  Safe to re-run. Don't re-run timeline_events.sql instead —
--  that file also inserts the seed rows, so you'd get duplicates.
-- ============================================================

drop policy if exists "timeline public update" on public.timeline_events;

create policy "timeline public update"
  on public.timeline_events
  for update
  using (true)          -- which existing rows may be edited
  with check (true);    -- what the edited row is allowed to look like

-- Verify: should list read / insert / update / delete.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'timeline_events'
order by cmd;