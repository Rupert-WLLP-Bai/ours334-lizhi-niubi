"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Music } from "lucide-react";

interface Album {
  id: string;
  name: string;
  coverPath: string;
  songs: Array<{
    id: string;
    title: string;
    album: string;
  }>;
}

export default function Home() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/songs")
      .then((res) => res.json())
      .then((data) => {
        setAlbums(data.albums || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 px-6 py-4 backdrop-blur-xl bg-black/80">
        <h1 className="text-2xl font-bold">音乐</h1>
      </header>

      {/* Album List */}
      <main className="px-4 py-2">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-gray-500">加载中...</div>
          </div>
        ) : albums.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Music className="w-12 h-12 mb-4 opacity-50" />
            <p>暂无专辑</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {albums.map((album) => (
              <Link
                key={album.id}
                href={`/player/${encodeURIComponent(album.name)}`}
                className="group"
              >
                <div className="relative aspect-square mb-3 overflow-hidden rounded-xl bg-neutral-900">
                  {album.coverPath ? (
                    <img
                      src={album.coverPath}
                      alt={album.name}
                      className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      <Music className="w-12 h-12 text-neutral-700" />
                    </div>
                  )}
                </div>
                <h3 className="font-medium text-white truncate group-hover:text-[#ff2d55] transition-colors">
                  {album.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {album.songs.length} 首歌曲
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
