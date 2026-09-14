import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("rate-limit configuration gates", () => {
  it("fails closed for strict operations in production without Upstash", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { strictLimit } = await import("./rate-limit");

    await expect(strictLimit("terminal:test", true)).resolves.toMatchObject({
      allowed: false,
      error: "Rate limiter must be configured for this operation",
    });
  });

  it("keeps development usable while reporting missing strict rate limiting", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { strictLimit } = await import("./rate-limit");

    await expect(strictLimit("terminal:test", true)).resolves.toMatchObject({
      allowed: false,
      error: "Rate limiter is not configured",
    });
  });
});