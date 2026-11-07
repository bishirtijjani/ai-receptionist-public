# Setup Guide — AI Receptionist Demo Bot on WhatsApp Cloud API (Meta)

This is the setup for **AI Receptionist's own demo bot** (Example Spa), running on Meta's
WhatsApp Cloud API with a **real registered number**. Service replies are free, and you can
swap/add numbers under one WhatsApp Business Account.

> The Twilio bot in `../ai-receptionist-whatsapp-bot` is unchanged. Keep it for **paid client** deploys.
> This Meta variant is for **your demo number only**.

---

## What you'll end up with (the 5 values this bot needs)

| `.env` variable | What it is | Where it comes from |
|---|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | ID of your registered number (not the number itself) | Meta App > WhatsApp > API Setup |
| `WHATSAPP_ACCESS_TOKEN` | Permanent System User token | Business Settings > System Users |
| `WHATSAPP_APP_SECRET` | App secret (verifies webhook signatures) | App > Settings > Basic |
| `WHATSAPP_VERIFY_TOKEN` | A string **you** choose; you paste it into Meta's webhook config | You pick it (see below) |
| `WHATSAPP_API_VERSION` | Graph API version, e.g. `v23.0` | Default is fine |

**Your pre-generated verify token (use this everywhere):**
```
ai-receptionist_verify_6fd7674031b253dff2ba391306eea310
```

---

## Prerequisites

- A Facebook account + a Meta Business Portfolio (create free at business.facebook.com).
- **A real phone number you control** that is **NOT currently on any WhatsApp account**
  (personal or Business app). If it is, delete that WhatsApp account first, or use a fresh
  number (a cheap eSIM / second SIM / VoIP that can receive SMS or a call works).
- The bot deployed and reachable over HTTPS (you need the live `/webhook` URL before the
  webhook step). See the README for the self-hosted Node + PostgreSQL setup.

---

## Step 1 — Create the Meta app

1. Go to **developers.facebook.com** > **My Apps** > **Create App**.
2. Use case: **Other** > Type: **Business** > name it `AI Receptionist Demo Bot`.
3. Link it to your Business Portfolio.
4. On the app dashboard, find **WhatsApp** and click **Set up**.

## Step 2 — Register your real number

1. App > **WhatsApp** > **API Setup**.
2. Under **Send and receive messages**, click **Add phone number**.
3. Enter the business display name + the real phone number.
4. Verify it via the **SMS or voice OTP** Meta sends to that number.
   > WARNING: You must read this code off the phone yourself. No tool can do this step.
5. Once verified, copy the **Phone number ID** shown on the API Setup page
   -> this is `WHATSAPP_PHONE_NUMBER_ID`.

## Step 3 — Get a PERMANENT access token

The token shown on API Setup is **temporary (24h)** — fine for a first test, useless for
production. Make a permanent one:

1. **business.facebook.com** > **Business Settings** > **Users** > **System Users**.
2. **Add** a system user: name `ai-receptionist-bot`, role **Admin**.
3. Select it > **Assign assets** > pick your app > grant **Full control**. Also assign the
   **WhatsApp Account** asset with full control.
4. Click **Generate new token** > select your app > set expiration **Never** >
   check scopes **`whatsapp_business_messaging`** and **`whatsapp_business_management`**.
5. Copy the token immediately (shown once) -> this is `WHATSAPP_ACCESS_TOKEN`.

## Step 4 — Get the App Secret

1. App dashboard > **App settings** > **Basic**.
2. Next to **App Secret**, click **Show** (re-enter your FB password).
3. Copy it -> this is `WHATSAPP_APP_SECRET`.

## Step 5 — Fill `.env` and start the server

1. `cp .env.example .env` and fill the WhatsApp values above + `DATABASE_URL`,
   `ANTHROPIC_API_KEY`, and SMTP.
2. Initialise the database (once):
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   npm install
   npm run seed          # seeds the "example-spa" spa row
   ```
3. Start the server (sets `NODE_ENV=production` so signatures are enforced):
   ```bash
   npm start             # node server.js, listens on PORT (default 3000)
   ```
   Your webhook URL is `https://<your-domain>/webhook` (and `/instagram-webhook`).

## Step 6 — Wire the webhook in Meta

1. App > **WhatsApp** > **Configuration** > **Webhook** > **Edit**.
2. **Callback URL:** `https://<your-domain>/webhook`
3. **Verify token:** `ai-receptionist_verify_6fd7674031b253dff2ba391306eea310`
4. Click **Verify and save**. (Meta sends a GET to your webhook; the bot answers the challenge.)
5. Under **Webhook fields**, **Subscribe** to **`messages`**.

## Step 7 — Test

1. From your phone, send a WhatsApp message **to your registered business number**.
2. The bot should reply within a couple seconds as the Example Spa receptionist.
3. No reply? Check the server logs (`docker compose logs -f ai-receptionist`, or the
   `npm start` terminal).

| Symptom | Likely cause | Fix |
|---|---|---|
| Webhook "Verify and save" fails | Verify token mismatch, or not deployed | Confirm the token matches exactly; confirm `/webhook` is live |
| Message sends but no reply | Not subscribed to `messages`, or bad token | Subscribe to `messages`; regenerate the system-user token |
| 401/190 from Graph API | Token expired or wrong scopes | Make a permanent token with both whatsapp scopes (Step 3) |
| Reply works in dev but 403 in prod | Signature check failing | Confirm `WHATSAPP_APP_SECRET` is set on the server |

---

## Notes on the "real number" path

- **Messaging limits before business verification:** an unverified business can message a
  **limited number of unique recipients** (typically up to ~250/day) — plenty for demos.
  For higher volume, complete **Business Verification** in Business Settings (1-7 days).
- **Number swapping:** to swap, register another number under the same WhatsApp Business
  Account and point `WHATSAPP_PHONE_NUMBER_ID` at it. No code changes.
- **Cost:** customer-initiated **service** conversations are free and unlimited. You only pay
  if you proactively send *template* messages (marketing/utility) — this demo never does.
