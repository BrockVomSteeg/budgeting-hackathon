import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/ratelimit";
import { paidKey } from "@/lib/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mints a short-lived WebRTC token so the ElevenLabs API key never reaches the browser.
// 204 = live agent not configured; the client falls back to tap-to-talk mode.
export async function GET(req: Request) {
  const key = paidKey("ELEVENLABS_API_KEY");
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!key || !agentId) return new Response(null, { status: 204 });
  if (rateLimited(req, 10)) return NextResponse.json({ error: "slow down" }, { status: 429 });

  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": key }, cache: "no-store", signal: AbortSignal.timeout(8_000) },
    );
    if (!r.ok) {
      console.error("agent-token: elevenlabs", r.status);
      return new Response(null, { status: 204 });
    }
    const { token } = (await r.json()) as { token?: string };
    if (!token) return new Response(null, { status: 204 });
    return NextResponse.json(
      { token, voiceOverride: process.env.ELEVENLABS_VOICE_OVERRIDE === "1" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("agent-token: failed", err instanceof Error ? err.message : err);
    return new Response(null, { status: 204 });
  }
}
