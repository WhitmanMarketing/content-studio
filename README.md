# Content Studio — Advisory Marketing

AI-assisted social media content studio for a small financial advisory firm. A single-file web app: monthly content-calendar generation, a drafting pipeline (**Draft → Create → Image → Video Script**), an approval/compliance workflow, filters, at-a-glance stats, and CSV/JSON export & import — all client-side (localStorage), nothing auto-publishes.

## Run
Open `index.html` (or `content-studio.html` — they're the same app) in any modern browser.

## AI features
- **Text** (calendar, draft, finalize, video script): OpenAI Chat Completions, model `gpt-5.4-mini`.
- **Images**: OpenAI `gpt-image-2` (generations, or edits when a reference image is uploaded).

Add your OpenAI key in **Settings**, or point the app at a server-side proxy so the key never touches the browser.

## Deploy
See [DEPLOY.md](DEPLOY.md) for free hosting (Cloudflare Pages / Netlify / GitHub Pages) and the key-protecting Cloudflare Worker proxy in [`proxy/`](proxy/), which supports an origin lock and a shared access token.

## Compliance
Prompts include a finance guardrail (no specific return figures, guarantees, or personalized advice), and a post can't be marked **Approved** without a compliance note.
