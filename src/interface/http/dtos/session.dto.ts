/**
 * Session DTOs
 */

export interface SessionResponseDto {
  id: string;
  userId: string;
  deviceInfo: {
    userAgent: string;
    ipAddress: string;
    deviceType?: string;
  };
  isRevoked: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface SessionListResponseDto {
  sessions: SessionResponseDto[];
  activeCount: number;
  totalCount: number;
}
