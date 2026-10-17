import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { AskResponse, Budget, PersonaId, Turn } from "./types";
import { CATEGORY_IDS } from "./types";
import { decide } from "./budget";
import { personas } from "./personas";
import { systemPrompt, userPrompt } from "./prompt";
import { mockAnswer } from "./mock";

// Haiku: cheapest + fastest for short spoken replies. Override with ANTHROPIC_MODEL.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

const Reply = z.object({
  item: z.string().nullable(),
  amount: z.number().nullable(),
  category: z.enum(CATEGORY_IDS).nullable(),
  verdict: z.enum(["yes", "no", "tight", "info"]),
  line: z.string(),
});

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ timeout: 10_000, maxRetries: 0 }));

export const hasClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);

export async function askClaude(
  b: Budget,
  text: string,
  persona: PersonaId,
  history: Turn[],
): Promise<AskResponse> {
  const res = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 2048,
    output_config: { effort: "low", format: zodOutputFormat(Reply) },
    system: systemPrompt(personas[persona]),
    messages: [{ role: "user", content: userPrompt(b, text, history) }],
  });

  const out = res.parsed_output;
  if (res.stop_reason === "refusal" || !out) return mockAnswer(b, text, persona);

  if (out.amount === null || out.amount <= 0 || out.category === null) {
    return { ...out, amount: null, category: out.category, remainingAfter: null, source: "claude" };
  }

  // Code owns the math. If the model's verdict disagrees, trust the numbers.
  const truth = decide(b, out.amount, out.category);
  const agrees = (truth.verdict === "no") === (out.verdict === "no");
  if (!agrees) return mockAnswer(b, text, persona);
  return { ...out, verdict: truth.verdict, remainingAfter: truth.remainingAfter, source: "claude" };
}
