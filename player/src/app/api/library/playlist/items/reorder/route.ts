import { NextRequest, NextResponse } from "next/server";
import {
  getSessionTokenFromRequest,
  getUserFromRawSessionToken,
} from "@/lib/auth";
import {
  DEFAULT_LIBRARY_PLAYLIST_ID,
  reorderPlaylistItems,
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

export async function PATCH(request: NextRequest) {
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
  const songIdsRaw = Array.isArray(data.songIds) ? data.songIds : null;
  if (!songIdsRaw || songIdsRaw.length === 0) {
    return NextResponse.json({ error: "songIds is required" }, { status: 400 });
  }
  const songIds = songIdsRaw
    .map((item) => readString(item, 300))
    .filter((item): item is string => Boolean(item));
  if (songIds.length !== songIdsRaw.length) {
    return NextResponse.json({ error: "songIds contains invalid values" }, { status: 400 });
  }

  const ok = reorderPlaylistItems({
    userId: user.id,
    playlistId,
    songIds,
  });
  if (!ok) {
    return NextResponse.json({ error: "songIds does not match playlist items" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
