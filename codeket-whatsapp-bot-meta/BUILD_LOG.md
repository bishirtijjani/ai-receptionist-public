# AI Receptionist WhatsApp AI Receptionist — Complete Build & Deployment Log

**Product:** AI Receptionist WhatsApp AI Receptionist for Med Spas  
**Demo Spa:** Example Spa (Austin, TX)  
**Stack:** Node.js · Vercel Serverless · Supabase (Postgres) · Twilio · Anthropic Claude Haiku  
**Status:** ✅ Live and working on WhatsApp

---

## What This Is

A WhatsApp AI receptionist that handles inbound customer messages for a med spa. It answers service and pricing questions, collects booking intent, and hands off to a human when the situation calls for it — all running 24/7 with no human needed in the loop unless it explicitly escalates.

**Revenue model:** $1,497 setup + $297/mo per spa client.

---

## Project Roadmap

| # | Item | Status |
|---|------|--------|
| 1 | Project scaffolded (Node.js, ES Modules, Vercel) | ✅ Done |
| 2 | Supabase schema created (5 tables) | ✅ Done |
| 3 | Demo spa config built (Example Spa) | ✅ Done |
| 4 | Claude Haiku integration with handoff signal parsing | ✅ Done |
| 5 | System prompt with dynamic spa context injection | ✅ Done |
| 6 | Supabase conversation state (get/create, history) | ✅ Done |
| 7 | Twilio webhook handler (`api/webhook.js`) | ✅ Done |
| 8 | Handoff flow (DB logging + email alert) | ✅ Done |
| 9 | Vercel deployment live | ✅ Done |
| 10 | Twilio sandbox webhook configured and receiving messages | ✅ Done |
| 11 | Bug fixed: foreign key constraint (seed script) | ✅ Done |
| 12 | Bug fixed: invalid Anthropic API key in Vercel | ✅ Done |
| 13 | Bot live and working end-to-end on WhatsApp | ✅ Done |
| 14 | Re-enable Twilio signature validation | ❌ Not done |
| 15 | SMTP credentials set up (handoff email delivery) | ✅ Done |
| 16 | Calendly integration (`CALENDLY_API_TOKEN`) | ❌ Not done |
| 17 | Move to dedicated Twilio number (non-sandbox) | ❌ Not done |
| 18 | Record Loom demo | ❌ Not done |
| 19 | Build 200-prospect outreach list | ❌ Not done |

---

## Architecture Overview

```
Customer WhatsApp message
        │
        ▼
  Twilio (receives SMS/WhatsApp)
        │  POST /api/webhook
        ▼
  Vercel Serverless Function (api/webhook.js)
        │
        ├── Supabase: get or create conversation
        ├── Supabase: load message history (last 20 msgs)
        ├── Anthropic Claude Haiku: generate reply
        ├── Supabase: save user + assistant messages
        ├── Handoff email (nodemailer) if escalation triggered
        └── Twilio REST API: send reply back to customer
```

**Supabase tables:** `spa_configs`, `conversations`, `messages`, `handoffs`, `bookings`

---

## Prerequisites

Before starting, you need accounts and API keys for:

- [Vercel](https://vercel.com) — free tier works
- [Supabase](https://supabase.com) — free tier works
- [Twilio](https://twilio.com) — free trial with sandbox number
- [Anthropic](https://console.anthropic.com) — pay-as-you-go (Claude Haiku is very cheap)
- Node.js >= 18 installed locally
- Vercel CLI: `npm install -g vercel`

---

## Project Structure

```
ai-receptionist-whatsapp-bot/
├── api/
│   └── webhook.js           # Vercel serverless function (entry point)
├── lib/
│   ├── anthropic.js         # Claude Haiku call + handoff signal parser
│   ├── supabase.js          # All database operations
│   ├── twilio.js            # Send messages, parse webhooks, validate sigs
│   ├── handoff.js           # Handoff email via nodemailer
│   └── system-prompt.js     # Builds Claude's system prompt from spa config
├── demo/
│   └── example-spa-spa-config.js   # Bundled demo spa config (no DB lookup needed)
├── scripts/
│   └── seed-demo-spa.js     # Seeds the demo spa row into Supabase
├── .env                     # Local credentials (never commit)
├── package.json
└── vercel.json              # Vercel routing config
```

---

## Step 1: Clone and Install

```bash
git clone <your-repo>
cd ai-receptionist-whatsapp-bot
npm install
```

**`package.json`** (key parts):

```json
{
  "name": "ai-receptionist-whatsapp-bot",
  "version": "1.0.0",
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": {
    "dev": "vercel dev",
    "test": "node test/simulate.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "@supabase/supabase-js": "^2.43.0",
    "twilio": "^5.2.0",
    "nodemailer": "^6.9.13",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "vercel": "^34.0.0"
  }
}
```

> **Important:** `"type": "module"` means all files use ES Module syntax (`import`/`export`). Every file must use `.js` extensions on imports and cannot use `require()`.

---

## Step 2: Create the Supabase Database

Go to [supabase.com](https://supabase.com), create a project, then open the SQL editor and run this schema:

```sql
-- Spa configurations (one row per client spa)
create table spa_configs (
  id          text primary key,
  name        text not null,
  config      jsonb not null,
  active      boolean default true,
  created_at  timestamptz default now()
);

-- One conversation per (spa, phone number) pair
create table conversations (
  id          uuid primary key default gen_random_uuid(),
  spa_id      text references spa_configs(id),
  phone       text not null,
  status      text default 'active',  -- 'active' | 'handed_off' | 'closed'
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Full message history for each conversation
create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references conversations(id),
  role             text not null,   -- 'user' | 'assistant'
  content          text not null,
  created_at       timestamptz default now()
);

-- Handoff events (when bot escalates to human)
create table handoffs (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references conversations(id),
  reason           text,
  urgency          text default 'normal',  -- 'normal' | 'high'
  notified         boolean default false,
  created_at       timestamptz default now()
);

-- Pending and confirmed bookings
create table bookings (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid references conversations(id),
  spa_id              text references spa_configs(id),
  service             text,
  preferred_datetime  text,
  status              text default 'pending',  -- 'pending' | 'confirmed'
  calendly_event_uri  text,
  created_at          timestamptz default now()
);
```

After running the schema, collect these values from Supabase:
- **Project URL** (e.g. `https://abcxyz.supabase.co`) — Settings → API
- **Service Role Key** (the `service_role` key, not `anon`) — Settings → API → Project API keys

> Use the **service role key** (not the anon key). It bypasses Row Level Security, which is what you want for a server-side bot.

---

## Step 3: Set Up Twilio

1. Sign up at [twilio.com](https://twilio.com)
2. Go to **Messaging → Try it out → Send a WhatsApp message**
3. This gives you the **Twilio WhatsApp Sandbox** — a shared number (`+1 415 523 8886`) customers join by sending a specific join code
4. Collect these values from the Twilio console:
   - **Account SID** — starts with `AC`
   - **Auth Token** — visible on the main console page
   - **WhatsApp sandbox number** — `whatsapp:+14155238886`

The webhook URL (configured in Step 7 after deploying) will be: `https://<your-vercel-url>/api/webhook`

---

## Step 4: Get Your Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Navigate to **API Keys**
3. Click **Create Key**, give it a name, copy it immediately (shown once)
4. The key starts with `sk-ant-api03-`

> **Important:** If your key ever returns a 401 `authentication_error` in logs, it's invalid. Generate a fresh one. This was the main bug we hit in deployment.

---

## Step 5: Configure Environment Variables

Create a `.env` file in the project root (never commit this):

```env
# ─── Anthropic ───────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY_HERE

# ─── Supabase ────────────────────────────────────────────────────
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...YOUR_KEY...

# ─── Twilio ──────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# ─── Calendly (optional, set when ready) ─────────────────────────
CALENDLY_API_TOKEN=FILL_IN

# ─── Handoff notifications ───────────────────────────────────────
HANDOFF_EMAIL_TO=your@email.com
HANDOFF_EMAIL_FROM=noreply@yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=FILL_IN
SMTP_PASS=FILL_IN

# ─── Demo mode ───────────────────────────────────────────────────
SPA_ID=example-spa
NODE_ENV=development
```

---

## Step 6: Seed the Demo Spa into Supabase

The `conversations` table has a foreign key to `spa_configs`. If you try to create a conversation for spa `"example-spa"` before that row exists, you'll get:

```
insert or update on table "conversations" violates foreign key constraint "conversations_spa_id_fkey"
```

Fix: run the seed script once:

```bash
node scripts/seed-demo-spa.js
```

This inserts the `example-spa` row (or upserts it if it already exists). You should see:

```
Seeded spa config: Example Spa (id: example-spa)
```

**`scripts/seed-demo-spa.js`:**

```js
import { createClient } from "@supabase/supabase-js";
import { example-spaSpaConfig } from "../demo/example-spa-spa-config.js";
import { config } from "dotenv";

config(); // load .env

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seed() {
  const { error } = await supabase
    .from("spa_configs")
    .upsert(
      {
        id: example-spaSpaConfig.id,
        name: example-spaSpaConfig.name,
        config: example-spaSpaConfig,
        active: true,
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }

  console.log(`Seeded spa config: ${example-spaSpaConfig.name} (id: ${example-spaSpaConfig.id})`);
}

seed();
```

---

## Step 7: Deploy to Vercel

### 7a. Link to Vercel

```bash
vercel login
vercel link     # link to your Vercel project (or create new)
```

### 7b. Add Environment Variables

The Vercel CLI's interactive `env add` prompt can be unreliable in some terminals (PowerShell, Windows). The most reliable method is the **Vercel web dashboard**:

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project → **Settings** → **Environment Variables**
3. Add every key from your `.env` file
4. Set environment to **Production** (and optionally Preview/Development)
5. Click **Save** for each one

For each variable, add: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`, `HANDOFF_EMAIL_TO`, `HANDOFF_EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SPA_ID`, `NODE_ENV` (set to `production`).

### 7c. Deploy

```bash
vercel --prod
```

Vercel will output your deployment URL, e.g.:  
`https://ai-receptionist-whatsapp-bot.vercel.app`

Your webhook endpoint is: `https://ai-receptionist-whatsapp-bot.vercel.app/api/webhook`

### 7d. Configure Twilio Webhook

In the Twilio console:
1. Go to **Messaging → Settings → WhatsApp Sandbox Settings**
2. Set **"When a message comes in"** to your webhook URL:  
   `https://ai-receptionist-whatsapp-bot.vercel.app/api/webhook`
3. Method: `HTTP POST`
4. Save

---

## Step 8: Test the Bot

1. On your phone, send the sandbox join code to the Twilio WhatsApp number (`+1 415 523 8886`)  
   Example: `join <your-sandbox-code>` (shown in the Twilio console)
2. Once joined, send any message to that same number
3. The bot should reply within 2-3 seconds

**If there's no reply, check Vercel logs:**
- Vercel Dashboard → your project → **Deployments** → latest deployment → **Functions** tab → `api/webhook`

Common errors and fixes:

| Error | Cause | Fix |
|-------|-------|-----|
| `401 authentication_error` | Anthropic key invalid or not set in Vercel | Generate a new key at console.anthropic.com, update in Vercel dashboard, redeploy |
| `conversations_spa_id_fkey` | `spa_configs` row missing | Run `node scripts/seed-demo-spa.js` |
| No logs at all | Webhook URL not set in Twilio | Update Twilio sandbox settings with correct URL |
| `Cannot find module` | Wrong import path or missing `.js` extension | Check all imports include `.js` extension (required for ES Modules) |

---

## Core File Reference

### `api/webhook.js` — Main entry point

The Vercel serverless function. Called by Twilio on every inbound message.

```js
export default async function handler(req, res) {
  // 1. Parse the Twilio POST body
  const { from, body: customerMessage } = parseTwilioWebhook(rawBody);

  // 2. Load spa config (bundled for demo, from Supabase for real clients)
  const spaConfig = spaId === "example-spa" ? example-spaSpaConfig : await getSpaConfig(spaId);

  // 3. Get or create conversation row in Supabase
  const conversation = await getOrCreateConversation(spaId, normalizePhone(from));

  // 4. Load last 20 messages for context
  const history = await getHistory(conversation.id, 20);

  // 5. Call Claude Haiku
  const { reply, handoff } = await getReply(spaConfig, history, customerMessage);

  // 6. Save both messages to DB
  await saveMessage(conversation.id, "user", customerMessage);
  await saveMessage(conversation.id, "assistant", reply);

  // 7. If handoff triggered, email the spa owner
  if (handoff) await handleHandoff({ ... });

  // 8. Send reply back via Twilio REST API
  await sendWhatsAppMessage(from, reply);

  // 9. Return 200 with empty TwiML (Twilio requires this)
  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send("<?xml version='1.0'?><Response/>");
}
```

> **Note:** Twilio signature validation is currently disabled (`if (false && !isDev)` on line 44). Re-enable this before going to production with a real client.

---

### `lib/anthropic.js` — Claude integration

Calls Claude Haiku with the full system prompt and conversation history. Parses the `HANDOFF_HUMAN(...)` signal from the raw response before returning the cleaned reply.

```js
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 512;

export async function getReply(spaConfig, history, newMessage) {
  const systemPrompt = buildSystemPrompt(spaConfig);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [...history, { role: "user", content: newMessage }],
  });

  const rawText = response.content[0]?.text ?? "";
  const handoff = parseHandoff(rawText);                    // extract signal
  const reply = rawText.replace(/HANDOFF_HUMAN\(.*?\)/g, "").trim(); // strip from reply

  return { reply, handoff };
}
```

---

### `lib/system-prompt.js` — Claude's instructions

Dynamically builds Claude's system prompt from the spa config object. Key sections:

- **Core facts** — name, address, phone, website, hours
- **Services** — every service with exact price and duration
- **Policies** — deposits, cancellations, payment methods
- **Behavioral rules** — what to say, what never to say, tone guidelines
- **HANDOFF_HUMAN trigger conditions** — medical questions, complaints, explicit human requests, discount asks, 3+ unresolved exchanges
- **Few-shot examples** — 5 example conversations demonstrating ideal behavior

The handoff signal format Claude must emit:
```
HANDOFF_HUMAN(reason: [short reason], urgency: [normal|high])
```

---

### `lib/handoff.js` — Human escalation

When Claude emits a `HANDOFF_HUMAN` signal:
1. Logs the event to the `handoffs` table
2. Sends an email alert to the spa owner via nodemailer/SMTP
3. Updates the conversation status to `handed_off`

Email is best-effort — a failure logs to console but does not crash the webhook or prevent the reply from sending.

---

### `demo/example-spa-spa-config.js` — Demo spa config

A complete, hardcoded spa config for "Example Spa" used for demos. Includes all 9 services with exact pricing, team members, hours, and policies. In production, each real client's config lives in the `spa_configs` Supabase table and is loaded dynamically.

---

## Bugs We Hit and How We Fixed Them

### Bug 1: Foreign key constraint error on first message

**Error:**
```
insert or update on table "conversations" violates foreign key constraint "conversations_spa_id_fkey"
```

**Cause:** The `conversations` table references `spa_configs(id)`, but the `example-spa` row had never been inserted into `spa_configs`.

**Fix:** Run `node scripts/seed-demo-spa.js` once to insert the demo spa row.

---

### Bug 2: Anthropic 401 — invalid API key in Vercel

**Error in Vercel logs:**
```
AuthenticationError: 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}
```

**Cause:** The Anthropic API key that was added to Vercel's environment variables was invalid or had been rotated.

**How to diagnose:** Check Vercel logs after a test message. If you see `401` from Anthropic, the key is the problem.

**Fix:**
1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys
2. Create a new key
3. Test it locally first:
   ```js
   // test-key.js
   import Anthropic from "@anthropic-ai/sdk";
   const client = new Anthropic({ apiKey: "sk-ant-api03-YOUR_KEY" });
   const r = await client.messages.create({
     model: "claude-haiku-4-5",
     max_tokens: 10,
     messages: [{ role: "user", content: "Hi" }],
   });
   console.log(r.content[0].text); // should print something
   ```
   Run with: `node --input-type=module < test-key.js`
4. Once confirmed working, update it in the Vercel dashboard under Settings → Environment Variables
5. Redeploy: `vercel --prod`

---

### Bug 3: `vercel env add` not accepting pasted values in PowerShell

**Symptom:**
```
? What's the value of ANTHROPIC_API_KEY? WARNING! Value is empty.
```

**Cause:** PowerShell's interactive stdin handling doesn't pipe values correctly to the Vercel CLI prompt.

**Fix:** Skip the CLI entirely. Set all environment variables manually through the Vercel web dashboard (Settings → Environment Variables). This is more reliable across all operating systems.

---

### Bug 4: ES Module import errors

**Symptom:** `Cannot find module` or `ERR_MODULE_NOT_FOUND` at runtime.

**Cause:** With `"type": "module"` in `package.json`, Node.js requires explicit `.js` extensions on all relative imports. Omitting them works in CommonJS but breaks in ESM.

**Fix:** All imports must include the extension:
```js
// ✅ correct
import { getReply } from "../lib/anthropic.js";

// ❌ breaks in ESM
import { getReply } from "../lib/anthropic";
```

---

## What's Working (Confirmed in Production)

From live WhatsApp testing, the bot correctly handles:

- **Booking inquiries** — greets warmly, asks what service, guides toward booking
- **Pricing questions** — lists all services with exact prices (no hallucination)
- **Self-identification** — "I'm the AI assistant for Example Spa..."
- **Human handoff** — detects when customer demands a person, emits HANDOFF signal, sends clean reply ("Someone will be in touch shortly on this WhatsApp")
- **Multi-turn conversations** — maintains context across the full conversation via Supabase message history
- **Personality** — matches customer energy, no corporate filler phrases

---

## Remaining TODOs

| Item | Status | Notes |
|------|--------|-------|
| Re-enable Twilio signature validation | ❌ Not done | Remove `if (false && !isDev)` in `api/webhook.js` line 44 |
| Set up SMTP credentials | ❌ Not done | Add `SMTP_USER` and `SMTP_PASS` to Vercel env vars (Gmail app password works) |
| Set up Calendly integration | ❌ Not done | Get token, set `CALENDLY_API_TOKEN` in Vercel |
| Move to dedicated Twilio number | ❌ Not done | Sandbox is shared; production clients need their own number |
| Record Loom demo | ❌ Not done | Use existing WhatsApp screenshots as the walkthrough base |
| Build 200-prospect outreach list | ❌ Not done | Target: med spas, aesthetic clinics, dermatology practices |

---

## Deploying for a Real Client (Non-Demo)

When you sign a real client:

1. Add their spa config to Supabase:
   ```js
   await supabase.from("spa_configs").insert({
     id: "client-spa-id",
     name: "Their Spa Name",
     config: { /* their full config object */ },
     active: true,
   });
   ```

2. Set `SPA_ID=client-spa-id` in Vercel environment variables (or create a separate Vercel project per client)

3. Set up a dedicated Twilio WhatsApp number for them (paid Twilio account required — not the sandbox)

4. Point Twilio's webhook to your Vercel deployment URL

5. Re-enable Twilio signature validation in `api/webhook.js`

6. Set up SMTP so handoff emails actually deliver

---

## Key Credentials Reference (for this project)

| Service | Where to find | Notes |
|---------|--------------|-------|
| Anthropic API key | console.anthropic.com → API Keys | Starts with `sk-ant-api03-` |
| Supabase URL + Service Role Key | Supabase Dashboard → Settings → API | Use service_role, not anon |
| Twilio SID + Auth Token | twilio.com → Console home | SID starts with `AC` |
| Twilio sandbox number | twilio.com → Messaging → Try it out | `whatsapp:+14155238886` |
| Vercel project settings | vercel.com → project → Settings | Env vars, domains, logs |

---

*Built by AI Receptionist. This document covers everything from a blank terminal to a live, working WhatsApp AI receptionist.*
