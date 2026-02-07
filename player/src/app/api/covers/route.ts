import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { resolveAlbumFilePath } from "@/lib/albums";
import { findAlbumInCatalog, loadAlbumCatalogIndex } from "@/lib/albumCatalog";
import { buildCloudAssetUrl, isCloudAssetSource } from "@/lib/assetSource";

async function resolveCloudCoverRedirect(album: string): Promise<string | null> {
  const index = await loadAlbumCatalogIndex();
  const albumRecord = findAlbumInCatalog(index, album);
  if (!albumRecord || !albumRecord.hasCover) return null;

  const url = buildCloudAssetUrl(album, "cover.jpg");
  if (!url) {
    throw new Error("ASSET_BASE_URL is missing for cloud cover mode");
  }
  return url;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const album = searchParams.get("album");

  if (!album) {
    return NextResponse.json({ error: "Missing album" }, { status: 400 });
  }

  if (isCloudAssetSource()) {
    try {
      const redirectUrl = await resolveCloudCoverRedirect(album);
      if (!redirectUrl) {
        return NextResponse.json({ error: "Cover not found" }, { status: 404 });
      }
      return NextResponse.redirect(redirectUrl, 307);
    } catch (error) {
      console.error("Cloud cover redirect error:", error);
      return NextResponse.json({ error: "Cloud cover unavailable" }, { status: 500 });
    }
  }

  const coverPath = resolveAlbumFilePath(album, "cover.jpg");
  if (!coverPath) {
    return NextResponse.json({ error: "Invalid album" }, { status: 400 });
  }

  try {
    const file = await fs.readFile(coverPath);
    return new NextResponse(file, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch {
    return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  }
}
