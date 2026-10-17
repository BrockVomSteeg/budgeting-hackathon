import { NextResponse } from "next/server";
import { demoBudget } from "@/data/budget";
import { parseBudget, parseLastItem } from "@/lib/budget";
import { askClaude, askClaudeStreaming, hasClaude } from "@/lib/claude";
import { mockAnswer } from "@/lib/mock";
import { isPersonaId } from "@/lib/personas";
import { rateLimited } from "@/lib/ratelimit";
import { distressReply } from "@/lib/safety";
import { signLine } from "@/lib/sign";
import { splitForSpeech } from "@/lib/stream";
import { LIMITS, type AskResponse, type Budget, type LastItem, type PersonaId, type Turn } from "@/lib/types";

export const runtime = "nodejs";

function cleanHistory(x: unknown): Turn[] {
  if (!Array.isArray(x)) return [];
  return x
    .slice(-LIMITS.historyMax)
    .filter(
      (t): t is Turn =>
        !!t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string",
    )
    .map((t) => ({ role: t.role, text: clean(t.text).slice(0, LIMITS.speakMax) }));
}

// Strip the prompt's own delimiters so user text can't break out of its quotes.
const clean = (s: string) => s.replace(/"""/g, "\"").replace(/\b(system|assistant|user):/gi, "$1 -");

const reply = (a: AskResponse, persona: PersonaId, init?: ResponseInit) =>
  NextResponse.json({ ...a, sig: signLine(persona, a.line) }, init);

// The app pings this when it opens so the first real question doesn't pay for a cold start.
export function GET() {
  return new Response(null, { status: 204 });
}

export async function POST(req: Request) {
  if (rateLimited(req)) return NextResponse.json({ error: "slow down" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? clean(body.text.trim()) : "";
  const persona: unknown = body?.persona;
  if (!text || text.length > LIMITS.textMax || !isPersonaId(persona)) {
    return NextResponse.json({ error: "bad input" }, { status: 400 });
  }
  const history = cleanHistory(body.history);
  // The phone sends the budget the user has edited in the app; anything malformed falls back to the demo.
  const budget = parseBudget(body.budget) ?? demoBudget;
  // What Gordon last gave a verdict on, so "ok, go for it" knows what to log.
  const parsedLast = parseLastItem(body.last);
  const last = parsedLast && { ...parsedLast, item: clean(parsedLast.item) };

  // Answers that don't need Claude: the distress reply, or the mock when no key is configured.
  const care = distressReply(text);
  const fixed: AskResponse | null = care
    ? { verdict: "info", item: null, amount: null, priceEstimated: false, category: null, remainingAfter: null, purchased: false, line: care, source: "mock" }
    : hasClaude()
      ? null
      : mockAnswer(budget, text, persona, last);

  if (new URL(req.url).searchParams.get("stream") === "1") return streamed(budget, text, persona, history, last, fixed);

  if (fixed) return reply(fixed, persona);
  try {
    return reply(await askClaude(budget, text, persona, history, last), persona);
  } catch (err) {
    console.error("ask: claude failed, using mock", err instanceof Error ? err.message : err);
    const reason = err instanceof Error ? err.constructor.name : "unknown";
    return reply(mockAnswer(budget, text, persona, last), persona, {
      headers: { "x-fallback-reason": reason },
    });
  }
}

/**
 * ?stream=1: newline-delimited JSON so the phone can start talking before the reply is finished.
 *   {"t":"say","text":"…","sig":"…"}  a chunk to speak now (first sentence, then the rest)
 *   {"t":"done", …AskResponse}        the full answer (same shape as the normal JSON reply)
 */
function streamed(budget: Budget, text: string, persona: PersonaId, history: Turn[], last: LastItem | null, fixed: AskResponse | null): Response {
  const enc = new TextEncoder();
  const abort = new AbortController();
  let closed = false;
  const body = new ReadableStream({
    async start(ctrl) {
      const send = (o: object) => {
        if (closed) return;
        try {
          ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        } catch {
          closed = true; // the phone went away
        }
      };
      const said: string[] = [];
      const say = (chunk: string) => {
        said.push(chunk);
        send({ t: "say", text: chunk, sig: signLine(persona, chunk) });
      };
      const finish = (a: AskResponse, spoken: string[]) => {
        if (!spoken.length) splitForSpeech(a.line).forEach(say);
        send({ t: "done", ...a, sig: signLine(persona, a.line) });
        if (!closed) ctrl.close();
        closed = true;
      };
      if (fixed) return finish(fixed, []);
      try {
        const { answer, spoken } = await askClaudeStreaming(budget, text, persona, history, last, say, abort.signal);
        finish(answer, spoken);
      } catch (err) {
        if (closed) return;
        console.error("ask: claude stream failed", err instanceof Error ? err.message : err);
        if (said.length) {
          // He already started talking, so the answer is what he said.
          return finish({ ...mockAnswer(budget, text, persona, last), verdict: "info", purchased: false, line: said.join(" ") }, said);
        }
        // Nothing said yet: same as the non-streamed reply.
        // A second full Claude call could outlast the phone's timeout, so answer from the templates now.
        finish(mockAnswer(budget, text, persona, last), []);
      }
    },
    cancel() {
      closed = true;
      abort.abort(); // stop paying for a reply nobody will hear
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
