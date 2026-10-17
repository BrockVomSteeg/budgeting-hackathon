import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldsBeforeLine, firstSentenceEnd, partialLine, splitForSpeech } from "./stream.ts";

const json = '{"item":"jacket","amount":400,"category":"shopping","verdict":"no","line":"Look at me. You\\u0027ve got \\"$90\\" left';

test("earlier fields parse once the line starts", () =>
  assert.deepEqual(fieldsBeforeLine(json), { item: "jacket", amount: 400, category: "shopping", verdict: "no" }));
test("no fields before the line has started", () => assert.equal(fieldsBeforeLine('{"item":"jacket","amount":4'), null));
test("partial line decodes escapes", () => assert.deepEqual(partialLine(json), { text: 'Look at me. You\'ve got "$90" left', done: false }));
test("line is done at its closing quote", () => assert.equal(partialLine('{"line":"Put it back."}')?.done, true));
test("cut-off escape waits", () => assert.deepEqual(partialLine('{"line":"Hi \\'), { text: "Hi ", done: false }));
test("first sentence needs a following space", () => {
  assert.equal(firstSentenceEnd("Four hundred dollars?"), 0);
  assert.equal(firstSentenceEnd("Four hundred dollars? You donkey"), "Four hundred dollars?".length);
  assert.equal(firstSentenceEnd("It costs $1.50 now. Ok"), "It costs $1.50 now.".length);
});
test("split keeps every word", () =>
  assert.deepEqual(splitForSpeech("Look at me. Look at me. Put it back!"), ["Look at me.", "Look at me. Put it back!"]));
