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
`mic (Web Speech API)` → `POST /api/ask` → Claude (structured JSON) → **code re-checks the math** (`lib/budget.ts`) → `POST /api/speak` → ElevenLabs → audio. With no keys, both routes fall back to mock mode and the browser voice.

## 🔐 Security
- Keys only in Vercel env vars or `.env.local` (gitignored). Never `NEXT_PUBLIC_*`.
- Browser only talks to `/api/*`. Input length caps + per-IP rate limit.
- CI runs gitleaks on every push. Set a monthly spend cap in the Anthropic console.

## Team workflow
- Own your files (see TASKS.md). Small commits, `git pull --rebase` before push.
- Shared types live in `lib/types.ts`. Change them? Tell the team first.
