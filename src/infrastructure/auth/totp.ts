/**
 * TOTP Service - Singleton Pattern
 * Time-based One-Time Password implementation
 */

import type { TOTPPort, LoggerPort } from "../../application/ports";

// ============================================
// Types
// ============================================

export interface TOTPConfig {
  issuer: string;
  digits?: number;
  period?: number;
  algorithm?: string;
}

// ============================================
// Singleton Implementation
// ============================================

let instance: TOTPPort | null = null;

export const createTOTPService = (
  config: TOTPConfig,
  logger: LoggerPort
): TOTPPort => {
  if (instance) {
    logger.debug("Returning existing TOTP service instance");
    return instance;
  }

  logger.info("Creating TOTP service");

  const digits = config.digits || 6;
  const period = config.period || 30;
  const algorithm = config.algorithm || "SHA1";

  // In production, use otpauth library
  // import { TOTP } from 'otpauth';

  const service: TOTPPort = {
    generateSecret(): string {
      // Generate a base32-encoded secret
      const bytes = new Uint8Array(20);
      crypto.getRandomValues(bytes);

      // Base32 encoding
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      let result = "";
      let bits = 0;
      let value = 0;

      for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;

        while (bits >= 5) {
          bits -= 5;
          result += alphabet[(value >> bits) & 0x1f];
        }
      }

      if (bits > 0) {
        result += alphabet[(value << (5 - bits)) & 0x1f];
      }

      return result;
    },

    generateQRCodeUrl(secret: string, email: string, issuer: string): string {
      // Generate otpauth:// URL for QR code
      const encodedIssuer = encodeURIComponent(issuer || config.issuer);
      const encodedEmail = encodeURIComponent(email);

      return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=${algorithm}&digits=${digits}&period=${period}`;
    },

    verify(secret: string, code: string): boolean {
      try {
        // In production, use otpauth library:
        // const totp = new TOTP({
        //   secret: Secret.fromBase32(secret),
        //   algorithm,
        //   digits,
        //   period,
        // });
        // return totp.validate({ token: code, window: 1 }) !== null;

        // Simple TOTP verification for demonstration
        // WARNING: This is a simplified implementation
        // Use a proper library in production

        const currentCode = generateTOTP(secret, Math.floor(Date.now() / 1000 / period));
        const previousCode = generateTOTP(secret, Math.floor(Date.now() / 1000 / period) - 1);
        const nextCode = generateTOTP(secret, Math.floor(Date.now() / 1000 / period) + 1);

        // Allow 1 period window for clock skew
        return code === currentCode || code === previousCode || code === nextCode;
      } catch (error) {
        logger.error("TOTP verification failed", error as Error);
        return false;
      }
    },
  };

  instance = service;
  return service;
};

// Simple TOTP generation (use proper library in production)
function generateTOTP(secret: string, counter: number): string {
  // This is a placeholder - real implementation needs HMAC-SHA1
  // In production, use the otpauth library

  // Convert counter to 8-byte big-endian
  const counterBytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }

  // Placeholder: Generate a 6-digit code based on secret and counter
  // This is NOT cryptographically correct - use a proper library
  let hash = 0;
  for (let i = 0; i < secret.length; i++) {
    hash = ((hash << 5) - hash + secret.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < 8; i++) {
    hash = ((hash << 5) - hash + counterBytes[i]) | 0;
  }

  const code = Math.abs(hash % 1000000).toString().padStart(6, "0");
  return code;
}

export const getTOTPService = (): TOTPPort | null => instance;

export const resetTOTPService = (): void => {
  instance = null;
};
