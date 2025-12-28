/**
 * PostgreSQL Session Repository Implementation
 */

import {
  type Result,
  ok,
  err,
  InfraErrors,
  type DomainError,
  type UUID,
} from "../../../core";
import {
  type Session,
  type SessionRepository,
  createSession,
  createDeviceInfo,
  revokeSession,
} from "../../../domain/session";
import type { PostgresClient } from "./client";
import type { LoggerPort } from "../../../application/ports";

// ============================================
// Repository Factory
// ============================================

export const createSessionRepository = (
  db: PostgresClient,
  logger: LoggerPort
): SessionRepository => {
  return {
    async findById(id: string): Promise<Result<Session | null, DomainError>> {
      logger.debug("Finding session by ID", { sessionId: id });

      const result = await db.query<SessionRow>(
        `SELECT * FROM sessions WHERE id = $1`,
        [id]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      if (result.value.rows.length === 0) {
        return ok(null);
      }

      return ok(mapRowToSession(result.value.rows[0]));
    },

    async findByUserId(userId: UUID): Promise<Result<Session[], DomainError>> {
      logger.debug("Finding sessions by user ID", { userId });

      const result = await db.query<SessionRow>(
        `SELECT * FROM sessions WHERE user_id = $1 ORDER BY last_activity_at DESC`,
        [userId]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      return ok(result.value.rows.map(mapRowToSession));
    },

    async findActiveByUserId(userId: UUID): Promise<Result<Session[], DomainError>> {
      logger.debug("Finding active sessions by user ID", { userId });

      const result = await db.query<SessionRow>(
        `SELECT * FROM sessions 
         WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
         ORDER BY last_activity_at DESC`,
        [userId]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      return ok(result.value.rows.map(mapRowToSession));
    },

    async create(session: Session): Promise<Result<Session, DomainError>> {
      logger.info("Creating session", { sessionId: session.id, userId: session.userId });

      const result = await db.query(
        `INSERT INTO sessions (
          id, user_id, status, user_agent, ip, browser, os, device,
          location_country, location_city, location_timezone,
          created_at, expires_at, last_activity_at, revoked_at, revoked_reason, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          session.id,
          session.userId,
          session.status,
          session.deviceInfo.userAgent,
          session.deviceInfo.ip,
          session.deviceInfo.browser,
          session.deviceInfo.os,
          session.deviceInfo.device,
          session.deviceInfo.location?.country,
          session.deviceInfo.location?.city,
          session.deviceInfo.location?.timezone,
          session.createdAt,
          session.expiresAt,
          session.lastActivityAt,
          session.revokedAt,
          session.revokedReason,
          JSON.stringify(session.metadata),
        ]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      return ok(session);
    },

    async update(session: Session): Promise<Result<Session, DomainError>> {
      logger.info("Updating session", { sessionId: session.id });

      const result = await db.query(
        `UPDATE sessions SET
          status = $2, last_activity_at = $3, revoked_at = $4, revoked_reason = $5, metadata = $6
         WHERE id = $1`,
        [
          session.id,
          session.status,
          session.lastActivityAt,
          session.revokedAt,
          session.revokedReason,
          JSON.stringify(session.metadata),
        ]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      return ok(session);
    },

    async delete(id: string): Promise<Result<void, DomainError>> {
      logger.info("Deleting session", { sessionId: id });

      const result = await db.query(
        `DELETE FROM sessions WHERE id = $1`,
        [id]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      return ok(undefined);
    },

    async revokeAllByUserId(
      userId: UUID,
      exceptSessionId?: string
    ): Promise<Result<number, DomainError>> {
      logger.info("Revoking all sessions for user", { userId, exceptSessionId });

      const now = new Date();
      let query = `UPDATE sessions SET status = 'revoked', revoked_at = $2, revoked_reason = 'Bulk revocation'
                   WHERE user_id = $1 AND status = 'active'`;
      const params: (string | Date)[] = [userId, now];

      if (exceptSessionId) {
        query += ` AND id != $3`;
        params.push(exceptSessionId);
      }

      const result = await db.query<{ rowCount: number }>(query, params);

      if (result.isErr()) {
        return err(result.error);
      }

      return ok(result.value.rowCount);
    },

    async deleteExpired(): Promise<Result<number, DomainError>> {
      logger.info("Deleting expired sessions");

      const result = await db.query<{ rowCount: number }>(
        `DELETE FROM sessions WHERE expires_at < NOW() AND status != 'active'`
      );

      if (result.isErr()) {
        return err(result.error);
      }

      return ok(result.value.rowCount);
    },

    async updateLastActivity(id: string): Promise<Result<void, DomainError>> {
      logger.debug("Updating session last activity", { sessionId: id });

      const result = await db.query(
        `UPDATE sessions SET last_activity_at = NOW() WHERE id = $1`,
        [id]
      );

      if (result.isErr()) {
        return err(result.error);
      }

      return ok(undefined);
    },
  };
};

// ============================================
// Row Type
// ============================================

interface SessionRow {
  id: string;
  user_id: string;
  status: string;
  user_agent: string;
  ip: string;
  browser?: string;
  os?: string;
  device?: string;
  location_country?: string;
  location_city?: string;
  location_timezone?: string;
  created_at: Date;
  expires_at: Date;
  last_activity_at: Date;
  revoked_at?: Date;
  revoked_reason?: string;
  metadata?: string;
}

// ============================================
// Mapper
// ============================================

const mapRowToSession = (row: SessionRow): Session => {
  return {
    id: row.id,
    userId: row.user_id as UUID,
    status: row.status as any,
    deviceInfo: createDeviceInfo(
      row.user_agent,
      row.ip,
      {
        browser: row.browser,
        os: row.os,
        device: row.device,
      },
      row.location_country || row.location_city || row.location_timezone
        ? {
            country: row.location_country,
            city: row.location_city,
            timezone: row.location_timezone,
          }
        : undefined
    ),
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    lastActivityAt: new Date(row.last_activity_at),
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : undefined,
    revokedReason: row.revoked_reason,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
};
