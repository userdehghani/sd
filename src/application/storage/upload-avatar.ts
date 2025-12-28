/**
 * Use Case: storage.upload.avatar
 * Upload user avatar to S3
 */

import {
  type Result,
  type DomainError,
  ok,
  err,
  UserErrors,
  StorageErrors,
  type UUID,
} from "../../core";
import {
  type User,
  type UserRepository,
  updateUserAvatar,
  createAvatar,
} from "../../domain/user";
import type { StoragePort, LoggerPort } from "../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface UploadAvatarInput {
  userId: string;
  data: Buffer | Uint8Array;
  filename: string;
  contentType: string;
  size: number;
}

export interface UploadAvatarOutput {
  avatarUrl: string;
  key: string;
}

// ============================================
// Dependencies
// ============================================

export interface UploadAvatarDeps {
  userRepository: UserRepository;
  storage: StoragePort;
  logger: LoggerPort;
  config: {
    avatarBucket: string;
    maxAvatarSize: number;
    allowedMimeTypes: string[];
  };
}

// ============================================
// Use Case: Upload Avatar
// ============================================

export const uploadAvatar =
  (deps: UploadAvatarDeps) =>
  async (input: UploadAvatarInput): Promise<Result<UploadAvatarOutput, DomainError>> => {
    const { userRepository, storage, logger, config } = deps;

    logger.info("Uploading avatar", { 
      userId: input.userId, 
      filename: input.filename,
      size: input.size,
      contentType: input.contentType,
    });

    // Validate file size
    if (input.size > config.maxAvatarSize) {
      logger.warn("Avatar file too large", { 
        userId: input.userId, 
        size: input.size, 
        maxSize: config.maxAvatarSize 
      });
      return err(StorageErrors.FILE_TOO_LARGE(config.maxAvatarSize));
    }

    // Validate content type
    if (!config.allowedMimeTypes.includes(input.contentType)) {
      logger.warn("Invalid avatar content type", { 
        userId: input.userId, 
        contentType: input.contentType 
      });
      return err(StorageErrors.INVALID_FILE_TYPE(config.allowedMimeTypes));
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

    // Delete old avatar if exists
    if (user.avatar) {
      logger.info("Deleting old avatar", { 
        userId: input.userId, 
        oldKey: user.avatar.key 
      });
      await storage.delete(user.avatar.key);
    }

    // Generate unique key for new avatar
    const extension = input.filename.split(".").pop() || "jpg";
    const key = `avatars/${input.userId}/${Date.now()}.${extension}`;

    // Upload to storage
    const uploadResult = await storage.upload({
      key,
      data: input.data,
      contentType: input.contentType,
      metadata: {
        userId: input.userId,
        originalFilename: input.filename,
      },
    });

    if (uploadResult.isErr()) {
      logger.error("Failed to upload avatar", uploadResult.error, { userId: input.userId });
      return err(uploadResult.error);
    }

    // Create avatar value object
    const avatarResult = createAvatar(
      uploadResult.value.url,
      key,
      input.size,
      input.contentType
    );

    if (avatarResult.isErr()) {
      // Rollback upload
      await storage.delete(key);
      return err(avatarResult.error);
    }

    // Update user with new avatar
    const updatedUser = updateUserAvatar(user, avatarResult.value);
    const updateResult = await userRepository.update(updatedUser);

    if (updateResult.isErr()) {
      // Rollback upload
      await storage.delete(key);
      return err(updateResult.error);
    }

    logger.info("Avatar uploaded successfully", { 
      userId: input.userId, 
      key,
      url: uploadResult.value.url 
    });

    return ok({
      avatarUrl: uploadResult.value.url,
      key,
    });
  };
