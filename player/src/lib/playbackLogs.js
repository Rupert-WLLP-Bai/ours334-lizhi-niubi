import "server-only";
import fs from "fs";
import os from "os";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const DB_FILE_NAME = "playback_logs.sqlite";
export const QUALIFIED_PLAY_SECONDS = 30;
const END_EVENTS = "'pause','ended','song_change','page_hide'";

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getPreferredDbPath() {
  const explicitFile = process.env.PLAYBACK_LOG_DB_PATH?.trim();
  if (explicitFile) {
    return path.resolve(explicitFile);
  }

  const explicitDir = process.env.PLAYBACK_LOG_DIR?.trim();
  if (explicitDir) {
    return path.resolve(explicitDir, DB_FILE_NAME);
  }

  return path.join(process.cwd(), "data", DB_FILE_NAME);
}

function getFallbackDbPath() {
  return path.join(os.homedir(), ".ours334-player", DB_FILE_NAME);
}

function getLastResortDbPath() {
  return path.join(os.tmpdir(), "ours334-player", DB_FILE_NAME);
}

function ensureSchema(db) {
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
    CREATE INDEX IF NOT EXISTS idx_playback_logs_song_created_at
    ON playback_logs (song_id, created_at);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_playback_logs_event_created_at
    ON playback_logs (event, created_at);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_playback_logs_user_created_at
    ON playback_logs (user_id, created_at);
  `);
}

function isReadonlySqliteError(error) {
  if (!error || typeof error !== "object") return false;
  const message = String(error.message || "");
  const errstr = String(error.errstr || "");
  return (
    message.toLowerCase().includes("readonly") ||
    errstr.toLowerCase().includes("readonly")
  );
}

function isColumnIndexOutOfRangeError(error) {
  if (!error || typeof error !== "object") return false;
  const message = String(error.message || "").toLowerCase();
  const errstr = String(error.errstr || "").toLowerCase();
  return (
    message.includes("column index out of range") ||
    errstr.includes("column index out of range")
  );
}

function openDbAtPath(dbPath) {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(dbPath, {
    open: true,
    readOnly: false,
  });

  ensureSchema(db);

  return {
    db,
    insertStmt: db.prepare(`
      INSERT INTO playback_logs (
        session_id,
        song_id,
        song_title,
        album_name,
        event,
        position_seconds,
        played_seconds,
        duration_seconds,
        pathname,
        user_agent,
        user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `),
  };
}

function closeDbIfPossible(db) {
  if (!db) return;
  try {
    db.close();
  } catch {
    // ignore close errors
  }
}

function resetDbState() {
  closeDbIfPossible(globalThis.__playbackDb);
  globalThis.__playbackDb = undefined;
  globalThis.__playbackInsertStmt = undefined;
  globalThis.__playbackDbPath = undefined;
}

function initializeDb(preferFallback = false) {
  const candidates = preferFallback
    ? unique([getFallbackDbPath(), getLastResortDbPath(), getPreferredDbPath()])
    : unique([getPreferredDbPath(), getFallbackDbPath(), getLastResortDbPath()]);

  /** @type {unknown[]} */
  const errors = [];

  for (const candidatePath of candidates) {
    try {
      const { db, insertStmt } = openDbAtPath(candidatePath);
      globalThis.__playbackDb = db;
      globalThis.__playbackInsertStmt = insertStmt;
      globalThis.__playbackDbPath = candidatePath;
      return;
    } catch (error) {
      errors.push(error);
    }
  }

  const details = errors
    .map((error) => (error instanceof Error ? error.message : String(error)))
    .join(" | ");
  throw new Error(`Failed to initialize playback log database: ${details}`);
}

/**
 * @typedef {Object} PlaybackLogEntry
 * @property {string} sessionId
 * @property {string} songId
 * @property {string} songTitle
 * @property {string} albumName
 * @property {string} event
 * @property {number} positionSeconds
 * @property {number} playedSeconds
 * @property {number | null | undefined} durationSeconds
 * @property {string} pathname
 * @property {string} userAgent
 * @property {number | null | undefined} [userId]
 */

/**
 * @returns {DatabaseSync}
 */
function getDb() {
  if (!globalThis.__playbackDb || !globalThis.__playbackInsertStmt) {
    resetDbState();
    initializeDb();
  }

  return globalThis.__playbackDb;
}

/**
 * @param {number | null | undefined} value
 * @returns {number | null}
 */
function normalizeNumber(value) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return value;
}

/**
 * @param {PlaybackLogEntry} entry
 */
export function insertPlaybackLog(entry) {
  getDb();
  const values = [
    entry.sessionId,
    entry.songId,
    entry.songTitle,
    entry.albumName,
    entry.event,
    normalizeNumber(entry.positionSeconds) ?? 0,
    normalizeNumber(entry.playedSeconds) ?? 0,
    normalizeNumber(entry.durationSeconds),
    entry.pathname,
    entry.userAgent,
    normalizeNumber(entry.userId),
  ];

  try {
    globalThis.__playbackInsertStmt.run(...values);
  } catch (error) {
    if (isReadonlySqliteError(error)) {
      // 当默认库只读时，切换到可写的 fallback 路径再重试一次
      resetDbState();
      initializeDb(true);
      globalThis.__playbackInsertStmt.run(...values);
      return;
    }

    if (isColumnIndexOutOfRangeError(error)) {
      // 开发模式热更新后可能残留旧的 prepared statement，重建后再试一次
      resetDbState();
      initializeDb();
      globalThis.__playbackInsertStmt.run(...values);
      return;
    }

    throw error;
  }
}

export function getPlaybackLogDbPath() {
  if (!globalThis.__playbackDbPath) {
    getDb();
  }
  return globalThis.__playbackDbPath;
}

function toSafeNumber(value) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return num;
}

export function getPlaybackStats(options = {}) {
  const db = getDb();
  const normalizedUserId = normalizeNumber(options.userId);
  const includeAnonymous = options.includeAnonymous === true;
  const whereClause = normalizedUserId === null
    ? includeAnonymous
      ? "1=1"
      : "user_id IS NOT NULL"
    : "user_id = ?";
  const whereParams = normalizedUserId === null ? [] : [normalizedUserId];

  const summaryRaw = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN event IN (${END_EVENTS}) THEN played_seconds ELSE 0 END), 0) AS total_played_seconds,
      COALESCE(SUM(CASE WHEN event IN (${END_EVENTS}) THEN 1 ELSE 0 END), 0) AS sessions,
      COALESCE(SUM(CASE WHEN event IN (${END_EVENTS}) AND played_seconds >= ? THEN 1 ELSE 0 END), 0) AS play_count,
      COALESCE(COUNT(DISTINCT CASE WHEN event IN (${END_EVENTS}) THEN song_id END), 0) AS song_count,
      COALESCE(COUNT(DISTINCT CASE WHEN event IN (${END_EVENTS}) THEN album_name END), 0) AS album_count
    FROM playback_logs
    WHERE ${whereClause};
  `).get(QUALIFIED_PLAY_SECONDS, ...whereParams);

  const songsRaw = db.prepare(`
    SELECT
      song_id AS song_id,
      song_title AS song_title,
      album_name AS album_name,
      SUM(CASE WHEN event IN (${END_EVENTS}) THEN played_seconds ELSE 0 END) AS total_played_seconds,
      SUM(CASE WHEN event IN (${END_EVENTS}) THEN 1 ELSE 0 END) AS sessions,
      SUM(CASE WHEN event IN (${END_EVENTS}) AND played_seconds >= ? THEN 1 ELSE 0 END) AS play_count,
      AVG(CASE WHEN event IN (${END_EVENTS}) THEN played_seconds ELSE NULL END) AS avg_session_seconds,
      MAX(created_at) AS last_played_at
    FROM playback_logs
    WHERE ${whereClause}
    GROUP BY song_id, song_title, album_name
    HAVING sessions > 0
    ORDER BY total_played_seconds DESC, play_count DESC, last_played_at DESC;
  `).all(QUALIFIED_PLAY_SECONDS, ...whereParams);

  const albumsRaw = db.prepare(`
    SELECT
      album_name AS album_name,
      SUM(CASE WHEN event IN (${END_EVENTS}) THEN played_seconds ELSE 0 END) AS total_played_seconds,
      SUM(CASE WHEN event IN (${END_EVENTS}) THEN 1 ELSE 0 END) AS sessions,
      SUM(CASE WHEN event IN (${END_EVENTS}) AND played_seconds >= ? THEN 1 ELSE 0 END) AS play_count,
      COUNT(DISTINCT CASE WHEN event IN (${END_EVENTS}) THEN song_id END) AS song_count,
      MAX(created_at) AS last_played_at
    FROM playback_logs
    WHERE ${whereClause}
    GROUP BY album_name
    HAVING sessions > 0
    ORDER BY total_played_seconds DESC, play_count DESC, last_played_at DESC;
  `).all(QUALIFIED_PLAY_SECONDS, ...whereParams);

  const summary = {
    totalPlayedSeconds: toSafeNumber(summaryRaw.total_played_seconds),
    sessions: toSafeNumber(summaryRaw.sessions),
    playCount: toSafeNumber(summaryRaw.play_count),
    songCount: toSafeNumber(summaryRaw.song_count),
    albumCount: toSafeNumber(summaryRaw.album_count),
  };

  const songs = songsRaw.map((row) => ({
    songId: String(row.song_id ?? ""),
    songTitle: String(row.song_title ?? ""),
    albumName: String(row.album_name ?? ""),
    totalPlayedSeconds: toSafeNumber(row.total_played_seconds),
    sessions: toSafeNumber(row.sessions),
    playCount: toSafeNumber(row.play_count),
    avgSessionSeconds: toSafeNumber(row.avg_session_seconds),
    lastPlayedAt: row.last_played_at ? String(row.last_played_at) : null,
  }));

  const albums = albumsRaw.map((row) => ({
    albumName: String(row.album_name ?? ""),
    totalPlayedSeconds: toSafeNumber(row.total_played_seconds),
    sessions: toSafeNumber(row.sessions),
    playCount: toSafeNumber(row.play_count),
    songCount: toSafeNumber(row.song_count),
    lastPlayedAt: row.last_played_at ? String(row.last_played_at) : null,
  }));

  return {
    thresholdSeconds: QUALIFIED_PLAY_SECONDS,
    summary,
    albums,
    songs,
  };
}
