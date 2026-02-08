import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ALBUMS_DIR } from "@/lib/albums";
import {
  loadAlbumCatalogIndex,
  scanAlbumsDirectory,
  type CatalogAlbum,
} from "@/lib/albumCatalog";
import { isCloudAssetSource } from "@/lib/assetSource";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const SONGS_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=86400";

export interface Song {
  id: string;
  title: string;
  album: string;
  audioPath: string;
  lyricPath: string | null;
  coverPath: string;
}

export interface Album {
  id: string;
  name: string;
  year?: string;
  coverPath: string;
  songs: Song[];
}

function getAudioUrl(albumName: string, songBaseName: string): string {
  return `/api/audio?album=${encodeURIComponent(albumName)}&song=${encodeURIComponent(songBaseName)}`;
}

function getLyricUrl(albumName: string, songBaseName: string): string {
  return `/api/lyrics?album=${encodeURIComponent(albumName)}&song=${encodeURIComponent(songBaseName)}`;
}

function getCoverUrl(albumName: string): string {
  return `/api/covers?album=${encodeURIComponent(albumName)}`;
}

async function loadCatalogAlbums(): Promise<CatalogAlbum[]> {
  if (isCloudAssetSource()) {
    const index = await loadAlbumCatalogIndex();
    return index.albums;
  }
  return scanAlbumsDirectory(ALBUMS_DIR);
}

function createEtagFromObject(value: unknown): string {
  const hash = createHash("sha1").update(JSON.stringify(value)).digest("base64url");
  return `W/"${hash}"`;
}

function requestMatchesEtag(request: NextRequest, etag: string): boolean {
  const ifNoneMatch = request.headers.get("if-none-match");
  if (!ifNoneMatch) return false;
  return ifNoneMatch
    .split(",")
    .map(token => token.trim())
    .some(token => token === etag || token === "*");
}

export async function GET(request: NextRequest) {
  try {
    const catalogAlbums = await loadCatalogAlbums();
    const albums: Album[] = catalogAlbums.map(catalogAlbum => {
      const coverPath = catalogAlbum.hasCover ? getCoverUrl(catalogAlbum.name) : "";
      return {
        id: catalogAlbum.id,
        name: catalogAlbum.name,
        year: catalogAlbum.year || "",
        coverPath,
        songs: catalogAlbum.songs.map(song => ({
          id: song.id,
          title: song.title,
          album: song.album,
          audioPath: getAudioUrl(catalogAlbum.name, song.audioBaseName),
          lyricPath: song.hasLyric ? getLyricUrl(catalogAlbum.name, song.audioBaseName) : null,
          coverPath,
        })),
      };
    });
    const allSongs = albums.flatMap(album => album.songs);
    const payload = {
      albums,
      songs: allSongs,
    };
    const etag = createEtagFromObject(payload);

    if (requestMatchesEtag(request, etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": SONGS_CACHE_CONTROL,
          ETag: etag,
        },
      });
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": SONGS_CACHE_CONTROL,
        ETag: etag,
      },
    });
  } catch (error) {
    console.error("Error loading songs catalog:", error);
    return NextResponse.json(
      { error: "Failed to load songs catalog" },
      { status: 500 }
    );
  }
}
