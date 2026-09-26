import fs from "node:fs";
import pg from "pg";

function readEnv(name) {
  const text = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  if (!line) return "";
  let value = line.slice(name.length + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

const password = readEnv("SUPABASE_DB_PASSWORD");
const client = new pg.Client({
  host: readEnv("SUPABASE_DB_HOST"),
  port: Number(readEnv("SUPABASE_DB_PORT") || 5432),
  user: readEnv("SUPABASE_DB_USER"),
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const sql = fs.readFileSync(new URL("../supabase/migrations/001_sessions.sql", import.meta.url), "utf8");
  await client.query(sql);
  console.log("Migration applied.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replaceAll(password, "[redacted]"));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
