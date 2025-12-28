/**
 * Use Case: user.auth.session.create
 * Create a new session for an authenticated user
 */

import {
  type Result,
  type DomainError,
  ok,
  err,
  AuthErrors,
  generateSessionId,
  type UUID,
} from "../../../../core";
import { type UserRepository } from "../../../../domain/user";
import {
  type Session,
  type SessionRepository,
  createSession,
  createDeviceInfo,
} from "../../../../domain/session";
import type { JWTPort, LoggerPort } from "../../../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface CreateSessionInput {
  userId: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
    browser?: string;
    os?: string;
    device?: string;
    location?: {
      country?: string;
      city?: string;
      timezone?: string;
    };
  };
  metadata?: Record<string, unknown>;
}

export interface CreateSessionOutput {
  session: {
    id: string;
    expiresAt: string;
  };
  accessToken: string;
}

// ============================================
// Dependencies
// ============================================

export interface CreateSessionDeps {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  jwt: JWTPort;
  logger: LoggerPort;
  config: {
    sessionDurationSeconds: number;
    jwtIssuer: string;
    jwtAudience: string;
  };
}

// ============================================
// Use Case: Create Session
// ============================================

export const createUserSession =
  (deps: CreateSessionDeps) =>
  async (input: CreateSessionInput): Promise<Result<CreateSessionOutput, DomainError>> => {
    const { userRepository, sessionRepository, jwt, logger, config } = deps;

    logger.info("Creating session", { userId: input.userId });

    // Verify user exists
    const userResult = await userRepository.findById(input.userId as UUID);
    if (userResult.isErr()) {
      return err(userResult.error);
    }

    if (!userResult.value) {
      logger.warn("Session creation for non-existent user", { userId: input.userId });
      return err(AuthErrors.UNAUTHORIZED());
    }

    const user = userResult.value;

    // Create session
    const sessionId = generateSessionId();
    const session = createSession({
      id: sessionId,
      userId: user.id,
      deviceInfo: createDeviceInfo(
        input.deviceInfo.userAgent,
        input.deviceInfo.ip,
        {
          browser: input.deviceInfo.browser,
          os: input.deviceInfo.os,
          device: input.deviceInfo.device,
        },
        input.deviceInfo.location
      ),
      expiresInSeconds: config.sessionDurationSeconds,
      metadata: input.metadata,
    });

    const sessionResult = await sessionRepository.create(session);
    if (sessionResult.isErr()) {
      return err(sessionResult.error);
    }

    // Generate JWT
    const jwtResult = await jwt.sign(
      {
        sub: user.id,
        sid: sessionId,
        email: user.email.value,
        role: user.role,
        iss: config.jwtIssuer,
        aud: config.jwtAudience,
      },
      config.sessionDurationSeconds
    );

    if (jwtResult.isErr()) {
      return err(jwtResult.error);
    }

    logger.info("Session created", { userId: input.userId, sessionId });

    return ok({
      session: {
        id: sessionId,
        expiresAt: session.expiresAt.toISOString(),
      },
      accessToken: jwtResult.value,
    });
  };
