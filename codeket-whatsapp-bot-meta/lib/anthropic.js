import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./system-prompt.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 512;
// Keep last N messages for context (keeps costs low, covers any realistic conversation)
const CONTEXT_WINDOW = 20;

/**
 * Call Claude Haiku with the conversation history.
 *
 * @param {object} spaConfig - Full spa config object (from Supabase or demo config)
 * @param {Array}  history   - Array of { role: "user"|"assistant", content: string }
 * @param {string} newMessage - Latest customer message
 * @returns {{ reply: string, handoff: object|null }}
 */
export async function getReply(spaConfig, history, newMessage) {
  const systemPrompt = buildSystemPrompt(spaConfig);

  // Trim to context window, always keep most recent messages
  const trimmedHistory = history.slice(-CONTEXT_WINDOW);

  const messages = [
    ...trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: newMessage },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  });

  const rawText = response.content[0]?.text ?? "";

  // Parse HANDOFF_HUMAN signal if present
  const handoff = parseHandoff(rawText);

  // Strip the HANDOFF signal line from the customer-facing reply
  const reply = rawText
    .replace(/HANDOFF_HUMAN\(.*?\)/g, "")
    .trim();

  return { reply, handoff };
}

/**
 * Extracts HANDOFF_HUMAN(...) from model output.
 * Returns null if no handoff was signalled.
 *
 * @param {string} text
 * @returns {{ reason: string, urgency: "normal"|"high" }|null}
 */
function parseHandoff(text) {
  const match = text.match(/HANDOFF_HUMAN\(reason:\s*([^,)]+),?\s*urgency:\s*([^)]+)\)/i);
  if (!match) return null;
  return {
    reason: match[1].trim(),
    urgency: match[2].trim().toLowerCase() === "high" ? "high" : "normal",
  };
}
