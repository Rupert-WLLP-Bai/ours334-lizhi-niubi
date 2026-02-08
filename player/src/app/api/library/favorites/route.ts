import { NextRequest, NextResponse } from "next/server";
import {
  getSessionTokenFromRequest,
  getUserFromRawSessionToken,
} from "@/lib/auth";
import {
  addFavoriteSong,
  listFavoriteSongs,
  removeFavoriteSong,
} from "@/lib/userLibraryStoreSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function readString(value: unknown, maxLength = 300): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

async function requireUser(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  return await getUserFromRawSessionToken(token);
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const items = await listFavoriteSongs(user.id);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
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
  const songId = readString(data.songId, 300);
  const songTitle = readString(data.songTitle, 300);
  const albumName = readString(data.albumName, 300);

  if (!songId || !songTitle || !albumName) {
    return NextResponse.json({ error: "Invalid favorite payload" }, { status: 400 });
  }

  await addFavoriteSong({
    userId: user.id,
    songId,
    songTitle,
    albumName,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await requireUser(request);
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
  const songId = readString(data.songId, 300);
  if (!songId) {
    return NextResponse.json({ error: "songId is required" }, { status: 400 });
  }

  await removeFavoriteSong({
    userId: user.id,
    songId,
  });
  return NextResponse.json({ ok: true });
}
