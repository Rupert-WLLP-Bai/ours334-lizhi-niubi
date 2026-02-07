"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
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
import { usePlayer, type Song, type Album } from "@/app/player/PlayerContext";
import { formatTime } from "@/lib/lyrics";

export function GlobalPlayer({ children }: { children: React.ReactNode }) {
  const { 
    isPlaying, setIsPlaying, 
    currentTime, setCurrentTime, 
    duration, setDuration,
    isSeeking, setIsSeeking,
    playMode, setPlayMode,
    setSeekToFn,
    currentSong, setCurrentSong,
    currentAlbum, setCurrentAlbum
  } = usePlayer();
  
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  
  const isFullPlayer = pathname.includes('/player/') && params.song;

  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 注册跳转方法
  useEffect(() => {
    setSeekToFn((time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    });
  }, [setSeekToFn, setCurrentTime]);

  // 从 URL 同步初始状态
  useEffect(() => {
    if (!params.album || !params.song) return;
    const albumName = decodeURIComponent(params.album as string);
    const songTitle = decodeURIComponent(params.song as string);

    if (currentSong?.title === songTitle && currentAlbum?.name === albumName) return;

    fetch("/api/songs")
      .then((res) => res.json())
      .then((data) => {
        const foundAlbum = (data.albums || []).find((a: Album) => a.name === albumName);
        if (foundAlbum) {
          setCurrentAlbum(foundAlbum);
          const foundSong = foundAlbum.songs.find((s: Song) => s.title === songTitle);
          setCurrentSong(foundSong || null);
        }
      });
  }, [params.album, params.song, currentSong?.title, currentAlbum?.name, setCurrentAlbum, setCurrentSong]);

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const switchSong = useCallback((newSong: Song) => {
    if (!newSong || !currentAlbum) return;
    setCurrentSong(newSong);
    if (isFullPlayer) {
      router.push(`/player/${encodeURIComponent(currentAlbum.name)}/${encodeURIComponent(newSong.title)}`);
    }
  }, [currentAlbum, isFullPlayer, router, setCurrentSong]);

  const playNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!currentAlbum || !currentSong) return;
    
    let nextSong: Song | undefined;
    if (playMode === "shuffle") {
      const randomIndex = Math.floor(Math.random() * currentAlbum.songs.length);
      nextSong = currentAlbum.songs[randomIndex];
    } else {
      const currentIndex = currentAlbum.songs.findIndex((s: Song) => s.title === currentSong.title);
      if (currentIndex < currentAlbum.songs.length - 1) {
        nextSong = currentAlbum.songs[currentIndex + 1];
      } else if (playMode === "list") {
        nextSong = currentAlbum.songs[0];
      }
    }
    if (nextSong) switchSong(nextSong);
  }, [currentAlbum, currentSong, playMode, switchSong]);

  const playPrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!currentAlbum || !currentSong) return;
    const currentIndex = currentAlbum.songs.findIndex((s: Song) => s.title === currentSong.title);
    let prevSong: Song | undefined;
    if (currentIndex > 0) {
      prevSong = currentAlbum.songs[currentIndex - 1];
    } else if (playMode === "list") {
      prevSong = currentAlbum.songs[currentAlbum.songs.length - 1];
    }
    if (prevSong) switchSong(prevSong);
  };

  // 圆环进度
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = currentTime / (duration || 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className={`relative w-full bg-black text-white font-sans flex flex-col ${isFullPlayer ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {isFullPlayer && (
        <div className="absolute inset-0 z-0">
          {currentAlbum?.coverPath && (
            <Image
              key={currentAlbum.coverPath}
              src={currentAlbum.coverPath}
              alt="background"
              fill
              unoptimized
              className="object-cover opacity-40 blur-[100px] scale-150 animate-in fade-in duration-1000"
            />
          )}
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      <audio
        ref={audioRef}
        key={currentSong?.audioPath}
        src={currentSong?.audioPath}
        onTimeUpdate={() => !isSeeking && audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => playMode === "single" ? (audioRef.current!.currentTime = 0, audioRef.current!.play()) : playNext()}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        autoPlay
      />

      {isFullPlayer && (
        <header className="relative z-20 px-6 py-4 flex items-center justify-between">
          <button onClick={() => router.push(`/player/${encodeURIComponent(params.album as string)}`)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <ChevronDown className="w-6 h-6" />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1 font-bold">正在播放</span>
            <span className="text-sm font-medium truncate max-w-[200px]">{currentAlbum?.name || "..."}</span>
          </div>
          <button className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </header>
      )}

      <main className={`relative z-10 flex-1 ${isFullPlayer ? 'min-h-0' : 'pb-24'}`}>
        {children}
      </main>

      {currentSong && (
        <footer className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-500 ${
          isFullPlayer 
            ? 'relative px-6 py-4 md:pb-8 md:px-12 lg:px-24 bg-gradient-to-t from-black to-transparent' 
            : 'px-4 pb-6 pointer-events-none'
        }`}>
          {isFullPlayer ? (
            <div className="max-w-4xl mx-auto pointer-events-auto">
              <div className="mb-4">
                <input
                  type="range" min={0} max={duration || 100} step={0.1}
                  value={currentTime}
                  onMouseDown={() => setIsSeeking(true)}
                  onTouchStart={() => setIsSeeking(true)}
                  onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                  onMouseUp={(e) => handleSeekEnd(parseFloat((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e) => handleSeekEnd(parseFloat((e.target as HTMLInputElement).value))}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, white ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.1) ${(currentTime / (duration || 1)) * 100}%)` }}
                />
                <div className="flex justify-between text-[10px] font-bold text-white/20 mt-2 uppercase tracking-widest">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                   <button onClick={() => setPlayMode(playMode === 'list' ? 'single' : playMode === 'single' ? 'shuffle' : 'list')}
                     className={`p-2 rounded-full transition-colors ${playMode !== 'list' ? 'bg-[#ff2d55]/20 text-[#ff2d55]' : 'text-white/30'}`}>
                     {playMode === 'list' && <Repeat className="w-6 h-6" />}
                     {playMode === 'single' && <Repeat1 className="w-6 h-6" />}
                     {playMode === 'shuffle' && <Shuffle className="w-6 h-6" />}
                   </button>
                   <button onClick={() => setIsFavorite(!isFavorite)} className={`p-2 rounded-full transition-colors ${isFavorite ? 'text-[#ff2d55]' : 'text-white/30'}`}>
                     <Heart className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
                   </button>
                </div>
                <div className="flex items-center gap-6">
                  <button onClick={(e) => playPrev(e)} className="p-2 text-white hover:scale-110 active:scale-95 transition-all"><SkipBack className="w-8 h-8 fill-current" /></button>
                  <button onClick={() => togglePlay()} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all">
                    {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                  </button>
                  <button onClick={(e) => playNext(e)} className="p-2 text-white hover:scale-110 active:scale-95 transition-all"><SkipForward className="w-8 h-8 fill-current" /></button>
                </div>
                <div className="flex items-center justify-end gap-4 flex-1">
                  <button className="hidden md:block p-2 text-white/20 hover:text-white"><Volume2 className="w-6 h-6" /></button>
                  <button onClick={() => setShowPlaylist(true)} className="p-2 text-white/30 hover:text-white"><ListMusic className="w-6 h-6" /></button>
                </div>
              </div>
            </div>
          ) : (
            <div 
              className="max-w-2xl mx-auto glass-card rounded-2xl p-2.5 flex items-center gap-4 shadow-2xl cursor-pointer animate-in slide-in-from-bottom-4 duration-500 pointer-events-auto"
              onClick={() => router.push(`/player/${encodeURIComponent(currentAlbum?.name || '')}/${encodeURIComponent(currentSong?.title || '')}`)}
            >
              <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-lg">
                <Image src={currentAlbum?.coverPath || ''} alt="" fill unoptimized className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{currentSong?.title}</div>
                <div className="text-[10px] text-white/40 truncate uppercase tracking-widest">{currentAlbum?.name}</div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button onClick={(e) => playPrev(e)} className="hidden sm:flex w-9 h-9 items-center justify-center text-white/40 hover:text-white transition-colors">
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>
                <button onClick={togglePlay} className="relative w-11 h-11 flex items-center justify-center group">
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle cx="22" cy="22" r={radius} className="stroke-white/10" strokeWidth="2.5" fill="transparent" />
                    <circle cx="22" cy="22" r={radius} className="stroke-[#ff2d55] transition-all duration-300" strokeWidth="2.5" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                  </svg>
                  <div className="relative z-10 text-white group-hover:scale-110 transition-transform">
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </div>
                </button>
                <button onClick={(e) => playNext(e)} className="w-9 h-9 flex items-center justify-center text-white/40 hover:text-white transition-colors">
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setShowPlaylist(true); }} className="w-9 h-9 flex items-center justify-center text-white/40 hover:text-white transition-colors">
                  <ListMusic className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </footer>
      )}

      {showPlaylist && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={() => setShowPlaylist(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-[#121212] rounded-t-[32px] p-8 max-h-[70vh] flex flex-col shadow-2xl pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
            <h3 className="text-2xl font-bold mb-8 font-righteous text-white/90">待播清单</h3>
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
              {currentAlbum?.songs.map((s: Song, index: number) => (
                <button key={s.id} onClick={() => { router.push(`/player/${encodeURIComponent(currentAlbum.name)}/${encodeURIComponent(s.title)}`); setShowPlaylist(false); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${currentSong?.title === s.title ? "bg-white/10" : "hover:bg-white/5"}`}>
                  <span className="w-6 text-sm font-bold opacity-40 text-center">{index + 1}</span>
                  <div className="flex-1 text-left font-bold truncate text-base">{s.title}</div>
                  {currentSong?.title === s.title && isPlaying && <div className="w-1 h-4 bg-white animate-pulse" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
