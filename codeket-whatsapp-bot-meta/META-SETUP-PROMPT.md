# Prompt for the Claude-in-Chrome extension — Meta WhatsApp Cloud API setup

Paste everything in the box below into a Claude-in-Chrome session while logged into the
Facebook/Meta account that owns the Codeket business portfolio. It does the dashboard work
and hands back the 4 values the bot needs. (You still type the SMS code from your phone.)

---

You are setting up the WhatsApp Cloud API for my demo bot. I am logged into my Facebook/Meta
account in this browser. Do the steps below in order, in this tab. When a step needs something
only I can do (typing an SMS code, re-entering my password), pause and tell me exactly what to
type, then continue. At the end, give me the 4 values in a copy-paste block.

GOAL: a Meta app with WhatsApp added, a real business phone number registered, a permanent
access token, and the app secret. Do NOT configure the webhook yet (I deploy first and give
you the URL later).

1. Go to https://developers.facebook.com/apps . If I have no app called "Codeket Demo Bot",
   create one: Create App > use case "Other" > type "Business" > name "Codeket Demo Bot" >
   link it to my business portfolio. If it already exists, open it.

2. In the app, add the WhatsApp product (left sidebar "WhatsApp" > Set up). Open
   WhatsApp > API Setup.

3. Register my real number: click "Add phone number", enter business display name
   "Codeket" (or what I tell you), and the phone number I give you. Meta will send an SMS or
   voice OTP. PAUSE and ask me for the code, then enter it to finish verification.

4. On the API Setup page, find and record the **Phone number ID** and the **WhatsApp Business
   Account ID (WABA ID)**. Tell me both.

5. Create a PERMANENT token (the one on API Setup is only 24h):
   - Go to https://business.facebook.com/settings/system-users
   - Add a system user named "codeket-bot", role Admin.
   - Assign assets: my "Codeket Demo Bot" app (Full control) AND the WhatsApp account (Full control).
   - Generate new token: select the app, expiration "Never", scopes
     `whatsapp_business_messaging` and `whatsapp_business_management`. Generate it.
   - The token shows once. Copy it and give it to me as WHATSAPP_ACCESS_TOKEN.

6. Get the App Secret: app dashboard > App settings > Basic > App Secret > Show
   (I may need to re-enter my password — PAUSE and prompt me). Copy it.

7. Set my messaging/webhook verify token aside for later — I will use this exact string when I
   configure the webhook after deploying:
   `codeket_verify_6fd7674031b253dff2ba391306eea310`

Then return EXACTLY this block, filled in:

```
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_APP_SECRET=
REGISTERED_NUMBER=
```

Also tell me: is my business verified or not, and what my current messaging limit is
(shown on the WhatsApp > API Setup or Overview page).

---

## After the Chrome agent returns those values
1. Paste them into `.env` (and into Vercel env vars).
2. Deploy: `vercel --prod` — note the `https://<url>/webhook` address.
3. Back in Meta: WhatsApp > Configuration > Webhook > Edit > set that URL + the verify token
   above > Verify and save > Subscribe to the `messages` field.
4. Text the number from your phone. The bot replies as Glow Aesthetic Spa.
