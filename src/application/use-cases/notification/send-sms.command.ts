/**
 * Send SMS Command
 */

import { ISMSService } from "../../ports/services/sms.service";
import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";
import { logger } from "../../../logger";

export interface SendSMSInput {
  to: string;
  message: string;
}

export class SendSMSCommand {
  constructor(private readonly smsService: ISMSService) {}

  async execute(input: SendSMSInput): AsyncResult<void, DomainError> {
    logger.info("Executing SendSMSCommand", { to: input.to });

    const result = await this.smsService.send(input.to, input.message);
    
    if (result.success) {
      logger.info("SMS sent successfully", { to: input.to });
    } else {
      logger.error("Error sending SMS", { error: result.error });
    }

    return result;
  }
}
