import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: [
      'api_key',
      'secret',
      'apiKey',
      'secretKey',
      '*.api_key',
      '*.secret',
      '*.apiKey',
      '*.secretKey',
      'password',
      'authorization',
      'headers.authorization',
    ],
    censor: '[REDACTED]',
  },
  base: {
    service: 'real-time-pricing-engine',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
