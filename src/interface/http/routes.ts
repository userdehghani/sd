/**
 * HTTP Routes
 * Defines all application routes
 */

import { Elysia } from "elysia";
import { AuthController } from "./controllers/auth.controller";
import { ProfileController } from "./controllers/profile.controller";
import { SessionController } from "./controllers/session.controller";
import { StorageController } from "./controllers/storage.controller";
import { AuthMiddleware } from "./middleware/auth.middleware";
import { RateLimiterMiddleware } from "./middleware/rate-limiter.middleware";
import { logger } from "../../logger";

export function registerRoutes(
  app: Elysia,
  controllers: {
    authController: AuthController;
    profileController: ProfileController;
    sessionController: SessionController;
    storageController: StorageController;
  },
  middleware: {
    authMiddleware: AuthMiddleware;
    rateLimiter: RateLimiterMiddleware;
  }
): Elysia {
  const { authController, profileController, sessionController, storageController } = controllers;
  const { authMiddleware, rateLimiter } = middleware;

  // Authentication routes (public)
  app.group("/api/auth", (group) =>
    group
      // Registration
      .post("/register/totp", async (context) => {
        const allowed = await rateLimiter.checkRateLimit(context);
        if (!allowed) {
          context.set.status = 429;
          return { error: "Rate limit exceeded" };
        }
        return authController.registerWithTOTP(context);
      })
      .post("/register/oauth", async (context) => {
        const allowed = await rateLimiter.checkRateLimit(context);
        if (!allowed) {
          context.set.status = 429;
          return { error: "Rate limit exceeded" };
        }
        return authController.registerWithOAuth(context);
      })
      .post("/register/passkey", async (context) => {
        const allowed = await rateLimiter.checkRateLimit(context);
        if (!allowed) {
          context.set.status = 429;
          return { error: "Rate limit exceeded" };
        }
        return authController.registerWithPassKey(context);
      })
      // Login
      .post("/login/totp", async (context) => {
        const allowed = await rateLimiter.checkRateLimit(context);
        if (!allowed) {
          context.set.status = 429;
          return { error: "Rate limit exceeded" };
        }
        return authController.loginWithTOTP(context);
      })
      .post("/login/oauth", async (context) => {
        const allowed = await rateLimiter.checkRateLimit(context);
        if (!allowed) {
          context.set.status = 429;
          return { error: "Rate limit exceeded" };
        }
        return authController.loginWithOAuth(context);
      })
      .post("/login/passkey", async (context) => {
        const allowed = await rateLimiter.checkRateLimit(context);
        if (!allowed) {
          context.set.status = 429;
          return { error: "Rate limit exceeded" };
        }
        return authController.loginWithPassKey(context);
      })
  );

  // User profile routes (protected)
  app.group("/api/user", (group) =>
    group
      .derive(async (context) => {
        try {
          const auth = await authMiddleware.authenticate(context);
          return { auth };
        } catch (error) {
          context.set.status = 401;
          throw new Error("Unauthorized");
        }
      })
      .get("/me", async (context) => {
        return profileController.getProfile(context as any);
      })
      .patch("/profile", async (context) => {
        return profileController.updateProfile(context as any);
      })
      .post("/verify/email", async (context) => {
        return profileController.verifyEmail(context as any);
      })
      .post("/verify/phone", async (context) => {
        return profileController.verifyPhone(context as any);
      })
  );

  // Session management routes (protected)
  app.group("/api/sessions", (group) =>
    group
      .derive(async (context) => {
        try {
          const auth = await authMiddleware.authenticate(context);
          return { auth };
        } catch (error) {
          context.set.status = 401;
          throw new Error("Unauthorized");
        }
      })
      .get("/", async (context) => {
        return sessionController.listSessions(context as any);
      })
      .delete("/:sessionId", async (context) => {
        return sessionController.revokeSession(context as any);
      })
      .delete("/", async (context) => {
        return sessionController.revokeAllSessions(context as any);
      })
  );

  // Storage routes (protected)
  app.group("/api/storage", (group) =>
    group
      .derive(async (context) => {
        try {
          const auth = await authMiddleware.authenticate(context);
          return { auth };
        } catch (error) {
          context.set.status = 401;
          throw new Error("Unauthorized");
        }
      })
      .post("/avatar", async (context) => {
        return storageController.uploadAvatar(context as any);
      })
      .delete("/avatar", async (context) => {
        return storageController.deleteAvatar(context as any);
      })
  );

  logger.info("Routes registered successfully");
  return app;
}
