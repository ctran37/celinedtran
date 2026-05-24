export const TOTAL_ROUNDS = 7;

const ROUND_NAMES = {
  1: "Round 1",
  2: "Round 2",
  3: "Round 3",
  4: "Round of 16",
  5: "Quarterfinals",
  6: "Semifinals",
  7: "Final",
};

export function roundName(n) {
  return ROUND_NAMES[n] || `Round ${n}`;
}
