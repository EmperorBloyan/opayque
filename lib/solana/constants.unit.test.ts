import { afterEach, describe, expect, it } from "vitest";
import { getProductionConfigIssues } from "./constants";

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("Solana production configuration", () => {
  it("does not apply mainnet requirements to Vercel Preview", () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "devnet";

    expect(getProductionConfigIssues()).toEqual([]);
  });

  it("keeps mainnet requirements for strict production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL_ENV;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "devnet";

    expect(getProductionConfigIssues().some((issue) => issue.key === "NEXT_PUBLIC_SOLANA_NETWORK")).toBe(true);
  });
});