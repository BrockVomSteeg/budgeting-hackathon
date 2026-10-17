import { isPersonaId, personas } from "@/lib/personas";
import { rateLimited } from "@/lib/ratelimit";
import { LIMITS } from "@/lib/types";

export const runtime = "nodejs";

const noAudio = () => new Response(null, { status: 204 });

// Fish Audio voice per persona: FISH_VOICE_SERGEANT etc, else FISH_VOICE_ID.
function fishVoice(persona: string): string | undefined {
  return process.env[`FISH_VOICE_${persona.toUpperCase()}`] || process.env.FISH_VOICE_ID || undefined;
}

async function fishTts(key: string, text: string, persona: string): Promise<Response | null> {
  const r = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      model: process.env.FISH_MODEL || "s2-pro",
    },
    body: JSON.stringify({ text, reference_id: fishVoice(persona), format: "mp3" }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok || !r.body) {
    console.error("speak: fish", r.status);
    return null;
  }
  return r;
}

async function elevenTts(key: string, text: string, voiceId: string): Promise<Response | null> {
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!r.ok || !r.body) {
    console.error("speak: elevenlabs", r.status);
    return null;
  }
  return r;
}

// Fish Audio first, then ElevenLabs, else 204 so the browser voice takes over.
export async function POST(req: Request) {
  const fishKey = process.env.FISH_API_KEY;
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if ((!fishKey && !elevenKey) || rateLimited(req)) return noAudio();

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.slice(0, LIMITS.speakMax) : "";
  const persona: unknown = body?.persona;
  if (!text || !isPersonaId(persona)) return noAudio();

  try {
    const r =
      (fishKey ? await fishTts(fishKey, text, persona) : null) ??
      (elevenKey ? await elevenTts(elevenKey, text, personas[persona].voiceId) : null);
    if (!r?.body) return noAudio();
    return new Response(r.body, {
      headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("speak: failed", err instanceof Error ? err.message : err);
    return noAudio();
  }
}
