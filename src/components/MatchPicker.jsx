export default function MatchPicker({ match, picked, onPick, readOnly = false }) {
  const locked = !!match.lockedWinnerId;
  const renderSide = (player) => {
    if (!player) {
      return (
        <button className="pick-button empty" disabled>
          tbd
        </button>
      );
    }
    const isPicked = picked === player.id;
    const disabled = readOnly || locked;
    return (
      <button
        type="button"
        className={`pick-button${isPicked ? " picked" : ""}${locked ? " locked" : ""}`}
        disabled={disabled}
        onClick={() => !disabled && onPick(match.id, player.id)}
      >
        {player.seed != null && <span className="seed">[{player.seed}]</span>}
        {player.name}
        {player.nationality && <span className="nat">{player.nationality}</span>}
      </button>
    );
  };

  return (
    <div className={`match-card${locked ? " match-card-final" : ""}`}>
      {locked && <span className="match-final-flag">final · result locked</span>}
      {renderSide(match.player1)}
      {renderSide(match.player2)}
    </div>
  );
}