import crypto from "crypto";

/**
 * Instagram Messaging (Meta Graph API) helper.
 *
 * Counterpart to lib/twilio.js, but for Instagram DMs. The bot core
 * (anthropic.js + db.js + handoff.js) is channel-agnostic; this module
 * only handles the Instagram-specific transport: webhook verification,
 * signature validation, inbound event parsing, and sending replies.
 *
 * Required env:
 *   IG_VERIFY_TOKEN   - arbitrary string you also enter in the Meta webhook UI
 *   IG_APP_SECRET     - Meta app secret (for X-Hub-Signature-256 validation)
 *   IG_ACCESS_TOKEN   - long-lived Instagram access token (Send API)
 *   IG_GRAPH_VERSION  - optional, defaults to "v21.0"
 *
 * NOTE: This app uses the "Instagram API with Instagram Login" flow, so the
 * Send API host is graph.instagram.com (NOT graph.facebook.com).
 */

const GRAPH_VERSION = process.env.IG_GRAPH_VERSION ?? "v21.0";

/**
 * Webhook verification handshake (GET request from Meta).
 * Meta calls your endpoint with hub.mode / hub.verify_token / hub.challenge.
 * Echo back the challenge ONLY if the token matches.
 *
 * @returns {{ ok: boolean, challenge?: string }}
 */
export function verifyWebhookSubscription(query) {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];

  if (mode === "subscribe" && token && token === process.env.IG_VERIFY_TOKEN) {
    return { ok: true, challenge };
  }
  return { ok: false };
}

/**
 * Validate the X-Hub-Signature-256 header Meta sends on every POST.
 * Prevents spoofed webhook calls. Requires the RAW request body.
 *
 * @param {string} appSecret - process.env.IG_APP_SECRET
 * @param {string} signatureHeader - value of "x-hub-signature-256" header (e.g. "sha256=...")
 * @param {string} rawBody - raw request body string
 * @returns {boolean}
 */
export function validateSignature(appSecret, signatureHeader, rawBody) {
  if (!appSecret || !signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  // Constant-time compare; guard against length mismatch which would throw.
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Parse an Instagram messaging webhook POST body into a flat list of
 * inbound text messages. Ignores echoes (messages your own account sent),
 * read receipts, reactions, and non-text payloads.
 *
 * Instagram payload shape:
 *   { object: "instagram", entry: [ { messaging: [ { sender:{id}, recipient:{id}, message:{ mid, text, is_echo } } ] } ] }
 *
 * @param {object} body - already-parsed JSON body
 * @returns {Array<{ senderId: string, recipientId: string, text: string, mid: string }>}
 */
export function parseInstagramWebhook(body) {
  const out = [];
  if (!body || !Array.isArray(body.entry)) return out;

  for (const entry of body.entry) {
    const events = entry.messaging ?? entry.standby ?? [];
    for (const ev of events) {
      const msg = ev.message;
      if (!msg) continue;            // delivery/read/reaction event — skip
      if (msg.is_echo) continue;     // our own outbound message echoed back
      if (!msg.text?.trim()) continue; // sticker/image/share with no text — skip

      out.push({
        senderId: ev.sender?.id ?? "",
        recipientId: ev.recipient?.id ?? "",
        text: msg.text,
        mid: msg.mid ?? "",
      });
    }
  }
  return out;
}

/**
 * Look up an Instagram user's profile from their IGSID via the User Profile API.
 * Consent is granted when the user messages the professional account, so this
 * works for anyone who has DM'd us.
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/user-profile/
 * All endpoints are on graph.instagram.com for the Instagram Login flow.
 *
 * Never throws — returns null on any failure so webhook processing continues.
 *
 * @param {string} igsid - Instagram-scoped user id from the webhook sender.id
 * @returns {Promise<{name: string|null, username: string|null, profile_pic: string|null}|null>}
 */
export async function getInstagramProfile(igsid) {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token || !igsid) return null;

  const url =
    `https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(igsid)}` +
    `?fields=name,username,profile_pic&access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[instagram] profile lookup failed (${res.status}): ${detail}`);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return {
      name: data.name ?? null,
      username: data.username ?? null,
      profile_pic: data.profile_pic ?? null,
    };
  } catch (err) {
    console.warn("[instagram] profile lookup error:", err.message);
    return null;
  }
}

/**
 * Send a text reply to an Instagram user via the Instagram Send API.
 *
 * @param {string} recipientId - the IGSID of the user to reply to
 * @param {string} text        - reply text (IG limit ~1000 chars per message)
 */
export async function sendInstagramMessage(recipientId, text) {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error("IG_ACCESS_TOKEN is not set");

  // Instagram API with Instagram Login uses graph.instagram.com (NOT
  // graph.facebook.com — that's the older Facebook-login/Messenger flow).
  // The token from the "API setup with Instagram business login" flow only
  // works against this host. Body is {recipient, message} — no messaging_type.
  const url = `https://graph.instagram.com/${GRAPH_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Instagram send failed (${res.status}): ${detail}`);
  }
  const data = await res.json().catch(() => ({}));
  return data.message_id ?? null;
}
