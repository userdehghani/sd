/**
 * Session Repository Implementation (PostgreSQL)
 */

import { Pool } from "pg";
import { Session } from "../../domain/entities/session.entity";
import { SessionId } from "../../domain/value-objects/session-id.vo";
import { UserId } from "../../domain/value-objects/user-id.vo";
import { ISessionRepository } from "../../application/ports/repositories/session.repository";
import { AsyncResult, Ok, Err } from "../../shared/result";
import { DomainError, InfrastructureError, ErrorCode } from "../../shared/errors";
import { logger } from "../../logger";

interface SessionRow {
  id: string;
  user_id: string;
  user_agent: string;
  ip_address: string;
  device_type?: string;
  is_revoked: boolean;
  expires_at: Date;
  created_at: Date;
  revoked_at?: Date;
}

export class SessionRepositoryImpl implements ISessionRepository {
  constructor(private readonly pool: Pool) {}

  private rowToEntity(row: SessionRow): Session {
    return Session.reconstitute({
      id: SessionId.fromString(row.id),
      userId: UserId.fromString(row.user_id),
      deviceInfo: {
        userAgent: row.user_agent,
        ipAddress: row.ip_address,
        deviceType: row.device_type,
      },
      isRevoked: row.is_revoked,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
    });
  }

  async findById(id: SessionId): AsyncResult<Session | null, DomainError> {
    try {
      const result = await this.pool.query<SessionRow>(
        "SELECT * FROM sessions WHERE id = $1",
        [id.getValue()]
      );

      if (result.rows.length === 0) {
        return Ok(null);
      }

      const session = this.rowToEntity(result.rows[0]);
      return Ok(session);
    } catch (error) {
      logger.error("Error finding session by ID", { error });
      return Err(
        new InfrastructureError(
          "Failed to find session",
          ErrorCode.DATABASE_ERROR,
          { error }
        )
      );
    }
  }

  async findByUserId(userId: UserId): AsyncResult<Session[], DomainError> {
    try {
      const result = await this.pool.query<SessionRow>(
        "SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC",
        [userId.getValue()]
      );

      const sessions = result.rows.map((row) => this.rowToEntity(row));
      return Ok(sessions);
    } catch (error) {
      logger.error("Error finding sessions by user ID", { error });
      return Err(
        new InfrastructureError(
          "Failed to find sessions",
          ErrorCode.DATABASE_ERROR,
          { error }
        )
      );
    }
  }

  async save(session: Session): AsyncResult<Session, DomainError> {
    try {
      const result = await this.pool.query<SessionRow>(
        `INSERT INTO sessions (
          id, user_id, user_agent, ip_address, device_type,
          is_revoked, expires_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          session.id.getValue(),
          session.userId.getValue(),
          session.deviceInfo.userAgent,
          session.deviceInfo.ipAddress,
          session.deviceInfo.deviceType || null,
          session.isRevoked,
          session.expiresAt,
          session.createdAt,
        ]
      );

      const savedSession = this.rowToEntity(result.rows[0]);
      return Ok(savedSession);
    } catch (error) {
      logger.error("Error saving session", { error });
      return Err(
        new InfrastructureError(
          "Failed to save session",
          ErrorCode.DATABASE_ERROR,
          { error }
        )
      );
    }
  }

  async update(session: Session): AsyncResult<Session, DomainError> {
    try {
      const result = await this.pool.query<SessionRow>(
        `UPDATE sessions SET
          is_revoked = $2,
          revoked_at = $3
        WHERE id = $1
        RETURNING *`,
        [session.id.getValue(), session.isRevoked, session.revokedAt || null]
      );

      const updatedSession = this.rowToEntity(result.rows[0]);
      return Ok(updatedSession);
    } catch (error) {
      logger.error("Error updating session", { error });
      return Err(
        new InfrastructureError(
          "Failed to update session",
          ErrorCode.DATABASE_ERROR,
          { error }
        )
      );
    }
  }

  async delete(id: SessionId): AsyncResult<void, DomainError> {
    try {
      await this.pool.query("DELETE FROM sessions WHERE id = $1", [
        id.getValue(),
      ]);
      return Ok(undefined);
    } catch (error) {
      logger.error("Error deleting session", { error });
      return Err(
        new InfrastructureError(
          "Failed to delete session",
          ErrorCode.DATABASE_ERROR,
          { error }
        )
      );
    }
  }

  async deleteAllByUserId(userId: UserId): AsyncResult<void, DomainError> {
    try {
      await this.pool.query("DELETE FROM sessions WHERE user_id = $1", [
        userId.getValue(),
      ]);
      return Ok(undefined);
    } catch (error) {
      logger.error("Error deleting all user sessions", { error });
      return Err(
        new InfrastructureError(
          "Failed to delete sessions",
          ErrorCode.DATABASE_ERROR,
          { error }
        )
      );
    }
  }
}
