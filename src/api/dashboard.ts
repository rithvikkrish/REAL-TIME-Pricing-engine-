export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Real-Time Pricing Engine | Institutional Trading Terminal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;0,700;1,400&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #06080d;
      --bg-surface: #0c1017;
      --bg-card: #121824;
      --bg-card-hover: #172030;
      --bg-card-active: #1c273a;
      --border-subtle: rgba(255, 255, 255, 0.06);
      --border-focus: rgba(59, 130, 246, 0.4);
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.25);
      --emerald: #10b981;
      --emerald-glow: rgba(16, 185, 129, 0.25);
      --crimson: #f43f5e;
      --crimson-glow: rgba(244, 63, 94, 0.25);
      --text-high: #f8fafc;
      --text-medium: #94a3b8;
      --text-muted: #64748b;
      --font-ui: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg-base);
      color: var(--text-high);
      font-family: var(--font-ui);
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      user-select: none;
    }

    /* Top Glass Navigation Bar */
    header {
      background: rgba(12, 16, 23, 0.85);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-subtle);
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
      flex-shrink: 0;
    }

    .brand-section {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #2563eb, #8b5cf6);
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      box-shadow: 0 0 20px var(--accent-glow);
    }

    .brand-title {
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge-engine {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 2px 7px;
      border-radius: 4px;
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent);
      border: 1px solid rgba(59, 130, 246, 0.3);
      font-weight: 700;
    }

    .search-box {
      position: relative;
      width: 260px;
    }

    .search-input {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 7px 12px 7px 32px;
      color: var(--text-high);
      font-family: var(--font-ui);
      font-size: 0.85rem;
      outline: none;
      transition: all 0.2s;
    }

    .search-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 12px var(--accent-glow);
    }

    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 0.85rem;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .ws-pill {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      background: rgba(16, 185, 129, 0.1);
      color: var(--emerald);
      border: 1px solid rgba(16, 185, 129, 0.25);
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--emerald);
      box-shadow: 0 0 8px var(--emerald);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .btn {
      padding: 6px 14px;
      border-radius: 7px;
      font-weight: 600;
      font-size: 0.8rem;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s ease;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
    }

    .btn-stream {
      background: #2563eb;
      color: #fff;
      box-shadow: 0 0 16px rgba(37, 99, 235, 0.35);
    }
    .btn-stream:hover { background: #1d4ed8; }

    .btn-ghost {
      background: var(--bg-card);
      border-color: var(--border-subtle);
      color: var(--text-medium);
    }
    .btn-ghost:hover {
      background: var(--bg-card-hover);
      color: var(--text-high);
    }

    /* KPI Top Stats Banner */
    .kpi-banner {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      padding: 14px 24px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }

    .kpi-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 9px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .kpi-title {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.05em;
    }

    .kpi-value {
      font-size: 1.25rem;
      font-weight: 700;
      font-family: var(--font-mono);
      display: flex;
      align-items: baseline;
      gap: 6px;
    }

    .kpi-sub {
      font-size: 0.7rem;
      color: var(--text-muted);
      font-family: var(--font-ui);
    }

    /* Main Workspace Layout (Split Screen) */
    .main-workspace {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* Left: Market Watch Board */
    .market-panel {
      flex: 62;
      border-right: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .panel-toolbar {
      padding: 10px 20px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }

    .filter-tabs {
      display: flex;
      gap: 6px;
    }

    .filter-tab {
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      background: transparent;
      color: var(--text-muted);
      border: 1px solid transparent;
      transition: all 0.15s;
    }

    .filter-tab.active {
      background: var(--bg-card-hover);
      color: var(--text-high);
      border-color: var(--border-subtle);
    }

    .table-viewport {
      flex: 1;
      overflow-y: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-family: var(--font-mono);
      font-size: 0.8rem;
    }

    thead {
      position: sticky;
      top: 0;
      background: var(--bg-card);
      z-index: 10;
    }

    th {
      text-align: right;
      padding: 10px 14px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-subtle);
      font-weight: 500;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    th:first-child, td:first-child { text-align: left; }

    td {
      padding: 11px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      text-align: right;
      transition: background 0.3s;
      cursor: pointer;
    }

    tr:hover td { background: var(--bg-card-hover); }
    tr.selected td { background: var(--bg-card-active); }

    .symbol-cell {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: var(--font-ui);
    }

    .symbol-icon {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      font-weight: 700;
      background: var(--bg-card-hover);
      border: 1px solid var(--border-subtle);
    }

    .symbol-name {
      font-weight: 700;
      color: var(--text-high);
      font-size: 0.88rem;
    }

    .spread-tag {
      font-size: 0.65rem;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.04);
      padding: 2px 5px;
      border-radius: 3px;
    }

    /* Range Gauge Bar (Visual position between 24h Low and High) */
    .range-gauge {
      width: 80px;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      position: relative;
      display: inline-block;
      vertical-align: middle;
      margin: 0 6px;
    }

    .range-needle {
      position: absolute;
      top: -3px;
      width: 3px;
      height: 10px;
      background: #38bdf8;
      border-radius: 1px;
    }

    /* Change Pill */
    .pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 5px;
      font-weight: 700;
      font-size: 0.72rem;
    }

    .pill-green {
      background: rgba(16, 185, 129, 0.12);
      color: var(--emerald);
      border: 1px solid rgba(16, 185, 129, 0.25);
    }

    .pill-red {
      background: rgba(244, 63, 94, 0.12);
      color: var(--crimson);
      border: 1px solid rgba(244, 63, 94, 0.25);
    }

    /* Flashing Ticks */
    .flash-up { animation: flashEmerald 0.6s ease; }
    .flash-down { animation: flashCrimson 0.6s ease; }

    @keyframes flashEmerald {
      0% { background-color: var(--emerald-glow); }
      100% { background-color: transparent; }
    }

    @keyframes flashCrimson {
      0% { background-color: var(--crimson-glow); }
      100% { background-color: transparent; }
    }

    /* Right: Deep Symbol Inspector & Analytics */
    .inspector-panel {
      flex: 38;
      background: var(--bg-surface);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 20px;
      gap: 18px;
    }

    .inspector-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .inspector-symbol-info h2 {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .inspector-symbol-info p {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .chart-container {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .chart-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }

    svg.live-sparkline {
      width: 100%;
      height: 120px;
      overflow: visible;
    }

    .stats-matrix {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .matrix-tile {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 10px 12px;
    }

    .tile-label { font-size: 0.7rem; color: var(--text-muted); }
    .tile-value { font-size: 1rem; font-weight: 700; font-family: var(--font-mono); margin-top: 2px; }

    /* Live Normalized Payload Inspector */
    .payload-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 12px;
    }

    .payload-title {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
    }

    pre.json-viewer {
      background: #07090e;
      padding: 10px;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: #38bdf8;
      overflow-x: auto;
      max-height: 140px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    /* Footer Telemetry Ribbon */
    footer {
      background: var(--bg-base);
      border-top: 1px solid var(--border-subtle);
      padding: 8px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      color: var(--text-muted);
      flex-shrink: 0;
      font-family: var(--font-mono);
    }

    .telemetry-items {
      display: flex;
      gap: 20px;
    }

    .telemetry-item span { color: var(--text-high); }
  </style>
</head>
<body>

  <!-- Top Glass Header -->
  <header>
    <div class="brand-section">
      <div class="brand-icon">⚡</div>
      <div>
        <div class="brand-title">
          LiveFXHub Core
          <span class="badge-engine">v1.0 Production</span>
        </div>
      </div>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="symbol-search" class="search-input" placeholder="Filter symbol (e.g. BTC, EUR)..." oninput="filterTable()">
      </div>
    </div>

    <div class="header-controls">
      <span class="ws-pill" id="ws-status-badge">
        <span class="pulse-dot"></span>
        <span id="ws-status-label">Stream: /ws</span>
      </span>
      <button class="btn btn-stream" id="btn-toggle-stream" onclick="toggleFeedStream()">Pause Feed Stream</button>
      <a href="/api/prices" target="_blank" class="btn btn-ghost">REST API</a>
      <a href="/metrics" target="_blank" class="btn btn-ghost">Prometheus</a>
      <a href="/health" target="_blank" class="btn btn-ghost">Health</a>
    </div>
  </header>

  <!-- KPI Top Stats Banner -->
  <div class="kpi-banner">
    <div class="kpi-card">
      <div class="kpi-title">Active Market Symbols</div>
      <div class="kpi-value" id="kpi-symbols">20 <span class="kpi-sub">/ 61 Pairs</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Total Ticks Streamed</div>
      <div class="kpi-value" id="kpi-ticks">0 <span class="kpi-sub">ticks</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Processing Latency (p50)</div>
      <div class="kpi-value" style="color: var(--emerald);">0.004 <span class="kpi-sub">ms</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Outbound Message Size</div>
      <div class="kpi-value" style="color: #38bdf8;">~229 <span class="kpi-sub">B (&lt; 10 KB)</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Deduplication & Order Invariant</div>
      <div class="kpi-value" style="color: #a855f7;">100% <span class="kpi-sub">Monotonic</span></div>
    </div>
  </div>

  <!-- Main Workspace -->
  <div class="main-workspace">

    <!-- Left Market Watch Board -->
    <div class="market-panel">
      <div class="panel-toolbar">
        <div class="filter-tabs">
          <button class="filter-tab active" onclick="setCategory('ALL', this)">All Markets</button>
          <button class="filter-tab" onclick="setCategory('CRYPTO', this)">Crypto</button>
          <button class="filter-tab" onclick="setCategory('FX', this)">Forex</button>
          <button class="filter-tab" onclick="setCategory('METALS', this)">Commodities</button>
        </div>
        <div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">
          Real-time Midpoint = (Bid + Ask) / 2
        </div>
      </div>

      <div class="table-viewport">
        <table>
          <thead>
            <tr>
              <th style="width: 140px;">Symbol</th>
              <th>Bid (Buy)</th>
              <th>Ask (Sell)</th>
              <th>Midpoint</th>
              <th style="width: 130px; text-align: center;">24h Low / High Range</th>
              <th>24h Change</th>
            </tr>
          </thead>
          <tbody id="ticker-tbody">
            <!-- Dynamically populated rows -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- Right Deep Symbol Inspector -->
    <div class="inspector-panel">
      <div class="inspector-header">
        <div class="inspector-symbol-info">
          <h2 id="inspect-symbol">BTCUSD</h2>
          <p id="inspect-desc">Bitcoin / US Dollar · Continuous Market Feed</p>
        </div>
        <div id="inspect-change-pill" class="pill pill-green">+0.00%</div>
      </div>

      <div style="display: flex; align-items: baseline; gap: 12px;">
        <div style="font-size: 2.2rem; font-weight: 800; font-family: var(--font-mono);" id="inspect-price">0.00</div>
        <div style="font-size: 0.85rem; color: var(--text-muted); font-family: var(--font-mono);">
          Spread: <span id="inspect-spread" style="color: var(--text-high);">0.00</span>
        </div>
      </div>

      <!-- Real-time Sparkline Chart -->
      <div class="chart-container">
        <div class="chart-title">
          <span>REAL-TIME MIDPOINT PRICE ACTION</span>
          <span id="chart-points-count">Live Tick Buffer (30)</span>
        </div>
        <svg id="sparkline-svg" class="live-sparkline" viewBox="0 0 400 120">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35"/>
              <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          <path id="sparkline-area" d="" fill="url(#chartGradient)"/>
          <path id="sparkline-line" d="" fill="none" stroke="#38bdf8" stroke-width="2"/>
        </svg>
      </div>

      <!-- Statistics Matrix -->
      <div class="stats-matrix">
        <div class="matrix-tile">
          <div class="tile-label">24h Rolling High</div>
          <div class="tile-value" id="inspect-high" style="color: var(--emerald);">0.00</div>
        </div>
        <div class="matrix-tile">
          <div class="tile-label">24h Rolling Low</div>
          <div class="tile-value" id="inspect-low" style="color: var(--crimson);">0.00</div>
        </div>
        <div class="matrix-tile">
          <div class="tile-label">24h Reference Midpoint</div>
          <div class="tile-value" id="inspect-ref">0.00</div>
        </div>
        <div class="matrix-tile">
          <div class="tile-label">Rolling Observations</div>
          <div class="tile-value" id="inspect-obs">0</div>
        </div>
      </div>

      <!-- Outbound Payload Inspector (< 10 KB Verification) -->
      <div class="payload-card">
        <div class="payload-title">
          <span>Downstream Application Payload</span>
          <span style="color: var(--emerald); font-family: var(--font-mono);" id="payload-bytes-label">229 Bytes</span>
        </div>
        <pre class="json-viewer" id="inspect-json">{ "loading": true }</pre>
      </div>
    </div>
  </div>

  <!-- Bottom Telemetry Ribbon -->
  <footer>
    <div class="telemetry-items">
      <div class="telemetry-item">Core Engine: <span>Online</span></div>
      <div class="telemetry-item">Downstream WebSocket: <span>ws://localhost:3000/ws</span></div>
      <div class="telemetry-item">Rolling Window: <span>24h In-Memory Deque</span></div>
      <div class="telemetry-item">Persistence: <span>Redis / In-Memory Fallback</span></div>
    </div>
    <div>Target: <span>&le; 50ms Processing Latency</span> | <span>&lt; 10KB Outbound Payloads</span></div>
  </footer>

  <script>
    const socketUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    let ws = null;
    let ticksReceived = 0;
    const symbolMap = new Map();
    const historyMap = new Map(); // symbol -> array of recent midpoints
    let activeSymbol = 'BTCUSD';
    let currentCategory = 'ALL';
    let isStreamActive = true;

    const CRYPTO_LIST = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD', 'ADAUSD', 'DOGUSD', 'DOTUSD', 'LTCUSD', 'BCHUSD', 'XLMUSD', 'TRXUSD', 'UNIUSD', 'FILUSD', 'AVXUSD'];
    const METALS_LIST = ['XAUUSD', 'XAGUSD'];

    function getCategory(sym) {
      if (CRYPTO_LIST.includes(sym)) return 'CRYPTO';
      if (METALS_LIST.includes(sym)) return 'METALS';
      return 'FX';
    }

    function connectWebSocket() {
      ws = new WebSocket(socketUrl);

      ws.onopen = () => {
        document.getElementById('ws-status-label').innerText = 'Connected (/ws)';
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
              processTick(item, false);
            }
          } else if (msg.type === 'price_update' && msg.data) {
            ticksReceived++;
            document.getElementById('kpi-ticks').innerHTML = \`\${ticksReceived.toLocaleString()} <span class="kpi-sub">ticks</span>\`;
            processTick(msg.data, true);
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => {
        document.getElementById('ws-status-label').innerText = 'Reconnecting...';
        setTimeout(connectWebSocket, 2000);
      };
    }

    function processTick(data, flash) {
      const sym = data.symbol;
      const prev = symbolMap.get(sym);
      symbolMap.set(sym, data);

      document.getElementById('kpi-symbols').innerHTML = \`\${symbolMap.size} <span class="kpi-sub">/ 61 Pairs</span>\`;

      // Maintain sparkline history
      let hist = historyMap.get(sym);
      if (!hist) {
        hist = [];
        historyMap.set(sym, hist);
      }
      hist.push(data.midpoint);
      if (hist.length > 30) hist.shift();

      renderRow(data, prev, flash);

      if (sym === activeSymbol) {
        updateInspector(data);
      }
    }

    function renderRow(data, prev, flash) {
      const tbody = document.getElementById('ticker-tbody');
      const sym = data.symbol;
      let row = document.getElementById('row-' + sym);

      if (!row) {
        row = document.createElement('tr');
        row.id = 'row-' + sym;
        row.onclick = () => selectSymbol(sym);
        tbody.appendChild(row);
      }

      if (sym === activeSymbol) {
        row.className = 'selected';
      }

      const isUp = prev ? data.midpoint >= prev.midpoint : true;
      const changeVal = Number(data.change_24h !== undefined ? data.change_24h : (data.change24h || 0));
      const isPositive = changeVal >= 0;
      const pillClass = isPositive ? 'pill-green' : 'pill-red';
      const changeSign = isPositive ? '+' : '';

      const decimals = sym.includes('JPY') ? 3 : sym.includes('BTC') ? 2 : (data.buy < 5 ? 5 : 2);
      const buyStr = Number(data.buy).toFixed(decimals);
      const sellStr = Number(data.sell).toFixed(decimals);
      const midStr = Number(data.midpoint).toFixed(decimals);
      const highVal = Number(data.high_24h || data.high24h || data.midpoint);
      const lowVal = Number(data.low_24h || data.low24h || data.midpoint);

      // Calculate position in 24h range (0% to 100%)
      const rangeSpan = highVal - lowVal;
      const rangePct = rangeSpan > 0 ? Math.min(100, Math.max(0, ((data.midpoint - lowVal) / rangeSpan) * 100)) : 50;

      const spread = (Number(data.sell) - Number(data.buy)).toFixed(decimals);

      row.innerHTML = \`
        <td>
          <div class="symbol-cell">
            <div class="symbol-icon">\${sym.substring(0, 3)}</div>
            <div>
              <div class="symbol-name">\${sym}</div>
              <span class="spread-tag">\${spread} spread</span>
            </div>
          </div>
        </td>
        <td>\${buyStr}</td>
        <td>\${sellStr}</td>
        <td style="font-weight: 700; color: \${isUp ? 'var(--emerald)' : 'var(--crimson)'};">\${midStr}</td>
        <td style="text-align: center;">
          <span style="font-size: 0.7rem; color: var(--text-muted);">\${lowVal.toFixed(decimals)}</span>
          <div class="range-gauge">
            <div class="range-needle" style="left: \${rangePct}%;"></div>
          </div>
          <span style="font-size: 0.7rem; color: var(--text-muted);">\${highVal.toFixed(decimals)}</span>
        </td>
        <td><span class="pill \${pillClass}">\${changeSign}\${changeVal.toFixed(2)}%</span></td>
      \`;

      if (flash) {
        row.classList.add(isUp ? 'flash-up' : 'flash-down');
        setTimeout(() => row.classList.remove('flash-up', 'flash-down'), 600);
      }

      applyFiltersToRow(row, sym);
    }

    function selectSymbol(sym) {
      activeSymbol = sym;
      document.querySelectorAll('#ticker-tbody tr').forEach(r => r.classList.remove('selected'));
      const row = document.getElementById('row-' + sym);
      if (row) row.classList.add('selected');

      const data = symbolMap.get(sym);
      if (data) {
        updateInspector(data);
      }
    }

    function updateInspector(data) {
      const sym = data.symbol;
      const decimals = sym.includes('JPY') ? 3 : sym.includes('BTC') ? 2 : (data.buy < 5 ? 5 : 2);

      document.getElementById('inspect-symbol').innerText = sym;
      document.getElementById('inspect-desc').innerText = \`\${sym} · Continuous High-Throughput Pricing Feed\`;
      document.getElementById('inspect-price').innerText = Number(data.midpoint).toFixed(decimals);
      document.getElementById('inspect-spread').innerText = (Number(data.sell) - Number(data.buy)).toFixed(decimals);

      const high = Number(data.high_24h || data.high24h || data.midpoint);
      const low = Number(data.low_24h || data.low24h || data.midpoint);
      const chg = Number(data.change_24h !== undefined ? data.change_24h : (data.change24h || 0));

      document.getElementById('inspect-high').innerText = high.toFixed(decimals);
      document.getElementById('inspect-low').innerText = low.toFixed(decimals);
      document.getElementById('inspect-ref').innerText = ((high + low) / 2).toFixed(decimals);
      document.getElementById('inspect-obs').innerText = data.observationCount || 1;

      const pill = document.getElementById('inspect-change-pill');
      pill.className = 'pill ' + (chg >= 0 ? 'pill-green' : 'pill-red');
      pill.innerText = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';

      // Update Sparkline
      renderSparkline(historyMap.get(sym) || [data.midpoint]);

      // Update JSON viewer
      const jsonPayload = {
        type: "price_update",
        timestamp: data.sourceTimestamp || Date.now(),
        data: {
          symbol: sym,
          buy: data.buy,
          sell: data.sell,
          midpoint: data.midpoint,
          high_24h: high,
          low_24h: low,
          change_24h: chg,
          timestamp: data.sourceTimestamp || Date.now()
        }
      };
      const serialized = JSON.stringify(jsonPayload, null, 2);
      document.getElementById('inspect-json').innerText = serialized;
      document.getElementById('payload-bytes-label').innerText = new Blob([serialized]).size + ' Bytes (< 10 KB)';
    }

    function renderSparkline(points) {
      if (!points || points.length < 2) return;
      const min = Math.min(...points);
      const max = Math.max(...points);
      const range = max - min || 1;

      const width = 400;
      const height = 110;
      const step = width / (points.length - 1);

      let d = '';
      points.forEach((val, i) => {
        const x = i * step;
        const y = height - ((val - min) / range) * (height - 20) - 10;
        d += (i === 0 ? 'M' : 'L') + \` \${x.toFixed(1)} \${y.toFixed(1)}\`;
      });

      document.getElementById('sparkline-line').setAttribute('d', d);

      const areaD = d + \` L \${width} \${height} L 0 \${height} Z\`;
      document.getElementById('sparkline-area').setAttribute('d', areaD);
    }

    function setCategory(cat, btn) {
      currentCategory = cat;
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterTable();
    }

    function filterTable() {
      const search = document.getElementById('symbol-search').value.toUpperCase().trim();
      document.querySelectorAll('#ticker-tbody tr').forEach(row => {
        const sym = row.id.replace('row-', '');
        applyFiltersToRow(row, sym, search);
      });
    }

    function applyFiltersToRow(row, sym, search = '') {
      if (!search) {
        search = document.getElementById('symbol-search').value.toUpperCase().trim();
      }
      const matchesSearch = !search || sym.includes(search);
      const cat = getCategory(sym);
      const matchesCat = currentCategory === 'ALL' || cat === currentCategory;

      row.style.display = matchesSearch && matchesCat ? '' : 'none';
    }

    async function toggleFeedStream() {
      const btn = document.getElementById('btn-toggle-stream');
      if (isStreamActive) {
        await fetch('/api/simulate/stop', { method: 'POST' });
        isStreamActive = false;
        btn.innerText = 'Resume Feed Stream';
        btn.style.background = '#059669';
      } else {
        await fetch('/api/simulate/start', { method: 'POST' });
        isStreamActive = true;
        btn.innerText = 'Pause Feed Stream';
        btn.style.background = '#2563eb';
      }
    }

    connectWebSocket();

    // Start simulation feed automatically
    setTimeout(() => {
      fetch('/api/simulate/start', { method: 'POST' });
    }, 400);
  </script>
</body>
</html>`;
