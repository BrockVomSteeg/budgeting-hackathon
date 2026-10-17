"use client";

import { useState } from "react";
import type { Ledger } from "@/lib/ledger";
import { Icon, Money, longDate } from "@/components/ui";

export function Transactions({ ledger, onOpen, onAdd }: { ledger: Ledger; onOpen: (id: string) => void; onAdd: () => void }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = ledger.transactions
    .filter((t) => !needle || t.merchant.toLowerCase().includes(needle))
    .sort((a, z) => z.day - a.day || z.id.localeCompare(a.id));
  const days = [...new Set(list.map((t) => t.day))];
  return (
    <>
      <input className="search" placeholder="Search transactions" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search transactions" />
      {days.length === 0 && <p className="empty">Nothing matches “{q}”.</p>}
      {days.map((d) => (
        <section key={d} className="card day">
          <div className="day-head">{longDate(d)}</div>
          {list
            .filter((t) => t.day === d)
            .map((t) => {
              const c = ledger.categories.find((k) => k.id === t.category)!;
              return (
                <button key={t.id} className="row" onClick={() => onOpen(t.id)}>
                  <span className="row-main">
                    {!t.reviewed && <i className="unread" aria-label="Needs review" />}
                    {t.merchant}
                  </span>
                  <span className="emoji-pill" style={{ "--c": c.color } as React.CSSProperties} title={c.label}>
                    {c.emoji}
                  </span>
                  <Money value={t.amount} cents />
                </button>
              );
            })}
        </section>
      ))}
      <button className="fab" onClick={onAdd} aria-label="Add a transaction">
        {Icon.plus}
      </button>
    </>
  );
}
