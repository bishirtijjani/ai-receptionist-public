-- ─────────────────────────────────────────────────────────────
-- Migration 001 — sender identity + session-preserving history
--
-- Adds contact identity columns (captured from WhatsApp payloads and the
-- Instagram User Profile API) and removes the one-conversation-per-contact
-- unique constraint so a returning contact starts a NEW session instead of
-- having their previous transcript deleted.
--
-- Idempotent: safe to run more than once.
--   psql "$DATABASE_URL" -f db/migrations/001-identity-and-sessions.sql
-- ─────────────────────────────────────────────────────────────

-- 1. Contact identity + recency columns
alter table conversations
  add column if not exists display_name    text,
  add column if not exists username        text,
  add column if not exists profile_pic      text,
  add column if not exists last_message_at  timestamptz;

-- 2. Allow multiple sessions per contact (one row per session).
--    The default constraint name is conversations_spa_id_phone_channel_key.
alter table conversations
  drop constraint if exists conversations_spa_id_phone_channel_key;

-- 3. Lookup index for "latest active session for this contact".
drop index if exists conversations_contact_channel;
create index if not exists conversations_contact_recent
  on conversations(spa_id, phone, channel, created_at desc);

-- 4. Backfill last_message_at from existing transcripts.
update conversations c
   set last_message_at = m.max_created
  from (
    select conversation_id, max(created_at) as max_created
      from messages
     group by conversation_id
  ) m
 where m.conversation_id = c.id
   and c.last_message_at is null;
