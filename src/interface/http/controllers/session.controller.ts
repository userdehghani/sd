/**
 * Session Controller
 * Handles session management HTTP requests
 */

import { Context } from "elysia";
import { ListSessionsCommand } from "../../../application/use-cases/session/list-sessions.command";
import { RevokeSessionCommand } from "../../../application/use-cases/session/revoke-session.command";
import { RevokeAllSessionsCommand } from "../../../application/use-cases/session/revoke-all-sessions.command";
import { AuthContext } from "../middleware/auth.middleware";
import { SessionResponseDto, SessionListResponseDto } from "../dtos/session.dto";
import { logger } from "../../../logger";

export class SessionController {
  constructor(
    private readonly listSessionsCommand: ListSessionsCommand,
    private readonly revokeSessionCommand: RevokeSessionCommand,
    private readonly revokeAllSessionsCommand: RevokeAllSessionsCommand
  ) {}

  async listSessions(context: Context & { auth: AuthContext }) {
    const result = await this.listSessionsCommand.execute({
      userId: context.auth.userId,
    });

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    const response: SessionListResponseDto = {
      sessions: result.value.sessions.map((session) => ({
        id: session.id.getValue(),
        userId: session.userId.getValue(),
        deviceInfo: session.deviceInfo,
        isRevoked: session.isRevoked,
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
      })),
      activeCount: result.value.activeCount,
      totalCount: result.value.totalCount,
    };

    return response;
  }

  async revokeSession(context: Context & { auth: AuthContext }) {
    const sessionId = context.params.sessionId as string;

    const result = await this.revokeSessionCommand.execute({
      sessionId,
      requesterId: context.auth.userId,
    });

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    return { message: "Session revoked successfully" };
  }

  async revokeAllSessions(context: Context & { auth: AuthContext }) {
    const result = await this.revokeAllSessionsCommand.execute({
      userId: context.auth.userId,
    });

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    return {
      message: "All sessions revoked successfully",
      revokedCount: result.value,
    };
  }

  private getStatusCode(error: any): number {
    const code = error.code || "INTERNAL_ERROR";
    
    switch (code) {
      case "UNAUTHORIZED":
        return 401;
      case "FORBIDDEN":
        return 403;
      case "NOT_FOUND":
        return 404;
      case "VALIDATION_ERROR":
        return 400;
      default:
        return 500;
    }
  }
}
