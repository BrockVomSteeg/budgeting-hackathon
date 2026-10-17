"use client";

import { monthDays, today, toBudget, upcoming, type Ledger } from "@/lib/ledger";
import { safeToSpend } from "@/lib/budget";
import { Bar, Money, SectionHeader, shortDate } from "@/components/ui";
import type { Tab } from "@/components/tabs/types";

interface Props {
  ledger: Ledger;
  go: (t: Tab) => void;
  onReviewAll: () => void;
  onOpenTxn: (id: string) => void;
}

export function Dashboard({ ledger, go, onReviewAll, onOpenTxn }: Props) {
  const b = toBudget(ledger);
  const spent = b.categories.reduce((s, c) => s + c.spent, 0);
  const budget = b.categories.reduce((s, c) => s + c.limit, 0);
  const t = today(ledger);
  const days = monthDays();
  const pace = (budget * t) / days;
  const over = spent - pace;
  const toReview = ledger.transactions.filter((x) => !x.reviewed).sort((a, z) => z.day - a.day);
  const next = upcoming(ledger).sort((a, z) => a.day - z.day);
  const top = [...b.categories].sort((a, z) => z.spent / (z.limit || 1) - a.spent / (a.limit || 1)).slice(0, 3);

  return (
    <>
      <section className="card hero">
        <div className="hero-num">
          <Money value={spent} /> spent
        </div>
        <div className="hero-sub">
          <Money value={budget} /> budget this month
        </div>
        <SpendChart ledger={ledger} budget={budget} days={days} today={t} />
        <div className={`pace-chip ${over > 0 ? "bad" : "good"}`}>
          <Money value={Math.abs(over)} /> {over > 0 ? "over pace" : "under pace"}
        </div>
      </section>

      <section className="card safe">
        <div>
          <div className="label">Safe to spend</div>
          <div className="big">
            <Money value={safeToSpend(b)} />
          </div>
        </div>
        <div className="safe-side">
          <div>
            <Money value={b.checking} /> checking
          </div>
          <div>
            −<Money value={b.upcomingBills} /> bills due
          </div>
          <div className="muted">{b.daysLeftInMonth} days to payday</div>
        </div>
      </section>

      <SectionHeader title="To review" action="View all" onAction={() => go("transactions")} />
      <section className="card list">
        {toReview.length === 0 ? (
          <p className="empty">All caught up. Gordon is almost proud.</p>
        ) : (
          <>
            {toReview.slice(0, 4).map((x) => {
              const c = ledger.categories.find((k) => k.id === x.category)!;
              return (
                <button key={x.id} className="row" onClick={() => onOpenTxn(x.id)}>
                  <span className="row-main">{x.merchant}</span>
                  <span className="chip" style={{ "--c": c.color } as React.CSSProperties}>
                    {c.emoji} {c.label}
                  </span>
                  <Money value={x.amount} cents />
                </button>
              );
            })}
            <button className="wide-btn" onClick={onReviewAll}>
              MARK AS REVIEWED
            </button>
          </>
        )}
      </section>

      <SectionHeader title="Upcoming" action="Recurrings" onAction={() => go("recurrings")} />
      <div className="hscroll">
        {next.length === 0 && <div className="card mini muted">No bills left this month 🎉</div>}
        {next.map((r) => (
          <div key={r.id} className="mini-wrap">
            <div className="mini-when">{r.day - t <= 0 ? "today" : `in ${r.day - t} days`}</div>
            <button className="card mini" onClick={() => go("recurrings")}>
              <span>{r.emoji}</span> <span className="mini-name">{r.name}</span> <Money value={r.amount} cents />
            </button>
          </div>
        ))}
      </div>

      <SectionHeader title="Budgets" action="Categories" onAction={() => go("categories")} />
      <section className="card">
        {top.map((c) => {
          const m = ledger.categories.find((k) => k.id === c.id)!;
          return (
            <div key={c.id} className="cat-mini">
              <div className="cat-mini-top">
                <span>
                  {m.emoji} {c.label}
                </span>
                <span>
                  <Money value={c.spent} /> <span className="muted">of</span> <Money value={c.limit} />
                </span>
              </div>
              <Bar spent={c.spent} limit={c.limit} />
            </div>
          );
        })}
      </section>
      <p className="foot muted">Demo data for {ledger.name} · {shortDate(t)}</p>
    </>
  );
}

function SpendChart({ ledger, budget, days, today: t }: { ledger: Ledger; budget: number; days: number; today: number }) {
  const W = 320;
  const H = 120;
  const daily: number[] = [];
  let run = 0;
  for (let d = 1; d <= t; d++) {
    run += ledger.transactions.filter((x) => x.day === d).reduce((s, x) => s + x.amount, 0);
    daily.push(run);
  }
  const max = Math.max(budget, run) * 1.08 || 1;
  const x = (d: number) => (d / days) * W;
  const y = (v: number) => H - (v / max) * H;
  const path = daily.map((v, i) => `${i ? "L" : "M"}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const overPace = run > (budget * t) / days;
  return (
    <svg className="chart" viewBox={`0 -6 ${W} ${H + 12}`} role="img" aria-label="Spending so far this month against budget pace">
      <line x1="0" y1={H} x2={x(days)} y2={y(budget)} className="pace" />
      <path d={path} className={overPace ? "spend bad" : "spend good"} />
      <circle cx={x(t)} cy={y(run)} r="5" className={overPace ? "dot bad" : "dot good"} />
    </svg>
  );
}
