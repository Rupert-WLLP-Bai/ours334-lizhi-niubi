"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Play, ArrowLeft, Music, Heart, MoreHorizontal, Shuffle } from "lucide-react";

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

type AlbumParams = {
  album: string;
};

export default function AlbumPage(props: { params: Promise<AlbumParams> }) {
  const resolvedParams = use(props.params);
  const router = useRouter();
  const albumName = useMemo(() => decodeURIComponent(resolvedParams.album), [resolvedParams.album]);
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
      <header className="sticky top-0 z-50 px-6 py-6 backdrop-blur-md bg-black/40 border-b border-white/5 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/60">专辑详情</h2>
        <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
          <MoreHorizontal className="w-6 h-6" />
        </button>
      </header>

      {/* Album Hero */}
      <div className="px-6 py-12 md:py-20 flex flex-col md:flex-row items-center md:items-end gap-10 md:gap-16">
        <div className="relative w-64 h-64 md:w-80 md:h-80 group">
          <div className="absolute inset-0 bg-white/5 rounded-3xl shadow-2xl transition-all duration-500 group-hover:scale-105 shadow-[0_20px_50px_rgba(255,45,85,0.2)]">
            {album.coverPath ? (
              <Image
                src={album.coverPath}
                alt={album.name}
                fill
                unoptimized
                className="rounded-3xl object-cover"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <Music className="w-20 h-20 text-white/10" />
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-1 text-center md:text-left">
          <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest mb-4">Album</span>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight">{album.name}</h1>
          <div className="flex items-center justify-center md:justify-start gap-4 mb-8">
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff2d55] to-purple-600 border border-white/20" />
             <span className="font-bold text-lg">李志</span>
             <span className="text-white/40">•</span>
             <span className="text-white/40">{album.songs.length} 首歌曲</span>
          </div>
          
          <div className="flex items-center justify-center md:justify-start gap-4">
             <button className="px-10 py-4 rounded-full bg-[#ff2d55] text-white font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-[0_10px_30px_rgba(255,45,85,0.4)]">
                <Play className="w-5 h-5 fill-current" /> 播放全部
             </button>
             <button className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                <Shuffle className="w-5 h-5" />
             </button>
             <button className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                <Heart className="w-5 h-5" />
             </button>
          </div>
        </div>
      </div>

      {/* Song List */}
      <div className="px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-[40px_1fr_100px] px-4 py-4 text-xs font-bold uppercase tracking-widest text-white/40 border-b border-white/5 mb-2">
          <span>#</span>
          <span>标题</span>
          <span className="text-right pr-4">时长</span>
        </div>
        
        <div className="space-y-1">
          {album.songs.map((song, index) => (
            <Link
              key={song.id}
              href={`/player/${encodeURIComponent(album.name)}/${encodeURIComponent(song.title)}`}
              className="group grid grid-cols-[40px_1fr_100px] items-center gap-4 py-4 px-4 rounded-2xl hover:bg-white/5 transition-all"
            >
              <span className="w-8 text-sm font-bold text-white/30 group-hover:text-[#ff2d55] transition-colors">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate group-hover:text-white transition-colors">{song.title}</div>
                <div className="text-xs text-white/40">李志</div>
              </div>
              <div className="flex items-center justify-end gap-4 text-white/40 text-sm">
                {song.lyricPath && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 font-bold opacity-40 group-hover:opacity-100 transition-opacity">LRC</span>
                )}
                <Play className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}