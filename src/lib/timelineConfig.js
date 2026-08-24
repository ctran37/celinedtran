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

// The three phases. Dates are "YYYY-MM-DD", back-to-back in time.
// These drive the focus card, the calendar's phase colors, and the
// month labels — the overview bar was removed, but this data is still used.
//
// The phase colors are deliberately GRAY: the calendar is meant to be a
// neutral backdrop so the only color in it comes from the events themselves
// (see PEOPLE below). Keep them gray unless you want the phase tint back.
export const PHASES = [
  {
    id: "together-now",
    label: "Together now",
    start: "2026-07-08",
    end: "2026-08-22",
    color: "#9e9e9e",
    colorSoft: "#f1f1f1",
    message: "We're in it together right now. Soak it up. 🌞",
  },
  {
    id: "apart",
    label: "Apart",
    start: "2026-08-22",
    end: "2026-12-18",
    color: "#9e9e9e",
    colorSoft: "#f1f1f1",
    message:
      "This is the stretch apart — but it's a chapter, not the story. Every day is one day closer. 💌",
  },
  {
    id: "together-after",
    label: "Together after",
    start: "2026-12-18",
    end: "2027-05-31",
    color: "#9e9e9e",
    colorSoft: "#f1f1f1",
    message: "Back together again — and this stretch is the longest of all. 🌸",
  },
];

// Event categories. `id` is stored on each event row in Supabase.
// Any id that isn't listed here (older rows: visit / call / birthday /
// milestone) falls back to "other", so nothing already saved disappears.
export const CATEGORIES = [
  { id: "holiday", label: "Holiday", emoji: "🎄", color: "#c56b4a" },
  { id: "vacation", label: "Vacation", emoji: "✈️", color: "#7fa15a" },
  { id: "schoolwork", label: "School/Work", emoji: "📚", color: "#5a8fa1" },
  { id: "other", label: "Other", emoji: "📅", color: "#8a7d73" },
];

// Who an event belongs to. In the calendar, events are COLORED by
// person (category still supplies the emoji) — and they're the ONLY thing
// with color on an otherwise gray calendar: green when we're together,
// blue for Juan's, yellow for Celine's. The first entry is the default
// selection in the add-event dialog.
export const PEOPLE = [
  { id: "both", label: "Both of us", color: "#3f9c56" },
  { id: "celine", label: "Celine", color: "#e0b32a" },
  { id: "juan", label: "Juan", color: "#2f7fb5" },
];

// Optional per-month notes/photos, keyed by "YYYY-MM".
export const NOTES = {
  // "2026-08": { note: "Last weekend before the airport.", photo: "" },
};

// Suggested quick-pick emojis in the add-event dialog.
export const EMOJI_PALETTE = ["💛", "✈️", "🎄", "📚", "💼", "🏖️", "🤗", "🎂", "🌸", "🎁", "📅", "🌞"];

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
