/**
 * Redis Client - Singleton Pattern
 * For caching, pub/sub, and temporary data storage
 */

import { type Result, ok, err, InfraErrors, type DomainError } from "../../../core";
import type { CachePort, PubSubPort, LoggerPort } from "../../../application/ports";

// ============================================
// Types
// ============================================

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface RedisClient extends CachePort, PubSubPort {
  close(): Promise<void>;
  isHealthy(): Promise<boolean>;
  
  // Additional Redis-specific methods
  setex(key: string, seconds: number, value: string): Promise<Result<void, DomainError>>;
  incr(key: string): Promise<Result<number, DomainError>>;
  decr(key: string): Promise<Result<number, DomainError>>;
  expire(key: string, seconds: number): Promise<Result<boolean, DomainError>>;
  ttl(key: string): Promise<Result<number, DomainError>>;
  keys(pattern: string): Promise<Result<string[], DomainError>>;
  hset(key: string, field: string, value: string): Promise<Result<void, DomainError>>;
  hget(key: string, field: string): Promise<Result<string | null, DomainError>>;
  hgetall(key: string): Promise<Result<Record<string, string>, DomainError>>;
}

// ============================================
// Singleton Implementation
// ============================================

let instance: RedisClient | null = null;

export const createRedisClient = (
  config: RedisConfig,
  logger: LoggerPort
): RedisClient => {
  // Return existing instance if available
  if (instance) {
    logger.debug("Returning existing Redis client instance");
    return instance;
  }

  logger.info("Creating Redis client", {
    host: config.host,
    port: config.port,
    db: config.db,
  });

  const keyPrefix = config.keyPrefix || "";
  const prefixKey = (key: string) => `${keyPrefix}${key}`;

  // In-memory storage for demonstration (replace with actual Redis client)
  // In production, use: import { Redis } from 'ioredis';
  const storage = new Map<string, { value: string; expiresAt?: number }>();
  const subscribers = new Map<string, Set<(message: unknown) => void>>();

  // Cleanup expired keys periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of storage.entries()) {
      if (data.expiresAt && data.expiresAt < now) {
        storage.delete(key);
      }
    }
  }, 60000); // Every minute

  const client: RedisClient = {
    // CachePort implementation
    async get<T>(key: string): Promise<Result<T | null, DomainError>> {
      try {
        const fullKey = prefixKey(key);
        const data = storage.get(fullKey);

        if (!data) {
          return ok(null);
        }

        if (data.expiresAt && data.expiresAt < Date.now()) {
          storage.delete(fullKey);
          return ok(null);
        }

        return ok(JSON.parse(data.value) as T);
      } catch (error) {
        logger.error("Redis GET failed", error as Error, { key });
        return err(InfraErrors.CACHE_ERROR("GET", error as Error));
      }
    },

    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<Result<void, DomainError>> {
      try {
        const fullKey = prefixKey(key);
        const serialized = JSON.stringify(value);
        const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;

        storage.set(fullKey, { value: serialized, expiresAt });

        logger.debug("Redis SET", { key: fullKey, ttl: ttlSeconds });
        return ok(undefined);
      } catch (error) {
        logger.error("Redis SET failed", error as Error, { key });
        return err(InfraErrors.CACHE_ERROR("SET", error as Error));
      }
    },

    async delete(key: string): Promise<Result<void, DomainError>> {
      try {
        const fullKey = prefixKey(key);
        storage.delete(fullKey);
        logger.debug("Redis DELETE", { key: fullKey });
        return ok(undefined);
      } catch (error) {
        logger.error("Redis DELETE failed", error as Error, { key });
        return err(InfraErrors.CACHE_ERROR("DELETE", error as Error));
      }
    },

    async exists(key: string): Promise<Result<boolean, DomainError>> {
      try {
        const fullKey = prefixKey(key);
        const data = storage.get(fullKey);

        if (!data) {
          return ok(false);
        }

        if (data.expiresAt && data.expiresAt < Date.now()) {
          storage.delete(fullKey);
          return ok(false);
        }

        return ok(true);
      } catch (error) {
        logger.error("Redis EXISTS failed", error as Error, { key });
        return err(InfraErrors.CACHE_ERROR("EXISTS", error as Error));
      }
    },

    // PubSubPort implementation
    async publish<T>(channel: string, message: T): Promise<Result<void, DomainError>> {
      try {
        const handlers = subscribers.get(channel);
        if (handlers) {
          for (const handler of handlers) {
            handler(message);
          }
        }
        logger.debug("Redis PUBLISH", { channel });
        return ok(undefined);
      } catch (error) {
        logger.error("Redis PUBLISH failed", error as Error, { channel });
        return err(InfraErrors.CACHE_ERROR("PUBLISH", error as Error));
      }
    },

    async subscribe<T>(channel: string, handler: (message: T) => void): Promise<Result<void, DomainError>> {
      try {
        if (!subscribers.has(channel)) {
          subscribers.set(channel, new Set());
        }
        subscribers.get(channel)!.add(handler as (message: unknown) => void);
        logger.debug("Redis SUBSCRIBE", { channel });
        return ok(undefined);
      } catch (error) {
        logger.error("Redis SUBSCRIBE failed", error as Error, { channel });
        return err(InfraErrors.CACHE_ERROR("SUBSCRIBE", error as Error));
      }
    },

    async unsubscribe(channel: string): Promise<Result<void, DomainError>> {
      try {
        subscribers.delete(channel);
        logger.debug("Redis UNSUBSCRIBE", { channel });
        return ok(undefined);
      } catch (error) {
        logger.error("Redis UNSUBSCRIBE failed", error as Error, { channel });
        return err(InfraErrors.CACHE_ERROR("UNSUBSCRIBE", error as Error));
      }
    },

    // Additional Redis methods
    async setex(key: string, seconds: number, value: string): Promise<Result<void, DomainError>> {
      return this.set(key, value, seconds);
    },

    async incr(key: string): Promise<Result<number, DomainError>> {
      try {
        const fullKey = prefixKey(key);
        const data = storage.get(fullKey);
        const currentValue = data ? parseInt(data.value, 10) || 0 : 0;
        const newValue = currentValue + 1;
        storage.set(fullKey, { value: String(newValue), expiresAt: data?.expiresAt });
        return ok(newValue);
      } catch (error) {
        logger.error("Redis INCR failed", error as Error, { key });
        return err(InfraErrors.CACHE_ERROR("INCR", error as Error));
      }
    },

    async decr(key: string): Promise<Result<number, DomainError>> {
      try {
        const fullKey = prefixKey(key);
        const data = storage.get(fullKey);
        const currentValue = data ? parseInt(data.value, 10) || 0 : 0;
        const newValue = currentValue - 1;
        storage.set(fullKey, { value: String(newValue), expiresAt: data?.expiresAt });
        return ok(newValue);
      } catch (error) {
        logger.error("Redis DECR failed", error as Error, { key });
        return err(InfraErrors.CACHE_ERROR("DECR", error as Error));
      }
    },

    async expire(key: string, seconds: number): Promise<Result<boolean, DomainError>> {
      try {
        const fullKey = prefixKey(key);
        const data = storage.get(fullKey);
        if (!data) {
          return ok(false);
        }
        data.expiresAt = Date.now() + seconds * 1000;
        return ok(true);
      } catch (error) {
        logger.error("Redis EXPIRE failed", error as Error, { key });
        return err(InfraErrors.CACHE_ERROR("EXPIRE", error as Error));
      }
    },

    async ttl(key: string): Promise<Result<number, DomainError>> {
      try {
        const fullKey = prefixKey(key);
        const data = storage.get(fullKey);
        if (!data || !data.expiresAt) {
          return ok(-1);
        }
        const remaining = Math.floor((data.expiresAt - Date.now()) / 1000);
        return ok(remaining > 0 ? remaining : -2);
      } catch (error) {
        logger.error("Redis TTL failed", error as Error, { key });
        return err(InfraErrors.CACHE_ERROR("TTL", error as Error));
      }
    },

    async keys(pattern: string): Promise<Result<string[], DomainError>> {
      try {
        const fullPattern = prefixKey(pattern);
        const regex = new RegExp(
          "^" + fullPattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
        );
        const matchingKeys = Array.from(storage.keys()).filter((k) => regex.test(k));
        return ok(matchingKeys);
      } catch (error) {
        logger.error("Redis KEYS failed", error as Error, { pattern });
        return err(InfraErrors.CACHE_ERROR("KEYS", error as Error));
      }
    },

    async hset(key: string, field: string, value: string): Promise<Result<void, DomainError>> {
      try {
        const fullKey = prefixKey(key);
        const existing = storage.get(fullKey);
        const hash = existing ? JSON.parse(existing.value) : {};
        hash[field] = value;
        storage.set(fullKey, { value: JSON.stringify(hash) });
        return ok(undefined);
      } catch (error) {
        logger.error("Redis HSET failed", error as Error, { key, field });
        return err(InfraErrors.CACHE_ERROR("HSET", error as Error));
      }
    },

    async hget(key: string, field: string): Promise<Result<string | null, DomainError>> {
      try {
        const fullKey = prefixKey(key);
        const existing = storage.get(fullKey);
        if (!existing) {
          return ok(null);
        }
        const hash = JSON.parse(existing.value);
        return ok(hash[field] ?? null);
      } catch (error) {
        logger.error("Redis HGET failed", error as Error, { key, field });
        return err(InfraErrors.CACHE_ERROR("HGET", error as Error));
      }
    },

    async hgetall(key: string): Promise<Result<Record<string, string>, DomainError>> {
      try {
        const fullKey = prefixKey(key);
        const existing = storage.get(fullKey);
        if (!existing) {
          return ok({});
        }
        return ok(JSON.parse(existing.value));
      } catch (error) {
        logger.error("Redis HGETALL failed", error as Error, { key });
        return err(InfraErrors.CACHE_ERROR("HGETALL", error as Error));
      }
    },

    async close(): Promise<void> {
      logger.info("Closing Redis client");
      clearInterval(cleanupInterval);
      storage.clear();
      subscribers.clear();
      instance = null;
    },

    async isHealthy(): Promise<boolean> {
      try {
        // In real implementation: await redis.ping();
        return true;
      } catch {
        return false;
      }
    },
  };

  instance = client;
  return client;
};

// ============================================
// Get Singleton Instance
// ============================================

export const getRedisClient = (): RedisClient | null => instance;

// ============================================
// Reset for Testing
// ============================================

export const resetRedisClient = (): void => {
  instance = null;
};
