import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { redisOperationsTotal, redisLatency } from '../metrics/prometheus';

export interface RedisConfigOptions {
  url?: string;
  enabled?: boolean;
}

export class RedisManager {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private isFallbackMode: boolean = false;
  private memoryStore: Map<string, any> = new Map();

  constructor(private options: RedisConfigOptions = {}) {}

  public async connect(): Promise<boolean> {
    if (this.options.enabled === false) {
      logger.info('Redis persistence explicitly disabled. Operating in resilient in-memory mode.');
      this.isFallbackMode = true;
      return true;
    }

    try {
      const redisUrl = this.options.url || 'redis://localhost:6379';
      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => {
          if (times > 3) {
            logger.warn('Max Redis connection retries reached. Falling back to in-memory mode.');
            this.isFallbackMode = true;
            return null; // Stop reconnecting automatically, operate in fallback
          }
          return Math.min(times * 100, 1000);
        },
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.isFallbackMode = false;
        logger.info('Successfully connected to Redis');
      });

      this.client.on('error', (err) => {
        logger.warn({ err: err.message }, 'Redis connection error. Swapping to resilient in-memory storage.');
        this.isConnected = false;
        this.isFallbackMode = true;
        redisOperationsTotal.inc({ operation: 'connect', status: 'error' });
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });

      await this.client.connect();
      this.isConnected = true;
      return true;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Redis initial connection failed. Using in-memory fallback.');
      this.isConnected = false;
      this.isFallbackMode = true;
      return false;
    }
  }

  public getClient(): Redis | null {
    return this.isConnected ? this.client : null;
  }

  public isReady(): boolean {
    return this.isConnected || this.isFallbackMode;
  }

  public isUsingFallback(): boolean {
    return this.isFallbackMode;
  }

  public async execute<T>(
    operationName: string,
    redisOp: (client: Redis) => Promise<T>,
    fallbackOp: (memoryStore: Map<string, any>) => Promise<T> | T
  ): Promise<T> {
    const hrStart = process.hrtime();
    if (this.isConnected && this.client) {
      try {
        const result = await redisOp(this.client);
        const hrDiff = process.hrtime(hrStart);
        redisLatency.observe(hrDiff[0] + hrDiff[1] / 1e9);
        redisOperationsTotal.inc({ operation: operationName, status: 'success' });
        return result;
      } catch (err) {
        logger.warn({ err: (err as Error).message, op: operationName }, 'Redis op failed, falling back to memory');
        redisOperationsTotal.inc({ operation: operationName, status: 'fallback' });
        return fallbackOp(this.memoryStore);
      }
    } else {
      return fallbackOp(this.memoryStore);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.client = null;
      this.isConnected = false;
    }
  }
}
