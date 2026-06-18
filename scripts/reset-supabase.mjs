import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(projectRoot, ".env");
const resetSqlPath = path.join(projectRoot, "supabase", "reset.sql");
const defaultStorageBucket = "bot-documents";

function loadEnvFile() {
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

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

function databaseUrl() {
  const value = process.env.SUPABASE_DB_URL || process.env.SUPABASE_URL;
  if (!value) {
    throw new Error(
      "Set SUPABASE_DB_URL in .env to your Supabase Postgres connection string.",
    );
  }

  if (!/^postgres(ql)?:\/\//.test(value)) {
    throw new Error(
      "SUPABASE_DB_URL must be a Postgres connection string, for example postgresql://postgres:password@db.project-ref.supabase.co:5432/postgres.",
    );
  }

  return value;
}

loadEnvFile();

if (!fs.existsSync(resetSqlPath)) {
  console.error(`Missing reset SQL file: ${resetSqlPath}`);
  process.exit(1);
}

let url;
try {
  url = databaseUrl();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const result = spawnSync(
  "psql",
  [
    url,
    "-v",
    "ON_ERROR_STOP=1",
    "-v",
    `storage_bucket=${process.env.SUPABASE_STORAGE_BUCKET || defaultStorageBucket}`,
    "-f",
    resetSqlPath,
  ],
  {
    cwd: projectRoot,
    stdio: "inherit",
    shell: false,
  },
);

if (result.error) {
  if (result.error.code === "ENOENT") {
    console.error("psql was not found. Install PostgreSQL client tools, then run npm run db:reset:supabase again.");
  } else {
    console.error(result.error.message);
  }
  process.exit(1);
}

process.exit(result.status ?? 1);
