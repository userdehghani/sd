/**
 * Domain Error Types
 * Structured error handling with error codes and metadata
 */

export interface DomainError {
  readonly code: string;
  readonly message: string;
  readonly metadata?: Record<string, unknown>;
  readonly cause?: Error;
}

// Error factory
export const createError = (
  code: string,
  message: string,
  metadata?: Record<string, unknown>,
  cause?: Error
): DomainError => ({
  code,
  message,
  metadata,
  cause,
});

// ============================================
// Authentication Errors
// ============================================

export const AuthErrors = {
  INVALID_CREDENTIALS: (metadata?: Record<string, unknown>): DomainError =>
    createError("AUTH_INVALID_CREDENTIALS", "Invalid credentials provided", metadata),

  TOKEN_EXPIRED: (metadata?: Record<string, unknown>): DomainError =>
    createError("AUTH_TOKEN_EXPIRED", "Authentication token has expired", metadata),

  TOKEN_INVALID: (metadata?: Record<string, unknown>): DomainError =>
    createError("AUTH_TOKEN_INVALID", "Invalid authentication token", metadata),

  SESSION_NOT_FOUND: (sessionId: string): DomainError =>
    createError("AUTH_SESSION_NOT_FOUND", "Session not found", { sessionId }),

  SESSION_EXPIRED: (sessionId: string): DomainError =>
    createError("AUTH_SESSION_EXPIRED", "Session has expired", { sessionId }),

  SESSION_REVOKED: (sessionId: string): DomainError =>
    createError("AUTH_SESSION_REVOKED", "Session has been revoked", { sessionId }),

  TOTP_INVALID: (): DomainError =>
    createError("AUTH_TOTP_INVALID", "Invalid TOTP code"),

  TOTP_EXPIRED: (): DomainError =>
    createError("AUTH_TOTP_EXPIRED", "TOTP code has expired"),

  PASSKEY_INVALID: (): DomainError =>
    createError("AUTH_PASSKEY_INVALID", "Invalid passkey"),

  PASSKEY_CHALLENGE_FAILED: (): DomainError =>
    createError("AUTH_PASSKEY_CHALLENGE_FAILED", "Passkey challenge verification failed"),

  OAUTH_INVALID_STATE: (): DomainError =>
    createError("AUTH_OAUTH_INVALID_STATE", "Invalid OAuth state parameter"),

  OAUTH_TOKEN_EXCHANGE_FAILED: (provider: string): DomainError =>
    createError("AUTH_OAUTH_TOKEN_EXCHANGE_FAILED", `Failed to exchange OAuth token with ${provider}`, { provider }),

  UNAUTHORIZED: (): DomainError =>
    createError("AUTH_UNAUTHORIZED", "User is not authorized"),
} as const;

// ============================================
// User Errors
// ============================================

export const UserErrors = {
  NOT_FOUND: (userId: string): DomainError =>
    createError("USER_NOT_FOUND", "User not found", { userId }),

  ALREADY_EXISTS: (email: string): DomainError =>
    createError("USER_ALREADY_EXISTS", "User with this email already exists", { email }),

  EMAIL_NOT_VERIFIED: (userId: string): DomainError =>
    createError("USER_EMAIL_NOT_VERIFIED", "Email address is not verified", { userId }),

  PHONE_NOT_VERIFIED: (userId: string): DomainError =>
    createError("USER_PHONE_NOT_VERIFIED", "Phone number is not verified", { userId }),

  INVALID_EMAIL: (email: string): DomainError =>
    createError("USER_INVALID_EMAIL", "Invalid email address format", { email }),

  INVALID_PHONE: (phone: string): DomainError =>
    createError("USER_INVALID_PHONE", "Invalid phone number format", { phone }),

  UPDATE_FAILED: (userId: string): DomainError =>
    createError("USER_UPDATE_FAILED", "Failed to update user", { userId }),
} as const;

// ============================================
// Storage Errors
// ============================================

export const StorageErrors = {
  UPLOAD_FAILED: (filename: string): DomainError =>
    createError("STORAGE_UPLOAD_FAILED", "Failed to upload file", { filename }),

  DELETE_FAILED: (filename: string): DomainError =>
    createError("STORAGE_DELETE_FAILED", "Failed to delete file", { filename }),

  FILE_NOT_FOUND: (filename: string): DomainError =>
    createError("STORAGE_FILE_NOT_FOUND", "File not found", { filename }),

  FILE_TOO_LARGE: (maxSize: number): DomainError =>
    createError("STORAGE_FILE_TOO_LARGE", `File exceeds maximum size of ${maxSize} bytes`, { maxSize }),

  INVALID_FILE_TYPE: (allowedTypes: string[]): DomainError =>
    createError("STORAGE_INVALID_FILE_TYPE", `Invalid file type. Allowed: ${allowedTypes.join(", ")}`, { allowedTypes }),
} as const;

// ============================================
// Notification Errors
// ============================================

export const NotificationErrors = {
  EMAIL_SEND_FAILED: (recipient: string): DomainError =>
    createError("NOTIFICATION_EMAIL_SEND_FAILED", "Failed to send email", { recipient }),

  SMS_SEND_FAILED: (recipient: string): DomainError =>
    createError("NOTIFICATION_SMS_SEND_FAILED", "Failed to send SMS", { recipient }),

  INVALID_TEMPLATE: (templateId: string): DomainError =>
    createError("NOTIFICATION_INVALID_TEMPLATE", "Invalid notification template", { templateId }),
} as const;

// ============================================
// Verification Errors
// ============================================

export const VerificationErrors = {
  CODE_INVALID: (): DomainError =>
    createError("VERIFICATION_CODE_INVALID", "Invalid verification code"),

  CODE_EXPIRED: (): DomainError =>
    createError("VERIFICATION_CODE_EXPIRED", "Verification code has expired"),

  TOO_MANY_ATTEMPTS: (): DomainError =>
    createError("VERIFICATION_TOO_MANY_ATTEMPTS", "Too many verification attempts"),

  ALREADY_VERIFIED: (type: "email" | "phone"): DomainError =>
    createError("VERIFICATION_ALREADY_VERIFIED", `${type} is already verified`, { type }),
} as const;

// ============================================
// Infrastructure Errors
// ============================================

export const InfraErrors = {
  DATABASE_ERROR: (operation: string, cause?: Error): DomainError =>
    createError("INFRA_DATABASE_ERROR", `Database operation failed: ${operation}`, { operation }, cause),

  CACHE_ERROR: (operation: string, cause?: Error): DomainError =>
    createError("INFRA_CACHE_ERROR", `Cache operation failed: ${operation}`, { operation }, cause),

  EXTERNAL_SERVICE_ERROR: (service: string, cause?: Error): DomainError =>
    createError("INFRA_EXTERNAL_SERVICE_ERROR", `External service error: ${service}`, { service }, cause),

  RATE_LIMIT_EXCEEDED: (retryAfter: number): DomainError =>
    createError("INFRA_RATE_LIMIT_EXCEEDED", "Rate limit exceeded", { retryAfter }),

  TIMEOUT: (operation: string): DomainError =>
    createError("INFRA_TIMEOUT", `Operation timed out: ${operation}`, { operation }),
} as const;

// ============================================
// Validation Errors
// ============================================

export const ValidationErrors = {
  REQUIRED_FIELD: (field: string): DomainError =>
    createError("VALIDATION_REQUIRED_FIELD", `Field '${field}' is required`, { field }),

  INVALID_FORMAT: (field: string, expected: string): DomainError =>
    createError("VALIDATION_INVALID_FORMAT", `Invalid format for '${field}'. Expected: ${expected}`, { field, expected }),

  OUT_OF_RANGE: (field: string, min?: number, max?: number): DomainError =>
    createError("VALIDATION_OUT_OF_RANGE", `Value for '${field}' is out of range`, { field, min, max }),

  INVALID_LENGTH: (field: string, minLength?: number, maxLength?: number): DomainError =>
    createError("VALIDATION_INVALID_LENGTH", `Invalid length for '${field}'`, { field, minLength, maxLength }),
} as const;

// Type for all error types
export type AppError = DomainError;
