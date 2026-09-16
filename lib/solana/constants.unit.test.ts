import { afterEach, describe, expect, it } from "vitest";
import { getProductionConfigIssues } from "./constants";

const originalEnvironment = { ...process.env };

function setTestEnvironment(values: NodeJS.ProcessEnv) {
  process.env = { ...process.env, ...values };
}

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("Solana production configuration", () => {
  it("does not apply mainnet requirements to Vercel Preview", () => {
    setTestEnvironment({ NODE_ENV: "production", VERCEL_ENV: "preview", NEXT_PUBLIC_SOLANA_NETWORK: "devnet" });

    expect(getProductionConfigIssues()).toEqual([]);
  });

  it("keeps mainnet requirements for strict production", () => {
    setTestEnvironment({ NODE_ENV: "production", REQUIRE_MAINNET_PRODUCTION: "true" });
    delete process.env.VERCEL_ENV;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "devnet";

    expect(getProductionConfigIssues().some((issue) => issue.key === "NEXT_PUBLIC_SOLANA_NETWORK")).toBe(true);
  });
});