# CONTRACT 🤝: data shapes (source of truth: `lib/types.ts`)

```ts
type PersonaId = "sergeant" | "grandma" | "chef" | "bestie";
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
  voiceId: string;         // ElevenLabs premade voice id
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
  source: "claude" | "mock"
}
// 400 bad input · 429 rate limited · never 500s to the client (falls back to mock)
```

## `POST /api/speak` 🔊
```ts
// req
{ text: string /* ≤400 */, persona: PersonaId }
// res 200 audio/mpeg bytes  → play it
// res 204 (no key / error)   → client uses speechSynthesis with persona.browserVoice
```

## 🔑 Env (server only)
`ANTHROPIC_API_KEY` · `ELEVENLABS_API_KEY` · optional `ANTHROPIC_MODEL`
