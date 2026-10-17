import { isPersonaId, personas } from "@/lib/personas";
import { rateLimited } from "@/lib/ratelimit";
import { LIMITS } from "@/lib/types";

export const runtime = "nodejs";

const noAudio = () => new Response(null, { status: 204 });

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key || rateLimited(req)) return noAudio();

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.slice(0, LIMITS.speakMax) : "";
  const persona: unknown = body?.persona;
  if (!text || !isPersonaId(persona)) return noAudio();

  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${personas[persona].voiceId}?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!r.ok || !r.body) {
      console.error("speak: elevenlabs", r.status);
      return noAudio();
    }
    return new Response(r.body, {
      headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("speak: failed", err instanceof Error ? err.message : err);
    return noAudio();
  }
}
