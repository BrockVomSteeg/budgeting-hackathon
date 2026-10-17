import { isPersonaId, personas } from "@/lib/personas";
import { rateLimited } from "@/lib/ratelimit";
import { LIMITS } from "@/lib/types";
import type { PersonaId } from "@/lib/types";

export const runtime = "nodejs";

const noAudio = () => new Response(null, { status: 204 });

// Fish Audio voice: FISH_VOICE_<PERSONA> env, else the persona's fishVoiceId (Gordon), else FISH_VOICE_ID.
function fishVoice(persona: PersonaId): string | undefined {
  return (
    process.env[`FISH_VOICE_${persona.toUpperCase()}`] ||
    personas[persona].fishVoiceId ||
    process.env.FISH_VOICE_ID ||
    undefined
  );
}

async function fishTts(key: string, text: string, voice: string): Promise<Response | null> {
  const r = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      model: process.env.FISH_MODEL || "s2.1-pro",
    },
    body: JSON.stringify({ text, reference_id: voice, format: "mp3", mp3_bitrate: 64, latency: "low" }),
    signal: AbortSignal.timeout(15_000),
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

// GET so an <audio> element can stream it: playback starts on the first bytes, not the whole clip.
// Fish Audio first (if this persona has a Fish voice), then ElevenLabs, else 204 so the browser voice takes over.
export async function GET(req: Request) {
  const fishKey = process.env.FISH_API_KEY;
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if ((!fishKey && !elevenKey) || rateLimited(req)) return noAudio();

  const q = new URL(req.url).searchParams;
  const text = (q.get("text") ?? "").slice(0, LIMITS.speakMax);
  const persona = q.get("persona");
  if (!text || !isPersonaId(persona)) return noAudio();

  try {
    const voice = fishVoice(persona);
    const r =
      (fishKey && voice ? await fishTts(fishKey, text, voice) : null) ??
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
