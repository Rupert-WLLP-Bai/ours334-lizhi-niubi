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
  Music,
  Plus,
  Trash2,
  LogIn,
} from "lucide-react";
import { usePlayer, type Song, type Album } from "@/app/player/PlayerContext";
import { formatTime } from "@/lib/lyrics";

type PlaybackEvent = "play" | "pause" | "ended" | "song_change" | "page_hide";

type ActivePlaybackSession = {
  sessionId: string;
  songId: string;
  songTitle: string;
  albumName: string;
  startedAtMs: number;
};

type AuthUser = {
  id: number;
  email: string;
  role: "admin" | "user";
};

type PlaylistItem = {
  songId: string;
  songTitle: string;
  albumName: string;
  position: number;
  createdAt: string;
};

function createPlaybackSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [favoriteSongIds, setFavoriteSongIds] = useState<Set<string>>(new Set());
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activePlaybackRef = useRef<ActivePlaybackSession | null>(null);
  const previousSongIdRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  const currentTimeRef = useRef(currentTime);
  const isFavorite = currentSong ? favoriteSongIds.has(currentSong.id) : false;

  const redirectToLogin = useCallback(() => {
    const nextUrl = encodeURIComponent(pathnameRef.current || "/");
    router.push(`/auth/login?next=${nextUrl}`);
  }, [router]);

  const fetchFavorites = useCallback(async () => {
    if (!authUser) {
      setFavoriteSongIds(new Set());
      return;
    }
    try {
      const response = await fetch("/api/library/favorites", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const ids = new Set<string>(
        (data.items || []).map((item: { songId: string }) => item.songId)
      );
      setFavoriteSongIds(ids);
    } catch {
      // ignore favorites load errors
    }
  }, [authUser]);

  const fetchPlaylist = useCallback(async () => {
    if (!authUser) {
      setPlaylistItems([]);
      return;
    }
    try {
      const response = await fetch("/api/library/playlist?playlistId=later", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setPlaylistItems(data.items || []);
    } catch {
      // ignore playlist load errors
    }
  }, [authUser]);

  const openPlaylistPanel = useCallback(() => {
    if (!authUser) {
      redirectToLogin();
      return;
    }
    fetchPlaylist();
    setShowPlaylist(true);
  }, [authUser, fetchPlaylist, redirectToLogin]);

  const toggleFavorite = useCallback(async () => {
    if (!currentSong || !currentAlbum) return;
    if (!authUser) {
      redirectToLogin();
      return;
    }
    const nextFavorite = !favoriteSongIds.has(currentSong.id);
    setFavoriteSongIds((prev) => {
      const next = new Set(prev);
      if (nextFavorite) next.add(currentSong.id);
      else next.delete(currentSong.id);
      return next;
    });

    try {
      const response = await fetch("/api/library/favorites", {
        method: nextFavorite ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          nextFavorite
            ? {
                songId: currentSong.id,
                songTitle: currentSong.title,
                albumName: currentAlbum.name,
              }
            : {
                songId: currentSong.id,
              }
        ),
      });
      if (!response.ok) {
        throw new Error("favorite request failed");
      }
    } catch {
      setFavoriteSongIds((prev) => {
        const next = new Set(prev);
        if (nextFavorite) next.delete(currentSong.id);
        else next.add(currentSong.id);
        return next;
      });
    }
  }, [authUser, currentAlbum, currentSong, favoriteSongIds, redirectToLogin]);

  const addCurrentSongToPlaylist = useCallback(async () => {
    if (!currentSong || !currentAlbum) return;
    if (!authUser) {
      redirectToLogin();
      return;
    }
    try {
      const response = await fetch("/api/library/playlist/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistId: "later",
          songId: currentSong.id,
          songTitle: currentSong.title,
          albumName: currentAlbum.name,
        }),
      });
      if (!response.ok) return;
      await fetchPlaylist();
      setShowPlaylist(true);
    } catch {
      // ignore add failures
    }
  }, [authUser, currentAlbum, currentSong, fetchPlaylist, redirectToLogin]);

  const removeSongFromPlaylist = useCallback(async (songId: string) => {
    if (!authUser || !songId) return;
    try {
      const response = await fetch("/api/library/playlist/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistId: "later",
          songId,
        }),
      });
      if (!response.ok) return;
      await fetchPlaylist();
    } catch {
      // ignore remove failures
    }
  }, [authUser, fetchPlaylist]);

  const sendPlaybackLog = useCallback((
    event: PlaybackEvent,
    session: ActivePlaybackSession,
    payload: { positionSeconds: number; playedSeconds: number; durationSeconds: number | null },
    preferBeacon = false
  ) => {
    const body = JSON.stringify({
      sessionId: session.sessionId,
      songId: session.songId,
      songTitle: session.songTitle,
      albumName: session.albumName,
      event,
      pathname: pathnameRef.current,
      positionSeconds: payload.positionSeconds,
      playedSeconds: payload.playedSeconds,
      durationSeconds: payload.durationSeconds,
    });

    if (preferBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/playback/log", blob);
      return;
    }

    fetch("/api/playback/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // 忽略日志写入失败，不影响播放体验
    });
  }, []);

  const startPlaybackSession = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong || !currentAlbum) return;
    if (activePlaybackRef.current) return;

    const positionSeconds = Math.max(
      0,
      Number.isFinite(audio.currentTime) ? audio.currentTime : currentTimeRef.current
    );
    const durationSeconds = Number.isFinite(audio.duration) ? Math.max(0, audio.duration) : null;

    const session: ActivePlaybackSession = {
      sessionId: createPlaybackSessionId(),
      songId: currentSong.id,
      songTitle: currentSong.title,
      albumName: currentAlbum.name,
      startedAtMs: Date.now(),
    };
    activePlaybackRef.current = session;

    sendPlaybackLog("play", session, {
      positionSeconds,
      playedSeconds: 0,
      durationSeconds,
    });
  }, [currentAlbum, currentSong, sendPlaybackLog]);

  const endPlaybackSession = useCallback((event: Exclude<PlaybackEvent, "play">, preferBeacon = false) => {
    const session = activePlaybackRef.current;
    if (!session) return;

    const audio = audioRef.current;
    const positionSeconds = Math.max(
      0,
      Number.isFinite(audio?.currentTime) ? Number(audio?.currentTime) : currentTimeRef.current
    );
    const durationSeconds = Number.isFinite(audio?.duration) ? Math.max(0, Number(audio?.duration)) : null;
    const playedSeconds = Math.max(0, (Date.now() - session.startedAtMs) / 1000);

    sendPlaybackLog(event, session, {
      positionSeconds,
      playedSeconds,
      durationSeconds,
    }, preferBeacon);
    activePlaybackRef.current = null;
  }, [sendPlaybackLog]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setAuthUser(data.user ?? null);
        setAuthChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setAuthUser(null);
        setAuthChecked(true);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!authChecked) return;
    fetchFavorites();
    fetchPlaylist();
  }, [authChecked, fetchFavorites, fetchPlaylist]);

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
    const rawAlbum = params.album as string;
    const rawSong = params.song as string;
    const albumName = (() => {
      try {
        return decodeURIComponent(rawAlbum);
      } catch {
        return rawAlbum;
      }
    })();
    const songTitle = (() => {
      try {
        return decodeURIComponent(rawSong);
      } catch {
        return rawSong;
      }
    })();

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

  useEffect(() => {
    const currentSongId = currentSong?.id ?? null;
    const previousSongId = previousSongIdRef.current;

    if (previousSongId && currentSongId && previousSongId !== currentSongId) {
      endPlaybackSession("song_change");
    }
    if (previousSongId && !currentSongId) {
      endPlaybackSession("song_change");
    }

    previousSongIdRef.current = currentSongId;
  }, [currentSong?.id, endPlaybackSession]);

  useEffect(() => {
    const handlePageHide = () => endPlaybackSession("page_hide", true);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      handlePageHide();
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [endPlaybackSession]);

  const togglePlay = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
    } catch {
      setIsPlaying(false);
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
    if (currentSong?.id !== newSong.id) {
      endPlaybackSession("song_change");
    }
    setCurrentSong(newSong);
    if (isFullPlayer) {
      router.push(`/player/${encodeURIComponent(currentAlbum.name)}/${encodeURIComponent(newSong.title)}`);
    }
  }, [currentAlbum, currentSong?.id, endPlaybackSession, isFullPlayer, router, setCurrentSong]);

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
        onEnded={() => {
          endPlaybackSession("ended");
          if (playMode === "single") {
            const audio = audioRef.current;
            if (!audio) return;
            audio.currentTime = 0;
            audio.play().catch(() => {
              setIsPlaying(false);
            });
            return;
          }
          playNext();
        }}
        onPlay={() => {
          setIsPlaying(true);
          startPlaybackSession();
        }}
        onPause={() => {
          setIsPlaying(false);
          endPlaybackSession("pause");
        }}
        autoPlay
      />

      {/* 全屏 Header */}
      {isFullPlayer && (
        <header className="relative z-20 px-6 py-4 flex items-center justify-between">
          <button 
            onClick={() => {
              if (currentAlbum) {
                router.push(`/player/${encodeURIComponent(currentAlbum.name)}`);
              } else {
                router.push('/');
              }
            }} 
            className="p-2 hover:bg-white/10 transition-colors"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1 font-bold">正在播放</span>
            <span className="text-sm font-medium truncate max-w-[200px]">{currentSong?.title || "..."}</span>
          </div>
          <button className="p-2 hover:bg-white/10 transition-colors">
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
                  className="w-full h-1 bg-white/10 appearance-none cursor-pointer"
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
                     data-testid="play-mode-button"
                     className={`p-2 transition-colors ${playMode !== 'list' ? 'bg-[#ff2d55]/20 text-[#ff2d55]' : 'text-white/30'}`}>
                     {playMode === 'list' && <Repeat className="w-6 h-6" />}
                     {playMode === 'single' && <Repeat1 className="w-6 h-6" />}
                     {playMode === 'shuffle' && <Shuffle className="w-6 h-6" />}
                   </button>
                   <button
                     onClick={toggleFavorite}
                     className={`p-2 transition-colors ${isFavorite ? 'text-[#ff2d55]' : 'text-white/30'}`}
                   >
                     <Heart className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
                   </button>
                </div>
                <div className="flex items-center gap-6">
                  <button onClick={(e) => playPrev(e)} className="p-2 text-white hover:scale-110 active:scale-95 transition-all"><SkipBack className="w-8 h-8 fill-current" /></button>
                  <button onClick={() => togglePlay()} data-testid="play-toggle-button" className="w-16 h-16 bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all">
                    {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                  </button>
                  <button onClick={(e) => playNext(e)} className="p-2 text-white hover:scale-110 active:scale-95 transition-all"><SkipForward className="w-8 h-8 fill-current" /></button>
                </div>
                <div className="flex items-center justify-end gap-4 flex-1">
                  <button className="hidden md:block p-2 text-white/20 hover:text-white"><Volume2 className="w-6 h-6" /></button>
                  <button
                    onClick={addCurrentSongToPlaylist}
                    className="p-2 text-white/30 hover:text-white"
                    title={authUser ? "加入稍后播放" : "登录后加入稍后播放"}
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                  <button
                    onClick={openPlaylistPanel}
                    className="p-2 text-white/30 hover:text-white"
                    title={authUser ? "打开待播清单" : "登录后查看待播清单"}
                  >
                    <ListMusic className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div 
              className="max-w-2xl mx-auto glass-card p-2.5 flex items-center gap-4 shadow-2xl cursor-pointer animate-in slide-in-from-bottom-4 duration-500 pointer-events-auto"
              onClick={() => {
                if (!currentAlbum || !currentSong) return;
                router.push(`/player/${encodeURIComponent(currentAlbum.name)}/${encodeURIComponent(currentSong.title)}`);
              }}
            >
              <div className="relative w-12 h-12 overflow-hidden flex-shrink-0 shadow-lg">
                {currentAlbum?.coverPath ? (
                  <Image src={currentAlbum.coverPath} alt="" fill unoptimized className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5">
                    <Music className="w-4 h-4 text-white/30" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{currentSong?.title}</div>
                <div className="text-[10px] text-white/40 truncate uppercase tracking-widest">{currentAlbum?.name}</div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button onClick={(e) => playPrev(e)} className="hidden sm:flex w-9 h-9 items-center justify-center text-white/40 hover:text-white transition-colors">
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>
                <button onClick={togglePlay} data-testid="play-toggle-button" className="relative w-11 h-11 flex items-center justify-center group">
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
                <button onClick={(e) => { e.stopPropagation(); openPlaylistPanel(); }} className="w-9 h-9 flex items-center justify-center text-white/40 hover:text-white transition-colors">
                  <ListMusic className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </footer>
      )}

      {showPlaylist && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowPlaylist(false)}>
          <div 
            className="absolute top-0 right-0 w-full max-w-md h-full bg-[#0a0a0a] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 pointer-events-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Playlist Header */}
            <div className="p-8 border-b border-white/5">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold font-righteous text-white/90">待播清單</h3>
                <button 
                  onClick={() => setShowPlaylist(false)}
                  className="p-2 hover:bg-white/5 transition-colors text-white/40 hover:text-white"
                >
                  <ChevronDown className="w-6 h-6 rotate-[-90deg]" />
                </button>
              </div>
              {authUser ? (
                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#ff2d55] font-bold mb-1">当前用户</div>
                    <div className="text-sm font-bold truncate text-white">{authUser.email}</div>
                  </div>
                  <button
                    onClick={addCurrentSongToPlaylist}
                    className="px-3 py-1.5 border border-white/15 text-xs text-white/70 hover:text-white hover:border-white/30 transition-colors"
                  >
                    加入当前歌曲
                  </button>
                </div>
              ) : (
                <button
                  onClick={redirectToLogin}
                  className="w-full flex items-center justify-center gap-2 p-4 border border-white/15 text-sm text-white/70 hover:text-white hover:border-white/30 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  登录后可使用收藏与待播清单
                </button>
              )}
            </div>

            {/* Song List */}
            <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
              <div className="px-4 space-y-1">
                {playlistItems.length === 0 ? (
                  <div className="p-8 text-center text-sm text-white/35 border border-dashed border-white/10">
                    暂无待播歌曲
                  </div>
                ) : (
                  playlistItems.map((item, index) => {
                    const isCurrent = currentSong?.id === item.songId;
                    return (
                      <div
                        key={`${item.songId}-${item.position}`}
                        className={`w-full flex items-center gap-4 p-4 transition-all group ${
                          isCurrent ? "bg-[#ff2d55]/10 border-l-2 border-[#ff2d55]" : "hover:bg-white/5 border-l-2 border-transparent"
                        }`}
                      >
                        <button
                          onClick={() => {
                            router.push(`/player/${encodeURIComponent(item.albumName)}/${encodeURIComponent(item.songTitle)}`);
                            setShowPlaylist(false);
                          }}
                          className="w-full flex items-center gap-4 text-left"
                        >
                          <span className={`w-6 text-xs font-bold font-mono transition-colors ${isCurrent ? "text-[#ff2d55]" : "opacity-20 group-hover:opacity-40"}`}>
                            {(index + 1).toString().padStart(2, "0")}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`font-bold truncate text-sm mb-0.5 ${isCurrent ? "text-[#ff2d55]" : "text-white/70 group-hover:text-white"}`}>
                              {item.songTitle}
                            </div>
                            <div className="text-[10px] text-white/20 tracking-widest font-medium truncate">{item.albumName}</div>
                          </div>
                          {isCurrent && isPlaying && (
                            <div className="flex items-end gap-0.5 h-3">
                              <div className="w-0.5 h-full bg-[#ff2d55] animate-[bounce_0.6s_infinite_0.1s]" />
                              <div className="w-0.5 h-2/3 bg-[#ff2d55] animate-[bounce_0.6s_infinite_0.3s]" />
                              <div className="w-0.5 h-full bg-[#ff2d55] animate-[bounce_0.6s_infinite_0.2s]" />
                            </div>
                          )}
                        </button>
                        <button
                          onClick={() => removeSongFromPlaylist(item.songId)}
                          className="p-1.5 text-white/30 hover:text-white"
                          title="从清单移除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-8 border-t border-white/5 bg-black">
               <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/20">
                  <span>共 {playlistItems.length} 首歌曲</span>
                  <span>保持理智 相信未來</span>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
