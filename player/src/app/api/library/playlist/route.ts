import { NextRequest, NextResponse } from "next/server";
import {
  getSessionTokenFromRequest,
  getUserFromRawSessionToken,
} from "@/lib/auth";
import {
  DEFAULT_LIBRARY_PLAYLIST_ID,
  listPlaylistItems,
} from "@/lib/userLibraryStoreSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireUser(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  return await getUserFromRawSessionToken(token);
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const playlistId = request.nextUrl.searchParams.get("playlistId") || DEFAULT_LIBRARY_PLAYLIST_ID;
  const items = await listPlaylistItems(user.id, playlistId);
  return NextResponse.json({
    playlistId,
    items,
  });
}
