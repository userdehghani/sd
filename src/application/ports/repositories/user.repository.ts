/**
 * User Repository Port (Interface)
 * Defines the contract for user persistence operations
 */

import { User } from "../../../domain/entities/user.entity";
import { UserId } from "../../../domain/value-objects/user-id.vo";
import { Email } from "../../../domain/value-objects/email.vo";
import { Phone } from "../../../domain/value-objects/phone.vo";
import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";

export interface IUserRepository {
  findById(id: UserId): AsyncResult<User | null, DomainError>;
  findByEmail(email: Email): AsyncResult<User | null, DomainError>;
  findByPhone(phone: Phone): AsyncResult<User | null, DomainError>;
  save(user: User): AsyncResult<User, DomainError>;
  update(user: User): AsyncResult<User, DomainError>;
  delete(id: UserId): AsyncResult<void, DomainError>;
  exists(email: Email): AsyncResult<boolean, DomainError>;
}
