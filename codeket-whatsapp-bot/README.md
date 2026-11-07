# AI Receptionist WhatsApp AI Receptionist

WhatsApp bot for med spas. Answers inquiries, books appointments, hands off to humans when needed.

**Stack:** Claude Haiku 4.5 + Supabase + Vercel + Twilio WhatsApp

---

## Project structure

```
api/webhook.js          — Vercel serverless function (Twilio webhook entry point)
lib/
  anthropic.js          — LLM call + HANDOFF signal parser
  system-prompt.js      — System prompt builder (injected with spa config at runtime)
  supabase.js           — Conversation state CRUD
  twilio.js             — Send WhatsApp messages + validate webhook signature
  calendly.js           — Available slots + scheduling link creation
  handoff.js            — Human handoff email alert + DB logging
demo/
  example-spa-spa-config.js    — Demo spa config (Example Spa, Austin TX)
supabase/
  schema.sql            — DB schema (run once in Supabase SQL editor)
scripts/
  seed-demo-spa.js      — Seeds Example Spa config into Supabase
test/
  simulate.js           — Terminal chat simulator (no Twilio needed)
```

---

## Setup (one-time)

### 1. Clone and install

```bash
git clone https://github.com/your-org/ai-receptionist-whatsapp-bot
cd ai-receptionist-whatsapp-bot
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
| `TWILIO_ACCOUNT_SID` | console.twilio.com |
| `TWILIO_AUTH_TOKEN` | console.twilio.com |
| `TWILIO_WHATSAPP_NUMBER` | Twilio sandbox: `whatsapp:+14155238886` |
| `CALENDLY_API_TOKEN` | calendly.com/integrations/api_webhooks |
| `HANDOFF_EMAIL_TO` | Your email (alerts go here) |
| `SMTP_*` | Any SMTP. Gmail: enable App Passwords, use `smtp.gmail.com:587` |
| `SPA_ID` | `example-spa` for demo, or your spa's ID in Supabase |

### 3. Create Supabase schema

1. Open your Supabase project > SQL Editor
2. Paste contents of `supabase/schema.sql`
3. Run it

### 4. Seed the demo spa config

```bash
node scripts/seed-demo-spa.js
```

### 5. Test locally (no Twilio needed)

```bash
node test/simulate.js
```

Type messages as the customer. You should see the bot reply as the Example Spa receptionist.

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Vercel will give you a URL like `https://ai-receptionist-whatsapp-bot.vercel.app`.

Your webhook URL is: `https://ai-receptionist-whatsapp-bot.vercel.app/webhook`

Add all `.env` variables to Vercel: `vercel env add VARIABLE_NAME`

---

## Wire up Twilio sandbox

1. Go to console.twilio.com > Messaging > Try it out > Send a WhatsApp message
2. Follow the sandbox join instructions (send the join code from your phone)
3. Under Sandbox settings, set **"When a message comes in"** to your webhook URL:
   `https://your-vercel-url.vercel.app/webhook`
4. Method: HTTP POST
5. Save

Now text the Twilio sandbox number from your phone. The bot replies.

---

## Wire up a real Meta WhatsApp Business number (production)

1. Go to developers.facebook.com > your app > WhatsApp > Configuration
2. Set webhook URL: `https://your-vercel-url.vercel.app/webhook`
3. Verify token: any string you choose (add as `WHATSAPP_VERIFY_TOKEN` to .env — see note below)
4. Subscribe to: `messages`

> **Note:** Meta's webhook uses a GET verification step. Add a `GET` handler to `api/webhook.js` that responds to Meta's `hub.challenge` if you need it. For Twilio demo, this isn't needed.

---

## Onboarding a new client (production)

1. Create a new row in `spa_configs` with the client's config (copy `example-spa-spa-config.js` structure, fill real data)
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
