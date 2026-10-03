/**
 * Seeds the Glow Aesthetic Spa demo config into PostgreSQL.
 * Run once after creating the schema:
 *
 *   node db/schema.sql   (via psql)
 *   npm run seed
 *
 * Requires DATABASE_URL in .env (or env vars).
 */

import "dotenv/config";
import pg from "pg";
import { glowSpaConfig } from "../demo/glow-spa-config.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  try {
    await pool.query(
      `insert into spa_configs (id, name, config, active)
       values ($1, $2, $3, true)
       on conflict (id) do update
         set name = excluded.name,
             config = excluded.config,
             active = true,
             updated_at = now()`,
      [glowSpaConfig.id, glowSpaConfig.name, JSON.stringify(glowSpaConfig)]
    );
    console.log(`Seeded spa config: ${glowSpaConfig.name} (id: ${glowSpaConfig.id})`);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
