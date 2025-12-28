/**
 * Storage Service Implementation (AWS S3)
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { IStorageService } from "../../application/ports/services/storage.service";
import { AsyncResult, Ok, Err } from "../../shared/result";
import { DomainError, InfrastructureError, ErrorCode } from "../../shared/errors";
import { UploadedFile } from "../../shared/types";
import { logger } from "../../logger";

export class StorageServiceImpl implements IStorageService {
  constructor(
    private readonly s3Client: S3Client,
    private readonly bucketName: string,
    private readonly region: string,
    private readonly cdnUrl?: string
  ) {}

  async uploadAvatar(
    userId: string,
    file: Buffer,
    mimeType: string
  ): AsyncResult<UploadedFile, DomainError> {
    try {
      const extension = this.getExtensionFromMimeType(mimeType);
      const key = `avatars/${userId}-${Date.now()}.${extension}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: mimeType,
        ACL: "public-read",
      });

      await this.s3Client.send(command);

      const url = this.cdnUrl
        ? `${this.cdnUrl}/${key}`
        : `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

      logger.info("Avatar uploaded successfully", { key, url });

      return Ok({
        url,
        key,
        size: file.length,
        mimeType,
      });
    } catch (error) {
      logger.error("Error uploading avatar", { error });
      return Err(
        new InfrastructureError(
          "Failed to upload avatar",
          ErrorCode.STORAGE_ERROR,
          { error }
        )
      );
    }
  }

  async deleteAvatar(key: string): AsyncResult<void, DomainError> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);

      logger.info("Avatar deleted successfully", { key });
      return Ok(undefined);
    } catch (error) {
      logger.error("Error deleting avatar", { error });
      return Err(
        new InfrastructureError(
          "Failed to delete avatar",
          ErrorCode.STORAGE_ERROR,
          { error }
        )
      );
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): AsyncResult<string, DomainError> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });

      return Ok(url);
    } catch (error) {
      logger.error("Error generating signed URL", { error });
      return Err(
        new InfrastructureError(
          "Failed to generate signed URL",
          ErrorCode.STORAGE_ERROR,
          { error }
        )
      );
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    return extensions[mimeType] || "jpg";
  }
}
