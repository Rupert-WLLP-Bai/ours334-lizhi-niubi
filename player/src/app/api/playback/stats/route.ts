import { NextRequest, NextResponse } from "next/server";
import {
  getSessionTokenFromRequest,
  getUserFromRawSessionToken,
} from "@/lib/auth";
import { getPlaybackLogDbPath, getPlaybackStats } from "@/lib/playbackLogsSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const token = getSessionTokenFromRequest(request);
    const user = await getUserFromRawSessionToken(token);
    const scope = request.nextUrl.searchParams.get("scope");
    const canReadAll = user?.role === "admin" && scope === "all";

    const stats = canReadAll
      ? await getPlaybackStats({ includeAnonymous: false })
      : user
        ? await getPlaybackStats({ userId: user.id })
        : await getPlaybackStats({ includeAnonymous: false });
    return NextResponse.json({
      ...stats,
      user: user
        ? {
            id: user.id,
            email: user.email,
            role: user.role,
          }
        : null,
      dbPath: getPlaybackLogDbPath(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to read playback stats:", {
      dbPath: getPlaybackLogDbPath(),
      error,
    });
    return NextResponse.json({ error: "Failed to read playback stats" }, { status: 500 });
  }
}
