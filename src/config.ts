/**
 * Configuration management for cloud-native applications
 * Centralizes environment variable handling with validation
 */

export interface AppConfig {
  // Server
  port: number;
  host: string;
  nodeEnv: string;

  // Service
  serviceName: string;
  version: string;

  // Database
  dbHost: string;
  dbPort: number;
  dbUser: string | undefined;
  dbPassword: string | undefined;
  dbName: string | undefined;

  // Redis
  redisHost: string;
  redisPort: number;

  // NATS
  natsHost: string;
  natsPort: number;

  // Observability
  logLevel: string;
  logFormat: "json" | "text";
  enableMetrics: boolean;
  enableTracing: boolean;

  // Graceful shutdown
  shutdownTimeout: number;
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

export const config: AppConfig = {
  // Server
  port: getEnvNumber("PORT", 3005),
  host: getEnv("HOST", "0.0.0.0"),
  nodeEnv: getEnv("NODE_ENV", "development"),

  // Service
  serviceName: getEnv("SERVICE_NAME", "elysia-app"),
  version: getEnv("APP_VERSION", "1.0.50"),

  // Database
  dbHost: getEnv("DB_HOST", "localhost"),
  dbPort: getEnvNumber("DB_PORT", 5432),
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  dbName: process.env.DB_NAME,

  // Redis
  redisHost: getEnv("REDIS_HOST", "elysia-redis"),
  redisPort: getEnvNumber("REDIS_PORT", 6379),

  // NATS
  natsHost: getEnv("NATS_HOST", "elysia-nats"),
  natsPort: getEnvNumber("NATS_PORT", 4222),

  // Observability
  logLevel: getEnv("LOG_LEVEL", "INFO"),
  logFormat: (getEnv("LOG_FORMAT", "text") as "json" | "text") || "text",
  enableMetrics: getEnvBoolean("ENABLE_METRICS", true),
  enableTracing: getEnvBoolean("ENABLE_TRACING", true),

  // Graceful shutdown
  shutdownTimeout: getEnvNumber("SHUTDOWN_TIMEOUT", 10000),
};

// Validate critical configuration
if (config.nodeEnv === "production" && config.logFormat !== "json") {
  console.warn("WARNING: Production environment should use JSON log format");
}

