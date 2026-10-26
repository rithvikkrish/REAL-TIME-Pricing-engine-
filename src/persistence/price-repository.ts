import { RedisManager } from './redis-client';
import { PriceObservation, Symbol24hSnapshot } from '../types/market';
import { logger } from '../utils/logger';

export class PriceRepository {
  private readonly HASH_KEY_LATEST = 'pricing:latest_snapshots';
  private readonly KEY_HISTORY_PREFIX = 'pricing:history:';
  private readonly KEY_REF_PREFIX = 'pricing:reference:';

  constructor(private redisManager: RedisManager) {}

  /**
   * Persist the latest symbol snapshot atomically.
   */
  public async saveLatestSnapshot(snapshot: Symbol24hSnapshot): Promise<void> {
    const json = JSON.stringify(snapshot);
    await this.redisManager.execute(
      'saveLatestSnapshot',
      async (client) => {
        await client.hset(this.HASH_KEY_LATEST, snapshot.symbol, json);
      },
      (mem) => {
        let snapshots = mem.get(this.HASH_KEY_LATEST);
        if (!snapshots) {
          snapshots = new Map<string, string>();
          mem.set(this.HASH_KEY_LATEST, snapshots);
        }
        snapshots.set(snapshot.symbol, json);
      }
    );
  }

  /**
   * Persist observation into sorted set and prune observations older than 24h.
   */
  public async saveObservation(symbol: string, obs: PriceObservation, windowMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    const key = `${this.KEY_HISTORY_PREFIX}${symbol}`;
    const member = `${obs.timestamp}:${obs.buy}:${obs.sell}:${obs.midpoint}`;
    const cutoff = obs.timestamp - windowMs;

    await this.redisManager.execute(
      'saveObservation',
      async (client) => {
        const pipeline = client.pipeline();
        pipeline.zadd(key, obs.timestamp, member);
        pipeline.zremrangebyscore(key, '-inf', cutoff);
        // Set key expiration to 48 hours to prevent zombie keys
        pipeline.expire(key, 48 * 3600);
        await pipeline.exec();
      },
      (mem) => {
        let history = mem.get(key) as PriceObservation[] | undefined;
        if (!history) {
          history = [];
          mem.set(key, history);
        }
        history.push(obs);
        // prune in memory
        const pruned = history.filter((h) => h.timestamp >= cutoff);
        mem.set(key, pruned);
      }
    );
  }

  /**
   * Save reference observation needed for percentage change.
   */
  public async saveReferenceObservation(symbol: string, obs: PriceObservation): Promise<void> {
    const key = `${this.KEY_REF_PREFIX}${symbol}`;
    const json = JSON.stringify(obs);
    await this.redisManager.execute(
      'saveReferenceObservation',
      async (client) => {
        await client.set(key, json, 'EX', 48 * 3600);
      },
      (mem) => {
        mem.set(key, json);
      }
    );
  }

  /**
   * Fetch latest snapshot for a single symbol.
   */
  public async getLatestSnapshot(symbol: string): Promise<Symbol24hSnapshot | null> {
    return this.redisManager.execute(
      'getLatestSnapshot',
      async (client) => {
        const raw = await client.hget(this.HASH_KEY_LATEST, symbol);
        return raw ? JSON.parse(raw) : null;
      },
      (mem) => {
        const snapshots = mem.get(this.HASH_KEY_LATEST);
        if (!snapshots) return null;
        const raw = snapshots.get(symbol);
        return raw ? JSON.parse(raw) : null;
      }
    );
  }

  /**
   * Fetch all latest snapshots.
   */
  public async getAllLatestSnapshots(): Promise<Symbol24hSnapshot[]> {
    return this.redisManager.execute(
      'getAllLatestSnapshots',
      async (client) => {
        const hash = await client.hgetall(this.HASH_KEY_LATEST);
        return Object.values(hash).map((str) => JSON.parse(str));
      },
      (mem) => {
        const snapshots = mem.get(this.HASH_KEY_LATEST);
        if (!snapshots) return [];
        return Array.from(snapshots.values()).map((str: any) => JSON.parse(str));
      }
    );
  }

  /**
   * Fetch historical observations within a time range for state reconstruction.
   */
  public async getObservations(symbol: string, minTimestamp: number, maxTimestamp: number): Promise<PriceObservation[]> {
    const key = `${this.KEY_HISTORY_PREFIX}${symbol}`;
    return this.redisManager.execute(
      'getObservations',
      async (client) => {
        const members = await client.zrangebyscore(key, minTimestamp, maxTimestamp);
        return members.map((m) => {
          const parts = m.split(':');
          return {
            timestamp: Number(parts[0]),
            buy: Number(parts[1]),
            sell: Number(parts[2]),
            midpoint: Number(parts[3]),
          };
        });
      },
      (mem) => {
        const history = (mem.get(key) as PriceObservation[]) || [];
        return history.filter((h) => h.timestamp >= minTimestamp && h.timestamp <= maxTimestamp);
      }
    );
  }

  /**
   * Fetch reference observation.
   */
  public async getReferenceObservation(symbol: string): Promise<PriceObservation | null> {
    const key = `${this.KEY_REF_PREFIX}${symbol}`;
    return this.redisManager.execute(
      'getReferenceObservation',
      async (client) => {
        const raw = await client.get(key);
        return raw ? JSON.parse(raw) : null;
      },
      (mem) => {
        const raw = mem.get(key);
        return raw ? JSON.parse(raw) : null;
      }
    );
  }
}
