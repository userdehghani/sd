/**
 * Use Case: notify.email
 * Send email notification via Resend
 */

import {
  type Result,
  type DomainError,
  ok,
  err,
  NotificationErrors,
} from "../../core";
import type { EmailPort, LoggerPort } from "../ports";

// ============================================
// Input/Output DTOs
// ============================================

export interface SendEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
}

export interface SendEmailOutput {
  sent: boolean;
  messageId?: string;
}

// ============================================
// Dependencies
// ============================================

export interface SendEmailDeps {
  email: EmailPort;
  logger: LoggerPort;
}

// ============================================
// Use Case: Send Email
// ============================================

export const sendEmailNotification =
  (deps: SendEmailDeps) =>
  async (input: SendEmailInput): Promise<Result<SendEmailOutput, DomainError>> => {
    const { email, logger } = deps;

    logger.info("Sending email notification", { 
      to: input.to, 
      subject: input.subject,
      hasTemplate: !!input.templateId,
    });

    const sendResult = await email.send({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      template: input.templateId
        ? {
            id: input.templateId,
            data: input.templateData || {},
          }
        : undefined,
    });

    if (sendResult.isErr()) {
      logger.error("Failed to send email", sendResult.error, { to: input.to });
      return err(NotificationErrors.EMAIL_SEND_FAILED(input.to));
    }

    logger.info("Email sent successfully", { to: input.to });

    return ok({ sent: true });
  };

// ============================================
// Common Email Templates
// ============================================

export interface WelcomeEmailInput {
  to: string;
  firstName: string;
}

export const sendWelcomeEmail =
  (deps: SendEmailDeps) =>
  async (input: WelcomeEmailInput): Promise<Result<SendEmailOutput, DomainError>> => {
    return sendEmailNotification(deps)({
      to: input.to,
      subject: "Welcome to our platform!",
      templateId: "welcome",
      templateData: { firstName: input.firstName },
    });
  };

export interface PasswordResetEmailInput {
  to: string;
  firstName: string;
  resetLink: string;
  expiresInMinutes: number;
}

export const sendPasswordResetEmail =
  (deps: SendEmailDeps) =>
  async (input: PasswordResetEmailInput): Promise<Result<SendEmailOutput, DomainError>> => {
    return sendEmailNotification(deps)({
      to: input.to,
      subject: "Reset your password",
      templateId: "password-reset",
      templateData: {
        firstName: input.firstName,
        resetLink: input.resetLink,
        expiresInMinutes: input.expiresInMinutes,
      },
    });
  };

export interface SessionAlertEmailInput {
  to: string;
  firstName: string;
  deviceInfo: {
    browser?: string;
    os?: string;
    ip: string;
    location?: string;
  };
  timestamp: string;
}

export const sendSessionAlertEmail =
  (deps: SendEmailDeps) =>
  async (input: SessionAlertEmailInput): Promise<Result<SendEmailOutput, DomainError>> => {
    return sendEmailNotification(deps)({
      to: input.to,
      subject: "New login to your account",
      templateId: "session-alert",
      templateData: {
        firstName: input.firstName,
        deviceInfo: input.deviceInfo,
        timestamp: input.timestamp,
      },
    });
  };
