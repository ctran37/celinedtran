import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import BracketStadium from "../components/BracketStadium.jsx";
import { TOTAL_ROUNDS } from "../lib/rounds.js";

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
          padding: 28,
          background: "#fdfbf6",
          border: "1px solid #eee5d8",
          marginBottom: 40,
        }}
      >
        <p className="label-eyebrow" style={{ marginBottom: 8 }}>
          Predicted champion
        </p>
        <p
          style={{
            fontSize: 30,
            fontStyle: "italic",
            color: "#2a2520",
          }}
        >
          {champion ? (
            <>
              {champion.name}
              {champion.seed != null && (
                <span style={{ fontSize: 15, color: "#999", marginLeft: 8 }}>
                  [{champion.seed}]
                </span>
              )}
            </>
          ) : (
            "—"
          )}
        </p>
      </div>

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