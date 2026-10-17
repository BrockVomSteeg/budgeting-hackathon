import { test } from "node:test";
import assert from "node:assert/strict";
import { guessCategory, mockAnswer, parseAmount, purchaseIntent } from "./mock.ts";
import type { LastItem } from "./types.ts";
import { demoBudget } from "../data/budget.ts";

test("dollar sign with commas", () => assert.equal(parseAmount("a PS6 for $1,200"), 1200));
test("ignores model numbers", () => assert.equal(parseAmount("PS5 for 450 dollars"), 450));
test("k suffix", () => assert.equal(parseAmount("a 1.5k laptop"), 1500));
test("spoken words", () => assert.equal(parseAmount("a four hundred dollar jacket"), 400));
test("twelve hundred", () => assert.equal(parseAmount("twelve hundred on a trip"), 1200));
test("no amount", () => assert.equal(parseAmount("how am I doing"), null));
test("word boundary on categories", () => assert.equal(guessCategory("a different hat"), "shopping"));
test("food match", () => assert.equal(guessCategory("a $6 coffee"), "food"));

test("tight warns with the real amount left", () => {
  const a = mockAnswer(demoBudget, "can I afford an $80 jacket?", "chef");
  assert.equal(a.verdict, "tight");
  assert.match(a.line, /\$10\b/);
  assert.doesNotMatch(a.line, /Yes, chef/);
});
test("off-topic questions get a redirect, not budget data", () => {
  const a = mockAnswer(demoBudget, "how am I doing this month?", "chef");
  assert.equal(a.verdict, "info");
  assert.match(a.line, /afford/i);
  assert.doesNotMatch(a.line, /\$/);
});
test("no cites the category money left", () => {
  const a = mockAnswer(demoBudget, "can I afford a $400 jacket?", "chef");
  assert.equal(a.verdict, "no");
  assert.match(a.line, /\$90\b/);
  assert.equal(a.priceEstimated, false);
});

const jacket: LastItem = { item: "jacket", amount: 80, category: "shopping", priceEstimated: false };

test("purchase intent: going for it refers to the last item", () => {
  for (const t of ["ok I'm gonna go for it", "let's do it", "fine, I'll take it", "buy it", "I'm gonna get it"]) {
    assert.deepEqual(purchaseIntent(t), { item: null }, t);
  }
});
test("purchase intent: a named item", () => {
  assert.deepEqual(purchaseIntent("purchase AirPods Pro"), { item: "AirPods Pro" });
  assert.deepEqual(purchaseIntent("I just bought the jacket for $80"), { item: "jacket" });
  assert.deepEqual(purchaseIntent("ok buy a $6 coffee"), { item: "coffee" });
});
test("purchase intent: questions are not purchases", () => {
  for (const t of ["should I go for it?", "can I afford to buy a PS5", "how much to get a burrito", "can I afford a $400 jacket?"]) {
    assert.equal(purchaseIntent(t), undefined, t);
  }
});
test("go for it logs the last item and snarks with what's left", () => {
  const a = mockAnswer(demoBudget, "ok I'm gonna go for it", "chef", jacket);
  assert.equal(a.purchased, true);
  assert.equal(a.item, "jacket");
  assert.equal(a.amount, 80);
  assert.equal(a.category, "shopping");
  assert.equal(a.verdict, "tight");
  assert.match(a.line, /\$10\b/);
});
test("buying something you can't afford gets a disbelieving roast", () => {
  const a = mockAnswer(demoBudget, "go for it", "chef", { ...jacket, amount: 400 });
  assert.equal(a.purchased, true);
  assert.equal(a.verdict, "no");
  assert.match(a.line, /ANYWAY/);
  assert.match(a.line, /\$310 over/);
});
test("purchase with a named item and price", () => {
  const a = mockAnswer(demoBudget, "purchase a $6 coffee", "chef", jacket);
  assert.equal(a.purchased, true);
  assert.equal(a.amount, 6);
  assert.equal(a.category, "food");
});
test("go for it with nothing discussed asks what, logs nothing", () => {
  const a = mockAnswer(demoBudget, "go for it", "chef");
  assert.equal(a.purchased, false);
  assert.equal(a.verdict, "info");
  assert.equal(a.amount, null);
});
test("asking is never logged", () => assert.equal(mockAnswer(demoBudget, "can I afford a $6 coffee?", "chef", jacket).purchased, false));
