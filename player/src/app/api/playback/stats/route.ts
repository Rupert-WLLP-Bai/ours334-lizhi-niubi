import { NextResponse } from "next/server";
import { getPlaybackLogDbPath, getPlaybackStats } from "@/lib/playbackLogs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const stats = getPlaybackStats();
    return NextResponse.json({
      ...stats,
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
