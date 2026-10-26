# Engineering Challenges & Solutions

This document details specific engineering challenges encountered during development and how they were solved.

---

## Challenge 1: Live Upstream Server Authentication Behavior

### Problem:
The upstream WebSocket endpoint `wss://v3-prod.livefxhub.com/ws/algo` is live and reachable, but the credentials provided in the assessment prompt were rejected by the server:
```json
{"event":"error","message":"invalid credentials"}
[UPSTREAM CLOSED] Code: 4003, Reason: invalid credentials
```
Furthermore, omitted fields triggered code `4000 - Missing api_key or secret`.

### Solution:
1. **Verified Field Structure:** Confirmed that the server expects exact keys: `api_key` and `secret`.
2. **Strict Protocol Compliance:** Built `UpstreamClient` to wait for real authentication responses before subscribing.
3. **Fail-Safe Recovery:** Implemented bounded exponential backoff with jitter on 4003 errors rather than tight-loop spamming the upstream server.
4. **Mock Upstream Server for Deterministic Testing:** Built `MockUpstreamServer` matching the exact authentication and subscription protocol to allow automated testing and continuous verification without relying on external provider availability.
5. **Standalone Diagnostic Smoke Test:** Provided `npm run smoke` to run live diagnostics against the real vendor gateway and report real responses.

---

## Challenge 2: $O(1)$ Sliding Window Calculation Under High Tick Volume

### Problem:
A 24-hour window across 61 symbols with thousands of ticks per second makes rescanning arrays on every tick infeasible. A naive `Math.max(...observations)` incurs $O(N)$ operations per tick, causing high CPU usage and latency exceeding 50 ms.

### Solution:
Designed and implemented `MonotonicMinMaxDeque`:
- Maintains two double-ended queues: one strictly decreasing for maximum (high) and one strictly increasing for minimum (low).
- Eviction of expired timestamps from the front occurs in $O(1)$.
- Pushing new prices pops elements violating monotonic order from the back in amortized $O(1)$ time.
- Queries for current 24-hour high and low are strictly $O(1)$.
- Result: **0.0059 ms (5.9 microseconds)** median processing latency across 100,000 ticks.

---

## Challenge 3: Preservation of 24h Baseline During Rolling Window Pruning

### Problem:
Calculating 24-hour percentage change requires a reference price from ~24 hours ago. If the engine discards observations older than 24 hours without tracking the boundary point, the reference price is lost, leading to inaccurate percentage change calculations.

### Solution:
In `SymbolRollingWindow.pruneExpired(cutoffTimestamp)`:
- Before slicing expired items from the observation array, the engine captures the **most recently expired observation** (the one immediately preceding the 24-hour cutoff) and stores it as `referenceObservation`.
- This guarantees a stable, accurate baseline for the percentage change formula:
  $$\text{change} = \frac{\text{currentMidpoint} - \text{referenceMidpoint}}{\text{referenceMidpoint}} \times 100$$
- If the system has been running for less than 24 hours, the first ever observation serves as the initial reference point (yielding 0.00% initially).

---

## Challenge 4: Client Backpressure and Slow Consumers

### Problem:
In a WebSocket server with multiple connected downstream clients, a slow or stalling client network connection causes the server's outgoing socket buffer to grow indefinitely, leading to memory bloat and potential process crashes.

### Solution:
In `DownstreamPublisher.broadcastUpdate()`:
- Inspected `client.bufferedAmount`.
- If `client.bufferedAmount` exceeds `1 MB` (`MAX_CLIENT_BUFFERED_AMOUNT`), the publisher logs a warning and drops real-time ticks for that client.
- When the client's network clears and the buffer drains, normal tick transmission resumes automatically.
- Combined with a 30-second ping-pong heartbeat, unresponsive clients are terminated and removed from `SubscriptionManager`.
