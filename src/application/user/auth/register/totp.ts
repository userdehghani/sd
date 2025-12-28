/**
 * Use Case: user.auth.register.totp
 * Register user with Email + TOTP
 */

import {
  type Result,
  type DomainError,
  ok,
  err,
  UserErrors,
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
import type { CachePort, TOTPPort, EmailPort, LoggerPort } from "../../../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface RegisterTOTPInput {
  email: string;
  firstName: string;
  lastName: string;
}

export interface RegisterTOTPOutput {
  userId: string;
  totpSecret: string;
  totpQRCodeUrl: string;
}

export interface VerifyTOTPRegistrationInput {
  userId: string;
  code: string;
}

export interface VerifyTOTPRegistrationOutput {
  success: boolean;
}

// ============================================
// Dependencies
// ============================================

export interface RegisterTOTPDeps {
  userRepository: UserRepository;
  cache: CachePort;
  totp: TOTPPort;
  email: EmailPort;
  logger: LoggerPort;
  config: {
    totpIssuer: string;
    pendingRegistrationTTL: number;
  };
}

// ============================================
// Use Case: Initiate TOTP Registration
// ============================================

export const initiateTOTPRegistration =
  (deps: RegisterTOTPDeps) =>
  async (input: RegisterTOTPInput): Promise<Result<RegisterTOTPOutput, DomainError>> => {
    const { userRepository, cache, totp, email, logger, config } = deps;

    logger.info("Initiating TOTP registration", { email: input.email });

    // Check if user already exists
    const emailResult = createEmail(input.email);
    if (emailResult.isErr()) {
      return err(emailResult.error);
    }

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

    // Generate TOTP secret
    const totpSecret = totp.generateSecret();
    const userId = generateId();

    // Store pending registration
    const pendingData = {
      userId,
      email: emailResult.value.value,
      firstName: input.firstName,
      lastName: input.lastName,
      totpSecret,
      createdAt: Date.now(),
    };

    const cacheResult = await cache.set(
      `pending_registration:${userId}`,
      pendingData,
      config.pendingRegistrationTTL
    );

    if (cacheResult.isErr()) {
      return err(cacheResult.error);
    }

    // Generate QR code URL
    const qrCodeUrl = totp.generateQRCodeUrl(
      totpSecret,
      input.email,
      config.totpIssuer
    );

    logger.info("TOTP registration initiated", { userId });

    return ok({
      userId,
      totpSecret,
      totpQRCodeUrl: qrCodeUrl,
    });
  };

// ============================================
// Use Case: Verify TOTP Registration
// ============================================

export const verifyTOTPRegistration =
  (deps: RegisterTOTPDeps) =>
  async (input: VerifyTOTPRegistrationInput): Promise<Result<VerifyTOTPRegistrationOutput, DomainError>> => {
    const { userRepository, cache, totp, email, logger } = deps;

    logger.info("Verifying TOTP registration", { userId: input.userId });

    // Get pending registration
    const cacheKey = `pending_registration:${input.userId}`;
    const pendingResult = await cache.get<{
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      totpSecret: string;
    }>(cacheKey);

    if (pendingResult.isErr()) {
      return err(pendingResult.error);
    }

    if (!pendingResult.value) {
      logger.warn("Pending registration not found", { userId: input.userId });
      return err(UserErrors.NOT_FOUND(input.userId));
    }

    const pending = pendingResult.value;

    // Verify TOTP code
    const isValid = totp.verify(pending.totpSecret, input.code);
    if (!isValid) {
      logger.warn("Invalid TOTP code during registration", { userId: input.userId });
      return ok({ success: false });
    }

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
    const user = createUser({
      id: pending.userId as UUID,
      email: emailResult.value,
      name: nameResult.value,
      authProvider: createAuthProvider("email", pending.email),
    });

    // Enable TOTP on user
    const userWithTotp = {
      ...user,
      totpEnabled: true,
      totpSecret: pending.totpSecret,
    };

    // Save user
    const createResult = await userRepository.create(userWithTotp);
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

    logger.info("TOTP registration completed", { userId: input.userId });

    return ok({ success: true });
  };
