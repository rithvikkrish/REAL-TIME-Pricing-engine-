import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  UPSTREAM_WS_URL: z.string().url().default('wss://v3-prod.livefxhub.com/ws/algo'),
  UPSTREAM_API_KEY: z.string().optional().default(''),
  UPSTREAM_SECRET_KEY: z.string().optional().default(''),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_ENABLED: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SPIKE_THRESHOLD_PERCENT: z.coerce.number().positive().default(50), // Reject or flag single-tick jumps > 50%
  ROLLING_WINDOW_MS: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000), // 24 hours
  DOWNSTREAM_RATE_LIMIT_PER_SEC: z.coerce.number().int().positive().default(50),
  MAX_DOWNSTREAM_PAYLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024), // 10 KB limit
  MAX_CLIENT_BUFFERED_AMOUNT: z.coerce.number().int().positive().default(1024 * 1024), // 1MB client backpressure threshold
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  throw new Error('Environment configuration validation failed');
}

export const config = parsed.data;
export type AppConfig = typeof config;
