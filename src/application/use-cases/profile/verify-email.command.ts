/**
 * Verify Email Command
 */

import { User } from "../../../domain/entities/user.entity";
import { UserId } from "../../../domain/value-objects/user-id.vo";
import { IUserRepository } from "../../ports/repositories/user.repository";
import { ICacheService } from "../../ports/services/cache.service";
import { IEventBusService } from "../../ports/services/event-bus.service";
import { EmailVerifiedEvent } from "../../../domain/events/domain-event";
import { AsyncResult, Err } from "../../../shared/result";
import { DomainError, NotFoundError, ValidationError, ErrorCode } from "../../../shared/errors";
import { logger } from "../../../logger";

export interface VerifyEmailInput {
  userId: string;
  code: string;
}

export class VerifyEmailCommand {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cacheService: ICacheService,
    private readonly eventBus: IEventBusService
  ) {}

  async execute(input: VerifyEmailInput): AsyncResult<User, DomainError> {
    logger.info("Executing VerifyEmailCommand", { userId: input.userId });

    const userId = UserId.fromString(input.userId);

    // Find user
    const userResult = await this.userRepository.findById(userId);
    if (!userResult.success) {
      logger.error("Error finding user", { error: userResult.error });
      return userResult;
    }
    if (!userResult.value) {
      logger.warn("User not found", { userId: input.userId });
      return Err(new NotFoundError("User not found"));
    }
    const user = userResult.value;

    // Get verification code from cache
    const cacheKey = `email_verification:${input.userId}`;
    const storedCodeResult = await this.cacheService.getVerificationCode(cacheKey);
    if (!storedCodeResult.success) {
      logger.error("Error getting verification code", { error: storedCodeResult.error });
      return storedCodeResult;
    }
    if (!storedCodeResult.value) {
      logger.warn("Verification code not found or expired", { userId: input.userId });
      return Err(
        new ValidationError("Verification code not found or expired", {
          code: ErrorCode.VERIFICATION_CODE_EXPIRED,
        })
      );
    }

    // Verify code
    if (storedCodeResult.value !== input.code) {
      logger.warn("Invalid verification code", { userId: input.userId });
      return Err(
        new ValidationError("Invalid verification code", {
          code: ErrorCode.VERIFICATION_CODE_INVALID,
        })
      );
    }

    // Verify email
    user.verifyEmail();
    const saveResult = await this.userRepository.update(user);
    if (!saveResult.success) {
      logger.error("Error updating user", { error: saveResult.error });
      return saveResult;
    }

    // Delete verification code from cache
    await this.cacheService.delete(cacheKey);

    // Publish event
    const event = new EmailVerifiedEvent(
      user.id.getValue(),
      user.email.getValue()
    );
    await this.eventBus.publish(event);

    logger.info("Email verified successfully", { userId: input.userId });

    return saveResult;
  }
}
