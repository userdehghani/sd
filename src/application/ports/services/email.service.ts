/**
 * Email Service Port (Interface)
 * Defines the contract for email sending operations (Resend)
 */

import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface IEmailService {
  sendVerificationEmail(to: string, code: string): AsyncResult<void, DomainError>;
  sendPasswordResetEmail(to: string, token: string): AsyncResult<void, DomainError>;
  sendWelcomeEmail(to: string, name: string): AsyncResult<void, DomainError>;
  send(options: EmailOptions): AsyncResult<void, DomainError>;
}
