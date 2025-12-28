/**
 * Common types used across the application
 */

export type UUID = string;
export type Timestamp = Date;
export type Email = string;
export type PhoneNumber = string;
export type URL = string;

/**
 * Pagination types
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Authentication types
 */
export enum AuthProvider {
  TOTP = "TOTP",
  GOOGLE = "GOOGLE",
  APPLE = "APPLE",
  PASSKEY = "PASSKEY",
}

export interface JWTPayload {
  userId: UUID;
  sessionId: UUID;
  email: Email;
  iat: number;
  exp: number;
}

/**
 * Storage types
 */
export enum FileType {
  IMAGE = "IMAGE",
  DOCUMENT = "DOCUMENT",
}

export interface UploadedFile {
  url: URL;
  key: string;
  size: number;
  mimeType: string;
}
