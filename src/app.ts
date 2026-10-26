import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { AppConfig } from './config';
import { RedisManager } from './persistence/redis-client';
import { PriceRepository } from './persistence/price-repository';
import { StateRecoveryService } from './persistence/state-recovery';
import { PriceProcessor } from './engine/price-processor';
import { UpstreamClient } from './upstream/upstream-client';
import { SubscriptionManager } from './downstream/subscription-manager';
import { DownstreamPublisher } from './downstream/publisher';
import { DownstreamWebSocketServer } from './downstream/websocket-server';
import { HealthService } from './api/health';
import { buildRoutes } from './api/routes';
import { NormalizedPriceUpdate, PriceObservation } from './types/market';
import { logger } from './utils/logger';

import { FeedSimulator } from './engine/feed-simulator';

export class Application {
  public readonly fastify: FastifyInstance;
  public readonly redisManager: RedisManager;
  public readonly priceRepository: PriceRepository;
  public readonly processor: PriceProcessor;
  public readonly stateRecovery: StateRecoveryService;
  public readonly upstreamClient: UpstreamClient;
  public readonly subscriptionManager: SubscriptionManager;
  public readonly publisher: DownstreamPublisher;
  public downstreamServer!: DownstreamWebSocketServer;
  public readonly healthService: HealthService;
  public readonly simulator: FeedSimulator;

  constructor(private appConfig: AppConfig) {
    this.fastify = Fastify({
      logger: false, // We use central Pino logger
      disableRequestLogging: true,
    });

    this.redisManager = new RedisManager({
      url: appConfig.REDIS_URL,
      enabled: appConfig.REDIS_ENABLED,
    });

    this.priceRepository = new PriceRepository(this.redisManager);

    this.processor = new PriceProcessor({
      windowMs: appConfig.ROLLING_WINDOW_MS,
      spikeThresholdPercent: appConfig.SPIKE_THRESHOLD_PERCENT,
    });

    this.stateRecovery = new StateRecoveryService(
      this.priceRepository,
      this.processor,
      appConfig.ROLLING_WINDOW_MS
    );

    this.upstreamClient = new UpstreamClient(this.processor, {
      url: appConfig.UPSTREAM_WS_URL,
      apiKey: appConfig.UPSTREAM_API_KEY,
      secretKey: appConfig.UPSTREAM_SECRET_KEY,
    });

    this.subscriptionManager = new SubscriptionManager();

    this.publisher = new DownstreamPublisher(this.subscriptionManager, {
      maxPayloadBytes: appConfig.MAX_DOWNSTREAM_PAYLOAD_BYTES,
      maxBufferedAmount: appConfig.MAX_CLIENT_BUFFERED_AMOUNT,
    });

    this.healthService = new HealthService(this.upstreamClient, this.redisManager);
    this.simulator = new FeedSimulator(this.processor);

    this.wirePipeline();
  }

  private wirePipeline(): void {
    // When a new price update is accepted by the processor:
    this.processor.on('price_update', (update: NormalizedPriceUpdate) => {
      // 1. Immediately broadcast to downstream subscribers
      this.publisher.broadcastUpdate(update);

      // 2. Persist latest snapshot to Redis asynchronously
      const snapshot = this.processor.getSnapshot(update.symbol);
      if (snapshot) {
        this.priceRepository.saveLatestSnapshot(snapshot).catch((err) => {
          logger.warn({ err: err.message, symbol: update.symbol }, 'Failed to save snapshot');
        });
      }

      // 3. Persist observation to history sorted set
      const obs: PriceObservation = {
        timestamp: update.sourceTimestamp,
        buy: update.buy,
        sell: update.sell,
        midpoint: update.midpoint,
      };
      this.priceRepository.saveObservation(update.symbol, obs, this.appConfig.ROLLING_WINDOW_MS).catch((err) => {
        logger.warn({ err: err.message, symbol: update.symbol }, 'Failed to save observation');
      });
    });

    // Handle upstream client errors so EventEmitter never throws unhandled exception
    this.upstreamClient.on('error', (err) => {
      logger.warn({ err: err.message }, 'Upstream client network error encountered (safely handled)');
    });

    this.upstreamClient.on('auth_error', (err) => {
      logger.warn({ err: err.message }, 'Upstream client authentication error encountered (safely handled)');
    });
  }

  public async initialize(): Promise<void> {
    logger.info('Initializing application components...');

    // 1. Connect Redis
    await this.redisManager.connect();

    // 2. State Restoration from Redis
    const recoveryResult = await this.stateRecovery.restore();
    if (recoveryResult.isDegraded) {
      logger.warn({ errors: recoveryResult.errors }, 'State recovery completed with warnings/degradations');
    }
    this.healthService.markRecoveryCompleted();

    // 3. Setup Fastify plugins and routes
    await this.fastify.register(cors, { origin: true });
    await this.fastify.register(buildRoutes(this.healthService, this.processor, this.simulator));

    // 4. Attach Downstream WebSocket Server to Fastify HTTP server
    this.downstreamServer = new DownstreamWebSocketServer(
      this.subscriptionManager,
      this.publisher,
      this.processor,
      {
        server: this.fastify.server,
        rateLimitPerSec: this.appConfig.DOWNSTREAM_RATE_LIMIT_PER_SEC,
      }
    );
  }

  public async start(): Promise<void> {
    await this.fastify.listen({
      port: this.appConfig.PORT,
      host: this.appConfig.HOST,
    });

    logger.info(
      { port: this.appConfig.PORT, host: this.appConfig.HOST },
      'HTTP & Downstream WebSocket server listening'
    );

    // Connect to upstream feed
    this.upstreamClient.connect();
  }

  public async shutdown(): Promise<void> {
    logger.info('Initiating graceful shutdown...');

    // 0. Stop simulator if running
    this.simulator.stop();

    // 1. Disconnect upstream WebSocket
    this.upstreamClient.close();

    // 2. Close downstream WebSocket server
    if (this.downstreamServer) {
      await this.downstreamServer.close();
    }

    // 3. Close Fastify HTTP server
    await this.fastify.close();

    // 4. Disconnect Redis
    await this.redisManager.disconnect();

    logger.info('Graceful shutdown completed');
  }
}
