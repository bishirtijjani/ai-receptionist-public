-- ─────────────────────────────────────────────────────────────
-- Migration: add multi-channel support (Instagram + WhatsApp)
-- Run this in the Supabase SQL editor AFTER the original schema.sql.
--
-- The original `conversations` table keyed threads on (spa_id, phone).
-- We now route Instagram DMs through the same bot core, so a thread is
-- identified by (spa_id, contact_id, channel) where:
--   - channel    = 'whatsapp' | 'instagram'
--   - contact_id = E.164 phone (WhatsApp) OR Instagram-scoped user id (IGSID)
--
-- `phone` is kept as a backward-compatible alias for the WhatsApp contact id
-- so existing rows and the WhatsApp webhook keep working untouched.
-- ─────────────────────────────────────────────────────────────

-- 1. Add the channel column (existing rows default to 'whatsapp')
alter table conversations
  add column if not exists channel text not null default 'whatsapp'
  check (channel in ('whatsapp', 'instagram'));

-- 2. Drop the old (spa_id, phone) unique constraint if present.
--    Name may vary; this targets the default constraint created by the
--    `unique(spa_id, phone)` clause in schema.sql.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'conversations_spa_id_phone_key'
  ) then
    alter table conversations drop constraint conversations_spa_id_phone_key;
  end if;
end $$;

-- 3. New uniqueness: one active thread per (spa, contact, channel).
alter table conversations
  add constraint conversations_spa_contact_channel_key
  unique (spa_id, phone, channel);

-- 4. Index for the new lookup path.
create index if not exists conversations_contact_channel
  on conversations(spa_id, phone, channel);
