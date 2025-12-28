/**
 * User Value Objects
 * Immutable objects that describe characteristics of the User entity
 */

import { type Result, ok, err, type DomainError, ValidationErrors, type UUID, type Email, type Phone } from "../../core";

// ============================================
// Email Value Object
// ============================================

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface EmailVO {
  readonly value: Email;
  readonly isVerified: boolean;
  readonly verifiedAt?: Date;
}

export const createEmail = (
  email: string,
  isVerified: boolean = false,
  verifiedAt?: Date
): Result<EmailVO, DomainError> => {
  const normalized = email.trim().toLowerCase();
  
  if (!EMAIL_REGEX.test(normalized)) {
    return err(ValidationErrors.INVALID_FORMAT("email", "valid email address"));
  }

  return ok({
    value: normalized as Email,
    isVerified,
    verifiedAt,
  });
};

export const verifyEmail = (email: EmailVO): EmailVO => ({
  ...email,
  isVerified: true,
  verifiedAt: new Date(),
});

// ============================================
// Phone Value Object
// ============================================

const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

export interface PhoneVO {
  readonly value: Phone;
  readonly isVerified: boolean;
  readonly verifiedAt?: Date;
}

export const createPhone = (
  phone: string,
  isVerified: boolean = false,
  verifiedAt?: Date
): Result<PhoneVO, DomainError> => {
  const normalized = phone.replace(/[\s\-()]/g, "");
  
  if (!PHONE_REGEX.test(normalized)) {
    return err(ValidationErrors.INVALID_FORMAT("phone", "valid phone number (e.g., +989123456789)"));
  }

  return ok({
    value: normalized as Phone,
    isVerified,
    verifiedAt,
  });
};

export const verifyPhone = (phone: PhoneVO): PhoneVO => ({
  ...phone,
  isVerified: true,
  verifiedAt: new Date(),
});

// ============================================
// Name Value Object
// ============================================

export interface NameVO {
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName?: string;
}

export const createName = (
  firstName: string,
  lastName: string,
  displayName?: string
): Result<NameVO, DomainError> => {
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();

  if (trimmedFirst.length < 1 || trimmedFirst.length > 50) {
    return err(ValidationErrors.INVALID_LENGTH("firstName", 1, 50));
  }

  if (trimmedLast.length < 1 || trimmedLast.length > 50) {
    return err(ValidationErrors.INVALID_LENGTH("lastName", 1, 50));
  }

  return ok({
    firstName: trimmedFirst,
    lastName: trimmedLast,
    displayName: displayName?.trim() || `${trimmedFirst} ${trimmedLast}`,
  });
};

// ============================================
// Avatar Value Object
// ============================================

export interface AvatarVO {
  readonly url: string;
  readonly key: string; // S3 object key
  readonly size: number;
  readonly mimeType: string;
  readonly uploadedAt: Date;
}

export const createAvatar = (
  url: string,
  key: string,
  size: number,
  mimeType: string
): Result<AvatarVO, DomainError> => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(mimeType)) {
    return err(ValidationErrors.INVALID_FORMAT("mimeType", allowedTypes.join(", ")));
  }

  if (size > maxSize) {
    return err(ValidationErrors.OUT_OF_RANGE("size", 0, maxSize));
  }

  return ok({
    url,
    key,
    size,
    mimeType,
    uploadedAt: new Date(),
  });
};

// ============================================
// Auth Provider Value Object
// ============================================

export type AuthProviderType = "email" | "google" | "apple" | "passkey";

export interface AuthProviderVO {
  readonly type: AuthProviderType;
  readonly providerId: string; // External provider's user ID
  readonly email?: string;
  readonly linkedAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export const createAuthProvider = (
  type: AuthProviderType,
  providerId: string,
  email?: string,
  metadata?: Record<string, unknown>
): AuthProviderVO => ({
  type,
  providerId,
  email,
  linkedAt: new Date(),
  metadata,
});

// ============================================
// Passkey Credential Value Object
// ============================================

export interface PasskeyCredentialVO {
  readonly id: string;
  readonly publicKey: string;
  readonly counter: number;
  readonly deviceType: string;
  readonly backedUp: boolean;
  readonly transports?: string[];
  readonly createdAt: Date;
  readonly lastUsedAt?: Date;
}

export const createPasskeyCredential = (
  id: string,
  publicKey: string,
  counter: number,
  deviceType: string,
  backedUp: boolean,
  transports?: string[]
): PasskeyCredentialVO => ({
  id,
  publicKey,
  counter,
  deviceType,
  backedUp,
  transports,
  createdAt: new Date(),
});

export const updatePasskeyCounter = (
  credential: PasskeyCredentialVO,
  newCounter: number
): PasskeyCredentialVO => ({
  ...credential,
  counter: newCounter,
  lastUsedAt: new Date(),
});

// ============================================
// User Status
// ============================================

export type UserStatus = "active" | "inactive" | "suspended" | "deleted";

export const isActiveStatus = (status: UserStatus): boolean =>
  status === "active";

// ============================================
// User Role
// ============================================

export type UserRole = "user" | "admin" | "moderator";

export const hasAdminAccess = (role: UserRole): boolean =>
  role === "admin";

export const hasModeratorAccess = (role: UserRole): boolean =>
  role === "admin" || role === "moderator";
