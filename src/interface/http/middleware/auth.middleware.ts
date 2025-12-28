/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user context to request
 */

import { Context } from "elysia";
import { IJWTService } from "../../../application/ports/services/jwt.service";
import { ISessionRepository } from "../../../application/ports/repositories/session.repository";
import { SessionId } from "../../../domain/value-objects/session-id.vo";
import { logger } from "../../../logger";

export interface AuthContext {
  userId: string;
  sessionId: string;
  email: string;
}

export class AuthMiddleware {
  constructor(
    private readonly jwtService: IJWTService,
    private readonly sessionRepository: ISessionRepository
  ) {}

  async authenticate(context: Context): Promise<AuthContext> {
    const authHeader = context.request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Missing or invalid authorization header");
    }

    const token = authHeader.substring(7);

    // Verify JWT
    const jwtResult = await this.jwtService.verify(token);
    if (!jwtResult.success) {
      logger.warn("Invalid JWT token", { error: jwtResult.error });
      throw new Error("Invalid token");
    }

    const payload = jwtResult.value;

    // Verify session is still valid
    const sessionResult = await this.sessionRepository.findById(
      SessionId.fromString(payload.sessionId)
    );

    if (!sessionResult.success || !sessionResult.value) {
      logger.warn("Session not found", { sessionId: payload.sessionId });
      throw new Error("Session not found");
    }

    const session = sessionResult.value;

    if (!session.isValid()) {
      logger.warn("Session is invalid", { sessionId: payload.sessionId });
      throw new Error("Session is invalid or expired");
    }

    return {
      userId: payload.userId,
      sessionId: payload.sessionId,
      email: payload.email,
    };
  }

  /**
   * Extract device info from request
   */
  getDeviceInfo(context: Context) {
    const userAgent = context.request.headers.get("user-agent") || "unknown";
    const ipAddress =
      context.request.headers.get("x-forwarded-for") ||
      context.request.headers.get("x-real-ip") ||
      "unknown";

    return {
      userAgent,
      ipAddress,
      deviceType: this.detectDeviceType(userAgent),
    };
  }

  private detectDeviceType(userAgent: string): string {
    if (/mobile/i.test(userAgent)) return "mobile";
    if (/tablet/i.test(userAgent)) return "tablet";
    return "desktop";
  }
}
