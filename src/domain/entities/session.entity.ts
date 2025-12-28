/**
 * Session Entity
 * Represents a user authentication session
 */

import { SessionId } from "../value-objects/session-id.vo";
import { UserId } from "../value-objects/user-id.vo";
import { Timestamp } from "../../shared/types";

export interface SessionProps {
  id: SessionId;
  userId: UserId;
  deviceInfo: {
    userAgent: string;
    ipAddress: string;
    deviceType?: string;
  };
  isRevoked: boolean;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  revokedAt?: Timestamp;
}

export class Session {
  private constructor(private props: SessionProps) {}

  static create(
    userId: UserId,
    deviceInfo: { userAgent: string; ipAddress: string; deviceType?: string },
    expiresIn: number = 30 * 24 * 60 * 60 * 1000 // 30 days default
  ): Session {
    const now = new Date();
    return new Session({
      id: SessionId.create(),
      userId,
      deviceInfo,
      isRevoked: false,
      expiresAt: new Date(now.getTime() + expiresIn),
      createdAt: now,
    });
  }

  static reconstitute(props: SessionProps): Session {
    return new Session(props);
  }

  // Getters
  get id(): SessionId {
    return this.props.id;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get deviceInfo() {
    return { ...this.props.deviceInfo };
  }

  get isRevoked(): boolean {
    return this.props.isRevoked;
  }

  get expiresAt(): Timestamp {
    return this.props.expiresAt;
  }

  get createdAt(): Timestamp {
    return this.props.createdAt;
  }

  get revokedAt(): Timestamp | undefined {
    return this.props.revokedAt;
  }

  // Domain methods
  isValid(): boolean {
    return !this.props.isRevoked && new Date() < this.props.expiresAt;
  }

  isExpired(): boolean {
    return new Date() >= this.props.expiresAt;
  }

  revoke(): void {
    this.props.isRevoked = true;
    this.props.revokedAt = new Date();
  }

  toJSON() {
    return {
      id: this.props.id.getValue(),
      userId: this.props.userId.getValue(),
      deviceInfo: this.props.deviceInfo,
      isRevoked: this.props.isRevoked,
      expiresAt: this.props.expiresAt,
      createdAt: this.props.createdAt,
      revokedAt: this.props.revokedAt,
    };
  }
}
