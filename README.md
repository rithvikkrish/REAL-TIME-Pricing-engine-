# Real-Time Pricing Engine

A production-ready, low-latency, fault-tolerant market data processing engine built with Node.js, TypeScript, Fastify, WebSocket (`ws`), Redis, and Prometheus.

---

## Features

- **Upstream Connection & Authentication:** Connects to `wss://v3-prod.livefxhub.com/ws/algo`, completes the required JSON authentication handshake, and subscribes to all 61 required currency, crypto, and commodity pairs.
- **Independent 24h Statistics Engine:** Strictly ignores incoming `high_24h`, `low_24h`, and `change_24h` fields, computing them independently from eligible price history.
- **$O(1)$ Rolling Window Calculations:** Uses monotonic double-ended queues (`MonotonicMinMaxDeque`) to calculate 24-hour highs and lows in sub-millisecond time ($5.9\ \mu\text{s}$ median latency) rather than rescanning all history.
- **Reference Price Policy:** Retains the exact observation immediately preceding the 24-hour boundary to compute percentage change relative to 24 hours ago.
- **Robust Fault Tolerance:**
  - Automatic reconnection with exponential backoff and jitter.
  - Event deduplication using a 50,000-entry composite key ring buffer.
  - Out-of-order event management with historical incorporation.
  - Price spike rejection filter (> 50% single-tick moves).
- **Persistent State & Recovery:** Stores latest snapshots (Redis Hashes) and 24-hour rolling observations (Redis Sorted Sets). Restores state on startup so process restarts do not reset 24-hour statistics. Includes transparent in-memory fallback if Redis is unavailable.
- **Downstream WebSocket Server:** Independent multi-client WebSocket server supporting symbol-specific subscriptions, immediate snapshot delivery, backpressure handling, heartbeat ping/pong, and rate limiting.
- **Payload Optimization:** Emits compact JSON updates (~232 bytes, well below the 10 KB requirement) with optional per-message deflation (~168 bytes).
- **Observability & Health Checks:** Prometheus-compatible `/metrics`, liveness `/health`, readiness `/ready`, and OpenAPI 3.0 specification.
- **Fully Dockerized:** Includes multi-stage `Dockerfile` and `docker-compose.yml` with Redis and healthchecks.

---

## Project Structure

```
├── Dockerfile                   # Multi-stage production container
├── docker-compose.yml           # Multi-container setup (Engine + Redis)
├── package.json                 # Dependencies and execution scripts
├── tsconfig.json                # TypeScript compiler configuration
├── .env.example                 # Template for environment configuration
├── docs/
│   ├── architecture.md          # Architecture and Mermaid data-flow diagram
│   ├── design-decisions.md      # Engineering decisions and trade-offs
│   ├── challenges.md            # Challenges faced and resolutions
│   └── performance.md           # Benchmark results and latency analysis
├── src/
│   ├── api/
│   │   ├── health.ts            # Liveness and readiness probe service
│   │   ├── openapi.ts           # OpenAPI 3.0 document definition
│   │   └── routes.ts            # Fastify REST endpoints
│   ├── config/
│   │   ├── index.ts             # Zod environment variable validation
│   │   └── symbols.ts           # 61 supported symbols & validators
│   ├── downstream/
│   │   ├── publisher.ts         # Outbound broadcast (< 10 KB enforcement)
│   │   ├── subscription-manager.ts # O(1) symbol-client mappings
│   │   └── websocket-server.ts  # Client WebSocket server (/ws)
│   ├── engine/
│   │   ├── price-processor.ts   # Core pipeline coordinator
│   │   ├── rolling-window.ts    # Rolling 24h sliding window per symbol
│   │   └── statistics.ts        # Pure 24h high/low/%change computation
│   ├── ingestion/
│   │   ├── deduplicator.ts      # Composite key duplicate event detector
│   │   ├── ordering.ts          # Out-of-order & late event policy
│   │   ├── parser.ts            # WebSocket frame parser & byte meter
│   │   └── validator.ts         # Zod schema validation & spike filter
│   ├── metrics/
│   │   └── prometheus.ts        # Prometheus metrics registry
│   ├── persistence/
│   │   ├── price-repository.ts  # Redis Hashes & Sorted Sets storage
│   │   ├── redis-client.ts      # ioredis client with in-memory fallback
│   │   └── state-recovery.ts    # Startup state reconstruction
│   ├── scripts/
│   │   ├── benchmark.ts         # High-resolution 100k-tick performance test
│   │   └── smoke-test.ts        # Live upstream feed diagnostic probe
│   ├── types/
│   │   ├── market.ts            # Domain tick and snapshot interfaces
│   │   └── protocol.ts          # Downstream client message contracts
│   ├── utils/
│   │   ├── deque.ts             # O(1) monotonic min-max double-ended queue
│   │   ├── logger.ts            # Pino logger with credential redaction
│   │   └── math.ts              # Financial rounding and midpoint math
│   ├── app.ts                   # Application lifecycle wireup
│   └── server.ts                # Process entry point with signal traps
└── tests/
    ├── unit/
    │   ├── deque.test.ts
    │   ├── deduplicator-ordering.test.ts
    │   ├── rolling-window.test.ts
    │   ├── statistics.test.ts
    │   └── validator.test.ts
    └── integration/
        ├── downstream-server.test.ts
        ├── persistence-recovery.test.ts
        └── upstream-auth-flow.test.ts
```

---

## Quickstart

### 1. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your upstream credentials in `.env`:
```ini
UPSTREAM_WS_URL=wss://v3-prod.livefxhub.com/ws/algo
UPSTREAM_API_KEY=your_api_key_here
UPSTREAM_SECRET_KEY=your_secret_key_here
PORT=3000
HOST=0.0.0.0
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Automated Tests

Execute the Vitest automated test suite:

```bash
npm test
```

### 4. Run the Performance Benchmark

Run the high-resolution 100,000-tick performance test:

```bash
npm run benchmark
```

### 5. Run the Live Upstream Smoke Test

Test connectivity and authentication against the live upstream gateway:

```bash
npm run smoke
```

### 6. Start the Engine Locally

Compile and run the server:

```bash
npm run build
npm start
```

Or for development mode with hot reloading:
```bash
npm run dev
```

---

## Docker Deployment

To launch the complete environment (Pricing Engine + Redis):

```bash
docker compose up --build
```

To stop the services:
```bash
docker compose down
```

---

## Downstream WebSocket API Reference

- **WebSocket Endpoint:** `ws://localhost:3000/ws`

### Subscribe to Symbols
```json
{
  "action": "subscribe",
  "symbols": ["EURUSD", "BTCUSD"]
}
```

**Acknowledgement:**
```json
{
  "type": "subscribed",
  "symbols": ["EURUSD", "BTCUSD"],
  "timestamp": 1729947800000
}
```

**Initial Snapshot (immediately delivered):**
```json
{
  "type": "snapshot",
  "timestamp": 1729947800000,
  "data": [
    {
      "symbol": "EURUSD",
      "buy": 1.0854,
      "sell": 1.0856,
      "midpoint": 1.0855,
      "high24h": 1.092,
      "low24h": 1.078,
      "change24h": 0.35,
      "sourceTimestamp": 1729947800000,
      "receiveTimestamp": 1729947800010,
      "observationCount": 1420
    }
  ]
}
```

### Real-Time Price Update Broadcast
```json
{
  "type": "price_update",
  "timestamp": 1729947801000,
  "data": {
    "symbol": "EURUSD",
    "buy": 1.0855,
    "sell": 1.0857,
    "midpoint": 1.0856,
    "high_24h": 1.092,
    "low_24h": 1.078,
    "change_24h": 0.36,
    "timestamp": 1729947801000
  }
}
```

### Unsubscribe
```json
{
  "action": "unsubscribe",
  "symbols": ["EURUSD"]
}
```

---

## HTTP REST Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/health` | GET | Liveness probe returning process uptime and memory usage. |
| `/ready` | GET | Readiness probe returning upstream status, persistence status, and recovery state. |
| `/metrics` | GET | Prometheus scrape endpoint with application metrics. |
| `/api/prices` | GET | Snapshot of all active symbols with latest prices and 24h metrics. |
| `/api/prices/:symbol` | GET | Snapshot for a specific symbol (e.g. `/api/prices/EURUSD`). |
| `/api/openapi.json` | GET | Full OpenAPI 3.0 specification for all HTTP routes. |

---

## Prometheus Metrics

The engine exposes standard and custom metrics on `/metrics`:

- `pricing_engine_upstream_connection_status`: Gauge (0=disconnected, 1=connected, 2=authenticated)
- `pricing_engine_upstream_auth_total`: Counter by status (`success` / `failure`)
- `pricing_engine_upstream_reconnections_total`: Total reconnection attempts
- `pricing_engine_incoming_ticks_total`: Counter labeled by symbol and status (`accepted`, `rejected`, `duplicate`, `out_of_order`, `spike`)
- `pricing_engine_processing_latency_seconds`: High-resolution histogram of processing latency
- `pricing_engine_payload_size_bytes`: Histogram of upstream and downstream payload sizes
- `pricing_engine_active_downstream_clients`: Gauge of connected downstream WebSockets
- `pricing_engine_active_downstream_subscriptions`: Total active symbol subscriptions
- `pricing_engine_redis_operations_total`: Total Redis operations by status

---

## Upstream Live Feed Diagnosis

During live testing of `wss://v3-prod.livefxhub.com/ws/algo`:
1. The WebSocket connection succeeds.
2. The authentication payload `{ "action": "auth", "api_key": "...", "secret": "..." }` is sent to the server.
3. The provider gateway parses the request and returns `{"event":"error","message":"invalid credentials"}` and closes with code `4003`.
4. Run `npm run smoke` to inspect the live response from the vendor gateway.
5. Automated tests run against `MockUpstreamServer` which emulates the exact vendor protocol, allowing the entire pipeline (auth, subscription, data feed, deduplication, ordering, rolling window, downstream broadcast, and Redis recovery) to be verified deterministically.
