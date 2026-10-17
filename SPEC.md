# SPEC: Can I Afford It? 💸🔥

## 👤 User
Comfortable earners who don't track every dollar but want a quick answer to *"can I spend this, and from where?"*, by voice, without opening a spreadsheet.

## 🎯 One problem
Budget apps are screens full of charts. You just want a yes or a no, right now, out loud.

## ✨ Wow moment
You ask *"Can I afford a $400 jacket?"* → it does the math → **"No."** → then a character you picked **roasts you out loud**, with a fresh line every time.

## ✅ Must-have
1. 📱 Phone web app (mobile-first, works in the phone's browser; budget data lives on the phone and is sent with each question)
2. 📞 **Optional, not wired into the UI: ElevenLabs live voice agent** (real conversation you can interrupt, Claude as the LLM inside ElevenLabs, our code does the math as a client tool; code kept in `components/LiveCall.tsx` + `/api/agent-token`)
2b. 🎙️ **Primary: tap Gordon's avatar to ask**: records the question, sends it by itself after ~0.8s of silence, speech-to-text via `/api/transcribe` (Fish Audio; falls back to the browser's Web Speech API), plus a chat text box
3. 🧠 `/api/ask` (optionally `?stream=1`, NDJSON so he starts talking early) → Claude reads the question + budget → verdict + a dynamic roast in Gordon's voice. Scope is only "can I afford X?": no price means Claude estimates one (shown as "est."), anything else gets an in-character redirect
4. 🧮 Code double-checks the math (Claude extracts the amount and category, code decides yes/no)
5. 🔊 `/api/speak` → Fish Audio TTS in Gordon's voice (falls back to ElevenLabs, then the browser voice)
6. 🎭 One character: 🍳 Gordon Ramsay (R18+, see [PERSONA_GORDON.md](PERSONA_GORDON.md)), always at the top of a Copilot-style budgeting app (Dashboard, Categories, Transactions, Recurrings, Plan).
7. 💬 Short memory (last 6 turns) so follow-ups work ("ok what about $150?")
8. 🧪 Mock mode: no keys → canned logic + browser voice, still demoable
9. 🔐 Keys only on the server (Vercel env vars), never `NEXT_PUBLIC_`, never committed

## ❌ Cut
- 🏦 Real bank links / Plaid · 🔑 auth · 🗄️ server DB (Supabase; the ledger is browser `localStorage`) · 🔌 Composio
- 🎬 Celebrity voice clones on ElevenLabs (ToS). Exception: Gordon uses a Fish Audio Gordon Ramsay voice in tap mode (team accepted the right-of-publicity risk).
- 📊 Charts, multiple users, accounts, sync across devices

## 🔐 Key safety (no Infisical needed)
- Keys live in **Vercel → Project → Settings → Environment Variables** and `.env.local` (gitignored).
- Browser only calls our `/api/*` routes. Keys never reach the client.
- Abuse guard: `/api/speak` only voices HMAC-signed lines from `/api/ask` (secret: `SPEAK_SECRET`, else the API keys); input ≤300 chars, short replies, simple per-IP rate limit, spend cap set in the Anthropic console.

## 🛡️ Safety
- Distress or self-harm phrasing gets a fixed calm reply (988 / 211) before any model call (`lib/safety.ts`).
- Scope guard: anything that isn't "can I afford X?" gets a one-line redirect with no facts or budget numbers; code, not Claude, issues the yes/no.

## ⚠️ Risks
| Risk | Mitigation |
|---|---|
| iPhone Safari speech recognition is flaky | We record audio and transcribe on the server (Fish Audio); the browser recognizer is only a fallback; text box always works |
| iOS blocks autoplay audio | Audio plays inside the tap gesture (unlock on first tap) |
| Venue Wi-Fi | Phone hotspot |
| Loud beach / weak phone speaker | Hold the phone close to your mouth (auto-send waits for silence); Settings → Speaker mode; Bluetooth speaker or the host's mic |
| Latency (Claude + TTS) | Haiku-class model, short replies, streamed `/api/ask` speaks the first sentence early, pre-recorded filler line while thinking, low-latency Fish TTS |
| Roast crosses a line | Gordon's `rules` are R18+ (swearing allowed). Always roast the *purchase*, never identity |
| Live demo breaks | Screen-record a working run before the demo as backup |
