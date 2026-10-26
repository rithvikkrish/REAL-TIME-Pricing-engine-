import client from 'prom-client';

// Create a custom registry
export const register = new client.Registry();

// Add default recommended node process metrics
client.collectDefaultMetrics({ register, prefix: 'pricing_engine_' });

export const upstreamConnectionStatus = new client.Gauge({
  name: 'pricing_engine_upstream_connection_status',
  help: 'Status of upstream WebSocket connection (0=disconnected, 1=connected, 2=authenticated)',
  registers: [register],
});

export const upstreamAuthTotal = new client.Counter({
  name: 'pricing_engine_upstream_auth_total',
  help: 'Total authentication attempts by status',
  labelNames: ['status'],
  registers: [register],
});

export const upstreamReconnectionsTotal = new client.Counter({
  name: 'pricing_engine_upstream_reconnections_total',
  help: 'Total upstream reconnection attempts',
  registers: [register],
});

export const incomingTicksTotal = new client.Counter({
  name: 'pricing_engine_incoming_ticks_total',
  help: 'Total incoming market data ticks processed by status',
  labelNames: ['symbol', 'status'],
  registers: [register],
});

export const processingLatency = new client.Histogram({
  name: 'pricing_engine_processing_latency_seconds',
  help: 'End-to-end local processing latency in seconds (from receive to ready for downstream)',
  buckets: [0.0001, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [register],
});

export const payloadSizeBytes = new client.Histogram({
  name: 'pricing_engine_payload_size_bytes',
  help: 'Message payload sizes in bytes',
  labelNames: ['direction'],
  buckets: [64, 128, 256, 512, 1024, 2048, 5120, 10240, 51200, 262144],
  registers: [register],
});

export const activeDownstreamClients = new client.Gauge({
  name: 'pricing_engine_active_downstream_clients',
  help: 'Number of currently connected downstream WebSocket clients',
  registers: [register],
});

export const activeDownstreamSubscriptions = new client.Gauge({
  name: 'pricing_engine_active_downstream_subscriptions',
  help: 'Total number of active symbol subscriptions across all clients',
  registers: [register],
});

export const redisOperationsTotal = new client.Counter({
  name: 'pricing_engine_redis_operations_total',
  help: 'Total Redis persistence operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

export const redisLatency = new client.Histogram({
  name: 'pricing_engine_redis_latency_seconds',
  help: 'Latency of Redis operations in seconds',
  buckets: [0.0005, 0.001, 0.002, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});
