/**
 * Session Value Objects
 */

// ============================================
// Session Status
// ============================================

export type SessionStatus = "active" | "expired" | "revoked";

export const isActiveSession = (status: SessionStatus): boolean =>
  status === "active";

// ============================================
// Device Info Value Object
// ============================================

export interface DeviceInfoVO {
  readonly userAgent: string;
  readonly ip: string;
  readonly browser?: string;
  readonly os?: string;
  readonly device?: string;
  readonly location?: {
    readonly country?: string;
    readonly city?: string;
    readonly timezone?: string;
  };
}

export const createDeviceInfo = (
  userAgent: string,
  ip: string,
  parsed?: {
    browser?: string;
    os?: string;
    device?: string;
  },
  location?: DeviceInfoVO["location"]
): DeviceInfoVO => ({
  userAgent,
  ip,
  browser: parsed?.browser,
  os: parsed?.os,
  device: parsed?.device,
  location,
});

// ============================================
// Token Claims Value Object
// ============================================

export interface TokenClaimsVO {
  readonly sub: string; // User ID
  readonly sid: string; // Session ID
  readonly email: string;
  readonly role: string;
  readonly iat: number; // Issued at
  readonly exp: number; // Expires at
  readonly iss: string; // Issuer
  readonly aud: string; // Audience
}

export const createTokenClaims = (params: {
  userId: string;
  sessionId: string;
  email: string;
  role: string;
  issuer: string;
  audience: string;
  expiresInSeconds: number;
}): TokenClaimsVO => {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: params.userId,
    sid: params.sessionId,
    email: params.email,
    role: params.role,
    iat: now,
    exp: now + params.expiresInSeconds,
    iss: params.issuer,
    aud: params.audience,
  };
};

export const isTokenExpired = (claims: TokenClaimsVO): boolean => {
  const now = Math.floor(Date.now() / 1000);
  return claims.exp <= now;
};
