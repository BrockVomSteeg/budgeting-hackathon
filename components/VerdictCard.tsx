import type { AskResponse } from "@/lib/types";

const LABEL = { yes: "✅ YES", no: "❌ NOPE", tight: "⚠️ TIGHT", info: "💡" } as const;

export function VerdictCard({
  answer,
  onReplay,
  replayDisabled,
}: {
  answer: AskResponse;
  onReplay?: () => void;
  replayDisabled?: boolean;
}) {
  return (
    <section className={`verdict verdict-${answer.verdict}`} aria-live="polite">
      <div className="verdict-label">{LABEL[answer.verdict]}</div>
      {answer.amount !== null && (
        <div className="verdict-meta">
          {answer.item ?? "Purchase"} · ${answer.amount.toLocaleString("en-US")}
          {answer.remainingAfter !== null && answer.remainingAfter >= 0 && (
            <> · ${Math.round(answer.remainingAfter).toLocaleString("en-US")} left after</>
          )}
        </div>
      )}
      <p className="verdict-line">{answer.line}</p>
      {onReplay && (
        <button className="replay" onClick={onReplay} disabled={replayDisabled} aria-label="Play the answer again">
          🔁 Replay
        </button>
      )}
    </section>
  );
}
