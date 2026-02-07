"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Shuffle,
} from "lucide-react";
import { parseLyrics, formatTime, LyricLine } from "@/lib/lyrics";
import { Lyrics } from "@/components";

interface Song {
  id: string;
  title: string;
  album: string;
  audioPath: string;
  lyricPath: string | null;
  coverPath: string;
}

interface Album {
  name: string;
  coverPath: string;
  songs: Song[];
}

export default function PlayerPage() {
  const params = useParams();
  const router = useRouter();
  const albumName = decodeURIComponent(params.album as string);
  const songTitle = decodeURIComponent(params.song as string);

  const [album, setAlbum] = useState<Album | null>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [viewMode, setViewMode] = useState<"cover" | "lyrics">("cover");
  const [repeatMode, setRepeatMode] = useState<"off" | "one" | "all">("off");
  const [isShuffle, setIsShuffle] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Load data
  useEffect(() => {
    fetch("/api/songs")
      .then((res) => res.json())
      .then((data) => {
        const foundAlbum = (data.albums || []).find(
          (a: Album) => a.name === albumName
        );
        if (foundAlbum) {
          setAlbum(foundAlbum);
          const foundSong = foundAlbum.songs.find((s) => s.title === songTitle);
          setSong(foundSong || null);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [albumName, songTitle]);

  // Load lyrics
  useEffect(() => {
    if (!song?.lyricPath) {
      setLyrics([]);
      return;
    }

    fetch(song.lyricPath)
      .then((res) => res.json())
      .then((data) => {
        const parsed = parseLyrics(data.lyrics || "");
        setLyrics(parsed);
      })
      .catch((err) => {
        console.error("Failed to load lyrics:", err);
        setLyrics([]);
      });
  }, [song?.lyricPath]);

  // Audio handlers
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const playNext = useCallback(() => {
    if (!album) return;
    
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * album.songs.length);
      const nextSong = album.songs[randomIndex];
      router.push(
        `/player/${encodeURIComponent(album.name)}/${encodeURIComponent(nextSong.title)}`
      );
      return;
    }

    const currentIndex = album.songs.findIndex((s) => s.title === songTitle);
    if (currentIndex < album.songs.length - 1) {
      const nextSong = album.songs[currentIndex + 1];
      router.push(
        `/player/${encodeURIComponent(album.name)}/${encodeURIComponent(nextSong.title)}`
      );
    } else if (repeatMode === "all") {
      const nextSong = album.songs[0];
      router.push(
        `/player/${encodeURIComponent(album.name)}/${encodeURIComponent(nextSong.title)}`
      );
    }
  }, [album, songTitle, isShuffle, repeatMode, router]);

  const playPrev = () => {
    if (!album) return;
    const currentIndex = album.songs.findIndex((s) => s.title === songTitle);
    if (currentIndex > 0) {
      const prevSong = album.songs[currentIndex - 1];
      router.push(
        `/player/${encodeURIComponent(album.name)}/${encodeURIComponent(prevSong.title)}`
      );
    } else if (repeatMode === "all") {
      const prevSong = album.songs[album.songs.length - 1];
      router.push(
        `/player/${encodeURIComponent(album.name)}/${encodeURIComponent(prevSong.title)}`
      );
    }
  };

  const handleEnded = () => {
    if (repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      playNext();
    }
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="animate-pulse text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!song || !album) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-gray-500">歌曲不存在</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden flex flex-col font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        {album.coverPath && (
          <Image
            src={album.coverPath}
            alt="background"
            fill
            unoptimized
            className="object-cover opacity-40 blur-[100px] scale-150 transition-all duration-1000"
          />
        )}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <audio
        ref={audioRef}
        src={song.audioPath}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        autoPlay
      />

      {/* Header */}
      <header className="relative z-20 px-6 py-8 flex items-center justify-between">
        <button 
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-1 font-bold">正在播放</span>
          <span className="text-sm font-medium">{album.name}</span>
        </div>
        <button className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <MoreHorizontal className="w-6 h-6" />
        </button>
      </header>

      {/* Main Layout */}
      <main className="relative z-10 flex-1 flex flex-col md:flex-row md:px-12 lg:px-24 md:gap-12 overflow-hidden">
        
        {/* Left Side: Cover & Info */}
        <div className={`flex-1 flex flex-col justify-center items-center md:items-start transition-all duration-500 ${viewMode === 'lyrics' ? 'hidden md:flex opacity-50 scale-90' : 'flex'}`}>
          <div 
            className="relative w-72 h-72 sm:w-80 sm:h-80 lg:w-[400px] lg:h-[400px] mb-8 md:mb-12 group cursor-pointer"
            onClick={() => setViewMode("lyrics")}
          >
            <div className={`absolute inset-0 rounded-2xl bg-white/5 shadow-2xl transition-all duration-500 group-hover:scale-105 ${isPlaying ? 'scale-100 shadow-[0_20px_50px_rgba(255,45,85,0.3)]' : 'scale-95 opacity-80'}`}>
              {album.coverPath ? (
                <Image
                  src={album.coverPath}
                  alt={album.name}
                  fill
                  unoptimized
                  className="rounded-2xl object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <ListMusic className="w-20 h-20 text-white/20" />
                </div>
              )}
            </div>
          </div>

          <div className="w-full max-w-sm md:max-w-none text-center md:text-left space-y-2">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold truncate leading-tight">{song.title}</h2>
            <p className="text-xl md:text-2xl text-white/60 font-medium truncate">{album.name}</p>
            
            <div className="flex items-center justify-center md:justify-start gap-4 pt-4 md:pt-8 opacity-0 md:opacity-100 transition-opacity">
               <button className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                 <Heart className="w-5 h-5" />
               </button>
               <button 
                 onClick={() => setIsShuffle(!isShuffle)}
                 className={`p-3 rounded-full transition-colors ${isShuffle ? 'bg-[#ff2d55]/20 text-[#ff2d55]' : 'bg-white/5 hover:bg-white/10 text-white'}`}
               >
                 <Shuffle className="w-5 h-5" />
               </button>
               <button 
                 onClick={toggleRepeat}
                 className={`p-3 rounded-full transition-colors relative ${repeatMode !== 'off' ? 'bg-[#ff2d55]/20 text-[#ff2d55]' : 'bg-white/5 hover:bg-white/10 text-white'}`}
               >
                 <Repeat className="w-5 h-5" />
                 {repeatMode === 'one' && <span className="absolute top-2 right-2 text-[8px] font-bold">1</span>}
               </button>
            </div>
          </div>
        </div>

        {/* Right Side: Lyrics */}
        <div className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-500 ${viewMode === 'lyrics' ? 'flex translate-y-0' : 'hidden md:flex opacity-40 translate-y-4'}`}>
          <div className="flex-1 min-h-0 relative">
             <Lyrics 
               lyrics={lyrics} 
               currentTime={currentTime} 
               onLineClick={handleSeek}
               className="mask-fade-edge"
             />
             <div 
               className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/0 to-transparent pointer-events-none" 
               style={{ background: 'linear-gradient(to bottom, var(--bg-fade) 0%, transparent 100%)' }}
             />
          </div>
          <button 
            className="md:hidden py-4 text-white/40 text-xs font-bold uppercase tracking-widest"
            onClick={() => setViewMode("cover")}
          >
            返回封面
          </button>
        </div>
      </main>

      {/* Player Controls Container */}
      <footer className="relative z-30 px-6 pb-12 pt-4 md:px-12 lg:px-24">
        {/* Progress Bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="relative group">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer transition-all hover:h-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full group-hover:[&::-webkit-slider-thumb]:w-4 group-hover:[&::-webkit-slider-thumb]:h-4 group-hover:[&::-webkit-slider-thumb]:shadow-xl"
              style={{
                background: `linear-gradient(to right, white ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.1) ${(currentTime / (duration || 1)) * 100}%)`,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-bold text-white/40 mt-3 tracking-widest uppercase">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Controls */}
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button 
            onClick={() => setShowPlaylist(true)}
            className="p-2 text-white/40 hover:text-white transition-colors"
          >
            <ListMusic className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-8 md:gap-12">
            <button
              onClick={playPrev}
              className="p-2 text-white hover:scale-110 active:scale-95 transition-all"
            >
              <SkipBack className="w-8 h-8 fill-current" />
            </button>
            
            <button
              onClick={togglePlay}
              className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              {isPlaying ? (
                <Pause className="w-10 h-10 fill-current" />
              ) : (
                <Play className="w-10 h-10 fill-current ml-1" />
              )}
            </button>
            
            <button
              onClick={playNext}
              className="p-2 text-white hover:scale-110 active:scale-95 transition-all"
            >
              <SkipForward className="w-8 h-8 fill-current" />
            </button>
          </div>

          <button className="p-2 text-white/40 hover:text-white transition-colors">
            <Volume2 className="w-6 h-6" />
          </button>
        </div>
      </footer>

      {/* Playlist Modal */}
      {showPlaylist && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-all duration-300 animate-in fade-in" 
          onClick={() => setShowPlaylist(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#121212] rounded-t-[32px] p-8 max-h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold">待播清单</h3>
              <span className="text-white/40 text-sm">{album.songs.length} 首歌曲</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide pr-2">
              {album.songs.map((s, index) => (
                <button
                  key={s.id}
                  onClick={() => {
                    router.push(
                      `/player/${encodeURIComponent(album.name)}/${encodeURIComponent(s.title)}`
                    );
                    setShowPlaylist(false);
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                    s.title === songTitle 
                      ? "bg-white/10 text-white" 
                      : "hover:bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  <span className="w-6 text-sm font-bold opacity-40">
                    {index + 1}
                  </span>
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                     <Image src={album.coverPath} alt="" fill unoptimized className="object-cover" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-bold truncate">{s.title}</div>
                    <div className="text-xs opacity-60 truncate">{album.name}</div>
                  </div>
                  {s.title === songTitle && isPlaying && (
                    <div className="flex gap-1 items-end h-4">
                      <div className="w-1 bg-white animate-[music-bar_0.8s_ease-in-out_infinite]" />
                      <div className="w-1 bg-white animate-[music-bar_1.2s_ease-in-out_infinite]" />
                      <div className="w-1 bg-white animate-[music-bar_1.0s_ease-in-out_infinite]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes music-bar {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
        
        .mask-fade-edge {
          mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
        }
      `}</style>
    </div>
  );
}