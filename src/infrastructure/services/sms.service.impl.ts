/**
 * SMS Service Implementation (Melli Payamak)
 */

import { ISMSService } from "../../application/ports/services/sms.service";
import { AsyncResult, Ok, Err } from "../../shared/result";
import { DomainError, InfrastructureError, ErrorCode } from "../../shared/errors";
import { logger } from "../../logger";

export class SMSServiceImpl implements ISMSService {
  constructor(
    private readonly username: string,
    private readonly password: string,
    private readonly fromNumber: string
  ) {}

  async sendVerificationSMS(to: string, code: string): AsyncResult<void, DomainError> {
    const message = `Your verification code is: ${code}`;
    return this.send(to, message);
  }

  async send(to: string, message: string): AsyncResult<void, DomainError> {
    try {
      // Melli Payamak REST API
      const response = await fetch("https://rest.payamak-panel.com/api/SendSMS/SendSMS", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
          to,
          from: this.fromNumber,
          text: message,
          isflash: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Melli Payamak API error: ${error}`);
      }

      const result = await response.json();

      if (result.RetStatus !== 1) {
        throw new Error(`SMS send failed: ${result.StrRetStatus}`);
      }

      logger.info("SMS sent successfully", { to });
      return Ok(undefined);
    } catch (error) {
      logger.error("Error sending SMS", { error, to });
      return Err(
        new InfrastructureError(
          "Failed to send SMS",
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          { error }
        )
      );
    }
  }
}
