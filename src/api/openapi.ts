export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Real-Time Pricing Engine API',
    description: 'High-performance, low-latency market data processing and distribution engine',
    version: '1.0.0',
    contact: {
      name: 'Engineering Assessment Team',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current Environment',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Liveness probe',
        description: 'Returns process health, uptime, and memory statistics',
        responses: {
          '200': {
            description: 'Process is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    uptimeSeconds: { type: 'number', example: 120 },
                    memoryUsageMb: {
                      type: 'object',
                      properties: {
                        rss: { type: 'number' },
                        heapTotal: { type: 'number' },
                        heapUsed: { type: 'number' },
                      },
                    },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/ready': {
      get: {
        summary: 'Readiness probe',
        description: 'Returns readiness status of upstream connection, persistence, and state recovery',
        responses: {
          '200': {
            description: 'Component readiness details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ready', 'degraded', 'not_ready'] },
                    components: {
                      type: 'object',
                      properties: {
                        upstream: {
                          type: 'object',
                          properties: {
                            status: { type: 'string' },
                            ready: { type: 'boolean' },
                          },
                        },
                        persistence: {
                          type: 'object',
                          properties: {
                            type: { type: 'string' },
                            ready: { type: 'boolean' },
                          },
                        },
                        stateRecovery: {
                          type: 'object',
                          properties: {
                            completed: { type: 'boolean' },
                          },
                        },
                      },
                    },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/metrics': {
      get: {
        summary: 'Prometheus metrics',
        description: 'Exposes Prometheus scrape metrics',
        responses: {
          '200': {
            description: 'Text representation of Prometheus metrics',
            content: {
              'text/plain': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/api/prices': {
      get: {
        summary: 'List all latest prices and 24h metrics',
        description: 'Returns latest buy, sell, midpoint, 24h high, 24h low, and 24h percentage change for all active symbols',
        responses: {
          '200': {
            description: 'List of symbol snapshots',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/SymbolSnapshot',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/prices/{symbol}': {
      get: {
        summary: 'Get single symbol latest price and 24h metrics',
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            description: 'Market symbol (e.g. EURUSD, BTCUSD)',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Symbol snapshot',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SymbolSnapshot',
                },
              },
            },
          },
          '404': {
            description: 'Symbol not found or no market data received yet',
          },
        },
      },
    },
  },
  components: {
    schemas: {
      SymbolSnapshot: {
        type: 'object',
        properties: {
          symbol: { type: 'string', example: 'EURUSD' },
          buy: { type: 'number', example: 1.0845 },
          sell: { type: 'number', example: 1.0847 },
          midpoint: { type: 'number', example: 1.0846 },
          high24h: { type: 'number', example: 1.091 },
          low24h: { type: 'number', example: 1.079 },
          change24h: { type: 'number', example: 0.15 },
          sourceTimestamp: { type: 'integer', example: 1729000000000 },
          receiveTimestamp: { type: 'integer', example: 1729000000010 },
          observationCount: { type: 'integer', example: 1420 },
        },
      },
    },
  },
};
