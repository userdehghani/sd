/**
 * Use Case: user.auth.session.list
 * List all active sessions for a user
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
  type SessionListItem,
  toSessionListItem,
} from "../../../../domain/session";
import type { LoggerPort } from "../../../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface ListSessionsInput {
  userId: string;
  currentSessionId?: string;
}

export interface ListSessionsOutput {
  sessions: SessionListItem[];
  total: number;
}

// ============================================
// Dependencies
// ============================================

export interface ListSessionsDeps {
  sessionRepository: SessionRepository;
  logger: LoggerPort;
}

// ============================================
// Use Case: List Sessions
// ============================================

export const listUserSessions =
  (deps: ListSessionsDeps) =>
  async (input: ListSessionsInput): Promise<Result<ListSessionsOutput, DomainError>> => {
    const { sessionRepository, logger } = deps;

    logger.info("Listing sessions", { userId: input.userId });

    // Get active sessions
    const sessionsResult = await sessionRepository.findActiveByUserId(input.userId as UUID);
    if (sessionsResult.isErr()) {
      return err(sessionsResult.error);
    }

    const sessions = sessionsResult.value;

    // Transform to list items
    const sessionItems = sessions.map((session) =>
      toSessionListItem(session, input.currentSessionId)
    );

    // Sort by last activity (most recent first)
    sessionItems.sort((a, b) =>
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );

    logger.info("Sessions listed", { 
      userId: input.userId, 
      count: sessionItems.length 
    });

    return ok({
      sessions: sessionItems,
      total: sessionItems.length,
    });
  };
