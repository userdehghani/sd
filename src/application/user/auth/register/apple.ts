/**
 * Use Case: user.auth.register.apple
 * Register user with Apple OAuth
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

export interface InitiateAppleAuthInput {
  redirectUri: string;
}

export interface InitiateAppleAuthOutput {
  authorizationUrl: string;
  state: string;
}

export interface CompleteAppleRegistrationInput {
  code: string;
  state: string;
  redirectUri: string;
  // Apple provides user info only on first authorization
  user?: {
    email?: string;
    name?: {
      firstName?: string;
      lastName?: string;
    };
  };
}

export interface CompleteAppleRegistrationOutput {
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

export interface AppleRegistrationDeps {
  userRepository: UserRepository;
  appleOAuth: OAuthPort;
  cache: CachePort;
  email: EmailPort;
  logger: LoggerPort;
  config: {
    oauthStateTTL: number;
  };
}

// ============================================
// Use Case: Initiate Apple Auth
// ============================================

export const initiateAppleAuth =
  (deps: AppleRegistrationDeps) =>
  async (input: InitiateAppleAuthInput): Promise<Result<InitiateAppleAuthOutput, DomainError>> => {
    const { appleOAuth, cache, logger, config } = deps;

    logger.info("Initiating Apple OAuth", { redirectUri: input.redirectUri });

    // Generate state for CSRF protection
    const state = generateId();

    // Store state in cache
    const cacheResult = await cache.set(
      `oauth_state:apple:${state}`,
      { redirectUri: input.redirectUri, createdAt: Date.now() },
      config.oauthStateTTL
    );

    if (cacheResult.isErr()) {
      return err(cacheResult.error);
    }

    // Get authorization URL
    const authorizationUrl = appleOAuth.getAuthorizationUrl(state, input.redirectUri);

    logger.info("Apple OAuth URL generated", { state });

    return ok({
      authorizationUrl,
      state,
    });
  };

// ============================================
// Use Case: Complete Apple Registration
// ============================================

export const completeAppleRegistration =
  (deps: AppleRegistrationDeps) =>
  async (input: CompleteAppleRegistrationInput): Promise<Result<CompleteAppleRegistrationOutput, DomainError>> => {
    const { userRepository, appleOAuth, cache, email, logger } = deps;

    logger.info("Completing Apple registration", { state: input.state });

    // Verify state
    const stateResult = await cache.get<{ redirectUri: string }>(
      `oauth_state:apple:${input.state}`
    );

    if (stateResult.isErr()) {
      return err(stateResult.error);
    }

    if (!stateResult.value) {
      logger.warn("Invalid OAuth state", { state: input.state });
      return err(AuthErrors.OAUTH_INVALID_STATE());
    }

    // Exchange code for tokens
    const tokenResult = await appleOAuth.exchangeCodeForToken(
      input.code,
      input.redirectUri
    );

    if (tokenResult.isErr()) {
      return err(tokenResult.error);
    }

    // Get user info from token (Apple embeds it in the ID token)
    const userInfoResult = await appleOAuth.getUserInfo(tokenResult.value.idToken || tokenResult.value.accessToken);

    if (userInfoResult.isErr()) {
      return err(userInfoResult.error);
    }

    const userInfo = userInfoResult.value;

    // Clean up state
    await cache.delete(`oauth_state:apple:${input.state}`);

    // Check if user exists by Apple provider ID
    const existingByProvider = await userRepository.findByAuthProvider("apple", userInfo.id);
    if (existingByProvider.isErr()) {
      return err(existingByProvider.error);
    }

    if (existingByProvider.value) {
      // Existing user - return login info
      logger.info("Existing user logging in via Apple", { userId: existingByProvider.value.id });
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

    // Use email from user info or from Apple's first-time user data
    const userEmail = userInfo.email || input.user?.email;
    if (!userEmail) {
      logger.error("No email provided by Apple", { appleUserId: userInfo.id });
      return err(UserErrors.INVALID_EMAIL(""));
    }

    // Check if email already exists
    const emailVO = createEmail(userEmail, userInfo.emailVerified, userInfo.emailVerified ? new Date() : undefined);
    if (emailVO.isErr()) {
      return err(emailVO.error);
    }

    const existingByEmail = await userRepository.findByEmail(emailVO.value.value);
    if (existingByEmail.isErr()) {
      return err(existingByEmail.error);
    }

    if (existingByEmail.value) {
      logger.warn("Email already registered with different provider", { email: userEmail });
      return err(UserErrors.ALREADY_EXISTS(userEmail));
    }

    // Get name from Apple's first-time user data or use defaults
    const firstName = input.user?.name?.firstName || userInfo.name?.split(" ")[0] || "User";
    const lastName = input.user?.name?.lastName || userInfo.name?.split(" ").slice(1).join(" ") || "User";

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
      authProvider: createAuthProvider("apple", userInfo.id, userEmail),
    });

    const createResult = await userRepository.create(user);
    if (createResult.isErr()) {
      return err(createResult.error);
    }

    // Send welcome email
    await email.send({
      to: userEmail,
      subject: "Welcome! Your account has been created",
      template: {
        id: "welcome",
        data: { firstName },
      },
    });

    logger.info("Apple registration completed", { userId });

    return ok({
      user: {
        id: userId,
        email: userEmail,
        firstName,
        lastName,
      },
      isNewUser: true,
    });
  };
