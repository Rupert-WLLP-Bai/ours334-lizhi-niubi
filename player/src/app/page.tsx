"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, Search, Bell, Music } from "lucide-react";
import { usePlayer, type Album } from "./player/PlayerContext";

export default function Home() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const { setCurrentSong, setCurrentAlbum } = usePlayer();

  useEffect(() => {
    fetch("/api/songs")
      .then((res) => res.json())
      .then((data) => {
        setAlbums(data.albums || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const startPlayingAlbum = (album: Album) => {
    if (album.songs.length > 0) {
      setCurrentAlbum(album);
      setCurrentSong(album.songs[0]);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-gradient-to-b from-[#ff2d55]/10 to-transparent pointer-events-none -z-10 blur-3xl opacity-50" />

      <header className="sticky top-0 z-50 px-6 py-6 flex items-center justify-between backdrop-blur-md bg-black/40 border-b border-white/5">
        <h1 className="text-3xl font-righteous tracking-tighter text-white">
          LIZHI <span className="text-[#ff2d55]">MUSIC</span>
        </h1>
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-white/5 transition-colors"><Search className="w-5 h-5" /></button>
          <button className="p-2 rounded-full hover:bg-white/5 transition-colors"><Bell className="w-5 h-5" /></button>
          <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:scale-105 transition-transform border-2 border-white/10">
            <Image src="/lizhi-avatar.png" alt="Lizhi Avatar" width={36} height={36} unoptimized className="object-cover" />
          </div>
        </div>
      </header>

      {/* Hero Section - Natural Proportions Layout */}
      <section className="px-6 py-6 md:py-8">
        <div className="flex flex-col md:flex-row items-end gap-6">
          {/* Main Vision Image */}
          <div className="flex-[1.4] w-full">
            <div className="relative overflow-hidden rounded-3xl bg-neutral-900 border border-white/5 shadow-2xl">
              <Image 
                src="/认真是我们改变这个社会的方式.png" 
                alt="Brand Vision" 
                width={1200}
                height={600}
                unoptimized
                className="w-full h-auto block opacity-90 hover:opacity-100 transition-opacity duration-500"
              />
            </div>
          </div>
          
          {/* Secondary Album Showcase Image */}
          <div className="flex-1 w-full">
            <div className="relative overflow-hidden rounded-3xl bg-neutral-900 border border-white/5 shadow-2xl">
              <Image 
                src="/albums.png" 
                alt="Albums Showcase" 
                width={800}
                height={600}
                unoptimized
                className="w-full h-auto block opacity-90 hover:opacity-100 transition-opacity duration-500"
              />
            </div>
          </div>
        </div>
      </section>

      <main className="px-6">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold font-righteous text-white/90">所有专辑</h3>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-4">
                <div className="aspect-square rounded-2xl bg-white/5" />
                <div className="h-4 bg-white/5 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {albums.map((album) => (
              <div key={album.id} className="group relative">
                <Link href={`/player/${encodeURIComponent(album.name)}`} data-testid="home-album-link">
                  <div className="relative aspect-square mb-4 overflow-hidden rounded-2xl bg-neutral-900 shadow-lg group-hover:shadow-[#ff2d55]/20 group-hover:shadow-2xl transition-all duration-500">
                    {album.coverPath ? (
                      <Image src={album.coverPath} alt={album.name} fill unoptimized className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
                        <Music className="w-16 h-16 text-white/10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={(e) => { e.preventDefault(); startPlayingAlbum(album); }}
                        className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center translate-y-4 group-hover:translate-y-0 transition-transform duration-300"
                      >
                        <Play className="w-6 h-6 fill-current ml-1" />
                      </button>
                    </div>
                  </div>
                </Link>
                <h4 className="font-bold text-lg text-white truncate group-hover:text-[#ff2d55] transition-colors mb-1">{album.name}</h4>
                <p className="text-sm font-medium text-white/40">
                  {album.year ? `${album.year} • ` : ''}{album.songs.length} 首歌曲
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
