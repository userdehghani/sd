/**
 * PostgreSQL Client - Singleton Pattern
 * Using native pg client (or can be swapped with Drizzle, Prisma, etc.)
 */

import { type Result, ok, err, InfraErrors, type DomainError } from "../../../core";
import type { LoggerPort } from "../../../application/ports";

// ============================================
// Types
// ============================================

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxConnections?: number;
  idleTimeout?: number;
  connectionTimeout?: number;
  ssl?: boolean;
}

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

export interface PostgresClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<Result<QueryResult<T>, DomainError>>;
  transaction<T>(fn: (client: TransactionClient) => Promise<T>): Promise<Result<T, DomainError>>;
  close(): Promise<void>;
  isHealthy(): Promise<boolean>;
}

export interface TransactionClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

// ============================================
// Singleton Implementation
// ============================================

let instance: PostgresClient | null = null;

export const createPostgresClient = (
  config: PostgresConfig,
  logger: LoggerPort
): PostgresClient => {
  // Return existing instance if available
  if (instance) {
    logger.debug("Returning existing PostgreSQL client instance");
    return instance;
  }

  logger.info("Creating PostgreSQL client", {
    host: config.host,
    port: config.port,
    database: config.database,
  });

  // Connection pool simulation (replace with actual pg Pool)
  // In production, use: import { Pool } from 'pg';
  const pool = {
    connections: 0,
    maxConnections: config.maxConnections || 10,
    config,
  };

  const client: PostgresClient = {
    async query<T = unknown>(
      sql: string,
      params?: unknown[]
    ): Promise<Result<QueryResult<T>, DomainError>> {
      try {
        logger.debug("Executing query", { sql: sql.substring(0, 100) });

        // Placeholder - replace with actual pg query
        // const result = await pool.query(sql, params);
        // return ok({ rows: result.rows, rowCount: result.rowCount });

        // Simulated response for structure demonstration
        return ok({ rows: [] as T[], rowCount: 0 });
      } catch (error) {
        logger.error("Query failed", error as Error, { sql: sql.substring(0, 100) });
        return err(InfraErrors.DATABASE_ERROR("query", error as Error));
      }
    },

    async transaction<T>(
      fn: (client: TransactionClient) => Promise<T>
    ): Promise<Result<T, DomainError>> {
      try {
        logger.debug("Starting transaction");

        // Placeholder - replace with actual transaction
        // const client = await pool.connect();
        // await client.query('BEGIN');
        // const result = await fn(client);
        // await client.query('COMMIT');
        // client.release();
        // return ok(result);

        const txClient: TransactionClient = {
          async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
            return { rows: [] as T[], rowCount: 0 };
          },
        };

        const result = await fn(txClient);
        return ok(result);
      } catch (error) {
        logger.error("Transaction failed", error as Error);
        // await client.query('ROLLBACK');
        return err(InfraErrors.DATABASE_ERROR("transaction", error as Error));
      }
    },

    async close(): Promise<void> {
      logger.info("Closing PostgreSQL client");
      // await pool.end();
      instance = null;
    },

    async isHealthy(): Promise<boolean> {
      try {
        // await pool.query('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },
  };

  instance = client;
  return client;
};

// ============================================
// Get Singleton Instance
// ============================================

export const getPostgresClient = (): PostgresClient | null => instance;

// ============================================
// Reset for Testing
// ============================================

export const resetPostgresClient = (): void => {
  instance = null;
};
