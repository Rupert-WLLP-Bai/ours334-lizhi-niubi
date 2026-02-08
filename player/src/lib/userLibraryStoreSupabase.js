import "server-only";
import * as localStore from "@/lib/userLibraryStore";
import {
  deleteRows,
  fetchRows,
  fetchRowsCount,
  getNextTableId,
  insertRows,
  isSupabasePrimaryEnabled,
  patchRows,
} from "@/lib/supabaseSync";

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

function toActive(value) {
  if (typeof value === "boolean") return value;
  return Number(value) === 1;
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    email: String(row.email),
    role: String(row.role),
    isActive: toActive(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    passwordHash: String(row.password_hash),
  };
}

function normalizePlaylistId(playlistId) {
  if (typeof playlistId !== "string") return localStore.DEFAULT_LIBRARY_PLAYLIST_ID;
  const trimmed = playlistId.trim();
  return trimmed || localStore.DEFAULT_LIBRARY_PLAYLIST_ID;
}

function backupLocal(taskName, fn) {
  try {
    fn();
  } catch (error) {
    console.error(`[local-backup] ${taskName} failed:`, error);
  }
}

async function compactPlaylistPositionsSupabase(userId, playlistId) {
  const rows = await fetchRows("playlist_items", {
    filters: [
      { column: "user_id", operator: "eq", value: userId },
      { column: "playlist_id", operator: "eq", value: playlistId },
    ],
    select: "song_id,position,id",
    orderBy: ["position.asc", "id.asc"],
  });

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    await patchRows(
      "playlist_items",
      { position: index },
      [
        { column: "user_id", operator: "eq", value: userId },
        { column: "playlist_id", operator: "eq", value: playlistId },
        { column: "song_id", operator: "eq", value: String(row.song_id) },
      ],
    );
  }
}

export async function getUserById(userId) {
  if (!isSupabasePrimaryEnabled()) {
    return localStore.getUserById(userId);
  }

  const normalized = toSafeInt(userId);
  if (normalized === null) return null;

  const row = await fetchRows("users", {
    filters: [{ column: "id", operator: "eq", value: normalized }],
    select: "id,email,password_hash,role,is_active,created_at,updated_at",
    limit: 1,
    single: true,
  });

  return mapUser(row);
}

export async function getUserByEmail(email) {
  return getUserByAccount(email);
}

export async function getUserByAccount(account) {
  if (!isSupabasePrimaryEnabled()) {
    return localStore.getUserByAccount(account);
  }

  const normalizedAccount = normalizeAccount(account);
  if (!normalizedAccount) return null;

  const row = await fetchRows("users", {
    filters: [{ column: "email", operator: "eq", value: normalizedAccount }],
    select: "id,email,password_hash,role,is_active,created_at,updated_at",
    limit: 1,
    single: true,
  });

  return mapUser(row);
}

export async function createUser({ email, passwordHash, role = "user" }) {
  if (!isSupabasePrimaryEnabled()) {
    return localStore.createUser({ email, passwordHash, role });
  }

  const normalizedAccount = normalizeAccount(email);
  if (!normalizedAccount) {
    throw new Error("Account is required");
  }
  if (typeof passwordHash !== "string" || !passwordHash) {
    throw new Error("Password hash is required");
  }
  const normalizedRole = USER_ROLES.has(role) ? role : "user";
  const now = nowIso();
  const nextId = await getNextTableId("users");

  const rows = await insertRows("users", [
    {
      id: nextId,
      email: normalizedAccount,
      password_hash: passwordHash,
      role: normalizedRole,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ]);
  const user = mapUser(rows[0]);
  if (!user) throw new Error("Failed to create user in supabase");

  backupLocal("users.create", () => {
    localStore.upsertUserByAccount({
      account: normalizedAccount,
      passwordHash,
      role: normalizedRole,
    });
  });

  return user;
}

export async function upsertUserByEmail({ email, passwordHash, role = "user" }) {
  return upsertUserByAccount({ account: email, passwordHash, role });
}

export async function upsertUserByAccount({ account, passwordHash, role = "user" }) {
  if (!isSupabasePrimaryEnabled()) {
    return localStore.upsertUserByAccount({ account, passwordHash, role });
  }

  const existing = await getUserByAccount(account);
  if (!existing) {
    return createUser({ email: account, passwordHash, role });
  }

  const now = nowIso();
  const normalizedRole = USER_ROLES.has(role) ? role : existing.role;
  await patchRows(
    "users",
    {
      password_hash: passwordHash,
      role: normalizedRole,
      is_active: true,
      updated_at: now,
    },
    [{ column: "id", operator: "eq", value: existing.id }],
  );

  const user = await getUserById(existing.id);
  backupLocal("users.upsert", () => {
    localStore.upsertUserByAccount({
      account: existing.email,
      passwordHash,
      role: normalizedRole,
    });
  });
  return user;
}

export async function createAuthSession({ userId, tokenHash, expiresAt }) {
  if (!isSupabasePrimaryEnabled()) {
    localStore.createAuthSession({ userId, tokenHash, expiresAt });
    return;
  }

  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");
  if (typeof tokenHash !== "string" || !tokenHash) throw new Error("Invalid token hash");
  if (typeof expiresAt !== "string" || !expiresAt) throw new Error("Invalid expiresAt");
  const nextId = await getNextTableId("auth_sessions");

  await insertRows("auth_sessions", [
    {
      id: nextId,
      user_id: normalizedUserId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    },
  ]);

  backupLocal("auth_sessions.create", () => {
    localStore.createAuthSession({
      userId: normalizedUserId,
      tokenHash,
      expiresAt,
    });
  });
}

export async function deleteAuthSession(tokenHash) {
  if (typeof tokenHash !== "string" || !tokenHash) return;

  if (!isSupabasePrimaryEnabled()) {
    localStore.deleteAuthSession(tokenHash);
    return;
  }

  await deleteRows("auth_sessions", [
    { column: "token_hash", operator: "eq", value: tokenHash },
  ]);

  backupLocal("auth_sessions.delete", () => {
    localStore.deleteAuthSession(tokenHash);
  });
}

export async function deleteExpiredSessions() {
  if (!isSupabasePrimaryEnabled()) {
    localStore.deleteExpiredSessions();
    return;
  }

  const cutoff = nowIso();
  await deleteRows("auth_sessions", [
    { column: "expires_at", operator: "lte", value: cutoff },
  ]);

  backupLocal("auth_sessions.deleteExpired", () => {
    localStore.deleteExpiredSessions();
  });
}

export async function getSessionUserByTokenHash(tokenHash) {
  if (!isSupabasePrimaryEnabled()) {
    return localStore.getSessionUserByTokenHash(tokenHash);
  }

  if (typeof tokenHash !== "string" || !tokenHash) return null;
  await deleteExpiredSessions();

  const row = await fetchRows("auth_sessions", {
    filters: [{ column: "token_hash", operator: "eq", value: tokenHash }],
    select: "user_id,expires_at",
    limit: 1,
    single: true,
  });
  if (!row) return null;

  const expiresAt = String(row.expires_at);
  if (new Date(expiresAt).getTime() <= Date.now()) {
    await deleteAuthSession(tokenHash);
    return null;
  }

  const user = await getUserById(Number(row.user_id));
  if (!user || !user.isActive) return null;
  return {
    ...user,
    sessionExpiresAt: expiresAt,
  };
}

export async function listFavoriteSongs(userId) {
  if (!isSupabasePrimaryEnabled()) {
    return localStore.listFavoriteSongs(userId);
  }

  const normalized = toSafeInt(userId);
  if (normalized === null) return [];

  const rows = await fetchRows("favorite_songs", {
    filters: [{ column: "user_id", operator: "eq", value: normalized }],
    select: "song_id,song_title,album_name,created_at",
    orderBy: ["created_at.desc"],
  });

  return rows.map((row) => ({
    songId: String(row.song_id),
    songTitle: String(row.song_title),
    albumName: String(row.album_name),
    createdAt: String(row.created_at),
  }));
}

export async function addFavoriteSong({ userId, songId, songTitle, albumName }) {
  if (!isSupabasePrimaryEnabled()) {
    localStore.addFavoriteSong({ userId, songId, songTitle, albumName });
    return;
  }

  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");
  if (!songId || !songTitle || !albumName) throw new Error("Missing song payload");

  const existing = await fetchRows("favorite_songs", {
    filters: [
      { column: "user_id", operator: "eq", value: normalizedUserId },
      { column: "song_id", operator: "eq", value: songId },
    ],
    select: "id",
    limit: 1,
    single: true,
  });
  if (!existing) {
    const nextId = await getNextTableId("favorite_songs");
    await insertRows("favorite_songs", [
      {
        id: nextId,
        user_id: normalizedUserId,
        song_id: songId,
        song_title: songTitle,
        album_name: albumName,
      },
    ]);
  }

  backupLocal("favorite_songs.add", () => {
    localStore.addFavoriteSong({ userId: normalizedUserId, songId, songTitle, albumName });
  });
}

export async function removeFavoriteSong({ userId, songId }) {
  if (!isSupabasePrimaryEnabled()) {
    localStore.removeFavoriteSong({ userId, songId });
    return;
  }

  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");
  if (!songId) return;

  await deleteRows("favorite_songs", [
    { column: "user_id", operator: "eq", value: normalizedUserId },
    { column: "song_id", operator: "eq", value: songId },
  ]);

  backupLocal("favorite_songs.remove", () => {
    localStore.removeFavoriteSong({ userId: normalizedUserId, songId });
  });
}

export async function listPlaylistItems(userId, playlistId = localStore.DEFAULT_LIBRARY_PLAYLIST_ID) {
  if (!isSupabasePrimaryEnabled()) {
    return localStore.listPlaylistItems(userId, playlistId);
  }

  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) return [];
  const normalizedPlaylistId = normalizePlaylistId(playlistId);

  const rows = await fetchRows("playlist_items", {
    filters: [
      { column: "user_id", operator: "eq", value: normalizedUserId },
      { column: "playlist_id", operator: "eq", value: normalizedPlaylistId },
    ],
    select: "song_id,song_title,album_name,position,created_at,id",
    orderBy: ["position.asc", "id.asc"],
  });

  return rows.map((row) => ({
    songId: String(row.song_id),
    songTitle: String(row.song_title),
    albumName: String(row.album_name),
    position: Number(row.position),
    createdAt: String(row.created_at),
  }));
}

export async function addPlaylistItem({
  userId,
  playlistId = localStore.DEFAULT_LIBRARY_PLAYLIST_ID,
  songId,
  songTitle,
  albumName,
}) {
  if (!isSupabasePrimaryEnabled()) {
    return localStore.addPlaylistItem({ userId, playlistId, songId, songTitle, albumName });
  }

  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");
  if (!songId || !songTitle || !albumName) throw new Error("Missing playlist payload");
  const normalizedPlaylistId = normalizePlaylistId(playlistId);

  const existing = await fetchRows("playlist_items", {
    filters: [
      { column: "user_id", operator: "eq", value: normalizedUserId },
      { column: "playlist_id", operator: "eq", value: normalizedPlaylistId },
      { column: "song_id", operator: "eq", value: songId },
    ],
    select: "song_id",
    limit: 1,
    single: true,
  });
  if (existing) return false;

  const maxRow = await fetchRows("playlist_items", {
    filters: [
      { column: "user_id", operator: "eq", value: normalizedUserId },
      { column: "playlist_id", operator: "eq", value: normalizedPlaylistId },
    ],
    select: "position,id",
    orderBy: ["position.desc", "id.desc"],
    limit: 1,
    single: true,
  });
  const nextPosition = maxRow ? Number(maxRow.position) + 1 : 0;
  const nextId = await getNextTableId("playlist_items");

  await insertRows("playlist_items", [
    {
      id: nextId,
      user_id: normalizedUserId,
      playlist_id: normalizedPlaylistId,
      song_id: songId,
      song_title: songTitle,
      album_name: albumName,
      position: nextPosition,
    },
  ]);

  backupLocal("playlist_items.add", () => {
    localStore.addPlaylistItem({
      userId: normalizedUserId,
      playlistId: normalizedPlaylistId,
      songId,
      songTitle,
      albumName,
    });
  });
  return true;
}

export async function removePlaylistItem({
  userId,
  playlistId = localStore.DEFAULT_LIBRARY_PLAYLIST_ID,
  songId,
}) {
  if (!isSupabasePrimaryEnabled()) {
    localStore.removePlaylistItem({ userId, playlistId, songId });
    return;
  }

  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");
  if (!songId) return;
  const normalizedPlaylistId = normalizePlaylistId(playlistId);

  await deleteRows("playlist_items", [
    { column: "user_id", operator: "eq", value: normalizedUserId },
    { column: "playlist_id", operator: "eq", value: normalizedPlaylistId },
    { column: "song_id", operator: "eq", value: songId },
  ]);
  await compactPlaylistPositionsSupabase(normalizedUserId, normalizedPlaylistId);

  backupLocal("playlist_items.remove", () => {
    localStore.removePlaylistItem({
      userId: normalizedUserId,
      playlistId: normalizedPlaylistId,
      songId,
    });
  });
}

export async function reorderPlaylistItems({
  userId,
  playlistId = localStore.DEFAULT_LIBRARY_PLAYLIST_ID,
  songIds,
}) {
  if (!isSupabasePrimaryEnabled()) {
    return localStore.reorderPlaylistItems({ userId, playlistId, songIds });
  }

  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");
  if (!Array.isArray(songIds) || songIds.length === 0) {
    throw new Error("songIds is required");
  }
  const normalizedPlaylistId = normalizePlaylistId(playlistId);

  const existing = await fetchRows("playlist_items", {
    filters: [
      { column: "user_id", operator: "eq", value: normalizedUserId },
      { column: "playlist_id", operator: "eq", value: normalizedPlaylistId },
    ],
    select: "song_id",
  });
  const existingSongIds = existing.map((row) => String(row.song_id));
  if (existingSongIds.length !== songIds.length) return false;
  const set = new Set(existingSongIds);
  if (!songIds.every((songId) => set.has(songId))) return false;

  for (let index = 0; index < songIds.length; index += 1) {
    const songId = songIds[index];
    await patchRows(
      "playlist_items",
      { position: index },
      [
        { column: "user_id", operator: "eq", value: normalizedUserId },
        { column: "playlist_id", operator: "eq", value: normalizedPlaylistId },
        { column: "song_id", operator: "eq", value: songId },
      ],
    );
  }

  backupLocal("playlist_items.reorder", () => {
    localStore.reorderPlaylistItems({
      userId: normalizedUserId,
      playlistId: normalizedPlaylistId,
      songIds,
    });
  });
  return true;
}

export async function migratePlaybackLogsToUserId(userId) {
  if (!isSupabasePrimaryEnabled()) {
    return localStore.migratePlaybackLogsToUserId(userId);
  }

  const normalizedUserId = toSafeInt(userId);
  if (normalizedUserId === null) throw new Error("Invalid user id");

  const before = await fetchRowsCount("playback_logs", [
    { column: "user_id", operator: "is", value: null },
  ]);
  await patchRows(
    "playback_logs",
    { user_id: normalizedUserId },
    [{ column: "user_id", operator: "is", value: null }],
  );
  const after = await fetchRowsCount("playback_logs", [
    { column: "user_id", operator: "is", value: null },
  ]);

  backupLocal("playback_logs.migrateUser", () => {
    localStore.migratePlaybackLogsToUserId(normalizedUserId);
  });

  return {
    migratedCount: before - after,
    remainingNullCount: after,
  };
}

export const DEFAULT_LIBRARY_PLAYLIST_ID = localStore.DEFAULT_LIBRARY_PLAYLIST_ID;
