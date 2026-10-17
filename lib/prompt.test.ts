import { test } from "node:test";
import assert from "node:assert/strict";
import { userPrompt } from "./prompt.ts";
import { demoBudget } from "../data/budget.ts";

test("the last discussed purchase comes with the code's numbers", () => {
  const p = userPrompt(demoBudget, "go for it", [], { item: "jacket", amount: 80, category: "shopping", priceEstimated: false });
  assert.match(p, /Last discussed purchase: jacket, \$80, category shopping\. If bought: verdict "tight", \$10 left in shopping after\./);
});
test("no last purchase, no line", () => assert.doesNotMatch(userPrompt(demoBudget, "hi", []), /Last discussed/));
