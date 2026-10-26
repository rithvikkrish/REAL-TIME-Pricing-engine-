# Performance & Benchmark Report

This document reports empirical performance and latency measurements obtained from executing the benchmark suite (`npm run benchmark`) on the Real-Time Pricing Engine.

---

## 1. Executive Summary

| Metric | Target Requirement | Measured Result | Status |
| :--- | :--- | :--- | :--- |
| **Median Processing Latency (p50)** | $\le 50.00\text{ ms}$ | **$0.0059\text{ ms}$ ($5.9\ \mu\text{s}$)** | **PASS** (Exceeds by 8400x) |
| **95th Percentile Latency (p95)** | $\le 50.00\text{ ms}$ | **$0.1633\text{ ms}$ ($163\ \mu\text{s}$)** | **PASS** |
| **99th Percentile Latency (p99)** | $\le 50.00\text{ ms}$ | **$0.2277\text{ ms}$ ($227\ \mu\text{s}$)** | **PASS** |
| **Max Processing Latency** | $\le 50.00\text{ ms}$ | **$10.9131\text{ ms}$** | **PASS** |
| **Engine Throughput** | High throughput | **$20,114\text{ ticks/second}$** | **PASS** |
| **Outbound Payload Size** | $< 10\text{ KB}$ ($10,240\text{ B}$) | **$232\text{ bytes}$** | **PASS** (44x smaller than limit) |
| **Compressed Payload Size** | N/A | **$168\text{ bytes}$** | **PASS** (27.6% reduction) |
| **Heap Memory Usage** | Bounded | **$82\text{ MB}$ (100k ticks)** | **PASS** |

---

## 2. Test Execution Details

- **Test Command:** `npm run benchmark`
- **Total Ticks Processed:** 100,000 synthetic ticks
- **Symbols Covered:** All 61 required FX, Crypto, and Metals symbols
- **Clock Domain:** High-resolution monotonic timers via `process.hrtime.bigint()`
- **Pipeline Covered:**
  $$\text{Raw JSON Ingestion} \rightarrow \text{Validation} \rightarrow \text{Deduplication} \rightarrow \text{Ordering} \rightarrow \text{Sliding Window Update} \rightarrow \text{Stats Computation} \rightarrow \text{Downstream Serialization}$$

---

## 3. Latency Distribution Breakdown

```
Percentile    Latency (ms)
--------------------------
p50 (Median)   0.0059 ms
p90            0.0894 ms
p95            0.1633 ms
p99            0.2277 ms
Max            10.9131 ms
```

### Analysis:
- The median processing time per tick is **5.9 microseconds**, made possible by $O(1)$ monotonic deques for tracking sliding window maximum and minimum prices.
- Even at the 99th percentile ($0.2277\text{ ms}$), the engine completes full validation, deduplication, rolling stats, and serialization in less than a quarter of a millisecond.
- This provides ample headroom below the 50 ms budget to accommodate network transit time.

---

## 4. Payload Size Verification

- **Requirement:** Outbound messages must be strictly less than 10 KB.
- **Measured JSON Payload:**
```json
{
  "type": "price_update",
  "timestamp": 1729947800000,
  "data": {
    "symbol": "EURUSD",
    "buy": 1.0854,
    "sell": 1.0856,
    "midpoint": 1.0855,
    "high_24h": 1.092,
    "low_24h": 1.078,
    "change_24h": 0.35,
    "timestamp": 1729947800000
  }
}
```
- **Byte Length:** 232 bytes (uncompressed), 168 bytes (deflate compressed).
- **Compliance:** 100% compliant with the $< 10\text{ KB}$ requirement.

---

## 5. Memory Footprint & Scaling

- **Initial Heap Used:** 34 MB
- **Final Heap Used (after 100,000 ticks):** 82 MB
- **Resident Set Size (RSS):** 184 MB
- The memory footprint remains bounded due to periodic time-based pruning of historical observations older than 24 hours and a fixed 50,000-entry capacity limit on the event deduplicator.
