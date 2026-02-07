import { promises as fs } from 'fs';
import path from 'path';

const ALBUMS_DIR = '/home/pejoy/ours334-lizhi-niubi/lizhi-lyrics/albums/';
const PUBLIC_DIR = '/home/pejoy/ours334-lizhi-niubi/player/public';

export interface Song {
  id: string;
  title: string;
  album: string;
  audioPath: string;
  lyricPath: string;
  coverPath: string;
}

export interface Album {
  id: string;
  name: string;
  coverPath: string;
  songs: Song[];
}

function getAudioUrl(albumName: string, fileName: string): string {
  const baseName = fileName.replace(/\.(flac|lrc)$/i, '');
  return `/api/audio?album=${encodeURIComponent(albumName)}&song=${encodeURIComponent(baseName)}`;
}

function getLyricUrl(albumName: string, fileName: string): string | null {
  const baseName = fileName.replace(/\.(flac|lrc)$/i, '');
  const lrcFile = baseName + '.lrc';
  return `/api/lyrics?album=${encodeURIComponent(albumName)}&song=${encodeURIComponent(baseName)}`;
}

function getCoverUrl(albumName: string): string {
  return `/api/covers?album=${encodeURIComponent(albumName)}`;
}

function extractSongTitle(fileName: string): string {
  // Remove "李志 - " prefix and file extension
  return fileName.replace(/^李志 - /, '').replace(/\.(flac|lrc)$/i, '');
}

function generateSongId(albumName: string, songTitle: string): string {
  return `${albumName}-${songTitle}`.toLowerCase().replace(/\s+/g, '-');
}

export async function GET() {
  try {
    const albums: Album[] = [];
    const allSongs: Song[] = [];

    const entries = await fs.readdir(ALBUMS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const albumName = entry.name;
      const albumDir = path.join(ALBUMS_DIR, albumName);

      // Check for cover.jpg
      let coverPath = '';
      try {
        await fs.access(path.join(albumDir, 'cover.jpg'));
        coverPath = getCoverUrl(albumName);
      } catch {
        coverPath = '';
      }

      const album: Album = {
        id: albumName.toLowerCase().replace(/\s+/g, '-'),
        name: albumName,
        coverPath,
        songs: [],
      };

      const files = await fs.readdir(albumDir);

      for (const file of files) {
        const filePath = path.join(albumDir, file);
        const stat = await fs.stat(filePath);

        if (stat.isFile() && file.endsWith('.flac')) {
          const songTitle = extractSongTitle(file);
          const songId = generateSongId(albumName, songTitle);
          const lyricFile = file.replace(/\.flac$/i, '.lrc');

          const song: Song = {
            id: songId,
            title: songTitle,
            album: albumName,
            audioPath: getAudioUrl(albumName, file),
            lyricPath: getLyricUrl(albumName, file),
            coverPath,
          };

          album.songs.push(song);
          allSongs.push(song);
        }
      }

      // Sort songs by title
      album.songs.sort((a, b) => a.title.localeCompare(b.title));

      albums.push(album);
    }

    // Sort albums by name
    albums.sort((a, b) => a.name.localeCompare(b.name));

    return Response.json({
      albums,
      songs: allSongs,
    });
  } catch (error) {
    console.error('Error scanning songs directory:', error);
    return Response.json(
      { error: 'Failed to scan songs directory' },
      { status: 500 }
    );
  }
}
