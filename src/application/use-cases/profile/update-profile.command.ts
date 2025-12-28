/**
 * Update Profile Command
 */

import { User } from "../../../domain/entities/user.entity";
import { UserId } from "../../../domain/value-objects/user-id.vo";
import { Phone } from "../../../domain/value-objects/phone.vo";
import { IUserRepository } from "../../ports/repositories/user.repository";
import { IEventBusService } from "../../ports/services/event-bus.service";
import { UserProfileUpdatedEvent } from "../../../domain/events/domain-event";
import { AsyncResult, Err } from "../../../shared/result";
import { DomainError, NotFoundError } from "../../../shared/errors";
import { logger } from "../../../logger";

export interface UpdateProfileInput {
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export class UpdateProfileCommand {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly eventBus: IEventBusService
  ) {}

  async execute(input: UpdateProfileInput): AsyncResult<User, DomainError> {
    logger.info("Executing UpdateProfileCommand", { userId: input.userId });

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

    const updatedFields: string[] = [];

    // Update profile fields
    if (input.firstName !== undefined || input.lastName !== undefined) {
      user.updateProfile({
        firstName: input.firstName,
        lastName: input.lastName,
      });
      if (input.firstName !== undefined) updatedFields.push("firstName");
      if (input.lastName !== undefined) updatedFields.push("lastName");
    }

    // Update phone
    if (input.phone) {
      const phoneResult = Phone.create(input.phone);
      if (!phoneResult.success) {
        logger.warn("Invalid phone number", { phone: input.phone });
        return phoneResult;
      }
      user.updatePhone(phoneResult.value);
      updatedFields.push("phone");
    }

    // Save user
    const saveResult = await this.userRepository.update(user);
    if (!saveResult.success) {
      logger.error("Error updating user", { error: saveResult.error });
      return saveResult;
    }

    // Publish event
    if (updatedFields.length > 0) {
      const event = new UserProfileUpdatedEvent(
        user.id.getValue(),
        updatedFields
      );
      await this.eventBus.publish(event);
    }

    logger.info("Profile updated successfully", { 
      userId: input.userId,
      updatedFields 
    });

    return saveResult;
  }
}
