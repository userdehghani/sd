/**
 * Application Ports
 * Secondary/Driven ports for infrastructure dependencies
 */

import type { Result, DomainError, UUID } from "../../core";

// ============================================
// Storage Port
// ============================================

export interface StoragePort {
  upload(params: UploadParams): Promise<Result<UploadResult, DomainError>>;
  delete(key: string): Promise<Result<void, DomainError>>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<Result<string, DomainError>>;
}

export interface UploadParams {
  key: string;
  data: Buffer | Uint8Array;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

// ============================================
// Email Port
// ============================================

export interface EmailPort {
  send(params: SendEmailParams): Promise<Result<void, DomainError>>;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: {
    id: string;
    data: Record<string, unknown>;
  };
}

// ============================================
// SMS Port
// ============================================

export interface SMSPort {
  send(params: SendSMSParams): Promise<Result<void, DomainError>>;
}

export interface SendSMSParams {
  to: string;
  message: string;
}

// ============================================
// Cache Port
// ============================================

export interface CachePort {
  get<T>(key: string): Promise<Result<T | null, DomainError>>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<Result<void, DomainError>>;
  delete(key: string): Promise<Result<void, DomainError>>;
  exists(key: string): Promise<Result<boolean, DomainError>>;
}

// ============================================
// PubSub Port
// ============================================

export interface PubSubPort {
  publish<T>(channel: string, message: T): Promise<Result<void, DomainError>>;
  subscribe<T>(channel: string, handler: (message: T) => void): Promise<Result<void, DomainError>>;
  unsubscribe(channel: string): Promise<Result<void, DomainError>>;
}

// ============================================
// OAuth Port
// ============================================

export interface OAuthPort {
  getAuthorizationUrl(state: string, redirectUri: string): string;
  exchangeCodeForToken(code: string, redirectUri: string): Promise<Result<OAuthTokens, DomainError>>;
  getUserInfo(accessToken: string): Promise<Result<OAuthUserInfo, DomainError>>;
  refreshToken(refreshToken: string): Promise<Result<OAuthTokens, DomainError>>;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  idToken?: string;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

// ============================================
// JWT Port
// ============================================

export interface JWTPort {
  sign(payload: Record<string, unknown>, expiresInSeconds: number): Promise<Result<string, DomainError>>;
  verify<T extends Record<string, unknown>>(token: string): Promise<Result<T, DomainError>>;
}

// ============================================
// TOTP Port
// ============================================

export interface TOTPPort {
  generateSecret(): string;
  generateQRCodeUrl(secret: string, email: string, issuer: string): string;
  verify(secret: string, code: string): boolean;
}

// ============================================
// Passkey Port
// ============================================

export interface PasskeyPort {
  generateRegistrationOptions(params: PasskeyRegistrationParams): Promise<Result<PasskeyRegistrationOptions, DomainError>>;
  verifyRegistration(params: VerifyRegistrationParams): Promise<Result<PasskeyCredential, DomainError>>;
  generateAuthenticationOptions(params: PasskeyAuthenticationParams): Promise<Result<PasskeyAuthenticationOptions, DomainError>>;
  verifyAuthentication(params: VerifyAuthenticationParams): Promise<Result<PasskeyAuthenticationResult, DomainError>>;
}

export interface PasskeyRegistrationParams {
  userId: string;
  userEmail: string;
  userName: string;
  rpId: string;
  rpName: string;
  existingCredentialIds?: string[];
}

export interface PasskeyRegistrationOptions {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: Array<{ alg: number; type: string }>;
  timeout: number;
  attestation: string;
  excludeCredentials?: Array<{ id: string; type: string; transports?: string[] }>;
}

export interface VerifyRegistrationParams {
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
  response: unknown;
}

export interface PasskeyCredential {
  id: string;
  publicKey: string;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports?: string[];
}

export interface PasskeyAuthenticationParams {
  rpId: string;
  allowCredentials?: Array<{ id: string; type: string; transports?: string[] }>;
}

export interface PasskeyAuthenticationOptions {
  challenge: string;
  timeout: number;
  rpId: string;
  allowCredentials?: Array<{ id: string; type: string; transports?: string[] }>;
  userVerification: string;
}

export interface VerifyAuthenticationParams {
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
  credential: { id: string; publicKey: string; counter: number };
  response: unknown;
}

export interface PasskeyAuthenticationResult {
  credentialId: string;
  newCounter: number;
}

// ============================================
// Logger Port
// ============================================

export interface LoggerPort {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void;
}
