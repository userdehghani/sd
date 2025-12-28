/**
 * Use Case: user.profile.update
 * Update user profile text-based information
 */

import {
  type Result,
  type DomainError,
  ok,
  err,
  UserErrors,
  type UUID,
} from "../../../core";
import {
  type User,
  type UserRepository,
  type UserProfile,
  toProfile,
  updateUserName,
  createName,
} from "../../../domain/user";
import type { LoggerPort } from "../../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface UpdateProfileInput {
  userId: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateProfileOutput {
  profile: UserProfile;
}

// ============================================
// Dependencies
// ============================================

export interface UpdateProfileDeps {
  userRepository: UserRepository;
  logger: LoggerPort;
}

// ============================================
// Use Case: Update Profile
// ============================================

export const updateUserProfile =
  (deps: UpdateProfileDeps) =>
  async (input: UpdateProfileInput): Promise<Result<UpdateProfileOutput, DomainError>> => {
    const { userRepository, logger } = deps;

    logger.info("Updating user profile", { userId: input.userId });

    // Get current user
    const userResult = await userRepository.findById(input.userId as UUID);
    if (userResult.isErr()) {
      return err(userResult.error);
    }

    if (!userResult.value) {
      logger.warn("User not found for update", { userId: input.userId });
      return err(UserErrors.NOT_FOUND(input.userId));
    }

    let user = userResult.value;

    // Update name if provided
    if (input.firstName !== undefined || input.lastName !== undefined || input.displayName !== undefined) {
      const firstName = input.firstName ?? user.name.firstName;
      const lastName = input.lastName ?? user.name.lastName;
      const displayName = input.displayName ?? user.name.displayName;

      const nameResult = createName(firstName, lastName, displayName);
      if (nameResult.isErr()) {
        return err(nameResult.error);
      }

      user = updateUserName(user, nameResult.value);
    }

    // Update metadata if provided
    if (input.metadata !== undefined) {
      user = {
        ...user,
        metadata: { ...user.metadata, ...input.metadata },
        updatedAt: new Date(),
      };
    }

    // Save updated user
    const updateResult = await userRepository.update(user);
    if (updateResult.isErr()) {
      return err(updateResult.error);
    }

    const profile = toProfile(updateResult.value);

    logger.info("Profile updated", { userId: input.userId });

    return ok({ profile });
  };
