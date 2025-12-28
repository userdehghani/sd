/**
 * ID Generation Utilities
 * Uses crypto-secure random generation
 */

import type { UUID } from "../types";

/**
 * Generate a UUID v4
 */
export const generateId = (): UUID => {
  return crypto.randomUUID() as UUID;
};

/**
 * Generate a short ID (URL-safe base64)
 */
export const generateShortId = (length: number = 16): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, length);
};

/**
 * Generate a session ID
 */
export const generateSessionId = (): string => {
  return `sess_${generateShortId(32)}`;
};

/**
 * Generate a verification code (numeric)
 */
export const generateVerificationCode = (length: number = 6): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => (b % 10).toString())
    .join("");
};

/**
 * Generate a correlation ID for request tracing
 */
export const generateCorrelationId = (): string => {
  return `cor_${generateShortId(24)}`;
};

/**
 * Validate UUID format
 */
export const isValidUUID = (id: string): id is UUID => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};
