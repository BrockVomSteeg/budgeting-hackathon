"use client";

import { useState } from "react";
import { categoryLeft, decide, safeToSpend, TIGHT_RATIO } from "@/lib/budget";
import type { Budget, CategoryId } from "@/lib/types";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// Status is never color alone: every meter carries an icon + word.
const STATUS = {
  ok: { icon: "✅", word: "on track" },
  tight: { icon: "⚠️", word: "tight" },
  maxed: { icon: "⛔", word: "maxed" },
} as const;

function status(spent: number, limit: number): keyof typeof STATUS {
  if (spent >= limit) return "maxed";
  return spent > limit * TIGHT_RATIO ? "tight" : "ok";
}

const VERDICT = { yes: "✅ Yes", tight: "⚠️ Tight", no: "❌ Nope" } as const;

/** At-a-glance budget: a meter per category plus a "what if" lever that previews a purchase. */
export function BudgetMeters({ budget }: { budget: Budget }) {
  const [whatIf, setWhatIf] = useState(0);
  const [cat, setCat] = useState<CategoryId>("food");
  const preview = whatIf > 0 ? decide(budget, whatIf, cat) : null;

  return (
    <section className="budget" aria-label="Your budget">
      <div className="budget-head">
        <span className="budget-kicker">Safe to spend</span>
        <span className="budget-hero">{usd(safeToSpend(budget))}</span>
        <span className="budget-sub">{budget.daysLeftInMonth} days left · bills set aside</span>
      </div>

      <ul className="meters">
        {budget.categories.map((c) => {
          const s = status(c.spent, c.limit);
          const spentPct = Math.min(100, (c.spent / c.limit) * 100);
          const isTarget = preview && c.id === cat;
          const addPct = isTarget ? Math.min(100 - spentPct, (whatIf / c.limit) * 100) : 0;
          const left = categoryLeft(budget, c.id);
          return (
            <li key={c.id}>
              <button
                className={`meter-row${c.id === cat ? " selected" : ""}`}
                onClick={() => setCat(c.id)}
                aria-label={`${c.label}: ${usd(c.spent)} spent of ${usd(c.limit)}, ${usd(left)} left, ${STATUS[s].word}`}
                title={`${usd(c.spent)} spent of ${usd(c.limit)}`}
              >
                <span className="meter-top">
                  <span>{c.label}</span>
                  <span className="meter-left">
                    {STATUS[s].icon} {usd(left)} left
                  </span>
                </span>
                <span className={`meter meter-${s}`}>
                  <span className="meter-fill" style={{ width: `${spentPct}%` }} />
                  {preview && addPct > 0 && (
                    <span className={`meter-add meter-add-${preview.verdict}`} style={{ width: `${addPct}%` }} />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="lever">
        <label htmlFor="whatif" className="lever-top">
          <span>What if I spend…</span>
          <span className="lever-amount">{usd(whatIf)}</span>
        </label>
        <input
          id="whatif"
          type="range"
          min={0}
          max={500}
          step={5}
          value={whatIf}
          onChange={(e) => setWhatIf(Number(e.target.value))}
        />
        <p className="lever-result" aria-live="polite">
          {preview
            ? `${VERDICT[preview.verdict]} on ${budget.categories.find((c) => c.id === cat)?.label.toLowerCase()} · ${
                preview.remainingAfter >= 0 ? `${usd(preview.remainingAfter)} left after` : `${usd(-preview.remainingAfter)} over`
              }`
            : "Drag to preview a purchase. Tap a category to switch."}
        </p>
      </div>
    </section>
  );
}
