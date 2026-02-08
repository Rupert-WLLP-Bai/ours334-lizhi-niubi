"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Bell, Music, BarChart3, LogIn, LogOut } from "lucide-react";
import { type Album } from "./player/PlayerContext";

export default function Home() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<{ id: number; email: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/songs")
      .then((res) => res.json())
      .then((data) => {
        setAlbums(data.albums || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setAuthUser(data.user ?? null))
      .catch(() => setAuthUser(null));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
    }).catch(() => null);
    setAuthUser(null);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-gradient-to-b from-[#ff2d55]/10 to-transparent pointer-events-none -z-10 blur-3xl opacity-50" />

      <header className="sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-righteous tracking-tighter text-white">
            保持理智 <span className="text-[#ff2d55]">相信未來</span>
          </h1>
          <div className="flex items-center gap-4">
            <Link
              href="/stats"
              className="p-2 rounded-full hover:bg-white/5 transition-colors text-white/70 hover:text-white"
              title="播放统计"
              aria-label="播放统计"
            >
              <BarChart3 className="w-5 h-5" />
            </Link>
            <button className="p-2 rounded-full hover:bg-white/5 transition-colors text-white/70 hover:text-white"><Search className="w-5 h-5" /></button>
            <button className="p-2 rounded-full hover:bg-white/5 transition-colors text-white/70 hover:text-white"><Bell className="w-5 h-5" /></button>
            {authUser ? (
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
                title={`已登录：${authUser.email}`}
              >
                <LogOut className="w-3.5 h-3.5" />
                退出
              </button>
            ) : (
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                登录
              </Link>
            )}
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:scale-105 transition-transform border-2 border-white/10 ml-2">
              <Image src="/lizhi-avatar.png" alt="Lizhi Avatar" width={36} height={36} unoptimized className="object-cover" />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        {/* Hero Section - Balanced Layout */}
        <section className="px-6 py-12 md:py-20">
          <div className="flex flex-col md:flex-row items-center gap-10">
            {/* Main Vision Image */}
            <div className="flex-[1.5] w-full group">
              <div className="relative overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl transition-all duration-500 group-hover:border-[#ff2d55]/30">
                <Image 
                  src="/认真是我们改变这个社会的方式.png" 
                  alt="Brand Vision" 
                  width={1200}
                  height={600}
                  unoptimized
                  className="w-full h-auto block opacity-90 group-hover:opacity-100 transition-all duration-700 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            
            {/* Secondary Album Showcase Image */}
            <div className="flex-1 w-full group">
              <div className="relative overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl transition-all duration-500 group-hover:border-[#ff2d55]/30">
                <Image 
                  src="/albums.png" 
                  alt="Albums Showcase" 
                  width={800}
                  height={600}
                  unoptimized
                  className="w-full h-auto block opacity-80 group-hover:opacity-100 transition-all duration-700 group-hover:rotate-1 group-hover:scale-105"
                />
              </div>
            </div>
          </div>
        </section>

        <main className="px-6 py-8">
          <div className="flex items-center justify-between mb-12">
            <h3 className="text-3xl font-bold font-righteous text-white/90 tracking-tight">
              所有专辑 <span className="text-xs font-poppins font-normal text-white/30 ml-4 tracking-widest uppercase">Discography</span>
            </h3>
            <div className="h-px flex-1 bg-white/5 mx-8 hidden md:block" />
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse space-y-4">
                  <div className="aspect-square bg-white/5" />
                  <div className="h-4 bg-white/5 rounded-none w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {albums.map((album) => (
                <div key={album.id} className="group relative">
                  <Link href={`/player/${encodeURIComponent(album.name)}`} data-testid="home-album-link">
                    <div className="relative aspect-square mb-8 overflow-hidden bg-neutral-900 shadow-xl group-hover:shadow-[#ff2d55]/30 group-hover:shadow-2xl transition-all duration-700 border border-white/5 group-hover:border-white/20">
                      {album.coverPath ? (
                        <Image src={album.coverPath} alt={album.name} fill unoptimized className="object-cover w-full h-full transition-transform duration-1000 group-hover:scale-110" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
                          <Music className="w-16 h-16 text-white/10" />
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="px-2">
                    <h4 className="font-bold text-xl text-white group-hover:text-[#ff2d55] transition-colors mb-2 leading-tight">{album.name}</h4>
                    <p className="text-sm font-medium text-white/30 group-hover:text-white/50 transition-colors tracking-wide">
                      {album.year ? `${album.year} • ` : ''}{album.songs.length} 首歌曲
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
