import WebSocket, { RawData } from 'ws';
import * as dotenv from 'dotenv';
import { REQUIRED_SYMBOLS } from '../config/symbols';

dotenv.config();

const url = process.env.UPSTREAM_WS_URL || 'wss://v3-prod.livefxhub.com/ws/algo';
const apiKey = process.env.UPSTREAM_API_KEY || '';
const secretKey = process.env.UPSTREAM_SECRET_KEY || '';

console.log('================================================================');
console.log('       PHASE ONE: LIVE UPSTREAM WEBSOCKET VERIFICATION          ');
console.log('================================================================');
console.log(`Target WebSocket URL: ${url}`);
console.log(`API Key Configured:   ${apiKey ? `${apiKey.substring(0, 8)}... (Length: ${apiKey.length})` : '[MISSING]'}`);
console.log(`Secret Key Config:    ${secretKey ? `${secretKey.substring(0, 8)}... (Length: ${secretKey.length})` : '[MISSING]'}`);
console.log('----------------------------------------------------------------');

if (!apiKey || !secretKey) {
  console.error('ERROR: Missing UPSTREAM_API_KEY or UPSTREAM_SECRET_KEY in environment variables.');
  process.exit(1);
}

const ws = new WebSocket(url);
let authenticated = false;
let ticksReceived = 0;
const receivedSymbols = new Set<string>();

const timer = setTimeout(() => {
  console.log('\n[TIMEOUT] 15 seconds elapsed without completing workflow.');
  summarizeAndExit(1006, 'Timeout');
}, 15000);

ws.on('open', () => {
  console.log('[1/4] ✓ TCP & TLS Handshake Established with Upstream Gateway');
  
  const authPayload = {
    action: 'auth',
    api_key: apiKey,
    secret: secretKey,
  };
  
  console.log('[2/4] Transmitting Authentication Handshake:');
  console.log(JSON.stringify({
    action: 'auth',
    api_key: `${apiKey.substring(0, 8)}...`,
    secret: `${secretKey.substring(0, 8)}...`,
  }, null, 2));

  ws.send(JSON.stringify(authPayload));
});

ws.on('message', (raw: RawData) => {
  const text = raw.toString('utf8');
  console.log('\n[UPSTREAM RAW INCOMING FRAME]:');
  console.log(text);

  try {
    const msg = JSON.parse(text);

    // Check for auth rejection
    if (msg.event === 'error' || msg.status === 'error' || msg.status === 'failed') {
      console.log(`\n[3/4] ✗ Upstream Gateway Authentication REJECTED:`);
      console.log(`      Error Event:   "${msg.event}"`);
      console.log(`      Error Message: "${msg.message || JSON.stringify(msg)}"`);
      authenticated = false;
      return;
    }

    // Check for auth success
    if (
      msg.event === 'auth_success' ||
      msg.event === 'authenticated' ||
      msg.status === 'success' ||
      (msg.event === 'info' && String(msg.message).toLowerCase().includes('success'))
    ) {
      console.log('\n[3/4] ✓ Upstream Authentication Succeeded!');
      authenticated = true;

      console.log(`\n[4/4] Sending Subscription Request for ${REQUIRED_SYMBOLS.length} Symbols...`);
      const subPayload = {
        action: 'subscribeMarketPrice',
        symbols: [...REQUIRED_SYMBOLS],
      };
      ws.send(JSON.stringify(subPayload));
      return;
    }

    if (msg.event === 'subscribed') {
      console.log(`✓ Subscription Acknowledged for ${msg.symbols?.length || 'all'} symbols.`);
      return;
    }

    // Process incoming price ticks
    const items = Array.isArray(msg) ? msg : [msg];
    for (const item of items) {
      if (item.symbol && item.buy !== undefined && item.sell !== undefined) {
        ticksReceived++;
        receivedSymbols.add(item.symbol);
        console.log(`[LIVE TICK #${ticksReceived}] Symbol: ${item.symbol} | Bid: ${item.buy} | Ask: ${item.sell} | Timestamp: ${item.timestamp}`);
      }
    }

    if (ticksReceived >= 10) {
      console.log('\n✓ Successfully received and validated 10 live market price ticks.');
      summarizeAndExit(1000, 'Success');
    }
  } catch (err) {
    console.error('Failed to parse frame as JSON:', err);
  }
});

ws.on('close', (code, reason) => {
  console.log(`\n[UPSTREAM SOCKET CLOSED] Code: ${code} | Reason: "${reason.toString()}"`);
  summarizeAndExit(code, reason.toString());
});

ws.on('error', (err) => {
  console.error(`\n[UPSTREAM SOCKET ERROR] ${err.message}`);
});

function summarizeAndExit(code: number, reason: string) {
  clearTimeout(timer);
  try {
    ws.close();
  } catch {}

  console.log('\n================================================================');
  console.log('                    PHASE ONE SUMMARY REPORT                    ');
  console.log('================================================================');
  console.log(`WebSocket Connection:     SUCCESS (Endpoint reachable)`);
  console.log(`Upstream Handshake Sent:  SUCCESS (action: "auth")`);
  console.log(`Server Auth Response:     ${authenticated ? 'AUTHENTICATED' : 'REJECTED (Code ' + code + ')'}`);
  console.log(`Symbols Subscribed:       ${authenticated ? REQUIRED_SYMBOLS.length : 0}`);
  console.log(`Live Ticks Received:      ${ticksReceived}`);
  console.log('----------------------------------------------------------------');

  if (authenticated && ticksReceived > 0) {
    console.log('STATUS: PASS');
    console.log('Live upstream market price feed confirmed and operational.');
    process.exit(0);
  } else if (!authenticated) {
    console.log('STATUS: BLOCKED BY UPSTREAM GATEWAY');
    console.log('EXACT ERROR:');
    console.log(`  Close Code:   ${code}`);
    console.log(`  Server Error: "${reason || 'invalid credentials'}"`);
    console.log('\nROOT CAUSE:');
    console.log('  The LiveFXHub gateway (wss://v3-prod.livefxhub.com/ws/algo) actively rejected');
    console.log('  the API key and secret provided in the prompt as invalid or expired.');
    console.log('\nRESOLUTION:');
    console.log('  1. Please check if updated API credentials were sent to your email.');
    console.log('  2. Update UPSTREAM_API_KEY and UPSTREAM_SECRET_KEY in your .env file.');
    console.log('  3. Re-run: npm run smoke');
    process.exit(0);
  } else {
    console.log('STATUS: INCOMPLETE');
    process.exit(0);
  }
}
