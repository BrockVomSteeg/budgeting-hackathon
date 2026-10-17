import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAffordability } from "./agent.ts";
import { demoBudget } from "../data/budget.ts";

test("jacket is a no", () =>
  assert.equal(checkAffordability(demoBudget, { item: "jacket", amount: 400, category: "shopping" }).answer?.verdict, "no"));
test("coffee is a yes", () =>
  assert.equal(checkAffordability(demoBudget, { item: "coffee", amount: 6, category: "food" }).answer?.verdict, "yes"));
test("bad category falls back to a guess", () =>
  assert.equal(checkAffordability(demoBudget, { item: "PS6 game", amount: 1200, category: "toys" }).answer?.category, "fun"));
test("estimated price is flagged", () =>
  assert.equal(checkAffordability(demoBudget, { item: "PS5", amount: 500, category: "fun", price_estimated: true }).answer?.priceEstimated, true));
test("price is not estimated by default", () =>
  assert.equal(checkAffordability(demoBudget, { item: "coffee", amount: 6, category: "food" }).answer?.priceEstimated, false));
test("missing amount asks for it", () =>
  assert.equal(checkAffordability(demoBudget, { item: "hat" }).answer, null));
