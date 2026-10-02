# Cold Outreach Messages

## Volume targets (Week 1)

| Channel | Per day | Per week | Personalization |
|---|---|---|---|
| LinkedIn DMs (manual) | 10 | 70 | Heavy |
| Instagram DMs (manual) | 10 | 70 | Heavy |
| Cold emails (Brevo) | 20 | 140 | First-line only |

Total Week 1: ~280 touches. Expect 10-20 replies, 3-7 calls booked, 1-2 closes.

## Cold email template

**Subject lines (rotate, A/B test):**
- Question about [Spa Name]'s after-hours bookings
- [First Name], 3 missed bookings a week?
- AI receptionist for [Spa Name]
- [First Name], saw your [specific IG post / treatment]
- After 6 PM at [Spa Name]

**Body:**

```
Hi [First Name],

Saw [specific thing: their last IG post, a treatment they featured, a recent expansion, a press mention]. The [specific thing] looks great.

Quick question: how does your team handle DM and call inquiries after 6 PM? Most med spa owners I talk to are answering at 11 PM on their couch, or losing the bookings entirely to whoever replies first.

I built a WhatsApp AI receptionist specifically for med spas. Trained on your services and prices, books appointments straight into Boulevard / Vagaro / Mindbody, hands off to your team for anything sensitive. 14 days to live. $1,497 setup + $297/mo, pays back in about 5 booked treatments.

If after-hours inquiries are eating you alive, I have a 90-second Loom showing it work on a sample spa. Want me to send it over?

Either way, glad to be following [Spa Name]'s work.

Bishir
Founder, Codeket
codeket.com/whatsapp-receptionist
```

**Follow-up email 1 (Day 4 if no reply):**

```
Hi [First Name],

Following up on this. Even if AI receptionists aren't on your radar, I'd be curious how you handle the after-hours inquiry volume. Most spas I talk to lose 3-7 bookings a week to slow replies.

Loom here if you want a look: https://www.loom.com/share/dd158bac0eb94a2393d74ce45e0b376c

Bishir
```

**Follow-up email 2 (Day 8 if no reply):**

```
Hi [First Name],

Last note. I'm onboarding 3 case study partners this quarter at zero cost, in exchange for a published case study with metrics. If [Spa Name] would fit, happy to walk through the terms. Two slots left.

If not the right time, no worries. I'll stop the loop here.

Bishir
https://calendly.com/bishirtijjani247/30min
```

## LinkedIn DM

Keep first touch under 300 chars. People skim.

**First touch:**
```
Hi [First Name], saw [Spa Name]'s [specific thing]. Curious how your team handles after-hours DM and call inquiries. I built a WhatsApp AI receptionist specifically for med spas. 14 days to live, books straight into [Boulevard/Vagaro/their software]. Worth a 90-sec Loom? No pressure either way.
```

**Follow-up DM 1 (Day 4):**
```
[First Name], wanted to send this Loom directly in case my email got buried: https://www.loom.com/share/dd158bac0eb94a2393d74ce45e0b376c. Real conversation, fake spa. The booking happens at 9:42 PM, which is roughly when most of your DMs probably land.
```

**Follow-up DM 2 (Day 8):**
```
[First Name], onboarding 3 case study partners this quarter at zero cost (in exchange for a published case study with metrics). If [Spa Name] would fit, want me to send the terms? 2 slots left.
```

## Instagram DM

Even tighter. Be human, not pitchy.

**First touch:**
```
Hi! Just spent a few minutes on [Spa Name]'s feed, your [specific post / treatment] caught my eye. Real question: how does your team handle the DM volume after hours? I built a WhatsApp AI receptionist specifically for med spas, books straight into your scheduler. 90-sec demo if you're curious: https://www.loom.com/share/dd158bac0eb94a2393d74ce45e0b376c
```

**Follow-up IG 1 (Day 5):**
```
Following up. If after-hours DMs aren't a pain, no worries. If they are, here's the demo: https://www.loom.com/share/dd158bac0eb94a2393d74ce45e0b376c. Bot books real appointments in a fake spa called Glow.
```

## Personalization fields (fill before sending each)

| Field | Where to find |
|---|---|
| `[First Name]` | LinkedIn / IG bio |
| `[Spa Name]` | Obvious |
| `[specific thing]` | Their last 3 IG posts. Pick one. "saw your Tox Tuesday post," "your new Morpheus8 service," "your before/after on Saturday" |
| `[Boulevard/Vagaro/etc.]` | Click "Book now" on their website. The destination URL tells you. |

10 seconds per personalization. Don't overthink it.

## What NOT to do

- Don't open with "Hope you're doing well" or "I hope this finds you" (AI tell)
- Don't open with your story. Open with theirs.
- Don't use em-dashes (Claude/AI tell). Use commas, periods, parentheses.
- Don't send identical openers to multiple prospects (rotate the [specific thing])
- Don't pitch the price in the first message (lower the friction, offer the Loom)
- Don't link to codeket.com homepage. Link to codeket.com/whatsapp-receptionist
- Don't ask for a call in the first message. Offer a Loom (lower friction)
- Don't follow up more than 3 times per channel. Let it die.
- Don't send LinkedIn DMs via automation (account ban risk; LinkedIn detects it). Manual only.
- Don't send the case study offer first. That's the price-objection answer, not the lead.

## Lead enrichment workflow

For each prospect, before you send:

1. Pull their LinkedIn (note first name, role)
2. Pull their IG (note last 3 posts + bio)
3. Pull their website (note services list + booking software)
4. Find their email (Hunter.io free tier, or website footer, or `info@`/`hello@` as last resort)
5. Fill the spreadsheet row
6. Pick which channel based on availability (LI > Email > IG; if no LI, skip to email)
7. Send

10 minutes per prospect at most. If you spend more, you're overthinking.

## Reply handling

**When they reply yes / interested:**
- Respond within 2 hours (max). Speed of reply is half the close.
- Send Loom + Calendly link
- Offer: "Want a 15-min call this week? Here's my Calendly: https://calendly.com/bishirtijjani247/30min"

**When they reply with a question:**
- Answer the question, but always end with a next-step ask
- "Yes, we support Mindbody. Want a 15-min call to see it in action on your data? https://calendly.com/bishirtijjani247/30min"

**When they reply no / not now:**
- "Totally fair. Mind if I check back in 3 months?"
- Log in spreadsheet with `revisit_date`

**When they reply with an objection:**
- Use the objection-response table from `discovery-call-script.md`
- Don't get drawn into long debates on text. Push to a call.

## Tracking

In your spreadsheet, log per prospect:
- `sent_email_1` (date)
- `sent_li_1` (date)
- `sent_ig_1` (date)
- `replied` (yes/no, date)
- `call_booked` (date, time)
- `closed` (yes/no, plan, date)
- `status` (active / dead / revisit)

Review every Friday: who didn't reply, who needs a follow-up, where are the deals stuck.
