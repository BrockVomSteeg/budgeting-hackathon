import { NextResponse } from "next/server";
import { demoBudget } from "@/data/budget";
import { askClaude, hasClaude } from "@/lib/claude";
import { mockAnswer } from "@/lib/mock";
import { isPersonaId } from "@/lib/personas";
import { rateLimited } from "@/lib/ratelimit";
import { distressReply } from "@/lib/safety";
import { signLine } from "@/lib/sign";
import { LIMITS, type AskResponse, type PersonaId, type Turn } from "@/lib/types";

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

export async function POST(req: Request) {
  if (rateLimited(req)) return NextResponse.json({ error: "slow down" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? clean(body.text.trim()) : "";
  const persona: unknown = body?.persona;
  if (!text || text.length > LIMITS.textMax || !isPersonaId(persona)) {
    return NextResponse.json({ error: "bad input" }, { status: 400 });
  }
  const history = cleanHistory(body.history);

  const care = distressReply(text);
  if (care) {
    const a: AskResponse = { verdict: "info", item: null, amount: null, category: null, remainingAfter: null, line: care, source: "mock" };
    return reply(a, persona);
  }

  if (!hasClaude()) return reply(mockAnswer(demoBudget, text, persona), persona);
  try {
    return reply(await askClaude(demoBudget, text, persona, history), persona);
  } catch (err) {
    console.error("ask: claude failed, using mock", err instanceof Error ? err.message : err);
    const reason = err instanceof Error ? err.constructor.name : "unknown";
    return reply(mockAnswer(demoBudget, text, persona), persona, {
      headers: { "x-fallback-reason": reason },
    });
  }
}
