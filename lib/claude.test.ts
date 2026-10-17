import { test } from "node:test";
import assert from "node:assert/strict";
import { askClaude, type Call } from "./claude.ts";
import { demoBudget } from "../data/budget.ts";

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
const ask = (text: string, call: Call) => askClaude(demoBudget, text, "chef", [], call);

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
