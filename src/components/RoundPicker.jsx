import MatchPicker from "./MatchPicker.jsx";
import { roundName } from "../lib/rounds.js";

export default function RoundPicker({
  round,
  matchups,
  picks,
  onPick,
  readOnly = false,
}) {
  const completed = matchups.filter((m) => picks[m.id]).length;
  const total = matchups.length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 18,
        }}
      >
        <h3
          style={{
            fontSize: 22,
            fontWeight: 400,
            fontStyle: "italic",
            color: "#2a2520",
          }}
        >
          {roundName(round)}
        </h3>
        {!readOnly && (
          <span
            className="mono"
            style={{
              fontSize: 11,
              color: "#999",
              letterSpacing: "0.08em",
            }}
          >
            {completed} / {total} picked
          </span>
        )}
      </div>

      <div>
        {matchups.map((m) => (
          <MatchPicker
            key={m.id}
            match={m}
            picked={picks[m.id]}
            onPick={onPick}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}