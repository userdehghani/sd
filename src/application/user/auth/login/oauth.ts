/**
 * Use Case: user.auth.login.oauth
 * Login with OAuth (Google/Apple)
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
import { type User, type UserRepository, recordLogin, type AuthProviderType } from "../../../../domain/user";
import {
  type Session,
  type SessionRepository,
  createSession,
  createDeviceInfo,
} from "../../../../domain/session";
import type { OAuthPort, JWTPort, CachePort, LoggerPort } from "../../../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface OAuthLoginInput {
  provider: "google" | "apple";
  code: string;
  state: string;
  redirectUri: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
  };
}

export interface OAuthLoginOutput {
  accessToken: string;
  sessionId: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  isNewUser: boolean;
}

// ============================================
// Dependencies
// ============================================

export interface OAuthLoginDeps {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  oauthProviders: {
    google: OAuthPort;
    apple: OAuthPort;
  };
  jwt: JWTPort;
  cache: CachePort;
  logger: LoggerPort;
  config: {
    sessionDurationSeconds: number;
    jwtIssuer: string;
    jwtAudience: string;
  };
}

// ============================================
// Use Case: OAuth Login
// ============================================

export const oauthLogin =
  (deps: OAuthLoginDeps) =>
  async (input: OAuthLoginInput): Promise<Result<OAuthLoginOutput, DomainError>> => {
    const { userRepository, sessionRepository, oauthProviders, jwt, cache, logger, config } = deps;

    logger.info("Processing OAuth login", { provider: input.provider });

    // Verify state
    const stateKey = input.provider === "apple" 
      ? `oauth_state:apple:${input.state}`
      : `oauth_state:${input.state}`;
    
    const stateResult = await cache.get<{ redirectUri: string }>(stateKey);

    if (stateResult.isErr()) {
      return err(stateResult.error);
    }

    if (!stateResult.value) {
      logger.warn("Invalid OAuth state", { state: input.state, provider: input.provider });
      return err(AuthErrors.OAUTH_INVALID_STATE());
    }

    // Clean up state
    await cache.delete(stateKey);

    // Get OAuth provider
    const oauthProvider = oauthProviders[input.provider];

    // Exchange code for tokens
    const tokenResult = await oauthProvider.exchangeCodeForToken(
      input.code,
      input.redirectUri
    );

    if (tokenResult.isErr()) {
      logger.error("OAuth token exchange failed", tokenResult.error, { provider: input.provider });
      return err(AuthErrors.OAUTH_TOKEN_EXCHANGE_FAILED(input.provider));
    }

    // Get user info
    const userInfoResult = await oauthProvider.getUserInfo(
      tokenResult.value.idToken || tokenResult.value.accessToken
    );

    if (userInfoResult.isErr()) {
      return err(userInfoResult.error);
    }

    const userInfo = userInfoResult.value;

    // Find user by provider
    const existingUser = await userRepository.findByAuthProvider(
      input.provider as AuthProviderType,
      userInfo.id
    );

    if (existingUser.isErr()) {
      return err(existingUser.error);
    }

    if (!existingUser.value) {
      // User not found - this is a registration flow, not login
      logger.warn("OAuth login for non-existent user", { 
        provider: input.provider, 
        providerId: userInfo.id 
      });
      return err(UserErrors.NOT_FOUND(userInfo.id));
    }

    const user = existingUser.value;

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

    logger.info("OAuth login completed", { 
      userId: user.id, 
      sessionId, 
      provider: input.provider 
    });

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
      isNewUser: false,
    });
  };
