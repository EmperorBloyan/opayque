import { afterEach, describe, expect, it } from "vitest";
import { DemoComplianceProvider, getComplianceProvider, NullComplianceProvider } from "./providers";

const originalProvider = process.env.COMPLIANCE_PROVIDER;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  const environment = process.env as Record<string, string | undefined>;
  if (originalProvider === undefined) delete environment.COMPLIANCE_PROVIDER;
  else environment.COMPLIANCE_PROVIDER = originalProvider;
  if (originalNodeEnv === undefined) delete environment.NODE_ENV;
  else environment.NODE_ENV = originalNodeEnv;
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
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.COMPLIANCE_PROVIDER;
    expect(getComplianceProvider().name).toBe("null");
  });

  it("rejects demo in production even when explicitly selected", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.COMPLIANCE_PROVIDER = "demo";
    expect(getComplianceProvider().name).toBe("null");
  });
});