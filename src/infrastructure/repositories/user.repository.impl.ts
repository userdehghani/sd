/**
 * User Repository Implementation (PostgreSQL)
 */

import { Pool } from "pg";
import { User } from "../../domain/entities/user.entity";
import { UserId } from "../../domain/value-objects/user-id.vo";
import { Email } from "../../domain/value-objects/email.vo";
import { Phone } from "../../domain/value-objects/phone.vo";
import { IUserRepository } from "../../application/ports/repositories/user.repository";
import { AsyncResult, Ok, Err } from "../../shared/result";
import { DomainError, InfrastructureError, ErrorCode } from "../../shared/errors";
import { AuthProvider } from "../../shared/types";
import { logger } from "../../logger";

interface UserRow {
  id: string;
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  auth_providers: string[];
  totp_secret?: string;
  passkey_credential?: string;
  created_at: Date;
  updated_at: Date;
}

export class UserRepositoryImpl implements IUserRepository {
  constructor(private readonly pool: Pool) {}

  private rowToEntity(row: UserRow): User {
    const emailResult = Email.create(row.email);
    if (!emailResult.success) {
      throw new Error("Invalid email in database");
    }

    const phone = row.phone ? Phone.create(row.phone) : null;

    return User.reconstitute({
      id: UserId.fromString(row.id),
      email: emailResult.value,
      phone: phone && phone.success ? phone.value : undefined,
      firstName: row.first_name,
      lastName: row.last_name,
      avatarUrl: row.avatar_url,
      isEmailVerified: row.is_email_verified,
      isPhoneVerified: row.is_phone_verified,
      authProviders: row.auth_providers as AuthProvider[],
      totpSecret: row.totp_secret,
      passKeyCredential: row.passkey_credential,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async findById(id: UserId): AsyncResult<User | null, DomainError> {
    try {
      const result = await this.pool.query<UserRow>(
        "SELECT * FROM users WHERE id = $1",
        [id.getValue()]
      );

      if (result.rows.length === 0) {
        return Ok(null);
      }

      const user = this.rowToEntity(result.rows[0]);
      return Ok(user);
    } catch (error) {
      logger.error("Error finding user by ID", { error, id: id.getValue() });
      return Err(
        new InfrastructureError(
          "Failed to find user",
          ErrorCode.DATABASE_ERROR,
          { error }
        )
      );
    }
  }

  async findByEmail(email: Email): AsyncResult<User | null, DomainError> {
    try {
      const result = await this.pool.query<UserRow>(
        "SELECT * FROM users WHERE email = $1",
        [email.getValue()]
      );

      if (result.rows.length === 0) {
        return Ok(null);
      }

      const user = this.rowToEntity(result.rows[0]);
      return Ok(user);
    } catch (error) {
      logger.error("Error finding user by email", { error });
      return Err(
        new InfrastructureError(
          "Failed to find user",
          ErrorCode.DATABASE_ERROR,
          { error }
        )
      );
    }
  }

  async findByPhone(phone: Phone): AsyncResult<User | null, DomainError> {
    try {
      const result = await this.pool.query<UserRow>(
        "SELECT * FROM users WHERE phone = $1",
        [phone.getValue()]
      );

      if (result.rows.length === 0) {
        return Ok(null);
      }

      const user = this.rowToEntity(result.rows[0]);
      return Ok(user);
    } catch (error) {
      logger.error("Error finding user by phone", { error });
      return Err(
        new InfrastructureError(
          "Failed to find user",
          ErrorCode.DATABASE_ERROR,
          { error }
        )
      );
    }
  }

  async save(user: User): AsyncResult<User, DomainError> {
    try {
      const result = await this.pool.query<UserRow>(
        `INSERT INTO users (
          id, email, phone, first_name, last_name, avatar_url,
          is_email_verified, is_phone_verified, auth_providers,
          totp_secret, passkey_credential, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          user.id.getValue(),
          user.email.getValue(),
          user.phone?.getValue() || null,
          user.firstName || null,
          user.lastName || null,
          user.avatarUrl || null,
          user.isEmailVerified,
          user.isPhoneVerified,
          user.authProviders,
          user.totpSecret || null,
          user.passKeyCredential || null,
          user.createdAt,
          user.updatedAt,
        ]
      );

      const savedUser = this.rowToEntity(result.rows[0]);
      return Ok(savedUser);
    } catch (error) {
      logger.error("Error saving user", { error });
      return Err(
        new InfrastructureError(
          "Failed to save user",
          ErrorCode.DATABASE_ERROR,
          { error }
        )
      );
    }
  }

  async update(user: User): AsyncResult<User, DomainError> {
    try {
      const result = await this.pool.query<UserRow>(
        `UPDATE users SET
          email = $2,
          phone = $3,
          first_name = $4,
          last_name = $5,
          avatar_url = $6,
          is_email_verified = $7,
          is_phone_verified = $8,
          auth_providers = $9,
          totp_secret = $10,
          passkey_credential = $11,
          updated_at = $12
        WHERE id = $1
        RETURNING *`,
        [
          user.id.getValue(),
          user.email.getValue(),
          user.phone?.getValue() || null,
          user.firstName || null,
          user.lastName || null,
          user.avatarUrl || null,
          user.isEmailVerified,
          user.isPhoneVerified,
          user.authProviders,
          user.totpSecret || null,
          user.passKeyCredential || null,
          user.updatedAt,
        ]
      );

      const updatedUser = this.rowToEntity(result.rows[0]);
      return Ok(updatedUser);
    } catch (error) {
      logger.error("Error updating user", { error });
      return Err(
        new InfrastructureError(
          "Failed to update user",
          ErrorCode.DATABASE_ERROR,
          { error }
        )
      );
    }
  }

  async delete(id: UserId): AsyncResult<void, DomainError> {
    try {
      await this.pool.query("DELETE FROM users WHERE id = $1", [id.getValue()]);
      return Ok(undefined);
    } catch (error) {
      logger.error("Error deleting user", { error });
      return Err(
        new InfrastructureError(
          "Failed to delete user",
          ErrorCode.DATABASE_ERROR,
          { error }
        )
      );
    }
  }

  async exists(email: Email): AsyncResult<boolean, DomainError> {
    try {
      const result = await this.pool.query<{ exists: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)",
        [email.getValue()]
      );
      return Ok(result.rows[0].exists);
    } catch (error) {
      logger.error("Error checking user existence", { error });
      return Err(
        new InfrastructureError(
          "Failed to check user existence",
          ErrorCode.DATABASE_ERROR,
          { error }
        )
      );
    }
  }
}
