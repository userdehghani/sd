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

const app = new Elysia()
  .use(openapi())
  .use(observabilityMiddleware())
  .get("/", () => {
    return {
      message: "Hello, World!",
      service: config.serviceName,
      version: config.version,
      timestamp: new Date().toISOString(),
    };
  })
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
  .get("/metrics", ({ set }) => {
    set.headers["Content-Type"] = "text/plain; version=0.0.4";
    return metrics.toPrometheusFormat();
  })
  .get("/metrics/json", () => {
    return metrics.toJSON();
  })
  .listen({
    port: config.port,
    hostname: config.host,
  });

process.on("SIGTERM", () => shutdown(app, "SIGTERM"));
process.on("SIGINT", () => shutdown(app, "SIGINT"));

logger.info("Server starting", {
  port: config.port,
  host: config.host,
  environment: config.nodeEnv,
  version: config.version,
});

logger.info(`🚀 Elysia server is running at ${app.server?.url}`);
logger.info(`🚀 Elysia OpenAPI documentation is running at ${app.server?.url}openapi`);
logger.info(`📊 Metrics endpoint available at ${app.server?.url}metrics`);
