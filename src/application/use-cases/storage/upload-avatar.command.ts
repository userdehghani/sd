/**
 * Upload Avatar Command
 */

import { User } from "../../../domain/entities/user.entity";
import { UserId } from "../../../domain/value-objects/user-id.vo";
import { IUserRepository } from "../../ports/repositories/user.repository";
import { IStorageService } from "../../ports/services/storage.service";
import { AsyncResult, Err } from "../../../shared/result";
import { DomainError, NotFoundError, ValidationError, ErrorCode } from "../../../shared/errors";
import { UploadedFile } from "../../../shared/types";
import { logger } from "../../../logger";

export interface UploadAvatarInput {
  userId: string;
  file: Buffer;
  mimeType: string;
}

export interface UploadAvatarOutput {
  user: User;
  file: UploadedFile;
}

export class UploadAvatarCommand {
  private readonly allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly storageService: IStorageService
  ) {}

  async execute(input: UploadAvatarInput): AsyncResult<UploadAvatarOutput, DomainError> {
    logger.info("Executing UploadAvatarCommand", { 
      userId: input.userId,
      mimeType: input.mimeType,
      size: input.file.length 
    });

    const userId = UserId.fromString(input.userId);

    // Validate file type
    if (!this.allowedMimeTypes.includes(input.mimeType)) {
      logger.warn("Invalid file type", { mimeType: input.mimeType });
      return Err(
        new ValidationError("Invalid file type. Only images are allowed.", {
          code: ErrorCode.INVALID_FILE_TYPE,
          allowedTypes: this.allowedMimeTypes,
        })
      );
    }

    // Validate file size
    if (input.file.length > this.maxFileSize) {
      logger.warn("File too large", { size: input.file.length });
      return Err(
        new ValidationError("File too large. Maximum size is 5MB.", {
          code: ErrorCode.FILE_TOO_LARGE,
          maxSize: this.maxFileSize,
        })
      );
    }

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

    // Delete old avatar if exists
    if (user.avatarUrl) {
      // Extract key from URL
      const urlParts = user.avatarUrl.split("/");
      const oldKey = urlParts[urlParts.length - 1];
      await this.storageService.deleteAvatar(oldKey);
    }

    // Upload new avatar
    const uploadResult = await this.storageService.uploadAvatar(
      input.userId,
      input.file,
      input.mimeType
    );
    if (!uploadResult.success) {
      logger.error("Error uploading avatar", { error: uploadResult.error });
      return uploadResult;
    }
    const uploadedFile = uploadResult.value;

    // Update user
    user.updateAvatarUrl(uploadedFile.url);
    const saveResult = await this.userRepository.update(user);
    if (!saveResult.success) {
      logger.error("Error updating user", { error: saveResult.error });
      return saveResult;
    }

    logger.info("Avatar uploaded successfully", { 
      userId: input.userId,
      url: uploadedFile.url 
    });

    return {
      success: true,
      value: {
        user: saveResult.value,
        file: uploadedFile,
      },
    };
  }
}
