# SPEC: Can I Afford It? 💸🔥

## 👤 User
Comfortable earners who don't track every dollar but want a quick answer to *"can I spend this, and from where?"*, by voice, without opening a spreadsheet.

## 🎯 One problem
Budget apps are screens full of charts. You just want a yes or a no, right now, out loud.

## ✨ Wow moment
You ask *"Can I afford a $400 jacket?"* → it does the math → **"No."** → then a character you picked **roasts you out loud**, with a fresh line every time.

## ✅ Must-have (by 4:00 PM)
1. 📱 Phone web app (mobile-first, one screen, works in the phone's browser)
2. 🎙️ Hold-to-talk mic → speech-to-text (Web Speech API, with a text box fallback)
3. 🧠 `/api/ask` → Claude reads the question + budget → verdict + a dynamic roast in the persona's voice
4. 🧮 Code double-checks the math (Claude extracts the amount and category, code decides yes/no)
5. 🔊 `/api/speak` → ElevenLabs TTS per persona (falls back to the browser voice)
6. 🎭 4 original personas: 🎖️ Drill Sergeant, 👵 Disappointed Grandma, 🍳 Angry Chef, 💅 Rich Bestie
7. 💬 Short memory (last 6 turns) so follow-ups work ("ok what about $150?")
8. 🧪 Mock mode: no keys → canned logic + browser voice, still demoable
9. 🔐 Keys only on the server (Vercel env vars), never `NEXT_PUBLIC_`, never committed

## ❌ Cut
- 🏦 Real bank links / Plaid · 🔑 auth · 🗄️ DB (Supabase) · 🔌 Composio
- 🎬 Real celebrity voices (ElevenLabs ToS + right-of-publicity risk)
- 📊 Charts, history, multiple users, settings pages

## 🔐 Key safety (no Infisical needed)
- Keys live in **Vercel → Project → Settings → Environment Variables** and `.env.local` (gitignored).
- Browser only calls our `/api/*` routes. Keys never reach the client.
- Abuse guard: input ≤300 chars, `max_tokens` small, simple per-IP rate limit, spend cap set in the Anthropic console.

## ⚠️ Risks
| Risk | Mitigation |
|---|---|
| iPhone Safari speech recognition is flaky | Prefer Android Chrome; iOS needs Siri on; text box fallback |
| iOS blocks autoplay audio | Audio plays inside the tap gesture (unlock on first tap) |
| Venue Wi-Fi | Phone hotspot |
| Loud beach / weak phone speaker | Hold-to-talk close to mouth; Bluetooth speaker or the host's mic |
| Latency (Claude + TTS) | Haiku-class model, short replies, ElevenLabs Flash model |
| Roast crosses a line | Prompt: PG-13, roast the *purchase*, never identity |
| Live demo breaks | Screen-record a working run before 4:30 PM as backup |
