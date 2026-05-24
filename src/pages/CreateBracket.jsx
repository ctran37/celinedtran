import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import RoundPicker from "../components/RoundPicker.jsx";
import { roundName, TOTAL_ROUNDS } from "../lib/rounds.js";

const TOURNAMENT_SLUG = "roland-garros-2026";

export default function CreateBracket() {
  const navigate = useNavigate();

  const [step, setStep] = useState("setup");
  const [error, setError] = useState(null);

  const [tournament, setTournament] = useState(null);
  const [draws, setDraws] = useState([]);
  const [loadingTournament, setLoadingTournament] = useState(true);

  const [name, setName] = useState("");
  const [drawId, setDrawId] = useState(null);

  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const [currentRound, setCurrentRound] = useState(1);
  const [picks, setPicks] = useState({}); // matchId -> playerId
  const [submitting, setSubmitting] = useState(false);

  // Load tournament + draws once
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

        const { data: d, error: dErr } = await supabase
          .from("draws")
          .select("id, gender, tournament_id")
          .eq("tournament_id", t.id);
        if (dErr) throw dErr;

        if (!cancelled) {
          setTournament(t);
          setDraws(d ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message ?? String(e));
      } finally {
        if (!cancelled) setLoadingTournament(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Derived: match lookup tables
  const matchesById = useMemo(() => {
    const map = {};
    for (const m of matches) map[m.id] = m;
    return map;
  }, [matches]);

  const matchByRoundNumber = useMemo(() => {
    const map = new Map();
    for (const m of matches) map.set(`${m.round}:${m.match_number}`, m);
    return map;
  }, [matches]);

  const matchesByRound = useMemo(() => {
    const groups = {};
    for (const m of matches) {
      (groups[m.round] ??= []).push(m);
    }
    for (const r of Object.keys(groups)) {
      groups[r].sort((a, b) => a.match_number - b.match_number);
    }
    return groups;
  }, [matches]);

  // All players in this draw, sourced from round-1 matches (only rows with FK populated).
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

  const currentMatchups = step === "picking" ? matchupsForRound(currentRound) : [];
  const currentRoundComplete =
    currentMatchups.length > 0 && currentMatchups.every((m) => picks[m.id]);

  const handleStartPicking = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!drawId) {
      setError("Please pick a draw.");
      return;
    }
    setLoadingMatches(true);
    try {
      const { data, error: mErr } = await supabase
        .from("matches")
        .select(
          `id, round, match_number, player1_id, player2_id,
           player1:player1_id (id, name, nationality, seed),
           player2:player2_id (id, name, nationality, seed)`
        )
        .eq("draw_id", drawId)
        .order("round", { ascending: true })
        .order("match_number", { ascending: true });
      if (mErr) throw mErr;
      setMatches(data ?? []);
      setCurrentRound(1);
      setPicks({});
      setStep("picking");
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoadingMatches(false);
    }
  };

  const handlePick = (matchId, playerId) => {
    const match = matchesById[matchId];
    if (!match) return;
    const previous = picks[matchId];
    setPicks((prev) => {
      const next = { ...prev, [matchId]: playerId };
      if (previous && previous !== playerId) {
        // Pick changed — clear all picks in later rounds (downstream is invalid)
        return Object.fromEntries(
          Object.entries(next).filter(
            ([mid]) => matchesById[mid].round <= match.round
          )
        );
      }
      return next;
    });
  };

  const handleNext = () => {
    if (currentRound < TOTAL_ROUNDS) {
      setCurrentRound(currentRound + 1);
    } else {
      setStep("review");
    }
  };

  const handleBack = () => {
    if (currentRound > 1) setCurrentRound(currentRound - 1);
    else setStep("setup");
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { data: bracket, error: bErr } = await supabase
        .from("brackets")
        .insert({ draw_id: drawId, participant_name: name.trim() })
        .select("id")
        .single();
      if (bErr) throw bErr;

      const rows = Object.entries(picks).map(([match_id, picked_winner_id]) => ({
        bracket_id: bracket.id,
        match_id,
        picked_winner_id,
      }));
      const { error: pErr } = await supabase.from("bracket_picks").insert(rows);
      if (pErr) throw pErr;

      navigate(`/roland-garros-2026/bracket/${bracket.id}`);
    } catch (e) {
      setError(e.message ?? String(e));
      setSubmitting(false);
    }
  };

  // ─── Render ───
  if (loadingTournament) {
    return <p className="mono" style={{ color: "#999" }}>loading…</p>;
  }
  if (error && step === "setup" && !tournament) {
    return <p className="mono" style={{ color: "#a33" }}>error: {error}</p>;
  }

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

      {step === "setup" && (
        <SetupStep
          name={name}
          setName={setName}
          draws={draws}
          drawId={drawId}
          setDrawId={setDrawId}
          onStart={handleStartPicking}
          loading={loadingMatches}
          error={error}
        />
      )}

      {step === "picking" && (
        <>
          <RoundProgress current={currentRound} picks={picks} matchesByRound={matchesByRound} />
          <RoundPicker
            round={currentRound}
            matchups={currentMatchups}
            picks={picks}
            onPick={handlePick}
          />
          <NavFooter
            onBack={handleBack}
            onNext={handleNext}
            backLabel={currentRound === 1 ? "← back" : `← ${roundName(currentRound - 1)}`}
            nextLabel={
              currentRound === TOTAL_ROUNDS ? "review →" : `${roundName(currentRound + 1)} →`
            }
            nextDisabled={!currentRoundComplete}
          />
        </>
      )}

      {step === "review" && (
        <ReviewStep
          name={name}
          tournament={tournament}
          draw={draws.find((d) => d.id === drawId)}
          matchupsForRound={matchupsForRound}
          picks={picks}
          onEdit={() => {
            setStep("picking");
            setCurrentRound(1);
          }}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={error}
        />
      )}
    </div>
  );
}

function SetupStep({ name, setName, draws, drawId, setDrawId, onStart, loading, error }) {
  return (
    <div>
      <h2
        style={{
          fontSize: 32,
          fontWeight: 400,
          marginBottom: 6,
          letterSpacing: "-0.01em",
        }}
      >
        New bracket
      </h2>
      <p className="mono" style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>
        Enter your name and pick a draw to start.
      </p>

      <label
        className="label-eyebrow"
        style={{ display: "block", marginBottom: 8 }}
      >
        Your name
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Celine T."
        className="mono"
        style={{
          width: "100%",
          maxWidth: 360,
          fontSize: 14,
          padding: "10px 12px",
          border: "1px solid #e8e4dd",
          background: "#fdfbf6",
          marginBottom: 28,
          color: "#1a1814",
        }}
      />

      <label
        className="label-eyebrow"
        style={{ display: "block", marginBottom: 12 }}
      >
        Draw
      </label>
      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        {draws.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`btn ${drawId === d.id ? "" : "secondary"}`}
            onClick={() => setDrawId(d.id)}
          >
            {d.gender === "mens" ? "men's singles" : "women's singles"}
          </button>
        ))}
      </div>

      {error && (
        <p className="mono" style={{ fontSize: 12, color: "#a33", marginBottom: 16 }}>
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn"
        onClick={onStart}
        disabled={loading}
      >
        {loading ? "loading…" : "start picking →"}
      </button>
    </div>
  );
}

function RoundProgress({ current, picks, matchesByRound }) {
  const rounds = Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1);
  return (
    <div className="round-pills">
      {rounds.map((r) => {
        const inRound = matchesByRound[r] ?? [];
        const done =
          inRound.length > 0 && inRound.every((m) => picks[m.id]);
        const isCurrent = r === current;
        const cls = isCurrent ? "current" : done ? "done" : "";
        return (
          <span key={r} className={`round-pill ${cls}`}>
            {roundName(r)}
          </span>
        );
      })}
    </div>
  );
}

function NavFooter({ onBack, onNext, backLabel, nextLabel, nextDisabled }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 40,
        paddingTop: 24,
        borderTop: "1px solid #e8e4dd",
      }}
    >
      <button type="button" className="btn secondary" onClick={onBack}>
        {backLabel}
      </button>
      <button
        type="button"
        className="btn"
        onClick={onNext}
        disabled={nextDisabled}
      >
        {nextLabel}
      </button>
    </div>
  );
}

function ReviewStep({
  name,
  tournament,
  draw,
  matchupsForRound,
  picks,
  onEdit,
  onSubmit,
  submitting,
  error,
}) {
  const finalMatchup = matchupsForRound(TOTAL_ROUNDS)[0];
  const championId = finalMatchup ? picks[finalMatchup.id] : null;
  const champion =
    finalMatchup?.player1?.id === championId
      ? finalMatchup.player1
      : finalMatchup?.player2?.id === championId
      ? finalMatchup.player2
      : null;

  return (
    <div>
      <h2
        style={{
          fontSize: 32,
          fontWeight: 400,
          marginBottom: 6,
          letterSpacing: "-0.01em",
        }}
      >
        Review your bracket
      </h2>
      <p className="mono" style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>
        {name} · {draw?.gender === "mens" ? "men's" : "women's"} singles · {tournament.name}
      </p>

      <div
        style={{
          padding: 28,
          background: "#fdfbf6",
          border: "1px solid #eee5d8",
          marginBottom: 32,
        }}
      >
        <p className="label-eyebrow" style={{ marginBottom: 8 }}>
          Your champion
        </p>
        <p
          style={{
            fontSize: 28,
            fontStyle: "italic",
            color: "#2a2520",
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

      <div style={{ marginBottom: 32 }}>
        {Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1).map((r) => {
          const matchups = matchupsForRound(r);
          const winners = matchups
            .map((m) => {
              const pid = picks[m.id];
              if (!pid) return null;
              return m.player1?.id === pid ? m.player1 : m.player2;
            })
            .filter(Boolean);
          return (
            <div key={r} style={{ marginBottom: 18 }}>
              <p
                className="label-eyebrow"
                style={{ marginBottom: 6 }}
              >
                {roundName(r)} winners
              </p>
              <p
                className="mono"
                style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}
              >
                {winners.map((w) => w.name).join(" · ") || "—"}
              </p>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mono" style={{ fontSize: 12, color: "#a33", marginBottom: 16 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button type="button" className="btn secondary" onClick={onEdit} disabled={submitting}>
          ← edit picks
        </button>
        <button type="button" className="btn" onClick={onSubmit} disabled={submitting}>
          {submitting ? "submitting…" : "lock in bracket →"}
        </button>
      </div>
    </div>
  );
}
