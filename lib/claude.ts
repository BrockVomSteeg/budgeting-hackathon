import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { AskResponse, Budget, PersonaId, Turn } from "./types";
import { CATEGORY_IDS } from "./types";
import { categoryLeft, decide } from "./budget";
import { personas } from "./personas";
import { systemPrompt, userPrompt } from "./prompt";
import { guessCategory, mockAnswer, mockForPurchase } from "./mock";

// Haiku: cheapest + fastest for short spoken replies. Override with ANTHROPIC_MODEL.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

const Reply = z.object({
  // "money": spending, budgets, prices of anything (food, restaurants, groceries, stores, travel, products), saving, bills.
  topic: z.enum(["money", "off_topic"]),
  item: z.string().nullable(),
  amount: z.number().nullable(),
  category: z.enum(CATEGORY_IDS).nullable(),
  verdict: z.enum(["yes", "no", "tight", "info"]),
  line: z.string(),
});

const strip = <T extends { topic: unknown }>(r: T): Omit<T, "topic"> => {
  const { topic, ...rest } = r;
  void topic;
  return rest;
};

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ timeout: 10_000, maxRetries: 0 }));

export const hasClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);

export async function askClaude(
  b: Budget,
  text: string,
  persona: PersonaId,
  history: Turn[],
): Promise<AskResponse> {
  const call = (note = "") =>
    getClient().messages.parse({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low", format: zodOutputFormat(Reply) },
      system: systemPrompt(personas[persona]),
      messages: [{ role: "user", content: userPrompt(b, text, history) + note }],
    });
  const res = await call();
  const out = res.parsed_output;
  if (res.stop_reason === "refusal" || !out) return mockAnswer(b, text, persona);

  // Scope guard: off-topic questions only ever get the in-character redirect, never a verdict or math.
  if (out.topic === "off_topic") {
    return { item: null, amount: null, category: null, verdict: "info", remainingAfter: null, line: out.line, source: "claude" };
  }

  // No amount means no math, so the model doesn't get to issue a yes/no verdict.
  if (out.amount === null || out.amount <= 0) {
    return { ...strip(out), verdict: "info", amount: null, remainingAfter: null, source: "claude" };
  }

  // Code owns the math. If the model's verdict disagrees, trust the numbers.
  const category = out.category ?? guessCategory(text);
  const truth = decide(b, out.amount, category);
  const agrees = (v: string) => (truth.verdict === "no") === (v === "no");
  if (agrees(out.verdict)) {
    return { ...strip(out), category, verdict: truth.verdict, remainingAfter: truth.remainingAfter, source: "claude" };
  }

  // Disagreed: retry once with the verified numbers so the reply stays in character and correct.
  const note = `\n\nVerified by our code for ${out.item ?? "this"} at $${out.amount} (${category}): verdict "${truth.verdict}", $${categoryLeft(b, category)} left in ${category}, $${truth.remainingAfter} after. Use exactly this verdict and these numbers.`;
  const again = (await call(note).catch(() => null))?.parsed_output;
  if (again && agrees(again.verdict)) {
    return { ...strip(again), item: again.item ?? out.item, amount: out.amount, category, verdict: truth.verdict, remainingAfter: truth.remainingAfter, source: "claude" };
  }
  return mockForPurchase(b, persona, out.item ?? "that", out.amount, category);
}
