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

function isTruthy(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
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

function buildHeaders(config, extra = {}) {
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
  if (config.schema !== "public") {
    headers["Accept-Profile"] = config.schema;
    headers["Content-Profile"] = config.schema;
  }
  return headers;
}

function buildUrl(config, tableName, query = {}) {
  const url = new URL(`/rest/v1/${tableName}`, config.baseUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function upsertBatch(config, tableName, rows, onConflictColumns) {
  if (!rows.length) return;
  const response = await fetch(
    buildUrl(config, tableName, {
      on_conflict: onConflictColumns.join(","),
    }),
    {
      method: "POST",
      headers: buildHeaders(config, {
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify(rows),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Upsert failed for ${tableName}: ${response.status} ${text}`);
  }
}

async function remoteTableExists(config, tableName) {
  const response = await fetch(
    buildUrl(config, tableName, {
      select: "id",
      limit: 1,
    }),
    {
      method: "HEAD",
      headers: buildHeaders(config, {
        Prefer: "count=planned",
      }),
      cache: "no-store",
    },
  );

  if (response.status === 404) return false;
  if (response.ok) return true;

  const text = await response.text().catch(() => "");
  throw new Error(`Table check failed for ${tableName}: ${response.status} ${text}`);
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

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeRows(tableName, rows) {
  if (!rows.length) return rows;

  switch (tableName) {
    case "users":
      return rows.map((row) => ({
        id: Number(row.id),
        email: String(row.email),
        password_hash: String(row.password_hash),
        role: String(row.role),
        is_active: Number(row.is_active) === 1,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
      }));
    case "auth_sessions":
      return rows.map((row) => ({
        id: Number(row.id),
        user_id: Number(row.user_id),
        token_hash: String(row.token_hash),
        created_at: String(row.created_at),
        expires_at: String(row.expires_at),
      }));
    case "favorite_songs":
      return rows.map((row) => ({
        id: Number(row.id),
        user_id: Number(row.user_id),
        song_id: String(row.song_id),
        song_title: String(row.song_title),
        album_name: String(row.album_name),
        created_at: String(row.created_at),
      }));
    case "playlist_items":
      return rows.map((row) => ({
        id: Number(row.id),
        user_id: Number(row.user_id),
        playlist_id: String(row.playlist_id),
        song_id: String(row.song_id),
        song_title: String(row.song_title),
        album_name: String(row.album_name),
        position: Number(row.position),
        created_at: String(row.created_at),
      }));
    case "playback_logs":
      return rows.map((row) => ({
        id: Number(row.id),
        session_id: String(row.session_id),
        song_id: String(row.song_id),
        song_title: String(row.song_title),
        album_name: String(row.album_name),
        event: String(row.event),
        position_seconds: toNumberOrNull(row.position_seconds) ?? 0,
        played_seconds: toNumberOrNull(row.played_seconds) ?? 0,
        duration_seconds: toNumberOrNull(row.duration_seconds),
        pathname: String(row.pathname || ""),
        user_agent: String(row.user_agent || ""),
        user_id: toNumberOrNull(row.user_id),
        created_at: String(row.created_at),
      }));
    default:
      return rows;
  }
}

async function syncTable({
  db,
  config,
  tableName,
  onConflictColumns,
  batchSize,
  dryRun = false,
  fromCreatedAt = null,
}) {
  if (!tableExists(db, tableName)) {
    return {
      tableName,
      skipped: true,
      reason: "table not found in sqlite",
      syncedRows: 0,
    };
  }

  let lastId = 0;
  let syncedRows = 0;

  while (true) {
    let sql = `SELECT * FROM ${tableName} WHERE id > ?`;
    const params = [lastId];

    if (tableName === "playback_logs" && fromCreatedAt) {
      sql += " AND created_at >= ?";
      params.push(fromCreatedAt);
    }

    sql += " ORDER BY id ASC LIMIT ?";
    params.push(batchSize);

    const rows = db.prepare(sql).all(...params);
    if (!rows.length) break;

    const normalizedRows = normalizeRows(tableName, rows);
    if (!dryRun) {
      await upsertBatch(config, tableName, normalizedRows, onConflictColumns);
    }

    syncedRows += normalizedRows.length;
    lastId = Number(rows[rows.length - 1].id);
    console.log(`[${tableName}] synced ${syncedRows} rows...`);
  }

  return { tableName, skipped: false, syncedRows };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = isTruthy(args["dry-run"]);
  const batchSize = Math.max(1, Number(args["batch-size"] || process.env.SUPABASE_SYNC_BATCH_SIZE || 500));
  const fromCreatedAt = args["from-created-at"] ? String(args["from-created-at"]).trim() : null;
  const dbPath = resolveDbPath(args.db);
  const config = getConfig();

  const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
  const tables = [
    { tableName: "users", onConflictColumns: ["id"] },
    { tableName: "auth_sessions", onConflictColumns: ["token_hash"] },
    { tableName: "favorite_songs", onConflictColumns: ["user_id", "song_id"] },
    { tableName: "playlist_items", onConflictColumns: ["user_id", "playlist_id", "song_id"] },
    { tableName: "playback_logs", onConflictColumns: ["id"] },
  ];

  try {
    console.log(`SQLite DB: ${dbPath}`);
    console.log(`Supabase: ${config.baseUrl}`);
    console.log(`Schema: ${config.schema}`);
    console.log(`Batch size: ${batchSize}`);
    console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
    if (fromCreatedAt) {
      console.log(`Playback logs from: ${fromCreatedAt}`);
    }

    const missingRemoteTables = [];
    for (const table of tables) {
      const exists = await remoteTableExists(config, table.tableName);
      if (!exists) {
        missingRemoteTables.push(table.tableName);
      }
    }
    if (missingRemoteTables.length > 0) {
      throw new Error(
        `Missing Supabase tables: ${missingRemoteTables.join(", ")}. Run scripts/sql/supabase-init.sql in Supabase SQL Editor first.`,
      );
    }

    /** @type {Array<{tableName:string, skipped:boolean, syncedRows:number, reason?:string}>} */
    const results = [];
    for (const table of tables) {
      const result = await syncTable({
        db,
        config,
        tableName: table.tableName,
        onConflictColumns: table.onConflictColumns,
        batchSize,
        dryRun,
        fromCreatedAt,
      });
      results.push(result);
    }

    console.log("");
    console.log("Migration summary:");
    for (const item of results) {
      if (item.skipped) {
        console.log(`- ${item.tableName}: skipped (${item.reason})`);
      } else {
        console.log(`- ${item.tableName}: ${item.syncedRows} rows`);
      }
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
