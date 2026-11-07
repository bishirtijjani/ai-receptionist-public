/**
 * Seeds the Example Spa demo config into Supabase.
 * Run once after creating the schema:
 *
 *   node scripts/seed-demo-spa.js
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (or env vars).
 */

import { createClient } from "@supabase/supabase-js";
import { example-spaSpaConfig } from "../demo/example-spa-spa-config.js";
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
        id: example-spaSpaConfig.id,
        name: example-spaSpaConfig.name,
        config: example-spaSpaConfig,
        active: true,
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }

  console.log(`Seeded spa config: ${example-spaSpaConfig.name} (id: ${example-spaSpaConfig.id})`);
}

seed();
