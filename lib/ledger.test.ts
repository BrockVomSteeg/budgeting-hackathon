import { test } from "node:test";
import assert from "node:assert/strict";
import { addTxn, deleteTxn, logPurchase, nextLastItem, setLimit, toBudget, togglePaid, upcoming } from "./ledger.ts";
import { decide } from "./budget.ts";
import { mockAnswer } from "./mock.ts";
import { demoLedger } from "../data/budget.ts";

const spent = (l: typeof demoLedger, id: string) => toBudget(l).categories.find((c) => c.id === id)!.spent;

test("demo totals match the tuned budget", () => {
  const b = toBudget(demoLedger);
  assert.deepEqual(b.categories.map((c) => c.spent), [458, 210, 190, 0, 1800]);
  assert.equal(b.upcomingBills, 900);
  assert.equal(b.checking, 2350);
});
test("adding a purchase spends from the category and checking", () => {
  const l = addTxn(demoLedger, { merchant: "Jacket", amount: 80, category: "shopping" });
  assert.equal(spent(l, "shopping"), 290);
  assert.equal(l.checking, 2270);
  assert.equal(spent(deleteTxn(l, l.transactions.at(-1)!.id), "shopping"), 210);
});
test("paying a bill clears it from upcoming and back", () => {
  const l = togglePaid(demoLedger, "r-car");
  assert.equal(toBudget(l).upcomingBills, 480);
  assert.equal(l.checking, 1930);
  assert.equal(upcoming(togglePaid(l, "r-car")).length, upcoming(demoLedger).length);
});
test("budget limits are editable", () => assert.equal(setLimit(demoLedger, "fun", 300.4).categories[2].limit, 300));

test("a logged purchase lands in the budget, and later answers see it", () => {
  const jacket = mockAnswer(toBudget(demoLedger), "can I afford an $80 jacket?", "chef");
  assert.equal(logPurchase(demoLedger, jacket), demoLedger); // asking changes nothing
  const last = nextLastItem(null, jacket);
  assert.deepEqual(last, { item: "jacket", amount: 80, category: "shopping", priceEstimated: false });

  const bought = mockAnswer(toBudget(demoLedger), "ok go for it", "chef", last);
  const l = logPurchase(demoLedger, bought);
  assert.equal(spent(l, "shopping"), 290);
  assert.equal(l.checking, 2270);
  assert.equal(l.transactions.at(-1)!.merchant, "Jacket");
  assert.equal(nextLastItem(last, bought), null); // can't log the same thing twice by saying it again

  assert.equal(decide(toBudget(demoLedger), 80, "shopping").verdict, "tight");
  assert.equal(decide(toBudget(l), 80, "shopping").verdict, "no");
});
test("info answers keep the last discussed item", () => {
  const last = { item: "PS5", amount: 500, category: "fun" as const, priceEstimated: true };
  assert.equal(nextLastItem(last, mockAnswer(toBudget(demoLedger), "how am I doing?", "chef")), last);
});
