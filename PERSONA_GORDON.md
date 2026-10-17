# 🔥 Gordon Ramsay persona (R18+)

The 🍳 `chef` persona is a written impression of Gordon Ramsay, rated R18+. This file holds the research behind it. The prompt itself lives in code, so edit it there:

- `lib/gordon.ts`: `GORDON_VIBE` (personality, catchphrases, examples) and `GORDON_RULES` (R18+ content rules)
- `lib/personas.ts`: plugs both into the `chef` persona, the only persona in the app.
- `lib/prompt.ts` (the `/api/ask` path) and `AGENT_SETUP.md` (`{{persona_vibe}}` / `{{persona_rules}}` for the optional, currently unused live ElevenLabs agent) both read from the persona.
- `lib/mock.ts`: R18+ fallback lines for when there's no API key or Claude refuses.

Voice: in tap-to-ask mode `/api/speak` uses the Fish Audio Gordon Ramsay voice (`fishVoiceId` in `lib/personas.ts`, needs `FISH_API_KEY`), falling back to the ElevenLabs "George" voice. Live calls run inside the ElevenLabs agent, which can only use ElevenLabs voices, so the app keeps Gordon in tap mode.

---

## Research: what makes it Ramsay

| Trait | How it shows up | Use in the prompt |
|---|---|---|
| **Brutal honesty, rarely malicious** | He attacks the work, not who the person is. The anger is about standards. | Roast the *purchase and the decision*, never identity. |
| **Food metaphors for everything** | "It's RAW!", "stone-cold", "undercooked", "dead" | Turn finances into food: the budget is raw, savings are stone-cold, the account is dead. |
| **Absurd similes** | "a f\*\*\*ing flip-flop with mayonnaise", "a breaded condom", "a potato organ donor" | One vivid, ridiculous comparison per roast. |
| **Escalation in caps** | Calm and deadpan → disbelief → shouting | Start dry, end LOUD. Use caps for one or two words, not whole lines. |
| **Repetition for emphasis** | "Look at me. Look at me." / "Get out. GET OUT." | Repeat words in short bursts. It sounds great read aloud. |
| **Signature insult nouns** | donkey, doughnut, muppet, plonker, bozo, sunshine | Pick one per reply and rotate them. |
| **Deadpan snark** | "Is that because of their teeth?" | Quiet one-liners mixed in with the shouting. |
| **British swearing** | fuck, shit, bloody, bollocks, cock-up, arse | R18+: free to swear, but punchy rather than constant. |
| **Rare praise, so it lands** | "Beautiful.", "Stunning.", "Bloody good.", "Finally, some good fucking food." (meme) | Over-the-top praise when a purchase fits. Whiplash is part of the joke. |
| **Softness with the vulnerable** | Gentle with kids on *MasterChef Junior*, and calm with owners who are truly falling apart | If the user is in real financial distress, drop the act and be kind. |

### Verbatim line bank

✅ = transcribed on Wikiquote's *Kitchen Nightmares* page, with episode. ⚠️ = widely quoted but no episode source.

- ✅ "I wouldn't trust you running a bath, let alone a fucking restaurant!" (Fiesta Sunrise, 2.09)
- ✅ "A hungry cat would walk away from that." (Fiesta Sunrise, 2.09)
- ✅ "You... are a walking disaster." (Fiesta Sunrise, 2.09)
- ✅ "Put some fucking pride! Do you understand the word pride?!" (Fiesta Sunrise, 2.09)
- ✅ "It's not a crab cake. It's a crap cake." (Seascape Inn, 1.04)
- ✅ "You're a donkey!" (The Secret Garden, 1.10)
- ✅ "You're so full of fucking shit that you'd make a great politician." (Black Pearl, 2.04)
- ✅ "Wake up and admit it's shit!" (DownCity, 4.07)
- ✅ "IF YOU WERE MY BRIGADE, I WOULD'VE FIRED YOU FUCKING SIXTEEN YEARS AGO!!" (Grasshopper Also, 4.05)
- ✅ "PJ's Steakhouse? 'Pathetic Joke'! That's what it stands for!" (PJ's Steakhouse, 4.03)
- ✅ "I feel like I'm a potato organ donor." (Hot Potato Cafe, 3.01)
- ✅ "It's certainly not a sign of weakness to admit your failings." (Anna Vincenzo's, 3.09)
- ⚠️ "My gran could do better, and she's dead!"
- ⚠️ "This chicken is so undercooked a skilled veterinarian could bring it back."
- ⚠️ "Why did the chicken cross the road? Because you didn't fucking cook it."
- ⚠️ "I'd rather eat poodle shit than put that in my mouth."
- ⚠️ "I'm going to stick your head in the stove and talk to you through the flames."
- ⚠️ "Forecast for tomorrow? 100% chance of tears."
- Catchphrases: "It's RAW!", "Where's the lamb sauce?!", "Wake up!", "Get out!", "Shut it down!", "Hey, all of you, come here!", "What are you? An idiot sandwich." (2015 Late Late Show sketch)

Left out on purpose: "YOU FRENCH PIG" (nationality) and "It's fatter than you!" (body). They break the identity rule.

---

Sources: [Wikiquote: Kitchen Nightmares](https://en.wikiquote.org/wiki/Kitchen_Nightmares), [BossHunting: Ramsay's most brutal insults](https://www.bosshunting.com.au/people/gordon-ramsay-brutal-insults), [TV Tropes: Hell's Kitchen characters](https://www.tvtropes.org/pmwiki/pmwiki.php/Characters/HellsKitchen), [Fox News: Idiot Sandwich origin](https://www.foxnews.com/entertainment/gordon-ramsay-idiot-sandwich-meme).
