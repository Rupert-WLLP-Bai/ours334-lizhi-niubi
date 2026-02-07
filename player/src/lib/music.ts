import { promises as fs } from 'fs';
import path from 'path';
import { ALBUMS_DIR } from './albums';

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
  coverPath: string;
  songs: Song[];
}

export async function getAlbums(): Promise<Album[]> {
  const albums: Album[] = [];

  try {
    const albumDirs = await fs.readdir(ALBUMS_DIR, { withFileTypes: true });

    for (const albumDir of albumDirs) {
      if (!albumDir.isDirectory()) continue;

      const albumName = albumDir.name;
      const albumPath = path.join(ALBUMS_DIR, albumName);

      try {
        const files = await fs.readdir(albumPath);
        const coverPath = files.find(f => f.toLowerCase() === 'cover.jpg')
          ? `/api/covers?album=${encodeURIComponent(albumName)}`
          : null;

        const songs: Song[] = [];

        for (const file of files) {
          if (/\.(flac|m4a|mp3)$/i.test(file)) {
            const title = file.replace(/\.(flac|m4a|mp3)$/i, '');
            const baseName = file.replace(/\.(flac|m4a|mp3)$/i, '');
            const lyricFile = files.find(f => f === `${baseName}.lrc`);

            songs.push({
              id: `${albumName}-${baseName}`,
              title,
              album: albumName,
              audioPath: `/api/audio?album=${encodeURIComponent(albumName)}&song=${encodeURIComponent(baseName)}`,
              lyricPath: lyricFile
                ? `/api/lyrics?album=${encodeURIComponent(albumName)}&song=${encodeURIComponent(baseName)}`
                : null,
              coverPath: coverPath || '',
            });
          }
        }

        songs.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));

        albums.push({
          id: albumName,
          name: albumName,
          coverPath: coverPath || '',
          songs,
        });
      } catch (err) {
        console.error(`Error reading album ${albumName}:`, err);
      }
    }
  } catch (err) {
    console.error('Error reading albums directory:', err);
  }

  return albums;
}

export async function getAlbum(albumName: string): Promise<Album | null> {
  const albums = await getAlbums();
  return albums.find(a => a.name === albumName) || null;
}

export async function getSong(albumName: string, songTitle: string): Promise<Song | null> {
  const album = await getAlbum(albumName);
  if (!album) return null;
  return album.songs.find(s => s.title === songTitle) || null;
}
