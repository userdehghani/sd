/**
 * Use Case: user.profile.get
 * Get user profile
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
  type UserRepository,
  type UserProfile,
  toProfile,
} from "../../../domain/user";
import type { LoggerPort } from "../../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface GetProfileInput {
  userId: string;
}

export interface GetProfileOutput {
  profile: UserProfile;
}

// ============================================
// Dependencies
// ============================================

export interface GetProfileDeps {
  userRepository: UserRepository;
  logger: LoggerPort;
}

// ============================================
// Use Case: Get Profile
// ============================================

export const getUserProfile =
  (deps: GetProfileDeps) =>
  async (input: GetProfileInput): Promise<Result<GetProfileOutput, DomainError>> => {
    const { userRepository, logger } = deps;

    logger.info("Getting user profile", { userId: input.userId });

    const userResult = await userRepository.findById(input.userId as UUID);
    if (userResult.isErr()) {
      return err(userResult.error);
    }

    if (!userResult.value) {
      logger.warn("User not found", { userId: input.userId });
      return err(UserErrors.NOT_FOUND(input.userId));
    }

    const profile = toProfile(userResult.value);

    logger.info("Profile retrieved", { userId: input.userId });

    return ok({ profile });
  };
