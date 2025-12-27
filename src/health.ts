
export interface HealthStatus {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    application: CheckResult;
    database?: CheckResult;
    redis?: CheckResult;
    nats?: CheckResult;
  };
}

export interface CheckResult {
  status: "up" | "down";
  responseTime?: number;
  message?: string;
  error?: string;
}

import { logger } from "./logger";
import { config } from "./config";

const startTime = Date.now();
const VERSION = config.version;

async function checkApplication(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const responseTime = Date.now() - start;
    return {
      status: "up",
      responseTime,
      message: "Application is running",
    };
  } catch (error) {
    return {
      status: "down",
      message: "Application check failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const dbHost = config.dbHost;
    const dbPort = config.dbPort;
    
    const timeout = 2000;
    
    const checkPromise = new Promise<boolean>((resolve) => {
      let resolved = false;
      let socket: any = null;
      let timer: Timer | null = null;
      
      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (socket) {
          try {
            if (typeof socket.end === 'function') {
              socket.end();
            } else if (typeof socket.destroy === 'function') {
              socket.destroy();
            }
          } catch {
          }
        }
      };

      const resolveOnce = (value: boolean) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(value);
        }
      };

      try {
        timer = setTimeout(() => {
          resolveOnce(false);
        }, timeout);

        const connectPromise = Bun.connect({
          hostname: dbHost,
          port: dbPort,
          socket: {
            open(sock) {
              socket = sock;
              resolveOnce(true);
            },
            error() {
              resolveOnce(false);
            },
            close() {
              if (!resolved) {
                resolveOnce(false);
              }
            },
          },
        });

        // Handle promise rejection
        if (connectPromise && typeof connectPromise.then === 'function') {
          connectPromise.catch(() => {
            resolveOnce(false);
          });
        }
      } catch (error) {
        resolveOnce(false);
      }
    });

    const isAvailable = await checkPromise;
    const responseTime = Date.now() - start;
    
    if (isAvailable) {
      return {
        status: "up",
        responseTime,
        message: "Database connection available",
      };
    }

    return {
      status: "down",
      responseTime,
      message: `Database connection unavailable (${dbHost}:${dbPort})`,
    };
  } catch (error) {
    return {
      status: "down",
      message: "Database check failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}



export async function performHealthCheck(
  includeDependencies: boolean = true
): Promise<HealthStatus> {
  const checks: HealthStatus["checks"] = {
    application: await checkApplication(),
  };

  if (includeDependencies) {
    const [database] = await Promise.all([
      checkDatabase(),
    ]);

    checks.database = database;
  }

  const allChecks = Object.values(checks);
  const criticalChecks = [checks.application];
  const dependencyChecks = includeDependencies
    ? [checks.database, checks.redis, checks.nats].filter(Boolean) as CheckResult[]
    : [];

  const criticalDown = criticalChecks.some((c) => c.status === "down");
  const dependenciesDown = dependencyChecks.some((c) => c.status === "down");

  let status: "healthy" | "unhealthy" | "degraded";
  if (criticalDown) {
    status = "unhealthy";
  } else if (dependenciesDown) {
    status = "degraded";
  } else {
    status = "healthy";
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000), 
    version: VERSION,
    checks,
  };
}

export async function performLivenessCheck(): Promise<HealthStatus> {
  return performHealthCheck(false);
}

export async function performReadinessCheck(): Promise<HealthStatus> {
  return performHealthCheck(true);
}

