/**
 * Environment Configuration
 * Centralized configuration with validation
 */

// ============================================
// Helper Functions
// ============================================

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (value !== undefined) return value;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing required environment variable: ${key}`);
};

const getEnvOptional = (key: string): string | undefined => {
  return process.env[key];
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
};

// ============================================
// Configuration Interface
// ============================================

export interface AppConfig {
  // Server
  server: {
    port: number;
    host: string;
    nodeEnv: string;
    isProduction: boolean;
  };

  // Service Info
  service: {
    name: string;
    version: string;
  };

  // PostgreSQL
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    maxConnections: number;
    ssl: boolean;
  };

  // Redis
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
  };

  // JWT
  jwt: {
    secret: string;
    issuer: string;
    audience: string;
    accessTokenTTL: number; // seconds
    refreshTokenTTL: number; // seconds
  };

  // Session
  session: {
    durationSeconds: number;
    cacheTTL: number;
  };

  // OAuth - Google
  google: {
    clientId: string;
    clientSecret: string;
  };

  // OAuth - Apple
  apple: {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
  };

  // Passkey (WebAuthn)
  passkey: {
    rpId: string;
    rpName: string;
    rpOrigin: string;
    challengeTTL: number;
  };

  // TOTP
  totp: {
    issuer: string;
    pendingRegistrationTTL: number;
    loginTokenTTL: number;
  };

  // S3 Storage
  s3: {
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
    publicUrlBase?: string;
  };

  // Avatar
  avatar: {
    maxSize: number;
    allowedTypes: string[];
  };

  // Email (Resend)
  email: {
    apiKey: string;
    fromEmail: string;
    fromName: string;
    replyTo?: string;
  };

  // SMS (Melli Payamak)
  sms: {
    username: string;
    password: string;
    from: string;
  };

  // Verification
  verification: {
    codeTTL: number;
    maxAttempts: number;
  };

  // Rate Limiting
  rateLimit: {
    enabled: boolean;
    capacity: number;
    leakRate: number;
  };

  // Observability
  observability: {
    logLevel: string;
    logFormat: "json" | "text";
    enableMetrics: boolean;
    enableTracing: boolean;
  };

  // Graceful Shutdown
  shutdown: {
    timeout: number;
  };
}

// ============================================
// Configuration Instance
// ============================================

export const config: AppConfig = {
  server: {
    port: getEnvNumber("PORT", 3005),
    host: getEnv("HOST", "0.0.0.0"),
    nodeEnv: getEnv("NODE_ENV", "development"),
    isProduction: getEnv("NODE_ENV", "development") === "production",
  },

  service: {
    name: getEnv("SERVICE_NAME", "user-service"),
    version: getEnv("APP_VERSION", "1.0.0"),
  },

  postgres: {
    host: getEnv("DB_HOST", "localhost"),
    port: getEnvNumber("DB_PORT", 5432),
    database: getEnv("DB_NAME", "userdb"),
    user: getEnv("DB_USER", "postgres"),
    password: getEnv("DB_PASSWORD", "postgres"),
    maxConnections: getEnvNumber("DB_MAX_CONNECTIONS", 10),
    ssl: getEnvBoolean("DB_SSL", false),
  },

  redis: {
    host: getEnv("REDIS_HOST", "localhost"),
    port: getEnvNumber("REDIS_PORT", 6379),
    password: getEnvOptional("REDIS_PASSWORD"),
    db: getEnvNumber("REDIS_DB", 0),
    keyPrefix: getEnv("REDIS_KEY_PREFIX", "user:"),
  },

  jwt: {
    secret: getEnv("JWT_SECRET", "change-me-in-production"),
    issuer: getEnv("JWT_ISSUER", "user-service"),
    audience: getEnv("JWT_AUDIENCE", "user-service"),
    accessTokenTTL: getEnvNumber("JWT_ACCESS_TOKEN_TTL", 3600), // 1 hour
    refreshTokenTTL: getEnvNumber("JWT_REFRESH_TOKEN_TTL", 604800), // 7 days
  },

  session: {
    durationSeconds: getEnvNumber("SESSION_DURATION", 604800), // 7 days
    cacheTTL: getEnvNumber("SESSION_CACHE_TTL", 300), // 5 minutes
  },

  google: {
    clientId: getEnv("GOOGLE_CLIENT_ID", ""),
    clientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
  },

  apple: {
    clientId: getEnv("APPLE_CLIENT_ID", ""),
    teamId: getEnv("APPLE_TEAM_ID", ""),
    keyId: getEnv("APPLE_KEY_ID", ""),
    privateKey: getEnv("APPLE_PRIVATE_KEY", ""),
  },

  passkey: {
    rpId: getEnv("PASSKEY_RP_ID", "localhost"),
    rpName: getEnv("PASSKEY_RP_NAME", "User Service"),
    rpOrigin: getEnv("PASSKEY_RP_ORIGIN", "http://localhost:3005"),
    challengeTTL: getEnvNumber("PASSKEY_CHALLENGE_TTL", 300), // 5 minutes
  },

  totp: {
    issuer: getEnv("TOTP_ISSUER", "User Service"),
    pendingRegistrationTTL: getEnvNumber("TOTP_PENDING_TTL", 600), // 10 minutes
    loginTokenTTL: getEnvNumber("TOTP_LOGIN_TOKEN_TTL", 300), // 5 minutes
  },

  s3: {
    region: getEnv("S3_REGION", "us-east-1"),
    bucket: getEnv("S3_BUCKET", "avatars"),
    accessKeyId: getEnv("S3_ACCESS_KEY_ID", ""),
    secretAccessKey: getEnv("S3_SECRET_ACCESS_KEY", ""),
    endpoint: getEnvOptional("S3_ENDPOINT"),
    publicUrlBase: getEnvOptional("S3_PUBLIC_URL_BASE"),
  },

  avatar: {
    maxSize: getEnvNumber("AVATAR_MAX_SIZE", 5 * 1024 * 1024), // 5MB
    allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  },

  email: {
    apiKey: getEnv("RESEND_API_KEY", ""),
    fromEmail: getEnv("EMAIL_FROM", "noreply@example.com"),
    fromName: getEnv("EMAIL_FROM_NAME", "User Service"),
    replyTo: getEnvOptional("EMAIL_REPLY_TO"),
  },

  sms: {
    username: getEnv("MELLI_PAYAMAK_USERNAME", ""),
    password: getEnv("MELLI_PAYAMAK_PASSWORD", ""),
    from: getEnv("MELLI_PAYAMAK_FROM", ""),
  },

  verification: {
    codeTTL: getEnvNumber("VERIFICATION_CODE_TTL", 600), // 10 minutes
    maxAttempts: getEnvNumber("VERIFICATION_MAX_ATTEMPTS", 5),
  },

  rateLimit: {
    enabled: getEnvBoolean("RATE_LIMIT_ENABLED", true),
    capacity: getEnvNumber("RATE_LIMIT_CAPACITY", 100),
    leakRate: getEnvNumber("RATE_LIMIT_LEAK_RATE", 10), // requests per second
  },

  observability: {
    logLevel: getEnv("LOG_LEVEL", "INFO"),
    logFormat: (getEnv("LOG_FORMAT", "text") as "json" | "text"),
    enableMetrics: getEnvBoolean("ENABLE_METRICS", true),
    enableTracing: getEnvBoolean("ENABLE_TRACING", true),
  },

  shutdown: {
    timeout: getEnvNumber("SHUTDOWN_TIMEOUT", 10000),
  },
};

// ============================================
// Validation
// ============================================

export const validateConfig = (): void => {
  const errors: string[] = [];

  // Validate critical production settings
  if (config.server.isProduction) {
    if (config.jwt.secret === "change-me-in-production") {
      errors.push("JWT_SECRET must be set in production");
    }
    if (config.observability.logFormat !== "json") {
      console.warn("WARNING: Production should use JSON log format");
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join("\n")}`);
  }
};
