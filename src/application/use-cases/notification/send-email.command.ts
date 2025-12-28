/**
 * Send Email Command
 */

import { IEmailService, EmailOptions } from "../../ports/services/email.service";
import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";
import { logger } from "../../../logger";

export interface SendEmailInput extends EmailOptions {}

export class SendEmailCommand {
  constructor(private readonly emailService: IEmailService) {}

  async execute(input: SendEmailInput): AsyncResult<void, DomainError> {
    logger.info("Executing SendEmailCommand", { to: input.to, subject: input.subject });

    const result = await this.emailService.send(input);
    
    if (result.success) {
      logger.info("Email sent successfully", { to: input.to });
    } else {
      logger.error("Error sending email", { error: result.error });
    }

    return result;
  }
}
