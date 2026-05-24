// sync-rg-results.js
// Run with: node --env-file=.env script/sync-rg-results.js
// Dry run:  node --env-file=.env script/sync-rg-results.js --dry-run
//
// Pulls finished matches from Roland Garros's public polling endpoint, normalizes
// names to match our DB's "I.LastName" format, and updates matches.winner_id +
// cascades to the next round's player slot.
//
// --dry-run logs every update it WOULD make without writing to Supabase.
//
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
// from env. RG endpoint requires no auth.

import { createClient } from "@supabase/supabase-js";

const POLLING_URL = "https://www.rolandgarros.com/api/en-us/polling";
const TOURNAMENT_SLUG = "roland-garros-2026";
const TOTAL_ROUNDS = 7;

// RG's roundLabel strings — values vary slightly across years, hence multiple variants.
const ROUND_FROM_LABEL = {
  "First Round": 1,
  "Second Round": 2,
  "Third Round": 3,
  "Round of 16": 4,
  "Fourth Round": 4,
  Quarterfinals: 5,
  "Quarter Finals": 5,
  "Quarter-finals": 5,
  "Quarter-Finals": 5,
  Semifinals: 6,
  "Semi Finals": 6,
  "Semi-finals": 6,
  "Semi-Finals": 6,
  Final: 7,
};

// "BONZI" → "Bonzi"; "AUGER-ALIASSIME" → "Auger-Aliassime"; "DE MINAUR" → "De Minaur"
function titleCase(s) {
  if (!s) return "";
  return s
    .split(/(\s|-)/)
    .map((part) => {
      if (/^[\s-]$/.test(part)) return part;
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

// "Jannik" → "J"; "Thiago Agustin" → "TA"; "Elena-Gabriela" → "EG"
// Our DB uses one initial per first-name word/hyphen-part (matches RG's "Tomas Martin" → "TM.Etcheverry").
function firstNameInitials(firstName) {
  if (!firstName) return "";
  return firstName
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function normalizeName(firstName, lastName) {
  if (!firstName || !lastName) return null;
  return `${firstNameInitials(firstName)}.${titleCase(lastName)}`;
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const DRY_RUN = process.argv.includes("--dry-run");

  if (!url || !key) {
    console.error(
      "Missing env vars. Set SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env (or run with --env-file=.env)."
    );
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("🟡 DRY RUN — no DB writes will happen.\n");
  }

  const supabase = createClient(url, key);

  // ── 1. Load tournament + draws ────────────────────────────────────
  const { data: tournament, error: tErr } = await supabase
    .from("tournaments")
    .select("id, name, slug")
    .eq("slug", TOURNAMENT_SLUG)
    .single();
  if (tErr) throw new Error(`tournament fetch: ${tErr.message}`);

  const { data: draws, error: dErr } = await supabase
    .from("draws")
    .select("id, gender")
    .eq("tournament_id", tournament.id);
  if (dErr) throw new Error(`draws fetch: ${dErr.message}`);

  const drawByGender = {};
  for (const d of draws) drawByGender[d.gender] = d.id;
  if (!drawByGender.mens || !drawByGender.womens) {
    throw new Error("Missing expected draws (mens + womens)");
  }

  // ── 2. Load matches and players ───────────────────────────────────
  const drawIds = draws.map((d) => d.id);
  const { data: matches, error: mErr } = await supabase
    .from("matches")
    .select("id, draw_id, round, match_number, player1_id, player2_id, winner_id")
    .in("draw_id", drawIds);
  if (mErr) throw new Error(`matches fetch: ${mErr.message}`);

  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id, name, seed");
  if (pErr) throw new Error(`players fetch: ${pErr.message}`);

  const playersByName = new Map();
  for (const p of players) playersByName.set(p.name, p);

  // ── 3. Fetch RG polling ───────────────────────────────────────────
  console.log("Fetching Roland Garros polling endpoint…");
  const res = await fetch(POLLING_URL, {
    headers: {
      "User-Agent": "celinedtran-bracket-sync/1.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`RG polling HTTP ${res.status}`);
  const json = await res.json();
  const rgMatches = json.matches ?? [];
  console.log(`RG returned ${rgMatches.length} matches`);

  // ── 4. Filter to finished singles, sort by round ──────────────────
  const finished = rgMatches.filter(
    (m) =>
      m?.matchData?.status === "FINISHED" &&
      (m.matchData.type === "SM" || m.matchData.type === "SD")
  );
  finished.sort((a, b) => {
    const ra = ROUND_FROM_LABEL[a.matchData.roundLabel] ?? 99;
    const rb = ROUND_FROM_LABEL[b.matchData.roundLabel] ?? 99;
    return ra - rb;
  });
  console.log(`${finished.length} finished singles matches`);

  // ── 5. Process each ───────────────────────────────────────────────
  let updated = 0;
  let alreadyCurrent = 0;
  const errors = [];

  for (const rgMatch of finished) {
    const gender = rgMatch.matchData.type === "SM" ? "mens" : "womens";
    const drawId = drawByGender[gender];

    const round = ROUND_FROM_LABEL[rgMatch.matchData.roundLabel];
    if (!round) {
      errors.push(`Unknown round label: "${rgMatch.matchData.roundLabel}" (${rgMatch.id})`);
      continue;
    }

    const winnerTeam = rgMatch.teamA?.winner
      ? rgMatch.teamA
      : rgMatch.teamB?.winner
        ? rgMatch.teamB
        : null;
    if (!winnerTeam) continue; // FINISHED but no winner flag — skip
    const loserTeam = winnerTeam === rgMatch.teamA ? rgMatch.teamB : rgMatch.teamA;

    const wp = winnerTeam.players?.[0];
    const lp = loserTeam.players?.[0];
    const winnerName = normalizeName(wp?.firstName, wp?.lastName);
    const loserName = normalizeName(lp?.firstName, lp?.lastName);

    const winnerDb = playersByName.get(winnerName);
    const loserDb = playersByName.get(loserName);

    if (!winnerDb || !loserDb) {
      const missing = [];
      if (!winnerDb) missing.push(`winner "${winnerName}" (${wp?.firstName} ${wp?.lastName})`);
      if (!loserDb) missing.push(`loser "${loserName}" (${lp?.firstName} ${lp?.lastName})`);
      errors.push(
        `Couldn't resolve ${missing.join(" and ")} for ${rgMatch.id} ${gender} R${round}`
      );
      continue;
    }

    const ourMatch = matches.find(
      (m) =>
        m.draw_id === drawId &&
        m.round === round &&
        ((m.player1_id === winnerDb.id && m.player2_id === loserDb.id) ||
          (m.player1_id === loserDb.id && m.player2_id === winnerDb.id))
    );

    if (!ourMatch) {
      errors.push(
        `No DB match for ${winnerName} vs ${loserName} in ${gender} R${round} — likely upstream cascade hasn't happened yet`
      );
      continue;
    }

    if (ourMatch.winner_id === winnerDb.id) {
      alreadyCurrent += 1;
      continue;
    }

    // Update winner_id (skipped in dry-run)
    if (!DRY_RUN) {
      const { error: uErr } = await supabase
        .from("matches")
        .update({ winner_id: winnerDb.id })
        .eq("id", ourMatch.id);
      if (uErr) {
        errors.push(`UPDATE winner_id failed (${ourMatch.id}): ${uErr.message}`);
        continue;
      }
    }
    ourMatch.winner_id = winnerDb.id; // mutate locally either way so cascade logic stays correct

    // Cascade to next round's player slot
    let cascadeDescription = "";
    if (round < TOTAL_ROUNDS) {
      const nextMatchNumber = Math.ceil(ourMatch.match_number / 2);
      const slot =
        ourMatch.match_number % 2 === 1 ? "player1_id" : "player2_id";
      const nextMatch = matches.find(
        (m) =>
          m.draw_id === drawId &&
          m.round === round + 1 &&
          m.match_number === nextMatchNumber
      );
      if (nextMatch) {
        if (!DRY_RUN) {
          const { error: cErr } = await supabase
            .from("matches")
            .update({ [slot]: winnerDb.id })
            .eq("id", nextMatch.id);
          if (cErr) {
            errors.push(`Cascade failed for next-round slot: ${cErr.message}`);
          }
        }
        nextMatch[slot] = winnerDb.id;
        cascadeDescription = `  → R${round + 1} #${nextMatchNumber}.${slot.replace("_id", "")}`;
      }
    }

    updated += 1;
    const prefix = DRY_RUN ? "[DRY]" : "✓";
    console.log(
      `${prefix} ${gender} R${round} #${ourMatch.match_number}: ${winnerName} def. ${loserName}${cascadeDescription}`
    );
  }

  console.log(
    `\n${DRY_RUN ? "Dry run complete" : "Done"} — ${updated} ${DRY_RUN ? "would update" : "updated"}, ${alreadyCurrent} already current, ${errors.length} errors`
  );
  if (errors.length) {
    console.log("\nErrors:");
    for (const e of errors) console.log(`  - ${e}`);
  }
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
