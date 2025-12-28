/**
 * Verify Phone Command
 */

import { User } from "../../../domain/entities/user.entity";
import { UserId } from "../../../domain/value-objects/user-id.vo";
import { IUserRepository } from "../../ports/repositories/user.repository";
import { ICacheService } from "../../ports/services/cache.service";
import { IEventBusService } from "../../ports/services/event-bus.service";
import { PhoneVerifiedEvent } from "../../../domain/events/domain-event";
import { AsyncResult, Err } from "../../../shared/result";
import { DomainError, NotFoundError, ValidationError, ErrorCode } from "../../../shared/errors";
import { logger } from "../../../logger";

export interface VerifyPhoneInput {
  userId: string;
  code: string;
}

export class VerifyPhoneCommand {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cacheService: ICacheService,
    private readonly eventBus: IEventBusService
  ) {}

  async execute(input: VerifyPhoneInput): AsyncResult<User, DomainError> {
    logger.info("Executing VerifyPhoneCommand", { userId: input.userId });

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

    if (!user.phone) {
      logger.warn("User has no phone number", { userId: input.userId });
      return Err(new ValidationError("No phone number to verify"));
    }

    // Get verification code from cache
    const cacheKey = `phone_verification:${input.userId}`;
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

    // Verify phone
    user.verifyPhone();
    const saveResult = await this.userRepository.update(user);
    if (!saveResult.success) {
      logger.error("Error updating user", { error: saveResult.error });
      return saveResult;
    }

    // Delete verification code from cache
    await this.cacheService.delete(cacheKey);

    // Publish event
    const event = new PhoneVerifiedEvent(
      user.id.getValue(),
      user.phone.getValue()
    );
    await this.eventBus.publish(event);

    logger.info("Phone verified successfully", { userId: input.userId });

    return saveResult;
  }
}
