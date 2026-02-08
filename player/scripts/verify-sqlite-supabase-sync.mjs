#!/usr/bin/env node
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function resolveDbPath(rawPath) {
  if (rawPath) return path.resolve(rawPath);
  if (process.env.PLAYBACK_LOG_DB_PATH?.trim()) {
    return path.resolve(process.env.PLAYBACK_LOG_DB_PATH.trim());
  }
  if (process.env.PLAYBACK_LOG_DIR?.trim()) {
    return path.resolve(process.env.PLAYBACK_LOG_DIR.trim(), "playback_logs.sqlite");
  }
  return path.resolve(process.cwd(), "data", "playback_logs.sqlite");
}

function getConfig() {
  const baseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const schema = String(process.env.SUPABASE_SCHEMA || "public").trim() || "public";
  if (!baseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return { baseUrl, serviceRoleKey, schema };
}

function buildHeaders(config) {
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Prefer: "count=exact",
  };
  if (config.schema !== "public") {
    headers["Accept-Profile"] = config.schema;
  }
  return headers;
}

function tableExists(db, tableName) {
  const row = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
    LIMIT 1;
  `).get(tableName);
  return Boolean(row && row.name);
}

function countLocalRows(db, tableName) {
  if (!tableExists(db, tableName)) return null;
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName};`).get();
  return Number(row.count);
}

async function countSupabaseRows(config, tableName) {
  const url = new URL(`/rest/v1/${tableName}`, config.baseUrl);
  url.searchParams.set("select", "id");
  url.searchParams.set("limit", "1");
  const response = await fetch(url.toString(), {
    method: "HEAD",
    headers: buildHeaders(config),
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    const text = await response.text().catch(() => "");
    throw new Error(`${tableName} count failed: ${response.status} ${text}`);
  }
  const contentRange = response.headers.get("content-range");
  if (!contentRange) return 0;
  const total = Number(contentRange.split("/")[1] || 0);
  return Number.isFinite(total) ? total : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = resolveDbPath(args.db);
  const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
  const config = getConfig();
  const tables = ["users", "auth_sessions", "favorite_songs", "playlist_items", "playback_logs"];

  try {
    console.log(`SQLite DB: ${dbPath}`);
    console.log(`Supabase: ${config.baseUrl}`);
    console.log("");

    for (const tableName of tables) {
      const localCount = countLocalRows(db, tableName);
      if (localCount === null) {
        console.log(`- ${tableName}: sqlite table not found (skip)`);
        continue;
      }
      const remoteCount = await countSupabaseRows(config, tableName);
      if (remoteCount === null) {
        console.log(`- ${tableName}: supabase table missing`);
        continue;
      }
      const status = remoteCount >= localCount ? "OK" : "MISMATCH";
      console.log(`- ${tableName}: local=${localCount}, supabase=${remoteCount} -> ${status}`);
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error("Verify failed:", error);
  process.exit(1);
});
