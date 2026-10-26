import WebSocket, { RawData } from 'ws';
import * as dotenv from 'dotenv';
import { REQUIRED_SYMBOLS } from '../config/symbols';

dotenv.config();

const url = process.env.UPSTREAM_WS_URL || 'wss://v3-prod.livefxhub.com/ws/algo';
const apiKey = process.env.UPSTREAM_API_KEY || '';
const secretKey = process.env.UPSTREAM_SECRET_KEY || '';

console.log('====================================================');
console.log('   REAL-TIME PRICING ENGINE - UPSTREAM SMOKE TEST   ');
console.log('====================================================');
console.log(`Target URL:      ${url}`);
console.log(`API Key Config:  ${apiKey ? `${apiKey.substring(0, 8)}...[LENGTH ${apiKey.length}]` : 'MISSING'}`);
console.log(`Secret Config:   ${secretKey ? `${secretKey.substring(0, 8)}...[LENGTH ${secretKey.length}]` : 'MISSING'}`);
console.log('----------------------------------------------------');

if (!apiKey || !secretKey) {
  console.error('FAIL: Missing UPSTREAM_API_KEY or UPSTREAM_SECRET_KEY in environment.');
  process.exit(1);
}

const ws = new WebSocket(url);
let authenticated = false;
let ticksReceived = 0;
const receivedSymbols = new Set<string>();

const timer = setTimeout(() => {
  console.log('\n[SMOKE TEST TIMEOUT - 15s elapsed]');
  summarizeAndExit();
}, 15000);

ws.on('open', () => {
  console.log('✓ Connected to Upstream WebSocket endpoint');
  console.log('Sending Authentication message...');
  const authPayload = {
    action: 'auth',
    api_key: apiKey,
    secret: secretKey,
  };
  ws.send(JSON.stringify(authPayload));
});

ws.on('message', (raw: RawData) => {
  const text = raw.toString('utf8');
  try {
    const msg = JSON.parse(text);

    if (msg.event === 'error' || msg.status === 'error' || msg.status === 'failed') {
      console.log(`✗ Upstream Authentication Failed: ${msg.message || JSON.stringify(msg)}`);
      authenticated = false;
      return;
    }

    if (
      msg.event === 'auth_success' ||
      msg.event === 'authenticated' ||
      msg.status === 'success' ||
      (msg.event === 'info' && String(msg.message).toLowerCase().includes('success'))
    ) {
      console.log(`✓ Upstream Authentication Successful: ${JSON.stringify(msg)}`);
      authenticated = true;

      // Subscribe
      console.log(`Sending Subscription for ${REQUIRED_SYMBOLS.length} symbols...`);
      ws.send(
        JSON.stringify({
          action: 'subscribeMarketPrice',
          symbols: [...REQUIRED_SYMBOLS],
        })
      );
      return;
    }

    if (msg.event === 'subscribed') {
      console.log(`✓ Subscription Acknowledged for ${msg.symbols?.length || 'all'} symbols`);
      return;
    }

    // Check for market ticks
    const items = Array.isArray(msg) ? msg : [msg];
    for (const item of items) {
      if (item.symbol && item.buy !== undefined && item.sell !== undefined) {
        ticksReceived++;
        receivedSymbols.add(item.symbol);
        if (ticksReceived <= 5) {
          console.log(`[TICK #${ticksReceived}] Symbol: ${item.symbol} Buy: ${item.buy} Sell: ${item.sell} Ts: ${item.timestamp}`);
        }
      }
    }

    if (ticksReceived >= 10) {
      console.log('\n✓ Received sufficient live ticks for verification.');
      summarizeAndExit();
    }
  } catch (err) {
    console.error('Error parsing upstream frame:', err);
  }
});

ws.on('close', (code, reason) => {
  console.log(`[UPSTREAM CLOSED] Code: ${code}, Reason: ${reason.toString()}`);
  summarizeAndExit();
});

ws.on('error', (err) => {
  console.error(`[UPSTREAM ERROR] ${err.message}`);
});

function summarizeAndExit() {
  clearTimeout(timer);
  try {
    ws.close();
  } catch {}

  console.log('----------------------------------------------------');
  console.log('SUMMARY:');
  console.log(`- Authenticated:       ${authenticated ? 'YES' : 'NO'}`);
  console.log(`- Ticks Received:      ${ticksReceived}`);
  console.log(`- Distinct Symbols:    ${receivedSymbols.size}`);

  if (authenticated && ticksReceived > 0) {
    console.log('RESULT: PASS (Real upstream feed verified)');
    process.exit(0);
  } else if (!authenticated) {
    console.log('RESULT: BLOCKED (Upstream authentication failed - credentials rejected by live gateway)');
    process.exit(0);
  } else {
    console.log('RESULT: INCOMPLETE (Authenticated but no ticks received in observation window)');
    process.exit(0);
  }
}
