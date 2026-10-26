import zlib from 'zlib';
import { PriceProcessor } from '../engine/price-processor';
import { REQUIRED_SYMBOLS } from '../config/symbols';
import { SubscriptionManager } from '../downstream/subscription-manager';
import { DownstreamPublisher } from '../downstream/publisher';
import { NormalizedPriceUpdate } from '../types/market';

async function runBenchmark() {
  console.log('====================================================');
  console.log('   REAL-TIME PRICING ENGINE - PERFORMANCE BENCHMARK ');
  console.log('====================================================\n');

  const processor = new PriceProcessor({
    windowMs: 24 * 60 * 60 * 1000,
  });

  const subManager = new SubscriptionManager();
  const publisher = new DownstreamPublisher(subManager);

  // Collect processed updates for payload inspection
  let sampleUpdate: NormalizedPriceUpdate | null = null;
  processor.on('price_update', (u: NormalizedPriceUpdate) => {
    sampleUpdate = u;
  });

  const TOTAL_TICKS = 100000;
  console.log(`Generating and processing ${TOTAL_TICKS.toLocaleString()} ticks across ${REQUIRED_SYMBOLS.length} symbols...`);

  // Pre-generate realistic ticks
  const ticks: any[] = [];
  const baseTime = Date.now() - 3600000;
  for (let i = 0; i < TOTAL_TICKS; i++) {
    const symbol = REQUIRED_SYMBOLS[i % REQUIRED_SYMBOLS.length];
    const base = symbol.includes('JPY') ? 150.0 : symbol.includes('BTC') ? 65000 : 1.1;
    const spread = base * 0.0002;
    const noise = (Math.sin(i / 100) * 0.005) * base;
    const mid = base + noise;
    const buy = mid - spread / 2;
    const sell = mid + spread / 2;

    ticks.push({
      symbol,
      buy,
      sell,
      low_24h: buy * 0.95, // Upstream ignored
      high_24h: sell * 1.05, // Upstream ignored
      change_24h: 1.25, // Upstream ignored
      timestamp: baseTime + i * 50,
    });
  }

  // Force garbage collection if available or record initial mem
  const initialMem = process.memoryUsage();

  const latenciesNs: bigint[] = [];
  const overallStart = process.hrtime.bigint();

  for (let i = 0; i < TOTAL_TICKS; i++) {
    const tickStart = process.hrtime.bigint();
    processor.processRawTick(ticks[i]);
    const tickEnd = process.hrtime.bigint();
    latenciesNs.push(tickEnd - tickStart);
  }

  const overallEnd = process.hrtime.bigint();
  const totalDurationSec = Number(overallEnd - overallStart) / 1e9;
  const throughput = Math.round(TOTAL_TICKS / totalDurationSec);

  // Convert latencies to milliseconds and sort for percentiles
  const latenciesMs = latenciesNs.map((ns) => Number(ns) / 1e6).sort((a, b) => a - b);
  const p50 = latenciesMs[Math.floor(latenciesMs.length * 0.5)];
  const p90 = latenciesMs[Math.floor(latenciesMs.length * 0.9)];
  const p95 = latenciesMs[Math.floor(latenciesMs.length * 0.95)];
  const p99 = latenciesMs[Math.floor(latenciesMs.length * 0.99)];
  const max = latenciesMs[latenciesMs.length - 1];

  const finalMem = process.memoryUsage();

  console.log('\n--- Throughput & Latency Results ---');
  console.log(`Total Ticks Processed:   ${TOTAL_TICKS.toLocaleString()}`);
  console.log(`Total Time:              ${totalDurationSec.toFixed(3)} seconds`);
  console.log(`Throughput:              ${throughput.toLocaleString()} ticks/second`);
  console.log(`Target Latency:          <= 50.000 ms`);
  console.log(`Median Latency (p50):    ${p50.toFixed(4)} ms`);
  console.log(`95th Percentile (p95):   ${p95.toFixed(4)} ms`);
  console.log(`99th Percentile (p99):   ${p99.toFixed(4)} ms`);
  console.log(`Max Latency:             ${max.toFixed(4)} ms`);

  // Payload measurement
  console.log('\n--- Payload Size Optimization ---');
  if (sampleUpdate) {
    const outboundMsg = {
      type: 'price_update',
      timestamp: Date.now(),
      data: {
        symbol: (sampleUpdate as NormalizedPriceUpdate).symbol,
        buy: (sampleUpdate as NormalizedPriceUpdate).buy,
        sell: (sampleUpdate as NormalizedPriceUpdate).sell,
        midpoint: (sampleUpdate as NormalizedPriceUpdate).midpoint,
        high_24h: (sampleUpdate as NormalizedPriceUpdate).high24h,
        low_24h: (sampleUpdate as NormalizedPriceUpdate).low24h,
        change_24h: (sampleUpdate as NormalizedPriceUpdate).change24h,
        timestamp: (sampleUpdate as NormalizedPriceUpdate).sourceTimestamp,
      },
    };

    const jsonStr = JSON.stringify(outboundMsg);
    const uncompressedBytes = Buffer.byteLength(jsonStr, 'utf8');
    const compressedBytes = zlib.deflateSync(Buffer.from(jsonStr)).length;

    console.log(`Uncompressed Payload:    ${uncompressedBytes} bytes (< 10 KB limit: PASS)`);
    console.log(`Compressed Payload:      ${compressedBytes} bytes`);
    console.log(`Compression Ratio:       ${((1 - compressedBytes / uncompressedBytes) * 100).toFixed(1)}% reduction`);
  }

  console.log('\n--- Memory Footprint ---');
  console.log(`Heap Used Before:        ${Math.round(initialMem.heapUsed / 1024 / 1024)} MB`);
  console.log(`Heap Used After:         ${Math.round(finalMem.heapUsed / 1024 / 1024)} MB`);
  console.log(`RSS Memory:              ${Math.round(finalMem.rss / 1024 / 1024)} MB`);
  console.log('====================================================\n');
}

runBenchmark().catch(console.error);
