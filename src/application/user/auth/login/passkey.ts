/**
 * Use Case: user.auth.login.passkey
 * Login with Passkey (WebAuthn)
 */

import {
  type Result,
  type DomainError,
  ok,
  err,
  AuthErrors,
  generateSessionId,
  generateId,
  type UUID,
} from "../../../../core";
import {
  type User,
  type UserRepository,
  recordLogin,
  updatePasskeyCounter,
} from "../../../../domain/user";
import {
  type Session,
  type SessionRepository,
  createSession,
  createDeviceInfo,
} from "../../../../domain/session";
import type { PasskeyPort, JWTPort, CachePort, LoggerPort } from "../../../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface InitiatePasskeyLoginInput {
  email?: string; // Optional - for discoverable credentials
}

export interface InitiatePasskeyLoginOutput {
  loginToken: string;
  options: unknown; // WebAuthn authentication options
}

export interface CompletePasskeyLoginInput {
  loginToken: string;
  response: unknown; // WebAuthn response from client
  deviceInfo: {
    userAgent: string;
    ip: string;
  };
}

export interface CompletePasskeyLoginOutput {
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

export interface PasskeyLoginDeps {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  passkey: PasskeyPort;
  jwt: JWTPort;
  cache: CachePort;
  logger: LoggerPort;
  config: {
    rpId: string;
    rpOrigin: string;
    challengeTTL: number;
    sessionDurationSeconds: number;
    jwtIssuer: string;
    jwtAudience: string;
  };
}

// ============================================
// Use Case: Initiate Passkey Login
// ============================================

export const initiatePasskeyLogin =
  (deps: PasskeyLoginDeps) =>
  async (input: InitiatePasskeyLoginInput): Promise<Result<InitiatePasskeyLoginOutput, DomainError>> => {
    const { userRepository, passkey, cache, logger, config } = deps;

    logger.info("Initiating passkey login", { email: input.email });

    let allowCredentials: Array<{ id: string; type: string; transports?: string[] }> | undefined;

    // If email is provided, get the user's passkey credentials
    if (input.email) {
      const userResult = await userRepository.findByEmail(input.email as any);
      if (userResult.isOk() && userResult.value) {
        allowCredentials = userResult.value.passkeyCredentials.map((c) => ({
          id: c.id,
          type: "public-key",
          transports: c.transports,
        }));
      }
    }

    // Generate authentication options
    const optionsResult = await passkey.generateAuthenticationOptions({
      rpId: config.rpId,
      allowCredentials,
    });

    if (optionsResult.isErr()) {
      return err(optionsResult.error);
    }

    // Generate login token
    const loginToken = generateId();

    // Store challenge
    const cacheResult = await cache.set(
      `passkey_auth:${loginToken}`,
      {
        challenge: optionsResult.value.challenge,
        email: input.email,
        createdAt: Date.now(),
      },
      config.challengeTTL
    );

    if (cacheResult.isErr()) {
      return err(cacheResult.error);
    }

    logger.info("Passkey login initiated", { loginToken });

    return ok({
      loginToken,
      options: optionsResult.value,
    });
  };

// ============================================
// Use Case: Complete Passkey Login
// ============================================

export const completePasskeyLogin =
  (deps: PasskeyLoginDeps) =>
  async (input: CompletePasskeyLoginInput): Promise<Result<CompletePasskeyLoginOutput, DomainError>> => {
    const { userRepository, sessionRepository, passkey, jwt, cache, logger, config } = deps;

    logger.info("Completing passkey login", { loginToken: input.loginToken.substring(0, 10) + "..." });

    // Get challenge
    const challengeResult = await cache.get<{
      challenge: string;
      email?: string;
    }>(`passkey_auth:${input.loginToken}`);

    if (challengeResult.isErr()) {
      return err(challengeResult.error);
    }

    if (!challengeResult.value) {
      logger.warn("Invalid or expired passkey login token");
      return err(AuthErrors.INVALID_CREDENTIALS());
    }

    const { challenge } = challengeResult.value;

    // Extract credential ID from response (implementation depends on WebAuthn library)
    const responseObj = input.response as { id?: string; rawId?: string };
    const credentialId = responseObj.id || responseObj.rawId;

    if (!credentialId) {
      logger.warn("No credential ID in passkey response");
      return err(AuthErrors.PASSKEY_INVALID());
    }

    // Find user by passkey credential
    const credentialResult = await userRepository.findPasskeyCredential(credentialId);
    if (credentialResult.isErr()) {
      return err(credentialResult.error);
    }

    if (!credentialResult.value) {
      logger.warn("Passkey credential not found", { credentialId });
      return err(AuthErrors.PASSKEY_INVALID());
    }

    const { user, credential } = credentialResult.value;

    // Verify passkey response
    const verifyResult = await passkey.verifyAuthentication({
      expectedChallenge: challenge,
      expectedOrigin: config.rpOrigin,
      expectedRPID: config.rpId,
      credential: {
        id: credential.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
      },
      response: input.response,
    });

    if (verifyResult.isErr()) {
      logger.warn("Passkey verification failed", { userId: user.id });
      return err(AuthErrors.PASSKEY_CHALLENGE_FAILED());
    }

    // Clean up challenge
    await cache.delete(`passkey_auth:${input.loginToken}`);

    // Update credential counter
    const updatedCredential = updatePasskeyCounter(credential, verifyResult.value.newCounter);
    await userRepository.updatePasskeyCredential(user.id, updatedCredential);

    // Create session
    const sessionId = generateSessionId();
    const session = createSession({
      id: sessionId,
      userId: user.id,
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
    await userRepository.update(recordLogin(user));

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

    logger.info("Passkey login completed", { userId: user.id, sessionId });

    return ok({
      accessToken: jwtResult.value,
      sessionId,
      expiresAt: session.expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email.value,
        firstName: user.name.firstName,
        lastName: user.name.lastName,
      },
    });
  };
