import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";

const TOURNAMENT_SLUG = "roland-garros-2026";

export default function TournamentHome() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [brackets, setBrackets] = useState([]);

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
          .select("id, participant_name, created_at, draws!inner(gender, tournament_id)")
          .eq("draws.tournament_id", t.id)
          .order("created_at", { ascending: false });
        if (bErr) throw bErr;

        if (!cancelled) {
          setTournament(t);
          setBrackets(b ?? []);
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
          Submitted brackets ({brackets.length})
        </h3>

        {brackets.length === 0 ? (
          <p
            className="mono"
            style={{ fontSize: 13, color: "#aaa", fontStyle: "italic" }}
          >
            no brackets yet — be the first.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {brackets.map((b) => (
              <li
                key={b.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 16,
                  alignItems: "baseline",
                  padding: "14px 0",
                  borderBottom: "1px solid #e8e4dd",
                }}
              >
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
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "#aaa",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {b.draws.gender}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "#bbb" }}
                >
                  {formatShortDate(b.created_at)}
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