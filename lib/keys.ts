// Post-hackathon kill switch. Paid APIs (Claude, Fish Audio, ElevenLabs) are OFF unless
// PAID_APIS_ENABLED=1 is set on the server. Off = every route runs in free mock mode
// (template roasts, browser voice, browser speech recognition) even if old keys are still set.
export const paidApisEnabled = () => process.env.PAID_APIS_ENABLED === "1";

type PaidKey = "ANTHROPIC_API_KEY" | "FISH_API_KEY" | "ELEVENLABS_API_KEY";

/** The key only while paid APIs are switched on; otherwise undefined, so callers take their no-key path. */
export function paidKey(name: PaidKey): string | undefined {
  return paidApisEnabled() ? process.env[name] || undefined : undefined;
}
