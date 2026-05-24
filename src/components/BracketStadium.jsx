// Two layouts in one component, CSS toggles between them:
//   - Stadium (desktop):  13 columns, final in the middle, sides flow toward center
//   - Linear  (phone):    7 columns, round 1 → round 7 left-to-right, scrolls horizontally

const ROUND_LABELS = {
  1: "R1",
  2: "R2",
  3: "R3",
  4: "R16",
  5: "QF",
  6: "SF",
  7: "FINAL",
};

const STADIUM_COLUMNS = [
  { round: 1, side: "left" },
  { round: 2, side: "left" },
  { round: 3, side: "left" },
  { round: 4, side: "left" },
  { round: 5, side: "left" },
  { round: 6, side: "left" },
  { round: 7, side: "center" },
  { round: 6, side: "right" },
  { round: 5, side: "right" },
  { round: 4, side: "right" },
  { round: 3, side: "right" },
  { round: 2, side: "right" },
  { round: 1, side: "right" },
];

const LINEAR_ROUNDS = [1, 2, 3, 4, 5, 6, 7];

function filterForSide(matchups, side) {
  if (side === "center") return matchups;
  const half = matchups.length / 2;
  return matchups.filter((m) =>
    side === "left" ? m.matchNumber <= half : m.matchNumber > half
  );
}

export default function BracketStadium({ matchupsForRound, picks }) {
  return (
    <>
      {/* Desktop: stadium split, final in middle */}
      <div className="bracket-scroll bracket-desktop-only">
        <div className="bracket-stadium">
          <div className="bracket-labels bracket-labels-stadium">
            {STADIUM_COLUMNS.map((col, i) => (
              <div key={`sh-${i}`} className="bracket-col-label">
                {ROUND_LABELS[col.round]}
              </div>
            ))}
          </div>
          <div className="bracket-grid bracket-grid-stadium">
            {STADIUM_COLUMNS.map((col, i) => {
              const matchups = filterForSide(
                matchupsForRound(col.round),
                col.side
              );
              const isFinal = col.side === "center";
              return (
                <div
                  key={`sc-${i}`}
                  className={`bracket-column${isFinal ? " bracket-col-final" : ""}`}
                >
                  {matchups.map((m) => (
                    <BracketMatch
                      key={m.id}
                      matchup={m}
                      pickedId={picks[m.id]}
                      isFinal={isFinal}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Phone: linear left-to-right, all rounds in their own column */}
      <div className="bracket-scroll bracket-mobile-only">
        <div className="bracket-linear">
          <div className="bracket-labels bracket-labels-linear">
            {LINEAR_ROUNDS.map((r) => (
              <div key={`lh-${r}`} className="bracket-col-label">
                {ROUND_LABELS[r]}
              </div>
            ))}
          </div>
          <div className="bracket-grid bracket-grid-linear">
            {LINEAR_ROUNDS.map((r) => {
              const matchups = matchupsForRound(r);
              const isFinal = r === 7;
              return (
                <div
                  key={`lc-${r}`}
                  className={`bracket-column${isFinal ? " bracket-col-final" : ""}`}
                >
                  {matchups.map((m) => (
                    <BracketMatch
                      key={m.id}
                      matchup={m}
                      pickedId={picks[m.id]}
                      isFinal={isFinal}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function BracketMatch({ matchup, pickedId, isFinal }) {
  const winnerId = matchup.winnerId ?? null;
  const settled = !!winnerId;
  const isLoser = (player) =>
    settled && !!player && player.id !== winnerId;
  return (
    <div className={`bracket-match${isFinal ? " bracket-match-final" : ""}`}>
      <BracketSlot
        player={matchup.player1}
        picked={pickedId && pickedId === matchup.player1?.id}
        isWinner={winnerId && winnerId === matchup.player1?.id}
        isEliminated={isLoser(matchup.player1)}
      />
      <BracketSlot
        player={matchup.player2}
        picked={pickedId && pickedId === matchup.player2?.id}
        isWinner={winnerId && winnerId === matchup.player2?.id}
        isEliminated={isLoser(matchup.player2)}
      />
    </div>
  );
}

function BracketSlot({ player, picked, isWinner, isEliminated }) {
  if (!player) {
    return <div className="bracket-slot bracket-slot-empty">—</div>;
  }
  const cls = [
    "bracket-slot",
    picked && "bracket-slot-advanced",
    isWinner && "bracket-slot-winner",
    isEliminated && "bracket-slot-eliminated",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      {player.seed != null && (
        <span className="bracket-slot-seed">[{player.seed}]</span>
      )}
      <span className="bracket-slot-name">{player.name}</span>
      {isWinner && <span className="bracket-slot-check">✓</span>}
    </div>
  );
}
