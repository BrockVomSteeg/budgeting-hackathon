import { CATEGORY_IDS, type Budget, type CategoryId, type LastItem, type Verdict } from "./types.ts";

export const TIGHT_RATIO = 0.8;

export function safeToSpend(b: Budget): number {
  return b.checking - b.upcomingBills;
}

export function categoryLeft(b: Budget, id: CategoryId): number {
  const c = b.categories.find((x) => x.id === id);
  return c ? c.limit - c.spent : 0;
}

/** Deterministic affordability check. Code, not the model, owns the math. */
export function decide(
  b: Budget,
  amount: number,
  category: CategoryId,
): { verdict: Exclude<Verdict, "info">; remainingAfter: number } {
  const left = categoryLeft(b, category);
  const remainingAfter = left - amount;
  if (amount > safeToSpend(b) || amount > left) return { verdict: "no", remainingAfter };
  if (amount > left * TIGHT_RATIO) return { verdict: "tight", remainingAfter };
  return { verdict: "yes", remainingAfter };
}

const num = (x: unknown, max = 1e7): x is number => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= max;

/** The budget the phone sends with a question (the user can edit it in the app). Null if it isn't sane. */
export function parseBudget(x: unknown): Budget | null {
  const b = x as Budget | null;
  if (!b || typeof b !== "object" || !Array.isArray(b.categories) || b.categories.length > CATEGORY_IDS.length) return null;
  if (![b.monthlyIncome, b.checking, b.upcomingBills].every((v) => num(v)) || !num(b.daysLeftInMonth, 31)) return null;
  const categories = b.categories.map((c) =>
    c && (CATEGORY_IDS as readonly string[]).includes(c.id) && typeof c.label === "string" && num(c.limit) && num(c.spent)
      ? { id: c.id, label: c.label.slice(0, 40), limit: c.limit, spent: c.spent }
      : null,
  );
  if (categories.some((c) => !c)) return null;
  return {
    name: typeof b.name === "string" ? b.name.slice(0, 40) : "You",
    monthlyIncome: b.monthlyIncome,
    daysLeftInMonth: Math.round(b.daysLeftInMonth),
    checking: b.checking,
    upcomingBills: b.upcomingBills,
    categories: categories as Budget["categories"],
  };
}

/** The last-discussed purchase the phone sends along ("go for it" refers to it). Null if it isn't sane. */
export function parseLastItem(x: unknown): LastItem | null {
  const l = x as LastItem | null;
  if (!l || typeof l !== "object" || typeof l.item !== "string" || !l.item.trim()) return null;
  if (!num(l.amount) || l.amount <= 0 || !(CATEGORY_IDS as readonly string[]).includes(l.category)) return null;
  return { item: l.item.trim().slice(0, 40), amount: l.amount, category: l.category, priceEstimated: l.priceEstimated === true };
}

export function summarize(b: Budget): string {
  const cats = b.categories
    .map((c) => `${c.id} (${c.label}): $${Math.round((c.limit - c.spent) * 100) / 100} left of $${c.limit}`)
    .join("\n");
  return [
    `User: ${b.name}. ${b.daysLeftInMonth} days left this month.`,
    `Checking: $${b.checking}. Bills due before payday: $${b.upcomingBills}. Safe to spend overall: $${safeToSpend(b)}.`,
    `Category budgets:\n${cats}`,
  ].join("\n");
}
