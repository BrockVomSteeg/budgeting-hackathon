import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { AskResponse, Budget, CategoryId, LastItem, PersonaId, Turn } from "./types";
import { CATEGORY_IDS } from "./types.ts";
import { categoryLeft, decide } from "./budget.ts";
import { personas } from "./personas.ts";
import { systemPrompt, userPrompt } from "./prompt.ts";
import { guessCategory, mockAnswer, mockForPurchase, parseAmount, sameItem } from "./mock.ts";
import { fieldsBeforeLine, firstSentenceEnd, partialLine } from "./stream.ts";

// Haiku: cheapest + fastest for short spoken replies. Override with ANTHROPIC_MODEL.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

const Reply = z.object({
  // "afford": "can I afford X?", including bare price questions ("how much is a Domino's pizza?").
  // "purchase": they've decided to buy it ("ok go for it", "purchase a PS5"); the app logs it. Everything else is off_topic.
  topic: z.enum(["afford", "purchase", "off_topic"]),
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

const request = (b: Budget, text: string, persona: PersonaId, history: Turn[], last: LastItem | null, note = "") => ({
  model: MODEL,
  max_tokens: 1024,
  output_config: { effort: "low" as const, format: zodOutputFormat(Reply) },
  system: systemPrompt(personas[persona]),
  messages: [{ role: "user" as const, content: userPrompt(b, text, history, last) + note }],
});

/** The code's math for a purchase, and whether a verdict agrees with it (only no vs. not-no matters). */
function check(b: Budget, text: string, amount: number, category: unknown) {
  const cat = (CATEGORY_IDS as readonly string[]).includes(category as string) ? (category as CategoryId) : guessCategory(text);
  const truth = decide(b, amount, cat);
  return { category: cat, truth, agrees: (v: unknown) => (truth.verdict === "no") === (v === "no") };
}

export async function askClaude(
  b: Budget,
  text: string,
  persona: PersonaId,
  history: Turn[],
  last: LastItem | null = null,
  call: Call = (note = "") => getClient().messages.parse(request(b, text, persona, history, last, note)),
): Promise<AskResponse> {
  const res = await call();
  const out = res.parsed_output;
  if (res.stop_reason === "refusal" || !out) return mockAnswer(b, text, persona, last);

  // Scope guard: off-topic questions only ever get the in-character redirect, never a verdict or math.
  if (out.topic === "off_topic") {
    return { item: null, amount: null, priceEstimated: false, category: null, verdict: "info", remainingAfter: null, purchased: false, line: out.line, source: "claude" };
  }

  // "Go for it" logs the last discussed purchase: its numbers come from the app, not the model, unless they say a new price.
  const purchased = out.topic === "purchase";
  const ref = purchased && last && (!out.item || sameItem(out.item, last.item)) ? last : null;
  const fromLast = ref && parseAmount(text) === null ? ref : null;
  const item = out.item ?? ref?.item ?? null;
  const amount = fromLast ? fromLast.amount : out.amount;
  const priceEstimated = fromLast ? fromLast.priceEstimated : out.priceEstimated;

  // No amount (not even an estimate) means no math, so the model doesn't get to issue a yes/no verdict (or log anything).
  if (amount === null || amount <= 0) {
    return { ...strip(out), verdict: "info", amount: null, priceEstimated: false, remainingAfter: null, purchased: false, source: "claude" };
  }

  // Code owns the math, estimated prices included. If the model's verdict or amount disagrees, trust the numbers.
  const { category, truth, agrees } = check(b, text, amount, ref?.category ?? out.category);
  const result = { item, amount, priceEstimated, category, verdict: truth.verdict, remainingAfter: truth.remainingAfter, purchased, source: "claude" } as const;
  if (agrees(out.verdict) && amount === out.amount) return { ...strip(out), ...result };

  // Disagreed: retry once with the verified numbers so the reply stays in character and correct.
  const note = `\n\nVerified by our code for ${item ?? "this"} at $${amount} (${category}): verdict "${truth.verdict}", $${categoryLeft(b, category)} left in ${category}, $${truth.remainingAfter} after.${purchased ? " They are buying it and it is logged." : ""} Use exactly this verdict and these numbers.`;
  const again = (await call(note).catch(() => null))?.parsed_output;
  if (again && agrees(again.verdict)) {
    return { ...strip(again), ...result, item: again.item ?? item };
  }
  return mockForPurchase(b, persona, item ?? "that", amount, category, priceEstimated, purchased);
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
  last: LastItem | null,
  onSpeak: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<{ answer: AskResponse; spoken: string[] }> {
  const stream = getClient().messages.stream(request(b, text, persona, history, last), { signal });
  const spoken: string[] = [];
  let checked: "pending" | "ok" | "no" = "pending";
  let json = "";
  stream.on("text", (delta) => {
    json += delta;
    if (checked === "pending") {
      const f = fieldsBeforeLine(json);
      if (!f) return;
      const amount = typeof f.amount === "number" ? f.amount : null;
      // A logged purchase may take its numbers from the last item, so its line waits for the final answer.
      if (f.topic === "purchase") checked = "no";
      else if (f.topic === "off_topic" || amount === null || amount <= 0) checked = "ok"; // no math to check
      else {
        const known = (CATEGORY_IDS as readonly string[]).includes(f.category as string);
        const category = known ? (f.category as (typeof CATEGORY_IDS)[number]) : guessCategory(text);
        checked = decide(b, amount, category).verdict === f.verdict ? "ok" : "no";
      }
    }
    if (checked !== "ok" || spoken.length) return;
    // trimStart: the final line is trimmed, and what he said must be its prefix.
    const said = partialLine(json)?.text.trimStart() ?? "";
    const end = firstSentenceEnd(said);
    if (end) {
      spoken.push(said.slice(0, end));
      onSpeak(spoken[0]);
    }
  });
  const msg = await stream.finalMessage();

  // First call = the reply we just streamed; a retry (if the verdict was wrong) is a normal call.
  const answer = await askClaude(b, text, persona, history, last, (note = "") =>
    note
      ? getClient().messages.parse(request(b, text, persona, history, last, note), { signal })
      : Promise.resolve({ stop_reason: msg.stop_reason, parsed_output: msg.parsed_output }),
  );
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
