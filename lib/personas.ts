import type { Persona, PersonaId } from "./types";
import { GORDON_RULES, GORDON_VIBE } from "./gordon.ts";

// Gordon is the only character. voiceId = ElevenLabs premade fallback voice;
// fishVoiceId = the Fish Audio Gordon voice /api/speak prefers.
// rules = content rating, injected into both the /api/ask prompt and the live agent prompt.
export const personas: Record<PersonaId, Persona> = {
  chef: {
    id: "chef",
    name: "Gordon Ramsay",
    emoji: "🍳",
    vibe: GORDON_VIBE,
    rules: GORDON_RULES,
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    fishVoiceId: "e605a2a42b0a44ccb7af2e42e1676c92",
    avatar: "/gordon",
    browserVoice: { pitch: 0.9, rate: 1.2 },
  },
};

export const GORDON = personas.chef;

export function isPersonaId(x: unknown): x is PersonaId {
  return typeof x === "string" && Object.hasOwn(personas, x);
}
