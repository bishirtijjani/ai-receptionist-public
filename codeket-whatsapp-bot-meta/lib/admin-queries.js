/**
 * Read-only queries powering the monitoring dashboard (/admin).
 *
 * All functions are parameterized and never write. Identity fields come from
 * `conversations` (captured in the channel webhooks).
 */

import { query } from "./db.js";

// ─── Overview stats ──────────────────────────────────────────────

export async function getStats() {
  const { rows } = await query(`
    select
      (select count(*)::int from conversations)                                   as conversations,
      (select count(*)::int from conversations where status = 'active')           as active,
      (select count(*)::int from conversations where status = 'handed_off')       as handed_off,
      (select count(distinct phone)::int from conversations)                      as contacts,
      (select count(*)::int from messages
        where created_at > now() - interval '24 hours')                           as messages_24h,
      (select count(*)::int from handoffs where resolved = false)                 as open_handoffs,
      (select count(*)::int from bookings)                                        as bookings
  `);

  const { rows: channels } = await query(`
    select channel, count(*)::int as count
      from conversations
     group by channel
     order by count desc
  `);

  return { ...rows[0], channels };
}

// ─── Conversations ───────────────────────────────────────────────

/**
 * List conversation sessions, newest activity first.
 *
 * @param {{channel?:string,status?:string,search?:string,limit?:number,offset?:number}} opts
 */
export async function listConversations({
  channel,
  status,
  search,
  limit = 50,
  offset = 0,
} = {}) {
  const where = [];
  const params = [];

  if (channel) {
    params.push(channel);
    where.push(`c.channel = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`c.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(c.phone ilike $${params.length}
        or c.display_name ilike $${params.length}
        or c.username ilike $${params.length})`
    );
  }

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const { rows } = await query(
    `select
        c.id, c.spa_id, c.phone, c.channel, c.status,
        c.display_name, c.username, c.profile_pic,
        c.created_at, coalesce(c.last_message_at, c.updated_at) as last_message_at,
        (select content from messages m
          where m.conversation_id = c.id
          order by m.created_at desc limit 1)   as last_message,
        (select role from messages m
          where m.conversation_id = c.id
          order by m.created_at desc limit 1)   as last_role,
        (select count(*)::int from messages m
          where m.conversation_id = c.id)       as message_count
       from conversations c
       ${whereSql}
      order by coalesce(c.last_message_at, c.updated_at) desc
      limit $${limitIdx} offset $${offsetIdx}`,
    params
  );
  return rows;
}

/**
 * Fetch a single conversation with its full transcript and handoff history.
 */
export async function getConversation(id) {
  const { rows } = await query(
    `select * from conversations where id = $1`,
    [id]
  );
  if (rows.length === 0) return null;

  const { rows: messages } = await query(
    `select id, role, content, created_at
       from messages
      where conversation_id = $1
      order by created_at asc`,
    [id]
  );

  const { rows: handoffs } = await query(
    `select id, reason, urgency, notified, resolved, resolved_at, created_at
       from handoffs
      where conversation_id = $1
      order by created_at desc`,
    [id]
  );

  return { ...rows[0], messages, handoffs };
}

// ─── Handoffs ────────────────────────────────────────────────────

export async function listHandoffs({ limit = 50 } = {}) {
  const { rows } = await query(
    `select
        h.id, h.reason, h.urgency, h.notified, h.resolved, h.resolved_at, h.created_at,
        c.id as conversation_id, c.channel, c.phone,
        c.display_name, c.username
       from handoffs h
       join conversations c on c.id = h.conversation_id
      order by h.created_at desc
      limit $1`,
    [limit]
  );
  return rows;
}

// ─── Bookings ────────────────────────────────────────────────────

export async function listBookings({ limit = 50 } = {}) {
  const { rows } = await query(
    `select
        b.id, b.client_name, b.client_email, b.client_phone, b.service,
        b.slot_datetime, b.status, b.created_at,
        c.id as conversation_id, c.channel, c.phone,
        c.display_name, c.username
       from bookings b
       join conversations c on c.id = b.conversation_id
      order by b.created_at desc
      limit $1`,
    [limit]
  );
  return rows;
}
