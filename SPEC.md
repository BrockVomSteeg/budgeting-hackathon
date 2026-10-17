# SPEC: Can I Afford It? 💸🔥

## 👤 User
Comfortable earners who don't track every dollar but want a quick answer to *"can I spend this, and from where?"*, by voice, without opening a spreadsheet.

## 🎯 One problem
Budget apps are screens full of charts. You just want a yes or a no, right now, out loud.

## ✨ Wow moment
You ask *"Can I afford a $400 jacket?"* → it does the math → **"No."** → then a character you picked **roasts you out loud**, with a fresh line every time.

## ✅ Must-have (by 4:00 PM)
1. 📱 Phone web app (mobile-first, one screen, works in the phone's browser)
2. 📞 **Optional (beta): ElevenLabs live voice agent** (real conversation you can interrupt, Claude as the LLM inside ElevenLabs, our code does the math as a client tool)
2b. 🎙️ **Primary: tap-to-ask** (Web Speech API + `/api/ask` Claude + text box)
3. 🧠 `/api/ask` → Claude reads the question + budget → verdict + a dynamic roast in the persona's voice
4. 🧮 Code double-checks the math (Claude extracts the amount and category, code decides yes/no)
5. 🔊 `/api/speak` → ElevenLabs TTS per persona, Fish Audio for Gordon (falls back to ElevenLabs, then the browser voice)
6. 🎭 One character: 🍳 Gordon Ramsay (R18+, see [PERSONA_GORDON.md](PERSONA_GORDON.md)), always at the top of a Copilot-style budgeting app (Dashboard, Categories, Transactions, Recurrings).
7. 💬 Short memory (last 6 turns) so follow-ups work ("ok what about $150?")
8. 🧪 Mock mode: no keys → canned logic + browser voice, still demoable
9. 🔐 Keys only on the server (Vercel env vars), never `NEXT_PUBLIC_`, never committed

## ❌ Cut
- 🏦 Real bank links / Plaid · 🔑 auth · 🗄️ DB (Supabase) · 🔌 Composio
- 🎬 Celebrity voice clones on ElevenLabs (ToS). Exception: Gordon uses a Fish Audio Gordon Ramsay voice in tap mode (team accepted the right-of-publicity risk).
- 📊 Charts, history, multiple users, settings pages

## 🔐 Key safety (no Infisical needed)
- Keys live in **Vercel → Project → Settings → Environment Variables** and `.env.local` (gitignored).
- Browser only calls our `/api/*` routes. Keys never reach the client.
- Abuse guard: `/api/speak` only voices HMAC-signed lines from `/api/ask`; input ≤300 chars, `max_tokens` small, simple per-IP rate limit, spend cap set in the Anthropic console.

## 🛡️ Safety
- Distress or self-harm phrasing gets a fixed calm reply (988 / 211) before any model call (`lib/safety.ts`).
- Each character gets fresh conversation history.

## ⚠️ Risks
| Risk | Mitigation |
|---|---|
| iPhone Safari speech recognition is flaky | Prefer Android Chrome; iOS needs Siri on; text box fallback |
| iOS blocks autoplay audio | Audio plays inside the tap gesture (unlock on first tap) |
| Venue Wi-Fi | Phone hotspot |
| Loud beach / weak phone speaker | Hold-to-talk close to mouth; Bluetooth speaker or the host's mic |
| Latency (Claude + TTS) | Haiku-class model, short replies, ElevenLabs Flash model |
| Roast crosses a line | Per-persona `rules`: PG-13 by default, R18+ for Gordon. Always roast the *purchase*, never identity |
| Live demo breaks | Screen-record a working run before 4:30 PM as backup |
