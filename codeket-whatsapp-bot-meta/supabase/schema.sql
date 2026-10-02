-- ─────────────────────────────────────────────────────────────
-- Codeket WhatsApp Bot — Supabase Schema
-- Run this in the Supabase SQL editor to initialise the database.
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

-- Active conversations (one per phone number per spa)
create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  spa_id      text not null references spa_configs(id),
  phone       text not null,                   -- E.164 format, e.g. "+14155551234"
  status      text not null default 'active',  -- active | handed_off | closed
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(spa_id, phone)
);

create index if not exists conversations_phone_spa on conversations(phone, spa_id);

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

-- ─── Seed demo spa ───────────────────────────────────────────────
-- After running this schema, also run:
--   node scripts/seed-demo-spa.js
-- to insert the Glow Aesthetic Spa config.
-- ─────────────────────────────────────────────────────────────────
