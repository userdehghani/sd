/**
 * User Routes
 * POST /user/login, POST /user/update, POST /user/revoke, GET /user/me
 */

import { Elysia } from "elysia";
import type { DomainError } from "../../../core";
import type { AuthContext } from "../middleware/auth";
import {
  RegisterTOTPSchema,
  VerifyTOTPSchema,
  LoginTOTPInitSchema,
  LoginTOTPCompleteSchema,
  PasskeyRegisterInitSchema,
  PasskeyRegisterCompleteSchema,
  PasskeyLoginInitSchema,
  PasskeyLoginCompleteSchema,
  UpdateProfileSchema,
  SetPhoneSchema,
  VerifyCodeSchema,
  RevokeSessionSchema,
  RevokeAllSessionsSchema,
} from "../schemas/validation";

// ============================================
// Types for Dependencies
// ============================================

export interface UserRouteDeps {
  // Auth - Register
  initiateTOTPRegistration: (input: any) => Promise<any>;
  verifyTOTPRegistration: (input: any) => Promise<any>;
  initiateGoogleAuth: (input: any) => Promise<any>;
  completeGoogleRegistration: (input: any) => Promise<any>;
  initiateAppleAuth: (input: any) => Promise<any>;
  completeAppleRegistration: (input: any) => Promise<any>;
  initiatePasskeyRegistration: (input: any) => Promise<any>;
  completePasskeyRegistration: (input: any) => Promise<any>;

  // Auth - Login
  initiateTOTPLogin: (input: any) => Promise<any>;
  completeTOTPLogin: (input: any) => Promise<any>;
  oauthLogin: (input: any) => Promise<any>;
  initiatePasskeyLogin: (input: any) => Promise<any>;
  completePasskeyLogin: (input: any) => Promise<any>;

  // Session
  createSession: (input: any) => Promise<any>;
  listSessions: (input: any) => Promise<any>;
  revokeSession: (input: any) => Promise<any>;
  revokeAllSessions: (input: any) => Promise<any>;
  logout: (input: any) => Promise<any>;

  // Profile
  getProfile: (input: any) => Promise<any>;
  updateProfile: (input: any) => Promise<any>;
  sendEmailVerification: (input: any) => Promise<any>;
  verifyEmail: (input: any) => Promise<any>;
  setPhoneAndSendVerification: (input: any) => Promise<any>;
  verifyPhone: (input: any) => Promise<any>;
}

// ============================================
// Error Response Helper
// ============================================

const errorResponse = (error: DomainError, status: number = 400) => ({
  status,
  body: {
    error: {
      code: error.code,
      message: error.message,
      metadata: error.metadata,
    },
  },
});

// ============================================
// User Routes
// ============================================

export const createUserRoutes = (deps: UserRouteDeps) => {
  return new Elysia({ prefix: "/user" })
    // ==========================================
    // Auth - Register
    // ==========================================
    .group("/register", (app) =>
      app
        // TOTP Registration
        .post("/totp/init", async ({ body }) => {
          const result = await deps.initiateTOTPRegistration(body);
          if (result.isErr()) {
            return errorResponse(result.error);
          }
          return result.value;
        }, RegisterTOTPSchema)
        
        .post("/totp/verify", async ({ body }) => {
          const result = await deps.verifyTOTPRegistration(body);
          if (result.isErr()) {
            return errorResponse(result.error);
          }
          return result.value;
        }, VerifyTOTPSchema)
        
        // Google OAuth
        .get("/google", async ({ query }) => {
          const redirectUri = query.redirect_uri || "";
          const result = await deps.initiateGoogleAuth({ redirectUri });
          if (result.isErr()) {
            return errorResponse(result.error);
          }
          return result.value;
        })
        
        .post("/google/callback", async ({ body, query }) => {
          const result = await deps.completeGoogleRegistration({
            code: body?.code || query?.code,
            state: body?.state || query?.state,
            redirectUri: body?.redirect_uri || query?.redirect_uri || "",
          });
          if (result.isErr()) {
            return errorResponse(result.error);
          }
          return result.value;
        })
        
        // Apple OAuth
        .get("/apple", async ({ query }) => {
          const redirectUri = query.redirect_uri || "";
          const result = await deps.initiateAppleAuth({ redirectUri });
          if (result.isErr()) {
            return errorResponse(result.error);
          }
          return result.value;
        })
        
        .post("/apple/callback", async ({ body, query }) => {
          const result = await deps.completeAppleRegistration({
            code: body?.code || query?.code,
            state: body?.state || query?.state,
            redirectUri: body?.redirect_uri || query?.redirect_uri || "",
            user: body?.user,
          });
          if (result.isErr()) {
            return errorResponse(result.error);
          }
          return result.value;
        })
        
        // Passkey Registration
        .post("/passkey/init", async ({ body }) => {
          const result = await deps.initiatePasskeyRegistration(body);
          if (result.isErr()) {
            return errorResponse(result.error);
          }
          return result.value;
        }, PasskeyRegisterInitSchema)
        
        .post("/passkey/complete", async ({ body }) => {
          const result = await deps.completePasskeyRegistration(body);
          if (result.isErr()) {
            return errorResponse(result.error);
          }
          return result.value;
        }, PasskeyRegisterCompleteSchema)
    )
    
    // ==========================================
    // Auth - Login (POST /user/login)
    // ==========================================
    .group("/login", (app) =>
      app
        // TOTP Login
        .post("/totp/init", async ({ body }) => {
          const result = await deps.initiateTOTPLogin(body);
          if (result.isErr()) {
            return errorResponse(result.error, 401);
          }
          return result.value;
        }, LoginTOTPInitSchema)
        
        .post("/totp/complete", async ({ body, headers }) => {
          const result = await deps.completeTOTPLogin({
            ...body,
            deviceInfo: {
              userAgent: headers["user-agent"] || "unknown",
              ip: headers["x-forwarded-for"]?.split(",")[0] || headers["x-real-ip"] || "unknown",
            },
          });
          if (result.isErr()) {
            return errorResponse(result.error, 401);
          }
          return result.value;
        }, LoginTOTPCompleteSchema)
        
        // OAuth Login
        .post("/oauth/:provider", async ({ params, body, query, headers }) => {
          const provider = params.provider as "google" | "apple";
          const result = await deps.oauthLogin({
            provider,
            code: body?.code || query?.code,
            state: body?.state || query?.state,
            redirectUri: body?.redirect_uri || query?.redirect_uri || "",
            deviceInfo: {
              userAgent: headers["user-agent"] || "unknown",
              ip: headers["x-forwarded-for"]?.split(",")[0] || headers["x-real-ip"] || "unknown",
            },
          });
          if (result.isErr()) {
            return errorResponse(result.error, 401);
          }
          return result.value;
        })
        
        // Passkey Login
        .post("/passkey/init", async ({ body }) => {
          const result = await deps.initiatePasskeyLogin(body);
          if (result.isErr()) {
            return errorResponse(result.error);
          }
          return result.value;
        }, PasskeyLoginInitSchema)
        
        .post("/passkey/complete", async ({ body, headers }) => {
          const result = await deps.completePasskeyLogin({
            ...body,
            deviceInfo: {
              userAgent: headers["user-agent"] || "unknown",
              ip: headers["x-forwarded-for"]?.split(",")[0] || headers["x-real-ip"] || "unknown",
            },
          });
          if (result.isErr()) {
            return errorResponse(result.error, 401);
          }
          return result.value;
        }, PasskeyLoginCompleteSchema)
    )
    
    // ==========================================
    // Session Management
    // ==========================================
    .group("/session", (app) =>
      app
        .get("/", async ({ auth }) => {
          if (!auth) {
            return errorResponse({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
          }
          const result = await deps.listSessions({
            userId: auth.userId,
            currentSessionId: auth.sessionId,
          });
          if (result.isErr()) {
            return errorResponse(result.error);
          }
          return result.value;
        })
        
        // POST /user/revoke - Revoke a specific session
        .post("/revoke", async ({ body, auth }) => {
          if (!auth) {
            return errorResponse({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
          }
          const result = await deps.revokeSession({
            userId: auth.userId,
            sessionId: body.sessionId,
            currentSessionId: auth.sessionId,
            reason: body.reason,
          });
          if (result.isErr()) {
            return errorResponse(result.error);
          }
          return result.value;
        }, RevokeSessionSchema)
        
        // Revoke all sessions
        .post("/revoke-all", async ({ body, auth }) => {
          if (!auth) {
            return errorResponse({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
          }
          const result = await deps.revokeAllSessions({
            userId: auth.userId,
            currentSessionId: body.keepCurrent ? auth.sessionId : undefined,
            reason: body.reason,
          });
          if (result.isErr()) {
            return errorResponse(result.error);
          }
          return result.value;
        }, RevokeAllSessionsSchema)
    )
    
    // ==========================================
    // Profile (GET /user/me, POST /user/update)
    // ==========================================
    
    // GET /user/me
    .get("/me", async ({ auth }) => {
      if (!auth) {
        return errorResponse({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
      }
      const result = await deps.getProfile({ userId: auth.userId });
      if (result.isErr()) {
        return errorResponse(result.error);
      }
      return result.value;
    })
    
    // POST /user/update
    .post("/update", async ({ body, auth }) => {
      if (!auth) {
        return errorResponse({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
      }
      const result = await deps.updateProfile({
        userId: auth.userId,
        ...body,
      });
      if (result.isErr()) {
        return errorResponse(result.error);
      }
      return result.value;
    }, UpdateProfileSchema)
    
    // Email verification
    .post("/verify/email/send", async ({ auth }) => {
      if (!auth) {
        return errorResponse({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
      }
      const result = await deps.sendEmailVerification({ userId: auth.userId });
      if (result.isErr()) {
        return errorResponse(result.error);
      }
      return result.value;
    })
    
    .post("/verify/email", async ({ body, auth }) => {
      if (!auth) {
        return errorResponse({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
      }
      const result = await deps.verifyEmail({
        userId: auth.userId,
        code: body.code,
      });
      if (result.isErr()) {
        return errorResponse(result.error);
      }
      return result.value;
    }, VerifyCodeSchema)
    
    // Phone verification
    .post("/verify/phone/send", async ({ body, auth }) => {
      if (!auth) {
        return errorResponse({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
      }
      const result = await deps.setPhoneAndSendVerification({
        userId: auth.userId,
        phone: body.phone,
      });
      if (result.isErr()) {
        return errorResponse(result.error);
      }
      return result.value;
    }, SetPhoneSchema)
    
    .post("/verify/phone", async ({ body, auth }) => {
      if (!auth) {
        return errorResponse({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
      }
      const result = await deps.verifyPhone({
        userId: auth.userId,
        code: body.code,
      });
      if (result.isErr()) {
        return errorResponse(result.error);
      }
      return result.value;
    }, VerifyCodeSchema)
    
    // Logout
    .post("/logout", async ({ auth }) => {
      if (!auth) {
        return errorResponse({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
      }
      const result = await deps.logout({
        userId: auth.userId,
        sessionId: auth.sessionId,
      });
      if (result.isErr()) {
        return errorResponse(result.error);
      }
      return result.value;
    });
};
