import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/ratelimit";
import { LIMITS } from "@/lib/types";
import { paidKey } from "@/lib/keys";

export const runtime = "nodejs";

const MAX_BYTES = 3_000_000; // ~10s of speech is far below this

// Speech-to-text via Fish Audio. 501 = not configured, so the client uses the browser's recognizer.
// Warm-up ping from the app (see /api/ask).
export function GET() {
  return new Response(null, { status: 204 });
}

export async function POST(req: Request) {
  const key = paidKey("FISH_API_KEY");
  if (!key) return NextResponse.json({ error: "stt off" }, { status: 501 });
  if (rateLimited(req, 30)) return NextResponse.json({ error: "slow down" }, { status: 429 });

  const type = req.headers.get("content-type") ?? "";
  if (!type.startsWith("audio/")) return NextResponse.json({ error: "bad input" }, { status: 400 });
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "bad input" }, { status: 400 });
  }

  const ext = type.includes("mp4") ? "m4a" : type.includes("webm") ? "webm" : type.includes("mpeg") ? "mp3" : "wav";
  const form = new FormData();
  form.append("audio", new Blob([buf], { type }), `question.${ext}`);
  form.append("language", "en");
  form.append("ignore_timestamps", "true");

  try {
    const r = await fetch("https://api.fish.audio/v1/asr", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) {
      console.error("transcribe: fish", r.status, (await r.text().catch(() => "")).slice(0, 200));
      return NextResponse.json({ text: "" }, { status: 502 });
    }
    const d = (await r.json()) as { text?: unknown };
    return NextResponse.json({ text: String(d.text ?? "").trim().slice(0, LIMITS.textMax) });
  } catch (err) {
    console.error("transcribe: failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ text: "" }, { status: 502 });
  }
}
