/**
 * JWT Service Port (Interface)
 * Defines the contract for JWT token operations
 */

import { JWTPayload } from "../../../shared/types";
import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";

export interface IJWTService {
  sign(payload: JWTPayload): AsyncResult<string, DomainError>;
  verify(token: string): AsyncResult<JWTPayload, DomainError>;
  decode(token: string): JWTPayload | null;
}
