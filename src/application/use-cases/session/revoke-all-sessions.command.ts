/**
 * Revoke All Sessions Command
 */

import { UserId } from "../../../domain/value-objects/user-id.vo";
import { ISessionRepository } from "../../ports/repositories/session.repository";
import { ICacheService } from "../../ports/services/cache.service";
import { IEventBusService } from "../../ports/services/event-bus.service";
import { SessionRevokedEvent } from "../../../domain/events/domain-event";
import { AsyncResult, Ok } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";
import { logger } from "../../../logger";

export interface RevokeAllSessionsInput {
  userId: string;
}

export class RevokeAllSessionsCommand {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly cacheService: ICacheService,
    private readonly eventBus: IEventBusService
  ) {}

  async execute(input: RevokeAllSessionsInput): AsyncResult<number, DomainError> {
    logger.info("Executing RevokeAllSessionsCommand", { userId: input.userId });

    const userId = UserId.fromString(input.userId);

    // Find all user sessions
    const sessionsResult = await this.sessionRepository.findByUserId(userId);
    if (!sessionsResult.success) {
      logger.error("Error finding sessions", { error: sessionsResult.error });
      return sessionsResult;
    }
    const sessions = sessionsResult.value;

    let revokedCount = 0;

    // Revoke each session
    for (const session of sessions) {
      if (session.isValid()) {
        session.revoke();
        const updateResult = await this.sessionRepository.update(session);
        if (updateResult.success) {
          revokedCount++;
          
          // Invalidate session cache
          await this.cacheService.delete(`session:${session.id.getValue()}`);

          // Publish event
          const event = new SessionRevokedEvent(
            session.id.getValue(),
            session.userId.getValue()
          );
          await this.eventBus.publish(event);
        }
      }
    }

    logger.info("All sessions revoked successfully", { 
      userId: input.userId,
      revokedCount 
    });

    return Ok(revokedCount);
  }
}
