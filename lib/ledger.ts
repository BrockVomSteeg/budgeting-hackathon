import type { AskResponse, Budget, CategoryId, LastItem } from "./types";

// The app's editable money data. The Budget that Gordon reasons about is derived from it,
// so spent, upcoming bills and checking can never disagree with the transaction list.

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  emoji: string;
  color: string;
  limit: number;
}

export interface Txn {
  id: string;
  day: number; // day of the current month
  merchant: string;
  amount: number;
  category: CategoryId;
  reviewed: boolean;
  recurringId?: string; // set when this payment is a recurring bill
}

export interface Recurring {
  id: string;
  name: string;
  emoji: string;
  amount: number;
  day: number;
}

export interface Ledger {
  name: string;
  monthlyIncome: number;
  daysLeftInMonth: number;
  checking: number; // current balance; every action below keeps it in step
  categories: CategoryMeta[];
  transactions: Txn[];
  recurrings: Recurring[];
  year?: Budget["year"]; // optional year-to-date totals for the Month/Year view
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const today = (l: Ledger) => monthDays() - l.daysLeftInMonth;
export function monthDays(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export const spentIn = (l: Ledger, id: CategoryId) =>
  round2(l.transactions.filter((t) => t.category === id).reduce((s, t) => s + t.amount, 0));

export const paymentFor = (l: Ledger, r: Recurring) => l.transactions.find((t) => t.recurringId === r.id);

export const upcoming = (l: Ledger) => l.recurrings.filter((r) => !paymentFor(l, r));

export function toBudget(l: Ledger): Budget {
  return {
    name: l.name,
    monthlyIncome: l.monthlyIncome,
    daysLeftInMonth: l.daysLeftInMonth,
    checking: round2(l.checking),
    upcomingBills: round2(upcoming(l).reduce((s, r) => s + r.amount, 0)),
    categories: l.categories.map((c) => ({ id: c.id, label: c.label, limit: c.limit, spent: spentIn(l, c.id) })),
    ...(l.year && { year: l.year }),
  };
}

const newId = () => `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function addTxn(l: Ledger, t: { merchant: string; amount: number; category: CategoryId }): Ledger {
  const txn: Txn = { id: newId(), day: today(l), reviewed: true, ...t, amount: round2(t.amount) };
  return { ...l, checking: round2(l.checking - txn.amount), transactions: [...l.transactions, txn] };
}

/** Gordon said "logged": add the purchase as a transaction (checking goes down, the category fills up). */
export function logPurchase(l: Ledger, a: AskResponse): Ledger {
  if (!a.purchased || !a.item || a.amount === null || a.amount <= 0 || !a.category) return l;
  const merchant = a.item.charAt(0).toUpperCase() + a.item.slice(1);
  return addTxn(l, { merchant, amount: a.amount, category: a.category });
}

/** What "ok, go for it" will refer to after this answer: the priced item, or null once it's bought. */
export function nextLastItem(prev: LastItem | null, a: AskResponse): LastItem | null {
  if (a.purchased) return null;
  if (a.verdict === "info" || !a.item || a.amount === null || !a.category) return prev;
  return { item: a.item, amount: a.amount, category: a.category, priceEstimated: a.priceEstimated };
}

export function deleteTxn(l: Ledger, id: string): Ledger {
  const t = l.transactions.find((x) => x.id === id);
  if (!t) return l;
  return { ...l, checking: round2(l.checking + t.amount), transactions: l.transactions.filter((x) => x.id !== id) };
}

export const updateTxn = (l: Ledger, id: string, patch: Partial<Pick<Txn, "category" | "reviewed">>): Ledger => ({
  ...l,
  transactions: l.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
});

export const markAllReviewed = (l: Ledger): Ledger => ({
  ...l,
  transactions: l.transactions.map((t) => (t.reviewed ? t : { ...t, reviewed: true })),
});

export const setLimit = (l: Ledger, id: CategoryId, limit: number): Ledger => ({
  ...l,
  categories: l.categories.map((c) => (c.id === id ? { ...c, limit: Math.max(0, Math.round(limit)) } : c)),
});

/** Pay a bill (adds a Bills transaction) or undo the payment. */
export function togglePaid(l: Ledger, recurringId: string): Ledger {
  const r = l.recurrings.find((x) => x.id === recurringId);
  if (!r) return l;
  const paid = paymentFor(l, r);
  if (paid) return deleteTxn(l, paid.id);
  const next = addTxn(l, { merchant: r.name, amount: r.amount, category: "bills" });
  const id = next.transactions[next.transactions.length - 1].id;
  return { ...next, transactions: next.transactions.map((t) => (t.id === id ? { ...t, recurringId: r.id } : t)) };
}
