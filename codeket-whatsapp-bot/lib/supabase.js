import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Spa config ──────────────────────────────────────────────────

/**
 * Load a spa config by ID from Supabase.
 * Falls back to the local demo config if SPA_ID is "example-spa" and we're in dev.
 */
export async function getSpaConfig(spaId) {
  const { data, error } = await supabase
    .from("spa_configs")
    .select("config")
    .eq("id", spaId)
    .eq("active", true)
    .single();

  if (error) throw new Error(`spa_configs lookup failed for "${spaId}": ${error.message}`);
  return data.config;
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
 * @returns the conversation row.
 */
export async function getOrCreateConversation(spaId, contactId, channel = "whatsapp") {
  // 1. Resume if an active conversation already exists
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("spa_id", spaId)
    .eq("phone", contactId)
    .eq("channel", channel)
    .eq("status", "active")
    .single();

  if (existing) return existing;

  // 2. If a handed_off conversation exists, reset it and wipe old messages
  //    (unique constraint means one row per spa+contact+channel)
  const { data: stale } = await supabase
    .from("conversations")
    .select("*")
    .eq("spa_id", spaId)
    .eq("phone", contactId)
    .eq("channel", channel)
    .single();

  if (stale) {
    await supabase.from("messages").delete().eq("conversation_id", stale.id);
    const { data: reset, error: resetError } = await supabase
      .from("conversations")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", stale.id)
      .select()
      .single();
    if (resetError) throw new Error(`Failed to reset conversation: ${resetError.message}`);
    return reset;
  }

  // 3. No conversation at all — create fresh
  const { data, error } = await supabase
    .from("conversations")
    .insert({ spa_id: spaId, phone: contactId, channel, status: "active" })
    .select()
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return data;
}

/**
 * Mark a conversation as handed off to a human.
 */
export async function markHandedOff(conversationId) {
  await supabase
    .from("conversations")
    .update({ status: "handed_off", updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

// ─── Messages ────────────────────────────────────────────────────

/**
 * Fetch recent message history for a conversation.
 * Returns array of { role, content } ordered oldest to newest.
 */
export async function getHistory(conversationId, limit = 20) {
  const { data, error } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch history: ${error.message}`);
  return data ?? [];
}

/**
 * Save a message (user or assistant) to the conversation.
 */
export async function saveMessage(conversationId, role, content) {
  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role, content });

  if (error) throw new Error(`Failed to save message: ${error.message}`);
}

// ─── Handoffs ────────────────────────────────────────────────────

/**
 * Log a handoff event to Supabase.
 */
export async function logHandoff(conversationId, reason, urgency = "normal") {
  const { error } = await supabase
    .from("handoffs")
    .insert({ conversation_id: conversationId, reason, urgency, notified: false });

  if (error) throw new Error(`Failed to log handoff: ${error.message}`);
}

/**
 * Mark a handoff as notified (email sent).
 */
export async function markHandoffNotified(conversationId) {
  await supabase
    .from("handoffs")
    .update({ notified: true })
    .eq("conversation_id", conversationId)
    .eq("notified", false);
}

// ─── Bookings ────────────────────────────────────────────────────

/**
 * Save a pending booking capture.
 */
export async function saveBooking(conversationId, spaId, bookingData) {
  const { error } = await supabase
    .from("bookings")
    .insert({
      conversation_id: conversationId,
      spa_id: spaId,
      ...bookingData,
      status: "pending",
    });

  if (error) throw new Error(`Failed to save booking: ${error.message}`);
}

/**
 * Confirm a booking after Calendly event is created.
 */
export async function confirmBooking(conversationId, calendlyEventUri) {
  await supabase
    .from("bookings")
    .update({ status: "confirmed", calendly_event_uri: calendlyEventUri })
    .eq("conversation_id", conversationId)
    .eq("status", "pending");
}
