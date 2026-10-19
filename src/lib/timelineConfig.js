// ============================================================
//  Timeline configuration — the structural bits that live in
//  code (they rarely change). EVENTS live in Supabase now, so
//  they can be shared between devices and added/removed in-app.
//
//  Safe to edit: phase dates/labels/colors, categories, notes,
//  and the page copy below.
// ============================================================

export const PAGE = {
  title: "Our Calendar",
  footer: "Made with love 💛",
};

// There are only ever two states: we're together, or we're away from each
// other. Every day on the calendar is tinted with one of these two. The tint is
// the ONLY background color in the calendar — the grid, borders and headings
// stay gray (see juan.css), so the day tint and the event bars are what carry
// color. Keep both `colorSoft` values pale: event bars are drawn on top of them.
// Yellow means together, blue means apart.
//
// `colorSoft` is the day-cell fill and does the real work. The two are far
// enough apart (ΔE ≈ 34) to tell at a glance, and both are kept pale: event
// bars are drawn over them at 30% alpha and have to stay legible — including
// Juan's blue bar sitting on a blue day, which is the tightest case here.
// Deepening either much further starts to swallow the bars.
// `colorSoft` is the original yellow lightened over white, so the day tint is
// recognisably the same yellow rather than a new one.
export const STATES = {
  together: { id: "together", label: "Together", color: "#e8a56b", colorSoft: "#f6ddc4" },
  away:     { id: "away",     label: "Apart",    color: "#3f82b5", colorSoft: "#cfe0ee" },
};

// An event marked "Both of us" says the two of you are in the same place, so
// its days go yellow even in the middle of the apart stretch — that's what
// makes a "Juan visits" event light up its days with no extra marking. An event
// belonging to just ONE of you says the opposite: you're apart for those days,
// so they go blue even in the middle of a together stretch.
export const TOGETHER_PERSON = "both";

// The three phases. Dates are "YYYY-MM-DD", back-to-back in time, and `end` is
// EXCLUSIVE — it's the same day as the next phase's `start`, and that day
// belongs to the NEXT phase. So "apart" starting 2026-08-24 means Aug 24 is the
// first day away, and Dec 18 is the first day back together.
//
// `state` is the baseline for every day in the phase. Individual events can
// flip a single day away from that baseline — see STATE_CATEGORIES below.
export const PHASES = [
  {
    id: "together-now",
    label: "Together now",
    start: "2026-07-08",
    end: "2026-08-24",
    state: "together",
    color: STATES.together.color,
    colorSoft: STATES.together.colorSoft,
    message: "We're in it together right now. Soak it up. 🌞",
  },
  {
    id: "apart",
    label: "Apart",
    start: "2026-08-24",
    end: "2026-12-13",
    state: "away",
    color: STATES.away.color,
    colorSoft: STATES.away.colorSoft,
    message:
      "This is the stretch apart — but it's a chapter, not the story. Every day is one day closer. 💌",
  },
  {
    id: "together-after",
    label: "Together after",
    start: "2026-12-18",
    end: "2027-05-31",
    state: "together",
    color: STATES.together.color,
    colorSoft: STATES.together.colorSoft,
    message: "Back together again — and this stretch is the longest of all. 🌸",
  },
];

// Event categories. `id` is stored on each event row in Supabase.
// Any id that isn't listed here (older rows: visit / call / birthday /
// milestone) falls back to "other", so nothing already saved disappears.
//
// "Together" and "Apart" are special: they don't just label an event, they
// RE-TINT the days they cover (see STATE_CATEGORIES). Most of the time you
// won't need them — marking an event "Both of us" is enough to turn its days
// green. Reach for "Apart" when you're separated during a together stretch.
// `holiday` must stay first: it's the dialog's default.
export const CATEGORIES = [
  { id: "holiday", label: "Holiday", emoji: "🎄", color: "#c56b4a" },
  { id: "vacation", label: "Vacation", emoji: "✈️", color: "#7fa15a" },
  { id: "schoolwork", label: "School/Work", emoji: "📚", color: "#5a8fa1" },
  { id: "together", label: "Together", emoji: "💛", color: STATES.together.color },
  { id: "away", label: "Apart", emoji: "🛫", color: STATES.away.color },
  { id: "other", label: "Other", emoji: "📅", color: "#8a7d73" },
];

// Which categories re-tint the days they cover, and to what state. Combined
// with TOGETHER_PERSON above, a day can pick up a "together" signal, an "away"
// signal, or both. Whichever one CONTRADICTS the phase baseline wins: an
// "Apart" event inside a together stretch makes those days red, and a "Both of
// us" (or "Together") event inside the apart stretch makes those days green.
// That's the whole point of them, so they beat every other event on the day.
export const STATE_CATEGORIES = { together: "together", away: "away" };

// Who an event belongs to. Event BARS are colored by person (category still
// supplies the emoji): green when it's both of us, blue for Juan's, yellow for
// Celine's. The day tint underneath them comes from STATES, not from here.
// The first entry is the default selection in the add-event dialog.
export const PEOPLE = [
  { id: "both", label: "Both of us", color: "#3f9c56" },
  { id: "celine", label: "Celine", color: "#e0b32a" },
  { id: "juan", label: "Juan", color: "#2f7fb5" },
];

// Optional per-month notes/photos, keyed by "YYYY-MM".
export const NOTES = {
  // "2026-08": { note: "Last weekend before the airport.", photo: "" },
};

// (There used to be an EMOJI_PALETTE of quick-pick emojis here. The dialog now
// takes any emoji straight from the OS emoji keyboard, so the preset list is
// gone — each CATEGORY above still supplies the default emoji for its events.)

// ---------- shared date helpers ----------
export function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
const MS_PER_DAY = 86400000;
export function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function dayDiff(a, b) {
  return Math.round((stripTime(b) - stripTime(a)) / MS_PER_DAY);
}
export function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
export function pad(n) {
  return String(n).padStart(2, "0");
}
export function monthKey(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1);
}
export function dateStr(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
export function hexToRgba(hex, a) {
  let h = String(hex).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return `rgba(197,107,74,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export function fmtShort(d) { return MONTH_SHORT[d.getMonth()] + " " + d.getDate(); }
export function fmtLong(d) { return MONTH_NAMES[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear(); }
