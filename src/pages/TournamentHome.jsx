import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { scoreBracket } from "../lib/scoring.js";

const TOURNAMENT_SLUG = "roland-garros-2026";

export default function TournamentHome() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [brackets, setBrackets] = useState([]);
  const [matches, setMatches] = useState([]);
  const [picksByBracket, setPicksByBracket] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: t, error: tErr } = await supabase
          .from("tournaments")
          .select("id, name, slug, year, start_date, end_date, status")
          .eq("slug", TOURNAMENT_SLUG)
          .single();
        if (tErr) throw tErr;

        const { data: b, error: bErr } = await supabase
          .from("brackets")
          .select(
            "id, participant_name, created_at, draw_id, draws!inner(id, gender, tournament_id)"
          )
          .eq("draws.tournament_id", t.id)
          .order("created_at", { ascending: false });
        if (bErr) throw bErr;

        const bracketsList = b ?? [];
        const drawIds = [...new Set(bracketsList.map((br) => br.draw_id))];

        // Pull matches for all involved draws so we know winner_id + player seeds.
        // Player records are nested so we can build playersById without a separate query.
        const matchesPromise = drawIds.length
          ? supabase
              .from("matches")
              .select(
                `id, draw_id, round, match_number, player1_id, player2_id, winner_id,
                 player1:player1_id (id, seed),
                 player2:player2_id (id, seed)`
              )
              .in("draw_id", drawIds)
          : Promise.resolve({ data: [], error: null });

        // Picks: paginated in small bracket-chunks so we never hit any
        // PostgREST per-request row cap (default 1000). 7 brackets × 127 picks
        // each = 889 picks max per request.
        const bracketIds = bracketsList.map((br) => br.id);
        const BRACKETS_PER_CHUNK = 7;
        const allPicks = [];
        for (let i = 0; i < bracketIds.length; i += BRACKETS_PER_CHUNK) {
          const chunk = bracketIds.slice(i, i + BRACKETS_PER_CHUNK);
          const { data: chunkPicks, error: pErr } = await supabase
            .from("bracket_picks")
            .select("bracket_id, match_id, picked_winner_id")
            .in("bracket_id", chunk);
          if (pErr) throw pErr;
          allPicks.push(...(chunkPicks ?? []));
        }

        const matchesRes = await matchesPromise;
        if (matchesRes.error) throw matchesRes.error;

        const picksMap = {};
        for (const p of allPicks) {
          (picksMap[p.bracket_id] ??= []).push(p);
        }

        if (!cancelled) {
          setTournament(t);
          setBrackets(bracketsList);
          setMatches(matchesRes.data ?? []);
          setPicksByBracket(picksMap);
        }
      } catch (e) {
        if (!cancelled) setError(e.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const playersById = useMemo(() => {
    const map = {};
    for (const m of matches) {
      if (m.player1) map[m.player1.id] = m.player1;
      if (m.player2) map[m.player2.id] = m.player2;
    }
    return map;
  }, [matches]);

  const scored = useMemo(() => {
    return brackets
      .map((b) => {
        const score = scoreBracket({
          picks: picksByBracket[b.id] ?? [],
          matches,
          playersById,
        });
        return { ...b, score };
      })
      .sort((a, b) => {
        // Highest score first, ties broken by earliest submission (rewards being early)
        if (b.score.total !== a.score.total) return b.score.total - a.score.total;
        return new Date(a.created_at) - new Date(b.created_at);
      });
  }, [brackets, picksByBracket, matches, playersById]);

  const anyMatchesSettled = useMemo(
    () => matches.some((m) => m.winner_id),
    [matches]
  );

  if (loading) {
    return <p className="mono" style={{ color: "#999" }}>loading…</p>;
  }
  if (error) {
    return (
      <p className="mono" style={{ color: "#a33" }}>
        couldn't load tournament: {error}
      </p>
    );
  }

  return (
    <div className="section">
      <div style={{ marginBottom: 32 }}>
        <p className="label-eyebrow" style={{ marginBottom: 8 }}>
          {tournament.status} · {tournament.year}
        </p>
        <h2
          style={{
            fontSize: 36,
            fontWeight: 400,
            letterSpacing: "-0.01em",
            marginBottom: 12,
          }}
        >
          {tournament.name}
        </h2>
        <p
          className="mono"
          style={{ fontSize: 13, color: "#777", lineHeight: 1.6 }}
        >
          {formatDateRange(tournament.start_date, tournament.end_date)}
          <br />
          Pick your winners round by round. Brackets lock once submitted.
        </p>
      </div>

      <div style={{ marginBottom: 40 }}>
        <Link to="/roland-garros-2026/create" className="btn">
          + create bracket
        </Link>
      </div>

      <div>
        <h3 className="label-eyebrow" style={{ marginBottom: 16 }}>
          {anyMatchesSettled
            ? `Leaderboard (${scored.length})`
            : `Submitted brackets (${scored.length})`}
        </h3>

        {scored.length === 0 ? (
          <p
            className="mono"
            style={{ fontSize: 13, color: "#aaa", fontStyle: "italic" }}
          >
            no brackets yet — be the first.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {scored.map((b, idx) => (
              <li
                key={b.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr auto",
                  columnGap: 14,
                  rowGap: 2,
                  alignItems: "baseline",
                  padding: "14px 0",
                  borderBottom: "1px solid #e8e4dd",
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: idx < 3 && anyMatchesSettled ? "#1a1814" : "#bbb",
                    fontWeight: idx < 3 && anyMatchesSettled ? 400 : 300,
                  }}
                >
                  {idx + 1}
                </span>

                <Link
                  to={`/roland-garros-2026/bracket/${b.id}`}
                  style={{
                    fontSize: 17,
                    color: "#1a1814",
                    textDecoration: "none",
                  }}
                >
                  {b.participant_name}
                </Link>

                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 14,
                    fontWeight: 400,
                    color: "#1a1814",
                    textAlign: "right",
                  }}
                >
                  {b.score.total}
                  <span
                    style={{
                      fontSize: 10,
                      color: "#aaa",
                      marginLeft: 4,
                      letterSpacing: "0.08em",
                    }}
                  >
                    PTS
                  </span>
                </span>

                <span /> {/* spacer under rank column */}
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "#999",
                    letterSpacing: "0.08em",
                  }}
                >
                  {b.draws.gender} · {formatShortDate(b.created_at)}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 10, color: "#bbb", textAlign: "right" }}
                >
                  {b.score.correctCount}/{b.score.settledCount} correct
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatDateRange(start, end) {
  if (!start || !end) return "";
  const s = new Date(start);
  const e = new Date(end);
  const opts = { month: "long", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString(
    "en-US",
    { ...opts, year: "numeric" }
  )}`;
}

function formatShortDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
