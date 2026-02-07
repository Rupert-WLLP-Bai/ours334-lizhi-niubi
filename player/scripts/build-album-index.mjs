#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const SUPPORTED_AUDIO_EXTENSIONS = [".flac", ".m4a"];
const projectRoot = process.cwd();
const albumsDir = process.env.ALBUMS_SOURCE_DIR
  ? path.resolve(projectRoot, process.env.ALBUMS_SOURCE_DIR)
  : path.resolve(projectRoot, "..", "lizhi-lyrics", "albums");
const outputPath = process.env.ALBUM_INDEX_OUTPUT
  ? path.resolve(projectRoot, process.env.ALBUM_INDEX_OUTPUT)
  : path.resolve(projectRoot, "src", "data", "albums-index.json");

function stripKnownExtension(fileName) {
  return fileName.replace(/\.(flac|m4a|lrc)$/i, "");
}

function extractSongTitle(fileName) {
  return stripKnownExtension(fileName).replace(/^李志 - /, "");
}

function normalizeSongOrderKey(value) {
  return stripKnownExtension(value)
    .replace(/^李志\s*-\s*/i, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[，,。．.!！?？、；;：:“”"'‘’`~\-—_（）()\[\]【】《》<>]/g, "")
    .replace(/\s+/g, "");
}

function generateSongId(albumName, songTitle) {
  return `${albumName}-${songTitle}`.toLowerCase().replace(/\s+/g, "-");
}

function toAlbumId(albumName) {
  return albumName.toLowerCase().replace(/\s+/g, "-");
}

function sortSongsByMetadataOrder(songs, order) {
  const sorted = [...songs];
  if (!Array.isArray(order) || order.length === 0) {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }

  const orderIndex = new Map();
  for (let index = 0; index < order.length; index += 1) {
    if (typeof order[index] !== "string") continue;
    const key = normalizeSongOrderKey(order[index]);
    if (!orderIndex.has(key)) {
      orderIndex.set(key, index);
    }
  }

  sorted.sort((a, b) => {
    const keyA = normalizeSongOrderKey(a.title);
    const keyB = normalizeSongOrderKey(b.title);
    const indexA = orderIndex.has(keyA) ? orderIndex.get(keyA) : Number.MAX_SAFE_INTEGER;
    const indexB = orderIndex.has(keyB) ? orderIndex.get(keyB) : Number.MAX_SAFE_INTEGER;

    if (indexA !== Number.MAX_SAFE_INTEGER && indexB !== Number.MAX_SAFE_INTEGER) return indexA - indexB;
    if (indexA !== Number.MAX_SAFE_INTEGER) return -1;
    if (indexB !== Number.MAX_SAFE_INTEGER) return 1;
    return a.title.localeCompare(b.title);
  });

  return sorted;
}

function sortAlbums(albums) {
  const sorted = [...albums];
  sorted.sort((a, b) => {
    if (a.year && b.year && a.year !== b.year) {
      return b.year.localeCompare(a.year);
    }
    return a.name.localeCompare(b.name);
  });
  return sorted;
}

async function readMetadata(albumDir) {
  try {
    const raw = await fs.readFile(path.join(albumDir, "info.json"), "utf-8");
    const parsed = JSON.parse(raw);
    return {
      year: typeof parsed?.year === "string" ? parsed.year : "",
      order: Array.isArray(parsed?.order) ? parsed.order.filter(item => typeof item === "string") : [],
    };
  } catch {
    return { year: "", order: [] };
  }
}

function isAudioFile(fileName) {
  const lower = fileName.toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

async function scanAlbumsDirectory(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const albums = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const albumName = entry.name;
    const albumDir = path.join(root, albumName);
    const metadata = await readMetadata(albumDir);

    let hasCover = false;
    try {
      const coverStats = await fs.stat(path.join(albumDir, "cover.jpg"));
      hasCover = coverStats.isFile();
    } catch {
      hasCover = false;
    }

    const files = await fs.readdir(albumDir);
    const filesLower = new Set(files.map(fileName => fileName.toLowerCase()));
    const songs = [];

    for (const fileName of files) {
      if (!isAudioFile(fileName)) continue;
      const stats = await fs.stat(path.join(albumDir, fileName));
      if (!stats.isFile()) continue;

      const audioBaseName = stripKnownExtension(fileName);
      const title = extractSongTitle(fileName);
      const hasLyric = filesLower.has(`${audioBaseName}.lrc`.toLowerCase());

      songs.push({
        id: generateSongId(albumName, title),
        title,
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

async function main() {
  const albums = await scanAlbumsDirectory(albumsDir);
  const songCount = albums.reduce((total, album) => total + album.songs.length, 0);
  const index = {
    generatedAt: new Date().toISOString(),
    albumCount: albums.length,
    songCount,
    albums,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`, "utf-8");

  console.log(`Albums scanned: ${index.albumCount}`);
  console.log(`Songs scanned: ${index.songCount}`);
  console.log(`Index output: ${outputPath}`);
}

main().catch(error => {
  console.error("Failed to build album index:", error);
  process.exitCode = 1;
});
