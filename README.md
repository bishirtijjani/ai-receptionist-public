# Codeket — WhatsApp AI Receptionist for Med Spas

Always-on WhatsApp/Instagram receptionist for med spas. Answers service and
price questions, proposes booking slots, collects intake info, and hands off to
a human for anything medical, complaint-related, or off-script. Configured
per client with hard-locked prices so the bot can't invent information.

**Stack:** Claude (Anthropic) + Supabase + Vercel + WhatsApp transport

---

## Repository layout

```
codeket-whatsapp-bot/        Twilio WhatsApp transport — used for paid client deploys
codeket-whatsapp-bot-meta/   WhatsApp Cloud API (Meta) transport — Codeket's own demo bot
.agents/product-marketing.md Positioning, ICP, personas, objections, brand voice
```

Root-level `*.md` files are go-to-market material: research, outreach, discovery
scripting, and campaign planning.

### Which bot do I use?

| | `codeket-whatsapp-bot` | `codeket-whatsapp-bot-meta` |
|---|---|---|
| Transport | Twilio WhatsApp | Meta WhatsApp Cloud API |
| Purpose | Paid client deployments | Codeket's own demo |
| Setup | `README.md` | `SETUP-META.md` |

The two share the same core (`lib/anthropic.js`, `lib/system-prompt.js`,
`lib/supabase.js`, `lib/handoff.js`, `lib/calendly.js`) and differ only in the
transport layer.

---

## Quick start (per bot)

```bash
cd codeket-whatsapp-bot         # or codeket-whatsapp-bot-meta
npm install
cp .env.example .env            # fill in real values
# run supabase/schema.sql in the Supabase SQL editor
node scripts/seed-demo-spa.js   # seed the Glow Aesthetic Spa demo config
node test/simulate.js           # terminal chat simulator, no transport needed
```

Deploy to Vercel with `vercel --prod`, then point the WhatsApp webhook at
`https://<your-url>/webhook`. Full instructions live in each bot's README /
`SETUP-META.md`.

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
