"use client";

import { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Play, ArrowLeft, Music, MoreHorizontal, Shuffle } from "lucide-react";

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
  year?: string | number;
  songs: Song[];
}

type AlbumParams = {
  album: string;
};

export default function AlbumPage(props: { params: Promise<AlbumParams> }) {
  const resolvedParams = use(props.params);
  const router = useRouter();
  const albumName = useMemo(() => {
    try {
      return decodeURIComponent(resolvedParams.album);
    } catch {
      return resolvedParams.album;
    }
  }, [resolvedParams.album]);
  const [album, setAlbum] = useState<AlbumData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/songs")
      .then((res) => res.json())
      .then((data) => {
        const found = (data.albums || []).find(
          (a: AlbumData) => albumName === a.name
        );
        setAlbum(found || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [albumName]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white">
        <div className="animate-pulse text-white/20 font-bold">LIZHI MUSIC...</div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white">
        <div className="text-white/40">专辑不存在</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32">
      {/* Background Glow */}
      <div className="fixed top-0 left-0 w-full h-[600px] bg-gradient-to-b from-[#ff2d55]/10 to-transparent pointer-events-none -z-10 blur-3xl opacity-50" />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 md:px-6 md:py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="p-2 rounded-full hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xs md:text-sm font-bold uppercase tracking-widest text-white/60">专辑</h2>
          <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        {/* Album Hero */}
        <div className="px-4 pt-6 pb-8 md:px-6 md:py-20 flex items-start md:items-end gap-4 md:gap-16">
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-80 md:h-80 group flex-shrink-0">
            <div className="absolute inset-0 bg-white/5 shadow-2xl transition-all duration-500 group-hover:scale-105 shadow-[0_20px_50px_rgba(255,45,85,0.2)]">
              {album.coverPath ? (
                <Image
                  src={album.coverPath}
                  alt={album.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <Music className="w-20 h-20 text-white/10" />
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 min-w-0 text-left">
            <span className="hidden md:inline-block px-3 py-1 bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest mb-4">Album</span>
            <h1 className="text-xl sm:text-2xl md:text-6xl lg:text-7xl font-bold mb-3 md:mb-6 tracking-tight leading-snug md:leading-none">{album.name}</h1>
            <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-8">
               <div className="w-7 h-7 md:w-10 md:h-10 overflow-hidden border border-white/20 shadow-lg">
                  <Image src="/lizhi-avatar.png" alt="Artist Avatar" width={40} height={40} unoptimized className="object-cover" />
               </div>
               <span className="font-bold text-sm md:text-lg text-white">李志</span>
               <span className="text-white/20">•</span>
               <span className="text-xs md:text-base text-white/40 truncate">{album.year ? `${album.year} • ` : ''}{album.songs.length} 首歌曲</span>
            </div>
            
            <div className="flex items-center gap-3 md:gap-4">
               <button className="px-5 py-2.5 md:px-10 md:py-4 bg-[#ff2d55] text-white text-sm md:text-base font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-[0_10px_30px_rgba(255,45,85,0.4)]">
                  <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" /> 播放全部
               </button>
               <button className="p-2.5 md:p-4 bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/60 hover:text-white">
                  <Shuffle className="w-5 h-5" />
               </button>
            </div>
          </div>
        </div>

        {/* Song List */}
        <div className="px-4 md:px-6 pb-20">
          <div className="max-w-5xl">
            <div className="grid grid-cols-[40px_1fr_100px] px-4 py-4 text-xs font-bold uppercase tracking-widest text-white/20 border-b border-white/5 mb-4">
              <span>#</span>
              <span>标题</span>
              <span className="text-right pr-4">信息</span>
            </div>
            
            <div className="space-y-1">
              {album.songs.map((song, index) => (
                <Link
                  key={song.id}
                  href={`/player/${encodeURIComponent(album.name)}/${encodeURIComponent(song.title)}`}
                  data-testid="album-song-link"
                  className="group grid grid-cols-[40px_1fr_100px] items-center gap-4 py-4 px-4 hover:bg-white/5 transition-all"
                >
                  <span className="w-8 text-sm font-bold text-white/20 group-hover:text-[#ff2d55] transition-colors">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold whitespace-normal break-words leading-snug group-hover:text-white transition-colors text-white/90">
                      {song.title}
                    </div>
                    <div className="text-xs text-white/30 uppercase tracking-tighter">李志</div>
                  </div>
                  <div className="flex items-center justify-end gap-4 text-white/20 text-sm">
                    {song.lyricPath && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded border border-white/10 font-bold opacity-30 group-hover:opacity-100 transition-opacity tracking-widest">LRC</span>
                    )}
                    <Play className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 text-[#ff2d55]" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
