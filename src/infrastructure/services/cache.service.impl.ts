/**
 * Cache Service Implementation (Redis)
 */

import Redis from "ioredis";
import { ICacheService } from "../../application/ports/services/cache.service";
import { AsyncResult, Ok, Err } from "../../shared/result";
import { DomainError, InfrastructureError, ErrorCode } from "../../shared/errors";
import { logger } from "../../logger";

export class CacheServiceImpl implements ICacheService {
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): AsyncResult<T | null, DomainError> {
    try {
      const value = await this.redis.get(key);
      if (!value) {
        return Ok(null);
      }

      const parsed = JSON.parse(value) as T;
      return Ok(parsed);
    } catch (error) {
      logger.error("Error getting cache value", { error, key });
      return Err(
        new InfrastructureError("Failed to get cache value", ErrorCode.CACHE_ERROR, {
          error,
        })
      );
    }
  }

  async set<T>(key: string, value: T, ttl?: number): AsyncResult<void, DomainError> {
    try {
      const serialized = JSON.stringify(value);
      
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }

      return Ok(undefined);
    } catch (error) {
      logger.error("Error setting cache value", { error, key });
      return Err(
        new InfrastructureError("Failed to set cache value", ErrorCode.CACHE_ERROR, {
          error,
        })
      );
    }
  }

  async delete(key: string): AsyncResult<void, DomainError> {
    try {
      await this.redis.del(key);
      return Ok(undefined);
    } catch (error) {
      logger.error("Error deleting cache value", { error, key });
      return Err(
        new InfrastructureError(
          "Failed to delete cache value",
          ErrorCode.CACHE_ERROR,
          { error }
        )
      );
    }
  }

  async exists(key: string): AsyncResult<boolean, DomainError> {
    try {
      const result = await this.redis.exists(key);
      return Ok(result === 1);
    } catch (error) {
      logger.error("Error checking cache key existence", { error, key });
      return Err(
        new InfrastructureError(
          "Failed to check cache key existence",
          ErrorCode.CACHE_ERROR,
          { error }
        )
      );
    }
  }

  async setVerificationCode(
    key: string,
    code: string,
    ttl: number
  ): AsyncResult<void, DomainError> {
    return this.set(key, code, ttl);
  }

  async getVerificationCode(key: string): AsyncResult<string | null, DomainError> {
    return this.get<string>(key);
  }

  async cacheSession(
    sessionId: string,
    data: unknown,
    ttl: number
  ): AsyncResult<void, DomainError> {
    return this.set(`session:${sessionId}`, data, ttl);
  }

  async getSessionCache(sessionId: string): AsyncResult<unknown | null, DomainError> {
    return this.get<unknown>(`session:${sessionId}`);
  }
}
