/**
 * Use Case: user.auth.register.google
 * Register user with Google OAuth
 */

import {
  type Result,
  type DomainError,
  ok,
  err,
  UserErrors,
  AuthErrors,
  generateId,
  type UUID,
} from "../../../../core";
import {
  type User,
  type UserRepository,
  createUser,
  createEmail,
  createName,
  createAuthProvider,
} from "../../../../domain/user";
import type { OAuthPort, CachePort, EmailPort, LoggerPort } from "../../../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface InitiateGoogleAuthInput {
  redirectUri: string;
}

export interface InitiateGoogleAuthOutput {
  authorizationUrl: string;
  state: string;
}

export interface CompleteGoogleRegistrationInput {
  code: string;
  state: string;
  redirectUri: string;
}

export interface CompleteGoogleRegistrationOutput {
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

export interface GoogleRegistrationDeps {
  userRepository: UserRepository;
  googleOAuth: OAuthPort;
  cache: CachePort;
  email: EmailPort;
  logger: LoggerPort;
  config: {
    oauthStateTTL: number;
  };
}

// ============================================
// Use Case: Initiate Google Auth
// ============================================

export const initiateGoogleAuth =
  (deps: GoogleRegistrationDeps) =>
  async (input: InitiateGoogleAuthInput): Promise<Result<InitiateGoogleAuthOutput, DomainError>> => {
    const { googleOAuth, cache, logger, config } = deps;

    logger.info("Initiating Google OAuth", { redirectUri: input.redirectUri });

    // Generate state for CSRF protection
    const state = generateId();

    // Store state in cache
    const cacheResult = await cache.set(
      `oauth_state:${state}`,
      { redirectUri: input.redirectUri, createdAt: Date.now() },
      config.oauthStateTTL
    );

    if (cacheResult.isErr()) {
      return err(cacheResult.error);
    }

    // Get authorization URL
    const authorizationUrl = googleOAuth.getAuthorizationUrl(state, input.redirectUri);

    logger.info("Google OAuth URL generated", { state });

    return ok({
      authorizationUrl,
      state,
    });
  };

// ============================================
// Use Case: Complete Google Registration
// ============================================

export const completeGoogleRegistration =
  (deps: GoogleRegistrationDeps) =>
  async (input: CompleteGoogleRegistrationInput): Promise<Result<CompleteGoogleRegistrationOutput, DomainError>> => {
    const { userRepository, googleOAuth, cache, email, logger } = deps;

    logger.info("Completing Google registration", { state: input.state });

    // Verify state
    const stateResult = await cache.get<{ redirectUri: string }>(
      `oauth_state:${input.state}`
    );

    if (stateResult.isErr()) {
      return err(stateResult.error);
    }

    if (!stateResult.value) {
      logger.warn("Invalid OAuth state", { state: input.state });
      return err(AuthErrors.OAUTH_INVALID_STATE());
    }

    // Exchange code for tokens
    const tokenResult = await googleOAuth.exchangeCodeForToken(
      input.code,
      input.redirectUri
    );

    if (tokenResult.isErr()) {
      return err(tokenResult.error);
    }

    // Get user info
    const userInfoResult = await googleOAuth.getUserInfo(tokenResult.value.accessToken);

    if (userInfoResult.isErr()) {
      return err(userInfoResult.error);
    }

    const userInfo = userInfoResult.value;

    // Clean up state
    await cache.delete(`oauth_state:${input.state}`);

    // Check if user exists by Google provider ID
    const existingByProvider = await userRepository.findByAuthProvider("google", userInfo.id);
    if (existingByProvider.isErr()) {
      return err(existingByProvider.error);
    }

    if (existingByProvider.value) {
      // Existing user - return login info
      logger.info("Existing user logging in via Google", { userId: existingByProvider.value.id });
      return ok({
        user: {
          id: existingByProvider.value.id,
          email: existingByProvider.value.email.value,
          firstName: existingByProvider.value.name.firstName,
          lastName: existingByProvider.value.name.lastName,
        },
        isNewUser: false,
      });
    }

    // Check if email already exists
    const emailVO = createEmail(userInfo.email, userInfo.emailVerified, userInfo.emailVerified ? new Date() : undefined);
    if (emailVO.isErr()) {
      return err(emailVO.error);
    }

    const existingByEmail = await userRepository.findByEmail(emailVO.value.value);
    if (existingByEmail.isErr()) {
      return err(existingByEmail.error);
    }

    if (existingByEmail.value) {
      // Email exists but with different provider - could link or reject
      logger.warn("Email already registered with different provider", { email: userInfo.email });
      return err(UserErrors.ALREADY_EXISTS(userInfo.email));
    }

    // Parse name from Google
    const nameParts = (userInfo.name || "User").split(" ");
    const firstName = nameParts[0] || "User";
    const lastName = nameParts.slice(1).join(" ") || "User";

    const nameResult = createName(firstName, lastName);
    if (nameResult.isErr()) {
      return err(nameResult.error);
    }

    // Create new user
    const userId = generateId();
    const user = createUser({
      id: userId,
      email: emailVO.value,
      name: nameResult.value,
      authProvider: createAuthProvider("google", userInfo.id, userInfo.email, {
        picture: userInfo.picture,
      }),
    });

    const createResult = await userRepository.create(user);
    if (createResult.isErr()) {
      return err(createResult.error);
    }

    // Send welcome email
    await email.send({
      to: userInfo.email,
      subject: "Welcome! Your account has been created",
      template: {
        id: "welcome",
        data: { firstName },
      },
    });

    logger.info("Google registration completed", { userId });

    return ok({
      user: {
        id: userId,
        email: userInfo.email,
        firstName,
        lastName,
      },
      isNewUser: true,
    });
  };
