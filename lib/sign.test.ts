import { test } from "node:test";
import assert from "node:assert/strict";
import { signLine, verifyLine } from "./sign.ts";

test("signed line verifies", () => assert.ok(verifyLine("chef", "hi", signLine("chef", "hi"))));
test("other text fails", () => assert.equal(verifyLine("chef", "bye", signLine("chef", "hi")), false));
test("other persona fails", () => assert.equal(verifyLine("grandma", "hi", signLine("chef", "hi")), false));
test("missing sig fails", () => assert.equal(verifyLine("chef", "hi", null), false));
