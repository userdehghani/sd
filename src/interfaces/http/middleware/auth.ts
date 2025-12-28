/**
 * Authentication Middleware
 * JWT verification and session validation
 */

import { Elysia } from "elysia";
import {
  type Result,
  ok,
  err,
  AuthErrors,
  type DomainError,
  type UUID,
} from "../../../core";
import type { JWTPort, CachePort, LoggerPort } from "../../../application/ports";
import type { SessionRepository } from "../../../domain/session";

// ============================================
// Types
// ============================================

export interface AuthContext {
  userId: UUID;
  sessionId: string;
  email: string;
  role: string;
}

export interface AuthMiddlewareConfig {
  jwt: JWTPort;
  sessionRepository: SessionRepository;
  cache: CachePort;
  logger: LoggerPort;
  /** Paths that don't require authentication */
  publicPaths?: string[];
  /** Session cache TTL in seconds */
  sessionCacheTTL?: number;
}

// ============================================
// Auth Middleware Plugin
// ============================================

export const authMiddleware = (config: AuthMiddlewareConfig) => {
  const publicPaths = new Set(config.publicPaths || []);
  const sessionCacheTTL = config.sessionCacheTTL || 300; // 5 minutes

  const isPublicPath = (path: string): boolean => {
    // Check exact match
    if (publicPaths.has(path)) {
      return true;
    }
    
    // Check prefix match (e.g., /auth/* is public)
    for (const publicPath of publicPaths) {
      if (publicPath.endsWith("*") && path.startsWith(publicPath.slice(0, -1))) {
        return true;
      }
    }
    
    return false;
  };

  const validateSession = async (sessionId: string, userId: string): Promise<Result<boolean, DomainError>> => {
    // Check cache first
    const cacheKey = `session:valid:${sessionId}`;
    const cachedResult = await config.cache.get<boolean>(cacheKey);
    
    if (cachedResult.isOk() && cachedResult.value !== null) {
      return ok(cachedResult.value);
    }

    // Check session in database
    const sessionResult = await config.sessionRepository.findById(sessionId);
    
    if (sessionResult.isErr()) {
      return err(sessionResult.error);
    }

    if (!sessionResult.value) {
      // Cache negative result for shorter time
      await config.cache.set(cacheKey, false, 60);
      return ok(false);
    }

    const session = sessionResult.value;

    // Validate session
    const isValid = 
      session.status === "active" &&
      session.userId === userId &&
      session.expiresAt > new Date();

    // Cache result
    await config.cache.set(cacheKey, isValid, isValid ? sessionCacheTTL : 60);

    // Update last activity (fire and forget)
    if (isValid) {
      config.sessionRepository.updateLastActivity(sessionId).catch((error) => {
        config.logger.error("Failed to update session activity", error);
      });
    }

    return ok(isValid);
  };

  return new Elysia({ name: "auth" })
    .derive(async ({ request, headers, set }): Promise<{ auth: AuthContext | null }> => {
      const path = new URL(request.url).pathname;

      // Skip auth for public paths
      if (isPublicPath(path)) {
        return { auth: null };
      }

      // Get token from header
      const authHeader = headers["authorization"];
      if (!authHeader?.startsWith("Bearer ")) {
        return { auth: null };
      }

      const token = authHeader.slice(7);

      // Verify JWT
      const verifyResult = await config.jwt.verify<{
        sub: string;
        sid: string;
        email: string;
        role: string;
      }>(token);

      if (verifyResult.isErr()) {
        config.logger.debug("JWT verification failed", { error: verifyResult.error });
        return { auth: null };
      }

      const payload = verifyResult.value;

      // Validate session
      const sessionValid = await validateSession(payload.sid, payload.sub);
      
      if (sessionValid.isErr() || !sessionValid.value) {
        config.logger.debug("Session validation failed", { sessionId: payload.sid });
        return { auth: null };
      }

      return {
        auth: {
          userId: payload.sub as UUID,
          sessionId: payload.sid,
          email: payload.email,
          role: payload.role,
        },
      };
    })
    .onBeforeHandle(({ auth, request, set }) => {
      const path = new URL(request.url).pathname;

      // Allow public paths
      if (isPublicPath(path)) {
        return;
      }

      // Require auth for protected paths
      if (!auth) {
        set.status = 401;
        return {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        };
      }
    });
};

// ============================================
// Role-based Access Control
// ============================================

export const requireRole = (allowedRoles: string[]) => {
  return new Elysia({ name: `require-role:${allowedRoles.join(",")}` })
    .onBeforeHandle(({ auth, set }) => {
      if (!auth) {
        set.status = 401;
        return {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        };
      }

      if (!allowedRoles.includes(auth.role)) {
        set.status = 403;
        return {
          error: {
            code: "FORBIDDEN",
            message: "Insufficient permissions",
          },
        };
      }
    });
};

// ============================================
// Optional Auth (for endpoints that work with or without auth)
// ============================================

export const optionalAuth = (config: AuthMiddlewareConfig) => {
  return new Elysia({ name: "optional-auth" })
    .derive(async ({ headers }): Promise<{ auth: AuthContext | null }> => {
      const authHeader = headers["authorization"];
      
      if (!authHeader?.startsWith("Bearer ")) {
        return { auth: null };
      }

      const token = authHeader.slice(7);

      const verifyResult = await config.jwt.verify<{
        sub: string;
        sid: string;
        email: string;
        role: string;
      }>(token);

      if (verifyResult.isErr()) {
        return { auth: null };
      }

      const payload = verifyResult.value;

      return {
        auth: {
          userId: payload.sub as UUID,
          sessionId: payload.sid,
          email: payload.email,
          role: payload.role,
        },
      };
    });
};
