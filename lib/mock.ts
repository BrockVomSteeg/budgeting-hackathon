import type { AskResponse, Budget, CategoryId, PersonaId } from "./types";
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

// No price means it's either off-topic or missing the amount: redirect, never answer general questions.
const REDIRECTS: Record<PersonaId, string> = {
  chef: "Did I ask for small talk? No! I answer one thing: can you afford it. What are you buying, and how much, you donkey?",
};

export function mockAnswer(b: Budget, text: string, persona: PersonaId): AskResponse {
  const amount = parseAmount(text);
  if (amount === null) {
    return {
      verdict: "info",
      item: null,
      amount: null,
      priceEstimated: false,
      category: null,
      remainingAfter: null,
      line: REDIRECTS[persona],
      source: "mock",
    };
  }
  return mockForPurchase(b, persona, guessItem(text), amount, guessCategory(text));
}

/** Template line for a purchase whose item, amount and category are already known. */
export function mockForPurchase(
  b: Budget,
  persona: PersonaId,
  item: string,
  amount: number,
  category: CategoryId,
  priceEstimated = false,
): AskResponse {
  const { verdict, remainingAfter } = decide(b, amount, category);
  const left = usd(categoryLeft(b, category));
  const line =
    verdict === "no"
      ? pick(ROASTS[persona])(item, left)
      : (verdict === "tight" ? WARNS : HYPES)[persona](item, usd(remainingAfter));
  return { verdict, item, amount, priceEstimated, category, remainingAfter, line, source: "mock" };
}
