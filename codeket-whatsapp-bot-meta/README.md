# Codeket WhatsApp AI Receptionist

WhatsApp bot for med spas. Answers inquiries, books appointments, hands off to humans when needed.

**Stack:** Claude Haiku 4.5 + PostgreSQL + Node/Express + **WhatsApp Cloud API (Meta)**

> This is Codeket's **own demo bot** (Meta Cloud API transport). The Twilio version lives in
> `../codeket-whatsapp-bot` and is used for paid client deploys. **Full setup: see `SETUP-META.md`.**
>
> Self-hosted: the Vercel serverless runtime and Supabase have been replaced by a
> standalone Node server (`server.js`) and the shared PostgreSQL container.

---

## Project structure

```
server.js               — standalone HTTP server (Express): /health, /webhook, /instagram-webhook
api/
  webhook.js            — WhatsApp Cloud API webhook (GET verify + POST)
  instagram-webhook.js  — Instagram DM webhook (GET verify + POST)
lib/
  anthropic.js          — LLM call + HANDOFF signal parser
  system-prompt.js      — System prompt builder (injected with spa config at runtime)
  db.js                 — PostgreSQL persistence (pg Pool)
  whatsapp.js           — Send messages (Graph API) + parse webhook + verify signature
  instagram.js          — Send + parse + verify Instagram DMs
  calendly.js           — Available slots + scheduling link creation
  handoff.js            — Human handoff email alert + DB logging
demo/
  glow-spa-config.js    — Demo spa config (Glow Aesthetic Spa, Austin TX)
db/
  schema.sql            — DB schema (run once with psql)
scripts/
  seed-demo-spa.js      — Seeds the Glow Aesthetic Spa config
test/
  simulate.js           — Terminal chat simulator (no WhatsApp needed)
```

---

## Setup (one-time)

### 1. Install

```bash
cd codeket-whatsapp-bot-meta
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `DATABASE_URL` | Shared PostgreSQL — `postgresql://user:pass@postgresql:5432/ai_receptionist` |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta App Dashboard > WhatsApp > API Setup |
| `WHATSAPP_ACCESS_TOKEN` | Meta permanent System User token (not the 24h temp token) |
| `WHATSAPP_VERIFY_TOKEN` | Any long random string you choose; paste the same into Meta's webhook config |
| `WHATSAPP_APP_SECRET` | Meta App Dashboard > Settings > Basic |
| `WHATSAPP_API_VERSION` | Graph API version, e.g. `v23.0` |
| `IG_*` | Instagram DM channel (IG app + `instagram_manage_messages`) |
| `HANDOFF_EMAIL_TO` | Your email (alerts go here) |
| `SMTP_*` | Any SMTP. Gmail: enable App Passwords, use `smtp.gmail.com:587` |
| `SPA_ID` | `glow` for demo, or the spa's ID in `spa_configs` |

### 3. Create the schema

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

### 4. Seed the demo spa config

```bash
npm run seed
```

### 5. Run

```bash
npm start          # serves /health, /webhook, /instagram-webhook on PORT (default 3000)
```

For local testing without a WhatsApp account:

```bash
npm test           # terminal chat simulator
```

---

## Deploy

Runs as a Docker container behind the shared nginx reverse proxy (no host ports; reachable
over `shared_net`). On the VPS the app lives at `/opt/docker/apps/ai-receptionist` and
auto-deploys from GitHub via the webhook system. See the server README for the runbook.

Webhook URLs:
- WhatsApp: `https://ai-receptionist.codeket.com/webhook`
- Instagram: `https://ai-receptionist.codeket.com/instagram-webhook`

---

## Onboarding a new client (production)

1. Insert a new row in `spa_configs` with the client's config (copy `glow-spa-config.js` structure)
2. Set `SPA_ID` to the new spa's ID
3. Connect their booking system (Boulevard/Vagaro: add OAuth credentials to `.env`)
4. Run the handoff email test to confirm alerts reach the right inbox
5. Run 4-day approval mode: route all replies to the owner before going live

---

## Costs (per client, per month)

| Service | Cost |
|---|---|
| Anthropic Haiku 4.5 | ~$2-5/mo at 500 conversations/day |
| PostgreSQL (self-hosted) | $0 |
| Twilio WhatsApp (production) | ~$0.005/message |
| Calendly free tier | $0 (scheduling links) |
| **Total at demo/launch** | **~$3-7/mo** |

Client pays $297/mo. Margin is ~97%.

---

> `BUILD_LOG.md`, `RECREATE-FROM-SCRATCH.md`, and `META-SETUP-PROMPT.md` are historical
> build notes and still describe the original Vercel/Supabase setup.
