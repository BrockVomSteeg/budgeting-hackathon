import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, parseBudget, parseLastItem, safeToSpend } from "./budget.ts";
import type { Budget } from "./types.ts";

const b: Budget = {
  name: "T",
  monthlyIncome: 5000,
  daysLeftInMonth: 10,
  checking: 2000,
  upcomingBills: 500,
  categories: [{ id: "food", label: "Food", limit: 600, spent: 458 }],
};

test("safe to spend subtracts bills", () => assert.equal(safeToSpend(b), 1500));
test("small purchase is yes", () => assert.equal(decide(b, 6, "food").verdict, "yes"));
test("near the limit is tight", () => assert.equal(decide(b, 130, "food").verdict, "tight"));
test("over category is no", () => assert.equal(decide(b, 400, "food").verdict, "no"));
test("remainingAfter is category left minus amount", () =>
  assert.equal(decide(b, 42, "food").remainingAfter, 100));

test("parseBudget accepts a sane phone budget", () => assert.equal(parseBudget(b)?.checking, 2000));
test("parseBudget rejects junk", () => {
  assert.equal(parseBudget({ ...b, checking: "lots" }), null);
  assert.equal(parseBudget({ ...b, categories: [{ id: "crypto", label: "x", limit: 1, spent: 0 }] }), null);
  assert.equal(parseBudget(null), null);
});

test("parseLastItem keeps a sane last item and rejects junk", () => {
  assert.deepEqual(parseLastItem({ item: " PS5 ", amount: 500, category: "fun", priceEstimated: true }), { item: "PS5", amount: 500, category: "fun", priceEstimated: true });
  assert.equal(parseLastItem({ item: "PS5", amount: -5, category: "fun" }), null);
  assert.equal(parseLastItem({ item: "PS5", amount: 500, category: "crypto" }), null);
  assert.equal(parseLastItem({ item: "", amount: 500, category: "fun" }), null);
  assert.equal(parseLastItem(undefined), null);
});
