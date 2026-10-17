# CONTRACT 🤝: data shapes (source of truth: `lib/types.ts`)

```ts
type PersonaId = "chef"; // Gordon is the only character
type CategoryId = "food" | "shopping" | "fun" | "travel" | "bills";

interface Category { id: CategoryId; label: string; limit: number; spent: number }
interface Budget {
  name: string;            // demo user, e.g. "Maya" (built from the phone's ledger, see lib/ledger.ts `toBudget`)
  monthlyIncome: number;
  daysLeftInMonth: number;
  checking: number;        // current balance
  upcomingBills: number;   // due before payday
  categories: Category[];
  year?: { daysLeft: number; categories: Pick<Category, "id" | "limit" | "spent">[] }; // optional year-to-date view
}

interface Persona {
  id: PersonaId; name: string; emoji: string;
  vibe: string;            // style instructions for Claude
  rules: string;           // content rating (R18+ for Gordon), injected into both prompts
  voiceId: string;         // ElevenLabs premade voice id (TTS fallback)
  fishVoiceId?: string;    // Fish Audio voice; /api/speak prefers it, persona is tap-mode only
  avatar?: string;         // /public folder of talking-head frames (see components/ChefAvatar.tsx), replaces the mic
  browserVoice: { pitch: number; rate: number }; // fallback TTS
}

interface Turn { role: "user" | "assistant"; text: string }
```

## `POST /api/ask` 🧠
```ts
// req
{
  text: string /* ≤300 */, persona: PersonaId, history: Turn[] /* ≤6 */,
  budget?: Budget          // the phone's edited ledger; bad/missing → server uses data/budget.ts demo budget
}
// res 200
{
  verdict: "yes" | "no" | "tight" | "info",
  item: string | null,
  amount: number | null,
  priceEstimated: boolean,       // true when the user gave no price and Claude estimated it (card shows "(est.)")
  category: CategoryId | null,
  remainingAfter: number | null, // category left after purchase
  line: string,                  // what gets spoken (~40 words max)
  source: "claude" | "mock",
  sig: string                    // HMAC of persona+line, required by /api/speak
}
// Scope: only "can I afford X?". No price → Claude estimates (priceEstimated true); too vague or off-topic → verdict "info", amount null.
// Distress phrasing → fixed calm reply (verdict "info") before any model call.
// 400 bad input · 429 rate limited · never 500s to the client (falls back to mock)
// GET /api/ask → 204, warm-up ping the app sends on open

// POST /api/ask?stream=1 → application/x-ndjson, one JSON object per line:
//   {"t":"say","text":string,"sig":string}   chunk to speak now (first sentence, then the rest)
//   {"t":"done", ...AskResponse}             full answer, same shape as above (last line)

```

## `GET /api/speak` 🔊
```ts
// req: query string ?text=…(≤400)&persona=PersonaId&sig=…  (GET so an <audio> element streams it; sig from /api/ask)
// res 200 audio/mpeg stream → plays as bytes arrive (Fish Audio first, then ElevenLabs)
// res 204 (no key / bad or missing sig / rate limited / error) → client uses speechSynthesis with persona.browserVoice
```

## `POST /api/transcribe` 🎙️
```ts
// req: raw audio body, Content-Type audio/* (the app sends 16 kHz mono WAV, ≤3 MB)
// res 200 { text: string }  (≤300 chars, "" if nothing heard)
// res 501 { error }         → FISH_API_KEY not set; client switches to the browser's Web Speech API
// 400 bad input · 429 rate limited · 502 { text: "" } speech service failed
// GET /api/transcribe → 204, warm-up ping
```

## `GET /api/health` 🩺
```ts
// res 200 { anthropic, model, fishKey, fishVoice, elevenlabsKey, elevenlabsAgent, voiceOverride }  (booleans, plus the model name; never key values)
```

## `GET /api/agent-token` 📞 (optional, not used by the UI)
```ts
// res 200 { token: string, voiceOverride: boolean } → startSession({ conversationToken, connectionType: "webrtc" })
// res 204 → live agent not configured, client switches to tap mode
```

## Client tool `check_affordability` (ElevenLabs agent → browser) 🧮
```ts
// in:  { item: string, amount: number, category: CategoryId, price_estimated?: boolean }
// out: JSON string { verdict, item, amount, category, category_left, left_after, safe_to_spend_overall }
```

## 🔑 Env (server only)
`ANTHROPIC_API_KEY` · `FISH_API_KEY` (speech-to-text + Gordon's TTS) · `FISH_VOICE_ID` / `FISH_VOICE_<PERSONA>` (e.g. `FISH_VOICE_CHEF`; Gordon has his own in `lib/personas.ts`) · optional `FISH_MODEL` · optional `SPEAK_SECRET` (signs `/api/speak` lines) · `ELEVENLABS_API_KEY` (TTS fallback) · optional live agent: `ELEVENLABS_AGENT_ID` · `ELEVENLABS_VOICE_OVERRIDE` · optional `ANTHROPIC_MODEL`
