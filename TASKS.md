# TASKS 👥: one owner per file group, no overlaps

> Claude scaffolded everything working in mock mode first. Then each person **owns and upgrades** their files. Pull often, commit small, push to `main`.

## 💪 Strong dev: AI + voice backend
Files: `app/api/*` · `lib/claude.ts` · `lib/stream.ts` · `lib/sign.ts` · `lib/agent.ts` · `lib/ratelimit.ts`
- [ ] Add keys in Vercel env vars (Prod + Preview: `ANTHROPIC_API_KEY`, `FISH_API_KEY`, `SPEAK_SECRET`), redeploy, check `/api/health`
- [ ] Optional: [AGENT_SETUP.md](AGENT_SETUP.md) (ElevenLabs live agent, not wired into the UI)
- [ ] Verify live Claude JSON output + math override
- [ ] Fish Audio STT + TTS: test latency on phone over hotspot
- [ ] Get time from tap to first audio under ~3s

## 🎯 Mid dev #1 (you): voice UX on the phone
Files: `app/page.tsx` · `components/*` · `lib/voice.ts` · `lib/record.ts` (unused live call UI is `components/LiveCall.tsx`)
- [ ] Tap Gordon, ask, auto-send on silence feels great on the demo phone
- [ ] iOS audio unlock + browser-recognizer fallback tested
- [ ] Verdict bubble (YES/NOPE/TIGHT), loading state

## 🧩 Mid dev #2: personality + data
Files: `lib/personas.ts` · `lib/gordon.ts` · `lib/prompt.ts` · `lib/ledger.ts` · `data/budget.json` · `lib/mock.ts`
- [ ] Tune Gordon's prompt: funny, R18+, ≤2 sentences, cites real numbers, stays on "can I afford it?"
- [ ] Demo ledger tuned so the DEMO.md lines land (jacket = no, burrito = yes)

## 🌱 Beginner: stage + submission
Files: `DEMO.md` · `README.md` · `app/globals.css`
- [ ] Find the submission form + any required sponsor tools **now** ⏰
- [ ] Get a Bluetooth speaker + hotspot ready
- [ ] Rehearse DEMO.md with a timer, record the backup video before the demo
- [ ] Polish colors / font sizes (CSS only)

## ⏰ Schedule (PT, Sat Oct 17)
| Time | Goal |
|---|---|
| ✅ 1:55–2:40 | Plan approved, scaffold live on Vercel, keys added |
| ✅ 2:40–4:00 | Parallel upgrades, live tests after every push |
| 🧊 **4:00** | **Feature freeze**: bug fixes only |
| 🎤 4:00–4:45 | iPhone test · backup video · submit form · rehearse 5× |
| 🚀 **5:00** | **Demo** at `can-i-afford-it-ashen.vercel.app` |
