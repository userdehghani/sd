/**
 * Use Case: user.profile.verify.email
 * Verify user email address
 */

import {
  type Result,
  type DomainError,
  ok,
  err,
  UserErrors,
  VerificationErrors,
  generateVerificationCode,
  type UUID,
} from "../../../core";
import {
  type User,
  type UserRepository,
  updateUserEmail,
  verifyEmail,
} from "../../../domain/user";
import type { CachePort, EmailPort, LoggerPort } from "../../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface SendEmailVerificationInput {
  userId: string;
}

export interface SendEmailVerificationOutput {
  sent: boolean;
  expiresInSeconds: number;
}

export interface VerifyEmailInput {
  userId: string;
  code: string;
}

export interface VerifyEmailOutput {
  verified: boolean;
}

// ============================================
// Dependencies
// ============================================

export interface EmailVerificationDeps {
  userRepository: UserRepository;
  cache: CachePort;
  email: EmailPort;
  logger: LoggerPort;
  config: {
    verificationCodeTTL: number;
    maxVerificationAttempts: number;
  };
}

// ============================================
// Use Case: Send Email Verification
// ============================================

export const sendEmailVerification =
  (deps: EmailVerificationDeps) =>
  async (input: SendEmailVerificationInput): Promise<Result<SendEmailVerificationOutput, DomainError>> => {
    const { userRepository, cache, email, logger, config } = deps;

    logger.info("Sending email verification", { userId: input.userId });

    // Get user
    const userResult = await userRepository.findById(input.userId as UUID);
    if (userResult.isErr()) {
      return err(userResult.error);
    }

    if (!userResult.value) {
      return err(UserErrors.NOT_FOUND(input.userId));
    }

    const user = userResult.value;

    // Check if already verified
    if (user.email.isVerified) {
      logger.info("Email already verified", { userId: input.userId });
      return err(VerificationErrors.ALREADY_VERIFIED("email"));
    }

    // Generate verification code
    const code = generateVerificationCode(6);

    // Store in cache
    const cacheResult = await cache.set(
      `email_verification:${input.userId}`,
      {
        code,
        email: user.email.value,
        attempts: 0,
        createdAt: Date.now(),
      },
      config.verificationCodeTTL
    );

    if (cacheResult.isErr()) {
      return err(cacheResult.error);
    }

    // Send verification email
    const emailResult = await email.send({
      to: user.email.value,
      subject: "Verify your email address",
      template: {
        id: "email-verification",
        data: {
          code,
          firstName: user.name.firstName,
          expiresInMinutes: Math.floor(config.verificationCodeTTL / 60),
        },
      },
    });

    if (emailResult.isErr()) {
      logger.error("Failed to send verification email", emailResult.error, { userId: input.userId });
      return err(emailResult.error);
    }

    logger.info("Email verification sent", { userId: input.userId });

    return ok({
      sent: true,
      expiresInSeconds: config.verificationCodeTTL,
    });
  };

// ============================================
// Use Case: Verify Email
// ============================================

export const verifyUserEmail =
  (deps: EmailVerificationDeps) =>
  async (input: VerifyEmailInput): Promise<Result<VerifyEmailOutput, DomainError>> => {
    const { userRepository, cache, logger, config } = deps;

    logger.info("Verifying email", { userId: input.userId });

    // Get verification data
    const cacheKey = `email_verification:${input.userId}`;
    const verificationResult = await cache.get<{
      code: string;
      email: string;
      attempts: number;
    }>(cacheKey);

    if (verificationResult.isErr()) {
      return err(verificationResult.error);
    }

    if (!verificationResult.value) {
      logger.warn("Verification code expired or not found", { userId: input.userId });
      return err(VerificationErrors.CODE_EXPIRED());
    }

    const verification = verificationResult.value;

    // Check attempts
    if (verification.attempts >= config.maxVerificationAttempts) {
      await cache.delete(cacheKey);
      logger.warn("Too many verification attempts", { userId: input.userId });
      return err(VerificationErrors.TOO_MANY_ATTEMPTS());
    }

    // Verify code
    if (verification.code !== input.code) {
      // Increment attempts
      await cache.set(
        cacheKey,
        { ...verification, attempts: verification.attempts + 1 },
        config.verificationCodeTTL
      );
      logger.warn("Invalid verification code", { userId: input.userId });
      return err(VerificationErrors.CODE_INVALID());
    }

    // Get user and update email verification status
    const userResult = await userRepository.findById(input.userId as UUID);
    if (userResult.isErr()) {
      return err(userResult.error);
    }

    if (!userResult.value) {
      return err(UserErrors.NOT_FOUND(input.userId));
    }

    const user = userResult.value;
    const updatedUser = updateUserEmail(user, verifyEmail(user.email));

    const updateResult = await userRepository.update(updatedUser);
    if (updateResult.isErr()) {
      return err(updateResult.error);
    }

    // Clean up
    await cache.delete(cacheKey);

    logger.info("Email verified successfully", { userId: input.userId });

    return ok({ verified: true });
  };
