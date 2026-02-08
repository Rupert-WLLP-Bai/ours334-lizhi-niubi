import { NextRequest, NextResponse } from "next/server";
import {
  getSessionTokenFromRequest,
  getUserFromRawSessionToken,
} from "@/lib/auth";
import {
  DEFAULT_LIBRARY_PLAYLIST_ID,
  listPlaylistItems,
} from "@/lib/userLibraryStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function requireUser(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  return getUserFromRawSessionToken(token);
}

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const playlistId = request.nextUrl.searchParams.get("playlistId") || DEFAULT_LIBRARY_PLAYLIST_ID;
  const items = listPlaylistItems(user.id, playlistId);
  return NextResponse.json({
    playlistId,
    items,
  });
}
