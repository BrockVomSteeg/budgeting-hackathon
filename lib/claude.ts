import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { AskResponse, Budget, PersonaId, Turn } from "./types";
import { CATEGORY_IDS } from "./types.ts";
import { categoryLeft, decide } from "./budget.ts";
import { personas } from "./personas.ts";
import { systemPrompt, userPrompt } from "./prompt.ts";
import { guessCategory, mockAnswer, mockForPurchase } from "./mock.ts";
import { fieldsBeforeLine, firstSentenceEnd, partialLine } from "./stream.ts";

// Haiku: cheapest + fastest for short spoken replies. Override with ANTHROPIC_MODEL.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

const Reply = z.object({
  // "afford": "can I afford X?", including bare price questions ("how much is a Domino's pizza?"). Everything else is off_topic.
  topic: z.enum(["afford", "off_topic"]),
  item: z.string().nullable(),
  amount: z.number().nullable(),
  priceEstimated: z.boolean(),
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

/** One Claude call; `note` is appended to the user message. Tests pass a fake. */
export type Call = (note?: string) => Promise<{ stop_reason: string | null; parsed_output: z.infer<typeof Reply> | null }>;

const request = (b: Budget, text: string, persona: PersonaId, history: Turn[], note = "") => ({
  model: MODEL,
  max_tokens: 1024,
  output_config: { effort: "low" as const, format: zodOutputFormat(Reply) },
  system: systemPrompt(personas[persona]),
  messages: [{ role: "user" as const, content: userPrompt(b, text, history) + note }],
});

export async function askClaude(
  b: Budget,
  text: string,
  persona: PersonaId,
  history: Turn[],
  call: Call = (note = "") => getClient().messages.parse(request(b, text, persona, history, note)),
): Promise<AskResponse> {
  const res = await call();
  const out = res.parsed_output;
  if (res.stop_reason === "refusal" || !out) return mockAnswer(b, text, persona);

  // Scope guard: off-topic questions only ever get the in-character redirect, never a verdict or math.
  if (out.topic === "off_topic") {
    return { item: null, amount: null, priceEstimated: false, category: null, verdict: "info", remainingAfter: null, line: out.line, source: "claude" };
  }

  // No amount (not even an estimate) means no math, so the model doesn't get to issue a yes/no verdict.
  if (out.amount === null || out.amount <= 0) {
    return { ...strip(out), verdict: "info", amount: null, priceEstimated: false, remainingAfter: null, source: "claude" };
  }

  // Code owns the math, estimated prices included. If the model's verdict disagrees, trust the numbers.
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
    return { ...strip(again), item: again.item ?? out.item, amount: out.amount, priceEstimated: out.priceEstimated, category, verdict: truth.verdict, remainingAfter: truth.remainingAfter, source: "claude" };
  }
  return mockForPurchase(b, persona, out.item ?? "that", out.amount, category, out.priceEstimated);
}

/**
 * Same answer as askClaude, but speaks early: onSpeak gets the first sentence of the line as soon
 * as Claude has written it (only once the verdict already checks out against the code's math),
 * then the rest. The streamed reply is fed through askClaude, so the scope guard, the math, the
 * retry and the fallbacks are identical. Returns the answer and whatever was handed to onSpeak.
 */
export async function askClaudeStreaming(
  b: Budget,
  text: string,
  persona: PersonaId,
  history: Turn[],
  onSpeak: (chunk: string) => void,
): Promise<{ answer: AskResponse; spoken: string[] }> {
  const stream = getClient().messages.stream(request(b, text, persona, history));
  const spoken: string[] = [];
  let checked: "pending" | "ok" | "no" = "pending";
  let json = "";
  stream.on("text", (delta) => {
    json += delta;
    if (checked === "pending") {
      const f = fieldsBeforeLine(json);
      if (!f) return;
      const amount = typeof f.amount === "number" ? f.amount : null;
      if (f.topic === "off_topic" || amount === null || amount <= 0) checked = "ok"; // no math to check
      else {
        const known = (CATEGORY_IDS as readonly string[]).includes(f.category as string);
        const category = known ? (f.category as (typeof CATEGORY_IDS)[number]) : guessCategory(text);
        checked = decide(b, amount, category).verdict === f.verdict ? "ok" : "no";
      }
    }
    if (checked !== "ok" || spoken.length) return;
    const line = partialLine(json);
    const end = line ? firstSentenceEnd(line.text) : 0;
    if (end) {
      spoken.push(line!.text.slice(0, end));
      onSpeak(spoken[0]);
    }
  });
  const msg = await stream.finalMessage();

  // First call = the reply we just streamed; a retry (if the verdict was wrong) is a normal call.
  let first = true;
  const answer = await askClaude(b, text, persona, history, (note = "") => {
    if (first && !note) {
      first = false;
      return Promise.resolve({ stop_reason: msg.stop_reason, parsed_output: msg.parsed_output });
    }
    return getClient().messages.parse(request(b, text, persona, history, note));
  });
  const line = answer.line.trim();
  if (!spoken.length) return { answer: { ...answer, line }, spoken };
  if (line.startsWith(spoken[0])) {
    const rest = line.slice(spoken[0].length).trim();
    if (rest) {
      spoken.push(rest);
      onSpeak(rest);
    }
    return { answer: { ...answer, line }, spoken };
  }
  // Shouldn't happen (only a checked verdict is spoken early), but never show a line he didn't say.
  return { answer: { ...answer, verdict: "info", line: spoken.join(" ") }, spoken };
}
