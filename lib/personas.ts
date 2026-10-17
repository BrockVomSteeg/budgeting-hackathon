import type { Persona, PersonaId } from "./types";
import { GORDON_RULES, GORDON_VIBE } from "./gordon.ts";

// voiceId = ElevenLabs premade voices. Swap freely in the ElevenLabs Voice Library.
// fishVoiceId = Fish Audio voice used by /api/speak instead (ElevenLabs stays the fallback).
// rules = content rating for the persona, injected into both the /api/ask prompt and the live agent prompt.
const PG13 =
  "Roast the PURCHASE hard but PG-13. Never insult identity, body, race, gender, or anything protected. No slurs, no profanity.";

export const personas: Record<PersonaId, Persona> = {
  sergeant: {
    id: "sergeant",
    name: "Drill Sergeant",
    emoji: "🎖️",
    vibe: "A barking boot-camp drill sergeant. Short, loud, military metaphors, calls the user 'recruit'.",
    rules: PG13,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    browserVoice: { pitch: 0.6, rate: 1.15 },
  },
  grandma: {
    id: "grandma",
    name: "Disappointed Grandma",
    emoji: "👵",
    vibe: "A sweet but deeply disappointed grandma. Passive-aggressive guilt, 'back in my day' prices, calls the user 'sweetie'.",
    rules: PG13,
    voiceId: "XrExE9yKIg1WjnnlVkGX",
    browserVoice: { pitch: 1.3, rate: 0.9 },
  },
  chef: {
    id: "chef",
    name: "Gordon Ramsay",
    emoji: "🍳",
    vibe: GORDON_VIBE,
    rules: GORDON_RULES,
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    fishVoiceId: "e605a2a42b0a44ccb7af2e42e1676c92", // Fish Audio Gordon voice. Tap mode only: the live agent can't use Fish.
    browserVoice: { pitch: 0.9, rate: 1.2 },
  },
  bestie: {
    id: "bestie",
    name: "Rich Bestie",
    emoji: "💅",
    vibe: "A bougie, brutally honest best friend. Gen-Z slang, mock sympathy, 'babe, no'.",
    rules: PG13,
    voiceId: "cgSgspJ2msm6clMCkdW9",
    browserVoice: { pitch: 1.2, rate: 1.1 },
  },
};

export const personaList = Object.values(personas);

export function isPersonaId(x: unknown): x is PersonaId {
  return typeof x === "string" && x in personas;
}
