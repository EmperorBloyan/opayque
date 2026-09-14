import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  error?: string;
}

const redisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

let redis: Redis | null = null;
let standardLimiter: Ratelimit | null = null;
let strictLimiter: Ratelimit | null = null;
let missingConfigWarningLogged = false;

function getLimiter(kind: "standard" | "strict"): Ratelimit | null {
  if (!redisConfigured) return null;
  redis ??= Redis.fromEnv();
  if (kind === "strict") {
    strictLimiter ??= new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "opayque:ratelimit:strict",
    });
    return strictLimiter;
  }

  standardLimiter ??= new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "opayque:ratelimit:standard",
  });
  return standardLimiter;
}

async function limit(
  kind: "standard" | "strict",
  key: string,
  failClosed = false
): Promise<RateLimitResult> {
  const limiter = getLimiter(kind);
  if (!limiter) {
    if (process.env.NODE_ENV !== "production" && !missingConfigWarningLogged) {
      missingConfigWarningLogged = true;
      console.warn("Distributed rate limiting is disabled because Upstash Redis is not configured");
    }
    return failClosed
      ? { allowed: false, retryAfterSeconds: 60, error: process.env.NODE_ENV === "production" ? "Rate limiter must be configured for this operation" : "Rate limiter is not configured" }
      : { allowed: true, retryAfterSeconds: 0 };
  }

  try {
    const result = await limiter.limit(key);
    return {
      allowed: result.success,
      retryAfterSeconds: result.success ? 0 : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
    };
  } catch (error) {
    console.error("Distributed rate limiter unavailable", error instanceof Error ? error.message : "unknown error");
    return failClosed
      ? { allowed: false, retryAfterSeconds: 60, error: "Rate limiter unavailable" }
      : { allowed: true, retryAfterSeconds: 0, error: "Rate limiter unavailable" };
  }
}

export function standardLimit(key: string): Promise<RateLimitResult> {
  return limit("standard", key);
}

export function strictLimit(key: string, failClosed = true): Promise<RateLimitResult> {
  return limit("strict", key, failClosed);
}

export function getClientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
}
