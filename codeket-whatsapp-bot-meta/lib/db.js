/**
 * PostgreSQL persistence layer (self-hosted).
 *
 * Replaces the old Supabase client. Same functions and semantics as
 * lib/supabase.js — only the driver changed (@supabase/supabase-js -> pg).
 * Connection comes from DATABASE_URL (points at the shared postgres container
 * over shared_net, e.g. postgresql://user:pass@postgresql:5432/ai_receptionist).
 */

import pg from "pg";

let pool;

function getPool() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

/**
 * Run a query against the shared pool. Exposed for read-only admin/dashboard
 * queries (see lib/admin-queries.js).
 */
export function query(text, params) {
  return getPool().query(text, params);
}

// ─── Spa config ──────────────────────────────────────────────────

/**
 * Load a spa config by ID.
 * The caller (webhook) uses the bundled demo config when SPA_ID === "glow",
 * so this lookup only runs for real client IDs.
 */
export async function getSpaConfig(spaId) {
  const { rows } = await getPool().query(
    "select config from spa_configs where id = $1 and active = true limit 1",
    [spaId]
  );
  if (rows.length === 0) {
    throw new Error(`spa_configs lookup failed for "${spaId}": not found`);
  }
  return rows[0].config;
}

// ─── Conversations ───────────────────────────────────────────────

/**
 * Get or create a conversation for a given contact + spa + channel combo.
 *
 * @param {string} spaId      - Spa identifier
 * @param {string} contactId  - Channel-scoped contact id.
 *                              WhatsApp: E.164 phone (e.g. "+14155551234").
 *                              Instagram: Instagram-scoped user id (IGSID).
 *                              Stored in the `phone` column for both channels.
 * @param {string} [channel]  - "whatsapp" (default) | "instagram"
 * @param {object} [identity] - optional { display_name, username, profile_pic }
 *                              seeded on a freshly created session.
 * @returns the conversation row.
 */
export async function getOrCreateConversation(
  spaId,
  contactId,
  channel = "whatsapp",
  identity = {}
) {
  const db = getPool();

  // 1. Resume the latest active session for this contact+channel, if any.
  const active = await db.query(
    `select * from conversations
     where spa_id = $1 and phone = $2 and channel = $3 and status = 'active'
     order by created_at desc
     limit 1`,
    [spaId, contactId, channel]
  );
  if (active.rows.length > 0) return active.rows[0];

  // 2. No active session — start a NEW one. Previous (handed_off/closed)
  //    sessions and their transcripts are preserved as history.
  const {
    display_name = null,
    username = null,
    profile_pic = null,
  } = identity ?? {};

  const created = await db.query(
    `insert into conversations
       (spa_id, phone, channel, status, display_name, username, profile_pic, last_message_at)
     values ($1, $2, $3, 'active', $4, $5, $6, now())
     returning *`,
    [spaId, contactId, channel, display_name, username, profile_pic]
  );
  return created.rows[0];
}

/**
 * Update a conversation's contact identity and stamp activity.
 * Null/undefined identity fields are left unchanged (coalesce), so it is safe
 * to call on every inbound message even when no new profile data is available.
 *
 * @param {string} conversationId
 * @param {{display_name?:string, username?:string, profile_pic?:string}} identity
 */
export async function updateConversationIdentity(conversationId, identity = {}) {
  const {
    display_name = null,
    username = null,
    profile_pic = null,
  } = identity ?? {};

  await getPool().query(
    `update conversations
        set display_name    = coalesce($2, display_name),
            username        = coalesce($3, username),
            profile_pic      = coalesce($4, profile_pic),
            last_message_at  = now(),
            updated_at       = now()
      where id = $1`,
    [conversationId, display_name, username, profile_pic]
  );
}

/**
 * Mark a conversation as handed off to a human.
 */
export async function markHandedOff(conversationId) {
  await getPool().query(
    "update conversations set status = 'handed_off', updated_at = now() where id = $1",
    [conversationId]
  );
}

// ─── Messages ────────────────────────────────────────────────────

/**
 * Fetch recent message history for a conversation.
 * Returns array of { role, content } ordered oldest to newest.
 */
export async function getHistory(conversationId, limit = 20) {
  const { rows } = await getPool().query(
    `select role, content from messages
     where conversation_id = $1
     order by created_at asc
     limit $2`,
    [conversationId, limit]
  );
  return rows;
}

/**
 * Save a message (user or assistant) to the conversation.
 */
export async function saveMessage(conversationId, role, content) {
  await getPool().query(
    "insert into messages (conversation_id, role, content) values ($1, $2, $3)",
    [conversationId, role, content]
  );
}

// ─── Handoffs ────────────────────────────────────────────────────

/**
 * Log a handoff event.
 */
export async function logHandoff(conversationId, reason, urgency = "normal") {
  await getPool().query(
    "insert into handoffs (conversation_id, reason, urgency, notified) values ($1, $2, $3, false)",
    [conversationId, reason, urgency]
  );
}

/**
 * Mark a handoff as notified (email sent).
 */
export async function markHandoffNotified(conversationId) {
  await getPool().query(
    "update handoffs set notified = true where conversation_id = $1 and notified = false",
    [conversationId]
  );
}

// ─── Bookings ────────────────────────────────────────────────────

/**
 * Save a pending booking capture.
 */
export async function saveBooking(conversationId, spaId, bookingData) {
  const {
    client_name = null,
    client_email = null,
    client_phone = null,
    service = null,
    slot_datetime = null,
  } = bookingData ?? {};

  await getPool().query(
    `insert into bookings
       (conversation_id, spa_id, client_name, client_email, client_phone, service, slot_datetime, status)
     values ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
    [conversationId, spaId, client_name, client_email, client_phone, service, slot_datetime]
  );
}

/**
 * Confirm a booking after a Calendly event is created.
 */
export async function confirmBooking(conversationId, calendlyEventUri) {
  await getPool().query(
    `update bookings set status = 'confirmed', calendly_event_uri = $2
     where conversation_id = $1 and status = 'pending'`,
    [conversationId, calendlyEventUri]
  );
}
