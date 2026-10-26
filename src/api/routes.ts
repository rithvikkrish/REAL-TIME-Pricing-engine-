import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { HealthService } from './health';
import { PriceProcessor } from '../engine/price-processor';
import { FeedSimulator } from '../engine/feed-simulator';
import { register } from '../metrics/prometheus';
import { openApiSpec } from './openapi';
import { DASHBOARD_HTML } from './dashboard';
import { isValidSymbol } from '../config/symbols';

export interface RouteOptions {
  healthService: HealthService;
  processor: PriceProcessor;
  simulator?: FeedSimulator;
}

export function buildRoutes(
  healthService: HealthService,
  processor: PriceProcessor,
  simulator?: FeedSimulator
): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    // Operations Visual Dashboard
    app.get('/', async (req, reply) => {
      return reply.type('text/html').send(DASHBOARD_HTML);
    });

    // Health probe
    app.get('/health', async () => {
      return healthService.getHealth();
    });

    // Readiness probe
    app.get('/ready', async (req, reply) => {
      const readiness = healthService.getReadiness();
      const statusCode = readiness.status === 'not_ready' ? 503 : 200;
      return reply.status(statusCode).send(readiness);
    });

    // Prometheus metrics
    app.get('/metrics', async (req, reply) => {
      const metrics = await register.metrics();
      return reply.type('text/plain; version=0.0.4').send(metrics);
    });

    // OpenAPI Specification
    app.get('/api/openapi.json', async () => {
      return openApiSpec;
    });

    // All latest prices
    app.get('/api/prices', async () => {
      return processor.getAllSnapshots();
    });

    // Single symbol price
    app.get<{ Params: { symbol: string } }>('/api/prices/:symbol', async (req, reply) => {
      const symbol = req.params.symbol.toUpperCase().trim();
      if (!isValidSymbol(symbol)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Symbol '${symbol}' is not supported`,
        });
      }

      const snapshot = processor.getSnapshot(symbol);
      if (!snapshot) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `No market data received yet for '${symbol}'`,
        });
      }

      return snapshot;
    });

    // OHLC Candles (Bonus Requirement)
    app.get<{ Params: { symbol: string } }>('/api/prices/:symbol/candles', async (req, reply) => {
      const symbol = req.params.symbol.toUpperCase().trim();
      if (!isValidSymbol(symbol)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Symbol '${symbol}' is not supported`,
        });
      }

      const candles = processor.getCandles(symbol);
      return {
        symbol,
        interval: '1m',
        candleCount: candles.length,
        candles,
      };
    });

    // Simulation toggle routes
    app.post('/api/simulate/start', async () => {
      if (simulator) {
        simulator.start(150);
        return { status: 'started', message: 'Internal live feed simulator started' };
      }
      return { status: 'unavailable' };
    });

    app.post('/api/simulate/stop', async () => {
      if (simulator) {
        simulator.stop();
        return { status: 'stopped', message: 'Internal live feed simulator stopped' };
      }
      return { status: 'unavailable' };
    });
  };
}
