import WebSocket from 'ws';

const wsUrl = 'ws://localhost:3000/ws';
const symbols = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'];

console.clear();
console.log('Connecting to Real-Time Pricing Engine at', wsUrl, '...\n');

const ws = new WebSocket(wsUrl);
const symbolData = new Map<string, any>();
let totalUpdates = 0;

ws.on('open', () => {
  console.log('✓ Connected! Subscribing to market symbols:', symbols.join(', '));
  ws.send(JSON.stringify({
    action: 'subscribe',
    symbols,
  }));

  // Trigger feed start via REST API if not already started
  fetch('http://localhost:3000/api/simulate/start', { method: 'POST' }).catch(() => {});
});

ws.on('message', (raw) => {
  try {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'snapshot' && Array.isArray(msg.data)) {
      for (const item of msg.data) {
        symbolData.set(item.symbol, item);
      }
      renderTable();
    } else if (msg.type === 'price_update' && msg.data) {
      totalUpdates++;
      symbolData.set(msg.data.symbol, msg.data);
      renderTable();
    }
  } catch {}
});

function renderTable() {
  console.clear();
  console.log('========================================================================================');
  console.log('                      ⚡ REAL-TIME PRICING ENGINE LIVE STREAM ⚡                        ');
  console.log('========================================================================================');
  console.log(`Live Ticks Streamed: ${totalUpdates.toLocaleString()} | Active Symbols: ${symbolData.size} | Monotonic Target Latency: <= 50ms\n`);

  console.log(
    'SYMBOL'.padEnd(10) +
    'BID (BUY)'.padEnd(14) +
    'ASK (SELL)'.padEnd(14) +
    'MIDPOINT'.padEnd(14) +
    '24H HIGH'.padEnd(14) +
    '24H LOW'.padEnd(14) +
    '24H CHANGE'.padEnd(12)
  );
  console.log('----------------------------------------------------------------------------------------');

  for (const sym of symbols) {
    const d = symbolData.get(sym);
    if (!d) continue;

    const decimals = sym.includes('JPY') ? 3 : sym.includes('BTC') ? 2 : 5;
    const buy = Number(d.buy).toFixed(decimals).padEnd(14);
    const sell = Number(d.sell).toFixed(decimals).padEnd(14);
    const mid = Number(d.midpoint).toFixed(decimals).padEnd(14);
    const high = (d.high_24h || d.high24h || '-').toString().padEnd(14);
    const low = (d.low_24h || d.low24h || '-').toString().padEnd(14);
    const chg = Number(d.change_24h !== undefined ? d.change_24h : (d.change24h || 0));
    const chgStr = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';

    console.log(
      sym.padEnd(10) +
      buy +
      sell +
      mid +
      high +
      low +
      chgStr
    );
  }
  console.log('========================================================================================');
  console.log('Press Ctrl+C to stop stream.');
}
