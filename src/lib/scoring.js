// Scoring rules for the bracket challenge.
//
// Base points per correct pick double each round:
//   R1=10, R2=20, R3=40, R16=80, QF=160, SF=320, F=640.
//
// Upset bonus: when a correct pick is on the higher-seed-number side of the
// match (i.e. the lower-ranked player won), award `picked_seed - opponent_seed`
// extra points. Unseeded players are treated as rank 33 (one beyond the max
// main-draw seed of 32). Both-unseeded matches yield no upset bonus.

export const ROUND_POINTS = {
  1: 10,
  2: 20,
  3: 40,
  4: 80,
  5: 160,
  6: 320,
  7: 640,
};

export const UNSEEDED_RANK = 33;

const seedOf = (playerId, playersById) =>
  playersById[playerId]?.seed ?? UNSEEDED_RANK;

export function scoreMatchPick({ pickedWinnerId, match, playersById }) {
  if (!match.winner_id) {
    return { points: 0, settled: false, correct: null, bonus: 0 };
  }
  const correct = match.winner_id === pickedWinnerId;
  if (!correct) {
    return { points: 0, settled: true, correct: false, bonus: 0 };
  }
  const base = ROUND_POINTS[match.round] ?? 0;
  const opponentId =
    pickedWinnerId === match.player1_id ? match.player2_id : match.player1_id;
  const pickedSeed = seedOf(pickedWinnerId, playersById);
  const oppSeed = seedOf(opponentId, playersById);
  const bonus = Math.max(0, pickedSeed - oppSeed);
  return { points: base + bonus, settled: true, correct: true, bonus };
}

export function scoreBracket({ picks, matches, playersById }) {
  const matchesById = {};
  for (const m of matches) matchesById[m.id] = m;

  const byRound = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  let total = 0;
  let correctCount = 0;
  let settledCount = 0;

  for (const p of picks) {
    const match = matchesById[p.match_id];
    if (!match) continue;
    const result = scoreMatchPick({
      pickedWinnerId: p.picked_winner_id,
      match,
      playersById,
    });
    if (result.settled) settledCount += 1;
    if (result.correct) correctCount += 1;
    if (result.points > 0) {
      byRound[match.round] += result.points;
      total += result.points;
    }
  }

  return { total, byRound, settledCount, correctCount };
}
