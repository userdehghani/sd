/**
 * Use Case: user.auth.login.totp
 * Login with Email + TOTP
 */

import {
  type Result,
  type DomainError,
  ok,
  err,
  AuthErrors,
  UserErrors,
  generateSessionId,
  type UUID,
} from "../../../../core";
import { type User, type UserRepository, recordLogin, createEmail } from "../../../../domain/user";
import {
  type Session,
  type SessionRepository,
  createSession,
  createDeviceInfo,
} from "../../../../domain/session";
import type { TOTPPort, JWTPort, CachePort, LoggerPort } from "../../../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface InitiateTOTPLoginInput {
  email: string;
}

export interface InitiateTOTPLoginOutput {
  loginToken: string; // Temporary token to track login flow
  totpRequired: boolean;
}

export interface CompleteTOTPLoginInput {
  loginToken: string;
  code: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
  };
}

export interface CompleteTOTPLoginOutput {
  accessToken: string;
  sessionId: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

// ============================================
// Dependencies
// ============================================

export interface TOTPLoginDeps {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  totp: TOTPPort;
  jwt: JWTPort;
  cache: CachePort;
  logger: LoggerPort;
  config: {
    loginTokenTTL: number;
    sessionDurationSeconds: number;
    jwtIssuer: string;
    jwtAudience: string;
  };
}

// ============================================
// Use Case: Initiate TOTP Login
// ============================================

export const initiateTOTPLogin =
  (deps: TOTPLoginDeps) =>
  async (input: InitiateTOTPLoginInput): Promise<Result<InitiateTOTPLoginOutput, DomainError>> => {
    const { userRepository, cache, logger, config } = deps;

    logger.info("Initiating TOTP login", { email: input.email });

    // Validate email format
    const emailResult = createEmail(input.email);
    if (emailResult.isErr()) {
      return err(emailResult.error);
    }

    // Find user by email
    const userResult = await userRepository.findByEmail(emailResult.value.value);
    if (userResult.isErr()) {
      return err(userResult.error);
    }

    if (!userResult.value) {
      // Don't reveal if user exists - use same response
      logger.warn("Login attempt for non-existent user", { email: input.email });
      // For security, we still return success to not reveal user existence
      const fakeToken = generateSessionId();
      await cache.set(`login_attempt:${fakeToken}`, { fake: true }, config.loginTokenTTL);
      return ok({ loginToken: fakeToken, totpRequired: true });
    }

    const user = userResult.value;

    // Check if user has TOTP enabled
    if (!user.totpEnabled) {
      logger.warn("TOTP login attempted but TOTP not enabled", { userId: user.id });
      return err(AuthErrors.INVALID_CREDENTIALS({ reason: "TOTP not enabled" }));
    }

    // Generate login token
    const loginToken = generateSessionId();

    // Store login attempt
    const loginAttempt = {
      userId: user.id,
      email: user.email.value,
      firstName: user.name.firstName,
      lastName: user.name.lastName,
      totpSecret: user.totpSecret,
      createdAt: Date.now(),
    };

    const cacheResult = await cache.set(
      `login_attempt:${loginToken}`,
      loginAttempt,
      config.loginTokenTTL
    );

    if (cacheResult.isErr()) {
      return err(cacheResult.error);
    }

    logger.info("TOTP login initiated", { userId: user.id });

    return ok({
      loginToken,
      totpRequired: true,
    });
  };

// ============================================
// Use Case: Complete TOTP Login
// ============================================

export const completeTOTPLogin =
  (deps: TOTPLoginDeps) =>
  async (input: CompleteTOTPLoginInput): Promise<Result<CompleteTOTPLoginOutput, DomainError>> => {
    const { userRepository, sessionRepository, totp, jwt, cache, logger, config } = deps;

    logger.info("Completing TOTP login", { loginToken: input.loginToken.substring(0, 10) + "..." });

    // Get login attempt
    const attemptResult = await cache.get<{
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      totpSecret: string;
      fake?: boolean;
    }>(`login_attempt:${input.loginToken}`);

    if (attemptResult.isErr()) {
      return err(attemptResult.error);
    }

    if (!attemptResult.value || attemptResult.value.fake) {
      logger.warn("Invalid or expired login token");
      return err(AuthErrors.INVALID_CREDENTIALS());
    }

    const attempt = attemptResult.value;

    // Verify TOTP code
    const isValid = totp.verify(attempt.totpSecret, input.code);
    if (!isValid) {
      logger.warn("Invalid TOTP code", { userId: attempt.userId });
      return err(AuthErrors.TOTP_INVALID());
    }

    // Clean up login attempt
    await cache.delete(`login_attempt:${input.loginToken}`);

    // Create session
    const sessionId = generateSessionId();
    const session = createSession({
      id: sessionId,
      userId: attempt.userId as UUID,
      deviceInfo: createDeviceInfo(
        input.deviceInfo.userAgent,
        input.deviceInfo.ip
      ),
      expiresInSeconds: config.sessionDurationSeconds,
    });

    const sessionResult = await sessionRepository.create(session);
    if (sessionResult.isErr()) {
      return err(sessionResult.error);
    }

    // Update user's last login
    const userResult = await userRepository.findById(attempt.userId as UUID);
    if (userResult.isOk() && userResult.value) {
      await userRepository.update(recordLogin(userResult.value));
    }

    // Generate JWT
    const jwtResult = await jwt.sign(
      {
        sub: attempt.userId,
        sid: sessionId,
        email: attempt.email,
        role: "user",
        iss: config.jwtIssuer,
        aud: config.jwtAudience,
      },
      config.sessionDurationSeconds
    );

    if (jwtResult.isErr()) {
      return err(jwtResult.error);
    }

    logger.info("TOTP login completed", { userId: attempt.userId, sessionId });

    return ok({
      accessToken: jwtResult.value,
      sessionId,
      expiresAt: session.expiresAt.toISOString(),
      user: {
        id: attempt.userId,
        email: attempt.email,
        firstName: attempt.firstName,
        lastName: attempt.lastName,
      },
    });
  };
