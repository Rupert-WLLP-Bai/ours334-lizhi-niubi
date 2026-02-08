import { NextRequest, NextResponse } from "next/server";
import {
  getSessionTokenFromRequest,
  getUserFromRawSessionToken,
} from "@/lib/auth";
import {
  addPlaylistItem,
  DEFAULT_LIBRARY_PLAYLIST_ID,
  removePlaylistItem,
} from "@/lib/userLibraryStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function readString(value: unknown, maxLength = 300): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function requireUser(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  return getUserFromRawSessionToken(token);
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const data = (payload ?? {}) as Record<string, unknown>;

  const playlistId = readString(data.playlistId, 80) ?? DEFAULT_LIBRARY_PLAYLIST_ID;
  const songId = readString(data.songId, 300);
  const songTitle = readString(data.songTitle, 300);
  const albumName = readString(data.albumName, 300);
  if (!songId || !songTitle || !albumName) {
    return NextResponse.json({ error: "Invalid playlist payload" }, { status: 400 });
  }

  addPlaylistItem({
    userId: user.id,
    playlistId,
    songId,
    songTitle,
    albumName,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const data = (payload ?? {}) as Record<string, unknown>;

  const playlistId = readString(data.playlistId, 80) ?? DEFAULT_LIBRARY_PLAYLIST_ID;
  const songId = readString(data.songId, 300);
  if (!songId) {
    return NextResponse.json({ error: "songId is required" }, { status: 400 });
  }

  removePlaylistItem({
    userId: user.id,
    playlistId,
    songId,
  });
  return NextResponse.json({ ok: true });
}
