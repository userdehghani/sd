/**
 * Use Case: storage.delete.avatar
 * Delete user avatar from S3
 */

import {
  type Result,
  type DomainError,
  ok,
  err,
  UserErrors,
  type UUID,
} from "../../core";
import {
  type User,
  type UserRepository,
  updateUserAvatar,
} from "../../domain/user";
import type { StoragePort, LoggerPort } from "../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface DeleteAvatarInput {
  userId: string;
}

export interface DeleteAvatarOutput {
  deleted: boolean;
}

// ============================================
// Dependencies
// ============================================

export interface DeleteAvatarDeps {
  userRepository: UserRepository;
  storage: StoragePort;
  logger: LoggerPort;
}

// ============================================
// Use Case: Delete Avatar
// ============================================

export const deleteAvatar =
  (deps: DeleteAvatarDeps) =>
  async (input: DeleteAvatarInput): Promise<Result<DeleteAvatarOutput, DomainError>> => {
    const { userRepository, storage, logger } = deps;

    logger.info("Deleting avatar", { userId: input.userId });

    // Get user
    const userResult = await userRepository.findById(input.userId as UUID);
    if (userResult.isErr()) {
      return err(userResult.error);
    }

    if (!userResult.value) {
      return err(UserErrors.NOT_FOUND(input.userId));
    }

    const user = userResult.value;

    // Check if user has an avatar
    if (!user.avatar) {
      logger.info("No avatar to delete", { userId: input.userId });
      return ok({ deleted: false });
    }

    // Delete from storage
    const deleteResult = await storage.delete(user.avatar.key);
    if (deleteResult.isErr()) {
      logger.error("Failed to delete avatar from storage", deleteResult.error, { 
        userId: input.userId,
        key: user.avatar.key 
      });
      // Continue to update user even if storage delete fails
    }

    // Update user to remove avatar reference
    const updatedUser = updateUserAvatar(user, undefined);
    const updateResult = await userRepository.update(updatedUser);

    if (updateResult.isErr()) {
      return err(updateResult.error);
    }

    logger.info("Avatar deleted successfully", { userId: input.userId });

    return ok({ deleted: true });
  };
