/**
 * User Repository Port
 * Interface defining the contract for user persistence
 */

import type { Result, DomainError, UUID, Email, PaginatedResult, PaginationParams } from "../../core";
import type { User, UserDTO } from "./entity";
import type { AuthProviderType, PasskeyCredentialVO } from "./value-objects";

// ============================================
// User Repository Port (Interface)
// ============================================

export interface UserRepository {
  // Basic CRUD
  findById(id: UUID): Promise<Result<User | null, DomainError>>;
  findByEmail(email: Email): Promise<Result<User | null, DomainError>>;
  findByAuthProvider(type: AuthProviderType, providerId: string): Promise<Result<User | null, DomainError>>;
  create(user: User): Promise<Result<User, DomainError>>;
  update(user: User): Promise<Result<User, DomainError>>;
  delete(id: UUID): Promise<Result<void, DomainError>>;

  // Query methods
  findAll(params: PaginationParams): Promise<Result<PaginatedResult<User>, DomainError>>;
  existsByEmail(email: Email): Promise<Result<boolean, DomainError>>;

  // Auth provider methods
  findPasskeyCredential(credentialId: string): Promise<Result<{ user: User; credential: PasskeyCredentialVO } | null, DomainError>>;
  updatePasskeyCredential(userId: UUID, credential: PasskeyCredentialVO): Promise<Result<void, DomainError>>;
}

// ============================================
// Repository Factory Type
// ============================================

export type UserRepositoryFactory = () => UserRepository;
