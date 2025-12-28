/**
 * Get Profile Command
 */

import { User } from "../../../domain/entities/user.entity";
import { UserId } from "../../../domain/value-objects/user-id.vo";
import { IUserRepository } from "../../ports/repositories/user.repository";
import { AsyncResult, Err } from "../../../shared/result";
import { DomainError, NotFoundError } from "../../../shared/errors";
import { logger } from "../../../logger";

export interface GetProfileInput {
  userId: string;
}

export class GetProfileCommand {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: GetProfileInput): AsyncResult<User, DomainError> {
    logger.info("Executing GetProfileCommand", { userId: input.userId });

    const userId = UserId.fromString(input.userId);

    const userResult = await this.userRepository.findById(userId);
    if (!userResult.success) {
      logger.error("Error finding user", { error: userResult.error });
      return userResult;
    }
    if (!userResult.value) {
      logger.warn("User not found", { userId: input.userId });
      return Err(new NotFoundError("User not found"));
    }

    logger.info("Profile retrieved successfully", { userId: input.userId });
    return userResult;
  }
}
