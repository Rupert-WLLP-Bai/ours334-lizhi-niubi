import "server-only";
import {
  getPlaybackLogDbPath as getPlaybackLogDbPathLocal,
  getPlaybackStats as getPlaybackStatsLocal,
  insertPlaybackLog as insertPlaybackLogLocal,
  QUALIFIED_PLAY_SECONDS,
} from "@/lib/playbackLogs";
import {
  fetchAllRows,
  getNextTableId,
  insertRows,
  isSupabasePrimaryEnabled,
} from "@/lib/supabaseSync";

const END_EVENTS = new Set(["pause", "ended", "song_change", "page_hide"]);

function normalizeNumber(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

function toSafeNumber(value) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return num;
}

function compareIsoDesc(a, b) {
  const left = a ? new Date(a).getTime() : 0;
  const right = b ? new Date(b).getTime() : 0;
  return right - left;
}

function sortByMetricDesc(a, b) {
  if (b.totalPlayedSeconds !== a.totalPlayedSeconds) {
    return b.totalPlayedSeconds - a.totalPlayedSeconds;
  }
  if (b.playCount !== a.playCount) {
    return b.playCount - a.playCount;
  }
  return compareIsoDesc(a.lastPlayedAt, b.lastPlayedAt);
}

function buildStats(logRows, thresholdSeconds) {
  const summary = {
    totalPlayedSeconds: 0,
    sessions: 0,
    playCount: 0,
    songCount: 0,
    albumCount: 0,
  };
  const songMap = new Map();
  const albumMap = new Map();

  for (const row of logRows) {
    const event = String(row.event ?? "");
    if (!END_EVENTS.has(event)) continue;

    const playedSeconds = toSafeNumber(row.played_seconds);
    const songId = String(row.song_id ?? "");
    const songTitle = String(row.song_title ?? "");
    const albumName = String(row.album_name ?? "");
    const createdAt = row.created_at ? String(row.created_at) : null;

    summary.totalPlayedSeconds += playedSeconds;
    summary.sessions += 1;
    if (playedSeconds >= thresholdSeconds) {
      summary.playCount += 1;
    }

    const songKey = `${songId}:::${songTitle}:::${albumName}`;
    const song = songMap.get(songKey) ?? {
      songId,
      songTitle,
      albumName,
      totalPlayedSeconds: 0,
      sessions: 0,
      playCount: 0,
      avgSessionSeconds: 0,
      lastPlayedAt: null,
    };
    song.totalPlayedSeconds += playedSeconds;
    song.sessions += 1;
    if (playedSeconds >= thresholdSeconds) {
      song.playCount += 1;
    }
    song.avgSessionSeconds = song.totalPlayedSeconds / song.sessions;
    if (!song.lastPlayedAt || compareIsoDesc(song.lastPlayedAt, createdAt) > 0) {
      song.lastPlayedAt = createdAt;
    }
    songMap.set(songKey, song);

    const album = albumMap.get(albumName) ?? {
      albumName,
      totalPlayedSeconds: 0,
      sessions: 0,
      playCount: 0,
      songIdSet: new Set(),
      songCount: 0,
      lastPlayedAt: null,
    };
    album.totalPlayedSeconds += playedSeconds;
    album.sessions += 1;
    if (playedSeconds >= thresholdSeconds) {
      album.playCount += 1;
    }
    album.songIdSet.add(songId);
    album.songCount = album.songIdSet.size;
    if (!album.lastPlayedAt || compareIsoDesc(album.lastPlayedAt, createdAt) > 0) {
      album.lastPlayedAt = createdAt;
    }
    albumMap.set(albumName, album);
  }

  summary.songCount = songMap.size;
  summary.albumCount = albumMap.size;

  const songs = Array.from(songMap.values())
    .map((row) => ({
      ...row,
      avgSessionSeconds: toSafeNumber(row.avgSessionSeconds),
    }))
    .sort(sortByMetricDesc);

  const albums = Array.from(albumMap.values())
    .map((row) => ({
      albumName: row.albumName,
      totalPlayedSeconds: toSafeNumber(row.totalPlayedSeconds),
      sessions: toSafeNumber(row.sessions),
      playCount: toSafeNumber(row.playCount),
      songCount: toSafeNumber(row.songCount),
      lastPlayedAt: row.lastPlayedAt,
    }))
    .sort(sortByMetricDesc);

  return {
    thresholdSeconds,
    summary: {
      totalPlayedSeconds: toSafeNumber(summary.totalPlayedSeconds),
      sessions: toSafeNumber(summary.sessions),
      playCount: toSafeNumber(summary.playCount),
      songCount: toSafeNumber(summary.songCount),
      albumCount: toSafeNumber(summary.albumCount),
    },
    songs,
    albums,
  };
}

function backupLocalPlaybackWrite(entry) {
  try {
    insertPlaybackLogLocal(entry);
  } catch (error) {
    console.error("[local-backup] playback_logs.insert failed:", error);
  }
}

export async function insertPlaybackLog(entry) {
  if (!isSupabasePrimaryEnabled()) {
    insertPlaybackLogLocal(entry);
    return;
  }

  const nextId = await getNextTableId("playback_logs");
  const payload = {
    id: nextId,
    session_id: entry.sessionId,
    song_id: entry.songId,
    song_title: entry.songTitle,
    album_name: entry.albumName,
    event: entry.event,
    position_seconds: normalizeNumber(entry.positionSeconds) ?? 0,
    played_seconds: normalizeNumber(entry.playedSeconds) ?? 0,
    duration_seconds: normalizeNumber(entry.durationSeconds),
    pathname: entry.pathname || "",
    user_agent: entry.userAgent || "",
    user_id: normalizeNumber(entry.userId),
    created_at: new Date().toISOString(),
  };

  await insertRows("playback_logs", [payload]);
  backupLocalPlaybackWrite(entry);
}

export function getPlaybackLogDbPath() {
  return getPlaybackLogDbPathLocal();
}

export async function getPlaybackStats(options = {}) {
  if (!isSupabasePrimaryEnabled()) {
    return getPlaybackStatsLocal(options);
  }

  const normalizedUserId = normalizeNumber(options.userId);
  const includeAnonymous = options.includeAnonymous === true;

  const filters = [];
  if (normalizedUserId === null) {
    if (!includeAnonymous) {
      filters.push({ column: "user_id", operator: "not.is", value: null });
    }
  } else {
    filters.push({ column: "user_id", operator: "eq", value: normalizedUserId });
  }

  const logRows = await fetchAllRows("playback_logs", {
    filters,
    select: "song_id,song_title,album_name,event,played_seconds,created_at",
    orderBy: ["created_at.asc", "id.asc"],
    batchSize: 1000,
  });

  return buildStats(logRows, QUALIFIED_PLAY_SECONDS);
}
