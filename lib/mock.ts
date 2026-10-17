import type { AskResponse, Budget, CategoryId, LastItem, PersonaId } from "./types";
import { categoryLeft, decide } from "./budget.ts";

const KEYWORDS: Record<CategoryId, string[]> = {
  food: ["coffee", "latte", "lunch", "dinner", "food", "pizza", "burrito", "sushi", "boba", "grocer", "taco"],
  fun: ["game", "ps5", "ps6", "xbox", "switch", "concert", "ticket", "movie", "party", "club"],
  travel: ["flight", "trip", "hotel", "vacation", "uber", "airbnb", "travel"],
  bills: ["rent", "bill", "phone", "insurance", "electric"],
  shopping: [],
};

const SMALL: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** "four hundred" -> 400, "twelve hundred" -> 1200, "two thousand five hundred" -> 2500 */
function wordsToNumber(text: string): number | null {
  let total = 0;
  let cur = 0;
  let seen = false;
  for (const w of text.toLowerCase().split(/[\s-]+/)) {
    if (w in SMALL) { cur += SMALL[w]; seen = true; }
    else if (w === "hundred" && seen) cur = (cur || 1) * 100;
    else if ((w === "thousand" || w === "grand") && seen) { total += (cur || 1) * 1000; cur = 0; }
    else if (seen && w !== "and") break;
  }
  const n = total + cur;
  return seen && n > 0 ? n : null;
}

const toNum = (digits: string, mult?: string) => Number(digits) * (mult ? 1000 : 1);

export function parseAmount(text: string): number | null {
  const t = text.replace(/,/g, "");
  // Prefer numbers tied to money: "$1200", "400 dollars", "1.5k"
  const money =
    t.match(/\$\s*(\d+(?:\.\d+)?)\s*(k|grand|thousand)?\b/i) ??
    t.match(/\b(\d+(?:\.\d+)?)\s*(k|grand|thousand)?\s*(?:dollars?|bucks?)\b/i) ??
    t.match(/\b(\d+(?:\.\d+)?)\s*(k|grand|thousand)\b/i);
  const n = money
    ? toNum(money[1], money[2])
    : (() => {
        const bare = [...t.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((m) => Number(m[1]));
        return bare.length ? Math.max(...bare) : wordsToNumber(t);
      })();
  return n !== null && Number.isFinite(n) && n > 0 ? n : null;
}

export function guessCategory(text: string): CategoryId {
  const t = text.toLowerCase();
  for (const [id, words] of Object.entries(KEYWORDS) as [CategoryId, string[]][]) {
    if (words.some((w) => new RegExp(`\\b${w}`).test(t))) return id;
  }
  return "shopping";
}

function guessItem(text: string): string {
  const m = text.match(
    /\b(?:a|an|the|some)\s+(?:\$?[\d,.]+\s*(?:k\b)?\s*(?:dollars?\s*)?)?(?:[a-z]+\s+(?:hundred|thousand)\s+(?:dollars?\s*)?)?([a-z][a-z0-9 ]{1,30}?)(?:\s+for\b|[?.!]|$)/i,
  );
  return m?.[1]?.trim() || "that";
}

// "ok I'm gonna go for it", "let's do it", "purchase a PS5", "I just bought the jacket"
const BUY =
  /\b(?:go(?:ing)? for it|pull(?:ing)? the trigger|i'?ll take (?:it|that|one)|do it|send it|(?:gonna|going to|will|i'?ll) (?:buy|get|grab|order|purchase)|(?:just )?(?:bought|purchased|ordered)|purchase|buying)\b|^(?:ok(?:ay)?,?\s+)?(?:buy|get|grab|order)\b/i;
// Still asking, not deciding: "should I go for it?", "can I afford to buy a PS5?"
const ASKING = /\b(?:afford|can i|could i|should i|how much|is it worth)\b|\?\s*$/i;
const PRONOUN = /^(?:it|that|this|one|them|those|these)?$/i;

/**
 * Is the user saying they're buying something (not asking)? Returns the item they named,
 * or null for "go for it" / "buy it", which means the last thing discussed. Undefined if not a purchase.
 */
export function purchaseIntent(text: string): { item: string | null } | undefined {
  if (!BUY.test(text) || ASKING.test(text)) return undefined;
  const m = text.match(/\b(?:buy|get|grab|order|purchase|bought|purchased|ordered)\s+(?:me\s+)?(?:(?:a|an|the|some|that|this)\s+)?(.*)$/i);
  const item = (m?.[1] ?? "")
    .replace(/\s+(?:for|at)\b.*$/i, "")
    .replace(/\$?\d[\d,.]*\s*(?:k\b|dollars?|bucks?)?/gi, "")
    .replace(/\b(?:then|now|anyway|please|today)\b/gi, "")
    .replace(/[^a-z0-9' ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { item: PRONOUN.test(item) ? null : item.slice(0, 40) };
}

/** Loose match so "the PS5" refers to "PS5". */
export const sameItem = (a: string, b: string) => {
  const x = a.toLowerCase(), y = b.toLowerCase();
  return x.includes(y) || y.includes(x);
};

const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

const ROASTS: Record<PersonaId, ((i: string, l: string) => string)[]> = {
  chef: [
    (i, l) => `${i}?! With ${l} left? This budget is RAW, you donkey! It's still fucking mooing! Put it back.`,
    (i, l) => `Look at me. Look at me. ${l} left and you want ${i}? I wouldn't trust you running a bath, let alone a fucking bank account.`,
    (i, l) => `${i}? With ${l}? Where's the savings?! WHERE'S THE BLOODY SAVINGS?! Shut it down!`,
    (i, l) => `${l} left and you're ordering ${i}? My gran could budget better, and she's DEAD. Get out!`,
  ],
};

const HYPES: Record<PersonaId, (i: string, l: string) => string> = {
  chef: (i, l) => `${i}? Beautiful. Stunning. ${l} left. Finally, some good fucking budgeting. Yes, chef!`,
};

const WARNS: Record<PersonaId, (i: string, l: string) => string> = {
  chef: (i, l) => `${i}? Fine, but that leaves ${l}. One more order and this kitchen burns down!`,
};

// They bought it anyway (or sensibly). Snark about the decision; r = category money left after it.
const BOUGHT: Record<PersonaId, Record<"yes" | "tight" | "no", (i: string, a: string, r: number) => string>> = {
  chef: {
    yes: (i, a, r) => `${i}, ${a}, logged. ${usd(r)} left. Don't let it go to your head, sunshine. Back on the line!`,
    tight: (i, a, r) => `Fine. ${i}, ${a}, on the books. ${usd(r)} left. Touch ONE more thing this month and I'm shutting this kitchen down.`,
    no: (i, a, r) =>
      r < 0
        ? `You bought ${i} ANYWAY?! ${a}, logged, and you're ${usd(r)} over. Brilliant. Absolutely bloody brilliant, you donkey.`
        : `${i}? You actually did it. ${a}, logged, with bills still coming. That's not a treat, it's a fucking THREAT.`,
  },
};

// "Go for it" with nothing discussed yet, or a named item with no price the templates can't guess.
const BUY_WHAT: Record<PersonaId, string> = {
  chef: "Go for WHAT? Log WHAT? Tell me what you're buying and how much, you muppet.",
};

// No price means it's either off-topic or missing the amount: redirect, never answer general questions.
const REDIRECTS: Record<PersonaId, string> = {
  chef: "Did I ask for small talk? No! I answer one thing: can you afford it. What are you buying, and how much, you donkey?",
};

const infoReply = (line: string): AskResponse => ({
  verdict: "info",
  item: null,
  amount: null,
  priceEstimated: false,
  category: null,
  remainingAfter: null,
  purchased: false,
  line,
  source: "mock",
});

export function mockAnswer(b: Budget, text: string, persona: PersonaId, last: LastItem | null = null): AskResponse {
  const amount = parseAmount(text);
  const buying = purchaseIntent(text);
  if (buying) {
    // "go for it" (or naming the same thing again) means the last item discussed; a new price wins.
    const ref = last && (!buying.item || sameItem(buying.item, last.item)) ? last : null;
    const price = amount ?? ref?.amount ?? null;
    if (price === null) return infoReply(BUY_WHAT[persona]);
    const item = buying.item ?? ref?.item ?? "that";
    const category = ref?.category ?? guessCategory(text);
    return mockForPurchase(b, persona, item, price, category, amount === null && !!ref?.priceEstimated, true);
  }
  if (amount === null) return infoReply(REDIRECTS[persona]);
  return mockForPurchase(b, persona, guessItem(text), amount, guessCategory(text));
}

/**
 * Template line for a purchase whose item, amount and category are already known.
 * bought = the user is buying it (log it and snark), not asking whether they can.
 */
export function mockForPurchase(
  b: Budget,
  persona: PersonaId,
  item: string,
  amount: number,
  category: CategoryId,
  priceEstimated = false,
  bought = false,
): AskResponse {
  const { verdict, remainingAfter } = decide(b, amount, category);
  const left = usd(categoryLeft(b, category));
  const line = bought
    ? BOUGHT[persona][verdict](item, usd(amount), remainingAfter)
    : verdict === "no"
      ? pick(ROASTS[persona])(item, left)
      : (verdict === "tight" ? WARNS : HYPES)[persona](item, usd(remainingAfter));
  return { verdict, item, amount, priceEstimated, category, remainingAfter, purchased: bought, line, source: "mock" };
}
