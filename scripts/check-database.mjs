import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const envPath = path.join(projectRoot, ".env");

function loadEnvFile() {
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    if (url.username) url.username = "***";
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "[invalid URL]";
  }
}

function connectionAdvice(value) {
  try {
    const url = new URL(value);
    const isSupabaseDirect =
      url.hostname.startsWith("db.") &&
      url.hostname.endsWith(".supabase.co") &&
      (url.port === "" || url.port === "5432");

    if (!isSupabaseDirect) return "";

    return [
      "",
      "This is the direct Supabase database endpoint.",
      "On free Supabase projects it is IPv6-only unless you enabled the IPv4 add-on.",
      "For local app runtime on IPv4 networks, set DATABASE_URL to the Session pooler URL instead:",
      "postgresql://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:5432/postgres?sslmode=require",
    ].join("\n");
  } catch {
    return "";
  }
}

loadEnvFile();

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL or SUPABASE_DB_URL is required.");
  process.exit(1);
}

console.log(`Testing database connection: ${redactUrl(databaseUrl)}`);

const client = new pg.Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10_000,
});

try {
  await client.connect();
  const result = await client.query(
    "select current_database() as database, current_schema() as schema",
  );
  console.log(
    `Database connection OK: ${result.rows[0].database}, schema ${result.rows[0].schema}`,
  );
} catch (error) {
  console.error("Database connection failed.");
  console.error(error instanceof Error ? error.message : error);
  const advice = connectionAdvice(databaseUrl);
  if (advice) console.error(advice);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
