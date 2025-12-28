/**
 * JWT Service - Singleton Pattern
 */

import {
  type Result,
  ok,
  err,
  AuthErrors,
  InfraErrors,
  type DomainError,
} from "../../core";
import type { JWTPort, LoggerPort } from "../../application/ports";

// ============================================
// Types
// ============================================

export interface JWTConfig {
  secret: string;
  algorithm?: string;
  issuer: string;
  audience: string;
}

// ============================================
// Singleton Implementation
// ============================================

let instance: JWTPort | null = null;

export const createJWTService = (
  config: JWTConfig,
  logger: LoggerPort
): JWTPort => {
  if (instance) {
    logger.debug("Returning existing JWT service instance");
    return instance;
  }

  logger.info("Creating JWT service");

  // In production, use jose or jsonwebtoken library
  // import { SignJWT, jwtVerify } from 'jose';

  const service: JWTPort = {
    async sign(
      payload: Record<string, unknown>,
      expiresInSeconds: number
    ): Promise<Result<string, DomainError>> {
      try {
        logger.debug("Signing JWT", { expiresIn: expiresInSeconds });

        const now = Math.floor(Date.now() / 1000);
        const fullPayload = {
          ...payload,
          iat: now,
          exp: now + expiresInSeconds,
          iss: config.issuer,
          aud: config.audience,
        };

        // In production with jose:
        // const secret = new TextEncoder().encode(config.secret);
        // const token = await new SignJWT(fullPayload)
        //   .setProtectedHeader({ alg: config.algorithm || 'HS256' })
        //   .setIssuedAt()
        //   .setExpirationTime(`${expiresInSeconds}s`)
        //   .setIssuer(config.issuer)
        //   .setAudience(config.audience)
        //   .sign(secret);

        // Simple base64 encoding for demonstration
        // DO NOT USE IN PRODUCTION - use proper JWT library
        const header = btoa(JSON.stringify({ alg: config.algorithm || "HS256", typ: "JWT" }));
        const payloadStr = btoa(JSON.stringify(fullPayload));
        const signature = btoa(config.secret + header + payloadStr); // Fake signature

        const token = `${header}.${payloadStr}.${signature}`;

        return ok(token);
      } catch (error) {
        logger.error("JWT sign failed", error as Error);
        return err(InfraErrors.EXTERNAL_SERVICE_ERROR("JWT", error as Error));
      }
    },

    async verify<T extends Record<string, unknown>>(
      token: string
    ): Promise<Result<T, DomainError>> {
      try {
        logger.debug("Verifying JWT");

        // In production with jose:
        // const secret = new TextEncoder().encode(config.secret);
        // const { payload } = await jwtVerify(token, secret, {
        //   issuer: config.issuer,
        //   audience: config.audience,
        // });
        // return ok(payload as T);

        // Simple base64 decoding for demonstration
        const parts = token.split(".");
        if (parts.length !== 3) {
          return err(AuthErrors.TOKEN_INVALID());
        }

        const payload = JSON.parse(atob(parts[1])) as T & {
          exp?: number;
          iss?: string;
          aud?: string;
        };

        // Check expiration
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          return err(AuthErrors.TOKEN_EXPIRED());
        }

        // Check issuer
        if (payload.iss && payload.iss !== config.issuer) {
          return err(AuthErrors.TOKEN_INVALID());
        }

        // Check audience
        if (payload.aud && payload.aud !== config.audience) {
          return err(AuthErrors.TOKEN_INVALID());
        }

        return ok(payload as T);
      } catch (error) {
        logger.error("JWT verify failed", error as Error);
        return err(AuthErrors.TOKEN_INVALID());
      }
    },
  };

  instance = service;
  return service;
};

export const getJWTService = (): JWTPort | null => instance;

export const resetJWTService = (): void => {
  instance = null;
};
