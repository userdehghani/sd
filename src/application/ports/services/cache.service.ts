/**
 * Cache Service Port (Interface)
 * Defines the contract for cache operations (Redis)
 */

import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";

export interface ICacheService {
  get<T>(key: string): AsyncResult<T | null, DomainError>;
  set<T>(key: string, value: T, ttl?: number): AsyncResult<void, DomainError>;
  delete(key: string): AsyncResult<void, DomainError>;
  exists(key: string): AsyncResult<boolean, DomainError>;
  
  // Verification codes
  setVerificationCode(key: string, code: string, ttl: number): AsyncResult<void, DomainError>;
  getVerificationCode(key: string): AsyncResult<string | null, DomainError>;
  
  // Session cache
  cacheSession(sessionId: string, data: unknown, ttl: number): AsyncResult<void, DomainError>;
  getSessionCache(sessionId: string): AsyncResult<unknown | null, DomainError>;
}
