/**
 * Revoke Session Command
 */

import { SessionId } from "../../../domain/value-objects/session-id.vo";
import { UserId } from "../../../domain/value-objects/user-id.vo";
import { ISessionRepository } from "../../ports/repositories/session.repository";
import { ICacheService } from "../../ports/services/cache.service";
import { IEventBusService } from "../../ports/services/event-bus.service";
import { SessionRevokedEvent } from "../../../domain/events/domain-event";
import { AsyncResult, Err, Ok } from "../../../shared/result";
import { DomainError, NotFoundError, AuthorizationError, ErrorCode } from "../../../shared/errors";
import { logger } from "../../../logger";

export interface RevokeSessionInput {
  sessionId: string;
  requesterId: string; // User requesting the revocation
}

export class RevokeSessionCommand {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly cacheService: ICacheService,
    private readonly eventBus: IEventBusService
  ) {}

  async execute(input: RevokeSessionInput): AsyncResult<void, DomainError> {
    logger.info("Executing RevokeSessionCommand", { sessionId: input.sessionId });

    const sessionId = SessionId.fromString(input.sessionId);
    const requesterId = UserId.fromString(input.requesterId);

    // Find session
    const sessionResult = await this.sessionRepository.findById(sessionId);
    if (!sessionResult.success) {
      logger.error("Error finding session", { error: sessionResult.error });
      return sessionResult;
    }
    if (!sessionResult.value) {
      logger.warn("Session not found", { sessionId: input.sessionId });
      return Err(new NotFoundError("Session not found"));
    }
    const session = sessionResult.value;

    // Check authorization - user can only revoke their own sessions
    if (!session.userId.equals(requesterId)) {
      logger.warn("Unauthorized session revocation attempt", { 
        sessionId: input.sessionId,
        sessionUserId: session.userId.getValue(),
        requesterId: input.requesterId 
      });
      return Err(
        new AuthorizationError("You can only revoke your own sessions", ErrorCode.FORBIDDEN)
      );
    }

    // Revoke session
    session.revoke();
    const updateResult = await this.sessionRepository.update(session);
    if (!updateResult.success) {
      logger.error("Error updating session", { error: updateResult.error });
      return updateResult;
    }

    // Invalidate session cache
    await this.cacheService.delete(`session:${input.sessionId}`);

    // Publish event
    const event = new SessionRevokedEvent(
      session.id.getValue(),
      session.userId.getValue()
    );
    await this.eventBus.publish(event);

    logger.info("Session revoked successfully", { sessionId: input.sessionId });

    return Ok(undefined);
  }
}
