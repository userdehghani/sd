/**
 * Application Bootstrap
 * Dependency injection and application setup
 */

import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { config, validateConfig } from "./config";
import { logger } from "./logger";
import { metrics } from "./metrics";
import { shutdown } from "./gsh";

// Infrastructure
import {
  createPostgresClient,
  createUserRepository,
  createSessionRepository,
} from "./infrastructure/persistence/postgres";
import { createRedisClient } from "./infrastructure/persistence/redis";
import { createGoogleOAuthClient } from "./infrastructure/external/oauth/google";
import { createAppleOAuthClient } from "./infrastructure/external/oauth/apple";
import { createS3Client } from "./infrastructure/external/storage/s3";
import { createResendClient } from "./infrastructure/external/notification/resend";
import { createMelliPayamakClient } from "./infrastructure/external/notification/melli-payamak";
import { createJWTService } from "./infrastructure/auth/jwt";
import { createTOTPService } from "./infrastructure/auth/totp";
import { createPasskeyService } from "./infrastructure/auth/passkey";

// Application Use Cases
import {
  initiateTOTPRegistration,
  verifyTOTPRegistration,
} from "./application/user/auth/register/totp";
import {
  initiateGoogleAuth,
  completeGoogleRegistration,
} from "./application/user/auth/register/google";
import {
  initiateAppleAuth,
  completeAppleRegistration,
} from "./application/user/auth/register/apple";
import {
  initiatePasskeyRegistration,
  completePasskeyRegistration,
} from "./application/user/auth/register/passkey";
import {
  initiateTOTPLogin,
  completeTOTPLogin,
} from "./application/user/auth/login/totp";
import { oauthLogin } from "./application/user/auth/login/oauth";
import {
  initiatePasskeyLogin,
  completePasskeyLogin,
} from "./application/user/auth/login/passkey";
import { createUserSession } from "./application/user/auth/session/create";
import { listUserSessions } from "./application/user/auth/session/list";
import {
  revokeUserSession,
  revokeAllUserSessions,
  logout,
} from "./application/user/auth/session/revoke";
import { getUserProfile } from "./application/user/profile/get";
import { updateUserProfile } from "./application/user/profile/update";
import {
  sendEmailVerification,
  verifyUserEmail,
} from "./application/user/profile/verify-email";
import {
  setPhoneAndSendVerification,
  verifyUserPhone,
} from "./application/user/profile/verify-phone";
import { uploadAvatar } from "./application/storage/upload-avatar";
import { deleteAvatar } from "./application/storage/delete-avatar";

// HTTP Interface
import { authMiddleware, rateLimiterPlugin } from "./interfaces/http/middleware";
import { createUserRoutes, createStorageRoutes } from "./interfaces/http/routes";
import { observabilityMiddleware } from "./middleware";
import {
  performHealthCheck,
  performLivenessCheck,
  performReadinessCheck,
} from "./health";

// ============================================
// Bootstrap Application
// ============================================

export const bootstrap = async () => {
  // Validate configuration
  validateConfig();

  logger.info("Bootstrapping application", {
    service: config.service.name,
    version: config.service.version,
    environment: config.server.nodeEnv,
  });

  // ==========================================
  // Infrastructure Layer (Singletons)
  // ==========================================

  // PostgreSQL
  const postgresClient = createPostgresClient(
    {
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.user,
      password: config.postgres.password,
      maxConnections: config.postgres.maxConnections,
      ssl: config.postgres.ssl,
    },
    logger
  );

  // Redis
  const redisClient = createRedisClient(
    {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      keyPrefix: config.redis.keyPrefix,
    },
    logger
  );

  // JWT
  const jwtService = createJWTService(
    {
      secret: config.jwt.secret,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    },
    logger
  );

  // TOTP
  const totpService = createTOTPService(
    {
      issuer: config.totp.issuer,
    },
    logger
  );

  // Passkey
  const passkeyService = createPasskeyService(
    {
      rpId: config.passkey.rpId,
      rpName: config.passkey.rpName,
      rpOrigin: config.passkey.rpOrigin,
    },
    logger
  );

  // Google OAuth
  const googleOAuth = createGoogleOAuthClient(
    {
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
    },
    logger
  );

  // Apple OAuth
  const appleOAuth = createAppleOAuthClient(
    {
      clientId: config.apple.clientId,
      teamId: config.apple.teamId,
      keyId: config.apple.keyId,
      privateKey: config.apple.privateKey,
    },
    logger
  );

  // S3 Storage
  const s3Client = createS3Client(
    {
      region: config.s3.region,
      bucket: config.s3.bucket,
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
      endpoint: config.s3.endpoint,
      publicUrlBase: config.s3.publicUrlBase,
    },
    logger
  );

  // Email (Resend)
  const emailClient = createResendClient(
    {
      apiKey: config.email.apiKey,
      fromEmail: config.email.fromEmail,
      fromName: config.email.fromName,
      replyTo: config.email.replyTo,
    },
    logger
  );

  // SMS (Melli Payamak)
  const smsClient = createMelliPayamakClient(
    {
      username: config.sms.username,
      password: config.sms.password,
      from: config.sms.from,
    },
    logger
  );

  // ==========================================
  // Repositories
  // ==========================================

  const userRepository = createUserRepository(postgresClient, logger);
  const sessionRepository = createSessionRepository(postgresClient, logger);

  // ==========================================
  // Use Case Dependencies
  // ==========================================

  const commonDeps = {
    userRepository,
    sessionRepository,
    cache: redisClient,
    jwt: jwtService,
    totp: totpService,
    passkey: passkeyService,
    email: emailClient,
    sms: smsClient,
    storage: s3Client,
    logger,
  };

  const authConfig = {
    totpIssuer: config.totp.issuer,
    pendingRegistrationTTL: config.totp.pendingRegistrationTTL,
    loginTokenTTL: config.totp.loginTokenTTL,
    oauthStateTTL: 600,
    sessionDurationSeconds: config.session.durationSeconds,
    jwtIssuer: config.jwt.issuer,
    jwtAudience: config.jwt.audience,
    rpId: config.passkey.rpId,
    rpName: config.passkey.rpName,
    rpOrigin: config.passkey.rpOrigin,
    challengeTTL: config.passkey.challengeTTL,
  };

  // ==========================================
  // Wired Use Cases
  // ==========================================

  const useCases = {
    // Register
    initiateTOTPRegistration: initiateTOTPRegistration({
      ...commonDeps,
      config: authConfig,
    }),
    verifyTOTPRegistration: verifyTOTPRegistration({
      ...commonDeps,
      config: authConfig,
    }),
    initiateGoogleAuth: initiateGoogleAuth({
      userRepository,
      googleOAuth,
      cache: redisClient,
      email: emailClient,
      logger,
      config: authConfig,
    }),
    completeGoogleRegistration: completeGoogleRegistration({
      userRepository,
      googleOAuth,
      cache: redisClient,
      email: emailClient,
      logger,
      config: authConfig,
    }),
    initiateAppleAuth: initiateAppleAuth({
      userRepository,
      appleOAuth,
      cache: redisClient,
      email: emailClient,
      logger,
      config: authConfig,
    }),
    completeAppleRegistration: completeAppleRegistration({
      userRepository,
      appleOAuth,
      cache: redisClient,
      email: emailClient,
      logger,
      config: authConfig,
    }),
    initiatePasskeyRegistration: initiatePasskeyRegistration({
      userRepository,
      passkey: passkeyService,
      cache: redisClient,
      email: emailClient,
      logger,
      config: authConfig,
    }),
    completePasskeyRegistration: completePasskeyRegistration({
      userRepository,
      passkey: passkeyService,
      cache: redisClient,
      email: emailClient,
      logger,
      config: authConfig,
    }),

    // Login
    initiateTOTPLogin: initiateTOTPLogin({
      userRepository,
      sessionRepository,
      totp: totpService,
      jwt: jwtService,
      cache: redisClient,
      logger,
      config: authConfig,
    }),
    completeTOTPLogin: completeTOTPLogin({
      userRepository,
      sessionRepository,
      totp: totpService,
      jwt: jwtService,
      cache: redisClient,
      logger,
      config: authConfig,
    }),
    oauthLogin: oauthLogin({
      userRepository,
      sessionRepository,
      oauthProviders: { google: googleOAuth, apple: appleOAuth },
      jwt: jwtService,
      cache: redisClient,
      logger,
      config: authConfig,
    }),
    initiatePasskeyLogin: initiatePasskeyLogin({
      userRepository,
      sessionRepository,
      passkey: passkeyService,
      jwt: jwtService,
      cache: redisClient,
      logger,
      config: authConfig,
    }),
    completePasskeyLogin: completePasskeyLogin({
      userRepository,
      sessionRepository,
      passkey: passkeyService,
      jwt: jwtService,
      cache: redisClient,
      logger,
      config: authConfig,
    }),

    // Session
    createSession: createUserSession({
      userRepository,
      sessionRepository,
      jwt: jwtService,
      logger,
      config: authConfig,
    }),
    listSessions: listUserSessions({
      sessionRepository,
      logger,
    }),
    revokeSession: revokeUserSession({
      sessionRepository,
      cache: redisClient,
      logger,
    }),
    revokeAllSessions: revokeAllUserSessions({
      sessionRepository,
      cache: redisClient,
      logger,
    }),
    logout: logout({
      sessionRepository,
      cache: redisClient,
      logger,
    }),

    // Profile
    getProfile: getUserProfile({
      userRepository,
      logger,
    }),
    updateProfile: updateUserProfile({
      userRepository,
      logger,
    }),
    sendEmailVerification: sendEmailVerification({
      userRepository,
      cache: redisClient,
      email: emailClient,
      logger,
      config: {
        verificationCodeTTL: config.verification.codeTTL,
        maxVerificationAttempts: config.verification.maxAttempts,
      },
    }),
    verifyEmail: verifyUserEmail({
      userRepository,
      cache: redisClient,
      email: emailClient,
      logger,
      config: {
        verificationCodeTTL: config.verification.codeTTL,
        maxVerificationAttempts: config.verification.maxAttempts,
      },
    }),
    setPhoneAndSendVerification: setPhoneAndSendVerification({
      userRepository,
      cache: redisClient,
      sms: smsClient,
      logger,
      config: {
        verificationCodeTTL: config.verification.codeTTL,
        maxVerificationAttempts: config.verification.maxAttempts,
      },
    }),
    verifyPhone: verifyUserPhone({
      userRepository,
      cache: redisClient,
      sms: smsClient,
      logger,
      config: {
        verificationCodeTTL: config.verification.codeTTL,
        maxVerificationAttempts: config.verification.maxAttempts,
      },
    }),

    // Storage
    uploadAvatar: uploadAvatar({
      userRepository,
      storage: s3Client,
      logger,
      config: {
        avatarBucket: config.s3.bucket,
        maxAvatarSize: config.avatar.maxSize,
        allowedMimeTypes: config.avatar.allowedTypes,
      },
    }),
    deleteAvatar: deleteAvatar({
      userRepository,
      storage: s3Client,
      logger,
    }),
  };

  // ==========================================
  // HTTP Application
  // ==========================================

  const app = new Elysia()
    // OpenAPI Documentation (GET /docs)
    .use(openapi())

    // Observability Middleware
    .use(observabilityMiddleware())

    // Rate Limiting
    .use(
      config.rateLimit.enabled
        ? rateLimiterPlugin({
            cache: redisClient,
            logger,
            capacity: config.rateLimit.capacity,
            leakRate: config.rateLimit.leakRate,
            skipPaths: ["/health", "/health/live", "/health/ready", "/metrics", "/openapi"],
          })
        : new Elysia()
    )

    // Authentication Middleware
    .use(
      authMiddleware({
        jwt: jwtService,
        sessionRepository,
        cache: redisClient,
        logger,
        publicPaths: [
          "/",
          "/health",
          "/health/*",
          "/metrics",
          "/metrics/*",
          "/openapi",
          "/openapi/*",
          "/user/register/*",
          "/user/login/*",
        ],
        sessionCacheTTL: config.session.cacheTTL,
      })
    )

    // Health Checks
    .get("/", () => ({
      message: "User Service",
      service: config.service.name,
      version: config.service.version,
      timestamp: new Date().toISOString(),
    }))
    .get("/health", async ({ set }) => {
      const health = await performHealthCheck();
      set.status = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;
      return health;
    })
    .get("/health/live", async ({ set }) => {
      const health = await performLivenessCheck();
      set.status = health.status === "healthy" ? 200 : 503;
      return health;
    })
    .get("/health/ready", async ({ set }) => {
      const health = await performReadinessCheck();
      set.status = health.status === "healthy" ? 200 : 503;
      return health;
    })

    // Metrics
    .get("/metrics", ({ set }) => {
      set.headers["Content-Type"] = "text/plain; version=0.0.4";
      return metrics.toPrometheusFormat();
    })
    .get("/metrics/json", () => metrics.toJSON())

    // API Routes
    .use(createUserRoutes(useCases))
    .use(createStorageRoutes(useCases))

    // Start server
    .listen({
      port: config.server.port,
      hostname: config.server.host,
    });

  // ==========================================
  // Graceful Shutdown
  // ==========================================

  const shutdownHandler = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    try {
      // Stop accepting new connections
      app.stop();

      // Close infrastructure connections
      await Promise.all([
        postgresClient.close(),
        redisClient.close(),
      ]);

      logger.info("Shutdown complete");
      process.exit(0);
    } catch (err) {
      logger.error("Error during shutdown", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdownHandler("SIGTERM"));
  process.on("SIGINT", () => shutdownHandler("SIGINT"));

  // ==========================================
  // Startup Logging
  // ==========================================

  logger.info("Server started", {
    port: config.server.port,
    host: config.server.host,
    environment: config.server.nodeEnv,
    version: config.service.version,
  });

  logger.info(`🚀 Server running at http://${config.server.host}:${config.server.port}`);
  logger.info(`📚 OpenAPI documentation at http://${config.server.host}:${config.server.port}/openapi`);
  logger.info(`📊 Metrics at http://${config.server.host}:${config.server.port}/metrics`);

  return app;
};
