import { createHmac, timingSafeEqual } from "node:crypto";

// /api/ask signs every line it returns; /api/speak only voices signed lines.
// Stops anyone using our TTS keys (and persona voices) to say arbitrary text.
const secret = () =>
  process.env.SPEAK_SECRET || process.env.ANTHROPIC_API_KEY || process.env.FISH_API_KEY || process.env.ELEVENLABS_API_KEY || "dev-only";

export function signLine(persona: string, text: string): string {
  return createHmac("sha256", secret()).update(`${persona}\n${text}`).digest("base64url").slice(0, 32);
}

export function verifyLine(persona: string, text: string, sig: string | null): boolean {
  if (!sig) return false;
  const a = Buffer.from(signLine(persona, text));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
