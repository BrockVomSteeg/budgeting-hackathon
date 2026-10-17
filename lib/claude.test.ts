import { test } from "node:test";
import assert from "node:assert/strict";
import { askClaude, type Call } from "./claude.ts";
import { demoBudget } from "../data/budget.ts";
import type { LastItem } from "./types.ts";

type Out = NonNullable<Awaited<ReturnType<Call>>["parsed_output"]>;
const ps5: Out = { topic: "afford", item: "PS5", amount: 500, priceEstimated: true, category: "fun", verdict: "no", line: "About $500 for a PS5? Put it back." };

/** Fake Claude: returns each reply in turn and records the notes it was sent. */
function fake(...replies: Out[]) {
  const notes: string[] = [];
  const call: Call = async (note = "") => {
    notes.push(note);
    return { stop_reason: "end_turn", parsed_output: replies[notes.length - 1] ?? null };
  };
  return { call, notes };
}
const ask = (text: string, call: Call, last: LastItem | null = null) => askClaude(demoBudget, text, "chef", [], last, call);
const lastPs5: LastItem = { item: "PS5", amount: 500, category: "fun", priceEstimated: true };

test("estimated price runs the normal math", async () => {
  const a = await ask("can I afford a PS5?", fake(ps5).call);
  assert.equal(a.verdict, "no");
  assert.equal(a.amount, 500);
  assert.equal(a.priceEstimated, true);
  assert.equal(a.remainingAfter, -440);
  assert.equal(a.source, "claude");
});
test("estimated cheap item can be a yes", async () => {
  const latte: Out = { ...ps5, item: "latte", category: "food", amount: 6, verdict: "yes", line: "About $6? Beautiful." };
  const a = await ask("can I get a latte?", fake(latte).call);
  assert.equal(a.verdict, "yes");
  assert.equal(a.priceEstimated, true);
  assert.equal(a.remainingAfter, 136);
});
test("too vague to price stays info with no math", async () => {
  const vague: Out = { ...ps5, item: "jacket", category: "shopping", amount: null, verdict: "info", line: "How much is it, you donkey?" };
  const a = await ask("can I afford a jacket?", fake(vague).call);
  assert.equal(a.verdict, "info");
  assert.equal(a.amount, null);
  assert.equal(a.priceEstimated, false);
  assert.equal(a.remainingAfter, null);
});
test("a wrong verdict on an estimate retries with the verified numbers", async () => {
  const f = fake({ ...ps5, verdict: "yes" }, ps5);
  const a = await ask("can I afford a PS5?", f.call);
  assert.equal(f.notes.length, 2);
  assert.match(f.notes[1], /verdict "no"/);
  assert.equal(a.source, "claude");
  assert.equal(a.verdict, "no");
  assert.equal(a.priceEstimated, true);
});
test("still wrong after the retry: template keeps the estimate", async () => {
  const wrong: Out = { ...ps5, verdict: "yes" };
  const a = await ask("can I afford a PS5?", fake(wrong, wrong).call);
  assert.equal(a.source, "mock");
  assert.equal(a.verdict, "no");
  assert.equal(a.amount, 500);
  assert.equal(a.priceEstimated, true);
});
test("off-topic gets the redirect line only, never a verdict or math", async () => {
  const joke: Out = { ...ps5, topic: "off_topic", line: "Did I ask for small talk? What are you buying, you donkey?" };
  const a = await ask("tell me a joke", fake(joke).call);
  assert.equal(a.verdict, "info");
  assert.equal(a.amount, null);
  assert.equal(a.priceEstimated, false);
  assert.equal(a.remainingAfter, null);
  assert.equal(a.line, joke.line);
  assert.equal("topic" in a, false);
});
test("a question is never logged", async () => {
  const a = await ask("can I afford a PS5?", fake(ps5).call);
  assert.equal(a.purchased, false);
});
test("'go for it' logs the last discussed item with the app's numbers", async () => {
  const bought: Out = { ...ps5, topic: "purchase", line: "You bought it ANYWAY?! Logged, you donkey." };
  const f = fake(bought);
  const a = await ask("ok I'm gonna go for it", f.call, lastPs5);
  assert.equal(f.notes.length, 1);
  assert.equal(a.purchased, true);
  assert.equal(a.item, "PS5");
  assert.equal(a.amount, 500);
  assert.equal(a.category, "fun");
  assert.equal(a.priceEstimated, true);
  assert.equal(a.verdict, "no");
  assert.equal(a.remainingAfter, -440);
});
test("'go for it' where the model drops or changes the numbers: code uses the last item and retries the line", async () => {
  const drifted: Out = { ...ps5, topic: "purchase", item: null, amount: 450, category: "shopping", verdict: "no" };
  const fixed: Out = { ...ps5, topic: "purchase", line: "Logged. $440 over in fun. Brilliant." };
  const f = fake(drifted, fixed);
  const a = await ask("go for it", f.call, lastPs5);
  assert.equal(f.notes.length, 2);
  assert.match(f.notes[1], /\$500 \(fun\).*They are buying it/);
  assert.equal(a.purchased, true);
  assert.equal(a.item, "PS5");
  assert.equal(a.amount, 500);
  assert.equal(a.category, "fun");
  assert.equal(a.line, fixed.line);
});
test("a new price said out loud beats the last discussed one", async () => {
  const cheaper: Out = { ...ps5, topic: "purchase", amount: 40, priceEstimated: false, verdict: "yes" };
  const a = await ask("ok go for it, I found it for $40", fake(cheaper).call, lastPs5);
  assert.equal(a.purchased, true);
  assert.equal(a.amount, 40);
  assert.equal(a.priceEstimated, false);
  assert.equal(a.verdict, "yes");
  assert.equal(a.remainingAfter, 20);
});
test("'purchase XYZ' names a new item with an estimated price", async () => {
  const airpods: Out = { ...ps5, topic: "purchase", item: "AirPods Pro", amount: 249, category: "shopping", verdict: "no" };
  const a = await ask("purchase AirPods Pro", fake(airpods).call, lastPs5);
  assert.equal(a.purchased, true);
  assert.equal(a.item, "AirPods Pro");
  assert.equal(a.amount, 249);
  assert.equal(a.category, "shopping");
  assert.equal(a.priceEstimated, true);
});
test("'go for it' with nothing discussed logs nothing", async () => {
  const what: Out = { ...ps5, topic: "purchase", item: null, amount: null, category: null, verdict: "info", line: "Go for WHAT?" };
  const a = await ask("go for it", fake(what).call);
  assert.equal(a.purchased, false);
  assert.equal(a.verdict, "info");
  assert.equal(a.amount, null);
});
test("an info verdict with a price (distress) is never overridden into a roast", async () => {
  const calm: Out = { ...ps5, item: "groceries", category: "food", amount: 900, verdict: "info", line: "Hey. Breathe. Rent and food come first." };
  const f = fake(calm);
  const a = await ask("I'm panicking about money, can I afford $900 groceries?", f.call);
  assert.equal(f.notes.length, 1);
  assert.equal(a.verdict, "info");
  assert.equal(a.line, calm.line);
});
