/**
 * S3 Client (Singleton)
 * Manages S3 operations for file storage
 */

import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import { logger } from "../../logger";

export class S3ClientSingleton {
  private static instance: S3ClientSingleton;
  private client: S3Client;

  private constructor(config: S3ClientConfig) {
    this.client = new S3Client(config);
    logger.info("S3 Client initialized");
  }

  static getInstance(config?: S3ClientConfig): S3ClientSingleton {
    if (!S3ClientSingleton.instance) {
      if (!config) {
        throw new Error("S3 config required for first initialization");
      }
      S3ClientSingleton.instance = new S3ClientSingleton(config);
    }
    return S3ClientSingleton.instance;
  }

  getClient(): S3Client {
    return this.client;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // S3 doesn't have a direct health check, return true if client is initialized
      return this.client !== null;
    } catch (error) {
      logger.error("S3 health check failed", { error });
      return false;
    }
  }

  async destroy(): Promise<void> {
    try {
      this.client.destroy();
      logger.info("S3 Client destroyed");
    } catch (error) {
      logger.error("Error destroying S3 client", { error });
      throw error;
    }
  }
}
