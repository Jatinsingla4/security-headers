/**
 * Rate Limiter using Cloudflare Durable Objects.
 *
 * Implements a sliding window rate limiter.
 * Each client (identified by IP) gets its own Durable Object instance.
 */

import type { Env } from "../../types" ;

/** Rate limit check result */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
}

/**
 * Rate Limiter Durable Object.
 * Stores request timestamps in-memory and enforces a sliding window limit.
 */
export class RateLimiterDO implements DurableObject {
  private timestamps: number[] = [];
  private maxRequests = 100;
  private windowMs = 60_000;

  constructor(
    private readonly state: DurableObjectState,
    _env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/check") {
      const max = parseInt(url.searchParams.get("max") ?? "100", 10);
      const window = parseInt(url.searchParams.get("window") ?? "60000", 10);
      this.maxRequests = max;
      this.windowMs = window;

      const result = this.checkLimit();
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  private checkLimit(): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove expired timestamps
    this.timestamps = this.timestamps.filter((t) => t > windowStart);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestInWindow = this.timestamps[0];
      return {
        allowed: false,
        remaining: 0,
        resetAtMs: oldestInWindow + this.windowMs,
      };
    }

    this.timestamps.push(now);

    return {
      allowed: true,
      remaining: this.maxRequests - this.timestamps.length,
      resetAtMs: now + this.windowMs,
    };
  }
}

/**
 * Middleware: check rate limit for the current request.
 * Returns a 429 response if the client is rate-limited.
 */
export async function checkRateLimit(
  request: Request,
  env: Env
): Promise<Response | null> {
  const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const id = env.RATE_LIMITER.idFromName(clientIp);
  const stub = env.RATE_LIMITER.get(id);

  const max = env.RATE_LIMIT_MAX ?? "100";
  const window = env.RATE_LIMIT_WINDOW_MS ?? "60000";

  const checkUrl = new URL("https://rate-limiter/check");
  checkUrl.searchParams.set("max", max);
  checkUrl.searchParams.set("window", window);

  const result: RateLimitResult = await stub
    .fetch(checkUrl.href)
    .then((r) => r.json());

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfterMs: result.resetAtMs - Date.now(),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((result.resetAtMs - Date.now()) / 1000)),
          "X-RateLimit-Limit": max,
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAtMs / 1000)),
        },
      }
    );
  }

  // Return null to indicate the request is allowed to proceed
  return null;
}
