import rateLimit from 'next-rate-limit';

export const getRateLimiter = rateLimit({
  limiter: rateLimit.memoryStore(),
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 requests per minute
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limit for sensitive routes (e.g. payments, auth)
export const strictRateLimit = rateLimit({
  limiter: rateLimit.memoryStore(),
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many sensitive requests.',
});

const requestBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRequestRateLimit(
  key: string,
  max = 10,
  windowMs = 60_000
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const current = requestBuckets.get(key);
  if (!current || current.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
