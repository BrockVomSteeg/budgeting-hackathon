import { test } from "node:test";
import assert from "node:assert/strict";
import { addTxn, deleteTxn, setLimit, toBudget, togglePaid, upcoming } from "./ledger.ts";
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
