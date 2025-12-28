/**
 * S3 Storage Adapter - Singleton Pattern
 */

import {
  type Result,
  ok,
  err,
  StorageErrors,
  InfraErrors,
  type DomainError,
} from "../../../core";
import type { StoragePort, UploadParams, UploadResult, LoggerPort } from "../../../application/ports";

// ============================================
// Types
// ============================================

export interface S3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // For S3-compatible services (MinIO, etc.)
  forcePathStyle?: boolean;
  publicUrlBase?: string;
}

// ============================================
// Singleton Implementation
// ============================================

let instance: StoragePort | null = null;

export const createS3Client = (
  config: S3Config,
  logger: LoggerPort
): StoragePort => {
  if (instance) {
    logger.debug("Returning existing S3 client instance");
    return instance;
  }

  logger.info("Creating S3 client", {
    region: config.region,
    bucket: config.bucket,
    endpoint: config.endpoint,
  });

  // In production, use @aws-sdk/client-s3
  // import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
  // import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

  const getPublicUrl = (key: string): string => {
    if (config.publicUrlBase) {
      return `${config.publicUrlBase}/${key}`;
    }
    if (config.endpoint) {
      return `${config.endpoint}/${config.bucket}/${key}`;
    }
    return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
  };

  const client: StoragePort = {
    async upload(params: UploadParams): Promise<Result<UploadResult, DomainError>> {
      try {
        logger.info("Uploading to S3", {
          key: params.key,
          contentType: params.contentType,
          size: params.data.length,
        });

        // In production:
        // const command = new PutObjectCommand({
        //   Bucket: config.bucket,
        //   Key: params.key,
        //   Body: params.data,
        //   ContentType: params.contentType,
        //   Metadata: params.metadata,
        // });
        // await s3Client.send(command);

        // Placeholder for demonstration
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 100));

        const url = getPublicUrl(params.key);

        logger.info("S3 upload successful", { key: params.key, url });

        return ok({
          key: params.key,
          url,
          size: params.data.length,
        });
      } catch (error) {
        logger.error("S3 upload failed", error as Error, { key: params.key });
        return err(StorageErrors.UPLOAD_FAILED(params.key));
      }
    },

    async delete(key: string): Promise<Result<void, DomainError>> {
      try {
        logger.info("Deleting from S3", { key });

        // In production:
        // const command = new DeleteObjectCommand({
        //   Bucket: config.bucket,
        //   Key: key,
        // });
        // await s3Client.send(command);

        // Placeholder for demonstration
        await new Promise((resolve) => setTimeout(resolve, 50));

        logger.info("S3 delete successful", { key });

        return ok(undefined);
      } catch (error) {
        logger.error("S3 delete failed", error as Error, { key });
        return err(StorageErrors.DELETE_FAILED(key));
      }
    },

    async getSignedUrl(key: string, expiresInSeconds: number = 3600): Promise<Result<string, DomainError>> {
      try {
        logger.debug("Generating S3 signed URL", { key, expiresInSeconds });

        // In production:
        // const command = new GetObjectCommand({
        //   Bucket: config.bucket,
        //   Key: key,
        // });
        // const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });

        // Placeholder - return public URL with fake signature
        const url = `${getPublicUrl(key)}?X-Amz-Expires=${expiresInSeconds}&X-Amz-Signature=placeholder`;

        return ok(url);
      } catch (error) {
        logger.error("S3 signed URL generation failed", error as Error, { key });
        return err(InfraErrors.EXTERNAL_SERVICE_ERROR("S3", error as Error));
      }
    },
  };

  instance = client;
  return client;
};

export const getS3Client = (): StoragePort | null => instance;

export const resetS3Client = (): void => {
  instance = null;
};
