"use client";

import { useEffect, type ReactNode } from "react";

/** Copilot-style money: small raised dollar sign, whole dollars unless cents asked for. */
export function Money({ value, cents = false, signed = false, className = "" }: { value: number; cents?: boolean; signed?: boolean; className?: string }) {
  const n = Math.abs(value);
  const s = n.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  const sign = value < 0 ? "-" : signed && value > 0 ? "+" : "";
  return (
    <span className={`money ${className}`}>
      {sign}
      <span className="cur">$</span>
      {s}
    </span>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="section-head">
      <span>{title}</span>
      {action && (
        <button className="link" onClick={onAction}>
          {action} ›
        </button>
      )}
    </div>
  );
}

export const barColor = (ratio: number) => (ratio > 1 ? "var(--red)" : ratio > 0.8 ? "var(--orange)" : "var(--green)");

export function Bar({ spent, limit }: { spent: number; limit: number }) {
  const ratio = limit > 0 ? spent / limit : spent > 0 ? 2 : 0;
  return (
    <div className="bar" role="img" aria-label={`${Math.round(ratio * 100)}% of budget`}>
      <div style={{ width: `${Math.min(100, ratio * 100)}%`, background: barColor(ratio) }} />
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

export const Icon = {
  gear: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5v-8Z" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
};

const now = new Date();
export const dayDate = (day: number) => new Date(now.getFullYear(), now.getMonth(), day);
export const monthName = now.toLocaleString("en-US", { month: "long" });
export const shortDate = (day: number) => dayDate(day).toLocaleString("en-US", { month: "short", day: "numeric" });
export const longDate = (day: number) =>
  dayDate(day).toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase();
