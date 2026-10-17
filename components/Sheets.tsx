"use client";

import { useState } from "react";
import { spentIn, type Ledger } from "@/lib/ledger";
import type { CategoryId, Verdict } from "@/lib/types";
import { LIMITS } from "@/lib/types";
import { Money, Sheet, shortDate } from "@/components/ui";

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  verdict?: Verdict;
}

function CategoryPicker({ ledger, value, onChange }: { ledger: Ledger; value: CategoryId; onChange: (c: CategoryId) => void }) {
  return (
    <div className="picker" role="radiogroup" aria-label="Category">
      {ledger.categories.map((c) => (
        <button
          key={c.id}
          role="radio"
          aria-checked={value === c.id}
          className={value === c.id ? "chip on" : "chip"}
          style={{ "--c": c.color } as React.CSSProperties}
          onClick={() => onChange(c.id)}
        >
          {c.emoji} {c.label}
        </button>
      ))}
    </div>
  );
}

export function TxnSheet(props: {
  ledger: Ledger;
  id: string;
  onClose: () => void;
  onCategory: (c: CategoryId) => void;
  onReviewed: (r: boolean) => void;
  onDelete: () => void;
}) {
  const t = props.ledger.transactions.find((x) => x.id === props.id);
  if (!t) return null;
  return (
    <Sheet title="TRANSACTION" onClose={props.onClose}>
      <div className="sheet-hero">
        <div className="sheet-name">{t.merchant}</div>
        <div className="big">
          <Money value={t.amount} cents />
        </div>
        <div className="muted">{shortDate(t.day)}{t.recurringId ? " · recurring bill" : ""}</div>
      </div>
      <div className="field-label">Category</div>
      <CategoryPicker ledger={props.ledger} value={t.category} onChange={props.onCategory} />
      <div className="sheet-actions">
        <button className="primary" onClick={() => props.onReviewed(!t.reviewed)}>
          {t.reviewed ? "Mark as unreviewed" : "Mark as reviewed"}
        </button>
        <button className="danger" onClick={props.onDelete}>
          Delete transaction
        </button>
      </div>
    </Sheet>
  );
}

export function CategorySheet(props: { ledger: Ledger; id: CategoryId; onClose: () => void; onLimit: (n: number) => void; onOpenTxn: (id: string) => void }) {
  const c = props.ledger.categories.find((x) => x.id === props.id)!;
  const spent = spentIn(props.ledger, c.id);
  const [limit, setLimit] = useState(String(c.limit));
  const left = c.limit - spent;
  const txns = props.ledger.transactions.filter((t) => t.category === c.id).sort((a, z) => z.day - a.day);
  const n = Number(limit);
  return (
    <Sheet title="CATEGORY" onClose={props.onClose}>
      <div className="sheet-hero">
        <div className="sheet-emoji">{c.emoji}</div>
        <div className="sheet-name blue">{c.label}</div>
        <div className="field-label">SPENT</div>
        <div className="big">
          <Money value={spent} cents />
        </div>
        <div className={left < 0 ? "bad-text" : "muted"}>
          <Money value={Math.abs(left)} cents /> {left < 0 ? "over" : "left"}
        </div>
      </div>
      <div className="field-label">Monthly budget</div>
      <div className="inline">
        <span className="prefix">$</span>
        <input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ""))} aria-label="Monthly budget" />
        <button className="primary" disabled={!limit || n === c.limit} onClick={() => props.onLimit(n)}>
          Save
        </button>
      </div>
      <div className="field-label">Transactions</div>
      <div className="list">
        {txns.length === 0 && <p className="empty">Nothing spent here yet.</p>}
        {txns.map((t) => (
          <button key={t.id} className="row" onClick={() => props.onOpenTxn(t.id)}>
            <span className="muted date">{shortDate(t.day)}</span>
            <span className="row-main">{t.merchant}</span>
            <Money value={t.amount} cents />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function AddSheet(props: {
  ledger: Ledger;
  onClose: () => void;
  onAdd: (t: { merchant: string; amount: number; category: CategoryId }) => void;
  onAsk: (question: string) => void;
}) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<CategoryId>("food");
  const n = Number(amount);
  const ok = merchant.trim().length > 0 && n > 0 && n < 1e6;
  return (
    <Sheet title="NEW PURCHASE" onClose={props.onClose}>
      <div className="field-label">What is it?</div>
      <input className="text" placeholder="e.g. Nike running shoes" value={merchant} maxLength={60} onChange={(e) => setMerchant(e.target.value)} />
      <div className="field-label">How much?</div>
      <div className="inline">
        <span className="prefix">$</span>
        <input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Amount" />
      </div>
      <div className="field-label">Category</div>
      <CategoryPicker ledger={props.ledger} value={category} onChange={setCategory} />
      <div className="sheet-actions">
        <button className="secondary" disabled={!ok} onClick={() => props.onAsk(`Can I afford ${merchant.trim()} for $${n}?`)}>
          🍳 Ask Gordon first
        </button>
        <button className="primary" disabled={!ok} onClick={() => props.onAdd({ merchant: merchant.trim(), amount: n, category })}>
          Add purchase
        </button>
      </div>
    </Sheet>
  );
}

export function ChatSheet(props: { messages: ChatMsg[]; busy: boolean; onClose: () => void; onSend: (t: string) => void; onReplay?: () => void }) {
  const [typed, setTyped] = useState("");
  return (
    <Sheet title="CHAT WITH GORDON" onClose={props.onClose}>
      <div className="chat">
        {props.messages.length === 0 && <p className="empty">Ask him anything about your money. He will not be gentle.</p>}
        {props.messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === "assistant" && (
              // eslint-disable-next-line @next/next/no-img-element -- tiny avatar
              <img src="/gordon/idle.webp" alt="" />
            )}
            <p>{m.text}</p>
          </div>
        ))}
      </div>
      {props.onReplay && (
        <button className="link replay" onClick={props.onReplay} disabled={props.busy}>
          🔁 Replay last answer
        </button>
      )}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const t = typed.trim().slice(0, LIMITS.textMax);
          if (!t || props.busy) return;
          setTyped("");
          props.onSend(t);
        }}
      >
        <input value={typed} maxLength={LIMITS.textMax} onChange={(e) => setTyped(e.target.value)} placeholder="Can I afford a $400 jacket?" aria-label="Message Gordon" />
        <button type="submit" disabled={!typed.trim() || props.busy}>
          Send
        </button>
      </form>
    </Sheet>
  );
}

export function SettingsSheet(props: { speaker: boolean; onSpeaker: (on: boolean) => void; onReset: () => void; onClose: () => void }) {
  return (
    <Sheet title="SETTINGS" onClose={props.onClose}>
      <label className="setting">
        <span>
          <b>Speaker mode</b>
          <small>Louder, through the phone speaker instead of the quiet call-style route.</small>
        </span>
        <input type="checkbox" className="switch" checked={props.speaker} onChange={(e) => props.onSpeaker(e.target.checked)} />
      </label>
      <button
        className="setting danger-text"
        onClick={() => {
          if (confirm("Reset all demo transactions, budgets and bills?")) props.onReset();
        }}
      >
        <span>
          <b>Reset demo data</b>
          <small>Undo every purchase, budget change and paid bill.</small>
        </span>
      </button>
      <p className="foot muted">Demo money only. Gordon is R18+ and swears.</p>
    </Sheet>
  );
}
