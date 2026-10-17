"use client";

import { toBudget, type Ledger } from "@/lib/ledger";
import type { CategoryId } from "@/lib/types";
import { Bar, Money, monthName } from "@/components/ui";

export function Categories({ ledger, onOpen }: { ledger: Ledger; onOpen: (id: CategoryId) => void }) {
  const b = toBudget(ledger);
  const spent = b.categories.reduce((s, c) => s + c.spent, 0);
  const budget = b.categories.reduce((s, c) => s + c.limit, 0);
  return (
    <>
      <section className="card donut-card">
        <div>
          <div className="big">
            <Money value={spent} />
          </div>
          <div className="muted">spent in {monthName.slice(0, 3)}</div>
        </div>
        <Donut ledger={ledger} total={spent} />
        <div className="right">
          <div className="big">
            <Money value={budget} />
          </div>
          <div className="muted">total budget</div>
        </div>
      </section>

      <div className="cat-head">
        <span />
        <span>SPENT</span>
        <span />
        <span>BUDGET</span>
      </div>
      <section className="cat-table">
        {b.categories.map((c) => {
          const m = ledger.categories.find((k) => k.id === c.id)!;
          return (
            <button key={c.id} className="cat-row" onClick={() => onOpen(c.id)}>
              <span className="cat-name">
                <i style={{ background: m.color }} /> {m.emoji} {c.label}
              </span>
              <Money value={c.spent} />
              <Bar spent={c.spent} limit={c.limit} />
              <Money value={c.limit} />
            </button>
          );
        })}
      </section>
      <p className="foot muted">Tap a category to change its budget.</p>
    </>
  );
}

function Donut({ ledger, total }: { ledger: Ledger; total: number }) {
  const r = 34;
  const C = 2 * Math.PI * r;
  const lens = toBudget(ledger).categories.map((c) => ({ id: c.id, len: total > 0 ? (c.spent / total) * C : 0 }));
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((s, x) => s + x.len, 0));
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="Spending by category">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#e8ecf3" strokeWidth="12" />
      {lens.map((s, i) => (
        <circle
          key={s.id}
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={ledger.categories.find((k) => k.id === s.id)!.color}
          strokeWidth="12"
          strokeDasharray={`${Math.max(0, s.len - 1.5)} ${C}`}
          strokeDashoffset={-starts[i]}
          transform="rotate(-90 48 48)"
        />
      ))}
    </svg>
  );
}
