/**
 * Profile DTOs
 */

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface VerifyEmailDto {
  code: string;
}

export interface VerifyPhoneDto {
  code: string;
}

export interface ProfileResponseDto {
  id: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  avatarUrl?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  authProviders: string[];
  createdAt: string;
  updatedAt: string;
}
