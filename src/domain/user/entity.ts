/**
 * User Entity
 * Aggregate root for user-related operations
 */

import type { UUID, ISODateString } from "../../core";
import type {
  EmailVO,
  PhoneVO,
  NameVO,
  AvatarVO,
  AuthProviderVO,
  PasskeyCredentialVO,
  UserStatus,
  UserRole,
} from "./value-objects";

// ============================================
// User Entity
// ============================================

export interface User {
  readonly id: UUID;
  readonly email: EmailVO;
  readonly phone?: PhoneVO;
  readonly name: NameVO;
  readonly avatar?: AvatarVO;
  readonly status: UserStatus;
  readonly role: UserRole;
  readonly authProviders: readonly AuthProviderVO[];
  readonly passkeyCredentials: readonly PasskeyCredentialVO[];
  readonly totpEnabled: boolean;
  readonly totpSecret?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastLoginAt?: Date;
}

// ============================================
// User Creation
// ============================================

export interface CreateUserParams {
  readonly id: UUID;
  readonly email: EmailVO;
  readonly name: NameVO;
  readonly authProvider?: AuthProviderVO;
  readonly role?: UserRole;
}

export const createUser = (params: CreateUserParams): User => ({
  id: params.id,
  email: params.email,
  name: params.name,
  status: "active",
  role: params.role ?? "user",
  authProviders: params.authProvider ? [params.authProvider] : [],
  passkeyCredentials: [],
  totpEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ============================================
// User Update Functions (Immutable)
// ============================================

export const updateUserEmail = (user: User, email: EmailVO): User => ({
  ...user,
  email,
  updatedAt: new Date(),
});

export const updateUserPhone = (user: User, phone: PhoneVO): User => ({
  ...user,
  phone,
  updatedAt: new Date(),
});

export const updateUserName = (user: User, name: NameVO): User => ({
  ...user,
  name,
  updatedAt: new Date(),
});

export const updateUserAvatar = (user: User, avatar: AvatarVO | undefined): User => ({
  ...user,
  avatar,
  updatedAt: new Date(),
});

export const updateUserStatus = (user: User, status: UserStatus): User => ({
  ...user,
  status,
  updatedAt: new Date(),
});

export const addAuthProvider = (user: User, provider: AuthProviderVO): User => ({
  ...user,
  authProviders: [...user.authProviders, provider],
  updatedAt: new Date(),
});

export const removeAuthProvider = (user: User, providerType: string): User => ({
  ...user,
  authProviders: user.authProviders.filter((p) => p.type !== providerType),
  updatedAt: new Date(),
});

export const addPasskeyCredential = (user: User, credential: PasskeyCredentialVO): User => ({
  ...user,
  passkeyCredentials: [...user.passkeyCredentials, credential],
  updatedAt: new Date(),
});

export const removePasskeyCredential = (user: User, credentialId: string): User => ({
  ...user,
  passkeyCredentials: user.passkeyCredentials.filter((c) => c.id !== credentialId),
  updatedAt: new Date(),
});

export const enableTotp = (user: User, secret: string): User => ({
  ...user,
  totpEnabled: true,
  totpSecret: secret,
  updatedAt: new Date(),
});

export const disableTotp = (user: User): User => ({
  ...user,
  totpEnabled: false,
  totpSecret: undefined,
  updatedAt: new Date(),
});

export const recordLogin = (user: User): User => ({
  ...user,
  lastLoginAt: new Date(),
  updatedAt: new Date(),
});

// ============================================
// User Serialization (for persistence)
// ============================================

export interface UserDTO {
  id: string;
  email: string;
  emailVerified: boolean;
  emailVerifiedAt?: string;
  phone?: string;
  phoneVerified?: boolean;
  phoneVerifiedAt?: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatarUrl?: string;
  avatarKey?: string;
  avatarSize?: number;
  avatarMimeType?: string;
  status: UserStatus;
  role: UserRole;
  totpEnabled: boolean;
  totpSecret?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export const toDTO = (user: User): UserDTO => ({
  id: user.id,
  email: user.email.value,
  emailVerified: user.email.isVerified,
  emailVerifiedAt: user.email.verifiedAt?.toISOString(),
  phone: user.phone?.value,
  phoneVerified: user.phone?.isVerified,
  phoneVerifiedAt: user.phone?.verifiedAt?.toISOString(),
  firstName: user.name.firstName,
  lastName: user.name.lastName,
  displayName: user.name.displayName,
  avatarUrl: user.avatar?.url,
  avatarKey: user.avatar?.key,
  avatarSize: user.avatar?.size,
  avatarMimeType: user.avatar?.mimeType,
  status: user.status,
  role: user.role,
  totpEnabled: user.totpEnabled,
  totpSecret: user.totpSecret,
  metadata: user.metadata,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
  lastLoginAt: user.lastLoginAt?.toISOString(),
});

// ============================================
// User Profile (Public View)
// ============================================

export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly phone?: string;
  readonly phoneVerified: boolean;
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly role: UserRole;
  readonly createdAt: string;
}

export const toProfile = (user: User): UserProfile => ({
  id: user.id,
  email: user.email.value,
  emailVerified: user.email.isVerified,
  phone: user.phone?.value,
  phoneVerified: user.phone?.isVerified ?? false,
  firstName: user.name.firstName,
  lastName: user.name.lastName,
  displayName: user.name.displayName ?? `${user.name.firstName} ${user.name.lastName}`,
  avatarUrl: user.avatar?.url,
  role: user.role,
  createdAt: user.createdAt.toISOString(),
});
