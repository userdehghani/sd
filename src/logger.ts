/**
 * Structured logging for cloud-native applications
 * Supports JSON logging for log aggregation systems (ELK, Loki, etc.)
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  version: string;
  [key: string]: any;
}

class Logger {
  private serviceName: string;
  private version: string;
  private minLevel: LogLevel;
  private jsonFormat: boolean;

  constructor() {
    this.serviceName = process.env.SERVICE_NAME || "elysia-app";
    this.version = process.env.APP_VERSION || "1.0.50";
    this.minLevel = this.getLogLevel(process.env.LOG_LEVEL || "INFO");
    this.jsonFormat = process.env.LOG_FORMAT === "json" || process.env.NODE_ENV === "production";
  }

  private getLogLevel(level: string): LogLevel {
    const levels: Record<string, LogLevel> = {
      DEBUG: LogLevel.DEBUG,
      INFO: LogLevel.INFO,
      WARN: LogLevel.WARN,
      ERROR: LogLevel.ERROR,
    };
    return levels[level.toUpperCase()] || LogLevel.INFO;
  }

  private formatLog(level: string, message: string, meta?: Record<string, any>): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      version: this.version,
      ...meta,
    };

    if (this.jsonFormat) {
      return JSON.stringify(entry);
    }

    // Human-readable format for development
    const metaStr = meta && Object.keys(meta).length > 0 
      ? ` ${JSON.stringify(meta)}` 
      : "";
    return `[${entry.timestamp}] [${level}] ${message}${metaStr}`;
  }

  private log(level: LogLevel, levelName: string, message: string, meta?: Record<string, any>) {
    if (level < this.minLevel) {
      return;
    }

    const formatted = this.formatLog(levelName, message, meta);
    const output = level >= LogLevel.ERROR ? console.error : console.log;
    output(formatted);
  }

  debug(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.DEBUG, "DEBUG", message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.INFO, "INFO", message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.WARN, "WARN", message, meta);
  }

  error(message: string, error?: Error | any, meta?: Record<string, any>) {
    const errorMeta = {
      ...meta,
      ...(error instanceof Error
        ? {
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          }
        : error
        ? { error: String(error) }
        : {}),
    };
    this.log(LogLevel.ERROR, "ERROR", message, errorMeta);
  }
}

export const logger = new Logger();

