/**
 * Request/Response Validation Schemas
 * Using Elysia's built-in type validation
 */

import { t } from "elysia";

// ============================================
// Common Schemas
// ============================================

export const EmailSchema = t.String({
  format: "email",
  error: "Invalid email address",
});

export const PhoneSchema = t.String({
  pattern: "^\\+?[1-9]\\d{6,14}$",
  error: "Invalid phone number",
});

export const UUIDSchema = t.String({
  format: "uuid",
  error: "Invalid UUID",
});

export const PasswordSchema = t.String({
  minLength: 8,
  maxLength: 128,
  error: "Password must be between 8 and 128 characters",
});

export const TOTPCodeSchema = t.String({
  pattern: "^\\d{6}$",
  error: "TOTP code must be 6 digits",
});

// ============================================
// Auth Schemas
// ============================================

export const RegisterTOTPSchema = {
  body: t.Object({
    email: EmailSchema,
    firstName: t.String({ minLength: 1, maxLength: 50 }),
    lastName: t.String({ minLength: 1, maxLength: 50 }),
  }),
};

export const VerifyTOTPSchema = {
  body: t.Object({
    userId: t.String(),
    code: TOTPCodeSchema,
  }),
};

export const LoginTOTPInitSchema = {
  body: t.Object({
    email: EmailSchema,
  }),
};

export const LoginTOTPCompleteSchema = {
  body: t.Object({
    loginToken: t.String(),
    code: TOTPCodeSchema,
  }),
};

export const OAuthCallbackSchema = {
  query: t.Object({
    code: t.String(),
    state: t.String(),
  }),
};

export const PasskeyRegisterInitSchema = {
  body: t.Object({
    email: EmailSchema,
    firstName: t.String({ minLength: 1, maxLength: 50 }),
    lastName: t.String({ minLength: 1, maxLength: 50 }),
  }),
};

export const PasskeyRegisterCompleteSchema = {
  body: t.Object({
    userId: t.String(),
    response: t.Any(), // WebAuthn response
  }),
};

export const PasskeyLoginInitSchema = {
  body: t.Object({
    email: t.Optional(EmailSchema),
  }),
};

export const PasskeyLoginCompleteSchema = {
  body: t.Object({
    loginToken: t.String(),
    response: t.Any(), // WebAuthn response
  }),
};

// ============================================
// Session Schemas
// ============================================

export const RevokeSessionSchema = {
  body: t.Object({
    sessionId: t.String(),
    reason: t.Optional(t.String({ maxLength: 255 })),
  }),
};

export const RevokeAllSessionsSchema = {
  body: t.Object({
    keepCurrent: t.Optional(t.Boolean()),
    reason: t.Optional(t.String({ maxLength: 255 })),
  }),
};

// ============================================
// Profile Schemas
// ============================================

export const UpdateProfileSchema = {
  body: t.Object({
    firstName: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
    lastName: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
    displayName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  }),
};

export const SetPhoneSchema = {
  body: t.Object({
    phone: PhoneSchema,
  }),
};

export const VerifyCodeSchema = {
  body: t.Object({
    code: t.String({ minLength: 4, maxLength: 8 }),
  }),
};

// ============================================
// Storage Schemas
// ============================================

export const UploadAvatarSchema = {
  body: t.Object({
    file: t.File({
      maxSize: "5m",
      types: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    }),
  }),
};

// ============================================
// Response Schemas
// ============================================

export const ErrorResponseSchema = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
    metadata: t.Optional(t.Any()),
  }),
});

export const SuccessResponseSchema = t.Object({
  success: t.Boolean(),
});

export const TokenResponseSchema = t.Object({
  accessToken: t.String(),
  sessionId: t.String(),
  expiresAt: t.String(),
  user: t.Object({
    id: t.String(),
    email: t.String(),
    firstName: t.String(),
    lastName: t.String(),
  }),
});

export const ProfileResponseSchema = t.Object({
  profile: t.Object({
    id: t.String(),
    email: t.String(),
    emailVerified: t.Boolean(),
    phone: t.Optional(t.String()),
    phoneVerified: t.Boolean(),
    firstName: t.String(),
    lastName: t.String(),
    displayName: t.String(),
    avatarUrl: t.Optional(t.String()),
    role: t.String(),
    createdAt: t.String(),
  }),
});

export const SessionListResponseSchema = t.Object({
  sessions: t.Array(
    t.Object({
      id: t.String(),
      isCurrent: t.Boolean(),
      deviceInfo: t.Object({
        browser: t.Optional(t.String()),
        os: t.Optional(t.String()),
        device: t.Optional(t.String()),
        ip: t.String(),
        location: t.Optional(
          t.Object({
            country: t.Optional(t.String()),
            city: t.Optional(t.String()),
          })
        ),
      }),
      createdAt: t.String(),
      lastActivityAt: t.String(),
      expiresAt: t.String(),
    })
  ),
  total: t.Number(),
});
