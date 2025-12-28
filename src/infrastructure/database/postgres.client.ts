/**
 * PostgreSQL Database Client (Singleton)
 * Manages database connection pool
 */

import { Pool, PoolConfig } from "pg";
import { logger } from "../../logger";

export class PostgresClient {
  private static instance: PostgresClient;
  private pool: Pool;
  private isConnected: boolean = false;

  private constructor(config: PoolConfig) {
    this.pool = new Pool({
      ...config,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on("error", (err) => {
      logger.error("Unexpected error on idle client", { error: err });
    });

    this.pool.on("connect", () => {
      logger.info("New client connected to PostgreSQL");
    });
  }

  static getInstance(config?: PoolConfig): PostgresClient {
    if (!PostgresClient.instance) {
      if (!config) {
        throw new Error("PostgreSQL config required for first initialization");
      }
      PostgresClient.instance = new PostgresClient(config);
    }
    return PostgresClient.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const client = await this.pool.connect();
      await client.query("SELECT NOW()");
      client.release();
      this.isConnected = true;
      logger.info("PostgreSQL connected successfully");
    } catch (error) {
      logger.error("Failed to connect to PostgreSQL", { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info("PostgreSQL disconnected successfully");
    } catch (error) {
      logger.error("Error disconnecting from PostgreSQL", { error });
      throw error;
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug("Executed query", { text, duration, rows: result.rowCount });
      return result.rows;
    } catch (error) {
      logger.error("Query error", { text, error });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch (error) {
      logger.error("PostgreSQL health check failed", { error });
      return false;
    }
  }
}
