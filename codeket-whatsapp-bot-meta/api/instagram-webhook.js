/**
 * Vercel serverless function — Instagram DM webhook (Meta Graph API).
 *
 * Mirrors api/webhook.js (the Twilio/WhatsApp handler) but for Instagram.
 * The bot core is identical — only the transport differs.
 *
 * GET  : Meta subscription verification handshake (echo hub.challenge).
 * POST : inbound DM events. For each text message:
 *   1. Validate X-Hub-Signature-256
 *   2. Load spa config
 *   3. Get or create conversation (channel = "instagram", contact = IGSID)
 *   4. Fetch history → call Claude Haiku → persist
 *   5. Handle HANDOFF if signalled
 *   6. Reply via Instagram Send API
 *
 * Always returns 200 quickly so Meta doesn't retry/disable the webhook.
 */

import {
  verifyWebhookSubscription,
  validateSignature,
  parseInstagramWebhook,
  sendInstagramMessage,
  getInstagramProfile,
} from "../lib/instagram.js";
import { getReply } from "../lib/anthropic.js";
import {
  getSpaConfig,
  getOrCreateConversation,
  getHistory,
  saveMessage,
  updateConversationIdentity,
} from "../lib/db.js";
import { handleHandoff } from "../lib/handoff.js";
import { example-spaSpaConfig } from "../demo/example-spa-spa-config.js";

export const config = {
  api: { bodyParser: false }, // raw body needed for signature validation
};

export default async function handler(req, res) {
  // ── GET: Meta webhook verification handshake ─────────────────
  if (req.method === "GET") {
    const { ok, challenge } = verifyWebhookSubscription(req.query ?? {});
    if (ok) return res.status(200).send(challenge);
    return res.status(403).send("Forbidden");
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // ── Read raw body ────────────────────────────────────────────
  const rawBody = await readRawBody(req);

  // ── Validate signature (skip in dev) ─────────────────────────
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev) {
    const signature = req.headers["x-hub-signature-256"] ?? "";
    const valid = validateSignature(process.env.IG_APP_SECRET, signature, rawBody);
    if (!valid) {
      console.warn("Invalid Instagram signature — request rejected");
      return res.status(403).send("Forbidden");
    }
  }

  // ── Parse ────────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return res.status(200).send("EVENT_RECEIVED"); // ack malformed, don't retry
  }

  const messages = parseInstagramWebhook(body);

  // Ack Meta immediately; process messages without blocking the 200.
  // (Vercel keeps the function alive until the handler returns, so we await
  //  before responding — fine for low volume. For high volume, move to a queue.)
  const spaId = process.env.SPA_ID ?? "example-spa";

  for (const m of messages) {
    try {
      console.log(`[ig-webhook] ${m.senderId}: ${m.text}`);

      const spaConfig = spaId === "example-spa" ? example-spaSpaConfig : await getSpaConfig(spaId);

      const conversation = await getOrCreateConversation(spaId, m.senderId, "instagram");
      const history = await getHistory(conversation.id, 20);

      const { reply, handoff } = await getReply(spaConfig, history, m.text);

      await saveMessage(conversation.id, "user", m.text);
      await saveMessage(conversation.id, "assistant", reply);

      // Record who this DM is from. Instagram only sends an opaque IGSID, so
      // resolve @username/name via the User Profile API (cached on the row).
      let identity = null;
      if (!conversation.username) {
        const profile = await getInstagramProfile(m.senderId);
        if (profile) {
          identity = {
            display_name: profile.name,
            username: profile.username,
            profile_pic: profile.profile_pic,
          };
          console.log(`[ig-webhook] profile ${m.senderId} -> @${profile.username ?? "?"}`);
        }
      }
      await updateConversationIdentity(conversation.id, identity);

      if (handoff) {
        await handleHandoff({
          conversationId: conversation.id,
          customerPhone: `instagram:${m.senderId}`,
          reason: handoff.reason,
          urgency: handoff.urgency,
          lastCustomerMessage: m.text,
          spaConfig,
        });
      }

      await sendInstagramMessage(m.senderId, reply);
      console.log(`[ig-webhook] replied to ${m.senderId}: ${reply.slice(0, 80)}...`);
    } catch (err) {
      console.error("[ig-webhook] error:", err);
      // Swallow — never fail the webhook, or Meta will retry/disable it.
    }
  }

  return res.status(200).send("EVENT_RECEIVED");
}

// ─── Helpers ─────────────────────────────────────────────────────

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk.toString()));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
