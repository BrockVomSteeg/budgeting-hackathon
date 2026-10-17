import { NextResponse } from "next/server";
import { demoBudget } from "@/data/budget";
import { askClaude, hasClaude } from "@/lib/claude";
import { mockAnswer } from "@/lib/mock";
import { isPersonaId } from "@/lib/personas";
import { rateLimited } from "@/lib/ratelimit";
import { LIMITS, type Turn } from "@/lib/types";

export const runtime = "nodejs";

function cleanHistory(x: unknown): Turn[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter(
      (t): t is Turn =>
        !!t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string",
    )
    .slice(-LIMITS.historyMax)
    .map((t) => ({ role: t.role, text: t.text.slice(0, LIMITS.speakMax) }));
}

export async function POST(req: Request) {
  if (rateLimited(req)) return NextResponse.json({ error: "slow down" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const persona: unknown = body?.persona;
  if (!text || text.length > LIMITS.textMax || !isPersonaId(persona)) {
    return NextResponse.json({ error: "bad input" }, { status: 400 });
  }
  const history = cleanHistory(body.history);

  if (!hasClaude()) return NextResponse.json(mockAnswer(demoBudget, text, persona));
  try {
    return NextResponse.json(await askClaude(demoBudget, text, persona, history));
  } catch (err) {
    console.error("ask: claude failed, using mock", err instanceof Error ? err.message : err);
    return NextResponse.json(mockAnswer(demoBudget, text, persona));
  }
}
