/**
 * Use Case: notify.sms
 * Send SMS notification via Melli Payamak
 */

import {
  type Result,
  type DomainError,
  ok,
  err,
  NotificationErrors,
} from "../../core";
import type { SMSPort, LoggerPort } from "../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface SendSMSInput {
  to: string;
  message: string;
}

export interface SendSMSOutput {
  sent: boolean;
  messageId?: string;
}

// ============================================
// Dependencies
// ============================================

export interface SendSMSDeps {
  sms: SMSPort;
  logger: LoggerPort;
}

// ============================================
// Use Case: Send SMS
// ============================================

export const sendSMSNotification =
  (deps: SendSMSDeps) =>
  async (input: SendSMSInput): Promise<Result<SendSMSOutput, DomainError>> => {
    const { sms, logger } = deps;

    logger.info("Sending SMS notification", { 
      to: input.to,
      messageLength: input.message.length,
    });

    const sendResult = await sms.send({
      to: input.to,
      message: input.message,
    });

    if (sendResult.isErr()) {
      logger.error("Failed to send SMS", sendResult.error, { to: input.to });
      return err(NotificationErrors.SMS_SEND_FAILED(input.to));
    }

    logger.info("SMS sent successfully", { to: input.to });

    return ok({ sent: true });
  };

// ============================================
// Common SMS Templates
// ============================================

export interface VerificationSMSInput {
  to: string;
  code: string;
  expiresInMinutes: number;
}

export const sendVerificationSMS =
  (deps: SendSMSDeps) =>
  async (input: VerificationSMSInput): Promise<Result<SendSMSOutput, DomainError>> => {
    const message = `Your verification code is: ${input.code}. Valid for ${input.expiresInMinutes} minutes.`;
    return sendSMSNotification(deps)({
      to: input.to,
      message,
    });
  };

export interface LoginAlertSMSInput {
  to: string;
  deviceInfo: string;
}

export const sendLoginAlertSMS =
  (deps: SendSMSDeps) =>
  async (input: LoginAlertSMSInput): Promise<Result<SendSMSOutput, DomainError>> => {
    const message = `New login detected on ${input.deviceInfo}. If this wasn't you, secure your account immediately.`;
    return sendSMSNotification(deps)({
      to: input.to,
      message,
    });
  };
