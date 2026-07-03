/*
 * Content Studio — Node server for Railway (serves the app + proxies OpenAI).
 * ---------------------------------------------------------------------------
 * One service does both:
 *   - Serves the static app (index.html) at /
 *   - Proxies POST /v1/chat/completions, /v1/images/generations, /v1/images/edits
 *     to OpenAI, injecting the key from the OPENAI_API_KEY env var (never on the client).
 *
 * No dependencies — uses Node's built-in http + global fetch (Node 18+).
 *
 * Railway setup:
 *   1) railway.app -> New Project -> Deploy from GitHub repo -> pick this repo.
 *   2) Variables: OPENAI_API_KEY (required), and optionally
 *      ALLOW_ORIGIN (e.g. https://your-app.up.railway.app) and ACCESS_TOKEN (shared password).
 *   3) Railway runs `npm start`; it provides PORT automatically.
 *   4) In the app: Settings -> "OpenAI proxy URL" = your Railway URL, leave the key blank.
 *      (If you open the app FROM the Railway URL it's same-origin, so this just works.)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
const ROOT = __dirname;
const API_PATHS = ['/v1/chat/completions', '/v1/images/generations', '/v1/images/edits'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain',
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Access-Token');
  res.setHeader('Vary', 'Origin');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') { setCors(res); res.writeHead(204); return res.end(); }

  // ---- OpenAI proxy ----
  if (API_PATHS.includes(pathname)) {
    setCors(res);
    if (req.method !== 'POST') { res.writeHead(405); return res.end('Method not allowed'); }
    if (ALLOW_ORIGIN !== '*') {
      const origin = req.headers.origin;
      if (origin && origin !== ALLOW_ORIGIN) { res.writeHead(403); return res.end('Forbidden origin'); }
    }
    if (ACCESS_TOKEN && req.headers['x-access-token'] !== ACCESS_TOKEN) {
      res.writeHead(403); return res.end('Invalid or missing access token');
    }
    if (!OPENAI_API_KEY) { res.writeHead(500); return res.end('Server missing OPENAI_API_KEY'); }

    const headers = { 'Authorization': 'Bearer ' + OPENAI_API_KEY };
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    try {
      const upstream = await fetch('https://api.openai.com' + pathname, {
        method: 'POST', headers, body: req, duplex: 'half',
      });
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
      return res.end(buf);
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Upstream fetch failed: ' + String(e) }));
    }
  }

  // ---- Static files ----
  if (req.method === 'GET') {
    let rel = decodeURIComponent(pathname);
    if (rel === '/') rel = '/index.html';
    const full = path.join(ROOT, path.normalize(rel));
    if (!full.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); } // no traversal
    fs.readFile(full, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      const ext = path.extname(full).toLowerCase();
      if (ext === '.html') {
        // Tell the app to route AI calls through this same origin (this server proxies them).
        const html = data.toString('utf8')
          .replace('</head>', '<script>window.__CS_PROXY__=location.origin;</script></head>');
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        return res.end(html);
      }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log('Content Studio listening on port ' + PORT));
