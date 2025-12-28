/**
 * Melli Payamak SMS Adapter - Singleton Pattern
 * https://www.melipayamak.com
 */

import {
  type Result,
  ok,
  err,
  NotificationErrors,
  InfraErrors,
  type DomainError,
} from "../../../core";
import type { SMSPort, SendSMSParams, LoggerPort } from "../../../application/ports";

// ============================================
// Types
// ============================================

export interface MelliPayamakConfig {
  username: string;
  password: string;
  from: string; // Sender number
  apiUrl?: string;
}

// ============================================
// Singleton Implementation
// ============================================

let instance: SMSPort | null = null;

export const createMelliPayamakClient = (
  config: MelliPayamakConfig,
  logger: LoggerPort
): SMSPort => {
  if (instance) {
    logger.debug("Returning existing Melli Payamak client instance");
    return instance;
  }

  logger.info("Creating Melli Payamak SMS client");

  const apiUrl = config.apiUrl || "https://rest.payamak-panel.com/api/SendSMS/SendSMS";

  const client: SMSPort = {
    async send(params: SendSMSParams): Promise<Result<void, DomainError>> {
      try {
        logger.info("Sending SMS via Melli Payamak", {
          to: params.to,
          messageLength: params.message.length,
        });

        // Normalize phone number (ensure it's in correct format for Iran)
        let phoneNumber = params.to.replace(/[\s\-()]/g, "");
        
        // Convert +98 to 0
        if (phoneNumber.startsWith("+98")) {
          phoneNumber = "0" + phoneNumber.slice(3);
        }
        // Convert 98 to 0
        else if (phoneNumber.startsWith("98") && phoneNumber.length > 10) {
          phoneNumber = "0" + phoneNumber.slice(2);
        }

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: config.username,
            password: config.password,
            from: config.from,
            to: phoneNumber,
            text: params.message,
            isFlash: false,
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          logger.error("Melli Payamak API error", undefined, {
            status: response.status,
            error: errorData,
          });
          return err(NotificationErrors.SMS_SEND_FAILED(params.to));
        }

        const result = await response.json();

        // Melli Payamak returns RetStatus for success/failure
        // RetStatus > 0 means success (returns message ID)
        // RetStatus < 0 means error
        if (result.RetStatus < 0) {
          logger.error("Melli Payamak send failed", undefined, {
            retStatus: result.RetStatus,
            strRetStatus: result.StrRetStatus,
          });
          return err(NotificationErrors.SMS_SEND_FAILED(params.to));
        }

        logger.info("SMS sent successfully", {
          to: params.to,
          messageId: result.RetStatus,
        });

        return ok(undefined);
      } catch (error) {
        logger.error("SMS send failed", error as Error, { to: params.to });
        return err(NotificationErrors.SMS_SEND_FAILED(params.to));
      }
    },
  };

  instance = client;
  return client;
};

export const getMelliPayamakClient = (): SMSPort | null => instance;

export const resetMelliPayamakClient = (): void => {
  instance = null;
};

// ============================================
// Alternative: Pattern-based SMS
// For services that support pattern/template-based SMS
// ============================================

export interface MelliPayamakPatternConfig extends MelliPayamakConfig {
  patternApiUrl?: string;
}

export const createMelliPayamakPatternClient = (
  config: MelliPayamakPatternConfig,
  logger: LoggerPort
) => {
  const patternApiUrl =
    config.patternApiUrl || "https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber";

  return {
    async sendWithPattern(
      to: string,
      bodyId: number, // Pattern ID registered in panel
      values: string[] // Pattern variable values
    ): Promise<Result<void, DomainError>> {
      try {
        logger.info("Sending pattern SMS via Melli Payamak", {
          to,
          bodyId,
        });

        // Normalize phone number
        let phoneNumber = to.replace(/[\s\-()]/g, "");
        if (phoneNumber.startsWith("+98")) {
          phoneNumber = "0" + phoneNumber.slice(3);
        }

        const response = await fetch(patternApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: config.username,
            password: config.password,
            to: phoneNumber,
            bodyId,
            text: values.join(";"),
          }),
        });

        if (!response.ok) {
          return err(NotificationErrors.SMS_SEND_FAILED(to));
        }

        const result = await response.json();

        if (result.RetStatus < 0) {
          logger.error("Melli Payamak pattern send failed", undefined, {
            retStatus: result.RetStatus,
          });
          return err(NotificationErrors.SMS_SEND_FAILED(to));
        }

        logger.info("Pattern SMS sent successfully", { to });
        return ok(undefined);
      } catch (error) {
        logger.error("Pattern SMS send failed", error as Error, { to });
        return err(NotificationErrors.SMS_SEND_FAILED(to));
      }
    },
  };
};
