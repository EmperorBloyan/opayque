import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./validate";

describe("environment validation", () => {
  it("allows local development without production-only services", () => {
    const result = validateEnvironment({ NODE_ENV: "development", NEXT_PUBLIC_SOLANA_NETWORK: "devnet" });
    expect(result.ok).toBe(true);
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(false);
  });

  it("requires critical infrastructure for mainnet production", () => {
    const result = validateEnvironment({ NODE_ENV: "production", NEXT_PUBLIC_SOLANA_NETWORK: "mainnet-beta" });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.key)).toEqual(expect.arrayContaining([
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_RPC_URL",
      "NEXT_PUBLIC_MAGICBLOCK_API",
      "MAGICBLOCK_API_KEY",
      "RELAYER_PRIVATE_KEY",
      "UPSTASH_REDIS_REST_URL",
    ]));
  });

  it("allows devnet Preview deployments to use staging infrastructure", () => {
    const result = validateEnvironment({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_SOLANA_NETWORK: "devnet",
    });

    expect(result.ok).toBe(true);
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(false);
  });

  it("supports the public Preview environment fallback", () => {
    const result = validateEnvironment({
      NODE_ENV: "production",
      NEXT_PUBLIC_VERCEL_ENV: "preview",
      NEXT_PUBLIC_SOLANA_NETWORK: "devnet",
    });

    expect(result.ok).toBe(true);
  });

  it("does not expose secret values in configuration metadata", () => {
    const result = validateEnvironment({
      NODE_ENV: "development",
      SUPABASE_SERVICE_ROLE_KEY: "super-secret",
      MAGICBLOCK_API_KEY: "magic-secret",
    });
    expect(result.configured.SUPABASE_SERVICE_ROLE_KEY).toBe("configured");
    expect(result.configured.MAGICBLOCK_API_KEY).toBe("configured");
  });

  it("keeps malformed production configuration fail-closed", () => {
    const result = validateEnvironment({ NODE_ENV: "production", NEXT_PUBLIC_SOLANA_NETWORK: "not-a-network" });
    expect(result.environment).toBe("production");
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
  });

  it("requires complete explicitly enabled provider configuration", () => {
    const result = validateEnvironment({
      NODE_ENV: "production",
      NEXT_PUBLIC_SOLANA_NETWORK: "mainnet-beta",
      COMPLIANCE_PROVIDER: "sumsub",
      BRIDGE_API_KEY: "bridge-key",
    });
    expect(result.issues.map((issue) => issue.key)).toEqual(expect.arrayContaining([
      "SUMSUB_APP_TOKEN",
      "SUMSUB_SECRET_KEY",
      "SUMSUB_WEBHOOK_SECRET",
      "BRIDGE_WEBHOOK_SECRET",
    ]));
  });
});
