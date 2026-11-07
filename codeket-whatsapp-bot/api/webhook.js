/**
 * Vercel serverless function — Twilio WhatsApp webhook.
 *
 * Twilio sends a POST to this endpoint every time a customer sends a WhatsApp message.
 * Flow:
 *   1. Parse + validate the incoming Twilio request
 *   2. Load spa config
 *   3. Get or create conversation
 *   4. Fetch message history
 *   5. Call Claude Haiku
 *   6. Handle HANDOFF signal if present
 *   7. Save messages to Supabase
 *   8. Reply via Twilio
 *
 * Returns 200 with empty TwiML body (reply is sent via REST API, not TwiML response).
 */

import { parseTwilioWebhook, sendWhatsAppMessage, validateTwilioSignature } from "../lib/twilio.js";
import { getReply } from "../lib/anthropic.js";
import {
  getSpaConfig,
  getOrCreateConversation,
  getHistory,
  saveMessage,
} from "../lib/supabase.js";
import { handleHandoff } from "../lib/handoff.js";
import { example-spaSpaConfig } from "../demo/example-spa-spa-config.js";

export const config = {
  api: { bodyParser: false }, // We need the raw body for Twilio signature validation
};

export default async function handler(req, res) {
  // ── Only accept POST ─────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // ── Read raw body ────────────────────────────────────────────
  const rawBody = await readRawBody(req);

  // ── Validate Twilio signature (skip in demo/dev mode) ────────
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev) {
    const signature = req.headers["x-twilio-signature"] ?? "";
    const url = `https://${req.headers.host}/webhook`;
    const params = Object.fromEntries(new URLSearchParams(rawBody));
    const valid = validateTwilioSignature(
      process.env.TWILIO_AUTH_TOKEN,
      signature,
      url,
      params
    );
    if (!valid) {
      console.warn("Invalid Twilio signature — request rejected");
      return res.status(403).send("Forbidden");
    }
  }

  // ── Parse webhook ────────────────────────────────────────────
  const { from, body: customerMessage } = parseTwilioWebhook(rawBody);

  if (!from || !customerMessage?.trim()) {
    return res.status(200).send("<?xml version='1.0'?><Response/>");
  }

  console.log(`[webhook] ${from}: ${customerMessage}`);

  try {
    // ── Load spa config ─────────────────────────────────────────
    const spaId = process.env.SPA_ID ?? "example-spa";
    let spaConfig;

    if (spaId === "example-spa") {
      // Use bundled demo config for Glow spa (no Supabase lookup needed)
      spaConfig = example-spaSpaConfig;
    } else {
      spaConfig = await getSpaConfig(spaId);
    }

    // ── Conversation state ───────────────────────────────────────
    const conversation = await getOrCreateConversation(spaId, normalizePhone(from));
    const history = await getHistory(conversation.id, 20);

    // ── LLM call ────────────────────────────────────────────────
    const { reply, handoff } = await getReply(spaConfig, history, customerMessage);

    // ── Persist messages ─────────────────────────────────────────
    await saveMessage(conversation.id, "user", customerMessage);
    await saveMessage(conversation.id, "assistant", reply);

    // ── Handoff ──────────────────────────────────────────────────
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

    // ── Send reply ───────────────────────────────────────────────
    await sendWhatsAppMessage(from, reply);

    console.log(`[webhook] replied to ${from}: ${reply.slice(0, 80)}...`);
  } catch (err) {
    console.error("[webhook] error:", err);
    // Don't expose error details to Twilio — just ack
  }

  // Twilio expects 200 with valid TwiML (even if we reply via REST)
  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send("<?xml version='1.0'?><Response/>");
}

// ─── Helpers ─────────────────────────────────────────────────────

function normalizePhone(twilioFrom) {
  // Strip "whatsapp:" prefix, keep E.164
  return twilioFrom.replace(/^whatsapp:/, "");
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
