/**
 * Domain errors with detailed error codes and metadata
 */

export enum ErrorCode {
  // Authentication errors
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
  SESSION_REVOKED = "SESSION_REVOKED",
  OAUTH_ERROR = "OAUTH_ERROR",
  TOTP_INVALID = "TOTP_INVALID",
  PASSKEY_INVALID = "PASSKEY_INVALID",
  
  // Authorization errors
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  
  // User errors
  USER_NOT_FOUND = "USER_NOT_FOUND",
  USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS",
  EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS",
  PHONE_ALREADY_EXISTS = "PHONE_ALREADY_EXISTS",
  
  // Validation errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_EMAIL = "INVALID_EMAIL",
  INVALID_PHONE = "INVALID_PHONE",
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  
  // Verification errors
  VERIFICATION_FAILED = "VERIFICATION_FAILED",
  VERIFICATION_CODE_EXPIRED = "VERIFICATION_CODE_EXPIRED",
  VERIFICATION_CODE_INVALID = "VERIFICATION_CODE_INVALID",
  
  // Infrastructure errors
  DATABASE_ERROR = "DATABASE_ERROR",
  CACHE_ERROR = "CACHE_ERROR",
  STORAGE_ERROR = "STORAGE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  
  // Generic errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  NOT_FOUND = "NOT_FOUND",
  BAD_REQUEST = "BAD_REQUEST",
}

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DomainError";
    Object.setPrototypeOf(this, DomainError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      metadata: this.metadata,
    };
  }
}

// Specific domain errors
export class AuthenticationError extends DomainError {
  constructor(message: string, code: ErrorCode = ErrorCode.INVALID_CREDENTIALS, metadata?: Record<string, unknown>) {
    super(code, message, metadata);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends DomainError {
  constructor(message: string, code: ErrorCode = ErrorCode.UNAUTHORIZED, metadata?: Record<string, unknown>) {
    super(code, message, metadata);
    this.name = "AuthorizationError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, metadata);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(ErrorCode.NOT_FOUND, message, metadata);
    this.name = "NotFoundError";
  }
}

export class InfrastructureError extends DomainError {
  constructor(message: string, code: ErrorCode, metadata?: Record<string, unknown>) {
    super(code, message, metadata);
    this.name = "InfrastructureError";
  }
}

export class RateLimitError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, metadata);
    this.name = "RateLimitError";
  }
}
