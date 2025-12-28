/**
 * PassKey Service Port (Interface)
 * Defines the contract for WebAuthn/PassKey operations
 */

import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";

export interface PassKeyRegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{ type: string; alg: number }>;
  authenticatorSelection: {
    authenticatorAttachment?: string;
    requireResidentKey: boolean;
    userVerification: string;
  };
  timeout: number;
  attestation: string;
}

export interface PassKeyAuthenticationOptions {
  challenge: string;
  rpId: string;
  timeout: number;
  userVerification: string;
}

export interface IPassKeyService {
  generateRegistrationOptions(userId: string, email: string): AsyncResult<PassKeyRegistrationOptions, DomainError>;
  verifyRegistration(credential: unknown): AsyncResult<{ credentialId: string; publicKey: string }, DomainError>;
  generateAuthenticationOptions(credentialId: string): AsyncResult<PassKeyAuthenticationOptions, DomainError>;
  verifyAuthentication(credential: unknown, publicKey: string): AsyncResult<boolean, DomainError>;
}
