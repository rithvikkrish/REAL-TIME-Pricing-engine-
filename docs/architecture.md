# Real-Time Pricing Engine: Architecture & Data Flow

This document details the system architecture, internal processing pipeline, and data flow of the Real-Time Pricing Engine.

## 1. System Overview

The Real-Time Pricing Engine is an ultra-low-latency, fault-tolerant market data ingestion and distribution platform. It connects to an upstream WebSocket feed, authenticates, validates, deduplicates, orders events, maintains a continuous rolling 24-hour window per symbol, independently computes 24-hour highs, lows, and percentage changes, persists state to Redis, and broadcasts optimized real-time price updates to downstream WebSocket clients.

## 2. End-to-End Architecture Diagram

```mermaid
flowchart TD
    subgraph Upstream ["Upstream Market Data Provider"]
        U_WS["LiveFXHub Gateway<br/>(wss://v3-prod.livefxhub.com/ws/algo)"]
    end

    subgraph PricingEngine ["Real-Time Pricing Engine Core"]
        UC["Upstream Client<br/>(Auth, Subscriptions, Exponential Backoff)"]
        MP["Message Parser<br/>(Frame parsing, Byte measurement)"]
        TV["Tick Validator & Spike Filter<br/>(Zod schema, Spread check, 50% jump filter)"]
        ED["Event Deduplicator<br/>(Composite Key: sym:ts:buy:sell)"]
        OM["Order Manager<br/>(Out-of-order & Late-event policy)"]
        
        subgraph EngineCore ["24h Rolling Window & Statistics"]
            RW["Symbol Rolling Window<br/>(24h sliding window, reference point)"]
            MD["Monotonic Min-Max Deque<br/>(O(1) Rolling High & Low)"]
            SE["Statistics Engine<br/>(Midpoint, % Change, High/Low)"]
        end

        PP["Price Processor<br/>(Pipeline Coordinator & Latency Meter)"]
        
        subgraph PersistenceLayer ["Persistence & Recovery"]
            PR["Price Repository<br/>(Hashes, Sorted Sets)"]
            SR["State Recovery Service<br/>(Startup restoration)"]
            RM["Redis Manager<br/>(ioredis + In-Memory Fallback)"]
        end

        subgraph DownstreamLayer ["Downstream Distribution"]
            SM["Subscription Manager<br/>(O(1) Symbol to Clients Map)"]
            DP["Downstream Publisher<br/>(Backpressure, 10KB limit)"]
            DWS["Downstream WebSocket Server<br/>(Path: /ws, Deflate, Heartbeats)"]
            API["Fastify HTTP REST API<br/>(/health, /ready, /metrics, /api/prices)"]
        end
    end

    subgraph Storage ["Persistent State"]
        REDIS[("Redis 7.x Cluster/Single<br/>(Append-Only, MaxMemory LRU)")]
    end

    subgraph Clients ["Downstream Consumers"]
        C1["Frontend Web Client"]
        C2["Algorithmic Trading Bot"]
        C3["Monitoring / Prometheus"]
    end

    %% Flow Connections
    U_WS <-->|"Auth Handshake & Market Feed"| UC
    UC -->|"Raw Frames"| MP
    MP -->|"Raw Ticks"| TV
    TV -->|"Validated Ticks"| ED
    ED -->|"Unique Ticks"| OM
    OM -->|"Ordered Ticks"| PP
    
    PP <-->|"Sliding Window State"| RW
    RW <-->|"O(1) Extremes"| MD
    RW -->|"Window Extremes & Ref"| SE
    SE -->|"Computed 24h Stats"| PP

    PP -->|"Async Snapshot & History"| PR
    PR <-->|"Atomic Ops / Pipelines"| RM
    RM <-->|"TCP / RESP3"| REDIS
    SR -.->|"Startup State Restore"| PR

    PP -->|"Normalized Price Update"| DP
    DP -->|"Symbol Filtered Broadcast (<10KB)"| SM
    SM <-->|"Connections & Subscriptions"| DWS
    DWS <-->|"Sub / Unsub / Updates"| C1
    DWS <-->|"Sub / Unsub / Updates"| C2

    API <-->|"Prometheus Scrape"| C3
    API <-->|"Snapshots REST"| C1
```

## 3. Data Processing Pipeline Breakdown

1. **Ingestion & Protocol Handling**:
   - `UpstreamClient` initiates the TLS WebSocket connection with the upstream endpoint.
   - It performs an explicit handshake: `{ action: "auth", api_key: "...", secret: "..." }`.
   - Only upon genuine authentication acknowledgement does it transmit the subscription for all 61 symbols.
   - Exponential backoff with random jitter handles network disconnects and server restarts.

2. **Validation & Spike Filtering**:
   - Every frame passes through `MessageParser` and `TickValidator`.
   - Validates that symbols belong to the official 61-symbol catalog.
   - Rejects non-positive prices and crossed bid-ask spreads (`sell < buy`).
   - Rejects price spikes deviating by more than 50% in a single tick from the prior observation without verification.

3. **Deduplication & Out-of-Order Handling**:
   - `EventDeduplicator` computes a composite hash `${symbol}:${sourceTimestamp}:${buy}:${sell}` within an in-memory sliding ring buffer (capacity: 50,000 entries).
   - `OrderManager` checks timestamps:
     - In-order ticks immediately update the spot snapshot and advance the window.
     - Late-arriving ticks within the 60-second tolerance window are safely incorporated into the historical 24-hour observation array to preserve accurate statistical computation without rewinding the live spot price.

4. **Rolling 24-Hour Statistics Engine**:
   - Per assignment rules, incoming `low_24h`, `high_24h`, and `change_24h` fields are strictly ignored and computed independently.
   - Employs a **Monotonic Min-Max Deque**:
     - Amortized $O(1)$ updates and $O(1)$ queries for rolling 24-hour maximum and minimum prices.
   - Reference price policy:
     - The engine tracks the price closest to $T - 24\text{ hours}$.
     - When observations expire past 24 hours, the most recently expired observation is retained as the baseline reference point for percentage change.
     - If history is younger than 24 hours, the first observed tick serves as the baseline, starting percentage change smoothly at 0.00%.

5. **Persistence & Resilience**:
   - `PriceRepository` uses Redis Hashes for latest snapshots and Redis Sorted Sets (scored by timestamp) for historical observations.
   - State recovery runs automatically on startup, restoring 24-hour highs, lows, and reference prices so that process restarts do not reset metrics.
   - In-memory fallback enables zero-dependency testing and survival during temporary Redis outages.

6. **Downstream WebSocket Server**:
   - Supports multi-tenant symbol-based subscriptions.
   - Immediately pushes an initial snapshot upon subscription.
   - Employs client buffer backpressure controls to drop ticks for slow consumers and prevent memory leaks.
   - Outbound payload size is kept strictly under 10 KB (actual payload: ~232 bytes uncompressed, ~168 bytes compressed).
