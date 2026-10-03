/**
 * Standalone Node HTTP server for the Codeket WhatsApp AI receptionist.
 *
 * Replaces the Vercel serverless runtime with a real, long-running server.
 * The webhook handlers in api/ are unchanged and mounted directly as routes
 * (they already read the raw request body and use Express-style req/res).
 *
 * Routes:
 *   GET       /health              — liveness probe
 *   GET|POST  /webhook             — Meta WhatsApp Cloud API
 *   GET|POST  /instagram-webhook   — Instagram DM (Meta Graph API)
 */

import "dotenv/config";
import express from "express";
import whatsappWebhook from "./api/webhook.js";
import instagramWebhook from "./api/instagram-webhook.js";

const app = express();
app.disable("x-powered-by");

// Mount the handlers as-is. No body parser is registered on these routes so
// the raw body stays readable for Meta's X-Hub-Signature-256 validation.
const mount = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res)).catch(next);

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
app.all("/webhook", mount(whatsappWebhook));
app.all("/instagram-webhook", mount(instagramWebhook));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[server] unhandled error:", err);
  if (!res.headersSent) res.status(500).json({ error: "internal_error" });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`[server] ai-receptionist listening on :${PORT}`);
});
