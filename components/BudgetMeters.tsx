"use client";

import { useState } from "react";
import { categoryLeft, decide, safeToSpend, TIGHT_RATIO } from "@/lib/budget";
import type { Budget, CategoryId } from "@/lib/types";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// Status is never color alone: every meter carries a status word.
const STATUS = {
  ok: { word: "on track" },
  tight: { word: "tight" },
  maxed: { word: "maxed" },
} as const;

const ICON: Record<CategoryId, string> = { food: "🍔", shopping: "🛍️", fun: "🎮", travel: "✈️", bills: "🧾" };

// Fixed period lengths for the demo budget (avoids server/client clock mismatches).
const PERIOD = {
  month: { days: 30, label: "Month", sliderMax: 500, step: 5 },
  year: { days: 365, label: "Year", sliderMax: 3000, step: 25 },
} as const;
type Period = keyof typeof PERIOD;

/** The budget as seen for one period: the year view swaps in yearly limits and spend. */
function forPeriod(b: Budget, period: Period): { view: Budget; daysLeft: number } {
  if (period === "month" || !b.year) return { view: b, daysLeft: b.daysLeftInMonth };
  const year = b.year;
  const categories = b.categories.map((c) => {
    const y = year.categories.find((x) => x.id === c.id);
    return y ? { ...c, limit: y.limit, spent: y.spent } : c;
  });
  return { view: { ...b, categories }, daysLeft: year.daysLeft };
}

/** Ring showing how much of the period is left. */
function DaysRing({ left, total, period }: { left: number; total: number; period: Period }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, left / total));
  return (
    <svg className="ring" viewBox="0 0 84 84" role="img" aria-label={`${left} of ${total} days left this ${period}`}>
      <circle className="ring-track" cx="42" cy="42" r={r} />
      <circle
        className="ring-fill"
        cx="42"
        cy="42"
        r={r}
        strokeDasharray={`${c * frac} ${c}`}
        transform="rotate(-90 42 42)"
      />
      <text x="42" y="40" className="ring-num">{left}</text>
      <text x="42" y="55" className="ring-label">days left</text>
    </svg>
  );
}

function status(spent: number, limit: number): keyof typeof STATUS {
  if (spent >= limit) return "maxed";
  return spent > limit * TIGHT_RATIO ? "tight" : "ok";
}

const VERDICT = { yes: "✅ Yes", tight: "⚠️ Tight", no: "❌ Nope" } as const;

/** At-a-glance budget: a meter per category plus a "what if" lever that previews a purchase. */
export function BudgetMeters({ budget }: { budget: Budget }) {
  const [whatIf, setWhatIf] = useState(0);
  const [cat, setCat] = useState<CategoryId>("food");
  const [period, setPeriod] = useState<Period>("month");
  const { view, daysLeft } = forPeriod(budget, period);
  const p = PERIOD[period];
  const amount = Math.min(whatIf, p.sliderMax);
  const preview = amount > 0 ? decide(view, amount, cat) : null;
  const safe = safeToSpend(budget);
  const todayPct = ((p.days - daysLeft) / p.days) * 100;
  const yearLeft = view.categories.reduce((sum, c) => sum + Math.max(0, c.limit - c.spent), 0);

  return (
    <section className="budget" aria-label="Your budget">
      {budget.year && (
        <div className="period" role="tablist" aria-label="Budget period">
          {(Object.keys(PERIOD) as Period[]).map((k) => (
            <button key={k} role="tab" aria-selected={period === k} className={period === k ? "active" : ""} onClick={() => setPeriod(k)}>
              {PERIOD[k].label}
            </button>
          ))}
        </div>
      )}
      <div className="budget-head">
        <div className="budget-head-text">
          <span className="budget-kicker">Safe to spend</span>
          <span className="budget-hero">{usd(safe)}</span>
          <span className="budget-sub">
            {period === "month"
              ? `≈ ${usd(safe / Math.max(1, daysLeft))}/day · bills set aside`
              : `${usd(yearLeft)} left in yearly budgets`}
          </span>
        </div>
        <DaysRing left={daysLeft} total={p.days} period={period} />
      </div>

      <ul className="meters">
        {view.categories.map((c) => {
          const s = status(c.spent, c.limit);
          const spentPct = Math.min(100, (c.spent / c.limit) * 100);
          const isTarget = preview && c.id === cat;
          const addPct = isTarget ? Math.min(100 - spentPct, (amount / c.limit) * 100) : 0;
          const left = categoryLeft(view, c.id);
          return (
            <li key={c.id}>
              <button
                className={`meter-row${c.id === cat ? " selected" : ""}`}
                onClick={() => setCat(c.id)}
                aria-label={`${c.label}: ${usd(c.spent)} spent of ${usd(c.limit)}, ${usd(left)} left, ${STATUS[s].word}`}
                title={`${usd(c.spent)} spent of ${usd(c.limit)}`}
              >
                <span className="meter-icon" aria-hidden>{ICON[c.id]}</span>
                <span className="meter-body">
                <span className="meter-top">
                  <span>{c.label}</span>
                  <span className="meter-left">{usd(left)} left</span>
                </span>
                <span className={`meter meter-${s}`}>
                  <span className="meter-fill" style={{ width: `${spentPct}%` }} />
                  {preview && addPct > 0 && (
                    <span className={`meter-add meter-add-${preview.verdict}`} style={{ width: `${addPct}%` }} />
                  )}
                  <span className="meter-today" style={{ left: `${todayPct}%` }} />
                </span>
                <span className={`meter-pill pill-${s}`}>{STATUS[s].word}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="lever">
        <label htmlFor="whatif" className="lever-top">
          <span>What if I spend…</span>
          <span className="lever-amount">{usd(amount)}</span>
        </label>
        <input
          id="whatif"
          type="range"
          min={0}
          max={p.sliderMax}
          step={p.step}
          value={amount}
          onChange={(e) => setWhatIf(Number(e.target.value))}
        />
        <p className="lever-result" aria-live="polite">
          {preview
            ? `${VERDICT[preview.verdict]} on ${view.categories.find((c) => c.id === cat)?.label.toLowerCase()} this ${period} · ${
                preview.remainingAfter >= 0 ? `${usd(preview.remainingAfter)} left after` : `${usd(-preview.remainingAfter)} over`
              }`
            : "Drag to preview a purchase. Tap a category to switch."}
        </p>
      </div>
    </section>
  );
}
