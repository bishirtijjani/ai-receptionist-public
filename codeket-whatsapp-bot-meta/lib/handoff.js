import nodemailer from "nodemailer";
import { logHandoff, markHandoffNotified, markHandedOff } from "./db.js";

/**
 * Handle a HANDOFF_HUMAN signal from the LLM.
 * 1. Logs the handoff to Supabase
 * 2. Sends an email alert to the spa owner / ops inbox
 * 3. Marks the conversation as handed_off
 *
 * @param {string} conversationId
 * @param {string} customerPhone      - Raw E.164, e.g. "+14155551234"
 * @param {string} reason
 * @param {"normal"|"high"} urgency
 * @param {string} lastCustomerMessage - Last thing the customer said (for context)
 * @param {object} spaConfig
 */
export async function handleHandoff({
  conversationId,
  customerPhone,
  reason,
  urgency,
  lastCustomerMessage,
  spaConfig,
}) {
  // 1. Log to DB
  await logHandoff(conversationId, reason, urgency);

  // 2. Send email alert
  try {
    await sendHandoffEmail({
      spaName: spaConfig.name,
      customerPhone,
      reason,
      urgency,
      lastMessage: lastCustomerMessage,
      conversationId,
    });
    await markHandoffNotified(conversationId);
  } catch (err) {
    // Email failure should not crash the webhook — log and continue
    console.error("Handoff email failed:", err.message);
  }

  // 3. Update conversation status
  await markHandedOff(conversationId);
}

async function sendHandoffEmail({
  spaName,
  customerPhone,
  reason,
  urgency,
  lastMessage,
  conversationId,
}) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const urgencyLabel = urgency === "high" ? "URGENT" : "Normal";
  const subject = urgency === "high"
    ? `[URGENT] Human needed — ${spaName} WhatsApp`
    : `[Handoff] Customer needs you — ${spaName} WhatsApp`;

  const body = `
A customer on WhatsApp needs a human response.

Spa: ${spaName}
Customer phone: ${customerPhone}
Reason: ${reason}
Priority: ${urgencyLabel}
Conversation ID: ${conversationId}

Last customer message:
"${lastMessage}"

Reply to the customer on WhatsApp or call them directly.
  `.trim();

  await transporter.sendMail({
    from: process.env.HANDOFF_EMAIL_FROM,
    to: process.env.HANDOFF_EMAIL_TO,
    subject,
    text: body,
  });
}
