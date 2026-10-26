import { UpstreamClient } from '../upstream/upstream-client';
import { RedisManager } from '../persistence/redis-client';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  uptimeSeconds: number;
  memoryUsageMb: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  timestamp: string;
}

export interface ReadinessStatus {
  status: 'ready' | 'degraded' | 'not_ready';
  components: {
    upstream: {
      status: string;
      ready: boolean;
    };
    persistence: {
      type: 'redis' | 'in_memory_fallback';
      ready: boolean;
    };
    stateRecovery: {
      completed: boolean;
    };
  };
  timestamp: string;
}

export class HealthService {
  private startTime: number = Date.now();
  private recoveryCompleted: boolean = false;

  constructor(
    private upstreamClient: UpstreamClient,
    private redisManager: RedisManager
  ) {}

  public markRecoveryCompleted(): void {
    this.recoveryCompleted = true;
  }

  public getHealth(): HealthStatus {
    const mem = process.memoryUsage();
    return {
      status: 'healthy',
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      memoryUsageMb: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      },
      timestamp: new Date().toISOString(),
    };
  }

  public getReadiness(): ReadinessStatus {
    const upstreamState = this.upstreamClient.getState();
    const persistenceReady = this.redisManager.isReady();
    const usingFallback = this.redisManager.isUsingFallback();

    const upstreamReady = upstreamState === 'AUTHENTICATED';

    let overallStatus: 'ready' | 'degraded' | 'not_ready' = 'ready';
    if (!upstreamReady || usingFallback) {
      overallStatus = 'degraded';
    }
    if (!persistenceReady) {
      overallStatus = 'not_ready';
    }

    return {
      status: overallStatus,
      components: {
        upstream: {
          status: upstreamState,
          ready: upstreamReady,
        },
        persistence: {
          type: usingFallback ? 'in_memory_fallback' : 'redis',
          ready: persistenceReady,
        },
        stateRecovery: {
          completed: this.recoveryCompleted,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}
