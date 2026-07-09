// ============================================================
//  Timeline configuration — the structural bits that live in
//  code (they rarely change). EVENTS live in Supabase now, so
//  they can be shared between devices and added/removed in-app.
//
//  Safe to edit: phase dates/labels/colors, categories, notes,
//  and the page copy below.
// ============================================================

export const PAGE = {
  title: "Our Timeline",
  subtitle: "One continuous arc — together, apart, and together forever.",
  footer: "Made with love 💛",
};

// The three phases. Dates are "YYYY-MM-DD", back-to-back in time.
// These drive the focus card, the calendar's phase colors, and the
// month labels — the overview bar was removed, but this data is still used.
export const PHASES = [
  {
    id: "together-now",
    label: "Together now",
    start: "2026-07-08",
    end: "2026-08-22",
    color: "#e8a56b",
    colorSoft: "#f6ddc4",
    message: "We're in it together right now. Soak it up. 🌞",
  },
  {
    id: "apart",
    label: "Apart",
    start: "2026-08-22",
    end: "2026-12-18",
    color: "#9db4c0",
    colorSoft: "#dde7ec",
    message:
      "This is the stretch apart — but it's a chapter, not the story. Every day is one day closer. 💌",
  },
  {
    id: "together-after",
    label: "Together after",
    start: "2026-12-18",
    end: "2027-05-31",
    color: "#cf8fa9",
    colorSoft: "#efd7e0",
    message: "Back together again — and this stretch is the longest of all. 🌸",
  },
];

// Event categories. `id` is stored on each event row in Supabase.
export const CATEGORIES = [
  { id: "visit", label: "Visit", emoji: "✈️", color: "#7fa15a" },
  { id: "call", label: "Call", emoji: "📞", color: "#5a8fa1" },
  { id: "birthday", label: "Birthday", emoji: "🎂", color: "#c98aa8" },
  { id: "holiday", label: "Holiday", emoji: "🎄", color: "#c56b4a" },
  { id: "milestone", label: "Milestone", emoji: "💛", color: "#d8a24a" },
  { id: "other", label: "Other", emoji: "📅", color: "#8a7d73" },
];

// Who an event belongs to. In the calendar, events are COLORED by
// person (category still supplies the emoji). The first entry is the
// default selection in the add-event dialog.
export const PEOPLE = [
  { id: "both", label: "Both of us", color: "#a3789c" },
  { id: "celine", label: "Celine", color: "#c05b8c" },
  { id: "juan", label: "Juan", color: "#3d7a99" },
];

// Optional per-month notes/photos, keyed by "YYYY-MM".
export const NOTES = {
  // "2026-08": { note: "Last weekend before the airport.", photo: "" },
};

// Suggested quick-pick emojis in the add-event dialog.
export const EMOJI_PALETTE = ["💛", "📞", "✈️", "🤗", "🎂", "🎄", "🌸", "🍷", "🎁", "📅", "❤️", "🌞"];

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
