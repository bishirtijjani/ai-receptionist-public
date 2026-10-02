# Codeket WhatsApp AI Receptionist

WhatsApp bot for med spas. Answers inquiries, books appointments, hands off to humans when needed.

**Stack:** Claude Haiku 4.5 + Supabase + Vercel + **WhatsApp Cloud API (Meta)**

> This is Codeket's **own demo bot** (Meta Cloud API transport). The Twilio version lives in
> `../codeket-whatsapp-bot` and is used for paid client deploys. **Full setup: see `SETUP-META.md`.**

---

## Project structure

```
api/webhook.js          — Vercel serverless function (Meta webhook: GET verify + POST)
lib/
  anthropic.js          — LLM call + HANDOFF signal parser
  system-prompt.js      — System prompt builder (injected with spa config at runtime)
  supabase.js           — Conversation state CRUD
  whatsapp.js           — Send messages (Graph API) + parse webhook + verify signature
  calendly.js           — Available slots + scheduling link creation
  handoff.js            — Human handoff email alert + DB logging
demo/
  glow-spa-config.js    — Demo spa config (Glow Aesthetic Spa, Austin TX)
supabase/
  schema.sql            — DB schema (run once in Supabase SQL editor)
scripts/
  seed-demo-spa.js      — Seeds Glow Aesthetic Spa config into Supabase
test/
  simulate.js           — Terminal chat simulator (no Twilio needed)
```

---

## Setup (one-time)

### 1. Clone and install

```bash
git clone https://github.com/your-org/codeket-whatsapp-bot-meta
cd codeket-whatsapp-bot-meta
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `SUPABASE_URL` | Supabase project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project Settings > API (service_role key) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta App Dashboard > WhatsApp > API Setup |
| `WHATSAPP_ACCESS_TOKEN` | Meta permanent System User token (not the 24h temp token) |
| `WHATSAPP_VERIFY_TOKEN` | Any long random string you choose; paste the same into Meta's webhook config |
| `WHATSAPP_APP_SECRET` | Meta App Dashboard > Settings > Basic |
| `WHATSAPP_API_VERSION` | Graph API version, e.g. `v23.0` |
| `HANDOFF_EMAIL_TO` | Your email (alerts go here) |
| `SMTP_*` | Any SMTP. Gmail: enable App Passwords, use `smtp.gmail.com:587` |
| `SPA_ID` | `glow` for demo, or your spa's ID in Supabase |

### 3. Create Supabase schema

1. Open your Supabase project > SQL Editor
2. Paste contents of `supabase/schema.sql`
3. Run it

### 4. Seed the demo spa config

```bash
node scripts/seed-demo-spa.js
```

### 5. Test locally (no WhatsApp account needed)

```bash
node test/simulate.js
```

Type messages as the customer. You should see the bot reply as the Glow Aesthetic Spa receptionist.

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Vercel will give you a URL like `https://codeket-whatsapp-bot-meta.vercel.app`.

Your webhook URL is: `https://codeket-whatsapp-bot-meta.vercel.app/webhook`

Add all `.env` variables to Vercel: `vercel env add VARIABLE_NAME`

---

## Wire up the Meta WhatsApp Business number (production)

1. Go to developers.facebook.com > your app > WhatsApp > Configuration
2. Set webhook URL: `https://your-vercel-url.vercel.app/webhook`
3. Verify token: any string you choose (add as `WHATSAPP_VERIFY_TOKEN` to .env — see note below)
4. Subscribe to: `messages`

> **Note:** Meta's webhook uses a GET verification step. The `GET` handler in `api/webhook.js` responds to Meta's `hub.challenge` using `WHATSAPP_VERIFY_TOKEN`.

---

## Onboarding a new client (production)

1. Create a new row in `spa_configs` with the client's config (copy `glow-spa-config.js` structure, fill real data)
2. Set `SPA_ID` env var on Vercel to the new spa's ID
3. Connect their booking system (Boulevard/Vagaro: add OAuth credentials to `.env`)
4. Run the handoff email test to confirm alerts reach the right inbox
5. Run 4-day approval mode: route all replies to the owner before going live

---

## Costs (per client, per month)

| Service | Cost |
|---|---|
| Anthropic Haiku 4.5 | ~$2-5/mo at 500 conversations/day |
| Supabase free tier | $0 (up to 500MB, 50k rows) |
| Vercel free tier | $0 |
| Twilio WhatsApp (production) | ~$0.005/message |
| Calendly free tier | $0 (scheduling links) |
| **Total at demo/launch** | **~$3-7/mo** |

Client pays $297/mo. Margin is ~97%.
