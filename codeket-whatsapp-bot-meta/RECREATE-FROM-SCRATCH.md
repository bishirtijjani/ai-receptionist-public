# AI Receptionist WhatsApp Demo Bot (Meta Cloud API) — Full Recreate-From-Scratch Guide

This document captures **everything** done to build and deploy AI Receptionist's own WhatsApp AI
receptionist demo bot on the **Meta WhatsApp Cloud API**, so that anyone (you, me, or a teammate)
can rebuild it from zero. It includes the code, every manual dashboard step, the exact
identifiers used, and the real-world snags we hit and how we solved them.

> **Scope note.** This is the **demo** bot (Meta Cloud API transport, free service messaging,
> number swapping). It lives in `ai-receptionist-whatsapp-bot-meta/`. The original **Twilio** bot in
> `../ai-receptionist-whatsapp-bot/` is left untouched and is intended for **paid client** deploys
> (Twilio is easier for per-client number provisioning). Same brain, two transports.

---

## 0. End state (what "done" looks like)

- A Meta app ("AI Receptionist Demo Bot") with the WhatsApp product, a **real registered number**
  (+234 912 197 0951, status **Connected**), a **permanent** access token, and the app secret.
- Bot code deployed to **Vercel** as a serverless function at `/webhook`.
- Meta webhook pointed at the Vercel URL, verified, and **subscribed to the `messages` field**.
- A **payment method** on the WhatsApp Business Account (Meta requires one even though
  customer-initiated *service* replies are free).
- App switched to **Live** so production webhooks are delivered.
- Texting the number → bot replies as "Example Spa", with human-handoff email alerts.

### Key identifiers (non-secret) used in this build

| Thing | Value |
|---|---|
| Meta App name / ID | `AI Receptionist Demo Bot` / `1176484317944184` |
| Business portfolio ID | `708984348720023` |
| WhatsApp Business Account (WABA) ID — real number | `3013077042367871` |
| Phone Number ID — real number | `1112015095335390` |
| Registered display number | `+234 912 197 0951` (wa_id `2349121970951`) |
| Free test number (auto-provisioned) | `+1 555 635-3698` — Phone Number ID `1224471777407239`, WABA `1002801805481711` |
| Webhook verify token | `ai-receptionist_verify_6fd7674031b253dff2ba391306eea310` |
| Graph API version | `v23.0` |
| Vercel team / project | `bitmo24-gmailcoms-projects` / `ai-receptionist-whatsapp-bot-meta` |
| Production base URL | `https://ai-receptionist-whatsapp-bot-meta.vercel.app` |
| Webhook URL | `https://ai-receptionist-whatsapp-bot-meta.vercel.app/webhook` |

### Secrets (NOT stored in this doc — they live in `.env` and Vercel env vars)
`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`,
`SMTP_PASS`. If recreating, regenerate these from their source consoles (see steps below).
**If these ever leak (e.g. pasted into chat), rotate them in Meta / Anthropic / Supabase / Gmail.**

---

## 1. Architecture

```
Customer WhatsApp message
        │
        ▼
  Meta WhatsApp Cloud API  ──GET (one-time webhook verify: hub.challenge)──►  /webhook
        │  POST (inbound message JSON, signed with X-Hub-Signature-256)
        ▼
  Vercel Serverless Function (api/webhook.js)
        ├── Validate X-Hub-Signature-256 against WHATSAPP_APP_SECRET (prod only)
        ├── Parse Meta JSON envelope -> { from, body }  (status callbacks ignored)
        ├── Supabase: get/create conversation + load last 20 messages
        ├── Anthropic Claude Haiku: generate reply (system prompt built from spa config)
        ├── Supabase: save user + assistant messages
        ├── Handoff email (nodemailer/SMTP) if Claude emits HANDOFF_HUMAN(...)
        └── Graph API POST /{PHONE_NUMBER_ID}/messages: send reply (Bearer ACCESS_TOKEN)
```

Stack: **Node 18+ (ES Modules) · Vercel serverless · Supabase (Postgres) · Anthropic Claude
Haiku · Meta WhatsApp Cloud API**. No SDK for WhatsApp — native `fetch`.

Cost: customer-initiated **service** conversations are free/unlimited (Meta removed the 1,000/mo
cap Nov 2024). Only proactive **template** messages cost money; this bot never sends them.
Anthropic Haiku is ~\$2-5/mo at volume; Supabase/Vercel free tier. ~97% margin at \$297/mo.

---

## 2. Prerequisites (accounts + tools)

- Facebook account + a **Meta Business portfolio** (business.facebook.com).
- A **real phone number** NOT currently on any WhatsApp account (personal or Business app).
- **Anthropic** API key (console.anthropic.com).
- **Supabase** project (supabase.com).
- **Vercel** account (vercel.com).
- An **SMTP** sender for handoff emails (Gmail App Password works).
- A **payment method** (Visa/Mastercard with international transactions enabled). A USD virtual
  card (e.g. Grey) works; the card's billing country does NOT need to match the account country.
- Local: Node >= 18, and the Vercel CLI (`npm i -g vercel` or use `npx vercel`).

---

## 3. The code

### 3.1 File tree

```
ai-receptionist-whatsapp-bot-meta/
├── api/
│   └── webhook.js          # Meta webhook: GET verify + POST message handler   [META-SPECIFIC]
├── lib/
│   ├── whatsapp.js         # Cloud API transport: send/parse/verify-signature  [META-SPECIFIC]
│   ├── anthropic.js        # Claude Haiku call + HANDOFF parser     (same as Twilio bot)
│   ├── system-prompt.js    # Builds system prompt from spa config   (same as Twilio bot)
│   ├── supabase.js         # Conversation/message/handoff CRUD       (same as Twilio bot)
│   ├── handoff.js          # Handoff email via nodemailer            (same as Twilio bot)
│   └── calendly.js         # Calendly slots/links (coded, NOT wired) (same as Twilio bot)
├── demo/
│   └── example-spa-spa-config.js  # Demo spa "Example Spa"           (same as Twilio bot)
├── scripts/
│   └── seed-demo-spa.js    # Seeds the "example-spa" row into Supabase      (same as Twilio bot)
├── supabase/
│   └── schema.sql          # 5-table schema                          (same as Twilio bot)
├── test/
│   └── simulate.js         # Terminal chat simulator (offline)       (same as Twilio bot)
├── .env.example
├── package.json            # twilio dep removed; native fetch used
├── vercel.json             # routes /webhook -> api/webhook.js
├── SETUP-META.md           # human runbook (real-number path)
├── META-SETUP-PROMPT.md    # prompt for the Claude-in-Chrome agent to do Meta setup
└── RECREATE-FROM-SCRATCH.md (this file)
```

**How it was created:** copy the Twilio bot folder, delete `lib/twilio.js` and
`scripts/configure-sandbox.js`, add `lib/whatsapp.js`, rewrite `api/webhook.js`, drop the
`twilio` dependency from `package.json`, and swap the Twilio env block for the WhatsApp one.
Everything in `lib/` except `twilio.js`/`whatsapp.js` is byte-for-byte identical to the Twilio bot.

### 3.2 The two Meta-specific source files

Below are the **full** contents of the only two files that differ from the Twilio bot. The
rest of the code is the shared "brain" and is documented in `../ai-receptionist-whatsapp-bot/BUILD_LOG.md`.

#### `lib/whatsapp.js`

```js
/**
 * WhatsApp Cloud API transport (Meta Graph API).
 *
 * Replaces the Twilio transport for AI Receptionist's own demo bot.
 * Uses native fetch (Node 18+) — no SDK dependency.
 *
 * Three jobs:
 *   1. sendWhatsAppMessage(to, body)   — send a text reply via Graph API
 *   2. parseWhatsAppWebhook(jsonBody)  — pull the inbound message out of Meta's JSON
 *   3. validateMetaSignature(...)      — verify X-Hub-Signature-256 against the app secret
 *   + verifyWebhookChallenge(query)    — answer Meta's GET subscription handshake
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import crypto from "crypto";

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v23.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

/**
 * Send a WhatsApp text message via the Cloud API.
 *
 * @param {string} to    - Recipient wa_id / E.164 digits, e.g. "14155551234" (no "+", no "whatsapp:" prefix)
 * @param {string} body  - Message text
 * @returns {Promise<string>} the sent message id (wamid...)
 */
export async function sendWhatsAppMessage(to, body) {
  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(to),
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WhatsApp send failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.messages?.[0]?.id ?? "";
}

/**
 * Parse a Meta WhatsApp Cloud API webhook POST body (JSON).
 *
 * Meta sends a deeply nested envelope. Inbound customer texts live at:
 *   entry[0].changes[0].value.messages[0]
 * Status callbacks (sent/delivered/read) arrive on the same webhook but carry
 * `value.statuses` instead of `value.messages` — we return null for those so
 * the webhook can ack them and move on.
 *
 * @param {string|object} rawBody - Raw JSON string or already-parsed object
 * @returns {{ from: string, body: string, messageId: string, profileName: string, phoneNumberId: string }|null}
 */
export function parseWhatsAppWebhook(rawBody) {
  let payload;
  try {
    payload = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  } catch {
    return null;
  }

  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  // No message = status callback or other event. Ignore.
  if (!message) return null;

  // Only handle text messages for the demo. (Images, audio, etc. -> null = ignored.)
  if (message.type !== "text") return null;

  return {
    from: message.from,                                  // "14155551234" (digits, no +)
    body: message.text?.body ?? "",
    messageId: message.id,                               // "wamid..."
    profileName: value?.contacts?.[0]?.profile?.name ?? "",
    phoneNumberId: value?.metadata?.phone_number_id ?? "",
  };
}

/**
 * Answer Meta's webhook verification GET handshake.
 * Meta calls: GET /webhook?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=NNN
 * Return the challenge string iff the mode is "subscribe" and the token matches
 * WHATSAPP_VERIFY_TOKEN. Otherwise return null (respond 403).
 *
 * @param {object} query - Parsed query params
 * @returns {string|null} the challenge to echo, or null if invalid
 */
export function verifyWebhookChallenge(query) {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return challenge ?? "";
  }
  return null;
}

/**
 * Validate Meta's X-Hub-Signature-256 header.
 * Meta signs the raw request body with HMAC-SHA256 using your App Secret.
 * Header format: "sha256=<hex digest>".
 *
 * @param {string} appSecret - process.env.WHATSAPP_APP_SECRET
 * @param {string} signatureHeader - value of "x-hub-signature-256"
 * @param {string} rawBody - the exact raw request body string
 * @returns {boolean}
 */
export function validateMetaSignature(appSecret, signatureHeader, rawBody) {
  if (!appSecret || !signatureHeader) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  // Constant-time compare; guard against length mismatch throwing.
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Normalize a phone value to bare E.164 digits (no "+", no "whatsapp:" prefix).
 * Meta's wa_id is already in this form; this just makes us robust to either input.
 */
export function normalizePhone(value) {
  return String(value).replace(/^whatsapp:/, "").replace(/^\+/, "").replace(/\D/g, "");
}
```

#### `api/webhook.js`

```js
/**
 * Vercel serverless function — WhatsApp Cloud API (Meta) webhook.
 *
 * AI Receptionist's OWN demo bot transport. (The Twilio version lives in
 * ../ai-receptionist-whatsapp-bot and is unchanged — used for paid client deploys.)
 *
 * Meta hits this endpoint two ways:
 *   GET  — one-time subscription handshake. Echo hub.challenge if the token matches.
 *   POST — every inbound message (and status callbacks, which we ignore).
 *
 * POST flow:
 *   1. Validate X-Hub-Signature-256 against the app secret (skipped in dev)
 *   2. Parse Meta's JSON envelope -> { from, body }  (null = status event, ack & exit)
 *   3. Load spa config
 *   4. Get or create conversation
 *   5. Fetch message history
 *   6. Call Claude Haiku
 *   7. Handle HANDOFF signal if present
 *   8. Save messages to Supabase
 *   9. Reply via the Cloud API
 *
 * Always returns 200 quickly so Meta doesn't retry/disable the webhook.
 */

import {
  sendWhatsAppMessage,
  parseWhatsAppWebhook,
  validateMetaSignature,
  verifyWebhookChallenge,
  normalizePhone,
} from "../lib/whatsapp.js";
import { getReply } from "../lib/anthropic.js";
import {
  getSpaConfig,
  getOrCreateConversation,
  getHistory,
  saveMessage,
} from "../lib/supabase.js";
import { handleHandoff } from "../lib/handoff.js";
import { example-spaSpaConfig } from "../demo/example-spa-spa-config.js";

export const config = {
  api: { bodyParser: false }, // raw body needed for X-Hub-Signature-256 validation
};

export default async function handler(req, res) {
  // ── GET: Meta webhook verification handshake ──────────────────
  if (req.method === "GET") {
    const challenge = verifyWebhookChallenge(req.query ?? {});
    if (challenge !== null) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  // ── Only POST past this point ─────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // ── Read raw body ─────────────────────────────────────────────
  const rawBody = await readRawBody(req);

  // ── Validate Meta signature (skip in dev) ─────────────────────
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev) {
    const signature = req.headers["x-hub-signature-256"] ?? "";
    const valid = validateMetaSignature(
      process.env.WHATSAPP_APP_SECRET,
      signature,
      rawBody
    );
    if (!valid) {
      console.warn("Invalid Meta signature — request rejected");
      return res.status(403).send("Forbidden");
    }
  }

  // ── Parse webhook ─────────────────────────────────────────────
  const message = parseWhatsAppWebhook(rawBody);

  // null = status callback (delivered/read) or non-text event. Ack and exit.
  if (!message || !message.from || !message.body?.trim()) {
    return res.status(200).json({ ok: true });
  }

  const { from, body: customerMessage } = message;
  console.log(`[webhook] ${from}: ${customerMessage}`);

  try {
    // ── Load spa config ─────────────────────────────────────────
    const spaId = process.env.SPA_ID ?? "example-spa";
    const spaConfig = spaId === "example-spa" ? example-spaSpaConfig : await getSpaConfig(spaId);

    // ── Conversation state ──────────────────────────────────────
    const conversation = await getOrCreateConversation(spaId, normalizePhone(from));
    const history = await getHistory(conversation.id, 20);

    // ── LLM call ────────────────────────────────────────────────
    const { reply, handoff } = await getReply(spaConfig, history, customerMessage);

    // ── Persist messages ────────────────────────────────────────
    await saveMessage(conversation.id, "user", customerMessage);
    await saveMessage(conversation.id, "assistant", reply);

    // ── Handoff ─────────────────────────────────────────────────
    if (handoff) {
      await handleHandoff({
        conversationId: conversation.id,
        customerPhone: normalizePhone(from),
        reason: handoff.reason,
        urgency: handoff.urgency,
        lastCustomerMessage: customerMessage,
        spaConfig,
      });
    }

    // ── Send reply ──────────────────────────────────────────────
    await sendWhatsAppMessage(from, reply);
    console.log(`[webhook] replied to ${from}: ${reply.slice(0, 80)}...`);
  } catch (err) {
    console.error("[webhook] error:", err);
    // Don't surface errors to Meta — just ack so it doesn't retry-storm.
  }

  return res.status(200).json({ ok: true });
}

// ─── Helpers ─────────────────────────────────────────────────────

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
```

### 3.3 `package.json` and `.env.example`

`package.json`: `"type": "module"`, Node >= 18, deps = `@anthropic-ai/sdk`,
`@supabase/supabase-js`, `nodemailer`, `dotenv` (NO `twilio`). Scripts: `dev` (`vercel dev`),
`seed` (`node scripts/seed-demo-spa.js`), `test` (`node test/simulate.js`).

`.env` keys (see `.env.example` for the template):

```
ANTHROPIC_API_KEY=            # console.anthropic.com
SUPABASE_URL=                 # Supabase > Settings > API
SUPABASE_SERVICE_ROLE_KEY=    # Supabase > Settings > API (service_role, NOT anon)
WHATSAPP_PHONE_NUMBER_ID=     # Meta app > WhatsApp > API Setup
WHATSAPP_ACCESS_TOKEN=        # Permanent System User token (see step 6)
WHATSAPP_APP_SECRET=          # Meta app > App settings > Basic
WHATSAPP_VERIFY_TOKEN=        # any random string YOU choose (reused in webhook config)
WHATSAPP_API_VERSION=v23.0
HANDOFF_EMAIL_TO=             # where handoff alerts go
HANDOFF_EMAIL_FROM=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=                    # Gmail App Password
SPA_ID=example-spa                   # uses the bundled demo config
NODE_ENV=development          # locally; Vercel auto-sets production (do NOT add to Vercel)
```

> `WHATSAPP_BUSINESS_ACCOUNT_ID` is handy to record but is not read by the code.

---

## 4. Supabase

1. Create a Supabase project (or reuse the Twilio bot's — the schema and the `example-spa` demo row
   are identical, so sharing one project is fine).
2. SQL Editor → paste and run `supabase/schema.sql` (creates 5 tables: `spa_configs`,
   `conversations`, `messages`, `handoffs`, `bookings`).
3. Collect `SUPABASE_URL` and the **service_role** key (Settings → API) into `.env`.
4. Seed the demo spa (creates the `example-spa` row that `conversations` foreign-keys to):
   ```bash
   npm install
   npm run seed     # -> "Seeded spa config: Example Spa (id: example-spa)"
   ```
   Skipping this causes `conversations_spa_id_fkey` foreign-key errors on first message.

---

## 5. Deploy to Vercel

> **Important:** the deploy must run from a machine that can reach Vercel's API. (Our sandbox is
> network-isolated from vercel.com, and you cannot upload a local folder to Vercel through the
> browser — deploys come from the CLI or Git.) So run this in your own terminal:

```bash
cd ai-receptionist-whatsapp-bot-meta
npm install
npx vercel login      # one-time browser auth
npx vercel --prod     # accept defaults: project name ai-receptionist-whatsapp-bot-meta, dir ./
```

It prints a production URL + an alias like `https://ai-receptionist-whatsapp-bot-meta.vercel.app`.
The webhook endpoint is that base + `/webhook`. The first deploy will run before env vars exist
(function will error at runtime) — that's expected; add env vars next, then redeploy.

`vercel.json` routes `/webhook` to `api/webhook.js` and sets `maxDuration: 30`.

---

## 6. Vercel environment variables

In the Vercel dashboard → Project → **Settings → Environment Variables**:

- Click **Add Environment Variable**. The modal supports **pasting a whole `.env` block into the
  Key field** — it auto-splits into individual rows. Paste all 15 keys (everything from your
  `.env` EXCEPT `NODE_ENV`, which Vercel sets to `production` automatically, and the optional
  `WHATSAPP_BUSINESS_ACCOUNT_ID`). Leave Environment = **Production and Preview**. Save.
- Because `NODE_ENV=production` in prod, the webhook **signature check is active** — so
  `WHATSAPP_APP_SECRET` must be correct.
- After saving, click **Redeploy** (the toast offers it) so the vars take effect.

---

## 7. Meta: app, number, permanent token, app secret

1. **Create the app.** developers.facebook.com → My Apps → Create App → use case **Other** →
   type **Business** → name `AI Receptionist Demo Bot` → link your business portfolio. Add the
   **WhatsApp** product.
2. **Register the real number.** WhatsApp → API Setup → **Add phone number** → display name +
   the real number → verify via the **SMS/voice OTP** (you must read this off the phone — no tool
   can). Record the **Phone Number ID** and **WABA ID**.
   - Confirm status is **Connected** under WhatsApp Manager → Account tools → Phone numbers.
3. **Permanent access token** (the API-Setup token is only 24h):
   business.facebook.com → Business Settings → Users → **System Users** → add `ai-receptionist-bot`
   (Admin) → **Assign assets**: the app (Full control) + the WhatsApp account (Full control) →
   **Generate new token** → expiration **Never** → scopes `whatsapp_business_messaging` +
   `whatsapp_business_management` → copy into `WHATSAPP_ACCESS_TOKEN`.
   > If a token returns 401/190 from Graph API, it's expired/invalid or missing scopes.
4. **App secret.** App settings → **Basic** → App Secret → **Show** (re-enter password) → copy
   into `WHATSAPP_APP_SECRET`.

---

## 8. Meta: webhook configuration

The new WhatsApp dashboard does NOT show a "Configuration" page under WhatsApp. Use the
top-level **Webhooks** product instead:

1. Left sidebar (Products) → **Webhooks**.
2. **Select product** dropdown → **WhatsApp Business Account** (it's a custom dropdown; click to
   open, then click the option).
3. **Callback URL** = `https://<your-vercel-url>/webhook`
   **Verify token** = your `WHATSAPP_VERIFY_TOKEN` (we used
   `ai-receptionist_verify_6fd7674031b253dff2ba391306eea310`).
4. Click **Verify and save**. Meta sends a GET handshake to `/webhook`; our `verifyWebhookChallenge`
   echoes `hub.challenge` when the token matches → verification passes.
5. In the **Webhook fields** table that appears, toggle **Subscribe** on the **`messages`** row.
   (Leave the rest unsubscribed.)
6. **Critical extra step — subscribe the WABA itself to the app.** Configuring the app-level
   webhook (steps 1-5) is NOT enough; the specific WhatsApp Business Account must separately be
   subscribed to receive events from this app via the `/subscribed_apps` edge. Without this, Meta
   verifies the webhook fine but never sends `messages` POSTs — Vercel logs stay completely empty.
   - Go to the **Graph API Explorer** (developers.facebook.com/tools/explorer/).
   - Select **AI Receptionist Demo Bot** as the Meta App.
   - Paste your permanent `WHATSAPP_ACCESS_TOKEN` into the **Access Token** field.
   - Set the path to `<WABA_ID>/subscribed_apps` (e.g. `3013077042367871/subscribed_apps`).
   - First do a **GET** — if `data: []` (empty), it's not subscribed.
   - Switch the method to **POST** and **Submit**. A `{"success": true}` response means it's
     fixed. Re-run the GET to confirm `whatsapp_business_api_data` now lists your app.

**Smoke test the endpoint** (no phone needed) by opening this in a browser — it should print the
challenge string back:
```
https://<your-vercel-url>/webhook?hub.mode=subscribe&hub.verify_token=<VERIFY_TOKEN>&hub.challenge=handshake_ok_42
```

---

## 9. Meta: payment method (required)

Even though customer-initiated **service** replies are free, Meta requires a payment method on
file before your number can **send** anything. WhatsApp Manager → there will be a "Missing valid
payment method" banner → **Add payment method** (opens the "Add payment information" modal).

- **Select location and currency** is **permanent**. The currency defaults to a random value
  (we saw "Argentine Peso") — change it deliberately. For a USD card, choose **USD** to avoid FX
  conversion. Country/region = your business location (Nigeria). The **card's billing country does
  not have to match** the account country; the card just needs international transactions enabled.
- Enter the card and save. (This is a financial action — do it yourself; don't delegate it.)

---

## 10. Meta: switch the app to Live

In Development mode, Meta may not deliver production webhook events ("No production data … will
be delivered unless the app has been published"). So the inbound message may never reach Vercel
until the app is Live.

1. Top bar of any app page: `App Mode: Development ⚪ Live` → click the **toggle** to **Live**.
2. If prompted for a **Privacy Policy URL** (Business apps usually require one), App settings →
   Basic → paste your privacy page URL (e.g. `https://ai-receptionist.com/privacy`) → Save → toggle again.
   No App Review is needed just to message your own number.

---

## 11. Test & verify

1. **Offline brain test** (no WhatsApp needed): `npm run test` (or `node test/simulate.js`) →
   type customer messages, confirm Claude replies as Example Spa and that a medical
   question triggers `[HANDOFF TRIGGERED]`.
2. **Live test:**
   - A freshly Connected number can take ~15-60 min to be reachable from personal WhatsApp; until
     then a `wa.me` link says "not on WhatsApp." Save the number as a contact, fully restart
     WhatsApp, then retry.
   - Text the number (e.g. "Hi, do you do lip filler? how much?"). The bot should reply in a
     couple seconds. Send a medical question ("is microneedling safe for my melasma?") to confirm
     the human-handoff email fires.
3. **Logs:** Vercel → Deployments → latest → Functions → `api/webhook` shows `[webhook] <from>: …`
   inbound lines and any Graph API send errors (e.g. payment-method or token problems).

`wa.me` link for the number: `https://wa.me/2349121970951`
(prefilled: `https://wa.me/2349121970951?text=<url-encoded message>`).

---

## 12. Gotchas & lessons learned (the real snags we hit)

- **Sandbox can't reach Vercel/Meta.** Network is allowlisted; `vercel.com` and
  `graph.facebook.com` were unreachable from the build sandbox. Deploy + any Graph API calls must
  run on a connected machine (or the browser). npm in the sandbox was also flaky/slow.
- **Webhook config moved.** It's NOT under "WhatsApp → Configuration" in the current UI; use the
  top-level **Webhooks** product → object **WhatsApp Business Account**.
- **Token lifetime.** The token shown on API Setup is **24h**. Use a **permanent System User
  token** or the bot dies the next day.
- **`NODE_ENV` on Vercel.** Don't add it — Vercel forces `production`. This is what (correctly)
  turns the signature check on, so `WHATSAPP_APP_SECRET` must be set.
- **Payment method required.** "Free service conversations" still need a card on file to send.
- **Currency is permanent.** Pick it deliberately (USD for a USD card). Defaults to a random one.
- **"Not on WhatsApp" right after connecting** = propagation delay, not a misconfig. The number
  showed **Connected** in WhatsApp Manager; reachability lagged. Wait, save contact, restart app.
- **Development mode may block production webhooks** → switch to **Live** (may need a privacy URL).
- **Mounted-folder deletes** were blocked ("Operation not permitted"); had to grant file-delete to
  remove `lib/twilio.js` from the copy.
- **Calendly is coded but not wired** (`lib/calendly.js`). The bot quotes plausible times from the
  LLM; it does not yet write real bookings. Future work to wire it into `webhook.js`.
- **Signature validation** runs only when `NODE_ENV==='production'` (skipped in dev) — see the
  `isDev` check in `api/webhook.js`.
- **WABA not subscribed to the app = silent failure.** Even with the app-level webhook configured
  and verified (and the app set to Live), the WABA must be separately subscribed via
  `POST /{WABA-ID}/subscribed_apps` (see step 6 in section 8). Symptom: messages send fine,
  number shows "Connected", but **zero** logs ever appear in Vercel — Meta never delivers
  anything. Check with `GET /{WABA-ID}/subscribed_apps` in the Graph API Explorer; `data: []`
  means it's missing. POSTing to the same edge fixes it instantly.
- **Supabase free-tier project auto-pauses** after ~1 week of inactivity. Symptom: webhook
  *does* fire (you'll see `[webhook] <number>: <message>` in Vercel logs) but then
  `error: Failed to create conversation: TypeError: fetch failed` and no reply is sent. Fix:
  Supabase dashboard → project → **Restore project**. Takes effect within ~30s.

### Quick "no bot reply" debug checklist
1. Smoke-test the webhook GET (hub.challenge echo) — confirms deploy + verify token are correct.
2. Send a WhatsApp message, check Vercel logs (Live, last 30 min). Three outcomes:
   - **Nothing at all** → Meta isn't delivering. Check App Mode is **Live**, `messages` field is
     subscribed, AND the WABA is subscribed via `/subscribed_apps` (the most commonly missed step).
   - **`[webhook] <from>: <text>` then an error** → read the stack trace. `fetch failed` to
     `*.supabase.co` → check if the Supabase project is paused.
   - **`[webhook] ... replied to ...`** with no errors but still no WhatsApp reply → check the
     Graph API send call itself (token expiry, payment method, phone number ID mismatch).

---

## 13. Reuse / swapping numbers / second app

- **Swap the demo number:** register another number under the same WABA and point
  `WHATSAPP_PHONE_NUMBER_ID` at it. No code change.
- **One number = one WABA = one app.** A number can't serve two apps at once. For a second bot,
  use a second number (a WABA can hold up to ~25 numbers).
- **Onboarding a real paying client:** prefer the **Twilio** bot in `../ai-receptionist-whatsapp-bot/`
  (easier per-client number provisioning without each client doing Meta business verification).
  Add their spa config to Supabase `spa_configs`, set `SPA_ID`, give them a dedicated number.

---

## 14. Where the secrets live (do not commit)

`.env` is git-ignored. Live values exist in (a) your local `.env` and (b) Vercel env vars. They
are intentionally NOT written into this document. Regenerate/rotate from: Anthropic console,
Supabase Settings→API, Meta (System User token + App Secret), Gmail App Passwords.
