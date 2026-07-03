/*
 * Content Studio — OpenAI proxy (Cloudflare Worker)
 * -------------------------------------------------------------------------
 * Keeps your OpenAI API key OFF the client. The web app calls this Worker;
 * the Worker adds the key server-side and forwards to OpenAI.
 *
 * Deploy free on Cloudflare Workers (free tier). Steps:
 *   1) npm i -g wrangler         (or use the Cloudflare dashboard editor)
 *   2) wrangler login
 *   3) wrangler secret put OPENAI_API_KEY     -> paste your sk-... key
 *   4) (recommended) wrangler secret put ALLOW_ORIGIN -> https://your-app-url
 *   5) (recommended) wrangler secret put ACCESS_TOKEN  -> a shared team password
 *   6) wrangler deploy
 * Then in the app: Settings -> "OpenAI proxy URL" = the Worker URL, leave the
 * API key blank, and "Proxy access token" = the same ACCESS_TOKEN you set.
 *
 * Protections (enforced only when configured):
 *   - ALLOW_ORIGIN: rejects requests whose Origin header isn't your app URL.
 *   - ACCESS_TOKEN: requires header X-Access-Token to match (shared password).
 * NOTE: OpenAI still bills usage. For a true login wall, put Cloudflare Access
 * in front of the Worker.
 */
export default {
  async fetch(request, env) {
    const allowOrigin = env.ALLOW_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Token',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    // 1) Origin lock — if ALLOW_ORIGIN is configured, reject other origins
    //    server-side (CORS alone is browser-only and non-browser clients ignore it).
    if (allowOrigin !== '*') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== allowOrigin) {
        return new Response('Forbidden origin', { status: 403, headers: cors });
      }
    }

    // 2) Access token (shared password) — if ACCESS_TOKEN is configured, require it.
    if (env.ACCESS_TOKEN) {
      if (request.headers.get('X-Access-Token') !== env.ACCESS_TOKEN) {
        return new Response('Invalid or missing access token', { status: 403, headers: cors });
      }
    }

    const url = new URL(request.url);
    // Only forward the endpoints this app actually uses.
    const allowed = ['/v1/chat/completions', '/v1/images/generations', '/v1/images/edits'];
    if (!allowed.includes(url.pathname)) {
      return new Response('Not found', { status: 404, headers: cors });
    }
    if (!env.OPENAI_API_KEY) {
      return new Response('Server missing OPENAI_API_KEY secret', { status: 500, headers: cors });
    }

    // Preserve the client Content-Type (crucial for multipart image edits);
    // inject the server-side key.
    const headers = new Headers();
    const ct = request.headers.get('Content-Type');
    if (ct) headers.set('Content-Type', ct);
    headers.set('Authorization', 'Bearer ' + env.OPENAI_API_KEY);

    let upstream;
    try {
      upstream = await fetch('https://api.openai.com' + url.pathname, {
        method: 'POST',
        headers,
        body: request.body,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Upstream fetch failed: ' + String(err) }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const out = new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
    Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v));
    return out;
  },
};
