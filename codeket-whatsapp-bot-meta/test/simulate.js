/**
 * Local conversation simulator — no Twilio, no Supabase needed.
 * Lets you test the bot by typing messages in the terminal.
 *
 *   node test/simulate.js
 *
 * Requires ANTHROPIC_API_KEY in .env
 */

import readline from "readline";
import { config } from "dotenv";
import { getReply } from "../lib/anthropic.js";
import { glowSpaConfig } from "../demo/glow-spa-config.js";

config();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const history = [];

console.log("\n── Glow Aesthetic Spa — WhatsApp Bot Simulator ──");
console.log("Type customer messages below. Type 'exit' to quit.\n");

function ask() {
  rl.question("Customer: ", async (input) => {
    if (input.trim().toLowerCase() === "exit") {
      rl.close();
      return;
    }
    if (!input.trim()) return ask();

    try {
      const { reply, handoff } = await getReply(glowSpaConfig, history, input);

      history.push({ role: "user", content: input });
      history.push({ role: "assistant", content: reply });

      console.log(`\nBot: ${reply}`);
      if (handoff) {
        console.log(`\n[HANDOFF TRIGGERED] reason: ${handoff.reason}, urgency: ${handoff.urgency}\n`);
      } else {
        console.log();
      }
    } catch (err) {
      console.error("Error:", err.message);
    }

    ask();
  });
}

ask();
