// Halloween bar-crawl bingo: squares, boards and scoring. Everything here is
// pure, so a board (and a score) can be rebuilt from a seed + the ticked marks.

// One shared game for everyone, so there's no room code to type.
export const ROOM = "halloween-2026";

export const BARS = 8;            // max bars you can step through
export const BINGO_BONUS = 5;     // per completed line, scored to the bar that finished it
export const BLACKOUT_BONUS = 15; // all 24 squares
export const FREE = -1;           // centre square

// pts: 1 = everywhere, 3 = takes some spotting, 5 = rare
export const POOL = [
  { t: "Witch", p: 1 },
  { t: "Vampire", p: 1 },
  { t: "Ghost", p: 1 },
  { t: "Skeleton", p: 1 },
  { t: "Cat ears / cat costume", p: 1 },
  { t: "Devil", p: 1 },
  { t: "Angel", p: 1 },
  { t: "Pumpkin", p: 1 },
  { t: "Zombie", p: 1 },
  { t: "Cowboy / cowgirl", p: 1 },
  { t: "Mummy", p: 1 },
  { t: "Someone in face paint", p: 1 },
  { t: "Glow stick or LED accessory", p: 1 },
  { t: "Orange & black outfit (no costume)", p: 1 },
  { t: "Bartender in costume", p: 1 },
  { t: "Spooky drink name ordered", p: 1 },
  { t: "Barbie / Ken", p: 3 },
  { t: "Couples costume", p: 3 },
  { t: "Group costume (3+)", p: 3 },
  { t: "Movie villain", p: 3 },
  { t: "Superhero", p: 3 },
  { t: "Beetlejuice", p: 3 },
  { t: "Pop star costume", p: 3 },
  { t: "Costume that's a pun", p: 3 },
  { t: "Someone who clearly didn't dress up", p: 3 },
  { t: "Halloween song plays (Thriller / Monster Mash)", p: 3 },
  { t: "Bar has Halloween decor", p: 3 },
  { t: "Stranger compliments your costume", p: 3 },
  { t: "Fake blood", p: 3 },
  { t: "Dog in costume", p: 3 },
  { t: "Inflatable costume", p: 3 },
  { t: "Taylor Swift", p: 3 },
  { t: "Someone dressed as a food", p: 3 },
  { t: "Selfie with a stranger in costume", p: 5 },
  { t: "Two people in the same costume", p: 5 },
  { t: "Costume malfunction", p: 5 },
  { t: "Full-body animal onesie", p: 5 },
  { t: "Someone in costume is asleep", p: 5 },
  { t: "Same costume as yourself", p: 3 },
];

// ---- seeded board -------------------------------------------------------

function hash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 25 cells, row-major; cell 12 is FREE. Same seed -> same board, so a refresh
// (or a second phone) can't reroll it.
export function makeBoard(seed) {
  const rand = mulberry32(hash(seed)());
  const idx = POOL.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const cells = idx.slice(0, 24);
  cells.splice(12, 0, FREE);
  return cells;
}

const LINES = [
  ...Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => r * 5 + c)),
  ...Array.from({ length: 5 }, (_, c) => Array.from({ length: 5 }, (_, r) => r * 5 + c)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

// marks: [{ square, bar }]. Returns points per bar plus line / square counts.
// Bonuses go to the bar that completed the line, so unticking is always safe.
export function scoreBoard(board, marks) {
  const barOf = new Map(marks.map((m) => [m.square, m.bar]));
  const perBar = {};
  const add = (bar, pts) => { perBar[bar] = (perBar[bar] ?? 0) + pts; };

  for (const [sq, bar] of barOf) add(bar, POOL[sq]?.p ?? 0);

  const finishedAt = (cells) => {
    let bar = 0;
    for (const sq of cells) {
      if (sq === FREE) continue;
      if (!barOf.has(sq)) return null;
      bar = Math.max(bar, barOf.get(sq));
    }
    return bar;
  };

  let lines = 0;
  for (const line of LINES) {
    const bar = finishedAt(line.map((i) => board[i]));
    if (bar !== null) { lines++; add(bar, BINGO_BONUS); }
  }
  const blackout = finishedAt(board);
  if (blackout !== null) add(blackout, BLACKOUT_BONUS);

  const total = Object.values(perBar).reduce((a, b) => a + b, 0);
  return { perBar, total, lines, squares: barOf.size, blackout: blackout !== null };
}
