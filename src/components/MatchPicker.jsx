export default function MatchPicker({ match, picked, onPick, readOnly = false }) {
  const renderSide = (player) => {
    if (!player) {
      return (
        <button className="pick-button empty" disabled>
          tbd
        </button>
      );
    }
    const isPicked = picked === player.id;
    return (
      <button
        type="button"
        className={`pick-button${isPicked ? " picked" : ""}`}
        disabled={readOnly}
        onClick={() => !readOnly && onPick(match.id, player.id)}
      >
        {player.seed != null && <span className="seed">[{player.seed}]</span>}
        {player.name}
        {player.nationality && <span className="nat">{player.nationality}</span>}
      </button>
    );
  };

  return (
    <div className="match-card">
      {renderSide(match.player1)}
      {renderSide(match.player2)}
    </div>
  );
}
