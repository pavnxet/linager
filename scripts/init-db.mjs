import { createClient } from "@libsql/client/web";
import * as fs from "fs";
const url = process.env.TURSO_DATABASE_URL || "libsql://linager-qijubevadi.aws-ap-south-1.turso.io";
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!authToken) {
  console.error("Please set TURSO_AUTH_TOKEN environment variable before running db:init");
  process.exit(1);
}
const client = createClient({ url, authToken });
async function init() {
  console.log("Connecting to Turso Cloud DB...");
  const sql = fs.readFileSync("scripts/schema.sql", "utf-8");
  const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0);
  for (const statement of statements) {
    console.log("Executing: " + statement.slice(0, 40).replace(/\r?\n/g, " ") + "...");
    await client.execute(statement);
  }
  console.log("Schema initialized successfully in Turso DB!");
}
init().catch(err => {
  console.error("Database migration error:", err);
  process.exit(1);
});