# AI Receptionist — WhatsApp AI Receptionist for Med Spas

Always-on WhatsApp/Instagram receptionist for med spas. Answers service and
price questions, proposes booking slots, collects intake info, and hands off to
a human for anything medical, complaint-related, or off-script. Configured
per client with hard-locked prices so the bot can't invent information.

**Stack:** Claude (Anthropic) + PostgreSQL + Node/Express + WhatsApp transport

> `ai-receptionist-whatsapp-bot-meta` is **self-hosted** (standalone Node server + PostgreSQL).
> `ai-receptionist-whatsapp-bot` (Twilio) still uses the original Vercel + Supabase setup.

---

## Repository layout

```
ai-receptionist-whatsapp-bot/        Twilio WhatsApp transport — used for paid client deploys
ai-receptionist-whatsapp-bot-meta/   WhatsApp Cloud API (Meta) transport — AI Receptionist's own demo bot
.agents/product-marketing.md Positioning, ICP, personas, objections, brand voice
```

Root-level `*.md` files are go-to-market material: research, outreach, discovery
scripting, and campaign planning.

### Which bot do I use?

| | `ai-receptionist-whatsapp-bot` | `ai-receptionist-whatsapp-bot-meta` |
|---|---|---|
| Transport | Twilio WhatsApp | Meta WhatsApp Cloud API |
| Purpose | Paid client deployments | AI Receptionist's own demo |
| Runtime | Vercel serverless + Supabase | Self-hosted Node + PostgreSQL |
| Setup | `README.md` | `SETUP-META.md` |

The two share the same core (`lib/anthropic.js`, `lib/system-prompt.js`,
`lib/supabase.js`, `lib/handoff.js`, `lib/calendly.js`) and differ only in the
transport layer.

---

## Quick start (per bot)

```bash
cd ai-receptionist-whatsapp-bot-meta    # self-hosted variant
npm install
cp .env.example .env            # fill in real values
psql "$DATABASE_URL" -f db/schema.sql
npm run seed                    # seed the Example Spa demo config
node test/simulate.js           # terminal chat simulator, no transport needed
npm start                       # /health, /webhook, /instagram-webhook
```

Full instructions live in each bot's README / `SETUP-META.md`.

---

## Configuration model

Each client's system prompt is generated at runtime from their own
`spa_configs` row in Supabase — services, prices, policies, and team. The bot
can only say what's in that config, and every price is hard-locked. Medical
questions, complaints, and discount requests trigger human handoff.

---

## Working in this repo

```bash
# per bot
npm install
npm test          # runs the terminal simulator
npm run dev       # vercel dev (local serverless)
```

`.env`, `node_modules/`, `.vercel/`, demo video, and prospect/PII data are
gitignored — never commit them.

> **Private repository.** Contains internal strategy and pricing context. Do not
> make public or share access without review.
