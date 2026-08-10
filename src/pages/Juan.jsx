import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  PAGE, PHASES, CATEGORIES, PEOPLE, NOTES, EMOJI_PALETTE,
  parseDate, stripTime, dayDiff, sameDay, clamp, pad, monthKey, dateStr,
  hexToRgba, MONTH_NAMES, WEEKDAYS, fmtShort, fmtLong,
} from "../lib/timelineConfig.js";
import "./juan.css";

const TABLE = "timeline_events";
const FEEDBACK_TABLE = "feedback";
const COLS = "id, start_date, end_date, category, person, emoji, text, pending";
const LEGACY_COLS = "id, start_date, end_date, category, person, emoji, text";
// `id: null` means "adding"; an id means "editing that row".
const EMPTY_FORM = { open: false, id: null, start: "", end: "", text: "", emoji: "", cat: CATEGORIES[0].id, person: PEOPLE[0].id, pending: false, titleAtOpen: "", error: "" };

const focusText = () =>
  setTimeout(() => { const el = document.getElementById("tl-ev-text"); if (el) el.focus(); }, 50);

export default function Juan() {
  // ---- static config, parsed once ----
  const phases = useMemo(
    () => PHASES.map((p) => ({ ...p, startD: parseDate(p.start), endD: parseDate(p.end) })),
    []
  );
  const arcStart = phases[0].startD;
  const arcEnd = phases[phases.length - 1].endD;
  const now = useMemo(() => stripTime(new Date()), []);
  const curMonthKey = monthKey(now);

  const catMap = useMemo(() => {
    const m = {};
    CATEGORIES.forEach((c) => (m[c.id] = c));
    return m;
  }, []);
  const cat = useCallback((id) => catMap[id] || { id: "other", label: "Other", emoji: "", color: "#8a7d73" }, [catMap]);
  const normCat = useCallback((id) => (catMap[id] ? id : "other"), [catMap]);
  const evEmoji = useCallback((e) => e.emoji || cat(e.cat).emoji || "•", [cat]);

  const personMap = useMemo(() => {
    const m = {};
    PEOPLE.forEach((p) => (m[p.id] = p));
    return m;
  }, []);
  const person = useCallback((id) => personMap[id] || PEOPLE[0], [personMap]);
  const normPerson = useCallback((id) => (personMap[id] ? id : PEOPLE[0].id), [personMap]);

  // ---- geometry helpers ----
  const phaseForDate = useCallback((d) => {
    for (const p of phases) if (d >= p.startD && d < p.endD) return p;
    if (dayDiff(d, arcEnd) === 0) return phases[phases.length - 1];
    return null;
  }, [phases, arcEnd]);
  const phaseForMonth = useCallback((y, m) => phaseForDate(new Date(y, m, 15)) || phaseForDate(new Date(y, m, 1)), [phaseForDate]);
  // The arc's months, minus the ones already finished — the calendar starts at
  // the current month. The current month itself always stays, part-spent or not.
  const months = useMemo(() => {
    const out = [];
    let c = new Date(arcStart.getFullYear(), arcStart.getMonth(), 1);
    const last = new Date(arcEnd.getFullYear(), arcEnd.getMonth(), 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    while (c <= last) {
      if (c >= thisMonth) out.push({ y: c.getFullYear(), m: c.getMonth() });
      c = new Date(c.getFullYear(), c.getMonth() + 1, 1);
    }
    return out;
  }, [arcStart, arcEnd, now]);

  // ---- data ----
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    const rows = (cols) => supabase.from(TABLE).select(cols).order("start_date", { ascending: true });
    // soft-deleted rows stay in the table, just hidden here
    let { data, error } = await rows(COLS).is("deleted_at", null);
    // 42703 = no such column, i.e. one of the migrations in script/ hasn't
    // been run yet. Fall back to the original columns so the page still
    // renders (events just show as confirmed until `pending` exists).
    if (error && error.code === "42703") {
      console.warn("timeline: missing deleted_at/pending column — run the SQL in script/ (timeline_events_audit.sql, timeline_events_pending.sql)");
      ({ data, error } = await rows(LEGACY_COLS));
    }
    if (error) {
      setLoadErr(error.message);
      setLoading(false);
      return;
    }
    const norm = (data ?? []).map((r) => {
      const sD = parseDate(r.start_date);
      let eD = r.end_date ? parseDate(r.end_date) : sD;
      if (eD < sD) eD = sD;
      return {
        id: r.id, startD: sD, endD: eD, cat: normCat(r.category), person: normPerson(r.person),
        emoji: r.emoji || "", text: r.text || "", pending: r.pending === true,
      };
    });
    norm.sort((a, b) => (a.startD - b.startD) || ((b.endD - b.startD) - (a.endD - a.startD)));
    setEvents(norm);
    setLoadErr(null);
    setLoading(false);
  }, [normCat, normPerson]);

  useEffect(() => {
    document.title = PAGE.title;
  }, []);

  // initial load (async — setState only runs after the awaited fetch)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvents();
  }, [fetchEvents]);

  // live sync: refetch whenever the table changes (from any device)
  useEffect(() => {
    const ch = supabase
      .channel("timeline_events_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => fetchEvents())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchEvents]);

  // Soft delete: stamps deleted_at instead of removing the row, so anything
  // deleted (by us or by a stranger with the public key) can be brought back
  // from the SQL editor. See script/timeline_events_audit.sql.
  const deleteEvent = useCallback(async (id) => {
    // optimistic remove; realtime/refetch reconciles
    setEvents((prev) => prev.filter((e) => e.id !== id));
    const { data, error } = await supabase
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    if (error) { alert("Couldn't delete that event: " + error.message); fetchEvents(); return; }
    // a blocked UPDATE comes back as "200, zero rows" rather than an error
    if (!data || data.length === 0) {
      alert("Couldn't delete that event — the database rejected the change. Has script/timeline_events_audit.sql been run?");
      fetchEvents();
    }
  }, [fetchEvents]);

  // ---- category filter ----
  const [activeCats, setActiveCats] = useState(() => {
    const o = {};
    CATEGORIES.forEach((c) => (o[c.id] = true));
    return o;
  });
  const visibleEvents = useMemo(() => events.filter((e) => activeCats[e.cat]), [events, activeCats]);

  // ---- view ----
  const [view, setView] = useState("calendar");
  const cardsRef = useRef(null);
  const calRef = useRef(null);

  // every month is rendered down the page, so "jump to today" scrolls the
  // PAGE to the current month rather than an inner scroll box.
  const scrollToCurrentMonth = useCallback((behavior = "auto") => {
    const target = calRef.current && calRef.current.querySelector(".cal-month.is-current");
    if (target) target.scrollIntoView({ behavior, block: "start" });
  }, []);

  // ---- collapsible sections ----
  const [collapsed, setCollapsed] = useState({});
  const toggleSection = useCallback((k) => setCollapsed((s) => ({ ...s, [k]: !s[k] })), []);
  const sectionHead = (label, k) => (
    <button type="button" className="section-label collapsible" aria-expanded={!collapsed[k]}
      onClick={() => toggleSection(k)}>
      <span className="chev">{collapsed[k] ? "▸" : "▾"}</span>{label}
    </button>
  );
  useEffect(() => {
    if (loading || collapsed.plan || view !== "cards") return;
    const target = cardsRef.current && cardsRef.current.querySelector(".is-current");
    if (target) target.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  }, [view, loading, events, collapsed.plan]);

  // no scroll-to-today on open any more: past months aren't rendered, so the
  // current month is already the first one. "Jump to today" still works after
  // you've scrolled ahead.

  // ---- modal ----
  const [form, setForm] = useState(EMPTY_FORM);
  const openModal = useCallback((prefillDate) => {
    const def = prefillDate || dateStr(now < arcStart ? arcStart : now > arcEnd ? arcEnd : now);
    setForm({ ...EMPTY_FORM, open: true, start: def });
    focusText();
  }, [now, arcStart, arcEnd]);
  // same dialog, prefilled from the row we're editing. `emoji` keeps the raw
  // stored value (blank = "inherit the category's emoji").
  const openEdit = useCallback((ev) => {
    setForm({
      open: true, id: ev.id, error: "",
      start: dateStr(ev.startD),
      end: sameDay(ev.startD, ev.endD) ? "" : dateStr(ev.endD),
      text: ev.text, emoji: ev.emoji || "", cat: ev.cat, person: ev.person, pending: ev.pending,
      titleAtOpen: ev.text,   // header keeps naming the event you clicked, even while you retype it
    });
    focusText();
  }, []);
  const closeModal = useCallback(() => setForm((f) => ({ ...f, open: false })), []);

  // ---- feedback ----
  // Writes to the insert-only `feedback` table; a scheduled GitHub Action turns
  // each new row into an issue. See script/feedback.sql.
  const [fb, setFb] = useState({ open: false, message: "", sending: false, sent: false, error: "" });
  const closeFb = useCallback(() => setFb((s) => ({ ...s, open: false })), []);
  const sendFeedback = useCallback(async () => {
    const message = fb.message.trim();
    if (!message) return setFb((s) => ({ ...s, error: "Write a little something first." }));
    if (message.length > 2000) return setFb((s) => ({ ...s, error: "That's a bit long — 2000 characters max." }));
    setFb((s) => ({ ...s, sending: true, error: "" }));
    // no .select() on purpose: there's no read policy, and asking for the row
    // back would make a successful insert look like a failure
    const { error } = await supabase.from(FEEDBACK_TABLE).insert({
      message,
      page: window.location.pathname,
      user_agent: navigator.userAgent.slice(0, 400),
    });
    if (error) return setFb((s) => ({ ...s, sending: false, error: error.message }));
    setFb((s) => ({ ...s, sending: false, sent: true, message: "" }));
  }, [fb.message]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { closeModal(); closeFb(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeModal, closeFb]);

  const saveEvent = useCallback(async () => {
    const startVal = form.start;
    const endVal = form.end || form.start;
    const text = form.text.trim();
    if (!startVal) return setForm((f) => ({ ...f, error: "Pick a start date." }));
    if (!text) return setForm((f) => ({ ...f, error: "Add a short description." }));
    const sD = parseDate(startVal), eD = parseDate(endVal);
    if (eD < sD) return setForm((f) => ({ ...f, error: "The end date can't be before the start date." }));
    if (sD < arcStart || eD > arcEnd)
      return setForm((f) => ({ ...f, error: `Those dates fall outside the timeline (${fmtShort(arcStart)} – ${fmtShort(arcEnd)}).` }));
    setSaving(true);
    const row = {
      start_date: startVal, end_date: endVal, category: form.cat, person: form.person,
      emoji: form.emoji.trim(), text, pending: form.pending,
    };
    // on edit we ask for the row back: Postgres/RLS answers a blocked UPDATE
    // with "200, zero rows" rather than an error, which would otherwise look
    // like a successful save that quietly changed nothing.
    const { data, error } = form.id
      ? await supabase.from(TABLE).update(row).eq("id", form.id).select("id")
      : await supabase.from(TABLE).insert(row);
    setSaving(false);
    if (error) return setForm((f) => ({
      ...f,
      error: error.code === "42703"
        ? "The database doesn't have the `pending` column yet — run script/timeline_events_pending.sql."
        : error.message,
    }));
    if (form.id && (!data || data.length === 0))
      return setForm((f) => ({ ...f, error: "The database wouldn't accept the edit — the table is missing an UPDATE policy, so nothing was changed." }));
    closeModal();
    fetchEvents();
  }, [form, arcStart, arcEnd, closeModal, fetchEvents]);

  // ---- calendar layout ----
  // A month is laid out week by week. Within a week an event becomes ONE bar
  // spanning its days (grid-column: start / span n) instead of a separate pill
  // per day — that's what gives the title room to be read. Bars that would
  // overlap get stacked into lanes, the way a real calendar does it.
  const weeksOf = useCallback((y, m) => {
    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const slots = [];
    for (let b = 0; b < firstDow; b++) slots.push(null);          // leading blanks
    for (let day = 1; day <= daysInMonth; day++) slots.push(new Date(y, m, day));
    while (slots.length % 7 !== 0) slots.push(null);              // trailing blanks
    const out = [];
    for (let i = 0; i < slots.length; i += 7) out.push(slots.slice(i, i + 7));
    return out;
  }, []);

  const barsForWeek = useCallback((week, monthEvents) => {
    const col = week.findIndex(Boolean);
    const firstD = week[col];
    const lastD = week[week.length - 1] || week.filter(Boolean).pop();
    if (!firstD) return { bars: [], lanes: 0 };

    const segs = monthEvents
      .filter((e) => e.endD >= firstD && e.startD <= lastD)
      .map((e) => {
        const from = e.startD < firstD ? firstD : e.startD;   // clipped to this week
        const to = e.endD > lastD ? lastD : e.endD;
        return {
          e,
          s: col + dayDiff(firstD, from),
          t: col + dayDiff(firstD, to),
          startsHere: sameDay(from, e.startD),
          endsHere: sameDay(to, e.endD),
        };
      })
      // longest first within a start column, so big spans land in the top lane
      .sort((a, b) => a.s - b.s || (b.t - b.s) - (a.t - a.s));

    const lanes = [];   // lanes[i] = segments already placed in that lane
    segs.forEach((seg) => {
      let lane = 0;
      while (lanes[lane] && lanes[lane].some((o) => seg.s <= o.t && seg.t >= o.s)) lane++;
      if (!lanes[lane]) lanes[lane] = [];
      lanes[lane].push(seg);
      seg.lane = lane;
    });
    return { bars: segs, lanes: lanes.length };
  }, []);

  // ---- per-month event helpers ----
  const overlapsMonth = useCallback((ev, y, m) => {
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    return ev.startD <= last && ev.endD >= first;
  }, []);
  const rangeLabel = useCallback((ev, y, m) => {
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    if (sameDay(ev.startD, ev.endD)) return String(ev.startD.getDate());
    const startsHere = ev.startD >= first, endsHere = ev.endD <= last;
    const a = ev.startD.getDate(), b = ev.endD.getDate();
    if (startsHere && endsHere) return `${a}–${b}`;
    if (!startsHere && endsHere) return `→ ${b}`;
    if (startsHere && !endsHere) return `${a} →`;
    return "all mo.";
  }, []);

  // ---- countdown ----
  // Exists ONLY during the separation, and counts UP toward the reunion (never
  // down toward a goodbye). Outside that window this is null and the section
  // isn't rendered at all.
  const status = useMemo(() => {
    const reunionDate = phases[phases.length - 1].startD;       // when we're together again
    const separationStart = phases[phases.length - 2].startD;   // when apart begins
    const apartPhase = phases[phases.length - 2];

    if (now >= separationStart && now < reunionDate) {
      const total = dayDiff(separationStart, reunionDate) || 1;
      const elapsed = clamp(dayDiff(separationStart, now), 0, total);
      const remaining = total - elapsed;
      const pct = Math.round((elapsed / total) * 100);
      return {
        mode: "countdown",
        color: apartPhase.color,
        title: `Together again in ${remaining} ${remaining === 1 ? "day" : "days"}`,
        range: `Reunion: ${fmtLong(reunionDate)}`,
        message: apartPhase.message,
        pct,
        stats: [
          [remaining, "days until we're together"],
          [elapsed, "days apart so far"],
          [pct + "%", "of the way there"],
        ],
      };
    }
    return null;
  }, [now, phases]);

  // live date summary under the modal title, follows the two date inputs
  const formDateLabel = useMemo(() => {
    if (!form.start) return "";
    const s = parseDate(form.start);
    const e = form.end ? parseDate(form.end) : s;
    return sameDay(s, e) ? fmtLong(s) : `${fmtLong(s)} → ${fmtLong(e)}`;
  }, [form.start, form.end]);

  if (loading) return <div className="tl"><div className="wrap"><p className="loading">Loading your timeline…</p></div></div>;

  return (
    <div className="tl">
      <div className="wrap">
        <header className="page-head">
          <h1>{PAGE.title}</h1>
          <p className="subtitle">{PAGE.subtitle}</p>
          <p className="today-line">Today is <strong>{fmtLong(now)}</strong>.</p>
        </header>

        {loadErr && (
          <p className="load-err">Couldn't load events: {loadErr}. (Is the <code>{TABLE}</code> table set up?)</p>
        )}

        {/* MONTHS / CALENDAR */}
        <section>
          {sectionHead("Calendar & months", "plan")}
          {!collapsed.plan && (<>
          <div className="toolbar">
            <div className="view-toggle">
              <button className={`tl-btn ${view === "calendar" ? "active" : ""}`} onClick={() => setView("calendar")}>Calendar</button>
              <button className={`tl-btn ${view === "cards" ? "active" : ""}`} onClick={() => setView("cards")}>Months</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {saving && <span className="saving-tag">saving…</span>}
              <button className="tl-btn primary" onClick={() => openModal()}>＋ Add event</button>
            </div>
          </div>

          <div className="cat-filter">
            {CATEGORIES.map((c) => (
              <button key={c.id} className={`cat-chip ${activeCats[c.id] ? "" : "off"}`}
                onClick={() => setActiveCats((s) => ({ ...s, [c.id]: !s[c.id] }))}>
                <span className="dot" style={{ background: c.color }} />{c.label}
              </button>
            ))}
          </div>

          <div className="people-legend">
            <span className="legend-label">Colored by</span>
            {PEOPLE.map((p) => (
              <span key={p.id} className="legend-item"><span className="dot" style={{ background: p.color }} />{p.label}</span>
            ))}
            <span className="legend-item"><span className="dash-key" />dashed = pending</span>
          </div>

          {/* past months are filtered out, so this empties once the arc ends */}
          {months.length === 0 && (
            <p className="cal-empty">The timeline has run its course — nothing ahead to show. 💛</p>
          )}

          {/* CARDS */}
          {months.length > 0 && view === "cards" && (
            <div className="view-cards">
              <p className="scroll-hint">← scroll sideways to move through the months →</p>
              <div className="months-scroll" ref={cardsRef}>
                {months.map(({ y, m }) => {
                  const key = `${y}-${pad(m + 1)}`;
                  const phase = phaseForMonth(y, m);
                  const ms = visibleEvents.filter((e) => overlapsMonth(e, y, m));
                  const noteData = NOTES[key];
                  return (
                    <div key={key} className={`month-card ${key === curMonthKey ? "is-current" : ""}`}
                      style={{ borderTopColor: phase ? phase.color : undefined }}>
                      <div className="m-head" style={{ background: phase ? phase.colorSoft : undefined }}>
                        <p className="m-name">{MONTH_NAMES[m]} {y}</p>
                        <p className="m-phase">{phase ? phase.label : " "}</p>
                        {key === curMonthKey && <span className="m-current-tag">This month</span>}
                      </div>
                      <div className="m-body">
                        <ul className="milestones">
                          {ms.length === 0 ? (
                            <li className="empty">No key dates yet — add one below.</li>
                          ) : ms.map((item) => {
                            const who = person(item.person);
                            const c = cat(item.cat);
                            return (
                              <li key={item.id} className={item.pending ? "is-pending" : ""} style={{ borderLeftColor: who.color }}
                                title={`${who.label} · ${c.label}${item.pending ? " · pending" : ""}` + (sameDay(item.startD, item.endD) ? "" : `  ·  ${fmtShort(item.startD)} – ${fmtShort(item.endD)}`)}>
                                <span className="m-day">{rangeLabel(item, y, m)}</span>
                                <span className="m-emoji">{evEmoji(item)}</span>
                                <button className="m-text" title="Edit this event" onClick={() => openEdit(item)}>
                                  {item.text}{item.pending && <span className="m-maybe">pending</span>}
                                </button>
                                <button className="ev-del" title="Delete" onClick={() => deleteEvent(item.id)}>✕</button>
                              </li>
                            );
                          })}
                        </ul>
                        <div className={`note-space ${noteData && (noteData.note || noteData.photo) ? "has-note" : ""}`}>
                          {noteData && (noteData.note || noteData.photo) ? (
                            <>
                              {noteData.note && <div>{noteData.note}</div>}
                              {noteData.photo && <img className="note-photo" src={noteData.photo} alt={`${MONTH_NAMES[m]} ${y}`} />}
                            </>
                          ) : "Notes & photos go here."}
                        </div>
                        <button className="m-add" onClick={() => {
                          let d = new Date(y, m, 1);
                          if (d < arcStart) d = new Date(arcStart);
                          if (d > arcEnd) d = new Date(arcEnd);
                          openModal(dateStr(d));
                        }}>＋ Add event</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CALENDAR */}
          {months.length > 0 && view === "calendar" && (
            <div className="view-calendar">
              <div className="cal-nav">
                <button className="cal-today" onClick={() => scrollToCurrentMonth("smooth")}>Jump to today</button>
              </div>
              <div className="calendar" ref={calRef}>
                {months.map(({ y, m }) => {
                  const key = `${y}-${pad(m + 1)}`;
                  const phase = phaseForMonth(y, m);
                  const monthEvents = visibleEvents.filter((e) => overlapsMonth(e, y, m));
                  return (
                    <div key={key} className={`cal-month ${key === curMonthKey ? "is-current" : ""}`}
                      style={{ borderTop: phase ? `6px solid ${phase.color}` : undefined }}>
                      <div className="cal-month-head" style={{ background: phase ? phase.colorSoft : undefined }}>
                        <h3>{MONTH_NAMES[m]} {y}</h3>
                        <span className="cal-phase">{phase ? phase.label : ""}</span>
                      </div>
                      <div className="cal-grid">
                        {WEEKDAYS.map((w) => <div key={w} className="cal-weekday">{w}</div>)}
                      </div>
                      <div className="cal-weeks">
                        {weeksOf(y, m).map((week, wi) => {
                          const { bars, lanes } = barsForWeek(week, monthEvents);
                          return (
                            <div key={wi} className="cal-week"
                              // explicit rows: one for the date numbers, one per event lane.
                              // day cells span 1/-1, which only counts EXPLICIT rows.
                              style={{ gridTemplateRows: `var(--daynum-h) repeat(${Math.max(lanes, 1)}, minmax(var(--bar-h), auto))` }}>
                              {week.map((d, i) => {
                                if (!d) return <div key={`b${i}`} className="cal-cell blank" style={{ gridColumn: i + 1 }} />;
                                const inArc = d >= arcStart && d <= arcEnd;
                                const dayPhase = phaseForDate(d);
                                return (
                                  <div key={`d${i}`} className={`cal-cell ${!inArc ? "out" : ""} ${sameDay(d, now) ? "today" : ""}`}
                                    style={{ gridColumn: i + 1, background: inArc && dayPhase ? dayPhase.colorSoft : undefined }}
                                    onClick={inArc ? () => openModal(dateStr(d)) : undefined}>
                                    <div className="cal-daynum">{d.getDate()}</div>
                                  </div>
                                );
                              })}
                              {bars.map((seg) => {
                                const e = seg.e;
                                const who = person(e.person);
                                const c = cat(e.cat);
                                const days = seg.t - seg.s + 1;
                                return (
                                  <div key={e.id} role="button" tabIndex={0}
                                    className={`cal-event cal-bar span-${days} ${seg.startsHere ? "" : "cont-left"} ${seg.endsHere ? "" : "cont-right"} ${e.pending ? "is-pending" : ""}`}
                                    style={{
                                      gridColumn: `${seg.s + 1} / span ${days}`,
                                      gridRow: seg.lane + 2,
                                      background: hexToRgba(who.color, e.pending ? 0.1 : 0.22),
                                      // the accent spine belongs only where the event actually starts
                                      borderLeftColor: seg.startsHere ? who.color : "transparent",
                                    }}
                                    title={`${who.label} · ${c.label}${e.pending ? " · pending" : ""} · ${e.text}${sameDay(e.startD, e.endD) ? "" : `  (${fmtShort(e.startD)} – ${fmtShort(e.endD)})`}\nClick to edit`}
                                    onClick={(evt) => { evt.stopPropagation(); openEdit(e); }}
                                    onKeyDown={(evt) => {
                                      if (evt.key === "Enter" || evt.key === " ") { evt.preventDefault(); evt.stopPropagation(); openEdit(e); }
                                    }}>
                                    <span className="cal-ev-emoji">{evEmoji(e)}</span>
                                    <span className="cal-ev-text">{e.text}</span>
                                    <button className="cal-ev-del" title="Delete"
                                      onClick={(evt) => { evt.stopPropagation(); deleteEvent(e.id); }}>✕</button>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>)}
        </section>

        {/* COUNTDOWN — only while apart. The old "Right now" phase-message
            version of this card is gone; nothing shows outside the countdown. */}
        {status && (
        <section>
          {sectionHead("Countdown", "now")}
          {!collapsed.now && (
          <div className="focus-card" style={{ borderLeftColor: status.color }}>
            <div className="focus-head">
              <h2>{status.title}</h2>
              {status.range && <span className="focus-range">{status.range}</span>}
            </div>
            <p className="focus-message">{status.message}</p>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${status.pct}%`, background: status.color }} />
            </div>
            <div className="progress-stats">
              {status.stats.map(([num, capLabel], i) => (
                <div key={i} className="stat"><span className="num">{num}</span><span className="cap">{capLabel}</span></div>
              ))}
            </div>
          </div>
          )}
        </section>
        )}

        <footer className="page-foot">{PAGE.footer}</footer>
      </div>

      {/* floats bottom-right, above the page but under the modal overlay */}
      <button type="button" className="fb-launch" aria-label="Send feedback"
        onClick={() => setFb({ open: true, message: "", name: "", sending: false, sent: false, error: "" })}>
        <span className="fb-launch-icon">💬</span>
        <span className="fb-launch-text">Feedback</span>
      </button>

      {/* ADD / EDIT EVENT MODAL — same form both ways; form.id decides which */}
      {form.open && (
        <div className="tl-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <form className="tl-modal" onSubmit={(e) => { e.preventDefault(); saveEvent(); }}>
            {/* what you clicked, up top, so the dialog names the event */}
            <div className="modal-head">
              <span className="modal-eyebrow">{form.id ? "Editing" : "New event"}</span>
              <h3>
                <span className="modal-head-emoji">{evEmoji({ emoji: form.emoji, cat: form.cat })}</span>
                {form.id ? (form.titleAtOpen || "Untitled event") : "Add an event"}
                {form.pending && <span className="m-maybe">pending</span>}
              </h3>
              {formDateLabel && <p className="modal-sub">{formDateLabel}</p>}
            </div>

            <label htmlFor="tl-ev-text">What's happening?</label>
            <input id="tl-ev-text" type="text" maxLength={80} placeholder="e.g. Spring break, finals week, Christmas…"
              value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} />

            <label htmlFor="tl-ev-emoji">Emoji <span className="sub">(optional — defaults to the category's)</span></label>
            <input id="tl-ev-emoji" type="text" maxLength={4} placeholder="🌸"
              value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} />
            <div className="emoji-row">
              {EMOJI_PALETTE.map((em) => (
                <button type="button" key={em} className="emoji-chip"
                  onClick={() => setForm((f) => ({ ...f, emoji: em }))}>{em}</button>
              ))}
            </div>

            <label>Whose event?</label>
            <div className="cat-pick">
              {PEOPLE.map((p) => (
                <button type="button" key={p.id}
                  className={`cat-pick-chip ${form.person === p.id ? "selected" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, person: p.id }))}>
                  <span className="dot" style={{ background: p.color }} />{p.label}
                </button>
              ))}
            </div>

            <label>Category</label>
            <div className="cat-pick">
              {CATEGORIES.map((c) => (
                <button type="button" key={c.id}
                  className={`cat-pick-chip ${form.cat === c.id ? "selected" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, cat: c.id, emoji: f.emoji || c.emoji }))}>
                  <span className="dot" style={{ background: c.color }} />{c.emoji} {c.label}
                </button>
              ))}
            </div>

            <label>How sure is it?</label>
            <div className="cat-pick">
              <button type="button"
                className={`cat-pick-chip ${form.pending ? "" : "selected"}`}
                onClick={() => setForm((f) => ({ ...f, pending: false }))}>✓ Confirmed</button>
              <button type="button"
                className={`cat-pick-chip ${form.pending ? "selected" : ""}`}
                onClick={() => setForm((f) => ({ ...f, pending: true }))}>? Pending</button>
            </div>

            <div className="date-row">
              <div>
                <label htmlFor="tl-ev-start">Start date</label>
                <input id="tl-ev-start" type="date" min={dateStr(arcStart)} max={dateStr(arcEnd)}
                  value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="tl-ev-end">End date <span className="sub">(optional)</span></label>
                <input id="tl-ev-end" type="date" min={dateStr(arcStart)} max={dateStr(arcEnd)}
                  value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} />
              </div>
            </div>

            <div className="modal-err">{form.error}</div>
            <div className="modal-actions">
              {form.id && (
                /* the only delete that works on touch — the calendar's ✕ is hover-only */
                <button type="button" className="tl-btn danger" disabled={saving}
                  onClick={() => { const id = form.id; closeModal(); deleteEvent(id); }}>Delete</button>
              )}
              <button type="button" className="tl-btn" onClick={closeModal}>Cancel</button>
              <button type="submit" className="tl-btn primary" disabled={saving}>
                {saving ? "Saving…" : form.id ? "Save changes" : "Save event"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FEEDBACK MODAL — one row into `feedback`, which a scheduled GitHub
          Action files as an issue on ctran37/celinedtran */}
      {fb.open && (
        <div className="tl-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeFb(); }}>
          <form className="tl-modal" onSubmit={(e) => { e.preventDefault(); sendFeedback(); }}>
            <div className="modal-head">
              <span className="modal-eyebrow">Feedback</span>
              <h3>{fb.sent ? "Thank you 💛" : "What could be better?"}</h3>
              <p className="modal-sub">
                {fb.sent
                  ? "It's saved — it'll turn up as a GitHub issue within the hour."
                  : "Bugs, ideas, anything that feels off."}
              </p>
            </div>

            {fb.sent ? (
              <div className="modal-actions">
                <button type="button" className="tl-btn primary" onClick={closeFb}>Close</button>
              </div>
            ) : (
              <>
                <label htmlFor="tl-fb-msg">Your note <span className="sub">(anonymous)</span></label>
                <textarea id="tl-fb-msg" rows={5} maxLength={2000} autoFocus
                  placeholder="The calendar looks squished on my phone…"
                  value={fb.message} onChange={(e) => setFb((s) => ({ ...s, message: e.target.value }))} />

                <p className="fb-note">
                  No name is attached. Heads up though: the repo is public, so this
                  becomes a public GitHub issue.
                </p>

                <div className="modal-err">{fb.error}</div>
                <div className="modal-actions">
                  <button type="button" className="tl-btn" onClick={closeFb}>Cancel</button>
                  <button type="submit" className="tl-btn primary" disabled={fb.sending}>
                    {fb.sending ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
}