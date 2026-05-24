import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { roundName, TOTAL_ROUNDS } from "../lib/rounds.js";

const TOURNAMENT_SLUG = "roland-garros-2026";
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;
const SESSION_KEY = "admin-authed-v1";

export default function AdminMatches() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === "1"
  );

  if (!authed) {
    return <PasswordGate onUnlock={() => setAuthed(true)} />;
  }
  return <AdminContent onLogout={() => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
  }} />;
}

function PasswordGate({ onUnlock }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!ADMIN_PASSWORD) {
      setErr("VITE_ADMIN_PASSWORD env var not set on this build.");
      return;
    }
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onUnlock();
    } else {
      setErr("wrong password");
    }
  };

  return (
    <div className="section" style={{ maxWidth: 360 }}>
      <h2
        style={{
          fontSize: 28,
          fontWeight: 400,
          letterSpacing: "-0.01em",
          marginBottom: 8,
        }}
      >
        Admin
      </h2>
      <p
        className="mono"
        style={{ fontSize: 12, color: "#888", marginBottom: 24 }}
      >
        Enter the admin password to update match results.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="password"
          className="mono"
          autoFocus
          style={{
            width: "100%",
            fontSize: 14,
            padding: "10px 12px",
            border: "1px solid #e8e4dd",
            background: "#fdfbf6",
            color: "#1a1814",
            marginBottom: 12,
          }}
        />
        {err && (
          <p
            className="mono"
            style={{ fontSize: 12, color: "#a33", marginBottom: 12 }}
          >
            {err}
          </p>
        )}
        <button type="submit" className="btn">
          unlock
        </button>
      </form>
    </div>
  );
}

function AdminContent({ onLogout }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [draws, setDraws] = useState([]);
  const [drawId, setDrawId] = useState(null);
  const [matches, setMatches] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [activeRound, setActiveRound] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pendingWinners, setPendingWinners] = useState({}); // matchId -> playerId

  // Initial load: tournament + draws
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: t, error: tErr } = await supabase
          .from("tournaments")
          .select("id, name, slug, year")
          .eq("slug", TOURNAMENT_SLUG)
          .single();
        if (tErr) throw tErr;

        const { data: d, error: dErr } = await supabase
          .from("draws")
          .select("id, gender")
          .eq("tournament_id", t.id);
        if (dErr) throw dErr;

        if (!cancelled) {
          setTournament(t);
          setDraws(d ?? []);
          setDrawId((d ?? [])[0]?.id ?? null);
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

  // Matches re-fetch any time draw changes or we bump the refresh tick
  useEffect(() => {
    if (!drawId) return;
    let cancelled = false;
    (async () => {
      const { data, error: mErr } = await supabase
        .from("matches")
        .select(
          `id, draw_id, round, match_number, player1_id, player2_id, winner_id,
           player1:player1_id (id, name, nationality, seed),
           player2:player2_id (id, name, nationality, seed)`
        )
        .eq("draw_id", drawId)
        .order("round", { ascending: true })
        .order("match_number", { ascending: true });
      if (cancelled) return;
      if (mErr) setError(mErr.message);
      else setMatches(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [drawId, refreshTick]);

  const matchesByRound = useMemo(() => {
    const groups = {};
    for (const m of matches) (groups[m.round] ??= []).push(m);
    return groups;
  }, [matches]);

  const matchesById = useMemo(() => {
    const map = {};
    for (const m of matches) map[m.id] = m;
    return map;
  }, [matches]);

  const handleSelectPending = (matchId, playerId) => {
    setPendingWinners((prev) => ({ ...prev, [matchId]: playerId }));
  };

  const handleDiscardAll = () => {
    setPendingWinners({});
  };

  const pendingEntries = Object.entries(pendingWinners).filter(
    ([matchId, playerId]) =>
      matchesById[matchId] && matchesById[matchId].winner_id !== playerId
  );

  const handleConfirmAll = async () => {
    if (pendingEntries.length === 0) return;
    setSavingId("__batch__");
    setError(null);
    try {
      for (const [matchId, playerId] of pendingEntries) {
        const match = matchesById[matchId];
        if (!match) continue;

        const { error: e1 } = await supabase
          .from("matches")
          .update({ winner_id: playerId })
          .eq("id", matchId);
        if (e1) throw e1;

        // Cascade to next round
        if (match.round < TOTAL_ROUNDS) {
          const nextMatchNumber = Math.ceil(match.match_number / 2);
          const slot =
            match.match_number % 2 === 1 ? "player1_id" : "player2_id";
          const { error: e2 } = await supabase
            .from("matches")
            .update({ [slot]: playerId })
            .eq("draw_id", match.draw_id)
            .eq("round", match.round + 1)
            .eq("match_number", nextMatchNumber);
          if (e2) throw e2;
        }
      }
      setPendingWinners({});
      setRefreshTick((t) => t + 1);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  };

  const saving = savingId === "__batch__";

  if (loading) {
    return <p className="mono" style={{ color: "#999" }}>loading…</p>;
  }
  if (error && !tournament) {
    return <p className="mono" style={{ color: "#a33" }}>error: {error}</p>;
  }

  const currentRoundMatches = matchesByRound[activeRound] ?? [];

  return (
    <div className="section">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 24,
        }}
      >
        <div>
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
          <h2
            style={{
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: "-0.01em",
              marginTop: 8,
            }}
          >
            Admin · results
          </h2>
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={onLogout}
          style={{ fontSize: 11 }}
        >
          log out
        </button>
      </div>

      {/* Draw picker */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {draws.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`btn ${drawId === d.id ? "" : "secondary"}`}
            onClick={() => {
              setDrawId(d.id);
              setActiveRound(1);
            }}
          >
            {d.gender === "mens" ? "men's" : "women's"}
          </button>
        ))}
      </div>

      {/* Round tabs */}
      <div className="round-pills">
        {Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1).map((r) => {
          const rowsInRound = matchesByRound[r] ?? [];
          const completed = rowsInRound.filter((m) => m.winner_id).length;
          const total = rowsInRound.length;
          const allDone = total > 0 && completed === total;
          const isCurrent = r === activeRound;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setActiveRound(r)}
              className={`round-pill${isCurrent ? " current" : allDone ? " done" : ""}`}
              style={{ cursor: "pointer" }}
            >
              {roundName(r)} {total > 0 && `· ${completed}/${total}`}
            </button>
          );
        })}
      </div>

      {error && (
        <p
          className="mono"
          style={{ fontSize: 12, color: "#a33", marginBottom: 16 }}
        >
          {error}
        </p>
      )}

      <h3
        style={{
          fontSize: 22,
          fontWeight: 400,
          fontStyle: "italic",
          color: "#2a2520",
          marginBottom: 16,
        }}
      >
        {roundName(activeRound)}
      </h3>

      {currentRoundMatches.length === 0 ? (
        <p className="mono" style={{ fontSize: 13, color: "#999" }}>
          no matches in this round
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            paddingBottom: pendingEntries.length > 0 ? 96 : 0,
          }}
        >
          {currentRoundMatches.map((m) => (
            <AdminMatchRow
              key={m.id}
              match={m}
              saving={saving}
              pendingPlayerId={pendingWinners[m.id] ?? null}
              onSelect={(playerId) => handleSelectPending(m.id, playerId)}
            />
          ))}
        </ul>
      )}

      {pendingEntries.length > 0 && (
        <div className="admin-confirm-bar">
          <span className="mono" style={{ fontSize: 12 }}>
            {pendingEntries.length} pending change
            {pendingEntries.length === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn secondary"
              onClick={handleDiscardAll}
              disabled={saving}
              style={{ fontSize: 11 }}
            >
              discard
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleConfirmAll}
              disabled={saving}
              style={{ fontSize: 11 }}
            >
              {saving ? "saving…" : `confirm ${pendingEntries.length}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminMatchRow({ match, saving, pendingPlayerId, onSelect }) {
  const { player1, player2, winner_id } = match;
  const bothSet = !!player1 && !!player2;
  const savedWinner =
    winner_id === player1?.id ? player1 : winner_id === player2?.id ? player2 : null;

  // Pending overrides saved for display
  const selectedId = pendingPlayerId ?? winner_id;
  const isPending = pendingPlayerId && pendingPlayerId !== winner_id;

  return (
    <li
      style={{
        padding: "14px 0",
        borderBottom: "1px solid #eee5d8",
        display: "grid",
        gridTemplateColumns: "32px 1fr",
        gap: 12,
        alignItems: "center",
      }}
    >
      <span className="mono" style={{ fontSize: 11, color: "#bbb" }}>
        #{match.match_number}
      </span>

      <div>
        {!bothSet ? (
          <p
            className="mono"
            style={{ fontSize: 13, color: "#aaa", fontStyle: "italic" }}
          >
            waiting on prior round… ({player1?.name ?? "TBD"} vs {player2?.name ?? "TBD"})
          </p>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <PlayerButton
              player={player1}
              isSelected={selectedId === player1.id}
              isPending={isPending && pendingPlayerId === player1.id}
              disabled={saving}
              onClick={() => onSelect(player1.id)}
            />
            <span className="mono" style={{ fontSize: 10, color: "#aaa" }}>vs</span>
            <PlayerButton
              player={player2}
              isSelected={selectedId === player2.id}
              isPending={isPending && pendingPlayerId === player2.id}
              disabled={saving}
              onClick={() => onSelect(player2.id)}
            />
            {!isPending && savedWinner && (
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color: "#666",
                  marginLeft: 12,
                  letterSpacing: "0.08em",
                }}
              >
                ✓ {savedWinner.name}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function PlayerButton({ player, isSelected, isPending, disabled, onClick }) {
  return (
    <button
      type="button"
      className={`pick-button${isSelected ? " picked" : ""}${isPending ? " pending" : ""}`}
      disabled={disabled}
      onClick={onClick}
      style={{ fontSize: 12, padding: "8px 12px" }}
    >
      {player.seed != null && <span className="seed">[{player.seed}]</span>}
      {player.name}
      {player.nationality && <span className="nat">{player.nationality}</span>}
    </button>
  );
}
