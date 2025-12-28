import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { shutdown } from "./gsh";
import {
  performHealthCheck,
  performLivenessCheck,
  performReadinessCheck,
} from "./health";
import { logger } from "./logger";
import { metrics } from "./metrics";
import { config } from "./config";
import { observabilityMiddleware } from "./middleware";
import { Container, AppConfig } from "./container";
import { registerRoutes } from "./interface/http/routes";

/**
 * Application Bootstrap
 * Initializes container, registers routes, and starts server
 */

async function bootstrap() {
  logger.info("🚀 Starting application...");

  // Load application configuration
  const appConfig: AppConfig = {
    database: {
      host: process.env.DATABASE_HOST || "localhost",
      port: parseInt(process.env.DATABASE_PORT || "5432"),
      database: process.env.DATABASE_NAME || "myapp",
      user: process.env.DATABASE_USER || "postgres",
      password: process.env.DATABASE_PASSWORD || "postgres",
    },
    redis: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
    },
    s3: {
      region: process.env.S3_REGION || "us-east-1",
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      bucketName: process.env.S3_BUCKET_NAME || "avatars",
      cdnUrl: process.env.S3_CDN_URL,
    },
    jwt: {
      secret: process.env.JWT_SECRET || "change-this-secret-in-production",
      expiresIn: process.env.JWT_EXPIRES_IN || "30d",
    },
    oauth: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirectUri: process.env.GOOGLE_REDIRECT_URI || "",
      },
      apple: {
        clientId: process.env.APPLE_CLIENT_ID || "",
        clientSecret: process.env.APPLE_CLIENT_SECRET || "",
        redirectUri: process.env.APPLE_REDIRECT_URI || "",
      },
    },
    passkey: {
      rpName: process.env.PASSKEY_RP_NAME || "MyApp",
      rpId: process.env.PASSKEY_RP_ID || "localhost",
      origin: process.env.PASSKEY_ORIGIN || "http://localhost:3000",
    },
    email: {
      apiKey: process.env.EMAIL_API_KEY || "",
      fromEmail: process.env.EMAIL_FROM_EMAIL || "noreply@example.com",
      fromName: process.env.EMAIL_FROM_NAME || "MyApp",
    },
    sms: {
      username: process.env.SMS_USERNAME || "",
      password: process.env.SMS_PASSWORD || "",
      fromNumber: process.env.SMS_FROM_NUMBER || "",
    },
    rateLimit: {
      capacity: parseInt(process.env.RATE_LIMIT_CAPACITY || "100"),
      refillRate: parseInt(process.env.RATE_LIMIT_REFILL_RATE || "10"),
    },
  };

  // Initialize dependency injection container
  const container = new Container(appConfig);
  await container.initialize();
  logger.info("✅ Container initialized");

  // Create Elysia app
  const app = new Elysia()
    .use(openapi())
    .use(observabilityMiddleware())
    .get("/", () => {
      return {
        message: "User Authentication & Profile Management API",
        service: config.serviceName,
        version: config.version,
        timestamp: new Date().toISOString(),
        documentation: "/openapi",
      };
    })
    .get("/health", async ({ set }) => {
      const health = await performHealthCheck();
      const infrastructure = await container.healthCheck();
      
      const allHealthy = 
        health.status === "healthy" && 
        infrastructure.postgres && 
        infrastructure.redis && 
        infrastructure.s3;
      
      set.status = allHealthy ? 200 : 503;
      
      return {
        ...health,
        infrastructure: {
          postgres: infrastructure.postgres ? "healthy" : "unhealthy",
          redis: infrastructure.redis ? "healthy" : "unhealthy",
          s3: infrastructure.s3 ? "healthy" : "unhealthy",
        },
      };
    })
    .get("/health/live", async ({ set }) => {
      const health = await performLivenessCheck();
      set.status = health.status === "healthy" ? 200 : 503;
      return health;
    })
    .get("/health/ready", async ({ set }) => {
      const health = await performReadinessCheck();
      const infrastructure = await container.healthCheck();
      
      const isReady = 
        health.status === "healthy" && 
        infrastructure.postgres && 
        infrastructure.redis;
      
      set.status = isReady ? 200 : 503;
      
      return {
        ...health,
        infrastructure,
      };
    })
    .get("/metrics", ({ set }) => {
      set.headers["Content-Type"] = "text/plain; version=0.0.4";
      return metrics.toPrometheusFormat();
    })
    .get("/metrics/json", () => {
      return metrics.toJSON();
    });

  // Register application routes
  registerRoutes(app, container.getControllers(), container.getMiddleware());
  logger.info("✅ Routes registered");

  // Start server
  app.listen({
    port: config.port,
    hostname: config.host,
  });

  // Setup graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info(`📥 ${signal} received, starting graceful shutdown...`);
    
    await container.shutdown();
    await shutdown(app, signal);
    
    logger.info("👋 Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  logger.info("Server starting", {
    port: config.port,
    host: config.host,
    environment: config.nodeEnv,
    version: config.version,
  });

  logger.info(`🚀 Server running at ${app.server?.url}`);
  logger.info(`📚 API documentation at ${app.server?.url}openapi`);
  logger.info(`📊 Metrics endpoint at ${app.server?.url}metrics`);
  logger.info(`💚 Health check at ${app.server?.url}health`);
}

// Start application
bootstrap().catch((error) => {
  logger.error("❌ Failed to start application", { error });
  process.exit(1);
});
