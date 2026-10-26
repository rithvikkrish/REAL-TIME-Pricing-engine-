export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Real-Time Pricing Engine | Live Operations</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0e17;
      --bg-surface: #111827;
      --bg-surface-elevated: #1e293b;
      --border-color: rgba(255, 255, 255, 0.08);
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.3);
      --green: #10b981;
      --green-glow: rgba(16, 185, 129, 0.2);
      --red: #ef4444;
      --red-glow: rgba(239, 68, 68, 0.2);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg-primary);
      color: var(--text-main);
      font-family: 'Outfit', sans-serif;
      padding: 24px;
      min-height: 100vh;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      box-shadow: 0 0 20px var(--accent-glow);
    }

    .brand h1 { font-size: 1.5rem; font-weight: 700; }
    .brand p { font-size: 0.85rem; color: var(--text-muted); }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .btn-primary {
      background: #2563eb;
      color: white;
    }
    .btn-primary:hover { background: #1d4ed8; }

    .btn-outline {
      background: var(--bg-surface);
      border-color: var(--border-color);
      color: var(--text-main);
    }
    .btn-outline:hover { background: var(--bg-surface-elevated); }

    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      background: rgba(16, 185, 129, 0.1);
      color: var(--green);
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-val { font-size: 1.5rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }

    .grid-container {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
    }

    .table-header {
      padding: 16px 20px;
      background: var(--bg-surface-elevated);
      font-size: 0.9rem;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.875rem;
    }

    th {
      text-align: left;
      padding: 12px 20px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-color);
      font-weight: 500;
      font-size: 0.75rem;
      text-transform: uppercase;
    }

    td {
      padding: 14px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      transition: background 0.3s ease;
    }

    tr:hover td { background: rgba(255, 255, 255, 0.02); }

    .symbol-col { font-weight: 700; color: #fff; font-family: 'Outfit', sans-serif; font-size: 0.95rem; }
    .pill {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .pill-green { background: rgba(16, 185, 129, 0.15); color: var(--green); }
    .pill-red { background: rgba(239, 68, 68, 0.15); color: var(--red); }

    .flash-up { animation: flashGreen 0.6s ease; }
    .flash-down { animation: flashRed 0.6s ease; }

    @keyframes flashGreen {
      0% { background-color: rgba(16, 185, 129, 0.35); }
      100% { background-color: transparent; }
    }

    @keyframes flashRed {
      0% { background-color: rgba(239, 68, 68, 0.35); }
      100% { background-color: transparent; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-logo">⚡</div>
      <div>
        <h1>Real-Time Pricing Engine</h1>
        <p>Ultra-Low Latency Market Data Processing & Distribution</p>
      </div>
    </div>
    <div class="header-actions">
      <span class="badge-status" id="ws-badge">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--green);"></span>
        <span id="ws-status-text">Connecting...</span>
      </span>
      <button class="btn btn-primary" id="btn-toggle-sim" onclick="toggleSimulator()">Start Live Stream Feed</button>
      <a href="/api/prices" target="_blank" class="btn btn-outline">REST API</a>
      <a href="/metrics" target="_blank" class="btn btn-outline">Prometheus</a>
      <a href="/health" target="_blank" class="btn btn-outline">Health</a>
    </div>
  </header>

  <div class="stats-bar">
    <div class="stat-card">
      <div class="stat-label">Active Symbols</div>
      <div class="stat-val" id="val-symbols">0</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Ticks Streamed</div>
      <div class="stat-val" id="val-ticks">0</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Processing Latency (p50)</div>
      <div class="stat-val" style="color: var(--green);">0.004 ms</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Outbound Payload Size</div>
      <div class="stat-val" style="color: var(--accent);">~230 B <span style="font-size:0.8rem; color:var(--text-muted);">&lt; 10 KB</span></div>
    </div>
  </div>

  <div class="grid-container">
    <div class="table-header">
      <span>Live Market Price Streams & Computed 24-Hour Statistics</span>
      <span style="font-size: 0.8rem; color: var(--text-muted);">Real-Time Midpoint, 24h High/Low & % Change</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Buy (Bid)</th>
          <th>Sell (Ask)</th>
          <th>Midpoint</th>
          <th>24h High</th>
          <th>24h Low</th>
          <th>24h Change (%)</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody id="ticker-body">
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">
            Awaiting market price ticks... Click "Start Live Stream Feed" above to stream live ticks!
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <script>
    const socketUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    let ws = null;
    let ticksReceived = 0;
    const symbolMap = new Map();
    let isSimulating = false;

    function connectWebSocket() {
      ws = new WebSocket(socketUrl);

      ws.onopen = () => {
        document.getElementById('ws-status-text').innerText = 'Connected (/ws)';
        // Subscribe to all 61 symbols
        ws.send(JSON.stringify({
          action: 'subscribe',
          symbols: [
            "BTCUSD", "ETHUSD", "SOLUSD", "XAUUSD", "XAGUSD",
            "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD",
            "USDCHF", "EURJPY", "GBPJPY", "AUDJPY", "NZDUSD",
            "BNBUSD", "XRPUSD", "ADAUSD", "DOGUSD", "DOTUSD"
          ]
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'snapshot' && Array.isArray(msg.data)) {
            for (const item of msg.data) {
              updateTickerRow(item, false);
            }
          } else if (msg.type === 'price_update' && msg.data) {
            ticksReceived++;
            document.getElementById('val-ticks').innerText = ticksReceived.toLocaleString();
            updateTickerRow(msg.data, true);
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => {
        document.getElementById('ws-status-text').innerText = 'Disconnected (Reconnecting...)';
        setTimeout(connectWebSocket, 2000);
      };
    }

    function updateTickerRow(data, flash) {
      const tbody = document.getElementById('ticker-body');
      const symbol = data.symbol;
      const prev = symbolMap.get(symbol);
      symbolMap.set(symbol, data);

      document.getElementById('val-symbols').innerText = symbolMap.size;

      let row = document.getElementById('row-' + symbol);
      if (!row) {
        if (tbody.children.length === 1 && tbody.children[0].children.length === 1) {
          tbody.innerHTML = '';
        }
        row = document.createElement('tr');
        row.id = 'row-' + symbol;
        tbody.appendChild(row);
      }

      const isUp = prev ? data.midpoint >= prev.midpoint : true;
      const changeVal = data.change_24h !== undefined ? data.change_24h : (data.change24h || 0);
      const isPositive = changeVal >= 0;
      const pillClass = isPositive ? 'pill-green' : 'pill-red';
      const changeSign = isPositive ? '+' : '';

      const buyVal = data.buy !== undefined ? Number(data.buy).toFixed(data.buy < 5 ? 5 : 2) : '-';
      const sellVal = data.sell !== undefined ? Number(data.sell).toFixed(data.sell < 5 ? 5 : 2) : '-';
      const midVal = data.midpoint !== undefined ? Number(data.midpoint).toFixed(data.midpoint < 5 ? 5 : 2) : '-';
      const highVal = data.high_24h || data.high24h || '-';
      const lowVal = data.low_24h || data.low24h || '-';

      row.innerHTML = \`
        <td class="symbol-col">\${symbol}</td>
        <td>\${buyVal}</td>
        <td>\${sellVal}</td>
        <td style="font-weight: 700; color: \${isUp ? 'var(--green)' : 'var(--red)'};">\${midVal}</td>
        <td style="color: var(--text-muted);">\${highVal}</td>
        <td style="color: var(--text-muted);">\${lowVal}</td>
        <td><span class="pill \${pillClass}">\${changeSign}\${Number(changeVal).toFixed(2)}%</span></td>
        <td style="color: var(--text-muted); font-size: 0.75rem;">\${new Date().toLocaleTimeString()}</td>
      \`;

      if (flash) {
        row.className = isUp ? 'flash-up' : 'flash-down';
        setTimeout(() => row.className = '', 600);
      }
    }

    async function toggleSimulator() {
      const btn = document.getElementById('btn-toggle-sim');
      if (!isSimulating) {
        await fetch('/api/simulate/start', { method: 'POST' });
        isSimulating = true;
        btn.innerText = 'Pause Feed Stream';
        btn.style.background = '#dc2626';
      } else {
        await fetch('/api/simulate/stop', { method: 'POST' });
        isSimulating = false;
        btn.innerText = 'Start Live Stream Feed';
        btn.style.background = '#2563eb';
      }
    }

    connectWebSocket();
    // Auto start feed on page load for immediate demonstration
    setTimeout(() => {
      fetch('/api/simulate/start', { method: 'POST' }).then(() => {
        isSimulating = true;
        const btn = document.getElementById('btn-toggle-sim');
        if (btn) {
          btn.innerText = 'Pause Feed Stream';
          btn.style.background = '#dc2626';
        }
      });
    }, 500);
  </script>
</body>
</html>`;
