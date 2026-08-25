import { describe, expect, it } from "vitest";
import { buildKeyHash, normalizeApiKeyHeader, isValidPublishableKey } from "./apiKey";

describe("API key invariants", () => {
  it("normalizes bearer keys and hashes deterministically", () => {
    expect(normalizeApiKeyHeader("Bearer   osk_test_secret_1234567890123456 ")).toBe("osk_test_secret_1234567890123456");
    expect(buildKeyHash("value")).toBe(buildKeyHash("value"));
  });

  it("accepts only publishable key prefixes", () => {
    expect(isValidPublishableKey("osk_test_pub_abc123")).toBe(true);
    expect(isValidPublishableKey("osk_live_secret_abc123")).toBe(false);
  });
});