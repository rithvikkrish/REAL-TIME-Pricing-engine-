import WebSocket from 'ws';

const wsUrl = 'ws://localhost:3000/ws';
console.log('Connecting to Downstream WebSocket server at:', wsUrl);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✓ Successfully connected to Downstream WebSocket Server!\n');

  const subscribeMsg = {
    action: 'subscribe',
    symbols: ['EURUSD', 'BTCUSD', 'XAUUSD'],
    requestId: 'req-101',
  };

  console.log('Sending client subscription:', JSON.stringify(subscribeMsg));
  ws.send(JSON.stringify(subscribeMsg));
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  console.log('\n[DOWNSTREAM SERVER MESSAGE RECEIVED]:', JSON.stringify(msg, null, 2));

  if (msg.type === 'subscribed') {
    console.log('✓ Subscription confirmed for:', msg.symbols);
  }

  if (msg.type === 'snapshot') {
    console.log(`✓ Received snapshot containing ${msg.data.length} symbol(s).`);
  }
});

ws.on('close', (code, reason) => {
  console.log(`Connection closed: ${code} - ${reason}`);
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('WebSocket client error:', err.message);
});

// Run for 3 seconds then gracefully close
setTimeout(() => {
  console.log('\nSending ping...');
  ws.send(JSON.stringify({ action: 'ping', requestId: 'ping-1' }));

  setTimeout(() => {
    console.log('Demo completed successfully. Closing client connection.');
    ws.close();
  }, 1000);
}, 2000);
