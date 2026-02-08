import { NextRequest, NextResponse } from "next/server";
import {
  getSessionTokenFromRequest,
  getUserFromRawSessionToken,
} from "@/lib/auth";
import { getPlaybackLogDbPath, insertPlaybackLog } from "@/lib/playbackLogsSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_EVENTS = new Set(["play", "pause", "ended", "song_change", "page_hide"]);

function readString(value: unknown, maxLength = 255): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function readNumber(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value)) return null;
  return value;
}

export async function POST(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  const user = await getUserFromRawSessionToken(token);
  if (!user) {
    return new NextResponse(null, { status: 204 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = (payload ?? {}) as Record<string, unknown>;

  const sessionId = readString(data.sessionId, 120);
  const songId = readString(data.songId, 200);
  const songTitle = readString(data.songTitle, 300);
  const albumName = readString(data.albumName, 300);
  const event = readString(data.event, 40);
  const pathname = readString(data.pathname, 500) ?? "";
  const positionSeconds = readNumber(data.positionSeconds) ?? 0;
  const playedSeconds = readNumber(data.playedSeconds) ?? 0;
  const durationSeconds = readNumber(data.durationSeconds);

  if (!sessionId || !songId || !songTitle || !albumName || !event || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "Invalid playback log payload" }, { status: 400 });
  }

  try {
    await insertPlaybackLog({
      sessionId,
      songId,
      songTitle,
      albumName,
      event,
      positionSeconds: Math.max(0, positionSeconds),
      playedSeconds: Math.max(0, playedSeconds),
      durationSeconds: durationSeconds === null ? null : Math.max(0, durationSeconds),
      pathname,
      userAgent: request.headers.get("user-agent") ?? "",
      userId: user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to write playback log:", {
      dbPath: getPlaybackLogDbPath(),
      error,
    });
    return NextResponse.json({ error: "Failed to persist playback log" }, { status: 500 });
  }
}
