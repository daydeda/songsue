// Lightweight In-Memory Client IP Rate Limiter to prevent spam/abuse
const ipCache = new Map<string, { count: number; resetTime: number }>();

export type RateLimitResult = {
  success: boolean;
  count: number;
  limit: number;
  resetTime: number;
};

/**
 * Throttles requests by IP address.
 * Defaults to 60 requests per 1 minute (60000ms).
 */
export function rateLimit(ip: string, limit: number = 60, windowMs: number = 60000): RateLimitResult {
  const now = Date.now();
  const record = ipCache.get(ip);

  // If no record or reset window has passed, start a new window
  if (!record || now > record.resetTime) {
    ipCache.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { success: true, count: 1, limit, resetTime: now + windowMs };
  }

  // If over the limit, reject
  if (record.count >= limit) {
    return { success: false, count: record.count, limit, resetTime: record.resetTime };
  }

  // Increment count
  record.count += 1;
  return { success: true, count: record.count, limit, resetTime: record.resetTime };
}

/**
 * Safely extracts client IP address from request headers.
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list of IPs, get the first one
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
