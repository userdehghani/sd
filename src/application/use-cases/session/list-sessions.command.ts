/**
 * List Sessions Command
 */

import { Session } from "../../../domain/entities/session.entity";
import { UserId } from "../../../domain/value-objects/user-id.vo";
import { ISessionRepository } from "../../ports/repositories/session.repository";
import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";
import { logger } from "../../../logger";

export interface ListSessionsInput {
  userId: string;
}

export interface ListSessionsOutput {
  sessions: Session[];
  activeCount: number;
  totalCount: number;
}

export class ListSessionsCommand {
  constructor(private readonly sessionRepository: ISessionRepository) {}

  async execute(input: ListSessionsInput): AsyncResult<ListSessionsOutput, DomainError> {
    logger.info("Executing ListSessionsCommand", { userId: input.userId });

    const userId = UserId.fromString(input.userId);

    // Find all user sessions
    const sessionsResult = await this.sessionRepository.findByUserId(userId);
    if (!sessionsResult.success) {
      logger.error("Error finding sessions", { error: sessionsResult.error });
      return sessionsResult;
    }
    const sessions = sessionsResult.value;

    const activeCount = sessions.filter((s) => s.isValid()).length;

    logger.info("Sessions listed successfully", { 
      userId: input.userId,
      totalCount: sessions.length,
      activeCount 
    });

    return {
      success: true,
      value: {
        sessions,
        activeCount,
        totalCount: sessions.length,
      },
    };
  }
}
