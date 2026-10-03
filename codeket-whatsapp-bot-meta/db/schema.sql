-- ─────────────────────────────────────────────────────────────
-- Codeket WhatsApp Bot — PostgreSQL schema (self-hosted)
-- Run once against the target database, e.g.:
--   psql "postgresql://user:pass@host:5432/ai_receptionist" -f db/schema.sql
--
-- This is the final schema after the multi-channel (Instagram) migration:
-- conversations are keyed by (spa_id, phone, channel).
-- ─────────────────────────────────────────────────────────────

-- Spa configurations (one row per client spa)
create table if not exists spa_configs (
  id          text primary key,                -- e.g. "glow", "luxe-austin"
  name        text not null,
  config      jsonb not null,                  -- full spa config object
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Active conversations (one per contact + channel per spa)
create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  spa_id      text not null references spa_configs(id),
  phone       text not null,                   -- E.164 phone (WhatsApp) or IGSID (Instagram)
  channel     text not null default 'whatsapp' check (channel in ('whatsapp', 'instagram')),
  status      text not null default 'active',  -- active | handed_off | closed
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(spa_id, phone, channel)
);

create index if not exists conversations_contact_channel
  on conversations(spa_id, phone, channel);

-- Individual messages (full history per conversation)
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_id on messages(conversation_id, created_at);

-- Human handoff events
create table if not exists handoffs (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  reason          text not null,
  urgency         text not null default 'normal' check (urgency in ('normal', 'high')),
  notified        boolean not null default false,  -- email sent?
  resolved        boolean not null default false,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- Bookings captured by the bot
create table if not exists bookings (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  spa_id          text not null references spa_configs(id),
  client_name     text,
  client_email    text,
  client_phone    text,
  service         text not null,
  slot_datetime   timestamptz,
  calendly_event_uri text,                     -- Calendly event URI after confirmed booking
  status          text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at      timestamptz not null default now()
);
