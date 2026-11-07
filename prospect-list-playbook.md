# AI Receptionist Prospect List Playbook
**File:** `ai-receptionist-prospect-list-v2.xlsx`  
**Current count:** 162 rows (64 original + 48 Miami + 50 Dallas)  
**Next city to add:** TBD — suggested: Houston, Austin, or Atlanta

---

## How the List Is Built

### Phase 1 — Discovery (Google searches)
Search city neighborhood by neighborhood to find spa names and websites.

**Search query pattern:**
```
"med spa" "NEIGHBORHOOD" OR "CITY" TX botox -yelp -groupon
```

**Example neighborhoods to sweep per city:**
- Dallas: Uptown, Highland Park, Frisco/Plano, McKinney/Southlake, Las Colinas/Irving, Addison/Richardson/Carrollton, Flower Mound/Lewisville, Mansfield/Cedar Hill/Denton, Fort Worth/Grapevine
- Miami: Brickell, Coral Gables, Coconut Grove, Kendall, Aventura, Doral, South Beach, Pinecrest, Palmetto Bay

**JS snippet to extract links from Google results page:**
```javascript
const allLinks = [];
document.querySelectorAll('h3').forEach(h => {
  let el = h;
  while(el && el.tagName !== 'A') el = el.parentElement;
  if(el && el.href && !el.href.includes('google.com') && !el.href.includes('yelp') && !el.href.includes('facebook'))
    allLinks.push(el.href.split('?')[0] + ' | ' + h.innerText);
});
allLinks.join('\n');
```

**Skip these (chains — not good targets):**
Dermani, AYA Medical Spa, Elase, Vitalyc, It's A Secret, Secret Med Spa, 4Ever Young, Viva Day Spa, dermani MEDSPA, BeautyFix

---

## Phase 2 — Website Scraping

Navigate to each spa's website, then run this JS snippet in the browser console:

```javascript
const html = document.documentElement.innerHTML.toLowerCase();
const text = document.body ? document.body.innerText : '';
const em = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)||[])[0]||'';
const ph = (text.match(/\(?\d{3}\)?[\s\-\.]\d{3}[\s\-\.]\d{4}/)||[])[0]||'';
const ig = (html.match(/instagram\.com\/([a-z0-9_.]{3,30})/i)||[])[1]||'';
const pl = ['vagaro','mindbody','boulevard','mangomint','acuityscheduling','squareup','fresha','janeapp','booker','zenoti','aestheticspro','fullslate','calendly','moxie','myaestheticrecord'];
let bk=''; for(const p of pl){if(html.includes(p)){bk=p;break;}}
const ow = (text.match(/(founder|owner|CEO|medical director|Dr\.|NP\b|PA-C)[,:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/)||[])[2]||'';
const mails=[]; document.querySelectorAll('a[href^="mailto"]').forEach(a=>mails.push(a.href.replace('mailto:','')));
JSON.stringify({em:em||mails[0]||'',ph,ig:ig?'@'+ig:'',bk,ow,title:document.title.slice(0,70)});
```

**This extracts:**
- `em` — email address
- `ph` — phone number
- `ig` — Instagram handle
- `bk` — booking platform detected
- `ow` — owner/founder name (if mentioned)

**Common blockers and workarounds:**
- SSL/privacy error → Google search for `[spa name] email contact` — often the Zenoti/Vagaro subdomain shows up in results with contact info
- Cloudflare "Just a moment" → include in list with phone/IG only (C-grade)
- Blank/parked domain → use phone from Google Maps listing
- Wix sites with no visible email → check `a[href^="mailto"]` links directly (run the mailto check)
- MalCare firewall block → add to list with phone only from Google Maps

---

## Phase 3 — Confidence Scoring

| Grade | Criteria | Action |
|-------|----------|--------|
| **A** | Has email + owner name + booking platform + Instagram | Email immediately, personalize with owner first name |
| **B** | Has email + booking platform | Email with platform-specific hook |
| **C** | Has email only, or no email at all | Instagram DM or cold call |

---

## Phase 4 — Batch Save (Python)

The script template lives at: `outputs/add_dallas.py` (copy and adapt for next city).

**Key variables to update per city:**
1. `dallas = [...]` list — replace with new city's 50 prospects
2. The print statement city label

**Data tuple format (one per spa):**
```python
("Spa Name", "City", "State", "Owner", "Title", "Instagram", "Website", "Email", "Phone", "Booking", "Notes"),
```

**Run the script:**
```bash
cd /sessions/vigilant-admiring-cori/mnt/outputs
python add_dallas.py   # rename to add_houston.py etc.
```

The script automatically:
- Reads the existing Excel, finds the next `#` row number
- Appends the new batch to `All Prospects` sheet
- Scores each row A/B/C
- Writes a personalized `Hook` line for each spa
- Colors rows green (A), yellow (B), red (C)
- Saves back to `ai-receptionist-prospect-list-v2.xlsx`

---

## Excel Column Reference

| Column | What it holds |
|--------|---------------|
| # | Row number (auto-increments) |
| Spa Name | Business name |
| City | City |
| State | Two-letter state code |
| Owner / Contact | Owner name if found |
| Title | MD, NP, RN, etc. |
| Instagram | @handle |
| Website | Domain only (no https://) |
| Email | Primary contact email |
| Phone | Phone number |
| Booking Software | vagaro / boulevard / mindbody / etc. |
| Verified? | Leave blank; fill in manually after confirming |
| IG Followers (est) | Fill in manually if checked |
| Channel | Auto-set: Email / Instagram / Phone |
| Priority | Fill manually: High / Med / Low |
| Sent Email 1 | Date sent |
| Sent LI 1 | LinkedIn date |
| Sent IG 1 | Instagram DM date |
| Replied | Date replied |
| Call Booked | Date of call |
| Closed | Date closed |
| Status | Lead / Active / Closed / Not Interested |
| Notes | Any extra context |
| Confidence | A / B / C (auto-scored) |
| Hook | Personalized opening line (auto-generated) |

---

## City Completion Tracker

| City | State | Count | Status | Rows |
|------|-------|-------|--------|------|
| Various (original) | Mixed | 64 | ✅ Done | #1–64 |
| Miami | FL | 48 | ✅ Done | #65–112 |
| Dallas | TX | 50 | ✅ Done | #113–162 |
| Houston | TX | — | ⬜ Next | — |
| Austin | TX | — | ⬜ Planned | — |
| Atlanta | GA | — | ⬜ Planned | — |
| Charlotte | NC | — | ⬜ Planned | — |
| Phoenix | AZ | — | ⬜ Planned | — |

---

## Tips & Lessons Learned

- **DFW / Miami have high C-rates** — many spas use contact forms instead of public emails. Prioritize A/B grades for email; use Instagram DMs for Cs.
- **Plastic surgeon-led medspas** are great targets — they do high volume but staff often miss follow-up calls.
- **myaestheticrecord + aestheticspro** = typically smaller independent practices, very good fit.
- **Boulevard + Mangomint** = tech-forward owners, easier sell on automation.
- **Zenoti / Mindbody** = larger operations, may have staff to handle reception — still worth trying.
- **Gmail email addresses** (like `spaname@gmail.com`) = solo operator, very likely owner answers themselves — high priority.
- **Target 50 per city**, sweep 6–8 neighborhoods, skip national chains.
- Each city takes roughly **2–3 hours** from first search to Excel save.
