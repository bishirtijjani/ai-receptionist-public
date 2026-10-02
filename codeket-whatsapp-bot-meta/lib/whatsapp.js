/**
 * WhatsApp Cloud API transport (Meta Graph API).
 *
 * Replaces the Twilio transport for Codeket's own demo bot.
 * Uses native fetch (Node 18+) — no SDK dependency.
 *
 * Three jobs:
 *   1. sendWhatsAppMessage(to, body)   — send a text reply via Graph API
 *   2. parseWhatsAppWebhook(jsonBody)  — pull the inbound message out of Meta's JSON
 *   3. validateMetaSignature(...)      — verify X-Hub-Signature-256 against the app secret
 *   + verifyWebhookChallenge(query)    — answer Meta's GET subscription handshake
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import crypto from "crypto";

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v23.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

/**
 * Send a WhatsApp text message via the Cloud API.
 *
 * @param {string} to    - Recipient wa_id / E.164 digits, e.g. "14155551234" (no "+", no "whatsapp:" prefix)
 * @param {string} body  - Message text
 * @returns {Promise<string>} the sent message id (wamid...)
 */
export async function sendWhatsAppMessage(to, body) {
  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(to),
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WhatsApp send failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.messages?.[0]?.id ?? "";
}

/**
 * Parse a Meta WhatsApp Cloud API webhook POST body (JSON).
 *
 * Meta sends a deeply nested envelope. Inbound customer texts live at:
 *   entry[0].changes[0].value.messages[0]
 * Status callbacks (sent/delivered/read) arrive on the same webhook but carry
 * `value.statuses` instead of `value.messages` — we return null for those so
 * the webhook can ack them and move on.
 *
 * @param {string|object} rawBody - Raw JSON string or already-parsed object
 * @returns {{ from: string, body: string, messageId: string, profileName: string, phoneNumberId: string }|null}
 */
export function parseWhatsAppWebhook(rawBody) {
  let payload;
  try {
    payload = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  } catch {
    return null;
  }

  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  // No message = status callback or other event. Ignore.
  if (!message) return null;

  // Only handle text messages for the demo. (Images, audio, etc. -> null = ignored.)
  if (message.type !== "text") return null;

  return {
    from: message.from,                                  // "14155551234" (digits, no +)
    body: message.text?.body ?? "",
    messageId: message.id,                               // "wamid..."
    profileName: value?.contacts?.[0]?.profile?.name ?? "",
    phoneNumberId: value?.metadata?.phone_number_id ?? "",
  };
}

/**
 * Answer Meta's webhook verification GET handshake.
 * Meta calls: GET /webhook?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=NNN
 * Return the challenge string iff the mode is "subscribe" and the token matches
 * WHATSAPP_VERIFY_TOKEN. Otherwise return null (respond 403).
 *
 * @param {object} query - Parsed query params
 * @returns {string|null} the challenge to echo, or null if invalid
 */
export function verifyWebhookChallenge(query) {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return challenge ?? "";
  }
  return null;
}

/**
 * Validate Meta's X-Hub-Signature-256 header.
 * Meta signs the raw request body with HMAC-SHA256 using your App Secret.
 * Header format: "sha256=<hex digest>".
 *
 * @param {string} appSecret - process.env.WHATSAPP_APP_SECRET
 * @param {string} signatureHeader - value of "x-hub-signature-256"
 * @param {string} rawBody - the exact raw request body string
 * @returns {boolean}
 */
export function validateMetaSignature(appSecret, signatureHeader, rawBody) {
  if (!appSecret || !signatureHeader) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  // Constant-time compare; guard against length mismatch throwing.
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Normalize a phone value to bare E.164 digits (no "+", no "whatsapp:" prefix).
 * Meta's wa_id is already in this form; this just makes us robust to either input.
 */
export function normalizePhone(value) {
  return String(value).replace(/^whatsapp:/, "").replace(/^\+/, "").replace(/\D/g, "");
}
