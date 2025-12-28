/**
 * Leaky Bucket Rate Limiter
 * Cloud-native rate limiting with Redis backend
 */

import { Elysia } from "elysia";
import { type Result, ok, err, InfraErrors, type DomainError } from "../../../core";
import type { CachePort, LoggerPort } from "../../../application/ports";

// ============================================
// Types
// ============================================

export interface RateLimitConfig {
  /** Bucket capacity (max tokens) */
  capacity: number;
  /** Leak rate (tokens per second) */
  leakRate: number;
  /** Key prefix for Redis */
  keyPrefix?: string;
  /** Skip rate limiting for certain paths */
  skipPaths?: string[];
  /** Custom key generator */
  keyGenerator?: (request: Request, headers: Record<string, string>) => string;
}

interface BucketState {
  tokens: number;
  lastLeak: number;
}

// ============================================
// Leaky Bucket Implementation
// ============================================

export class LeakyBucketRateLimiter {
  private readonly capacity: number;
  private readonly leakRate: number;
  private readonly keyPrefix: string;
  private readonly cache: CachePort;
  private readonly logger: LoggerPort;
  private readonly skipPaths: Set<string>;
  private readonly keyGenerator: (request: Request, headers: Record<string, string>) => string;

  constructor(
    cache: CachePort,
    logger: LoggerPort,
    config: RateLimitConfig
  ) {
    this.cache = cache;
    this.logger = logger;
    this.capacity = config.capacity;
    this.leakRate = config.leakRate;
    this.keyPrefix = config.keyPrefix || "ratelimit:";
    this.skipPaths = new Set(config.skipPaths || []);
    this.keyGenerator = config.keyGenerator || this.defaultKeyGenerator;
  }

  private defaultKeyGenerator(request: Request, headers: Record<string, string>): string {
    // Use IP address as default key
    const ip = headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
               headers["x-real-ip"] ||
               "unknown";
    return ip;
  }

  /**
   * Try to consume a token from the bucket
   * Returns remaining tokens if allowed, or error if rate limited
   */
  async tryConsume(key: string): Promise<Result<{ allowed: boolean; remaining: number; retryAfter?: number }, DomainError>> {
    const bucketKey = `${this.keyPrefix}${key}`;
    const now = Date.now();

    try {
      // Get current bucket state
      const stateResult = await this.cache.get<BucketState>(bucketKey);
      if (stateResult.isErr()) {
        return err(stateResult.error);
      }

      let state = stateResult.value;

      if (!state) {
        // Initialize new bucket
        state = {
          tokens: 0,
          lastLeak: now,
        };
      }

      // Calculate tokens to leak based on time elapsed
      const elapsed = (now - state.lastLeak) / 1000; // Convert to seconds
      const leaked = Math.floor(elapsed * this.leakRate);
      state.tokens = Math.max(0, state.tokens - leaked);
      state.lastLeak = now;

      // Check if we can add a token (request)
      if (state.tokens >= this.capacity) {
        // Bucket is full - rate limited
        const waitTime = Math.ceil((state.tokens - this.capacity + 1) / this.leakRate);

        this.logger.warn("Rate limit exceeded", {
          key,
          tokens: state.tokens,
          capacity: this.capacity,
          retryAfter: waitTime,
        });

        // Still update the state
        await this.cache.set(bucketKey, state, 3600); // 1 hour TTL

        return ok({
          allowed: false,
          remaining: 0,
          retryAfter: waitTime,
        });
      }

      // Add token (request) to bucket
      state.tokens += 1;
      const remaining = Math.max(0, this.capacity - state.tokens);

      // Save state
      const saveResult = await this.cache.set(bucketKey, state, 3600);
      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      return ok({
        allowed: true,
        remaining,
      });
    } catch (error) {
      this.logger.error("Rate limiter error", error as Error, { key });
      // On error, allow the request (fail open)
      return ok({ allowed: true, remaining: this.capacity });
    }
  }

  /**
   * Check if a path should skip rate limiting
   */
  shouldSkip(path: string): boolean {
    return this.skipPaths.has(path);
  }

  /**
   * Get rate limit key for request
   */
  getKey(request: Request, headers: Record<string, string>): string {
    return this.keyGenerator(request, headers);
  }
}

// ============================================
// Elysia Plugin
// ============================================

export interface RateLimiterPluginConfig extends RateLimitConfig {
  cache: CachePort;
  logger: LoggerPort;
}

export const rateLimiterPlugin = (config: RateLimiterPluginConfig) => {
  const limiter = new LeakyBucketRateLimiter(config.cache, config.logger, config);

  return new Elysia({ name: "rate-limiter" })
    .derive(({ request, headers }) => {
      return {
        rateLimitKey: limiter.getKey(request, headers as Record<string, string>),
      };
    })
    .onBeforeHandle(async ({ request, headers, set, rateLimitKey }) => {
      const path = new URL(request.url).pathname;

      // Skip rate limiting for certain paths
      if (limiter.shouldSkip(path)) {
        return;
      }

      const result = await limiter.tryConsume(rateLimitKey);

      if (result.isErr()) {
        // On error, allow request (fail open)
        config.logger.warn("Rate limiter check failed", { error: result.error });
        return;
      }

      const { allowed, remaining, retryAfter } = result.value;

      // Set rate limit headers
      set.headers["X-RateLimit-Limit"] = String(config.capacity);
      set.headers["X-RateLimit-Remaining"] = String(remaining);

      if (!allowed) {
        set.status = 429;
        set.headers["Retry-After"] = String(retryAfter);
        return {
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests. Please try again later.",
            retryAfter,
          },
        };
      }
    });
};

// ============================================
// Per-Route Rate Limiting
// ============================================

export interface RouteRateLimitConfig {
  /** Unique identifier for this rate limit */
  id: string;
  /** Max requests per window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export const createRouteRateLimiter = (
  cache: CachePort,
  logger: LoggerPort
) => {
  return async (
    key: string,
    config: RouteRateLimitConfig
  ): Promise<Result<{ allowed: boolean; remaining: number; resetAt: number }, DomainError>> => {
    const bucketKey = `ratelimit:route:${config.id}:${key}`;
    const now = Date.now();
    const windowStart = Math.floor(now / (config.windowSeconds * 1000)) * (config.windowSeconds * 1000);
    const resetAt = windowStart + config.windowSeconds * 1000;

    try {
      // Get current count
      const countResult = await cache.get<{ count: number; windowStart: number }>(bucketKey);
      
      let data = countResult.isOk() ? countResult.value : null;

      // Reset if new window
      if (!data || data.windowStart !== windowStart) {
        data = { count: 0, windowStart };
      }

      // Check limit
      if (data.count >= config.limit) {
        return ok({
          allowed: false,
          remaining: 0,
          resetAt,
        });
      }

      // Increment count
      data.count += 1;
      await cache.set(bucketKey, data, config.windowSeconds);

      return ok({
        allowed: true,
        remaining: config.limit - data.count,
        resetAt,
      });
    } catch (error) {
      logger.error("Route rate limiter error", error as Error);
      return ok({ allowed: true, remaining: config.limit, resetAt: now });
    }
  };
};
