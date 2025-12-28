/**
 * PassKey Service Implementation (WebAuthn)
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/typescript-types";
import {
  IPassKeyService,
  PassKeyRegistrationOptions,
  PassKeyAuthenticationOptions,
} from "../../application/ports/services/passkey.service";
import { AsyncResult, Ok, Err } from "../../shared/result";
import { DomainError, InfrastructureError, ErrorCode } from "../../shared/errors";
import { logger } from "../../logger";

export class PassKeyServiceImpl implements IPassKeyService {
  constructor(
    private readonly rpName: string,
    private readonly rpId: string,
    private readonly origin: string
  ) {}

  async generateRegistrationOptions(
    userId: string,
    email: string
  ): AsyncResult<PassKeyRegistrationOptions, DomainError> {
    try {
      const options = await generateRegistrationOptions({
        rpName: this.rpName,
        rpID: this.rpId,
        userID: userId,
        userName: email,
        userDisplayName: email,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });

      return Ok(options as unknown as PassKeyRegistrationOptions);
    } catch (error) {
      logger.error("Error generating registration options", { error });
      return Err(
        new InfrastructureError(
          "Failed to generate registration options",
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          { error }
        )
      );
    }
  }

  async verifyRegistration(
    credential: unknown
  ): AsyncResult<{ credentialId: string; publicKey: string }, DomainError> {
    try {
      const verification = await verifyRegistrationResponse({
        response: credential as RegistrationResponseJSON,
        expectedChallenge: (credential as any).challenge || "",
        expectedOrigin: this.origin,
        expectedRPID: this.rpId,
      });

      if (!verification.verified || !verification.registrationInfo) {
        throw new Error("Verification failed");
      }

      return Ok({
        credentialId: verification.registrationInfo.credentialID.toString(),
        publicKey: Buffer.from(
          verification.registrationInfo.credentialPublicKey
        ).toString("base64"),
      });
    } catch (error) {
      logger.error("Error verifying registration", { error });
      return Err(
        new InfrastructureError(
          "Failed to verify registration",
          ErrorCode.PASSKEY_INVALID,
          { error }
        )
      );
    }
  }

  async generateAuthenticationOptions(
    credentialId: string
  ): AsyncResult<PassKeyAuthenticationOptions, DomainError> {
    try {
      const options = await generateAuthenticationOptions({
        rpID: this.rpId,
        userVerification: "preferred",
      });

      return Ok(options as unknown as PassKeyAuthenticationOptions);
    } catch (error) {
      logger.error("Error generating authentication options", { error });
      return Err(
        new InfrastructureError(
          "Failed to generate authentication options",
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          { error }
        )
      );
    }
  }

  async verifyAuthentication(
    credential: unknown,
    publicKey: string
  ): AsyncResult<boolean, DomainError> {
    try {
      const verification = await verifyAuthenticationResponse({
        response: credential as AuthenticationResponseJSON,
        expectedChallenge: (credential as any).challenge || "",
        expectedOrigin: this.origin,
        expectedRPID: this.rpId,
        authenticator: {
          credentialID: Buffer.from((credential as any).id || "", "base64"),
          credentialPublicKey: Buffer.from(publicKey, "base64"),
          counter: 0,
        },
      });

      return Ok(verification.verified);
    } catch (error) {
      logger.error("Error verifying authentication", { error });
      return Err(
        new InfrastructureError(
          "Failed to verify authentication",
          ErrorCode.PASSKEY_INVALID,
          { error }
        )
      );
    }
  }
}
