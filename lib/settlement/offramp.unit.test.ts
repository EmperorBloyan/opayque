import { afterEach, describe, expect, it } from "vitest";
import { getOfframpProvider, NullOfframpProvider } from "./offramp";

const originalKey = process.env.BRIDGE_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.BRIDGE_API_KEY;
  else process.env.BRIDGE_API_KEY = originalKey;
});

describe("offramp providers", () => {
  it("fails closed when no external partner is configured", async () => {
    delete process.env.BRIDGE_API_KEY;
    const provider = new NullOfframpProvider();
    const result = await provider.createPayout({ merchantId: "merchant-1", amountUsdc: 10, destinationRef: "external-account-1" });
    expect(provider.isConfigured()).toBe(false);
    expect(result.status).toBe("not_configured");
    expect(result.message).toMatch(/external partner/i);
  });

  it("does not enable Bridge without its server key", () => {
    delete process.env.BRIDGE_API_KEY;
    expect(getOfframpProvider().name).toBe("null");
  });
});