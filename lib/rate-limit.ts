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
