import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { resolveAlbumFilePath } from "@/lib/albums";
import { findAlbumInCatalog, loadAlbumCatalogIndex } from "@/lib/albumCatalog";
import {
  buildCloudAssetUrl,
  isCloudAssetSource,
  isCloudflareS3ApiEndpointUrl,
} from "@/lib/assetSource";

const COVER_FILE_CANDIDATES = ["cover.jpg", "Cover.jpg"] as const;

async function resolveCloudCoverRedirect(album: string): Promise<string | null> {
  const index = await loadAlbumCatalogIndex();
  const albumRecord = findAlbumInCatalog(index, album);
  if (!albumRecord || !albumRecord.hasCover) return null;

  const coverFileName = albumRecord.coverFileName || "cover.jpg";
  const url = buildCloudAssetUrl(album, coverFileName);
  if (!url) {
    throw new Error("ASSET_BASE_URL is missing for cloud cover mode");
  }
  if (isCloudflareS3ApiEndpointUrl(url)) {
    throw new Error(
      "ASSET_BASE_URL points to the R2 S3 API endpoint. Use a public r2.dev/custom domain URL."
    );
  }
  return url;
}

async function resolveLocalCoverFile(album: string): Promise<Buffer | null> {
  for (const fileName of COVER_FILE_CANDIDATES) {
    const coverPath = resolveAlbumFilePath(album, fileName);
    if (!coverPath) continue;

    try {
      return await fs.readFile(coverPath);
    } catch {
      continue;
    }
  }
  return null;
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

  try {
    const file = await resolveLocalCoverFile(album);
    if (!file) {
      return NextResponse.json({ error: "Cover not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch {
    return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  }
}
