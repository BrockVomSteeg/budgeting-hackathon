import { NextResponse } from "next/server";
import { demoBudget } from "@/data/budget";
import { parseBudget } from "@/lib/budget";
import { askClaude, askClaudeStreaming, hasClaude } from "@/lib/claude";
import { mockAnswer } from "@/lib/mock";
import { isPersonaId } from "@/lib/personas";
import { rateLimited } from "@/lib/ratelimit";
import { distressReply } from "@/lib/safety";
import { signLine } from "@/lib/sign";
import { splitForSpeech } from "@/lib/stream";
import { LIMITS, type AskResponse, type Budget, type PersonaId, type Turn } from "@/lib/types";

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

  if (new URL(req.url).searchParams.get("stream") === "1") return streamed(budget, text, persona, history);

  const care = distressReply(text);
  if (care) {
    const a: AskResponse = { verdict: "info", item: null, amount: null, priceEstimated: false, category: null, remainingAfter: null, line: care, source: "mock" };
    return reply(a, persona);
  }

  if (!hasClaude()) return reply(mockAnswer(budget, text, persona), persona);
  try {
    return reply(await askClaude(budget, text, persona, history), persona);
  } catch (err) {
    console.error("ask: claude failed, using mock", err instanceof Error ? err.message : err);
    const reason = err instanceof Error ? err.constructor.name : "unknown";
    return reply(mockAnswer(budget, text, persona), persona, {
      headers: { "x-fallback-reason": reason },
    });
  }
}

/**
 * ?stream=1: newline-delimited JSON so the phone can start talking before the reply is finished.
 *   {"t":"say","text":"…","sig":"…"}  a chunk to speak now (first sentence, then the rest)
 *   {"t":"done", …AskResponse}        the full answer (same shape as the normal JSON reply)
 */
function streamed(budget: Budget, text: string, persona: PersonaId, history: Turn[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(ctrl) {
      const send = (o: object) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const said: string[] = [];
      const say = (chunk: string) => {
        said.push(chunk);
        send({ t: "say", text: chunk, sig: signLine(persona, chunk) });
      };
      const finish = (a: AskResponse, spoken: string[]) => {
        if (!spoken.length) splitForSpeech(a.line).forEach(say);
        send({ t: "done", ...a, sig: signLine(persona, a.line) });
        ctrl.close();
      };
      const care = distressReply(text);
      if (care) {
        const a: AskResponse = { verdict: "info", item: null, amount: null, priceEstimated: false, category: null, remainingAfter: null, line: care, source: "mock" };
        return finish(a, []);
      }
      if (!hasClaude()) return finish(mockAnswer(budget, text, persona), []);
      try {
        const { answer, spoken } = await askClaudeStreaming(budget, text, persona, history, say);
        finish(answer, spoken);
      } catch (err) {
        console.error("ask: claude stream failed", err instanceof Error ? err.message : err);
        if (said.length) {
          // He already started talking, so the answer is what he said.
          return finish({ ...mockAnswer(budget, text, persona), verdict: "info", line: said.join(" ") }, said);
        }
        // Nothing said yet: same as the non-streamed reply.
        const a = await askClaude(budget, text, persona, history).catch(() => mockAnswer(budget, text, persona));
        finish(a, []);
      }
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
