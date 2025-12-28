/**
 * Passkey (WebAuthn) Service - Singleton Pattern
 */

import {
  type Result,
  ok,
  err,
  AuthErrors,
  InfraErrors,
  type DomainError,
  generateShortId,
} from "../../core";
import type {
  PasskeyPort,
  PasskeyRegistrationParams,
  PasskeyRegistrationOptions,
  VerifyRegistrationParams,
  PasskeyCredential,
  PasskeyAuthenticationParams,
  PasskeyAuthenticationOptions,
  VerifyAuthenticationParams,
  PasskeyAuthenticationResult,
  LoggerPort,
} from "../../application/ports";

// ============================================
// Types
// ============================================

export interface PasskeyConfig {
  rpId: string;
  rpName: string;
  rpOrigin: string;
  timeout?: number;
  attestation?: "none" | "indirect" | "direct" | "enterprise";
  userVerification?: "required" | "preferred" | "discouraged";
}

// ============================================
// Singleton Implementation
// ============================================

let instance: PasskeyPort | null = null;

export const createPasskeyService = (
  config: PasskeyConfig,
  logger: LoggerPort
): PasskeyPort => {
  if (instance) {
    logger.debug("Returning existing Passkey service instance");
    return instance;
  }

  logger.info("Creating Passkey service");

  // In production, use @simplewebauthn/server
  // import {
  //   generateRegistrationOptions,
  //   verifyRegistrationResponse,
  //   generateAuthenticationOptions,
  //   verifyAuthenticationResponse,
  // } from '@simplewebauthn/server';

  const timeout = config.timeout || 60000;
  const attestation = config.attestation || "none";
  const userVerification = config.userVerification || "preferred";

  const service: PasskeyPort = {
    async generateRegistrationOptions(
      params: PasskeyRegistrationParams
    ): Promise<Result<PasskeyRegistrationOptions, DomainError>> {
      try {
        logger.debug("Generating passkey registration options", {
          userId: params.userId,
        });

        // In production with @simplewebauthn/server:
        // const options = await generateRegistrationOptions({
        //   rpName: params.rpName,
        //   rpID: params.rpId,
        //   userID: params.userId,
        //   userName: params.userEmail,
        //   userDisplayName: params.userName,
        //   attestationType: attestation,
        //   excludeCredentials: params.existingCredentialIds?.map(id => ({
        //     id: Buffer.from(id, 'base64url'),
        //     type: 'public-key',
        //   })),
        //   authenticatorSelection: {
        //     userVerification,
        //   },
        //   timeout,
        // });

        // Generate challenge
        const challengeBytes = new Uint8Array(32);
        crypto.getRandomValues(challengeBytes);
        const challenge = btoa(String.fromCharCode(...challengeBytes))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");

        const options: PasskeyRegistrationOptions = {
          challenge,
          rp: {
            id: params.rpId,
            name: params.rpName,
          },
          user: {
            id: params.userId,
            name: params.userEmail,
            displayName: params.userName,
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" }, // ES256
            { alg: -257, type: "public-key" }, // RS256
          ],
          timeout,
          attestation,
          excludeCredentials: params.existingCredentialIds?.map((id) => ({
            id,
            type: "public-key",
          })),
        };

        return ok(options);
      } catch (error) {
        logger.error("Passkey registration options generation failed", error as Error);
        return err(InfraErrors.EXTERNAL_SERVICE_ERROR("Passkey", error as Error));
      }
    },

    async verifyRegistration(
      params: VerifyRegistrationParams
    ): Promise<Result<PasskeyCredential, DomainError>> {
      try {
        logger.debug("Verifying passkey registration");

        // In production with @simplewebauthn/server:
        // const verification = await verifyRegistrationResponse({
        //   response: params.response,
        //   expectedChallenge: params.expectedChallenge,
        //   expectedOrigin: params.expectedOrigin,
        //   expectedRPID: params.expectedRPID,
        // });
        //
        // if (!verification.verified || !verification.registrationInfo) {
        //   return err(AuthErrors.PASSKEY_CHALLENGE_FAILED());
        // }
        //
        // return ok({
        //   id: verification.registrationInfo.credentialID.toString('base64url'),
        //   publicKey: verification.registrationInfo.credentialPublicKey.toString('base64url'),
        //   counter: verification.registrationInfo.counter,
        //   deviceType: verification.registrationInfo.credentialDeviceType,
        //   backedUp: verification.registrationInfo.credentialBackedUp,
        //   transports: verification.registrationInfo.transports,
        // });

        // Placeholder verification for demonstration
        const response = params.response as any;

        if (!response || !response.id) {
          return err(AuthErrors.PASSKEY_CHALLENGE_FAILED());
        }

        // In a real implementation, you would verify the attestation
        // and extract the public key from the response

        const credential: PasskeyCredential = {
          id: response.id || generateShortId(32),
          publicKey: response.publicKey || generateShortId(64),
          counter: 0,
          deviceType: response.authenticatorAttachment === "platform" ? "platform" : "cross-platform",
          backedUp: false,
          transports: response.transports,
        };

        return ok(credential);
      } catch (error) {
        logger.error("Passkey registration verification failed", error as Error);
        return err(AuthErrors.PASSKEY_CHALLENGE_FAILED());
      }
    },

    async generateAuthenticationOptions(
      params: PasskeyAuthenticationParams
    ): Promise<Result<PasskeyAuthenticationOptions, DomainError>> {
      try {
        logger.debug("Generating passkey authentication options");

        // Generate challenge
        const challengeBytes = new Uint8Array(32);
        crypto.getRandomValues(challengeBytes);
        const challenge = btoa(String.fromCharCode(...challengeBytes))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");

        const options: PasskeyAuthenticationOptions = {
          challenge,
          timeout,
          rpId: params.rpId,
          allowCredentials: params.allowCredentials,
          userVerification,
        };

        return ok(options);
      } catch (error) {
        logger.error("Passkey authentication options generation failed", error as Error);
        return err(InfraErrors.EXTERNAL_SERVICE_ERROR("Passkey", error as Error));
      }
    },

    async verifyAuthentication(
      params: VerifyAuthenticationParams
    ): Promise<Result<PasskeyAuthenticationResult, DomainError>> {
      try {
        logger.debug("Verifying passkey authentication");

        // In production with @simplewebauthn/server:
        // const verification = await verifyAuthenticationResponse({
        //   response: params.response,
        //   expectedChallenge: params.expectedChallenge,
        //   expectedOrigin: params.expectedOrigin,
        //   expectedRPID: params.expectedRPID,
        //   authenticator: {
        //     credentialID: Buffer.from(params.credential.id, 'base64url'),
        //     credentialPublicKey: Buffer.from(params.credential.publicKey, 'base64url'),
        //     counter: params.credential.counter,
        //   },
        // });
        //
        // if (!verification.verified) {
        //   return err(AuthErrors.PASSKEY_CHALLENGE_FAILED());
        // }
        //
        // return ok({
        //   credentialId: params.credential.id,
        //   newCounter: verification.authenticationInfo.newCounter,
        // });

        // Placeholder verification for demonstration
        const response = params.response as any;

        if (!response || !response.id) {
          return err(AuthErrors.PASSKEY_CHALLENGE_FAILED());
        }

        // Verify credential ID matches
        if (response.id !== params.credential.id) {
          return err(AuthErrors.PASSKEY_INVALID());
        }

        // In real implementation, verify the signature and check counter

        return ok({
          credentialId: params.credential.id,
          newCounter: params.credential.counter + 1,
        });
      } catch (error) {
        logger.error("Passkey authentication verification failed", error as Error);
        return err(AuthErrors.PASSKEY_CHALLENGE_FAILED());
      }
    },
  };

  instance = service;
  return service;
};

export const getPasskeyService = (): PasskeyPort | null => instance;

export const resetPasskeyService = (): void => {
  instance = null;
};
