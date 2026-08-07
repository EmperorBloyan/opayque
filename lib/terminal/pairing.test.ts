import test from "node:test";
import assert from "node:assert/strict";
import { formatPairingCountdown, matchesPairingCode, normalizePairingCode } from "./pairing.ts";

test("normalizes generated fleet codes for matching", () => {
  assert.equal(normalizePairingCode(" A-1b 2c "), "A1B2C");
});

test("matches codes even when the stored value uses punctuation or mixed casing", () => {
  assert.equal(matchesPairingCode("A-1b 2c", "a1b2c"), true);
  assert.equal(matchesPairingCode("550e8400-e29b-41d4-a716-446655440000", "550E8400E29B41D4A716446655440000"), true);
});

test("formats pairing countdown from a live expiry timestamp", () => {
  const expiresAt = Date.now() + 10 * 60 * 1000 + 1500;
  const formatted = formatPairingCountdown(expiresAt);

  assert.match(formatted, /^\d{2}M \d{2}S$/);
  assert.ok(formatted.startsWith("09M") || formatted.startsWith("10M"));
});
