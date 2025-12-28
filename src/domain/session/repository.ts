/**
 * Session Repository Port
 * Interface defining the contract for session persistence
 */

import type { Result, DomainError, UUID } from "../../core";
import type { Session } from "./entity";

// ============================================
// Session Repository Port (Interface)
// ============================================

export interface SessionRepository {
  // Basic CRUD
  findById(id: string): Promise<Result<Session | null, DomainError>>;
  findByUserId(userId: UUID): Promise<Result<Session[], DomainError>>;
  findActiveByUserId(userId: UUID): Promise<Result<Session[], DomainError>>;
  create(session: Session): Promise<Result<Session, DomainError>>;
  update(session: Session): Promise<Result<Session, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;

  // Bulk operations
  revokeAllByUserId(userId: UUID, exceptSessionId?: string): Promise<Result<number, DomainError>>;
  deleteExpired(): Promise<Result<number, DomainError>>;

  // Activity tracking
  updateLastActivity(id: string): Promise<Result<void, DomainError>>;
}

// ============================================
// Repository Factory Type
// ============================================

export type SessionRepositoryFactory = () => SessionRepository;
