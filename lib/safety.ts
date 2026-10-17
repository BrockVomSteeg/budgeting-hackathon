// Runs before any model or mock call. Real distress gets a calm, fixed reply, never a roast.
const SELF_HARM = /\b(kill(ing)? myself|suicid\w*|end it all|want to die|hurt(ing)? myself|self[- ]?harm)\b/i;
const MONEY_CRISIS =
  /\b(can'?t|cannot|couldn'?t) (afford|pay)( for)? (rent|food|groceries|bills|my rent)|\b(evict\w*|homeless|going hungry|no money for (food|rent))\b/i;

export function distressReply(text: string): string | null {
  if (SELF_HARM.test(text)) {
    return "Hey, I'm stepping out of character. You matter more than any budget. If you're thinking about hurting yourself, call or text 988 right now to talk to someone.";
  }
  if (MONEY_CRISIS.test(text)) {
    return "Stepping out of character for a second. That sounds really stressful. Essentials come first: rent and food before anything else. Calling 211 can connect you with local help.";
  }
  return null;
}
