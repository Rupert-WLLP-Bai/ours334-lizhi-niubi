import { promises as fs } from 'fs';
import path from 'path';
import { ALBUMS_DIR } from '@/lib/albums';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

function stripKnownExtension(fileName: string): string {
  return fileName.replace(/\.(flac|m4a|lrc)$/i, '');
}

function getAudioUrl(albumName: string, fileName: string): string {
  const baseName = stripKnownExtension(fileName);
  return `/api/audio?album=${encodeURIComponent(albumName)}&song=${encodeURIComponent(baseName)}`;
}

function getLyricUrl(albumName: string, fileName: string): string {
  const baseName = stripKnownExtension(fileName);
  return `/api/lyrics?album=${encodeURIComponent(albumName)}&song=${encodeURIComponent(baseName)}`;
}

function getCoverUrl(albumName: string): string {
  return `/api/covers?album=${encodeURIComponent(albumName)}`;
}

function extractSongTitle(fileName: string): string {
  return stripKnownExtension(fileName).replace(/^李志 - /, '');
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

      // 1. 尝试读取 info.json (包含年份和顺序)
      let metadata: { year?: string; order?: string[] } = {};
      try {
        const infoContent = await fs.readFile(path.join(albumDir, 'info.json'), 'utf-8');
        metadata = JSON.parse(infoContent);
      } catch {
        metadata = {};
      }

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
        year: metadata.year || '',
        coverPath,
        songs: [],
      };

      const files = await fs.readdir(albumDir);

      for (const file of files) {
        const lowerFile = file.toLowerCase();
        if (lowerFile.endsWith('.flac') || lowerFile.endsWith('.m4a')) {
          const filePath = path.join(albumDir, file);
          const stat = await fs.stat(filePath);
          if (!stat.isFile()) continue;

          const baseName = stripKnownExtension(file);
          const songTitle = extractSongTitle(file);
          const songId = generateSongId(albumName, songTitle);
          const hasLyric = files.includes(`${baseName}.lrc`);

          const song: Song = {
            id: songId,
            title: songTitle,
            album: albumName,
            audioPath: getAudioUrl(albumName, file),
            lyricPath: hasLyric ? getLyricUrl(albumName, file) : null,
            coverPath,
          };

          album.songs.push(song);
          allSongs.push(song);
        }
      }

      // 2. 根据 metadata.order 进行排序
      if (metadata.order && Array.isArray(metadata.order)) {
        // 预处理 order 列表：去空格、转小写
        const normalizedOrder = metadata.order.map(s => s.trim().toLowerCase());
        
        album.songs.sort((a, b) => {
          const titleA = a.title.trim().toLowerCase();
          const titleB = b.title.trim().toLowerCase();
          
          const indexA = normalizedOrder.indexOf(titleA);
          const indexB = normalizedOrder.indexOf(titleB);
          
          // 如果都在 order 列表里，按列表顺序排
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          // 如果只有 A 在，A 在前
          if (indexA !== -1) return -1;
          // 如果只有 B 在，B 在前
          if (indexB !== -1) return 1;
          // 都不在，按字母序
          return a.title.localeCompare(b.title);
        });
      } else {
        // 默认按字母序
        album.songs.sort((a, b) => a.title.localeCompare(b.title));
      }

      albums.push(album);
    }

    // 按年份降序排序专辑，如果年份相同按名称
    albums.sort((a, b) => {
      if (a.year && b.year && a.year !== b.year) {
        return b.year.localeCompare(a.year);
      }
      return a.name.localeCompare(b.name);
    });

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
