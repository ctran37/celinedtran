import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import BracketStadium from "../components/BracketStadium.jsx";
import { TOTAL_ROUNDS, roundName } from "../lib/rounds.js";
import { scoreBracket, ROUND_POINTS } from "../lib/scoring.js";

export default function ViewBracket() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [bracket, setBracket] = useState(null);
  const [matches, setMatches] = useState([]);
  const [picks, setPicks] = useState({}); // matchId -> playerId

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: b, error: bErr } = await supabase
          .from("brackets")
          .select(
            `id, participant_name, created_at, draw_id,
             draws (id, gender, tournament_id,
                    tournaments (id, name, slug, year))`
          )
          .eq("id", id)
          .single();
        if (bErr) throw bErr;

        const drawId = b.draws.id;
        const [matchesRes, picksRes] = await Promise.all([
          supabase
            .from("matches")
            .select(
              `id, round, match_number, player1_id, player2_id,
               player1:player1_id (id, name, nationality, seed),
               player2:player2_id (id, name, nationality, seed)`
            )
            .eq("draw_id", drawId)
            .order("round", { ascending: true })
            .order("match_number", { ascending: true }),
          supabase
            .from("bracket_picks")
            .select("match_id, picked_winner_id")
            .eq("bracket_id", id),
        ]);
        if (matchesRes.error) throw matchesRes.error;
        if (picksRes.error) throw picksRes.error;

        const picksMap = {};
        for (const p of picksRes.data ?? []) {
          picksMap[p.match_id] = p.picked_winner_id;
        }

        if (!cancelled) {
          setBracket(b);
          setMatches(matchesRes.data ?? []);
          setPicks(picksMap);
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
  }, [id]);

  const matchByRoundNumber = useMemo(() => {
    const map = new Map();
    for (const m of matches) map.set(`${m.round}:${m.match_number}`, m);
    return map;
  }, [matches]);

  const matchesByRound = useMemo(() => {
    const groups = {};
    for (const m of matches) (groups[m.round] ??= []).push(m);
    for (const r of Object.keys(groups))
      groups[r].sort((a, b) => a.match_number - b.match_number);
    return groups;
  }, [matches]);

  const playersById = useMemo(() => {
    const map = {};
    for (const m of matches) {
      if (m.player1) map[m.player1.id] = m.player1;
      if (m.player2) map[m.player2.id] = m.player2;
    }
    return map;
  }, [matches]);

  const matchupsForRound = (round) => {
    const roundMatches = matchesByRound[round] ?? [];
    if (round === 1) {
      return roundMatches.map((m) => ({
        id: m.id,
        matchNumber: m.match_number,
        player1: m.player1,
        player2: m.player2,
      }));
    }
    return roundMatches.map((m) => {
      const prev1 = matchByRoundNumber.get(`${round - 1}:${m.match_number * 2 - 1}`);
      const prev2 = matchByRoundNumber.get(`${round - 1}:${m.match_number * 2}`);
      const p1id = prev1 ? picks[prev1.id] : null;
      const p2id = prev2 ? picks[prev2.id] : null;
      return {
        id: m.id,
        matchNumber: m.match_number,
        player1: p1id ? playersById[p1id] : null,
        player2: p2id ? playersById[p2id] : null,
      };
    });
  };

  // Score against actual results — relies on matches.winner_id being populated.
  const score = useMemo(() => {
    const pickRows = Object.entries(picks).map(([match_id, picked_winner_id]) => ({
      match_id,
      picked_winner_id,
    }));
    return scoreBracket({ picks: pickRows, matches, playersById });
  }, [picks, matches, playersById]);

  if (loading) {
    return <p className="mono" style={{ color: "#999" }}>loading…</p>;
  }
  if (error) {
    return <p className="mono" style={{ color: "#a33" }}>error: {error}</p>;
  }
  if (!bracket) {
    return <p className="mono" style={{ color: "#a33" }}>bracket not found</p>;
  }

  const tournament = bracket.draws.tournaments;
  const gender = bracket.draws.gender;

  const finalMatchup = matchupsForRound(TOTAL_ROUNDS)[0];
  const championId = finalMatchup ? picks[finalMatchup.id] : null;
  const champion = championId ? playersById[championId] : null;

  return (
    <div className="section">
      <div style={{ marginBottom: 24 }}>
        <Link
          to="/roland-garros-2026"
          className="mono"
          style={{
            fontSize: 11,
            color: "#999",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          ← {tournament?.name ?? "tournament"}
        </Link>
      </div>

      <div style={{ marginBottom: 32 }}>
        <p className="label-eyebrow" style={{ marginBottom: 8 }}>
          {gender === "mens" ? "men's" : "women's"} singles · locked
        </p>
        <h2
          style={{
            fontSize: 32,
            fontWeight: 400,
            letterSpacing: "-0.01em",
            marginBottom: 8,
          }}
        >
          {bracket.participant_name}'s bracket
        </h2>
        <p className="mono" style={{ fontSize: 12, color: "#aaa" }}>
          submitted {parseSupabaseTimestamp(bracket.created_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/New_York",
            timeZoneName: "short",
          })}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            padding: 24,
            background: "#fdfbf6",
            border: "1px solid #eee5d8",
          }}
        >
          <p className="label-eyebrow" style={{ marginBottom: 8 }}>
            Predicted champion
          </p>
          <p
            style={{
              fontSize: 26,
              fontStyle: "italic",
              color: "#2a2520",
              lineHeight: 1.2,
            }}
          >
            {champion ? (
              <>
                {champion.name}
                {champion.seed != null && (
                  <span style={{ fontSize: 14, color: "#999", marginLeft: 8 }}>
                    [{champion.seed}]
                  </span>
                )}
              </>
            ) : (
              "—"
            )}
          </p>
        </div>

        <div
          style={{
            padding: 24,
            background: "#1a1814",
            color: "#faf8f5",
            border: "1px solid #1a1814",
          }}
        >
          <p
            className="label-eyebrow"
            style={{ marginBottom: 8, color: "#aaa" }}
          >
            Score
          </p>
          <p
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 28,
              fontWeight: 400,
              lineHeight: 1.2,
            }}
          >
            {score.total}
            <span
              style={{
                fontSize: 11,
                color: "#aaa",
                marginLeft: 6,
                letterSpacing: "0.1em",
              }}
            >
              PTS
            </span>
          </p>
          <p
            className="mono"
            style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}
          >
            {score.correctCount} / {score.settledCount} correct
            {score.settledCount === 0 && " · waiting on results"}
          </p>
        </div>
      </div>

      <ScoreBreakdown score={score} />

      <BracketStadium matchupsForRound={matchupsForRound} picks={picks} />
    </div>
  );
}

// Supabase TIMESTAMP (no tz) columns return ISO strings without a "Z" suffix,
// which JS parses as local time. Force UTC interpretation so the EDT conversion
// downstream is correct.
function parseSupabaseTimestamp(s) {
  if (!s) return new Date(NaN);
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + "Z");
}

function ScoreBreakdown({ score }) {
  if (score.settledCount === 0) return null;
  const rounds = [1, 2, 3, 4, 5, 6, 7];
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 className="label-eyebrow" style={{ marginBottom: 12 }}>
        Score by round
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          border: "1px solid #eee5d8",
        }}
      >
        {rounds.map((r) => {
          const pts = score.byRound[r] ?? 0;
          const maxBase = ROUND_POINTS[r];
          const hasPoints = pts > 0;
          return (
            <div
              key={r}
              style={{
                padding: "12px 8px",
                textAlign: "center",
                background: hasPoints ? "#fdfbf6" : "transparent",
                borderRight: r < 7 ? "1px solid #eee5d8" : "none",
              }}
            >
              <p
                className="label-eyebrow"
                style={{ fontSize: 9, marginBottom: 4 }}
              >
                {roundName(r)}
              </p>
              <p
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 15,
                  color: hasPoints ? "#1a1814" : "#ccc",
                  fontWeight: hasPoints ? 400 : 300,
                }}
              >
                {pts}
              </p>
              <p
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  color: "#bbb",
                  marginTop: 2,
                }}
              >
                /{maxBase}+
              </p>
            </div>
          );
        })}
      </div>
      <p
        className="mono"
        style={{ fontSize: 10, color: "#aaa", marginTop: 8 }}
      >
        Base per correct pick doubles each round (R1=10 → F=640). Bonus added
        for upsets (when your pick was the higher-seeded player).
      </p>
    </div>
  );
}