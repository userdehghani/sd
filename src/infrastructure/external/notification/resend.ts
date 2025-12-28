/**
 * Resend Email Adapter - Singleton Pattern
 * https://resend.com
 */

import {
  type Result,
  ok,
  err,
  NotificationErrors,
  InfraErrors,
  type DomainError,
} from "../../../core";
import type { EmailPort, SendEmailParams, LoggerPort } from "../../../application/ports";

// ============================================
// Types
// ============================================

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
}

// ============================================
// Email Templates
// ============================================

const templates: Record<string, (data: Record<string, unknown>) => { subject?: string; html: string; text: string }> = {
  welcome: (data) => ({
    html: `
      <h1>Welcome, ${data.firstName}!</h1>
      <p>Thank you for joining our platform. We're excited to have you on board.</p>
      <p>If you have any questions, feel free to reach out to our support team.</p>
    `,
    text: `Welcome, ${data.firstName}! Thank you for joining our platform.`,
  }),
  
  "email-verification": (data) => ({
    html: `
      <h1>Verify Your Email</h1>
      <p>Hi ${data.firstName},</p>
      <p>Your verification code is: <strong>${data.code}</strong></p>
      <p>This code will expire in ${data.expiresInMinutes} minutes.</p>
    `,
    text: `Hi ${data.firstName}, Your verification code is: ${data.code}. It expires in ${data.expiresInMinutes} minutes.`,
  }),
  
  "password-reset": (data) => ({
    html: `
      <h1>Reset Your Password</h1>
      <p>Hi ${data.firstName},</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${data.resetLink}">${data.resetLink}</a></p>
      <p>This link will expire in ${data.expiresInMinutes} minutes.</p>
    `,
    text: `Hi ${data.firstName}, Reset your password: ${data.resetLink}. Expires in ${data.expiresInMinutes} minutes.`,
  }),
  
  "session-alert": (data) => ({
    html: `
      <h1>New Login Detected</h1>
      <p>Hi ${data.firstName},</p>
      <p>We detected a new login to your account:</p>
      <ul>
        <li>Browser: ${(data.deviceInfo as any)?.browser || "Unknown"}</li>
        <li>OS: ${(data.deviceInfo as any)?.os || "Unknown"}</li>
        <li>IP: ${(data.deviceInfo as any)?.ip || "Unknown"}</li>
        <li>Location: ${(data.deviceInfo as any)?.location || "Unknown"}</li>
        <li>Time: ${data.timestamp}</li>
      </ul>
      <p>If this wasn't you, please secure your account immediately.</p>
    `,
    text: `Hi ${data.firstName}, New login detected at ${data.timestamp}. If this wasn't you, secure your account.`,
  }),
};

// ============================================
// Singleton Implementation
// ============================================

let instance: EmailPort | null = null;

export const createResendClient = (
  config: ResendConfig,
  logger: LoggerPort
): EmailPort => {
  if (instance) {
    logger.debug("Returning existing Resend client instance");
    return instance;
  }

  logger.info("Creating Resend email client");

  const client: EmailPort = {
    async send(params: SendEmailParams): Promise<Result<void, DomainError>> {
      try {
        logger.info("Sending email via Resend", {
          to: params.to,
          subject: params.subject,
          template: params.template?.id,
        });

        let html = params.html;
        let text = params.text;

        // Apply template if specified
        if (params.template) {
          const templateFn = templates[params.template.id];
          if (!templateFn) {
            logger.error("Email template not found", undefined, { templateId: params.template.id });
            return err(NotificationErrors.INVALID_TEMPLATE(params.template.id));
          }

          const rendered = templateFn(params.template.data);
          html = html || rendered.html;
          text = text || rendered.text;
        }

        // In production:
        // const resend = new Resend(config.apiKey);
        // await resend.emails.send({
        //   from: config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail,
        //   to: params.to,
        //   subject: params.subject,
        //   html,
        //   text,
        //   reply_to: config.replyTo,
        // });

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: config.fromName
              ? `${config.fromName} <${config.fromEmail}>`
              : config.fromEmail,
            to: params.to,
            subject: params.subject,
            html,
            text,
            reply_to: config.replyTo,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          logger.error("Resend API error", undefined, {
            status: response.status,
            error: errorData,
          });
          return err(NotificationErrors.EMAIL_SEND_FAILED(params.to));
        }

        logger.info("Email sent successfully", { to: params.to });

        return ok(undefined);
      } catch (error) {
        logger.error("Email send failed", error as Error, { to: params.to });
        return err(NotificationErrors.EMAIL_SEND_FAILED(params.to));
      }
    },
  };

  instance = client;
  return client;
};

export const getResendClient = (): EmailPort | null => instance;

export const resetResendClient = (): void => {
  instance = null;
};
