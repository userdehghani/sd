/**
 * Session Repository Port (Interface)
 * Defines the contract for session persistence operations
 */

import { Session } from "../../../domain/entities/session.entity";
import { SessionId } from "../../../domain/value-objects/session-id.vo";
import { UserId } from "../../../domain/value-objects/user-id.vo";
import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";

export interface ISessionRepository {
  findById(id: SessionId): AsyncResult<Session | null, DomainError>;
  findByUserId(userId: UserId): AsyncResult<Session[], DomainError>;
  save(session: Session): AsyncResult<Session, DomainError>;
  update(session: Session): AsyncResult<Session, DomainError>;
  delete(id: SessionId): AsyncResult<void, DomainError>;
  deleteAllByUserId(userId: UserId): AsyncResult<void, DomainError>;
}
