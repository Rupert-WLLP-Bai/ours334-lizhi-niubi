import { promises as fs } from "fs";
import path from "path";

export const SUPPORTED_AUDIO_EXTENSIONS = [".flac", ".m4a"] as const;

export interface AlbumMetadata {
  year?: string;
  order?: string[];
}

export interface CatalogSong {
  id: string;
  title: string;
  album: string;
  audioBaseName: string;
  audioFileName: string;
  hasLyric: boolean;
}

export interface CatalogAlbum {
  id: string;
  name: string;
  year: string;
  hasCover: boolean;
  songs: CatalogSong[];
}

export interface AlbumCatalogIndex {
  generatedAt: string;
  albumCount: number;
  songCount: number;
  albums: CatalogAlbum[];
}

export const DEFAULT_ALBUM_INDEX_PATH = path.resolve(
  process.cwd(),
  "src",
  "data",
  "albums-index.json"
);

let cachedDefaultIndex: AlbumCatalogIndex | null = null;

export function stripKnownExtension(fileName: string): string {
  return fileName.replace(/\.(flac|m4a|lrc)$/i, "");
}

export function extractSongTitle(fileName: string): string {
  return stripKnownExtension(fileName).replace(/^李志 - /, "");
}

export function normalizeSongOrderKey(value: string): string {
  return stripKnownExtension(value)
    .replace(/^李志\s*-\s*/i, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[，,。．.!！?？、；;：:“”"'‘’`~\-—_（）()\[\]【】《》<>]/g, "")
    .replace(/\s+/g, "");
}

export function generateSongId(albumName: string, songTitle: string): string {
  return `${albumName}-${songTitle}`.toLowerCase().replace(/\s+/g, "-");
}

function toAlbumId(albumName: string): string {
  return albumName.toLowerCase().replace(/\s+/g, "-");
}

async function readAlbumMetadata(albumDir: string): Promise<AlbumMetadata> {
  try {
    const infoContent = await fs.readFile(path.join(albumDir, "info.json"), "utf-8");
    const parsed = JSON.parse(infoContent);
    return {
      year: typeof parsed?.year === "string" ? parsed.year : "",
      order: Array.isArray(parsed?.order) ? parsed.order.filter(item => typeof item === "string") : [],
    };
  } catch {
    return { year: "", order: [] };
  }
}

function isSupportedAudioFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function sortSongsByMetadataOrder(songs: CatalogSong[], order: string[] | undefined): CatalogSong[] {
  const sorted = [...songs];
  if (!order || order.length === 0) {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }

  const orderIndex = new Map<string, number>();
  for (let index = 0; index < order.length; index += 1) {
    const key = normalizeSongOrderKey(order[index]);
    if (!orderIndex.has(key)) {
      orderIndex.set(key, index);
    }
  }

  sorted.sort((a, b) => {
    const keyA = normalizeSongOrderKey(a.title);
    const keyB = normalizeSongOrderKey(b.title);
    const indexA = orderIndex.has(keyA) ? (orderIndex.get(keyA) as number) : Number.MAX_SAFE_INTEGER;
    const indexB = orderIndex.has(keyB) ? (orderIndex.get(keyB) as number) : Number.MAX_SAFE_INTEGER;

    if (indexA !== Number.MAX_SAFE_INTEGER && indexB !== Number.MAX_SAFE_INTEGER) return indexA - indexB;
    if (indexA !== Number.MAX_SAFE_INTEGER) return -1;
    if (indexB !== Number.MAX_SAFE_INTEGER) return 1;
    return a.title.localeCompare(b.title);
  });

  return sorted;
}

function sortAlbums(albums: CatalogAlbum[]): CatalogAlbum[] {
  const sorted = [...albums];
  sorted.sort((a, b) => {
    if (a.year && b.year && a.year !== b.year) {
      return b.year.localeCompare(a.year);
    }
    return a.name.localeCompare(b.name);
  });
  return sorted;
}

export async function scanAlbumsDirectory(albumsDir: string): Promise<CatalogAlbum[]> {
  const entries = await fs.readdir(albumsDir, { withFileTypes: true });
  const albums: CatalogAlbum[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const albumName = entry.name;
    const albumDir = path.join(albumsDir, albumName);
    const metadata = await readAlbumMetadata(albumDir);

    let hasCover = false;
    try {
      const coverStats = await fs.stat(path.join(albumDir, "cover.jpg"));
      hasCover = coverStats.isFile();
    } catch {
      hasCover = false;
    }

    const files = await fs.readdir(albumDir);
    const filesLower = new Set(files.map(fileName => fileName.toLowerCase()));
    const songs: CatalogSong[] = [];

    for (const fileName of files) {
      if (!isSupportedAudioFile(fileName)) continue;
      const stats = await fs.stat(path.join(albumDir, fileName));
      if (!stats.isFile()) continue;

      const audioBaseName = stripKnownExtension(fileName);
      const songTitle = extractSongTitle(fileName);
      const songId = generateSongId(albumName, songTitle);
      const hasLyric = filesLower.has(`${audioBaseName}.lrc`.toLowerCase());

      songs.push({
        id: songId,
        title: songTitle,
        album: albumName,
        audioBaseName,
        audioFileName: fileName,
        hasLyric,
      });
    }

    albums.push({
      id: toAlbumId(albumName),
      name: albumName,
      year: metadata.year || "",
      hasCover,
      songs: sortSongsByMetadataOrder(songs, metadata.order),
    });
  }

  return sortAlbums(albums);
}

export function toAlbumCatalogIndex(albums: CatalogAlbum[]): AlbumCatalogIndex {
  const songCount = albums.reduce((total, album) => total + album.songs.length, 0);
  return {
    generatedAt: new Date().toISOString(),
    albumCount: albums.length,
    songCount,
    albums,
  };
}

export async function loadAlbumCatalogIndex(
  indexPath: string = DEFAULT_ALBUM_INDEX_PATH
): Promise<AlbumCatalogIndex> {
  if (indexPath === DEFAULT_ALBUM_INDEX_PATH && cachedDefaultIndex) {
    return cachedDefaultIndex;
  }

  const content = await fs.readFile(indexPath, "utf-8");
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed?.albums)) {
    throw new Error("Invalid albums index: missing albums array");
  }
  const index = parsed as AlbumCatalogIndex;

  if (indexPath === DEFAULT_ALBUM_INDEX_PATH) {
    cachedDefaultIndex = index;
  }

  return index;
}

export function clearAlbumCatalogIndexCache(): void {
  cachedDefaultIndex = null;
}

export function findAlbumInCatalog(
  index: AlbumCatalogIndex,
  albumName: string
): CatalogAlbum | null {
  return index.albums.find(album => album.name === albumName) || null;
}

export function findSongInCatalog(
  index: AlbumCatalogIndex,
  albumName: string,
  audioBaseName: string
): CatalogSong | null {
  const album = findAlbumInCatalog(index, albumName);
  if (!album) return null;
  return album.songs.find(song => song.audioBaseName === audioBaseName) || null;
}
