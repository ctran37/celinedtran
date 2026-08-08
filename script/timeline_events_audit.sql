-- ============================================================
--  Makes the /juan calendar recoverable without adding logins.
--
--  The publishable key is baked into the deployed JavaScript, so
--  anyone who views source can write to the API. We can't prevent
--  that without auth — so instead:
--
--    1. nobody can HARD-delete an event any more (the public delete
--       policy is dropped; the app sets `deleted_at` instead), and
--    2. every insert / edit / delete is copied into an audit table
--       that the public key has NO access to whatsoever.
--
--  Net effect: a vandal can hide or rewrite events, and you can put
--  every one of them back with a single statement.
--
--  Run once: Supabase dashboard -> SQL Editor -> paste -> Run.
--  Safe to re-run.
-- ============================================================

-- ---------- 1. soft delete ----------
alter table public.timeline_events
  add column if not exists deleted_at timestamptz;

-- The app filters these out; the row itself stays put.
create index if not exists timeline_events_live_idx
  on public.timeline_events (start_date)
  where deleted_at is null;

-- ---------- 2. the audit table ----------
create table if not exists public.timeline_events_audit (
  audit_id   bigserial primary key,
  event_id   uuid,
  action     text not null,          -- INSERT | UPDATE | DELETE
  old_row    jsonb,                  -- the row BEFORE the change
  new_row    jsonb,                  -- the row AFTER  the change
  changed_at timestamptz not null default now()
);

create index if not exists timeline_events_audit_event_idx
  on public.timeline_events_audit (event_id, changed_at desc);

-- RLS on with ZERO policies = deny everything. Supabase grants the
-- anon role table privileges by default, so revoke those too: the
-- same key that can edit events cannot read, alter or truncate its
-- own paper trail.
alter table public.timeline_events_audit enable row level security;
revoke all on public.timeline_events_audit from anon, authenticated;
revoke all on sequence public.timeline_events_audit_audit_id_seq from anon, authenticated;

-- ---------- 3. the trigger that fills it ----------
-- security definer: runs as the function's owner, who is exempt from
-- the deny-all above. That's what lets the trigger write a table the
-- caller can't touch.
create or replace function public.timeline_events_audit_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.timeline_events_audit (event_id, action, old_row, new_row)
    values (new.id, 'INSERT', null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.timeline_events_audit (event_id, action, old_row, new_row)
    values (new.id, 'UPDATE', to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.timeline_events_audit (event_id, action, old_row, new_row)
    values (old.id, 'DELETE', to_jsonb(old), null);
    return old;
  end if;
end;
$$;

drop trigger if exists timeline_events_audit_trg on public.timeline_events;
create trigger timeline_events_audit_trg
  after insert or update or delete on public.timeline_events
  for each row execute function public.timeline_events_audit_fn();

-- ---------- 4. take away hard delete ----------
-- With no delete policy, DELETE silently matches zero rows for the
-- public key. The app soft-deletes via UPDATE instead.
drop policy if exists "timeline public delete" on public.timeline_events;

-- ---------- 5. one-call restore ----------
-- Rebuilds an event from an audit row's `old_row`, whether it was
-- edited, soft-deleted, or hard-deleted before this script existed.
create or replace function public.restore_timeline_event(p_audit_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r jsonb;
begin
  select old_row into r
  from public.timeline_events_audit
  where audit_id = p_audit_id;

  if r is null then
    raise exception 'audit_id % has no old_row to restore (it was an INSERT)', p_audit_id;
  end if;

  insert into public.timeline_events
    (id, start_date, end_date, category, person, emoji, text, deleted_at)
  values (
    (r->>'id')::uuid, (r->>'start_date')::date, (r->>'end_date')::date,
    r->>'category', r->>'person', coalesce(r->>'emoji', ''), r->>'text', null
  )
  on conflict (id) do update set
    start_date = excluded.start_date,
    end_date   = excluded.end_date,
    category   = excluded.category,
    person     = excluded.person,
    emoji      = excluded.emoji,
    text       = excluded.text,
    deleted_at = null;
end;
$$;

-- Recovery stays out of the vandal's hands: SQL Editor only.
revoke all on function public.restore_timeline_event(bigint) from public, anon, authenticated;

-- ---------- 6. check it took ----------
-- Should list insert / select / update — and NO delete.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'timeline_events'
order by cmd;


-- ============================================================
--  RECOVERY RECIPES  (paste into the SQL Editor when needed)
-- ============================================================
--
-- What happened recently, newest first:
--   select audit_id, changed_at, action, old_row->>'text' as was,
--          new_row->>'text' as now
--   from public.timeline_events_audit
--   order by changed_at desc limit 50;
--
-- Un-delete everything hidden in the last 24 hours:
--   update public.timeline_events set deleted_at = null
--   where deleted_at > now() - interval '24 hours';
--
-- Un-delete one event:
--   update public.timeline_events set deleted_at = null
--   where id = 'paste-uuid-here';
--
-- Undo a single bad edit (find the audit_id in the query above):
--   select public.restore_timeline_event(1234);
--
-- Roll every event back to how it looked at a point in time:
--   select public.restore_timeline_event(audit_id)
--   from (
--     select distinct on (event_id) audit_id
--     from public.timeline_events_audit
--     where changed_at > timestamptz '2026-08-08 12:00'
--       and old_row is not null
--     order by event_id, changed_at asc      -- oldest change after that time
--   ) first_change_per_event;
--
-- Full snapshot to keep off-site (copy the JSON out of the result):
--   select jsonb_agg(to_jsonb(t) order by t.start_date)
--   from public.timeline_events t where t.deleted_at is null;
--
-- Housekeeping: the audit log keeps your event text forever by
-- design. If you ever want to prune it:
--   delete from public.timeline_events_audit
--   where changed_at < now() - interval '1 year';
