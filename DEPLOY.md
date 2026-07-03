# Deploying Content Studio (free hosting)

Two pieces:
- **The app** — a single static `index.html`. Host it free on Cloudflare Pages, Netlify, or GitHub Pages.
- **The proxy** (optional but recommended) — a Cloudflare Worker that keeps your OpenAI key **off the client**. Free on the Workers free tier.

> Hosting is free. **OpenAI API usage is billed by OpenAI** — the proxy just protects the key; it doesn't make generations free.

---

## Option A — Fastest (no proxy): drag-and-drop

Good for personal/local testing. The key lives in each user's browser (exposed to that page).

1. `index.html` is ready in this folder.
2. Go to **https://app.netlify.com/drop** and drag `index.html` onto the page.
3. Open the URL → ⋯ → **Settings** → paste your OpenAI key → done.

⚠️ Anyone with the URL can load the app, but they'd need their **own** key. Never hardcode a key in the file.

---

## Option B — Recommended: app + key-protecting proxy (all free)

### 1. Deploy the proxy (Cloudflare Workers)

#### 1a. Dashboard method — no terminal, no Node (recommended)
1. Sign up / log in (free): **https://dash.cloudflare.com** → **Workers & Pages**.
2. **Create application → Create Worker** → name it `content-studio-proxy` → **Deploy** (creates a starter).
3. **Edit code** → delete the starter → paste the entire contents of [`proxy/worker.js`](proxy/worker.js) → **Deploy**.
4. Open the Worker → **Settings → Variables and Secrets** → **Add** these (choose **Secret / Encrypt**):
   - `OPENAI_API_KEY` = your `sk-...` key
   - `ALLOW_ORIGIN` = `https://whitmanmarketing.github.io`   ← your live site's origin (scheme + host, **no path/slash**)
   - `ACCESS_TOKEN` = a shared team password (pick anything strong)
5. Copy the Worker URL shown at the top, e.g. `https://content-studio-proxy.<your-subdomain>.workers.dev`.

#### 1b. CLI method (only if you have Node installed)
```
npm i -g wrangler
cd proxy
wrangler login
wrangler secret put OPENAI_API_KEY          # paste your sk-... key
wrangler secret put ALLOW_ORIGIN            # https://whitmanmarketing.github.io
wrangler secret put ACCESS_TOKEN            # a shared team password
wrangler deploy
```

**Protections (only active when you set them):**
- `ALLOW_ORIGIN` → the Worker rejects any request whose Origin isn't your app URL.
- `ACCESS_TOKEN` → the Worker requires the `X-Access-Token` header to match (the shared password).

### 2. Deploy the app (Cloudflare Pages — free)
- Cloudflare dashboard → Workers & Pages → Create → Pages → **Upload assets** → upload `index.html` → Deploy.
- (Or Netlify Drop as in Option A.)

### 3. Point the app at the proxy
- Open the app → ⋯ → **Settings**.
- **OpenAI proxy URL** = your Worker URL (e.g. `https://content-studio-proxy.<you>.workers.dev`).
- **Proxy access token** = the same `ACCESS_TOKEN` you set on the Worker (share this with your team).
- Leave **OpenAI API key** blank. The proxy injects the key server-side.

Now text + image generation work with the key never touching the browser, and only people with the access token (from an allowed origin) can use it.

---

## Locking it down (recommended for anything public)
- Set `ALLOW_ORIGIN` on the Worker to your exact app URL — the Worker rejects other origins server-side.
- Set `ACCESS_TOKEN` (shared team password); the app sends it as `X-Access-Token`. People who find the Worker URL but don't have the token get a 403.
- Note: the access token lives in each user's browser (it's a shared team password, not a per-user secret). For a true per-user login wall, put **Cloudflare Access** (email/SSO) in front of the Worker — free for small teams.
- Rotate the OpenAI key if it's ever exposed.

## Updating later
- App change: re-upload `index.html` to Pages/Netlify.
- Proxy change: `wrangler deploy` again.
