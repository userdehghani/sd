/**
 * TOTP Service Port (Interface)
 * Defines the contract for Time-based One-Time Password operations
 */

import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";

export interface TOTPSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface ITOTPService {
  generateSecret(): AsyncResult<TOTPSetup, DomainError>;
  verifyToken(secret: string, token: string): AsyncResult<boolean, DomainError>;
}
