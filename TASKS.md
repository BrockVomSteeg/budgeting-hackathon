# TASKS 👥: one owner per file group, no overlaps

> Claude scaffolds everything working in mock mode first (~2:30 PM). Then each person **owns and upgrades** their files. Pull often, commit small, push to `main`.

## 💪 Strong dev: AI + voice backend
Files: `app/api/*` · `lib/claude.ts` · `lib/agent.ts` · `lib/ratelimit.ts`
- [ ] 🔥 **FIRST: do [AGENT_SETUP.md](AGENT_SETUP.md)** (ElevenLabs live agent)
- [ ] Add keys in Vercel env vars (Prod + Preview), redeploy
- [ ] Verify live Claude JSON output + math override
- [ ] ElevenLabs: Flash model, test latency on phone over hotspot
- [ ] Get time from tap to first audio under ~3s

## 🎯 Mid dev #1 (you): voice UX on the phone
Files: `app/page.tsx` · `components/*` · `lib/voice.ts` (live call UI is `components/LiveCall.tsx`)
- [ ] Tap-to-ask feels great on the demo phone
- [ ] iOS audio unlock + speech fallback tested
- [ ] Big verdict card (✅/❌), persona picker, loading state

## 🧩 Mid dev #2: personality + data
Files: `lib/personas.ts` · `lib/prompt.ts` · `data/budget.ts` · `lib/mock.ts`
- [ ] Pick 4 ElevenLabs premade voices that match the personas
- [ ] Tune the prompt: funny, PG-13 (Gordon is R18+), ≤2 sentences, cites real numbers
- [ ] Demo budget tuned so the DEMO.md lines hit yes / no / no

## 🌱 Beginner: stage + submission
Files: `DEMO.md` · `README.md` · `app/globals.css`
- [ ] Find the submission form + any required sponsor tools **now** ⏰
- [ ] Get a Bluetooth speaker + hotspot ready
- [ ] Rehearse DEMO.md with a timer, record the backup video by 4:30
- [ ] Polish colors / font sizes (CSS only)

## ⏰ Hour by hour (PT)
| Time | Goal |
|---|---|
| 1:55–2:10 | ✅ Plan approved, everyone reads SPEC + CONTRACT, beginner checks rules |
| 2:10–2:40 | 🏗️ Scaffold live on Vercel (mock mode), keys added |
| 2:40–3:30 | ⚡ Parallel upgrades per TASKS, test on the real phone every 15 min |
| 3:30–3:50 | 🔗 Integration + bug bash on the demo phone only |
| **4:00** | 🧊 **FEATURE FREEZE**: tag `v1-demo`, bug fixes only |
| 4:00–4:45 | 🎤 Rehearse 5× · record backup video · submit form |
| **5:00** | 🚀 Demo |
