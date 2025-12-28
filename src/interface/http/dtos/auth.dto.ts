/**
 * Authentication DTOs
 */

export interface RegisterWithTOTPDto {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface RegisterWithOAuthDto {
  provider: "GOOGLE" | "APPLE";
  code: string;
}

export interface RegisterWithPassKeyDto {
  email: string;
  firstName?: string;
  lastName?: string;
  credential: unknown;
}

export interface LoginWithTOTPDto {
  email: string;
  totpToken: string;
}

export interface LoginWithOAuthDto {
  provider: "GOOGLE" | "APPLE";
  code: string;
}

export interface LoginWithPassKeyDto {
  email: string;
  credential: unknown;
}

export interface AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  };
  session: {
    id: string;
    expiresAt: string;
  };
}

export interface TOTPSetupResponseDto {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}
