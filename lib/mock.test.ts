import { test } from "node:test";
import assert from "node:assert/strict";
import { guessCategory, parseAmount } from "./mock.ts";

test("dollar sign with commas", () => assert.equal(parseAmount("a PS6 for $1,200"), 1200));
test("ignores model numbers", () => assert.equal(parseAmount("PS5 for 450 dollars"), 450));
test("k suffix", () => assert.equal(parseAmount("a 1.5k laptop"), 1500));
test("spoken words", () => assert.equal(parseAmount("a four hundred dollar jacket"), 400));
test("twelve hundred", () => assert.equal(parseAmount("twelve hundred on a trip"), 1200));
test("no amount", () => assert.equal(parseAmount("how am I doing"), null));
test("word boundary on categories", () => assert.equal(guessCategory("a different hat"), "shopping"));
test("food match", () => assert.equal(guessCategory("a $6 coffee"), "food"));
