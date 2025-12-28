/**
 * Use Case: user.auth.session.revoke
 * Revoke one or all sessions
 */

import {
  type Result,
  type DomainError,
  ok,
  err,
  AuthErrors,
  type UUID,
} from "../../../../core";
import {
  type SessionRepository,
  revokeSession,
} from "../../../../domain/session";
import type { CachePort, LoggerPort } from "../../../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface RevokeSessionInput {
  userId: string;
  sessionId: string;
  currentSessionId?: string; // To prevent revoking current session if needed
  reason?: string;
}

export interface RevokeSessionOutput {
  revoked: boolean;
  sessionId: string;
}

export interface RevokeAllSessionsInput {
  userId: string;
  currentSessionId?: string; // Keep current session active
  reason?: string;
}

export interface RevokeAllSessionsOutput {
  revokedCount: number;
  keptCurrentSession: boolean;
}

// ============================================
// Dependencies
// ============================================

export interface RevokeSessionDeps {
  sessionRepository: SessionRepository;
  cache: CachePort;
  logger: LoggerPort;
}

// ============================================
// Use Case: Revoke Session
// ============================================

export const revokeUserSession =
  (deps: RevokeSessionDeps) =>
  async (input: RevokeSessionInput): Promise<Result<RevokeSessionOutput, DomainError>> => {
    const { sessionRepository, cache, logger } = deps;

    logger.info("Revoking session", { 
      userId: input.userId, 
      sessionId: input.sessionId 
    });

    // Get the session
    const sessionResult = await sessionRepository.findById(input.sessionId);
    if (sessionResult.isErr()) {
      return err(sessionResult.error);
    }

    if (!sessionResult.value) {
      logger.warn("Session not found for revocation", { sessionId: input.sessionId });
      return err(AuthErrors.SESSION_NOT_FOUND(input.sessionId));
    }

    const session = sessionResult.value;

    // Verify session belongs to user
    if (session.userId !== input.userId) {
      logger.warn("Session ownership mismatch", { 
        sessionId: input.sessionId, 
        sessionUserId: session.userId,
        requestUserId: input.userId 
      });
      return err(AuthErrors.UNAUTHORIZED());
    }

    // Check if already revoked
    if (session.status === "revoked") {
      logger.info("Session already revoked", { sessionId: input.sessionId });
      return ok({ revoked: true, sessionId: input.sessionId });
    }

    // Revoke the session
    const revokedSession = revokeSession(session, input.reason || "User requested");
    const updateResult = await sessionRepository.update(revokedSession);
    
    if (updateResult.isErr()) {
      return err(updateResult.error);
    }

    // Invalidate any cached session data
    await cache.delete(`session:${input.sessionId}`);

    logger.info("Session revoked", { 
      userId: input.userId, 
      sessionId: input.sessionId 
    });

    return ok({
      revoked: true,
      sessionId: input.sessionId,
    });
  };

// ============================================
// Use Case: Revoke All Sessions
// ============================================

export const revokeAllUserSessions =
  (deps: RevokeSessionDeps) =>
  async (input: RevokeAllSessionsInput): Promise<Result<RevokeAllSessionsOutput, DomainError>> => {
    const { sessionRepository, cache, logger } = deps;

    logger.info("Revoking all sessions", { 
      userId: input.userId,
      keepCurrentSession: !!input.currentSessionId 
    });

    // Revoke all sessions (optionally except current)
    const revokeResult = await sessionRepository.revokeAllByUserId(
      input.userId as UUID,
      input.currentSessionId
    );

    if (revokeResult.isErr()) {
      return err(revokeResult.error);
    }

    const revokedCount = revokeResult.value;

    // Invalidate cached session data
    // Note: In production, you'd want to iterate and delete specific keys
    // or use a pattern-based delete if Redis supports it
    
    logger.info("All sessions revoked", { 
      userId: input.userId, 
      revokedCount,
      keptSessionId: input.currentSessionId 
    });

    return ok({
      revokedCount,
      keptCurrentSession: !!input.currentSessionId,
    });
  };

// ============================================
// Use Case: Logout (Revoke Current Session)
// ============================================

export interface LogoutInput {
  userId: string;
  sessionId: string;
}

export interface LogoutOutput {
  success: boolean;
}

export const logout =
  (deps: RevokeSessionDeps) =>
  async (input: LogoutInput): Promise<Result<LogoutOutput, DomainError>> => {
    const { sessionRepository, cache, logger } = deps;

    logger.info("Logging out", { userId: input.userId, sessionId: input.sessionId });

    const revokeResult = await revokeUserSession(deps)({
      userId: input.userId,
      sessionId: input.sessionId,
      reason: "User logout",
    });

    if (revokeResult.isErr()) {
      return err(revokeResult.error);
    }

    logger.info("Logout successful", { userId: input.userId });

    return ok({ success: true });
  };
