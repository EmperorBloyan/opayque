import test from "node:test";
import assert from "node:assert/strict";
import { matchesPairingCode, normalizePairingCode } from "./pairing.js";

test("normalizes generated fleet codes for matching", () => {
  assert.equal(normalizePairingCode(" A-1b 2c "), "A1B2C");
});

test("matches codes even when the stored value uses punctuation or mixed casing", () => {
  assert.equal(matchesPairingCode("A-1b 2c", "a1b2c"), true);
  assert.equal(matchesPairingCode("550e8400-e29b-41d4-a716-446655440000", "550E8400E29B41D4A716446655440000"), true);
});
