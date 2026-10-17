# Can I Afford It? 💸🎙️

Ask out loud: *"Can I afford a $400 jacket?"* It does the math, and if the answer is no, Gordon Ramsay roasts you. Every roast is generated live by Claude. Gordon only answers "can I afford X?" questions, nothing else.

Built at touch ./SAND (LA Tech Week 2026). Docs: [SPEC](SPEC.md) · [DEMO](DEMO.md) · [CONTRACT](CONTRACT.md) · [TASKS](TASKS.md) · [PERSONA_GORDON](PERSONA_GORDON.md) · [AGENT_SETUP](AGENT_SETUP.md) (optional live call)

## Run
```bash
nvm use && npm ci
cp .env.example .env.local   # optional: add keys, blank = mock mode
npm run dev                  # http://localhost:3000
```
Phone testing: use the Vercel URL (the mic needs HTTPS).

## Checks (run before every push)
```bash
npm run check   # lint + typecheck + tests + build
```

## How it works

### User Input Flow
Tap Gordon's face, ask *"Can I afford a $400 jacket?"* and just stop talking: the question sends itself after about a second of silence (tap again to send early). No price, like *"a Chipotle burrito"*? He estimates a typical US price and says "about $X". Only a vague item (*"a jacket"*) makes him ask how much.
The app checks it against the budget in the phone's ledger (transactions, category limits, recurring bills; seeded from `data/budget.json`, stored in the browser, no database) and replies yes, tight, or no. A no gets a fresh roast in Gordon's voice. Anything that isn't a "can I afford it?" question gets a one-line redirect. Settings → Reset demo data restores the seed.

### Technical Flow
`mic recording (auto-stops on silence)` → `POST /api/transcribe` (Fish Audio speech-to-text; 501 = no key, the browser's Web Speech API takes over) → `POST /api/ask?stream=1` (NDJSON, sends the phone's ledger budget) → Claude Haiku (structured JSON) → **code re-checks the math** (`lib/budget.ts`) → `GET /api/speak` (HMAC-signed line, streamed) → Fish Audio (then ElevenLabs, then browser voice) → audio. The first sentence is spoken while the rest is still being written. No keys = mock roasts + browser voice. The ElevenLabs live call (`AGENT_SETUP.md`) is optional and not wired into the UI; Gordon stays in tap mode because the live agent can only use ElevenLabs voices. Check config at `/api/health`.

## 🔐 Security
- Keys only in Vercel env vars or `.env.local` (gitignored). Never `NEXT_PUBLIC_*`.
- Browser only talks to `/api/*`. Input length caps + per-IP rate limit. `/api/speak` only voices lines signed by `/api/ask` (`SPEAK_SECRET`).
- CI runs gitleaks on every push. Set a monthly spend cap in the Anthropic console.

## Team workflow
- Own your files (see TASKS.md). Small commits, `git pull --rebase` before push.
- Shared types live in `lib/types.ts`. Change them? Tell the team first.
