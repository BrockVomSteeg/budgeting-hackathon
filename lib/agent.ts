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

/** Client tool the voice agent calls. Code owns the math; the agent only talks. */
export function checkAffordability(
  b: Budget,
  params: Record<string, unknown>,
): { answer: AskResponse | null; text: string } {
  const amount = Number(params.amount);
  const item = typeof params.item === "string" && params.item.trim() ? params.item.trim() : "that";
  if (!Number.isFinite(amount) || amount <= 0) {
    return { answer: null, text: JSON.stringify({ error: "Ask the user how much it costs." }) };
  }
  const category = isCategory(params.category) ? params.category : guessCategory(item);
  const priceEstimated = params.price_estimated === true;
  const { verdict, remainingAfter } = decide(b, amount, category);
  return {
    answer: { verdict, item, amount, priceEstimated, category, remainingAfter, line: "", source: "claude" },
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
