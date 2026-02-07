"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Play, ArrowLeft, Music } from "lucide-react";

interface Song {
  id: string;
  title: string;
  album: string;
  audioPath: string;
  lyricPath: string | null;
  coverPath: string;
}

interface AlbumData {
  name: string;
  coverPath: string;
  songs: Song[];
}

export default function AlbumPage() {
  const params = useParams();
  const albumName = params.album as string;
  const [album, setAlbum] = useState<AlbumData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/songs")
      .then((res) => res.json())
      .then((data) => {
        const found = (data.albums || []).find(
          (a: AlbumData) => decodeURIComponent(albumName) === a.name
        );
        setAlbum(found || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [albumName]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="animate-pulse text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-gray-500">专辑不存在</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-black text-white">
      {/* Header with blur */}
      <header className="sticky top-0 z-10 px-4 py-4 backdrop-blur-xl bg-black/80">
        <Link
          href="/"
          className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </header>

      {/* Album Info */}
      <div className="px-6 pb-6">
        <div className="flex gap-6 items-end">
          <div className="w-48 h-48 rounded-xl overflow-hidden shadow-2xl flex-shrink-0 bg-neutral-900">
            {album.coverPath ? (
              <img
                src={album.coverPath}
                alt={album.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <Music className="w-16 h-16 text-neutral-700" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">{album.name}</h1>
            <p className="text-gray-400">李志</p>
            <p className="text-sm text-gray-500 mt-1">{album.songs.length} 首歌曲</p>
          </div>
        </div>
      </div>

      {/* Song List */}
      <div className="px-4">
        {album.songs.map((song, index) => (
          <Link
            key={song.id}
            href={`/player/${encodeURIComponent(album.name)}/${encodeURIComponent(song.title)}`}
            className="flex items-center gap-4 py-3 border-b border-neutral-800 hover:bg-neutral-900/50 transition-colors rounded-lg px-2 -mx-2"
          >
            <span className="w-8 text-center text-gray-500 text-sm">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{song.title}</div>
              {song.lyricPath && (
                <div className="text-xs text-gray-500">有歌词</div>
              )}
            </div>
            <Play className="w-5 h-5 text-gray-500" />
          </Link>
        ))}
      </div>
    </div>
  );
}
