export interface RawMarketTick {
  symbol: string;
  buy: number | string;
  sell: number | string;
  low_24h?: number | string;
  high_24h?: number | string;
  change_24h?: number | string;
  timestamp: number | string;
}

export interface PriceObservation {
  timestamp: number;
  buy: number;
  sell: number;
  midpoint: number;
}

export interface NormalizedPriceUpdate {
  symbol: string;
  buy: number;
  sell: number;
  midpoint: number;
  sourceTimestamp: number;
  receiveTimestamp: number;
  high24h: number;
  low24h: number;
  change24h: number;
  latencyMs: number;
}

export interface Symbol24hSnapshot {
  symbol: string;
  buy: number;
  sell: number;
  midpoint: number;
  high24h: number;
  low24h: number;
  change24h: number;
  sourceTimestamp: number;
  receiveTimestamp: number;
  observationCount: number;
}
