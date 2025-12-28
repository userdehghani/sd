/**
 * Delete Avatar Command
 */

import { User } from "../../../domain/entities/user.entity";
import { UserId } from "../../../domain/value-objects/user-id.vo";
import { IUserRepository } from "../../ports/repositories/user.repository";
import { IStorageService } from "../../ports/services/storage.service";
import { AsyncResult, Err } from "../../../shared/result";
import { DomainError, NotFoundError } from "../../../shared/errors";
import { logger } from "../../../logger";

export interface DeleteAvatarInput {
  userId: string;
}

export class DeleteAvatarCommand {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly storageService: IStorageService
  ) {}

  async execute(input: DeleteAvatarInput): AsyncResult<User, DomainError> {
    logger.info("Executing DeleteAvatarCommand", { userId: input.userId });

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

    // Delete avatar if exists
    if (user.avatarUrl) {
      const urlParts = user.avatarUrl.split("/");
      const key = urlParts[urlParts.length - 1];
      
      const deleteResult = await this.storageService.deleteAvatar(key);
      if (!deleteResult.success) {
        logger.error("Error deleting avatar", { error: deleteResult.error });
        return deleteResult;
      }

      // Update user
      user.updateAvatarUrl("");
      const saveResult = await this.userRepository.update(user);
      if (!saveResult.success) {
        logger.error("Error updating user", { error: saveResult.error });
        return saveResult;
      }

      logger.info("Avatar deleted successfully", { userId: input.userId });
      return saveResult;
    }

    logger.info("No avatar to delete", { userId: input.userId });
    return userResult;
  }
}
