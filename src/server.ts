import { config } from './config';
import { Application } from './app';
import { logger } from './utils/logger';

async function bootstrap() {
  const app = new Application(config);

  const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  let isShuttingDown = false;

  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, 'Received termination signal. Shutting down gracefully...');

    try {
      await app.shutdown();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  for (const signal of shutdownSignals) {
    process.on(signal, () => handleShutdown(signal));
  }

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled Promise Rejection');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught Exception encountered');
    process.exit(1);
  });

  try {
    await app.initialize();
    await app.start();
  } catch (err) {
    logger.fatal({ err }, 'Failed to start Real-Time Pricing Engine');
    process.exit(1);
  }
}

bootstrap();
