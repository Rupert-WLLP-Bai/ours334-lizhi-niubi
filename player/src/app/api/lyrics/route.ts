import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { resolveAlbumFilePath } from "@/lib/albums";
import { findSongInCatalog, loadAlbumCatalogIndex } from "@/lib/albumCatalog";
import { buildCloudAssetUrl, isCloudAssetSource } from "@/lib/assetSource";

const MAX_FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 8_000;
const RETRYABLE_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504, 520, 522, 524]);
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  if (typeof candidate.code === "string") return candidate.code;
  if (typeof candidate.cause?.code === "string") return candidate.cause.code;
  return null;
}

function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return true;
  const code = extractErrorCode(error);
  return code ? RETRYABLE_NETWORK_CODES.has(code) : false;
}

async function fetchLyricsTextWithRetry(lyricsUrl: string): Promise<string | null> {
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(lyricsUrl, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (response.status === 404) {
        return null;
      }

      if (response.ok) {
        return response.text();
      }

      if (RETRYABLE_HTTP_STATUS.has(response.status) && attempt < MAX_FETCH_ATTEMPTS) {
        await sleep(attempt * 200);
        continue;
      }

      throw new Error(`Failed to fetch cloud lyrics: ${response.status}`);
    } catch (error) {
      if (attempt < MAX_FETCH_ATTEMPTS && isRetryableNetworkError(error)) {
        await sleep(attempt * 200);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

async function readCloudLyrics(album: string, song: string): Promise<string | null> {
  const index = await loadAlbumCatalogIndex();
  const songRecord = findSongInCatalog(index, album, song);
  if (!songRecord || !songRecord.hasLyric) return null;

  const lyricsUrl = buildCloudAssetUrl(album, `${song}.lrc`);
  if (!lyricsUrl) {
    throw new Error("ASSET_BASE_URL is missing for cloud lyrics mode");
  }

  return fetchLyricsTextWithRetry(lyricsUrl);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const album = searchParams.get("album");
  const song = searchParams.get("song");

  if (!album || !song) {
    return NextResponse.json({ error: "Missing album or song" }, { status: 400 });
  }

  if (isCloudAssetSource()) {
    try {
      const content = await readCloudLyrics(album, song);
      if (content === null) {
        return NextResponse.json({ error: "Lyrics not found" }, { status: 404 });
      }
      return NextResponse.json({ lyrics: content });
    } catch (error) {
      console.error("Cloud lyrics fetch error:", error);
      return NextResponse.json({ error: "Cloud lyrics unavailable" }, { status: 500 });
    }
  }

  const lrcPath = resolveAlbumFilePath(album, `${song}.lrc`);
  if (!lrcPath) {
    return NextResponse.json({ error: "Invalid album or song" }, { status: 400 });
  }

  try {
    const content = await fs.readFile(lrcPath, "utf-8");
    return NextResponse.json({ lyrics: content });
  } catch {
    return NextResponse.json({ error: "Lyrics not found" }, { status: 404 });
  }
}
