import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  BARS, BINGO_BONUS, BLACKOUT_BONUS, FREE, POOL, ROOM, makeBoard, scoreBoard,
} from "../lib/halloweenConfig.js";
import "./halloween.css";

const STORE = "halloween-bingo";
const POLL_MS = 5000;

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORE)) ?? null; } catch { return null; }
};

export default function Halloween() {
  const [me, setMe] = useState(load); // { room, name, playerId, bar }

  const save = (next) => {
    setMe(next);
    if (next) localStorage.setItem(STORE, JSON.stringify(next));
    else localStorage.removeItem(STORE);
  };

  return (
    <div className="hw">
      {me ? <Game me={me} setMe={save} /> : <Join onJoin={save} />}
    </div>
  );
}

function Join({ onJoin }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    const playerId = crypto.randomUUID();
    const { error: err } = await supabase
      .from("halloween_players")
      .insert({ room: ROOM, player_id: playerId, name: n });
    setBusy(false);
    if (err) { setError("Couldn't join. Check your connection and try again."); return; }
    onJoin({ name: n, playerId, bar: 1 });
  };

  return (
    <form className="hw-join" onSubmit={submit}>
      <div className="hw-bat">🎃</div>
      <h1>Bar Crawl Bingo</h1>
      <p className="hw-sub">Honor system. Tick what you actually spot.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="your name"
        maxLength={24}
      />
      <button disabled={busy || !name.trim()}>
        {busy ? "Joining…" : "Play"}
      </button>
      {error && <p className="hw-err">{error}</p>}
    </form>
  );
}

function Game({ me, setMe }) {
  const room = ROOM;
  const [tab, setTab] = useState("card");
  const [players, setPlayers] = useState([]);
  const [marks, setMarks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const board = useMemo(() => makeBoard(`${room}:${me.playerId}`), [room, me.playerId]);

  const refresh = useCallback(async () => {
    const [p, m] = await Promise.all([
      supabase.from("halloween_players").select("player_id, name, bar").eq("room", room),
      supabase.from("halloween_marks").select("player_id, square, bar").eq("room", room),
    ]);
    if (p.error || m.error) { setError("Offline, retrying…"); return; }
    setError("");
    setPlayers(p.data);
    setMarks(m.data);
    setLoaded(true);
  }, [room]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, POLL_MS);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [refresh]);

  // The game was reset (our player row is gone): send this phone back to the join screen.
  useEffect(() => {
    if (loaded && !players.some((p) => p.player_id === me.playerId)) setMe(null);
  }, [loaded, players, me.playerId, setMe]);

  const myMarks = useMemo(() => marks.filter((m) => m.player_id === me.playerId), [marks, me.playerId]);
  const myBar = useMemo(() => new Map(myMarks.map((m) => [m.square, m.bar])), [myMarks]);
  const myScore = useMemo(() => scoreBoard(board, myMarks), [board, myMarks]);

  const toggle = async (sq) => {
    if (sq === FREE) return;
    const key = { room, player_id: me.playerId, square: sq };
    const had = myBar.has(sq);
    // optimistic, so taps feel instant on bad bar wifi
    setMarks((prev) => had
      ? prev.filter((m) => !(m.player_id === me.playerId && m.square === sq))
      : [...prev, { player_id: me.playerId, square: sq, bar: me.bar }]);
    const { error: err } = had
      ? await supabase.from("halloween_marks").delete().match(key)
      : await supabase.from("halloween_marks").insert({ ...key, bar: me.bar });
    if (err) setError("Couldn't save that tap.");
    refresh();
  };

  const goToBar = async (bar) => {
    setMe({ ...me, bar });
    setPlayers((prev) => prev.map((p) => (p.player_id === me.playerId ? { ...p, bar } : p)));
    const { error: err } = await supabase
      .from("halloween_players")
      .update({ bar })
      .match({ room, player_id: me.playerId });
    if (err) setError("Couldn't save your bar.");
    refresh();
  };

  const reset = async () => {
    const pw = prompt("Reset the game for EVERYONE? Enter the password:");
    if (pw === null) return;
    const { error: err } = await supabase.rpc("halloween_reset", { pw });
    if (err) { alert(err.message.includes("wrong password") ? "Wrong password." : "Couldn't reset. Try again."); return; }
    setMe(null);
  };

  const leave = () => {
    if (confirm("Leave this game? You'll get a new board if you rejoin.")) setMe(null);
  };

  return (
    <div className="hw-game">
      <header>
        <div>
          <strong>{me.name}</strong>
        </div>
        <div className="hw-total">{myScore.total} pts</div>
      </header>

      <div className="hw-bar">
        <button onClick={() => goToBar(Math.max(1, me.bar - 1))} aria-label="previous bar">‹</button>
        <span>🍻 Bar {me.bar}</span>
        <button onClick={() => goToBar(Math.min(BARS, me.bar + 1))} aria-label="next bar" className="next">Next bar ›</button>
      </div>

      <nav className="hw-tabs">
        <button className={tab === "card" ? "on" : ""} onClick={() => setTab("card")}>Card</button>
        <button className={tab === "score" ? "on" : ""} onClick={() => setTab("score")}>Scoreboard</button>
      </nav>

      {error && <p className="hw-err">{error}</p>}

      {tab === "card" ? (
        <>
          <div className="hw-grid">
            {board.map((sq, i) => {
              if (sq === FREE) return <div key={i} className="hw-cell free">FREE</div>;
              const bar = myBar.get(sq);
              return (
                <button
                  key={i}
                  className={`hw-cell pts${POOL[sq].p} ${bar ? "on" : ""}`}
                  onClick={() => toggle(sq)}
                >
                  <span className="t">{POOL[sq].t}</span>
                  <span className="p">{POOL[sq].p}</span>
                  {bar && <span className="b">bar {bar}</span>}
                </button>
              );
            })}
          </div>
          <p className="hw-hint">
            Tap to tick at the current bar, tap again to undo. Line = +{BINGO_BONUS},
            blackout = +{BLACKOUT_BONUS}, scored to the bar that finished it.
            {myScore.lines > 0 && ` You have ${myScore.lines} line${myScore.lines > 1 ? "s" : ""}! 🎉`}
          </p>
        </>
      ) : (
        <Scoreboard players={players} marks={marks} room={room} meId={me.playerId} />
      )}

      <div className="hw-foot">
        <button className="hw-leave" onClick={leave}>leave game</button>
        <button className="hw-leave" onClick={reset}>reset game</button>
      </div>
    </div>
  );
}

function Scoreboard({ players, marks, room, meId }) {
  const rows = useMemo(() => {
    const byPlayer = new Map();
    for (const m of marks) {
      if (!byPlayer.has(m.player_id)) byPlayer.set(m.player_id, []);
      byPlayer.get(m.player_id).push(m);
    }
    return players
      .map((p) => ({
        ...p,
        ...scoreBoard(makeBoard(`${room}:${p.player_id}`), byPlayer.get(p.player_id) ?? []),
      }))
      .sort((a, b) => b.total - a.total || b.lines - a.lines || a.name.localeCompare(b.name));
  }, [players, marks, room]);

  const lastBar = Math.max(1, ...marks.map((m) => m.bar), ...players.map((p) => p.bar ?? 1));
  const bars = Array.from({ length: lastBar }, (_, i) => i + 1);
  // winner of each bar = best round score there (ties share it)
  const best = Object.fromEntries(bars.map((b) => [b, Math.max(0, ...rows.map((r) => r.perBar[b] ?? 0))]));
  // A bar is over once anyone has moved on to the next one. Lowest score in a
  // finished bar drinks (ties all drink).
  const worst = Object.fromEntries(bars.map((b) => [b, Math.min(...rows.map((r) => r.perBar[b] ?? 0))]));
  const drinksIn = (r, b) => b < lastBar && (r.perBar[b] ?? 0) === worst[b];
  const drinkers = (b) => rows.filter((r) => drinksIn(r, b)).map((r) => r.name);
  const lastDone = lastBar - 1;

  return (
    <div className="hw-score">
      {lastDone >= 1 && rows.length > 0 && (
        <div className="hw-drink">
          🍺 Bar {lastDone} is done. Lowest score drinks: <strong>{drinkers(lastDone).join(", ")}</strong>
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>#</th><th>player</th>
            {bars.map((b) => <th key={b}>B{b}</th>)}
            <th>total</th><th>🍺</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.player_id} className={r.player_id === meId ? "me" : ""}>
              <td>{i + 1}</td>
              <td>{r.name}{r.blackout ? " 👑" : r.lines ? ` ×${r.lines}` : ""}</td>
              {bars.map((b) => {
                const v = r.perBar[b] ?? 0;
                const cls = drinksIn(r, b) ? "lose" : v > 0 && v === best[b] ? "win" : "";
                return <td key={b} className={cls}>{v || "·"}</td>;
              })}
              <td className="tot">{r.total}</td>
              <td>{bars.filter((b) => drinksIn(r, b)).length || "·"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hw-hint">×N = bingo lines · 👑 = blackout · gold = best of that bar · red = lowest of a finished bar (drinks) · 🍺 = drinks owed · updates every few seconds</p>
    </div>
  );
}
