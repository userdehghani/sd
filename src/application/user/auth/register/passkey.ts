/**
 * Use Case: user.auth.register.passkey
 * Register user with Passkey (WebAuthn)
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
  addPasskeyCredential,
  createPasskeyCredential,
} from "../../../../domain/user";
import type { PasskeyPort, CachePort, EmailPort, LoggerPort } from "../../../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface InitiatePasskeyRegistrationInput {
  email: string;
  firstName: string;
  lastName: string;
}

export interface InitiatePasskeyRegistrationOutput {
  userId: string;
  options: unknown; // WebAuthn registration options
}

export interface CompletePasskeyRegistrationInput {
  userId: string;
  response: unknown; // WebAuthn response from client
}

export interface CompletePasskeyRegistrationOutput {
  success: boolean;
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

export interface PasskeyRegistrationDeps {
  userRepository: UserRepository;
  passkey: PasskeyPort;
  cache: CachePort;
  email: EmailPort;
  logger: LoggerPort;
  config: {
    rpId: string;
    rpName: string;
    rpOrigin: string;
    challengeTTL: number;
  };
}

// ============================================
// Use Case: Initiate Passkey Registration
// ============================================

export const initiatePasskeyRegistration =
  (deps: PasskeyRegistrationDeps) =>
  async (input: InitiatePasskeyRegistrationInput): Promise<Result<InitiatePasskeyRegistrationOutput, DomainError>> => {
    const { userRepository, passkey, cache, logger, config } = deps;

    logger.info("Initiating passkey registration", { email: input.email });

    // Validate email
    const emailResult = createEmail(input.email);
    if (emailResult.isErr()) {
      return err(emailResult.error);
    }

    // Check if user already exists
    const existingUser = await userRepository.findByEmail(emailResult.value.value);
    if (existingUser.isErr()) {
      return err(existingUser.error);
    }

    if (existingUser.value) {
      logger.warn("Registration attempt for existing email", { email: input.email });
      return err(UserErrors.ALREADY_EXISTS(input.email));
    }

    // Validate name
    const nameResult = createName(input.firstName, input.lastName);
    if (nameResult.isErr()) {
      return err(nameResult.error);
    }

    // Generate user ID
    const userId = generateId();

    // Generate passkey registration options
    const optionsResult = await passkey.generateRegistrationOptions({
      userId,
      userEmail: input.email,
      userName: `${input.firstName} ${input.lastName}`,
      rpId: config.rpId,
      rpName: config.rpName,
    });

    if (optionsResult.isErr()) {
      return err(optionsResult.error);
    }

    // Store pending registration with challenge
    const pendingData = {
      userId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      challenge: optionsResult.value.challenge,
      createdAt: Date.now(),
    };

    const cacheResult = await cache.set(
      `passkey_registration:${userId}`,
      pendingData,
      config.challengeTTL
    );

    if (cacheResult.isErr()) {
      return err(cacheResult.error);
    }

    logger.info("Passkey registration initiated", { userId });

    return ok({
      userId,
      options: optionsResult.value,
    });
  };

// ============================================
// Use Case: Complete Passkey Registration
// ============================================

export const completePasskeyRegistration =
  (deps: PasskeyRegistrationDeps) =>
  async (input: CompletePasskeyRegistrationInput): Promise<Result<CompletePasskeyRegistrationOutput, DomainError>> => {
    const { userRepository, passkey, cache, email, logger, config } = deps;

    logger.info("Completing passkey registration", { userId: input.userId });

    // Get pending registration
    const cacheKey = `passkey_registration:${input.userId}`;
    const pendingResult = await cache.get<{
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      challenge: string;
    }>(cacheKey);

    if (pendingResult.isErr()) {
      return err(pendingResult.error);
    }

    if (!pendingResult.value) {
      logger.warn("Pending registration not found", { userId: input.userId });
      return err(UserErrors.NOT_FOUND(input.userId));
    }

    const pending = pendingResult.value;

    // Verify passkey response
    const verifyResult = await passkey.verifyRegistration({
      expectedChallenge: pending.challenge,
      expectedOrigin: config.rpOrigin,
      expectedRPID: config.rpId,
      response: input.response,
    });

    if (verifyResult.isErr()) {
      logger.warn("Passkey verification failed", { userId: input.userId });
      return err(AuthErrors.PASSKEY_CHALLENGE_FAILED());
    }

    const credential = verifyResult.value;

    // Create email value object
    const emailResult = createEmail(pending.email, true, new Date());
    if (emailResult.isErr()) {
      return err(emailResult.error);
    }

    // Create name value object
    const nameResult = createName(pending.firstName, pending.lastName);
    if (nameResult.isErr()) {
      return err(nameResult.error);
    }

    // Create user
    let user = createUser({
      id: pending.userId as UUID,
      email: emailResult.value,
      name: nameResult.value,
      authProvider: createAuthProvider("passkey", credential.id),
    });

    // Add passkey credential
    user = addPasskeyCredential(
      user,
      createPasskeyCredential(
        credential.id,
        credential.publicKey,
        credential.counter,
        credential.deviceType,
        credential.backedUp,
        credential.transports
      )
    );

    // Save user
    const createResult = await userRepository.create(user);
    if (createResult.isErr()) {
      return err(createResult.error);
    }

    // Clean up pending registration
    await cache.delete(cacheKey);

    // Send welcome email
    await email.send({
      to: pending.email,
      subject: "Welcome! Your account has been created",
      template: {
        id: "welcome",
        data: { firstName: pending.firstName },
      },
    });

    logger.info("Passkey registration completed", { userId: input.userId });

    return ok({
      success: true,
      user: {
        id: pending.userId,
        email: pending.email,
        firstName: pending.firstName,
        lastName: pending.lastName,
      },
    });
  };
