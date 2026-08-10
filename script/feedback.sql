-- ============================================================
--  Feedback box for the /juan page.
--
--  The page can only INSERT here — there's no select/update/delete
--  policy, so the publishable key baked into the JS bundle can drop
--  a note in but can't read anyone else's, or delete them.
--
--  The GitHub Action (.github/workflows/file-feedback.yml) reads the
--  table with the SERVICE key, which bypasses RLS, files each new row
--  as a GitHub issue, and stamps the row so it's never filed twice.
--
--  Run once: Supabase dashboard -> SQL Editor -> paste -> Run.
--  Safe to re-run.
-- ============================================================

-- Anonymous on purpose: there is no name field, here or in the form.
create table if not exists public.feedback (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  message        text not null,
  page           text,
  user_agent     text,
  issue_number   integer,       -- set once the workflow files it
  issue_filed_at timestamptz,
  -- write access is public, so cap the size: no one can dump megabytes in
  constraint feedback_message_len check (char_length(message) between 1 and 2000),
  constraint feedback_page_len    check (page is null or char_length(page) <= 200),
  constraint feedback_ua_len      check (user_agent is null or char_length(user_agent) <= 400)
);

-- what the workflow scans for
create index if not exists feedback_unfiled_idx
  on public.feedback (created_at)
  where issue_filed_at is null;

alter table public.feedback enable row level security;

drop policy if exists "feedback public insert" on public.feedback;
create policy "feedback public insert"
  on public.feedback for insert with check (true);

-- No select / update / delete policies on purpose. Don't add a select policy:
-- that would publish every note to anyone with the publishable key.

-- Check it took — should list exactly one policy, INSERT:
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'feedback';

-- Read your feedback here any time (SQL Editor runs as owner, so RLS
-- doesn't apply):
--   select created_at, message, issue_number
--   from public.feedback order by created_at desc;