/**
 * Backfill contact identity for conversations created BEFORE identity capture.
 *
 * Only Instagram is backfillable: we already store the IGSID (in
 * conversations.phone) and can resolve @username/name via the User Profile API.
 *
 * WhatsApp profile names cannot be backfilled — Meta only delivers them inside
 * an inbound message payload, and there is no lookup-by-number endpoint. Those
 * contacts keep showing their phone number until they message again, at which
 * point the channel webhook captures the name automatically.
 *
 * Run:  npm run backfill:identities
 * Safe to run repeatedly (only touches rows where username is still null).
 */

import "dotenv/config";
import { query } from "../lib/db.js";
import { getInstagramProfile } from "../lib/instagram.js";

async function backfillInstagram() {
  const { rows } = await query(
    `select distinct phone
       from conversations
      where channel = 'instagram' and username is null`
  );

  if (rows.length === 0) {
    console.log("[backfill] Instagram: nothing to do.");
    return;
  }

  console.log(`[backfill] Instagram: ${rows.length} contact(s) to resolve.`);
  for (const { phone } of rows) {
    const profile = await getInstagramProfile(phone);
    if (!profile) {
      console.log(`[backfill]   ${phone}: no profile returned (skipped).`);
      continue;
    }
    // Update identity only — do NOT touch last_message_at (this isn't activity).
    await query(
      `update conversations
          set display_name = coalesce($2, display_name),
              username     = coalesce($3, username),
              profile_pic  = coalesce($4, profile_pic),
              updated_at   = now()
        where channel = 'instagram' and phone = $1`,
      [phone, profile.name, profile.username, profile.profile_pic]
    );
    console.log(`[backfill]   ${phone} -> @${profile.username ?? "?"} (${profile.name ?? "no name"})`);
  }
}

async function main() {
  await backfillInstagram();
  const { rows } = await query(
    `select count(*)::int as n
       from conversations
      where channel = 'whatsapp' and display_name is null`
  );
  if (rows[0].n > 0) {
    console.log(
      `[backfill] WhatsApp: ${rows[0].n} contact(s) have no name and cannot be ` +
      `backfilled (no lookup API). They will be named on their next message.`
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill] failed:", err);
  process.exit(1);
});
