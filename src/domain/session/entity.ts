/**
 * Session Entity
 * Represents an authenticated user session
 */

import type { UUID } from "../../core";
import type { SessionStatus, DeviceInfoVO, TokenClaimsVO } from "./value-objects";

// ============================================
// Session Entity
// ============================================

export interface Session {
  readonly id: string; // Session ID (e.g., sess_xxxxx)
  readonly userId: UUID;
  readonly status: SessionStatus;
  readonly deviceInfo: DeviceInfoVO;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly lastActivityAt: Date;
  readonly revokedAt?: Date;
  readonly revokedReason?: string;
  readonly metadata?: Record<string, unknown>;
}

// ============================================
// Session Creation
// ============================================

export interface CreateSessionParams {
  readonly id: string;
  readonly userId: UUID;
  readonly deviceInfo: DeviceInfoVO;
  readonly expiresInSeconds: number;
  readonly metadata?: Record<string, unknown>;
}

export const createSession = (params: CreateSessionParams): Session => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + params.expiresInSeconds * 1000);

  return {
    id: params.id,
    userId: params.userId,
    status: "active",
    deviceInfo: params.deviceInfo,
    createdAt: now,
    expiresAt,
    lastActivityAt: now,
    metadata: params.metadata,
  };
};

// ============================================
// Session Update Functions (Immutable)
// ============================================

export const updateLastActivity = (session: Session): Session => ({
  ...session,
  lastActivityAt: new Date(),
});

export const revokeSession = (session: Session, reason?: string): Session => ({
  ...session,
  status: "revoked",
  revokedAt: new Date(),
  revokedReason: reason,
});

export const expireSession = (session: Session): Session => ({
  ...session,
  status: "expired",
});

// ============================================
// Session Validation
// ============================================

export const isSessionValid = (session: Session): boolean => {
  if (session.status !== "active") {
    return false;
  }
  
  const now = new Date();
  if (session.expiresAt <= now) {
    return false;
  }

  return true;
};

export const shouldRefreshSession = (
  session: Session,
  refreshThresholdSeconds: number = 3600 // 1 hour before expiry
): boolean => {
  if (!isSessionValid(session)) {
    return false;
  }

  const now = new Date();
  const thresholdTime = new Date(session.expiresAt.getTime() - refreshThresholdSeconds * 1000);
  
  return now >= thresholdTime;
};

// ============================================
// Session Serialization
// ============================================

export interface SessionDTO {
  id: string;
  userId: string;
  status: SessionStatus;
  deviceInfo: {
    userAgent: string;
    ip: string;
    browser?: string;
    os?: string;
    device?: string;
    location?: {
      country?: string;
      city?: string;
      timezone?: string;
    };
  };
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
  revokedAt?: string;
  revokedReason?: string;
}

export const toSessionDTO = (session: Session): SessionDTO => ({
  id: session.id,
  userId: session.userId,
  status: session.status,
  deviceInfo: session.deviceInfo,
  createdAt: session.createdAt.toISOString(),
  expiresAt: session.expiresAt.toISOString(),
  lastActivityAt: session.lastActivityAt.toISOString(),
  revokedAt: session.revokedAt?.toISOString(),
  revokedReason: session.revokedReason,
});

// ============================================
// Session List Item (for listing user sessions)
// ============================================

export interface SessionListItem {
  readonly id: string;
  readonly isCurrent: boolean;
  readonly deviceInfo: {
    readonly browser?: string;
    readonly os?: string;
    readonly device?: string;
    readonly ip: string;
    readonly location?: {
      readonly country?: string;
      readonly city?: string;
    };
  };
  readonly createdAt: string;
  readonly lastActivityAt: string;
  readonly expiresAt: string;
}

export const toSessionListItem = (
  session: Session,
  currentSessionId?: string
): SessionListItem => ({
  id: session.id,
  isCurrent: session.id === currentSessionId,
  deviceInfo: {
    browser: session.deviceInfo.browser,
    os: session.deviceInfo.os,
    device: session.deviceInfo.device,
    ip: session.deviceInfo.ip,
    location: session.deviceInfo.location
      ? {
          country: session.deviceInfo.location.country,
          city: session.deviceInfo.location.city,
        }
      : undefined,
  },
  createdAt: session.createdAt.toISOString(),
  lastActivityAt: session.lastActivityAt.toISOString(),
  expiresAt: session.expiresAt.toISOString(),
});
