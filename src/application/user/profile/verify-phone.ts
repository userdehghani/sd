/**
 * Use Case: user.profile.verify.phone
 * Verify user phone number
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
  updateUserPhone,
  verifyPhone,
  createPhone,
} from "../../../domain/user";
import type { CachePort, SMSPort, LoggerPort } from "../../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface SetPhoneInput {
  userId: string;
  phone: string;
}

export interface SetPhoneOutput {
  sent: boolean;
  expiresInSeconds: number;
}

export interface VerifyPhoneInput {
  userId: string;
  code: string;
}

export interface VerifyPhoneOutput {
  verified: boolean;
}

// ============================================
// Dependencies
// ============================================

export interface PhoneVerificationDeps {
  userRepository: UserRepository;
  cache: CachePort;
  sms: SMSPort;
  logger: LoggerPort;
  config: {
    verificationCodeTTL: number;
    maxVerificationAttempts: number;
  };
}

// ============================================
// Use Case: Set Phone and Send Verification
// ============================================

export const setPhoneAndSendVerification =
  (deps: PhoneVerificationDeps) =>
  async (input: SetPhoneInput): Promise<Result<SetPhoneOutput, DomainError>> => {
    const { userRepository, cache, sms, logger, config } = deps;

    logger.info("Setting phone and sending verification", { userId: input.userId });

    // Validate phone number
    const phoneResult = createPhone(input.phone);
    if (phoneResult.isErr()) {
      return err(phoneResult.error);
    }

    // Get user
    const userResult = await userRepository.findById(input.userId as UUID);
    if (userResult.isErr()) {
      return err(userResult.error);
    }

    if (!userResult.value) {
      return err(UserErrors.NOT_FOUND(input.userId));
    }

    const user = userResult.value;

    // Check if same phone is already verified
    if (user.phone?.value === phoneResult.value.value && user.phone.isVerified) {
      logger.info("Phone already verified", { userId: input.userId });
      return err(VerificationErrors.ALREADY_VERIFIED("phone"));
    }

    // Generate verification code
    const code = generateVerificationCode(6);

    // Store in cache
    const cacheResult = await cache.set(
      `phone_verification:${input.userId}`,
      {
        code,
        phone: phoneResult.value.value,
        attempts: 0,
        createdAt: Date.now(),
      },
      config.verificationCodeTTL
    );

    if (cacheResult.isErr()) {
      return err(cacheResult.error);
    }

    // Update user with unverified phone
    const updatedUser = updateUserPhone(user, phoneResult.value);
    await userRepository.update(updatedUser);

    // Send verification SMS
    const smsResult = await sms.send({
      to: phoneResult.value.value,
      message: `Your verification code is: ${code}. It expires in ${Math.floor(config.verificationCodeTTL / 60)} minutes.`,
    });

    if (smsResult.isErr()) {
      logger.error("Failed to send verification SMS", smsResult.error, { userId: input.userId });
      return err(smsResult.error);
    }

    logger.info("Phone verification SMS sent", { userId: input.userId });

    return ok({
      sent: true,
      expiresInSeconds: config.verificationCodeTTL,
    });
  };

// ============================================
// Use Case: Verify Phone
// ============================================

export const verifyUserPhone =
  (deps: PhoneVerificationDeps) =>
  async (input: VerifyPhoneInput): Promise<Result<VerifyPhoneOutput, DomainError>> => {
    const { userRepository, cache, logger, config } = deps;

    logger.info("Verifying phone", { userId: input.userId });

    // Get verification data
    const cacheKey = `phone_verification:${input.userId}`;
    const verificationResult = await cache.get<{
      code: string;
      phone: string;
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

    // Get user and update phone verification status
    const userResult = await userRepository.findById(input.userId as UUID);
    if (userResult.isErr()) {
      return err(userResult.error);
    }

    if (!userResult.value) {
      return err(UserErrors.NOT_FOUND(input.userId));
    }

    const user = userResult.value;

    if (!user.phone) {
      logger.warn("No phone set for user", { userId: input.userId });
      return err(VerificationErrors.CODE_EXPIRED());
    }

    const updatedUser = updateUserPhone(user, verifyPhone(user.phone));

    const updateResult = await userRepository.update(updatedUser);
    if (updateResult.isErr()) {
      return err(updateResult.error);
    }

    // Clean up
    await cache.delete(cacheKey);

    logger.info("Phone verified successfully", { userId: input.userId });

    return ok({ verified: true });
  };
