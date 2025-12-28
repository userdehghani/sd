/**
 * PostgreSQL User Repository Implementation
 */

import {
  type Result,
  ok,
  err,
  InfraErrors,
  type DomainError,
  type UUID,
  type Email,
  type PaginatedResult,
  type PaginationParams,
} from "../../../core";
import {
  type User,
  type UserRepository,
  type AuthProviderType,
  type PasskeyCredentialVO,
  createEmail,
  createName,
  createAvatar,
  createAuthProvider,
  createPasskeyCredential,
} from "../../../domain/user";
import type { PostgresClient } from "./client";
import type { LoggerPort } from "../../../application/ports";

// ============================================
// Repository Factory
// ============================================

export const createUserRepository = (
  db: PostgresClient,
  logger: LoggerPort
): UserRepository => {
  return {
    async findById(id: UUID): Promise<Result<User | null, DomainError>> {
      logger.debug("Finding user by ID", { userId: id });

      const result = await db.query<UserRow>(
        `SELECT * FROM users WHERE id = $1`,
        [id]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      if (result.value.rows.length === 0) {
        return ok(null);
      }

      return mapRowToUser(result.value.rows[0]);
    },

    async findByEmail(email: Email): Promise<Result<User | null, DomainError>> {
      logger.debug("Finding user by email", { email });

      const result = await db.query<UserRow>(
        `SELECT * FROM users WHERE email = $1`,
        [email]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      if (result.value.rows.length === 0) {
        return ok(null);
      }

      return mapRowToUser(result.value.rows[0]);
    },

    async findByAuthProvider(
      type: AuthProviderType,
      providerId: string
    ): Promise<Result<User | null, DomainError>> {
      logger.debug("Finding user by auth provider", { type, providerId });

      const result = await db.query<UserRow>(
        `SELECT u.* FROM users u
         JOIN auth_providers ap ON u.id = ap.user_id
         WHERE ap.type = $1 AND ap.provider_id = $2`,
        [type, providerId]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      if (result.value.rows.length === 0) {
        return ok(null);
      }

      return mapRowToUser(result.value.rows[0]);
    },

    async create(user: User): Promise<Result<User, DomainError>> {
      logger.info("Creating user", { userId: user.id });

      const txResult = await db.transaction(async (tx) => {
        // Insert user
        await tx.query(
          `INSERT INTO users (
            id, email, email_verified, email_verified_at,
            phone, phone_verified, phone_verified_at,
            first_name, last_name, display_name,
            avatar_url, avatar_key, avatar_size, avatar_mime_type,
            status, role, totp_enabled, totp_secret,
            metadata, created_at, updated_at, last_login_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
          [
            user.id,
            user.email.value,
            user.email.isVerified,
            user.email.verifiedAt,
            user.phone?.value,
            user.phone?.isVerified,
            user.phone?.verifiedAt,
            user.name.firstName,
            user.name.lastName,
            user.name.displayName,
            user.avatar?.url,
            user.avatar?.key,
            user.avatar?.size,
            user.avatar?.mimeType,
            user.status,
            user.role,
            user.totpEnabled,
            user.totpSecret,
            JSON.stringify(user.metadata),
            user.createdAt,
            user.updatedAt,
            user.lastLoginAt,
          ]
        );

        // Insert auth providers
        for (const provider of user.authProviders) {
          await tx.query(
            `INSERT INTO auth_providers (user_id, type, provider_id, email, linked_at, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              user.id,
              provider.type,
              provider.providerId,
              provider.email,
              provider.linkedAt,
              JSON.stringify(provider.metadata),
            ]
          );
        }

        // Insert passkey credentials
        for (const credential of user.passkeyCredentials) {
          await tx.query(
            `INSERT INTO passkey_credentials (
              id, user_id, public_key, counter, device_type, backed_up, transports, created_at, last_used_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              credential.id,
              user.id,
              credential.publicKey,
              credential.counter,
              credential.deviceType,
              credential.backedUp,
              JSON.stringify(credential.transports),
              credential.createdAt,
              credential.lastUsedAt,
            ]
          );
        }

        return user;
      });

      if (txResult.isErr()) {
        return err(txResult.error);
      }

      return ok(user);
    },

    async update(user: User): Promise<Result<User, DomainError>> {
      logger.info("Updating user", { userId: user.id });

      const result = await db.query(
        `UPDATE users SET
          email = $2, email_verified = $3, email_verified_at = $4,
          phone = $5, phone_verified = $6, phone_verified_at = $7,
          first_name = $8, last_name = $9, display_name = $10,
          avatar_url = $11, avatar_key = $12, avatar_size = $13, avatar_mime_type = $14,
          status = $15, role = $16, totp_enabled = $17, totp_secret = $18,
          metadata = $19, updated_at = $20, last_login_at = $21
         WHERE id = $1`,
        [
          user.id,
          user.email.value,
          user.email.isVerified,
          user.email.verifiedAt,
          user.phone?.value,
          user.phone?.isVerified,
          user.phone?.verifiedAt,
          user.name.firstName,
          user.name.lastName,
          user.name.displayName,
          user.avatar?.url,
          user.avatar?.key,
          user.avatar?.size,
          user.avatar?.mimeType,
          user.status,
          user.role,
          user.totpEnabled,
          user.totpSecret,
          JSON.stringify(user.metadata),
          new Date(),
          user.lastLoginAt,
        ]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      return ok({ ...user, updatedAt: new Date() });
    },

    async delete(id: UUID): Promise<Result<void, DomainError>> {
      logger.info("Deleting user", { userId: id });

      const result = await db.query(
        `DELETE FROM users WHERE id = $1`,
        [id]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      return ok(undefined);
    },

    async findAll(
      params: PaginationParams
    ): Promise<Result<PaginatedResult<User>, DomainError>> {
      logger.debug("Finding all users", params);

      const offset = (params.page - 1) * params.limit;

      const [countResult, usersResult] = await Promise.all([
        db.query<{ count: number }>(`SELECT COUNT(*) as count FROM users`),
        db.query<UserRow>(
          `SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [params.limit, offset]
        ),
      ]);

      if (countResult.isErr()) {
        return err(countResult.error);
      }

      if (usersResult.isErr()) {
        return err(usersResult.error);
      }

      const total = countResult.value.rows[0]?.count || 0;
      const totalPages = Math.ceil(total / params.limit);

      const users: User[] = [];
      for (const row of usersResult.value.rows) {
        const userResult = mapRowToUser(row);
        if (userResult.isOk()) {
          users.push(userResult.value!);
        }
      }

      return ok({
        items: users,
        total,
        page: params.page,
        limit: params.limit,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrev: params.page > 1,
      });
    },

    async existsByEmail(email: Email): Promise<Result<boolean, DomainError>> {
      const result = await db.query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) as exists`,
        [email]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      return ok(result.value.rows[0]?.exists || false);
    },

    async findPasskeyCredential(
      credentialId: string
    ): Promise<Result<{ user: User; credential: PasskeyCredentialVO } | null, DomainError>> {
      logger.debug("Finding passkey credential", { credentialId });

      const result = await db.query<PasskeyCredentialRow & UserRow>(
        `SELECT u.*, pc.id as credential_id, pc.public_key, pc.counter,
                pc.device_type, pc.backed_up, pc.transports,
                pc.created_at as credential_created_at, pc.last_used_at as credential_last_used_at
         FROM users u
         JOIN passkey_credentials pc ON u.id = pc.user_id
         WHERE pc.id = $1`,
        [credentialId]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      if (result.value.rows.length === 0) {
        return ok(null);
      }

      const row = result.value.rows[0];
      const userResult = mapRowToUser(row);

      if (userResult.isErr()) {
        return err(userResult.error);
      }

      const credential = createPasskeyCredential(
        row.credential_id,
        row.public_key,
        row.counter,
        row.device_type,
        row.backed_up,
        row.transports ? JSON.parse(row.transports) : undefined
      );

      return ok({ user: userResult.value!, credential });
    },

    async updatePasskeyCredential(
      userId: UUID,
      credential: PasskeyCredentialVO
    ): Promise<Result<void, DomainError>> {
      logger.info("Updating passkey credential", { userId, credentialId: credential.id });

      const result = await db.query(
        `UPDATE passkey_credentials SET counter = $3, last_used_at = $4
         WHERE id = $1 AND user_id = $2`,
        [credential.id, userId, credential.counter, credential.lastUsedAt]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      return ok(undefined);
    },
  };
};

// ============================================
// Row Types
// ============================================

interface UserRow {
  id: string;
  email: string;
  email_verified: boolean;
  email_verified_at?: Date;
  phone?: string;
  phone_verified?: boolean;
  phone_verified_at?: Date;
  first_name: string;
  last_name: string;
  display_name?: string;
  avatar_url?: string;
  avatar_key?: string;
  avatar_size?: number;
  avatar_mime_type?: string;
  status: string;
  role: string;
  totp_enabled: boolean;
  totp_secret?: string;
  metadata?: string;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

interface PasskeyCredentialRow {
  credential_id: string;
  public_key: string;
  counter: number;
  device_type: string;
  backed_up: boolean;
  transports?: string;
  credential_created_at: Date;
  credential_last_used_at?: Date;
}

// ============================================
// Mapper
// ============================================

const mapRowToUser = (row: UserRow): Result<User | null, DomainError> => {
  const emailResult = createEmail(
    row.email,
    row.email_verified,
    row.email_verified_at
  );

  if (emailResult.isErr()) {
    return err(emailResult.error);
  }

  const nameResult = createName(row.first_name, row.last_name, row.display_name);
  if (nameResult.isErr()) {
    return err(nameResult.error);
  }

  let phone;
  if (row.phone) {
    const { createPhone } = require("../../../domain/user");
    const phoneResult = createPhone(row.phone, row.phone_verified, row.phone_verified_at);
    if (phoneResult.isOk()) {
      phone = phoneResult.value;
    }
  }

  let avatar;
  if (row.avatar_url && row.avatar_key && row.avatar_size && row.avatar_mime_type) {
    const avatarResult = createAvatar(
      row.avatar_url,
      row.avatar_key,
      row.avatar_size,
      row.avatar_mime_type
    );
    if (avatarResult.isOk()) {
      avatar = avatarResult.value;
    }
  }

  const user: User = {
    id: row.id as UUID,
    email: emailResult.value,
    phone,
    name: nameResult.value,
    avatar,
    status: row.status as any,
    role: row.role as any,
    authProviders: [], // Loaded separately if needed
    passkeyCredentials: [], // Loaded separately if needed
    totpEnabled: row.totp_enabled,
    totpSecret: row.totp_secret,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
  };

  return ok(user);
};
