/**
 * Email Service Implementation (Resend)
 */

import { IEmailService, EmailOptions } from "../../application/ports/services/email.service";
import { AsyncResult, Ok, Err } from "../../shared/result";
import { DomainError, InfrastructureError, ErrorCode } from "../../shared/errors";
import { logger } from "../../logger";

export class EmailServiceImpl implements IEmailService {
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string = "MyApp"
  ) {}

  async sendVerificationEmail(to: string, code: string): AsyncResult<void, DomainError> {
    return this.send({
      to,
      subject: "Verify your email",
      html: this.getVerificationEmailTemplate(code),
      text: `Your verification code is: ${code}`,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): AsyncResult<void, DomainError> {
    return this.send({
      to,
      subject: "Reset your password",
      html: this.getPasswordResetEmailTemplate(token),
      text: `Reset your password using this token: ${token}`,
    });
  }

  async sendWelcomeEmail(to: string, name: string): AsyncResult<void, DomainError> {
    return this.send({
      to,
      subject: "Welcome to MyApp",
      html: this.getWelcomeEmailTemplate(name),
      text: `Welcome to MyApp, ${name}!`,
    });
  }

  async send(options: EmailOptions): AsyncResult<void, DomainError> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Resend API error: ${error}`);
      }

      logger.info("Email sent successfully", { to: options.to });
      return Ok(undefined);
    } catch (error) {
      logger.error("Error sending email", { error, to: options.to });
      return Err(
        new InfrastructureError(
          "Failed to send email",
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          { error }
        )
      );
    }
  }

  private getVerificationEmailTemplate(code: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .code { font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 5px; }
            .footer { margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Verify your email address</h2>
            <p>Please use the following code to verify your email:</p>
            <p class="code">${code}</p>
            <p>This code will expire in 10 minutes.</p>
            <p class="footer">If you didn't request this, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  private getPasswordResetEmailTemplate(token: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
            .footer { margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Reset your password</h2>
            <p>Click the button below to reset your password:</p>
            <a href="${token}" class="button">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p class="footer">If you didn't request this, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;
  }

  private getWelcomeEmailTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .footer { margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Welcome to MyApp, ${name}! 🎉</h2>
            <p>We're excited to have you on board.</p>
            <p>Get started by exploring our features and completing your profile.</p>
            <p class="footer">Thanks for joining us!</p>
          </div>
        </body>
      </html>
    `;
  }
}
