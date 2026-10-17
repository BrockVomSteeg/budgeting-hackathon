"use client";

import { paymentFor, today, upcoming, type Ledger } from "@/lib/ledger";
import { Money, SectionHeader, shortDate } from "@/components/ui";

export function Recurrings({ ledger, onToggle }: { ledger: Ledger; onToggle: (id: string) => void }) {
  const t = today(ledger);
  const due = upcoming(ledger).sort((a, z) => a.day - z.day);
  const paid = ledger.recurrings.filter((r) => paymentFor(ledger, r)).sort((a, z) => a.day - z.day);
  const sum = (xs: typeof due) => xs.reduce((s, r) => s + r.amount, 0);
  return (
    <>
      <section className="card split">
        <div>
          <div className="big">
            <Money value={sum(due)} />
          </div>
          <div className="muted">left to pay</div>
        </div>
        <div className="right">
          <div className="big">
            <Money value={sum(paid)} />
          </div>
          <div className="muted">paid this month</div>
        </div>
      </section>

      <SectionHeader title={`Upcoming · ${due.length}`} />
      <section className="card list">
        {due.length === 0 && <p className="empty">Every bill is paid. Beautiful.</p>}
        {due.map((r) => (
          <div key={r.id} className="row static">
            <span className="rec-emoji">{r.emoji}</span>
            <span className="row-main">
              {r.name}
              <small>{r.day - t <= 0 ? "Due today" : `In ${r.day - t} days · ${shortDate(r.day)}`}</small>
            </span>
            <Money value={r.amount} cents />
            <button className="pill-btn" onClick={() => onToggle(r.id)}>
              Pay
            </button>
          </div>
        ))}
      </section>

      <SectionHeader title={`Paid · ${paid.length}`} />
      <section className="card list">
        {paid.map((r) => (
          <div key={r.id} className="row static">
            <span className="rec-emoji">{r.emoji}</span>
            <span className="row-main">
              {r.name}
              <small>Paid {shortDate(paymentFor(ledger, r)!.day)}</small>
            </span>
            <Money value={r.amount} cents />
            <button className="pill-btn ghost" onClick={() => onToggle(r.id)}>
              Undo
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
