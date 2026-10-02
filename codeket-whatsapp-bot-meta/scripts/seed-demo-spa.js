/**
 * Seeds the Glow Aesthetic Spa demo config into Supabase.
 * Run once after creating the schema:
 *
 *   node scripts/seed-demo-spa.js
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (or env vars).
 */

import { createClient } from "@supabase/supabase-js";
import { glowSpaConfig } from "../demo/glow-spa-config.js";
import { config } from "dotenv";

config(); // load .env

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seed() {
  const { error } = await supabase
    .from("spa_configs")
    .upsert(
      {
        id: glowSpaConfig.id,
        name: glowSpaConfig.name,
        config: glowSpaConfig,
        active: true,
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }

  console.log(`Seeded spa config: ${glowSpaConfig.name} (id: ${glowSpaConfig.id})`);
}

seed();
