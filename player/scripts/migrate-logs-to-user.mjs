#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      result[key] = "true";
      continue;
    }
    result[key] = value;
    i += 1;
  }
  return result;
}

function resolveDbPath(rawPath) {
  if (rawPath) return path.resolve(rawPath);
  return path.resolve(process.cwd(), "data", "playback_logs.sqlite");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password ?? ""), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function ensurePlaybackColumn(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS playback_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      song_id TEXT NOT NULL,
      song_title TEXT NOT NULL,
      album_name TEXT NOT NULL,
      event TEXT NOT NULL,
      position_seconds REAL NOT NULL DEFAULT 0,
      played_seconds REAL NOT NULL DEFAULT 0,
      duration_seconds REAL,
      pathname TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  const columns = db.prepare(`PRAGMA table_info(playback_logs);`).all();
  const hasUserId = columns.some((column) => String(column.name) === "user_id");
  if (!hasUserId) {
    db.exec(`ALTER TABLE playback_logs ADD COLUMN user_id INTEGER;`);
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_playback_logs_user_created_at
    ON playback_logs (user_id, created_at);
  `);
}

function ensureUserTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email
    ON users (email);
  `);
}

function backupDatabase(dbPath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${dbPath}.bak.${stamp}`;
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = String(args.email || "").trim().toLowerCase();
  const password = String(args.password || "").trim();
  const role = String(args.role || "user").trim() === "admin" ? "admin" : "user";
  const dbPath = resolveDbPath(args.db);

  if (!email || !password) {
    console.error("Usage: node scripts/migrate-logs-to-user.mjs --email <email> --password <password> [--db data/playback_logs.sqlite] [--role user|admin]");
    process.exit(1);
  }
  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
  }

  const backupPath = backupDatabase(dbPath);
  const db = new DatabaseSync(dbPath, {
    open: true,
    readOnly: false,
  });

  try {
    db.exec("BEGIN IMMEDIATE;");
    ensureUserTables(db);
    ensurePlaybackColumn(db);

    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();
    const existing = db.prepare(`SELECT id FROM users WHERE email = ? LIMIT 1;`).get(email);
    let userId;
    if (existing) {
      userId = Number(existing.id);
      db.prepare(`
        UPDATE users
        SET password_hash = ?, role = ?, is_active = 1, updated_at = ?
        WHERE id = ?;
      `).run(passwordHash, role, now, userId);
    } else {
      const result = db.prepare(`
        INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?);
      `).run(email, passwordHash, role, now, now);
      userId = Number(result.lastInsertRowid);
    }

    const before = db.prepare(`SELECT COUNT(*) AS count FROM playback_logs WHERE user_id IS NULL;`).get();
    db.prepare(`
      UPDATE playback_logs
      SET user_id = ?
      WHERE user_id IS NULL;
    `).run(userId);
    const after = db.prepare(`SELECT COUNT(*) AS count FROM playback_logs WHERE user_id IS NULL;`).get();
    const owned = db.prepare(`SELECT COUNT(*) AS count FROM playback_logs WHERE user_id = ?;`).get(userId);
    const total = db.prepare(`SELECT COUNT(*) AS count FROM playback_logs;`).get();

    db.exec("COMMIT;");

    console.log("Migration finished.");
    console.log(`DB: ${dbPath}`);
    console.log(`Backup: ${backupPath}`);
    console.log(`User: ${email} (id=${userId}, role=${role})`);
    console.log(`Total logs: ${Number(total.count)}`);
    console.log(`Migrated logs: ${Number(before.count) - Number(after.count)}`);
    console.log(`Remaining NULL user_id logs: ${Number(after.count)}`);
    console.log(`Logs owned by target user: ${Number(owned.count)}`);
  } catch (error) {
    db.exec("ROLLBACK;");
    console.error("Migration failed:", error);
    console.error(`Restore from backup if needed: ${backupPath}`);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
