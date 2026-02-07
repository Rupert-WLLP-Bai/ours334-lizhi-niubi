"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Music, Play, Search, Bell, User } from "lucide-react";

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
    <div className="min-h-screen bg-[#050505] text-white pb-32">
      {/* Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-gradient-to-b from-[#ff2d55]/10 to-transparent pointer-events-none -z-10 blur-3xl opacity-50" />

      {/* Header */}
      <header className="sticky top-0 z-50 px-6 py-6 flex items-center justify-between backdrop-blur-md bg-black/40 border-b border-white/5">
        <h1 className="text-3xl font-righteous tracking-tighter text-white">
          LIZHI <span className="text-[#ff2d55]">MUSIC</span>
        </h1>
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
            <Search className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#ff2d55] to-purple-600 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform border-2 border-white/10">
            <User className="w-5 h-5" />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-12">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a1a] to-black border border-white/10 p-8 md:p-12">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#ff2d55]/20 to-transparent blur-2xl" />
          <div className="relative z-10 max-w-xl">
            <span className="inline-block px-3 py-1 rounded-full bg-[#ff2d55] text-[10px] font-bold uppercase tracking-widest mb-4">New Release</span>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">致每一个<br/>孤独的夜晚</h2>
            <p className="text-white/60 text-lg mb-8 max-w-md">李志的全系列作品，带你领略民谣的魅力。每一首歌都是一个故事。</p>
            <div className="flex gap-4">
              <button className="px-8 py-3 rounded-full bg-white text-black font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                <Play className="w-4 h-4 fill-current" /> 立即收听
              </button>
              <button className="px-8 py-3 rounded-full bg-white/10 border border-white/10 font-bold hover:bg-white/20 transition-all">
                了解更多
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Album Grid */}
      <main className="px-6">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold">所有专辑</h3>
          <Link href="/albums" className="text-sm font-bold text-[#ff2d55] hover:underline">
            查看全部
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-4">
                <div className="aspect-square rounded-2xl bg-white/5" />
                <div className="h-4 bg-white/5 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : albums.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/30">
            <Music className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-xl font-medium">暂无专辑</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {albums.map((album) => (
              <Link
                key={album.id}
                href={`/player/${encodeURIComponent(album.name)}`}
                className="group relative"
              >
                <div className="relative aspect-square mb-4 overflow-hidden rounded-2xl bg-neutral-900 shadow-lg group-hover:shadow-[#ff2d55]/20 group-hover:shadow-2xl transition-all duration-500">
                  {album.coverPath ? (
                    <Image
                      src={album.coverPath}
                      alt={album.name}
                      fill
                      unoptimized
                      className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      <Music className="w-12 h-12 text-white/10" />
                    </div>
                  )}
                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                      <Play className="w-6 h-6 fill-current ml-1" />
                    </div>
                  </div>
                </div>
                
                <h4 className="font-bold text-lg text-white truncate group-hover:text-[#ff2d55] transition-colors mb-1">
                  {album.name}
                </h4>
                <p className="text-sm font-medium text-white/40">
                  {album.songs.length} 首歌曲
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Mini Player Placeholder (Optional) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-2xl z-50">
        <div className="glass-card rounded-2xl p-3 flex items-center gap-4 shadow-2xl border-white/10">
          <div className="w-12 h-12 rounded-lg bg-white/5 flex-shrink-0 flex items-center justify-center">
            <Music className="w-6 h-6 text-white/20" />
          </div>
          <div className="flex-1 min-w-0">
             <div className="text-sm font-bold truncate">未在播放</div>
             <div className="text-xs text-white/40 truncate">选择一首歌曲开始收听</div>
          </div>
          <button className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}