/**
 * SMS Service Port (Interface)
 * Defines the contract for SMS sending operations (Melli Payamak)
 */

import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";

export interface ISMSService {
  sendVerificationSMS(to: string, code: string): AsyncResult<void, DomainError>;
  send(to: string, message: string): AsyncResult<void, DomainError>;
}
