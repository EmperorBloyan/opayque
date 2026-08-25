import { describe, expect, it } from "vitest";
import { matchesPairingCode, normalizePairingCode } from "./pairing";

describe("terminal pairing invariants", () => {
  it("normalizes punctuation and case", () => {
    expect(normalizePairingCode(" A-1b 2c ")).toBe("A1B2C");
    expect(matchesPairingCode("A-1b 2c", "a1b2c")).toBe(true);
  });
});