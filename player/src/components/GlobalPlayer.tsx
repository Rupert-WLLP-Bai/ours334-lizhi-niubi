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
  Trash2,
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

function getHeaderTitleSizeClass(title?: string) {
  const length = (title || "").trim().length;
  if (length >= 34) return "text-[11px]";
  if (length >= 24) return "text-xs";
  return "text-sm";
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
  const [allAlbums, setAllAlbums] = useState<Album[]>([]);
  const [queueMode, setQueueMode] = useState<"album" | "playlist">("album");
  const [playlistQueueSongs, setPlaylistQueueSongs] = useState<Song[]>([]);
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
    if (authUser && queueMode === "playlist") {
      fetchPlaylist();
    }
    setShowPlaylist(true);
  }, [authUser, fetchPlaylist, queueMode]);

  const buildPlaylistQueueSongs = useCallback((items: PlaylistItem[], albums: Album[]): Song[] => {
    const songById = new Map<string, Song>();
    albums.forEach((album) => {
      album.songs.forEach((song) => {
        if (!songById.has(song.id)) {
          songById.set(song.id, song);
        }
      });
    });
    return items
      .map((item) => songById.get(item.songId))
      .filter((song): song is Song => Boolean(song));
  }, []);

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
      const favoriteResponse = await fetch("/api/library/favorites", {
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
      if (!favoriteResponse.ok) {
        throw new Error("favorite request failed");
      }

      const playlistResponse = await fetch("/api/library/playlist/items", {
        method: nextFavorite ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          nextFavorite
            ? {
                playlistId: "later",
                songId: currentSong.id,
                songTitle: currentSong.title,
                albumName: currentAlbum.name,
              }
            : {
                playlistId: "later",
                songId: currentSong.id,
              }
        ),
      });
      if (!playlistResponse.ok) {
        throw new Error("playlist request failed");
      }
      fetchPlaylist();
    } catch {
      setFavoriteSongIds((prev) => {
        const next = new Set(prev);
        if (nextFavorite) next.delete(currentSong.id);
        else next.add(currentSong.id);
        return next;
      });
    }
  }, [authUser, currentAlbum, currentSong, favoriteSongIds, fetchPlaylist, redirectToLogin]);

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

  const playFromPlaylist = useCallback((songId: string) => {
    if (!songId) return;
    const queue = buildPlaylistQueueSongs(playlistItems, allAlbums);
    if (queue.length === 0) return;
    const targetSong = queue.find((song) => song.id === songId) || queue[0];
    if (!targetSong) return;
    const albumForSong = allAlbums.find((album) => album.name === targetSong.album) || currentAlbum;
    if (albumForSong) {
      setCurrentAlbum(albumForSong);
    }
    setPlaylistQueueSongs(queue);
    setQueueMode("playlist");
    setCurrentSong(targetSong);
    router.push(`/player/${encodeURIComponent(targetSong.album)}/${encodeURIComponent(targetSong.title)}`);
    setShowPlaylist(false);
  }, [allAlbums, buildPlaylistQueueSongs, currentAlbum, playlistItems, router, setCurrentAlbum, setCurrentSong]);

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

  useEffect(() => {
    let active = true;
    fetch("/api/songs", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setAllAlbums(data.albums || []);
      })
      .catch(() => {
        if (!active) return;
        setAllAlbums([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (queueMode !== "playlist") return;
    setPlaylistQueueSongs(buildPlaylistQueueSongs(playlistItems, allAlbums));
  }, [allAlbums, buildPlaylistQueueSongs, playlistItems, queueMode]);

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
    const fromPlaylist = (() => {
      if (typeof window === "undefined") return false;
      const search = new URLSearchParams(window.location.search);
      return search.get("from") === "playlist";
    })();

    if (
      currentSong?.title === songTitle &&
      currentAlbum?.name === albumName &&
      ((fromPlaylist && queueMode === "playlist") || (!fromPlaylist && queueMode === "album"))
    ) {
      return;
    }

    if (fromPlaylist) {
      const queue = buildPlaylistQueueSongs(playlistItems, allAlbums);
      if (queue.length > 0) {
        const targetSong =
          queue.find((song) => song.title === songTitle && song.album === albumName) ||
          queue.find((song) => song.title === songTitle) ||
          queue[0];
        const albumForSong = allAlbums.find((album) => album.name === targetSong.album) || currentAlbum;
        if (albumForSong) {
          setCurrentAlbum(albumForSong);
        }
        setPlaylistQueueSongs(queue);
        setQueueMode("playlist");
        setCurrentSong(targetSong);
        return;
      }
    }

    const hydrateFromAlbums = (albums: Album[]) => {
      const foundAlbum = (albums || []).find((a: Album) => a.name === albumName);
      if (!foundAlbum) return;
      const foundSong = foundAlbum.songs.find((s: Song) => s.title === songTitle);
      setCurrentAlbum(foundAlbum);
      setCurrentSong(foundSong || null);
      setQueueMode("album");
    };

    if (allAlbums.length > 0) {
      hydrateFromAlbums(allAlbums);
      return;
    }

    fetch("/api/songs", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const albums = data.albums || [];
        setAllAlbums(albums);
        hydrateFromAlbums(albums);
      });
  }, [allAlbums, buildPlaylistQueueSongs, currentAlbum, currentSong?.title, params.album, params.song, playlistItems, queueMode, setCurrentAlbum, setCurrentSong]);

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
    if (!newSong) return;
    if (currentSong?.id !== newSong.id) {
      endPlaybackSession("song_change");
    }
    const albumForSong = allAlbums.find((album) => album.name === newSong.album) || currentAlbum;
    if (albumForSong) {
      setCurrentAlbum(albumForSong);
    }
    setCurrentSong(newSong);
    if (isFullPlayer) {
      const routeAlbumName = albumForSong?.name || newSong.album;
      router.push(`/player/${encodeURIComponent(routeAlbumName)}/${encodeURIComponent(newSong.title)}`);
    }
  }, [allAlbums, currentAlbum, currentSong?.id, endPlaybackSession, isFullPlayer, router, setCurrentAlbum, setCurrentSong]);

  const playFromAlbumQueue = useCallback((songId: string) => {
    if (!currentAlbum) return;
    const targetSong = currentAlbum.songs.find((song) => song.id === songId) || currentAlbum.songs[0];
    if (!targetSong) return;
    setQueueMode("album");
    switchSong(targetSong);
    if (!isFullPlayer) {
      router.push(`/player/${encodeURIComponent(currentAlbum.name)}/${encodeURIComponent(targetSong.title)}`);
    }
    setShowPlaylist(false);
  }, [currentAlbum, isFullPlayer, router, switchSong]);

  const playNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!currentSong) return;
    const activeQueue = queueMode === "playlist" && playlistQueueSongs.length > 0
      ? playlistQueueSongs
      : (currentAlbum?.songs || []);
    if (activeQueue.length === 0) return;
    
    let nextSong: Song | undefined;
    if (playMode === "shuffle") {
      const randomIndex = Math.floor(Math.random() * activeQueue.length);
      nextSong = activeQueue[randomIndex];
    } else {
      const currentIndex = activeQueue.findIndex((s: Song) => s.id === currentSong.id);
      if (currentIndex >= 0 && currentIndex < activeQueue.length - 1) {
        nextSong = activeQueue[currentIndex + 1];
      } else if (playMode === "list") {
        nextSong = activeQueue[0];
      } else if (currentIndex < 0) {
        nextSong = activeQueue[0];
      }
    }
    if (nextSong) switchSong(nextSong);
  }, [currentAlbum?.songs, currentSong, playMode, playlistQueueSongs, queueMode, switchSong]);

  const playPrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!currentSong) return;
    const activeQueue = queueMode === "playlist" && playlistQueueSongs.length > 0
      ? playlistQueueSongs
      : (currentAlbum?.songs || []);
    if (activeQueue.length === 0) return;
    const currentIndex = activeQueue.findIndex((s: Song) => s.id === currentSong.id);
    let prevSong: Song | undefined;
    if (currentIndex > 0) {
      prevSong = activeQueue[currentIndex - 1];
    } else if (playMode === "list") {
      prevSong = activeQueue[activeQueue.length - 1];
    } else if (currentIndex < 0) {
      prevSong = activeQueue[0];
    }
    if (prevSong) switchSong(prevSong);
  };

  // 圆环进度
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = currentTime / (duration || 1);
  const strokeDashoffset = circumference * (1 - progress);
  const queuePanelMode: "album" | "playlist" =
    queueMode === "playlist" && playlistQueueSongs.length > 0 ? "playlist" : "album";
  const queuePanelSongs = queuePanelMode === "playlist" ? playlistQueueSongs : (currentAlbum?.songs || []);
  const queuePanelTitle = queuePanelMode === "playlist" ? "待播清單 · 红心歌单" : "待播清單 · 当前专辑";

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
            <span
              className={`${getHeaderTitleSizeClass(currentSong?.title)} font-medium text-center leading-tight whitespace-normal break-words max-w-[200px]`}
            >
              {currentSong?.title || "..."}
            </span>
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
                <h3 className="text-2xl font-bold font-righteous text-white/90">{queuePanelTitle}</h3>
                <button 
                  onClick={() => setShowPlaylist(false)}
                  className="p-2 hover:bg-white/5 transition-colors text-white/40 hover:text-white"
                >
                  <ChevronDown className="w-6 h-6 rotate-[-90deg]" />
                </button>
              </div>
              {queuePanelMode === "album" ? (
                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#ff2d55] font-bold mb-1">当前专辑</div>
                    <div className="text-sm font-bold truncate text-white">{currentAlbum?.name || "未选择专辑"}</div>
                  </div>
                  <div className="text-xs text-white/40 whitespace-nowrap">{queuePanelSongs.length} 首</div>
                </div>
              ) : authUser ? (
                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#ff2d55] font-bold mb-1">当前用户</div>
                    <div className="text-sm font-bold truncate text-white">{authUser.email}</div>
                  </div>
                </div>
              ) : (
                <div className="w-full flex items-center justify-center gap-2 p-4 border border-white/10 bg-white/[0.02] text-sm text-white/50">
                  <ListMusic className="w-4 h-4" />
                  歌单（登录后可用）
                </div>
              )}
            </div>

            {/* Song List */}
            <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
              <div className="px-4 space-y-1">
                {queuePanelSongs.length === 0 ? (
                  <div className="p-8 text-center text-sm text-white/35 border border-dashed border-white/10">
                    暂无待播歌曲
                  </div>
                ) : (
                  queuePanelSongs.map((song, index) => {
                    const isCurrent = currentSong?.id === song.id;
                    return (
                      <div
                        key={`${song.id}-${index}`}
                        className={`w-full flex items-center gap-4 p-4 transition-all group ${
                          isCurrent ? "bg-[#ff2d55]/10 border-l-2 border-[#ff2d55]" : "hover:bg-white/5 border-l-2 border-transparent"
                        }`}
                      >
                        <button
                          onClick={() => {
                            if (queuePanelMode === "playlist") {
                              playFromPlaylist(song.id);
                              return;
                            }
                            playFromAlbumQueue(song.id);
                          }}
                          className="w-full flex items-center gap-4 text-left"
                        >
                          <span className={`w-6 text-xs font-bold font-mono transition-colors ${isCurrent ? "text-[#ff2d55]" : "opacity-20 group-hover:opacity-40"}`}>
                            {(index + 1).toString().padStart(2, "0")}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`font-bold truncate text-sm mb-0.5 ${isCurrent ? "text-[#ff2d55]" : "text-white/70 group-hover:text-white"}`}>
                              {song.title}
                            </div>
                            <div className="text-[10px] text-white/20 tracking-widest font-medium truncate">{song.album}</div>
                          </div>
                          {isCurrent && isPlaying && (
                            <div className="flex items-end gap-0.5 h-3">
                              <div className="w-0.5 h-full bg-[#ff2d55] animate-[bounce_0.6s_infinite_0.1s]" />
                              <div className="w-0.5 h-2/3 bg-[#ff2d55] animate-[bounce_0.6s_infinite_0.3s]" />
                              <div className="w-0.5 h-full bg-[#ff2d55] animate-[bounce_0.6s_infinite_0.2s]" />
                            </div>
                          )}
                        </button>
                        {queuePanelMode === "playlist" && (
                          <button
                            onClick={() => removeSongFromPlaylist(song.id)}
                            className="p-1.5 text-white/30 hover:text-white"
                            title="从清单移除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-8 border-t border-white/5 bg-black">
               <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/20">
                  <span>共 {queuePanelSongs.length} 首歌曲</span>
                  <span>保持理智 相信未來</span>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
