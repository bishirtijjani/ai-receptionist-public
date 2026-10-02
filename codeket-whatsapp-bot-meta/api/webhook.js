/**
 * Vercel serverless function — WhatsApp Cloud API (Meta) webhook.
 *
 * Codeket's OWN demo bot transport. (The Twilio version lives in
 * ../codeket-whatsapp-bot and is unchanged — used for paid client deploys.)
 *
 * Meta hits this endpoint two ways:
 *   GET  — one-time subscription handshake. Echo hub.challenge if the token matches.
 *   POST — every inbound message (and status callbacks, which we ignore).
 *
 * POST flow:
 *   1. Validate X-Hub-Signature-256 against the app secret (skipped in dev)
 *   2. Parse Meta's JSON envelope -> { from, body }  (null = status event, ack & exit)
 *   3. Load spa config
 *   4. Get or create conversation
 *   5. Fetch message history
 *   6. Call Claude Haiku
 *   7. Handle HANDOFF signal if present
 *   8. Save messages to Supabase
 *   9. Reply via the Cloud API
 *
 * Always returns 200 quickly so Meta doesn't retry/disable the webhook.
 */

import {
  sendWhatsAppMessage,
  parseWhatsAppWebhook,
  validateMetaSignature,
  verifyWebhookChallenge,
  normalizePhone,
} from "../lib/whatsapp.js";
import { getReply } from "../lib/anthropic.js";
import {
  getSpaConfig,
  getOrCreateConversation,
  getHistory,
  saveMessage,
} from "../lib/supabase.js";
import { handleHandoff } from "../lib/handoff.js";
import { glowSpaConfig } from "../demo/glow-spa-config.js";

export const config = {
  api: { bodyParser: false }, // raw body needed for X-Hub-Signature-256 validation
};

export default async function handler(req, res) {
  // ── GET: Meta webhook verification handshake ──────────────────
  if (req.method === "GET") {
    const challenge = verifyWebhookChallenge(req.query ?? {});
    if (challenge !== null) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  // ── Only POST past this point ─────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // ── Read raw body ─────────────────────────────────────────────
  const rawBody = await readRawBody(req);

  // ── Validate Meta signature (skip in dev) ─────────────────────
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev) {
    const signature = req.headers["x-hub-signature-256"] ?? "";
    const valid = validateMetaSignature(
      process.env.WHATSAPP_APP_SECRET,
      signature,
      rawBody
    );
    if (!valid) {
      console.warn("Invalid Meta signature — request rejected");
      return res.status(403).send("Forbidden");
    }
  }

  // ── Parse webhook ─────────────────────────────────────────────
  const message = parseWhatsAppWebhook(rawBody);

  // null = status callback (delivered/read) or non-text event. Ack and exit.
  if (!message || !message.from || !message.body?.trim()) {
    return res.status(200).json({ ok: true });
  }

  const { from, body: customerMessage } = message;
  console.log(`[webhook] ${from}: ${customerMessage}`);

  try {
    // ── Load spa config ─────────────────────────────────────────
    const spaId = process.env.SPA_ID ?? "glow";
    const spaConfig = spaId === "glow" ? glowSpaConfig : await getSpaConfig(spaId);

    // ── Conversation state ──────────────────────────────────────
    const conversation = await getOrCreateConversation(spaId, normalizePhone(from));
    const history = await getHistory(conversation.id, 20);

    // ── LLM call ────────────────────────────────────────────────
    const { reply, handoff } = await getReply(spaConfig, history, customerMessage);

    // ── Persist messages ────────────────────────────────────────
    await saveMessage(conversation.id, "user", customerMessage);
    await saveMessage(conversation.id, "assistant", reply);

    // ── Handoff ─────────────────────────────────────────────────
    if (handoff) {
      await handleHandoff({
        conversationId: conversation.id,
        customerPhone: normalizePhone(from),
        reason: handoff.reason,
        urgency: handoff.urgency,
        lastCustomerMessage: customerMessage,
        spaConfig,
      });
    }

    // ── Send reply ──────────────────────────────────────────────
    await sendWhatsAppMessage(from, reply);
    console.log(`[webhook] replied to ${from}: ${reply.slice(0, 80)}...`);
  } catch (err) {
    console.error("[webhook] error:", err);
    // Don't surface errors to Meta — just ack so it doesn't retry-storm.
  }

  return res.status(200).json({ ok: true });
}

// ─── Helpers ─────────────────────────────────────────────────────

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
