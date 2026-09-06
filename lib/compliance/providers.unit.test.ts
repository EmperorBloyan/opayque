import { afterEach, describe, expect, it } from "vitest";
import { DemoComplianceProvider, getComplianceProvider, NullComplianceProvider } from "./providers";

const originalProvider = process.env.COMPLIANCE_PROVIDER;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalProvider === undefined) delete process.env.COMPLIANCE_PROVIDER;
  else process.env.COMPLIANCE_PROVIDER = originalProvider;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe("compliance providers", () => {
  it("returns an honest not_configured result from the null provider", async () => {
    const result = await new NullComplianceProvider().screenMerchant({ merchantId: "merchant-1", businessName: "Example", country: "US" });
    expect(result.status).toBe("not_configured");
    expect(result.message).toMatch(/not a KYB or KYC/i);
  });

  it("keeps demo screening explicitly non-regulatory", async () => {
    const result = await new DemoComplianceProvider().screenMerchant({ merchantId: "merchant-1", businessName: "Example", country: "US" });
    expect(result.status).toBe("review");
    expect(result.message).toMatch(/demo screening only/i);
  });

  it("defaults production to the null provider", () => {
    process.env.NODE_ENV = "production";
    delete process.env.COMPLIANCE_PROVIDER;
    expect(getComplianceProvider().name).toBe("null");
  });

  it("rejects demo in production even when explicitly selected", () => {
    process.env.NODE_ENV = "production";
    process.env.COMPLIANCE_PROVIDER = "demo";
    expect(getComplianceProvider().name).toBe("null");
  });
});