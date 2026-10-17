# CONTRACT 🤝: data shapes (source of truth: `lib/types.ts`)

```ts
type PersonaId = "chef"; // Gordon is the only character
type CategoryId = "food" | "shopping" | "fun" | "travel" | "bills";

interface Category { id: CategoryId; label: string; limit: number; spent: number }
interface Budget {
  name: string;            // demo user, e.g. "Maya"
  monthlyIncome: number;
  daysLeftInMonth: number;
  checking: number;        // current balance
  upcomingBills: number;   // due before payday
  categories: Category[];
}

interface Persona {
  id: PersonaId; name: string; emoji: string;
  vibe: string;            // style instructions for Claude
  rules: string;           // content rating (PG-13, or R18+ for Gordon), injected into both prompts
  voiceId: string;         // ElevenLabs premade voice id
  fishVoiceId?: string;    // Fish Audio voice; /api/speak prefers it, persona is tap-mode only
  avatar?: string;         // /public folder of talking-head frames (see components/ChefAvatar.tsx), replaces the mic
  browserVoice: { pitch: number; rate: number }; // fallback TTS
}

interface Turn { role: "user" | "assistant"; text: string }
```

## `POST /api/ask` 🧠
```ts
// req
{ text: string /* ≤300 */, persona: PersonaId, history: Turn[] /* ≤6 */ }
// res 200
{
  verdict: "yes" | "no" | "tight" | "info",
  item: string | null,
  amount: number | null,
  category: CategoryId | null,
  remainingAfter: number | null, // category left after purchase
  line: string,                  // what gets spoken (≤60 words)
  source: "claude" | "mock",
  sig: string                    // HMAC of persona+line, required by /api/speak
}
// 400 bad input · 429 rate limited · never 500s to the client (falls back to mock)
```

## `GET /api/speak` 🔊
```ts
// req: query string ?text=…(≤400)&persona=PersonaId  (GET so an <audio> element streams it)
// res 200 audio/mpeg stream → plays as bytes arrive
// res 204 (no key / error)   → client uses speechSynthesis with persona.browserVoice
```

## `GET /api/agent-token` 📞
```ts
// res 200 { token: string, voiceOverride: boolean } → startSession({ conversationToken, connectionType: "webrtc" })
// res 204 → live agent not configured, client switches to tap mode
```

## Client tool `check_affordability` (ElevenLabs agent → browser) 🧮
```ts
// in:  { item: string, amount: number, category: CategoryId }
// out: JSON string { verdict, item, amount, category, category_left, left_after, safe_to_spend_overall }
```

## 🔑 Env (server only)
`ANTHROPIC_API_KEY` · `FISH_API_KEY` · `FISH_VOICE_ID` / `FISH_VOICE_<PERSONA>` · optional `SPEAK_SECRET` · `ELEVENLABS_API_KEY` · `FISH_API_KEY` · `ELEVENLABS_AGENT_ID` · `ELEVENLABS_VOICE_OVERRIDE` · optional `ANTHROPIC_MODEL`
