import "server-only";
import { DatabaseSync } from "node:sqlite";
import { getPlaybackLogDbPath } from "@/lib/playbackLogs";
import {
  deleteRows,
  enqueueSupabaseSync,
  patchRows,
  upsertRows,
} from "@/lib/supabaseSync";

const DEFAULT_PLAYLIST_ID = "later";
const USER_ROLES = new Set(["admin", "user"]);

function normalizeAccount(account) {
  if (typeof account !== "string") return "";
  return account.trim().toLowerCase();
}

function toSafeInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.trunc(num);
}

function nowIso() {
  return new Date().toISOString();
}

function toBool(value) {
  if (value === true || value === false) return value;
  return Number(value) === 1;
}

function enqueueUserUpsert(user) {
  if (!user) return;
  enqueueSupabaseSync("users.upsert", async () => {
    await upsertRows(
      "users",
      [
        {
          id: Number(user.id),
          email: String(user.email),
          password_hash: String(user.passwordHash),
          role: String(user.role),
          is_active: toBool(user.isActive),
          created_at: String(user.createdAt),
          updated_at: String(user.updatedAt),
        },
      ],
      ["id"],
    );
  });
}

function enqueueAuthSessionUpsert(sessionRow) {
  if (!sessionRow) return;
  enqueueSupabaseSync("auth_sessions.upsert", async () => {
    await upsertRows(
      "auth_sessions",
      [
        {
          id: Number(sessionRow.id),
          user_id: Number(sessionRow.user_id),
          token_hash: String(sessionRow.token_hash),
          created_at: String(sessionRow.created_at),
          expires_at: String(sessionRow.expires_at),
        },
      ],
      ["token_hash"],
    );
  });
}

function enqueueFavoriteUpsert(row) {
  if (!row) return;
  enqueueSupabaseSync("favorite_songs.upsert", async () => {
    await upsertRows(
      "favorite_songs",
      [
        {
          id: Number(row.id),
          user_id: Number(row.user_id),
          song_id: String(row.song_id),
          song_title: String(row.song_title),
          album_name: String(row.album_name),
          created_at: String(row.created_at),
        },
      ],
      ["user_id", "song_id"],
    );
  });
}

function enqueuePlaylistSnapshotSync(userId, playlistId) {
  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) return;
  const normalizedPlaylistId = normalizePlaylistId(playlistId);
  const rows = listPlaylistItems(normalizedUserId, normalizedPlaylistId);

  enqueueSupabaseSync("playlist_items.snapshot", async () => {
    await deleteRows("playlist_items", [
      { column: "user_id", operator: "eq", value: normalizedUserId },
      { column: "playlist_id", operator: "eq", value: normalizedPlaylistId },
    ]);

    if (rows.length === 0) return;

    await upsertRows(
      "playlist_items",
      rows.map((row) => ({
        user_id: normalizedUserId,
        playlist_id: normalizedPlaylistId,
        song_id: row.songId,
        song_title: row.songTitle,
        album_name: row.albumName,
        position: Number(row.position),
        created_at: row.createdAt,
      })),
      ["user_id", "playlist_id", "song_id"],
    );
  });
}

function ensureSchema(db) {
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
    ON auth_sessions (user_id);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expire
    ON auth_sessions (expires_at);
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorite_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      song_id TEXT NOT NULL,
      song_title TEXT NOT NULL,
      album_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE(user_id, song_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_favorite_songs_user_created
    ON favorite_songs (user_id, created_at DESC);
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      playlist_id TEXT NOT NULL,
      song_id TEXT NOT NULL,
      song_title TEXT NOT NULL,
      album_name TEXT NOT NULL,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE(user_id, playlist_id, song_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_playlist_items_user_playlist_pos
    ON playlist_items (user_id, playlist_id, position);
  `);
}

function getDb() {
  if (!globalThis.__userLibraryDb) {
    const dbPath = getPlaybackLogDbPath();
    const db = new DatabaseSync(dbPath, {
      open: true,
      readOnly: false,
    });
    ensureSchema(db);
    globalThis.__userLibraryDb = db;
  }
  return globalThis.__userLibraryDb;
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    email: String(row.email),
    role: String(row.role),
    isActive: Number(row.is_active) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    passwordHash: String(row.password_hash),
  };
}

export function getUserById(userId) {
  const normalized = toSafeInt(userId);
  if (normalized === null) return null;
  const db = getDb();
  const row = db.prepare(`
    SELECT id, email, password_hash, role, is_active, created_at, updated_at
    FROM users
    WHERE id = ?;
  `).get(normalized);
  return mapUser(row);
}

export function getUserByEmail(email) {
  return getUserByAccount(email);
}

export function getUserByAccount(account) {
  const normalizedAccount = normalizeAccount(account);
  if (!normalizedAccount) return null;
  const db = getDb();
  const row = db.prepare(`
    SELECT id, email, password_hash, role, is_active, created_at, updated_at
    FROM users
    WHERE email = ?;
  `).get(normalizedAccount);
  return mapUser(row);
}

export function createUser({ email, passwordHash, role = "user" }) {
  const account = typeof email === "string" ? email : "";
  const normalizedAccount = normalizeAccount(account);
  if (!normalizedAccount) {
    throw new Error("Account is required");
  }
  if (typeof passwordHash !== "string" || !passwordHash) {
    throw new Error("Password hash is required");
  }
  const normalizedRole = USER_ROLES.has(role) ? role : "user";
  const db = getDb();
  const now = nowIso();
  const result = db.prepare(`
    INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?);
  `).run(normalizedAccount, passwordHash, normalizedRole, now, now);
  const user = getUserById(result.lastInsertRowid);
  enqueueUserUpsert(user);
  return user;
}

export function upsertUserByEmail({ email, passwordHash, role = "user" }) {
  return upsertUserByAccount({ account: email, passwordHash, role });
}

export function upsertUserByAccount({ account, passwordHash, role = "user" }) {
  const existing = getUserByAccount(account);
  if (existing) {
    const db = getDb();
    const now = nowIso();
    const normalizedRole = USER_ROLES.has(role) ? role : existing.role;
    db.prepare(`
      UPDATE users
      SET password_hash = ?, role = ?, is_active = 1, updated_at = ?
      WHERE id = ?;
    `).run(passwordHash, normalizedRole, now, existing.id);
    const user = getUserById(existing.id);
    enqueueUserUpsert(user);
    return user;
  }
  return createUser({ email: account, passwordHash, role });
}

export function createAuthSession({ userId, tokenHash, expiresAt }) {
  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");
  if (typeof tokenHash !== "string" || !tokenHash) throw new Error("Invalid token hash");
  if (typeof expiresAt !== "string" || !expiresAt) throw new Error("Invalid expiresAt");

  const db = getDb();
  const createdAt = nowIso();
  const result = db.prepare(`
    INSERT INTO auth_sessions (user_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?);
  `).run(normalizedUserId, tokenHash, createdAt, expiresAt);
  const row = db.prepare(`
    SELECT id, user_id, token_hash, created_at, expires_at
    FROM auth_sessions
    WHERE id = ?;
  `).get(Number(result.lastInsertRowid));
  enqueueAuthSessionUpsert(row);
}

export function deleteAuthSession(tokenHash) {
  if (typeof tokenHash !== "string" || !tokenHash) return;
  const db = getDb();
  db.prepare(`DELETE FROM auth_sessions WHERE token_hash = ?;`).run(tokenHash);
  enqueueSupabaseSync("auth_sessions.delete", async () => {
    await deleteRows("auth_sessions", [
      { column: "token_hash", operator: "eq", value: tokenHash },
    ]);
  });
}

export function deleteExpiredSessions() {
  const db = getDb();
  const cutoff = nowIso();
  db.prepare(`DELETE FROM auth_sessions WHERE expires_at <= ?;`).run(cutoff);
  enqueueSupabaseSync("auth_sessions.delete_expired", async () => {
    await deleteRows("auth_sessions", [
      { column: "expires_at", operator: "lte", value: cutoff },
    ]);
  });
}

export function getSessionUserByTokenHash(tokenHash) {
  if (typeof tokenHash !== "string" || !tokenHash) return null;
  const db = getDb();
  deleteExpiredSessions();
  const row = db.prepare(`
    SELECT
      u.id AS id,
      u.email AS email,
      u.password_hash AS password_hash,
      u.role AS role,
      u.is_active AS is_active,
      u.created_at AS created_at,
      u.updated_at AS updated_at,
      s.expires_at AS session_expires_at
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
    LIMIT 1;
  `).get(tokenHash);
  const user = mapUser(row);
  if (!user || !user.isActive) return null;
  return {
    ...user,
    sessionExpiresAt: String(row.session_expires_at),
  };
}

export function listFavoriteSongs(userId) {
  const normalized = toSafeInt(userId);
  if (normalized === null) return [];
  const db = getDb();
  return db.prepare(`
    SELECT song_id, song_title, album_name, created_at
    FROM favorite_songs
    WHERE user_id = ?
    ORDER BY created_at DESC;
  `).all(normalized).map((row) => ({
    songId: String(row.song_id),
    songTitle: String(row.song_title),
    albumName: String(row.album_name),
    createdAt: String(row.created_at),
  }));
}

export function addFavoriteSong({ userId, songId, songTitle, albumName }) {
  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");
  if (!songId || !songTitle || !albumName) throw new Error("Missing song payload");
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO favorite_songs (user_id, song_id, song_title, album_name)
    VALUES (?, ?, ?, ?);
  `).run(normalizedUserId, songId, songTitle, albumName);
  const row = db.prepare(`
    SELECT id, user_id, song_id, song_title, album_name, created_at
    FROM favorite_songs
    WHERE user_id = ? AND song_id = ?
    LIMIT 1;
  `).get(normalizedUserId, songId);
  enqueueFavoriteUpsert(row);
}

export function removeFavoriteSong({ userId, songId }) {
  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");
  if (!songId) return;
  const db = getDb();
  db.prepare(`
    DELETE FROM favorite_songs
    WHERE user_id = ? AND song_id = ?;
  `).run(normalizedUserId, songId);
  enqueueSupabaseSync("favorite_songs.delete", async () => {
    await deleteRows("favorite_songs", [
      { column: "user_id", operator: "eq", value: normalizedUserId },
      { column: "song_id", operator: "eq", value: songId },
    ]);
  });
}

function normalizePlaylistId(playlistId) {
  if (typeof playlistId !== "string") return DEFAULT_PLAYLIST_ID;
  const trimmed = playlistId.trim();
  return trimmed || DEFAULT_PLAYLIST_ID;
}

function compactPlaylistPositions(db, userId, playlistId) {
  const rows = db.prepare(`
    SELECT id
    FROM playlist_items
    WHERE user_id = ? AND playlist_id = ?
    ORDER BY position ASC, id ASC;
  `).all(userId, playlistId);
  const updateStmt = db.prepare(`
    UPDATE playlist_items
    SET position = ?
    WHERE id = ?;
  `);
  rows.forEach((row, index) => {
    updateStmt.run(index, row.id);
  });
}

export function listPlaylistItems(userId, playlistId = DEFAULT_PLAYLIST_ID) {
  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) return [];
  const normalizedPlaylistId = normalizePlaylistId(playlistId);
  const db = getDb();
  return db.prepare(`
    SELECT song_id, song_title, album_name, position, created_at
    FROM playlist_items
    WHERE user_id = ? AND playlist_id = ?
    ORDER BY position ASC, id ASC;
  `).all(normalizedUserId, normalizedPlaylistId).map((row) => ({
    songId: String(row.song_id),
    songTitle: String(row.song_title),
    albumName: String(row.album_name),
    position: Number(row.position),
    createdAt: String(row.created_at),
  }));
}

export function addPlaylistItem({ userId, playlistId = DEFAULT_PLAYLIST_ID, songId, songTitle, albumName }) {
  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");
  if (!songId || !songTitle || !albumName) throw new Error("Missing playlist payload");
  const normalizedPlaylistId = normalizePlaylistId(playlistId);
  const db = getDb();

  db.exec("BEGIN IMMEDIATE;");
  try {
    const existing = db.prepare(`
      SELECT 1
      FROM playlist_items
      WHERE user_id = ? AND playlist_id = ? AND song_id = ?
      LIMIT 1;
    `).get(normalizedUserId, normalizedPlaylistId, songId);
    if (existing) {
      db.exec("COMMIT;");
      return false;
    }
    const maxRow = db.prepare(`
      SELECT COALESCE(MAX(position), -1) AS max_position
      FROM playlist_items
      WHERE user_id = ? AND playlist_id = ?;
    `).get(normalizedUserId, normalizedPlaylistId);
    const nextPosition = Number(maxRow.max_position) + 1;
    db.prepare(`
      INSERT INTO playlist_items (user_id, playlist_id, song_id, song_title, album_name, position)
      VALUES (?, ?, ?, ?, ?, ?);
    `).run(normalizedUserId, normalizedPlaylistId, songId, songTitle, albumName, nextPosition);
    db.exec("COMMIT;");
    enqueuePlaylistSnapshotSync(normalizedUserId, normalizedPlaylistId);
    return true;
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function removePlaylistItem({ userId, playlistId = DEFAULT_PLAYLIST_ID, songId }) {
  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");
  if (!songId) return;
  const normalizedPlaylistId = normalizePlaylistId(playlistId);
  const db = getDb();

  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare(`
      DELETE FROM playlist_items
      WHERE user_id = ? AND playlist_id = ? AND song_id = ?;
    `).run(normalizedUserId, normalizedPlaylistId, songId);
    compactPlaylistPositions(db, normalizedUserId, normalizedPlaylistId);
    db.exec("COMMIT;");
    enqueuePlaylistSnapshotSync(normalizedUserId, normalizedPlaylistId);
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function reorderPlaylistItems({ userId, playlistId = DEFAULT_PLAYLIST_ID, songIds }) {
  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");
  if (!Array.isArray(songIds) || songIds.length === 0) {
    throw new Error("songIds is required");
  }
  const normalizedPlaylistId = normalizePlaylistId(playlistId);
  const db = getDb();

  const existing = db.prepare(`
    SELECT song_id
    FROM playlist_items
    WHERE user_id = ? AND playlist_id = ?;
  `).all(normalizedUserId, normalizedPlaylistId).map((row) => String(row.song_id));
  if (existing.length !== songIds.length) return false;
  const set = new Set(existing);
  if (!songIds.every((songId) => set.has(songId))) return false;

  const updateStmt = db.prepare(`
    UPDATE playlist_items
    SET position = ?
    WHERE user_id = ? AND playlist_id = ? AND song_id = ?;
  `);

  db.exec("BEGIN IMMEDIATE;");
  try {
    songIds.forEach((songId, index) => {
      updateStmt.run(index, normalizedUserId, normalizedPlaylistId, songId);
    });
    db.exec("COMMIT;");
    enqueuePlaylistSnapshotSync(normalizedUserId, normalizedPlaylistId);
    return true;
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function migratePlaybackLogsToUserId(userId) {
  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");
  const db = getDb();
  const before = db.prepare(`SELECT COUNT(*) AS count FROM playback_logs WHERE user_id IS NULL;`).get();
  db.prepare(`
    UPDATE playback_logs
    SET user_id = ?
    WHERE user_id IS NULL;
  `).run(normalizedUserId);
  enqueueSupabaseSync("playback_logs.patch_user_id", async () => {
    await patchRows(
      "playback_logs",
      { user_id: normalizedUserId },
      [{ column: "user_id", operator: "is", value: null }],
    );
  });
  const after = db.prepare(`SELECT COUNT(*) AS count FROM playback_logs WHERE user_id IS NULL;`).get();
  return {
    migratedCount: Number(before.count) - Number(after.count),
    remainingNullCount: Number(after.count),
  };
}

export const DEFAULT_LIBRARY_PLAYLIST_ID = DEFAULT_PLAYLIST_ID;
