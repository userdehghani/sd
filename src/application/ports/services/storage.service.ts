/**
 * Storage Service Port (Interface)
 * Defines the contract for file storage operations (S3)
 */

import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";
import { UploadedFile } from "../../../shared/types";

export interface IStorageService {
  uploadAvatar(userId: string, file: Buffer, mimeType: string): AsyncResult<UploadedFile, DomainError>;
  deleteAvatar(key: string): AsyncResult<void, DomainError>;
  getSignedUrl(key: string, expiresIn?: number): AsyncResult<string, DomainError>;
}
