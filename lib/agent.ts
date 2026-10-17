import type { AskResponse, Budget, CategoryId, Persona } from "./types";
import { CATEGORY_IDS } from "./types.ts";
import { categoryLeft, decide, safeToSpend, summarize } from "./budget.ts";
import { guessCategory } from "./mock.ts";

/** Values injected into the ElevenLabs agent prompt ({{persona_name}} etc). */
export function agentVariables(b: Budget, p: Persona): Record<string, string> {
  return { persona_name: p.name, persona_vibe: p.vibe, persona_rules: p.rules, budget_summary: summarize(b) };
}

const isCategory = (x: unknown): x is CategoryId =>
  typeof x === "string" && (CATEGORY_IDS as readonly string[]).includes(x);

const ASK_PRICE = JSON.stringify({ error: "Ask the user how much it costs." });

function parsePurchase(params: Record<string, unknown>) {
  const amount = Number(params.amount);
  const item = typeof params.item === "string" && params.item.trim() ? params.item.trim().slice(0, 40) : "that";
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const category = isCategory(params.category) ? params.category : guessCategory(item);
  return { item, amount, category, priceEstimated: params.price_estimated === true };
}

/** Client tool the voice agent calls. Code owns the math; the agent only talks. */
export function checkAffordability(
  b: Budget,
  params: Record<string, unknown>,
): { answer: AskResponse | null; text: string } {
  const p = parsePurchase(params);
  if (!p) return { answer: null, text: ASK_PRICE };
  const { item, amount, category } = p;
  const { verdict, remainingAfter } = decide(b, amount, category);
  return {
    answer: { verdict, ...p, remainingAfter, purchased: false, line: "", source: "claude" },
    text: JSON.stringify({
      verdict,
      item,
      amount,
      category,
      category_left: categoryLeft(b, category),
      left_after: remainingAfter,
      safe_to_spend_overall: safeToSpend(b),
    }),
  };
}

/**
 * Client tool for "ok, go for it": the caller logs the answer as a transaction (purchased: true).
 * Numbers are worked out against the budget before the purchase, like checkAffordability.
 */
export function recordPurchase(
  b: Budget,
  params: Record<string, unknown>,
): { answer: AskResponse | null; text: string } {
  const p = parsePurchase(params);
  if (!p) return { answer: null, text: ASK_PRICE };
  const { item, amount, category } = p;
  const { verdict, remainingAfter } = decide(b, amount, category);
  return {
    answer: { verdict, ...p, remainingAfter, purchased: true, line: "", source: "claude" },
    text: JSON.stringify({
      logged: true,
      verdict,
      item,
      amount,
      category,
      category_left_after: remainingAfter,
      safe_to_spend_after: safeToSpend(b) - amount,
    }),
  };
}
