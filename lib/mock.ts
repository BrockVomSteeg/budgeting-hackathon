import type { AskResponse, Budget, CategoryId, PersonaId } from "./types";
import { categoryLeft, decide, safeToSpend } from "./budget";

const KEYWORDS: Record<CategoryId, string[]> = {
  food: ["coffee", "latte", "lunch", "dinner", "food", "pizza", "burrito", "sushi", "boba", "grocer", "taco"],
  fun: ["game", "ps5", "ps6", "xbox", "switch", "concert", "ticket", "movie", "party", "club"],
  travel: ["flight", "trip", "hotel", "vacation", "uber", "airbnb", "travel"],
  bills: ["rent", "bill", "phone", "insurance", "electric"],
  shopping: [],
};

export function parseAmount(text: string): number | null {
  const m = text.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)\s*(k|grand|thousand)?/i);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] ? 1000 : 1);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function guessCategory(text: string): CategoryId {
  const t = text.toLowerCase();
  for (const [id, words] of Object.entries(KEYWORDS) as [CategoryId, string[]][]) {
    if (words.some((w) => t.includes(w))) return id;
  }
  return "shopping";
}

function guessItem(text: string): string {
  const m = text.match(/(?:a|an|the|some)\s+(?:\$?[\d,.]+\s*(?:dollar\s*)?)?([a-z0-9 ]{2,30}?)(?:\s+for|\?|$)/i);
  return m?.[1]?.trim() || "that";
}

const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

const ROASTS: Record<PersonaId, ((i: string, l: string) => string)[]> = {
  sergeant: [
    (i, l) => `Negative, recruit! You have ${l} left and you want ${i}? Drop and give me a budget!`,
    (i, l) => `${i}? With ${l} in the bank? That's not a purchase, that's desertion!`,
  ],
  grandma: [
    (i, l) => `Oh sweetie. ${i}? You have ${l} left. I raised four kids on less than that.`,
    (i, l) => `${l} left and you want ${i}? I'm not mad, sweetie. Just disappointed.`,
  ],
  chef: [
    (i, l) => `${i}?! With ${l} left? This budget is RAW! Absolutely undercooked!`,
    (i, l) => `You've got ${l} and you're ordering ${i}? Get out of my kitchen!`,
  ],
  bestie: [
    (i, l) => `Babe, no. ${i} with ${l} left? That's not self-care, that's self-sabotage.`,
    (i, l) => `${l} left? And ${i}? Bestie, I love you, but your wallet is in the ICU.`,
  ],
};

const HYPES: Record<PersonaId, (i: string, l: string) => string> = {
  sergeant: (i, l) => `Permission granted, recruit! Get ${i}. You'll still have ${l} left. Dismissed!`,
  grandma: (i, l) => `Of course, sweetie, get ${i}. You'll still have ${l} left. So responsible!`,
  chef: (i, l) => `${i}? Beautiful. Perfectly seasoned. ${l} left. Yes, chef!`,
  bestie: (i, l) => `Babe, yes! Get ${i}. You still have ${l}. We love a financially stable queen.`,
};

export function mockAnswer(b: Budget, text: string, persona: PersonaId): AskResponse {
  const amount = parseAmount(text);
  if (amount === null) {
    return {
      verdict: "info",
      item: null,
      amount: null,
      category: null,
      remainingAfter: null,
      line: `You can safely spend ${usd(safeToSpend(b))} until payday. Ask me "can I afford" plus a price.`,
      source: "mock",
    };
  }
  const category = guessCategory(text);
  const item = guessItem(text);
  const { verdict, remainingAfter } = decide(b, amount, category);
  const left = usd(categoryLeft(b, category));
  const line =
    verdict === "no" ? pick(ROASTS[persona])(item, left) : HYPES[persona](item, usd(remainingAfter));
  return { verdict, item, amount, category, remainingAfter, line, source: "mock" };
}
