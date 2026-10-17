# Can I Afford It? 💸🎙️

Ask out loud: *"Can I afford a $400 jacket?"* It does the math, and if the answer is no, a character you pick roasts you. Every roast is generated live by Claude.

Built at touch ./SAND (LA Tech Week 2026). Docs: [SPEC](SPEC.md) · [DEMO](DEMO.md) · [CONTRACT](CONTRACT.md) · [TASKS](TASKS.md)

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
Users can provide their query in two ways:

1. **Description with Amount**: "A new PlayStation 5 that costs $500"
   - The app extracts the amount and checks it against your budget

2. **Item Name Only**: "A new laptop"
   - The app searches the internet via OpenAI API to estimate the cost
   - Then checks the estimated cost against your budget

The app maintains demo budget buckets (no database needed) that track spending across categories. Based on the budget check, it returns a funny response with buying advice and context about how much over/under budget you'd be.

### Technical Flow
`mic (Web Speech API)` → `POST /api/ask` → Claude (structured JSON) → **code re-checks the math** (`lib/budget.ts`) → `POST /api/speak` → ElevenLabs → audio. With no keys, both routes fall back to mock mode and the browser voice.

## 🔐 Security
- Keys only in Vercel env vars or `.env.local` (gitignored). Never `NEXT_PUBLIC_*`.
- Browser only talks to `/api/*`. Input length caps + per-IP rate limit.
- CI runs gitleaks on every push. Set a monthly spend cap in the Anthropic console.

## Team workflow
- Own your files (see TASKS.md). Small commits, `git pull --rebase` before push.
- Shared types live in `lib/types.ts`. Change them? Tell the team first.
