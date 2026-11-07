/**
 * Standalone Node HTTP server for the AI Receptionist WhatsApp AI receptionist.
 *
 * Replaces the Vercel serverless runtime with a real, long-running server.
 * The webhook handlers in api/ are unchanged and mounted directly as routes
 * (they already read the raw request body and use Express-style req/res).
 *
 * Routes:
 *   GET       /health              — liveness probe
 *   GET|POST  /webhook             — Meta WhatsApp Cloud API
 *   GET|POST  /instagram-webhook   — Instagram DM (Meta Graph API)
 *   GET       /admin              — monitoring dashboard (Basic Auth)
 *   GET       /admin/api/*        — read-only JSON for the dashboard
 */

import "dotenv/config";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import whatsappWebhook from "./api/webhook.js";
import instagramWebhook from "./api/instagram-webhook.js";
import {
  getStats,
  listConversations,
  getConversation,
  listHandoffs,
  listBookings,
} from "./lib/admin-queries.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_DIR = path.join(__dirname, "admin");

const app = express();
app.disable("x-powered-by");

// ── Channel webhooks ─────────────────────────────────────────────
// No body parser is registered on these routes so the raw body stays readable
// for Meta's X-Hub-Signature-256 validation.
const mount = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res)).catch(next);

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
app.all("/webhook", mount(whatsappWebhook));
app.all("/instagram-webhook", mount(instagramWebhook));

// ── Admin dashboard auth (HTTP Basic) ────────────────────────────

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function basicAuth(req, res, next) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) {
    return res.status(503).send("Admin dashboard not configured (set ADMIN_USER/ADMIN_PASSWORD)");
  }

  const header = req.headers.authorization ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx !== -1) {
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (safeEqual(u, user) && safeEqual(p, pass)) return next();
    }
  }

  res.set("WWW-Authenticate", 'Basic realm="AI Receptionist Admin", charset="UTF-8"');
  return res.status(401).send("Authentication required");
}

const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── Admin JSON API (read-only) ───────────────────────────────────

app.get("/admin/api/stats", basicAuth, asyncRoute(async (_req, res) => {
  res.json(await getStats());
}));

app.get("/admin/api/conversations", basicAuth, asyncRoute(async (req, res) => {
  res.json(await listConversations({
    channel: req.query.channel || undefined,
    status: req.query.status || undefined,
    search: req.query.search || undefined,
    limit: Math.min(Number(req.query.limit) || 50, 200),
    offset: Number(req.query.offset) || 0,
  }));
}));

app.get("/admin/api/conversations/:id", basicAuth, asyncRoute(async (req, res) => {
  const conversation = await getConversation(req.params.id);
  if (!conversation) return res.status(404).json({ error: "not_found" });
  res.json(conversation);
}));

app.get("/admin/api/handoffs", basicAuth, asyncRoute(async (_req, res) => {
  res.json(await listHandoffs());
}));

app.get("/admin/api/bookings", basicAuth, asyncRoute(async (_req, res) => {
  res.json(await listBookings());
}));

// ── Admin static frontend ────────────────────────────────────────

app.use("/admin", basicAuth, express.static(ADMIN_DIR));
app.get("/", (_req, res) => res.redirect("/admin/"));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[server] unhandled error:", err);
  if (!res.headersSent) res.status(500).json({ error: "internal_error" });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`[server] ai-receptionist listening on :${PORT}`);
});
