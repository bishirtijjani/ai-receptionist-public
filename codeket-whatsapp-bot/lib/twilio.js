import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. "whatsapp:+14155238886"

/**
 * Send a WhatsApp message via Twilio.
 *
 * @param {string} to      - E.164 phone with whatsapp: prefix, e.g. "whatsapp:+14155551234"
 * @param {string} body    - Message text
 */
export async function sendWhatsAppMessage(to, body) {
  const message = await client.messages.create({
    from: FROM,
    to,
    body,
  });
  return message.sid;
}

/**
 * Parse a Twilio WhatsApp webhook POST body.
 * Twilio sends URL-encoded form data.
 *
 * @param {string} rawBody - Raw request body string
 * @returns {{ from: string, body: string, to: string }}
 */
export function parseTwilioWebhook(rawBody) {
  const params = new URLSearchParams(rawBody);
  return {
    from: params.get("From") ?? "",   // e.g. "whatsapp:+14155551234"
    body: params.get("Body") ?? "",   // customer's message text
    to: params.get("To") ?? "",       // your Twilio number
  };
}

/**
 * Validate Twilio webhook signature.
 * Call this before processing any webhook to prevent spoofing.
 *
 * @param {string} authToken    - process.env.TWILIO_AUTH_TOKEN
 * @param {string} signature    - X-Twilio-Signature header value
 * @param {string} url          - Full webhook URL
 * @param {object} params       - Parsed body params as key-value object
 * @returns {boolean}
 */
export function validateTwilioSignature(authToken, signature, url, params) {
  return twilio.validateRequest(authToken, signature, url, params);
}
