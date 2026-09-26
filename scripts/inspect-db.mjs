import fs from "node:fs";
import pg from "pg";

function readEnv(name) {
  const text = fs.readFileSync(".env.local", "utf8");
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
const candidates = [
  {
    label: "direct-ipv6",
    host: "2406:da1a:b00:1301:f2f5:9099:8ec7:ac4d",
    user: "postgres",
    port: 5432,
    servername: "db.gsaxmrxgrpimgjvhidcb.supabase.co",
  },
  {
    label: "pooler-aws-1-session",
    host: "aws-1-ap-south-1.pooler.supabase.com",
    user: "postgres.gsaxmrxgrpimgjvhidcb",
    port: 5432,
  },
  {
    label: "pooler-aws-0-session",
    host: "aws-0-ap-south-1.pooler.supabase.com",
    user: "postgres.gsaxmrxgrpimgjvhidcb",
    port: 5432,
  },
  {
    label: "pooler-aws-1-transaction",
    host: "aws-1-ap-south-1.pooler.supabase.com",
    user: "postgres.gsaxmrxgrpimgjvhidcb",
    port: 6543,
  },
];

let client;
let connectedLabel = "";
const failures = [];
for (const candidate of candidates) {
  const attempt = new pg.Client({
    host: candidate.host,
    port: candidate.port,
    user: candidate.user,
    password,
    database: "postgres",
    ssl: {
      rejectUnauthorized: false,
      servername: candidate.servername ?? candidate.host,
    },
    connectionTimeoutMillis: 8000,
  });
  try {
    await attempt.connect();
    client = attempt;
    connectedLabel = candidate.label;
    break;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${candidate.label}: ${message.replaceAll(password, "[redacted]")}`);
    await attempt.end().catch(() => {});
  }
}

if (!client) {
  console.error(failures.join("\n"));
  process.exit(1);
}

try {
  console.log("connected", connectedLabel);
  await client.query("select 1");
  const version = await client.query("select version()");
  console.log(version.rows[0].version.split(",")[0]);
  const fn = await client.query(`
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'realtime' and p.proname = 'send'
  `);
  console.log("realtime.send", JSON.stringify(fn.rows));
  const messages = await client.query(`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'realtime' and table_name = 'messages'
    order by ordinal_position
  `);
  console.log("messages", messages.rows.map((row) => row.column_name).join(", "));
  const pub = await client.query(
    "select pubname from pg_publication where pubname = 'supabase_realtime'",
  );
  console.log("publication", pub.rows.length > 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(readEnv("SUPABASE_DB_PASSWORD"), "[redacted]"));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
