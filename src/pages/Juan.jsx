import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  PAGE, PHASES, CATEGORIES, PEOPLE, NOTES, EMOJI_PALETTE,
  parseDate, stripTime, dayDiff, sameDay, clamp, pad, monthKey, dateStr,
  hexToRgba, MONTH_NAMES, WEEKDAYS, fmtShort, fmtLong,
} from "../lib/timelineConfig.js";
import "./juan.css";

const TABLE = "timeline_events";
// `id: null` means "adding"; an id means "editing that row".
const EMPTY_FORM = { open: false, id: null, start: "", end: "", text: "", emoji: "", cat: CATEGORIES[0].id, person: PEOPLE[0].id, error: "" };

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
  const activePhase = useMemo(() => {
    for (const p of phases) if (now >= p.startD && now < p.endD) return p;
    return null;
  }, [phases, now]);

  const months = useMemo(() => {
    const out = [];
    let c = new Date(arcStart.getFullYear(), arcStart.getMonth(), 1);
    const last = new Date(arcEnd.getFullYear(), arcEnd.getMonth(), 1);
    while (c <= last) {
      out.push({ y: c.getFullYear(), m: c.getMonth() });
      c = new Date(c.getFullYear(), c.getMonth() + 1, 1);
    }
    return out;
  }, [arcStart, arcEnd]);

  // ---- data ----
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    const rows = () => supabase
      .from(TABLE)
      .select("id, start_date, end_date, category, person, emoji, text");
    // soft-deleted rows stay in the table, just hidden here
    let { data, error } = await rows().is("deleted_at", null).order("start_date", { ascending: true });
    // 42703 = no such column, i.e. timeline_events_audit.sql hasn't been run
    // yet. Fall back to the unfiltered query so the page still renders.
    if (error && error.code === "42703") {
      console.warn("timeline: no deleted_at column — run script/timeline_events_audit.sql");
      ({ data, error } = await rows().order("start_date", { ascending: true }));
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
      return { id: r.id, startD: sD, endD: eD, cat: normCat(r.category), person: normPerson(r.person), emoji: r.emoji || "", text: r.text || "" };
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

  // the calendar renders every month in one scrollable column; this just
  // tells us which one to scroll to (and lets "Jump to today" work).
  const scrollToCurrentMonth = useCallback((behavior = "auto") => {
    const box = calRef.current;
    const target = box && box.querySelector(".cal-month.is-current");
    if (!box || !target) return;
    box.scrollTo({ top: target.offsetTop - box.offsetTop, behavior });
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

  // open the calendar already parked on this month
  useEffect(() => {
    if (loading || collapsed.plan || view !== "calendar") return;
    scrollToCurrentMonth("instant");
  }, [view, loading, collapsed.plan, scrollToCurrentMonth]);

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
      text: ev.text, emoji: ev.emoji || "", cat: ev.cat, person: ev.person,
    });
    focusText();
  }, []);
  const closeModal = useCallback(() => setForm((f) => ({ ...f, open: false })), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeModal]);

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
      start_date: startVal, end_date: endVal, category: form.cat, person: form.person, emoji: form.emoji.trim(), text,
    };
    // on edit we ask for the row back: Postgres/RLS answers a blocked UPDATE
    // with "200, zero rows" rather than an error, which would otherwise look
    // like a successful save that quietly changed nothing.
    const { data, error } = form.id
      ? await supabase.from(TABLE).update(row).eq("id", form.id).select("id")
      : await supabase.from(TABLE).insert(row);
    setSaving(false);
    if (error) return setForm((f) => ({ ...f, error: error.message }));
    if (form.id && (!data || data.length === 0))
      return setForm((f) => ({ ...f, error: "The database wouldn't accept the edit — the table is missing an UPDATE policy, so nothing was changed." }));
    closeModal();
    fetchEvents();
  }, [form, arcStart, arcEnd, closeModal, fetchEvents]);

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

  // ---- status / countdown ----
  // The countdown only exists during the separation, and it counts UP toward
  // the reunion (never down toward a goodbye). Before/after that, we just show
  // a warm message with no numbers.
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
    if (activePhase) {
      return { mode: "message", color: activePhase.color, title: activePhase.label, message: activePhase.message };
    }
    if (now < arcStart) {
      return { mode: "message", color: phases[0].color, title: "Almost time", message: "Our time together starts soon. 🌱" };
    }
    return { mode: "message", color: phases[phases.length - 1].color, title: "Full circle", message: "We made it all the way through. 💛" };
  }, [activePhase, now, arcStart, phases]);

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
          </div>

          {/* CARDS */}
          {view === "cards" && (
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
                              <li key={item.id} style={{ borderLeftColor: who.color }}
                                title={`${who.label} · ${c.label}` + (sameDay(item.startD, item.endD) ? "" : `  ·  ${fmtShort(item.startD)} – ${fmtShort(item.endD)}`)}>
                                <span className="m-day">{rangeLabel(item, y, m)}</span>
                                <span className="m-emoji">{evEmoji(item)}</span>
                                <button className="m-text" title="Edit this event" onClick={() => openEdit(item)}>{item.text}</button>
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
          {view === "calendar" && (
            <div className="view-calendar">
              <div className="cal-nav">
                <p className="scroll-hint">↕ scroll to move through the months</p>
                <button className="cal-today" onClick={() => scrollToCurrentMonth("smooth")}>Jump to today</button>
              </div>
              <div className="calendar" ref={calRef}>
                {months.map(({ y, m }) => {
                  const key = `${y}-${pad(m + 1)}`;
                  const phase = phaseForMonth(y, m);
                  const monthEvents = visibleEvents.filter((e) => overlapsMonth(e, y, m));
                  const firstDow = new Date(y, m, 1).getDay();
                  const daysInMonth = new Date(y, m + 1, 0).getDate();
                  const cells = [];
                  for (let b = 0; b < firstDow; b++) cells.push(<div key={`b${b}`} className="cal-cell blank" />);
                  for (let day = 1; day <= daysInMonth; day++) {
                    const d = new Date(y, m, day);
                    const inArc = d >= arcStart && d <= arcEnd;
                    const dayPhase = phaseForDate(d);
                    const isToday = sameDay(d, now);
                    const dayEvents = monthEvents.filter((e) => d >= e.startD && d <= e.endD);
                    cells.push(
                      <div key={`d${day}`} className={`cal-cell ${!inArc ? "out" : ""} ${isToday ? "today" : ""}`}
                        style={{ background: inArc && dayPhase ? dayPhase.colorSoft : undefined }}
                        onClick={inArc ? () => openModal(dateStr(d)) : undefined}>
                        <div className="cal-daynum">{day}</div>
                        {dayEvents.map((e) => {
                          const who = person(e.person);
                          const c = cat(e.cat);
                          const isStart = sameDay(d, e.startD), isEnd = sameDay(d, e.endD);
                          const type = isStart && isEnd ? "single" : isStart ? "start" : isEnd ? "end" : "mid";
                          const showLabel = type === "single" || type === "start";
                          return (
                            <div key={e.id} className={`cal-event seg-${type}`} role="button" tabIndex={0}
                              style={{ background: hexToRgba(who.color, 0.22), borderLeftColor: who.color }}
                              title={`${who.label} · ${c.label} · ${e.text}${sameDay(e.startD, e.endD) ? "" : `  (${fmtShort(e.startD)} – ${fmtShort(e.endD)})`}\nClick to edit`}
                              onClick={(evt) => { evt.stopPropagation(); openEdit(e); }}
                              onKeyDown={(evt) => {
                                if (evt.key === "Enter" || evt.key === " ") { evt.preventDefault(); evt.stopPropagation(); openEdit(e); }
                              }}>
                              {showLabel ? (
                                <>
                                  {/* the text hides on narrow screens; the emoji stays as the marker */}
                                  <span className="cal-ev-emoji">{evEmoji(e)}</span>
                                  <span className="cal-ev-text">{e.text}</span>
                                  <button className="cal-ev-del" title="Delete"
                                    onClick={(evt) => { evt.stopPropagation(); deleteEvent(e.id); }}>✕</button>
                                </>
                              ) : " "}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                  return (
                    <div key={key} className={`cal-month ${key === curMonthKey ? "is-current" : ""}`}
                      style={{ borderTop: phase ? `6px solid ${phase.color}` : undefined }}>
                      <div className="cal-month-head" style={{ background: phase ? phase.colorSoft : undefined }}>
                        <h3>{MONTH_NAMES[m]} {y}</h3>
                        <span className="cal-phase">{phase ? phase.label : ""}</span>
                      </div>
                      <div className="cal-grid">
                        {WEEKDAYS.map((w) => <div key={w} className="cal-weekday">{w}</div>)}
                        {cells}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>)}
        </section>

        {/* COUNTDOWN — below the calendar, and only during the time apart */}
        <section>
          {sectionHead(status.mode === "countdown" ? "Countdown" : "Right now", "now")}
          {!collapsed.now && (
          <div className="focus-card" style={{ borderLeftColor: status.color }}>
            <div className="focus-head">
              <h2>{status.title}</h2>
              {status.range && <span className="focus-range">{status.range}</span>}
            </div>
            <p className="focus-message">{status.message}</p>
            {status.mode === "countdown" && (
              <>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${status.pct}%`, background: status.color }} />
                </div>
                <div className="progress-stats">
                  {status.stats.map(([num, capLabel], i) => (
                    <div key={i} className="stat"><span className="num">{num}</span><span className="cap">{capLabel}</span></div>
                  ))}
                </div>
              </>
            )}
          </div>
          )}
        </section>

        <footer className="page-foot">{PAGE.footer}</footer>
      </div>

      {/* ADD / EDIT EVENT MODAL — same form both ways; form.id decides which */}
      {form.open && (
        <div className="tl-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <form className="tl-modal" onSubmit={(e) => { e.preventDefault(); saveEvent(); }}>
            <h3>{form.id ? "Edit event" : "Add an event"}</h3>

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
    </div>
  );
}