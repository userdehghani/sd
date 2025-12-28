/**
 * Redis Client (Singleton)
 * Manages Redis connections for cache and pub/sub
 */

import Redis, { RedisOptions } from "ioredis";
import { logger } from "../../logger";

export class RedisClient {
  private static instance: RedisClient;
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private isConnected: boolean = false;

  private constructor(config: RedisOptions) {
    // Main client for cache operations
    this.client = new Redis({
      ...config,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    // Separate clients for pub/sub
    this.subscriber = new Redis(config);
    this.publisher = new Redis(config);

    this.setupEventHandlers();
  }

  static getInstance(config?: RedisOptions): RedisClient {
    if (!RedisClient.instance) {
      if (!config) {
        throw new Error("Redis config required for first initialization");
      }
      RedisClient.instance = new RedisClient(config);
    }
    return RedisClient.instance;
  }

  private setupEventHandlers(): void {
    this.client.on("connect", () => {
      logger.info("Redis client connected");
      this.isConnected = true;
    });

    this.client.on("error", (error) => {
      logger.error("Redis client error", { error });
    });

    this.client.on("close", () => {
      logger.warn("Redis client connection closed");
      this.isConnected = false;
    });

    this.subscriber.on("connect", () => {
      logger.info("Redis subscriber connected");
    });

    this.publisher.on("connect", () => {
      logger.info("Redis publisher connected");
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.client.ping();
      logger.info("Redis connected successfully");
    } catch (error) {
      logger.error("Failed to connect to Redis", { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await Promise.all([
        this.client.quit(),
        this.subscriber.quit(),
        this.publisher.quit(),
      ]);
      this.isConnected = false;
      logger.info("Redis disconnected successfully");
    } catch (error) {
      logger.error("Error disconnecting from Redis", { error });
      throw error;
    }
  }

  getClient(): Redis {
    return this.client;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }

  getPublisher(): Redis {
    return this.publisher;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch (error) {
      logger.error("Redis health check failed", { error });
      return false;
    }
  }
}
