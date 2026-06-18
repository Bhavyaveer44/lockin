// Non-destructive schema init: creates the `lockin` schema + tables only.
// Safe to run against a Neon DB shared with other projects — it never drops
// or alters anything outside the `lockin` schema.
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

const statements = [
  `CREATE SCHEMA IF NOT EXISTS lockin`,
  `CREATE TABLE IF NOT EXISTS lockin.sessions (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id text NOT NULL,
     started_at timestamptz NOT NULL DEFAULT now(),
     ended_at timestamptz
   )`,
  `CREATE TABLE IF NOT EXISTS lockin.signal_events (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     session_id uuid NOT NULL REFERENCES lockin.sessions(id) ON DELETE CASCADE,
     user_id text NOT NULL,
     state text NOT NULL,
     started_at timestamptz NOT NULL,
     duration_sec integer NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS signal_user_started_idx ON lockin.signal_events (user_id, started_at)`,
  `CREATE INDEX IF NOT EXISTS signal_session_idx ON lockin.signal_events (session_id)`,
];

for (const s of statements) {
  await sql.query(s);
  console.log("ok:", s.split("\n")[0].trim());
}
console.log("lockin schema ready");
