// file-feedback-issues.js
// Run with: node --env-file=.env script/file-feedback-issues.js
// Dry run:  node --env-file=.env script/file-feedback-issues.js --dry-run
//
// Turns rows in public.feedback that haven't been filed yet into GitHub issues,
// then stamps each row with its issue number so it can never be filed twice.
//
// --dry-run prints the issues it WOULD open and writes nothing anywhere.
//
// Env:
//   SUPABASE_URL          project URL
//   SUPABASE_SERVICE_KEY  service-role / secret key. Must be the SERVICE key:
//                         the feedback table is insert-only under RLS, so the
//                         publishable key cannot read it back.
//   GITHUB_TOKEN          provided automatically by Actions (needs issues: write)
//   GITHUB_REPOSITORY     provided automatically by Actions, e.g. "owner/repo"

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH = 20;              // cap per run so a flood can't open hundreds of issues
const LABEL = "feedback";

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.");
  process.exit(1);
}
if (!DRY_RUN && (!GITHUB_TOKEN || !GITHUB_REPOSITORY)) {
  console.error("Missing GITHUB_TOKEN or GITHUB_REPOSITORY.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const gh = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
};

// one line, no newlines, trimmed to something readable in the issues list
const titleFor = (msg) => {
  const line = msg.replace(/\s+/g, " ").trim();
  return line.length <= 70 ? line : line.slice(0, 69) + "…";
};

const bodyFor = (row) => [
  row.message.trim(),
  "",
  "---",
  `**Page:** ${row.page || "—"}`,
  `**Sent:** ${row.created_at}`,
  `**Browser:** ${row.user_agent || "—"}`,
  "",
  `<sub>Filed automatically from the site's feedback box. feedback.id \`${row.id}\`</sub>`,
].join("\n");

// --- fetch unfiled feedback -------------------------------------------------
const { data: rows, error } = await sb
  .from("feedback")
  .select("id, created_at, message, page, user_agent")
  .is("issue_filed_at", null)
  .order("created_at", { ascending: true })
  .limit(BATCH + 1);

if (error) {
  console.error("Couldn't read feedback:", error.message);
  process.exit(1);
}

if (!rows.length) {
  console.log("No new feedback.");
  process.exit(0);
}

const batch = rows.slice(0, BATCH);
if (rows.length > BATCH) {
  console.log(`Note: more than ${BATCH} unfiled rows — filing the oldest ${BATCH}, the rest go next run.`);
}
console.log(`${batch.length} to file${DRY_RUN ? " (dry run)" : ""}.`);

// --- make sure the label exists ---------------------------------------------
// Creating an issue with an unknown label is rejected, so create it up front.
// 422 here means "already exists", which is exactly what we want.
if (!DRY_RUN) {
  const made = await gh(`/repos/${GITHUB_REPOSITORY}/labels`, {
    method: "POST",
    body: JSON.stringify({ name: LABEL, color: "d9a520", description: "From the site's feedback box" }),
  });
  if (!made.ok && made.status !== 422) {
    console.warn(`Couldn't ensure the "${LABEL}" label (${made.status}) — filing without labels.`);
  }
}

// --- file them --------------------------------------------------------------
let filed = 0;
for (const row of batch) {
  const title = titleFor(row.message);

  if (DRY_RUN) {
    console.log(`\n--- would open: ${title}\n${bodyFor(row)}`);
    filed++;
    continue;
  }

  const made = await gh(`/repos/${GITHUB_REPOSITORY}/issues`, {
    method: "POST",
    body: JSON.stringify({ title, body: bodyFor(row), labels: [LABEL] }),
  });

  if (!made.ok) {
    // leave the row unstamped so the next run retries it
    console.error(`Failed to open an issue for ${row.id} (${made.status}): ${made.body?.message || "?"}`);
    continue;
  }

  const { error: stampErr } = await sb
    .from("feedback")
    .update({ issue_number: made.body.number, issue_filed_at: new Date().toISOString() })
    .eq("id", row.id);

  if (stampErr) {
    // The issue exists but the row isn't stamped, so the next run would file a
    // duplicate. Loud on purpose — this is the one case needing a human.
    console.error(`WARNING: opened issue #${made.body.number} but couldn't stamp row ${row.id}: ${stampErr.message}`);
    console.error("Stamp it by hand to avoid a duplicate:");
    console.error(`  update public.feedback set issue_number = ${made.body.number}, issue_filed_at = now() where id = '${row.id}';`);
    continue;
  }

  console.log(`#${made.body.number}  ${title}`);
  filed++;
}

console.log(`\nDone: ${filed}/${batch.length} filed${DRY_RUN ? " (dry run — nothing written)" : ""}.`);