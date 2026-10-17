import { test } from "node:test";
import assert from "node:assert/strict";
import { distressReply } from "./safety.ts";

test("self-harm gets 988", () => assert.match(distressReply("I want to die, can I afford $50")!, /988/));
test("rent crisis gets a calm reply", () => assert.match(distressReply("I can't pay rent and I'm crying")!, /211/));
test("normal question passes through", () => assert.equal(distressReply("can I afford a $400 jacket"), null));
test("killer deal is not self-harm", () => assert.equal(distressReply("this jacket is a killer deal for $80"), null));
test("can't afford to pay rent is caught", () => assert.match(distressReply("I can't afford to pay rent")!, /211/));
test("iPhone curly apostrophe is caught", () => assert.match(distressReply("I can’t afford my rent")!, /211/));
