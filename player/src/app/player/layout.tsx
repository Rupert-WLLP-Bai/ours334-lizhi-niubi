"use client";

import React, { useEffect, useState, useRef, useCallback, use } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import Image from "next/image";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  Heart,
  MoreHorizontal,
  ListMusic,
  Volume2,
  Repeat,
  Repeat1,
  Shuffle,
} from "lucide-react";
import { PlayerProvider, usePlayer } from "./PlayerContext";
import { formatTime } from "@/lib/lyrics";

// Internal Shell Component
function PlayerShell({ children }: { children: React.ReactNode }) {
  const { 
    isPlaying, setIsPlaying, 
    currentTime, setCurrentTime, 
    duration, setDuration,
    isSeeking, setIsSeeking,
    playMode, setPlayMode 
  } = usePlayer();
  
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  
  const [album, setAlbum] = useState<any>(null);
  const [song, setSong] = useState<any>(null);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Sync with current route data
  useEffect(() => {
    if (!params.album || !params.song) return;
    const albumName = decodeURIComponent(params.album as string);
    const songTitle = decodeURIComponent(params.song as string);

    fetch("/api/songs")
      .then((res) => res.json())
      .then((data) => {
        const foundAlbum = (data.albums || []).find((a: any) => a.name === albumName);
        if (foundAlbum) {
          setAlbum(foundAlbum);
          const foundSong = foundAlbum.songs.find((s: any) => s.title === songTitle);
          setSong(foundSong || null);
        }
      });
  }, [params.album, params.song]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeekEnd = (time: number) => {
    if (audioRef.current) {
      const targetTime = Math.min(Math.max(0, time), duration);
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
    setIsSeeking(false);
  };

  const playNext = useCallback(() => {
    if (!album || !song) return;
    if (playMode === "shuffle") {
      const randomIndex = Math.floor(Math.random() * album.songs.length);
      const nextSong = album.songs[randomIndex];
      router.push(`/player/${encodeURIComponent(album.name)}/${encodeURIComponent(nextSong.title)}`);
      return;
    }
    const currentIndex = album.songs.findIndex((s: any) => s.title === song.title);
    if (currentIndex < album.songs.length - 1) {
      const nextSong = album.songs[currentIndex + 1];
      router.push(`/player/${encodeURIComponent(album.name)}/${encodeURIComponent(nextSong.title)}`);
    } else if (playMode === "list") {
      router.push(`/player/${encodeURIComponent(album.name)}/${encodeURIComponent(album.songs[0].title)}`);
    }
  }, [album, song, playMode, router]);

  const playPrev = () => {
    if (!album || !song) return;
    const currentIndex = album.songs.findIndex((s: any) => s.title === song.title);
    if (currentIndex > 0) {
      const prevSong = album.songs[currentIndex - 1];
      router.push(`/player/${encodeURIComponent(album.name)}/${encodeURIComponent(prevSong.title)}`);
    }
  };

  return (
    <div className="relative h-screen w-full bg-black text-white overflow-hidden flex flex-col font-sans">
      {/* Background - Stays mounted during song change! */}
      <div className="absolute inset-0 z-0">
        {album?.coverPath && (
          <Image
            key={album.coverPath} // This ensures smooth fade transition
            src={album.coverPath}
            alt="background"
            fill
            unoptimized
            className="object-cover opacity-40 blur-[100px] scale-150 animate-in fade-in duration-1000"
          />
        )}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <audio
        ref={audioRef}
        key={song?.audioPath}
        src={song?.audioPath}
        onTimeUpdate={() => !isSeeking && audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => playMode === "single" ? (audioRef.current!.currentTime = 0, audioRef.current!.play()) : playNext()}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        autoPlay
      />

      {/* Persistent Shell UI */}
      <header className="relative z-20 px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronDown className="w-6 h-6" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1 font-bold">正在播放</span>
          <span className="text-sm font-medium truncate max-w-[200px]">{album?.name || "..."}</span>
        </div>
        <button className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <MoreHorizontal className="w-6 h-6" />
        </button>
      </header>

      <main className="relative z-10 flex-1 min-h-0">
        {children}
      </main>

      <footer className="relative z-30 px-6 py-4 md:pb-8 md:px-12 lg:px-24 bg-gradient-to-t from-black to-transparent">
        <div className="max-w-4xl mx-auto mb-4 md:mb-6">
          <input
            type="range"
            min={0} max={duration || 100} step={0.1}
            value={currentTime}
            onMouseDown={() => setIsSeeking(true)}
            onTouchStart={() => setIsSeeking(true)}
            onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
            onMouseUp={(e) => handleSeekEnd(parseFloat((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => handleSeekEnd(parseFloat((e.target as HTMLInputElement).value))}
            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer transition-all hover:h-1.5"
            style={{ background: `linear-gradient(to right, white ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.1) ${(currentTime / (duration || 1)) * 100}%)` }}
          />
          <div className="flex justify-between text-[10px] font-bold text-white/20 mt-2 tracking-widest uppercase">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-6 flex-1">
             <button onClick={() => setPlayMode(playMode === 'list' ? 'single' : playMode === 'single' ? 'shuffle' : 'list')}
               className={`p-2 rounded-full transition-colors ${playMode !== 'list' ? 'bg-[#ff2d55]/20 text-[#ff2d55]' : 'text-white/30 hover:text-white'}`}>
               {playMode === 'list' && <Repeat className="w-5 h-5" />}
               {playMode === 'single' && <Repeat1 className="w-5 h-5" />}
               {playMode === 'shuffle' && <Shuffle className="w-5 h-5" />}
             </button>
             <button onClick={() => setIsFavorite(!isFavorite)}
               className={`p-2 rounded-full transition-colors ${isFavorite ? 'text-[#ff2d55]' : 'text-white/30 hover:text-white'}`}>
               <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
             </button>
          </div>
          <div className="flex items-center gap-4 md:gap-10">
            <button onClick={playPrev} className="p-2 text-white hover:scale-110 active:scale-95 transition-all"><SkipBack className="w-7 h-7 md:w-8 md:h-8 fill-current" /></button>
            <button onClick={togglePlay} className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-xl">
              {isPlaying ? <Pause className="w-7 h-7 md:w-9 md:h-9 fill-current" /> : <Play className="w-7 h-7 md:w-9 md:h-9 fill-current ml-0.5" />}
            </button>
            <button onClick={playNext} className="p-2 text-white hover:scale-110 active:scale-95 transition-all"><SkipForward className="w-7 h-7 md:w-8 md:h-8 fill-current" /></button>
          </div>
          <div className="flex items-center justify-end gap-3 md:gap-6 flex-1">
            <button className="hidden md:block p-2 text-white/20 hover:text-white transition-colors"><Volume2 className="w-5 h-5" /></button>
            <button onClick={() => setShowPlaylist(true)} className={`p-2 rounded-full transition-colors ${showPlaylist ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white'}`}><ListMusic className="w-5 h-5" /></button>
          </div>
        </div>
      </footer>

      {/* Playlist Modal */}
      {showPlaylist && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowPlaylist(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-[#121212] rounded-t-[32px] p-8 max-h-[70vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
            <h3 className="text-2xl font-bold mb-8">待播清单</h3>
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
              {album?.songs.map((s: any, index: number) => (
                <button key={s.id} onClick={() => { router.push(`/player/${encodeURIComponent(album.name)}/${encodeURIComponent(s.title)}`); setShowPlaylist(false); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${song?.title === s.title ? "bg-white/10" : "hover:bg-white/5"}`}>
                  <span className="w-6 text-sm font-bold opacity-40 text-center">{index + 1}</span>
                  <div className="flex-1 text-left font-bold truncate text-base">{s.title}</div>
                  {song?.title === s.title && isPlaying && <div className="w-1 h-4 bg-white animate-pulse" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RootPlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      <PlayerShell>{children}</PlayerShell>
    </PlayerProvider>
  );
}
