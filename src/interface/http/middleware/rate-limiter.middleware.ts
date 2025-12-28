/**
 * Rate Limiter Middleware (Leaky Bucket Algorithm)
 * Implements rate limiting to protect API endpoints
 */

import Redis from "ioredis";
import { Context } from "elysia";
import { logger } from "../../../logger";

interface RateLimitConfig {
  capacity: number; // Maximum tokens
  refillRate: number; // Tokens per second
  keyPrefix?: string;
}

export class RateLimiterMiddleware {
  constructor(
    private readonly redis: Redis,
    private readonly config: RateLimitConfig
  ) {}

  /**
   * Leaky Bucket Rate Limiter
   * Returns true if request is allowed, false if rate limited
   */
  async checkRateLimit(context: Context, identifier?: string): Promise<boolean> {
    const key = this.getKey(context, identifier);
    const now = Date.now() / 1000; // Current time in seconds

    try {
      // Lua script for atomic leaky bucket implementation
      const script = `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        
        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1])
        local last_refill = tonumber(bucket[2])
        
        if tokens == nil then
          tokens = capacity
          last_refill = now
        end
        
        -- Calculate tokens to add based on time elapsed
        local elapsed = now - last_refill
        local tokens_to_add = elapsed * refill_rate
        tokens = math.min(capacity, tokens + tokens_to_add)
        last_refill = now
        
        -- Check if we have tokens available
        if tokens >= 1 then
          tokens = tokens - 1
          redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
          redis.call('EXPIRE', key, 3600)
          return 1
        else
          redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
          redis.call('EXPIRE', key, 3600)
          return 0
        end
      `;

      const result = await this.redis.eval(
        script,
        1,
        key,
        this.config.capacity.toString(),
        this.config.refillRate.toString(),
        now.toString()
      );

      const allowed = result === 1;

      if (!allowed) {
        logger.warn("Rate limit exceeded", { key });
      }

      return allowed;
    } catch (error) {
      logger.error("Error checking rate limit", { error, key });
      // Fail open - allow request if rate limiter fails
      return true;
    }
  }

  private getKey(context: Context, identifier?: string): string {
    const prefix = this.config.keyPrefix || "ratelimit";
    
    if (identifier) {
      return `${prefix}:${identifier}`;
    }

    // Use IP address as default identifier
    const ip =
      context.request.headers.get("x-forwarded-for") ||
      context.request.headers.get("x-real-ip") ||
      "unknown";

    return `${prefix}:${ip}`;
  }

  /**
   * Get remaining tokens for a key
   */
  async getRemainingTokens(context: Context, identifier?: string): Promise<number> {
    const key = this.getKey(context, identifier);

    try {
      const tokens = await this.redis.hget(key, "tokens");
      return tokens ? Math.floor(parseFloat(tokens)) : this.config.capacity;
    } catch (error) {
      logger.error("Error getting remaining tokens", { error, key });
      return this.config.capacity;
    }
  }
}
