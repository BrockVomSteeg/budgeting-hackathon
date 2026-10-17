import type { Budget, CategoryId, Verdict } from "./types";

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

export function summarize(b: Budget): string {
  const cats = b.categories
    .map((c) => `${c.id} (${c.label}): $${c.limit - c.spent} left of $${c.limit}`)
    .join("\n");
  return [
    `User: ${b.name}. ${b.daysLeftInMonth} days left this month.`,
    `Checking: $${b.checking}. Bills due before payday: $${b.upcomingBills}. Safe to spend overall: $${safeToSpend(b)}.`,
    `Category budgets:\n${cats}`,
  ].join("\n");
}
