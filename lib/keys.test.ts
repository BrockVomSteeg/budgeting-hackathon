import { test } from "node:test";
import assert from "node:assert/strict";
import { paidApisEnabled, paidKey } from "./keys.ts";

test("paid APIs are off by default, even with a key set", () => {
  delete process.env.PAID_APIS_ENABLED;
  process.env.ANTHROPIC_API_KEY = "sk-test";
  assert.equal(paidApisEnabled(), false);
  assert.equal(paidKey("ANTHROPIC_API_KEY"), undefined);
});

test("PAID_APIS_ENABLED=1 turns keys back on", () => {
  process.env.PAID_APIS_ENABLED = "1";
  process.env.FISH_API_KEY = "fish-test";
  assert.equal(paidKey("FISH_API_KEY"), "fish-test");
  delete process.env.PAID_APIS_ENABLED;
});
