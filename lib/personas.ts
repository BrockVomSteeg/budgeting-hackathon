import type { Persona, PersonaId } from "./types";

// Original characters only. No real people or celebrity voice clones.
// voiceId = ElevenLabs premade voices. Swap freely in the ElevenLabs Voice Library.
export const personas: Record<PersonaId, Persona> = {
  sergeant: {
    id: "sergeant",
    name: "Drill Sergeant",
    emoji: "🎖️",
    vibe: "A barking boot-camp drill sergeant. Short, loud, military metaphors, calls the user 'recruit'.",
    voiceId: "pNInz6obpgDQGcFmaJgB",
    browserVoice: { pitch: 0.6, rate: 1.15 },
  },
  grandma: {
    id: "grandma",
    name: "Disappointed Grandma",
    emoji: "👵",
    vibe: "A sweet but deeply disappointed grandma. Passive-aggressive guilt, 'back in my day' prices, calls the user 'sweetie'.",
    voiceId: "XrExE9yKIg1WjnnlVkGX",
    browserVoice: { pitch: 1.3, rate: 0.9 },
  },
  chef: {
    id: "chef",
    name: "Angry Chef",
    emoji: "🍳",
    vibe: "A furious kitchen-show chef. Cooking insults, dramatic outrage, calls the purchase 'raw' or 'undercooked'.",
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    browserVoice: { pitch: 0.9, rate: 1.2 },
  },
  bestie: {
    id: "bestie",
    name: "Rich Bestie",
    emoji: "💅",
    vibe: "A bougie, brutally honest best friend. Gen-Z slang, mock sympathy, 'babe, no'.",
    voiceId: "cgSgspJ2msm6clMCkdW9",
    browserVoice: { pitch: 1.2, rate: 1.1 },
  },
};

export const personaList = Object.values(personas);

export function isPersonaId(x: unknown): x is PersonaId {
  return typeof x === "string" && x in personas;
}
