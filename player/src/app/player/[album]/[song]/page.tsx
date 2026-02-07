"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  Heart,
  MoreHorizontal,
  Repeat,
  Shuffle,
  ListMusic,
} from "lucide-react";
import { parseLyrics, findCurrentLyric, formatTime, LyricLine } from "@/lib/lyrics";

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
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPlaylist, setShowPlaylist] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Load album data
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
    if (!song?.lyricPath) return;

    fetch(song.lyricPath)
      .then((res) => res.json())
      .then((data) => {
        const parsed = parseLyrics(data.lyrics || "");
        setLyrics(parsed);
      })
      .catch(console.error);
  }, [song?.lyricPath]);

  // Audio event handlers
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      const index = findCurrentLyric(lyrics, time);
      setCurrentLyricIndex(index);
    }
  }, [lyrics]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentLyricIndex(-1);
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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(
        audioRef.current.currentTime + 10,
        duration
      );
    }
  };

  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(
        audioRef.current.currentTime - 10,
        0
      );
    }
  };

  const playNext = () => {
    if (!album) return;
    const currentIndex = album.songs.findIndex((s) => s.title === songTitle);
    if (currentIndex < album.songs.length - 1) {
      const nextSong = album.songs[currentIndex + 1];
      router.push(
        `/player/${encodeURIComponent(album.name)}/${encodeURIComponent(nextSong.title)}`
      );
    }
  };

  const playPrev = () => {
    if (!album) return;
    const currentIndex = album.songs.findIndex((s) => s.title === songTitle);
    if (currentIndex > 0) {
      const prevSong = album.songs[currentIndex - 1];
      router.push(
        `/player/${encodeURIComponent(album.name)}/${encodeURIComponent(prevSong.title)}`
      );
    }
  };

  // Scroll to current lyric
  useEffect(() => {
    if (currentLyricIndex >= 0 && lyricsContainerRef.current) {
      const lyricElements = lyricsContainerRef.current.querySelectorAll(
        "[data-lyric-index]"
      );
      const currentElement = lyricElements[currentLyricIndex] as HTMLElement;
      if (currentElement) {
        currentElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentLyricIndex]);

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
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Audio element */}
      <audio
        ref={audioRef}
        src={song.audioPath}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Header */}
      <header className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between backdrop-blur-xl bg-black/80">
        <button onClick={() => router.back()}>
          <ChevronDown className="w-6 h-6" />
        </button>
        <span className="text-sm font-medium text-gray-400">正在播放</span>
        <button>
          <MoreHorizontal className="w-6 h-6" />
        </button>
      </header>

      {/* Main Content - Cover & Lyrics */}
      <div className="flex-1 flex flex-col px-6 pt-4 pb-6 overflow-hidden">
        {/* Album Cover */}
        <div className="flex justify-center mb-6">
          <div className="w-72 h-72 rounded-2xl overflow-hidden shadow-2xl bg-neutral-900">
            {album.coverPath ? (
              <img
                src={album.coverPath}
                alt={album.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <ListMusic className="w-20 h-20 text-neutral-700" />
              </div>
            )}
          </div>
        </div>

        {/* Song Info */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold truncate">{song.title}</h2>
          <p className="text-gray-400">{album.name}</p>
        </div>

        {/* Lyrics */}
        <div
          ref={lyricsContainerRef}
          className="flex-1 overflow-y-auto px-4 py-2 scrollbar-hide"
          style={{ maxHeight: "200px" }}
        >
          <div className="space-y-8 text-center">
            {/* Padding for centering */}
            <div className="h-8" />

            {lyrics.length === 0 ? (
              <p className="text-gray-600 text-center">暂无歌词</p>
            ) : (
              lyrics.map((line, index) => (
                <div
                  key={index}
                  data-lyric-index={index}
                  className={`transition-all duration-300 ${
                    index === currentLyricIndex
                      ? "text-white scale-110 font-semibold"
                      : "text-gray-600 scale-100"
                  }`}
                >
                  {line.text || <span className="opacity-0">-</span>}
                </div>
              ))
            )}

            {/* Padding for centering */}
            <div className="h-8" />
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-2">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-neutral-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
          style={{
            background: `linear-gradient(to right, #ff2d55 ${(currentTime / (duration || 1)) * 100}%, #3a3a3c ${(currentTime / (duration || 1)) * 100}%)`,
          }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="px-8 py-4">
        <div className="flex items-center justify-between mb-4">
          <button className="text-gray-400 hover:text-white">
            <Heart className="w-6 h-6" />
          </button>
          <button
            onClick={playPrev}
            className="text-white hover:text-[#ff2d55] transition-colors"
          >
            <SkipBack className="w-8 h-8" />
          </button>
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-black" />
            ) : (
              <Play className="w-8 h-8 fill-black ml-1" />
            )}
          </button>
          <button
            onClick={playNext}
            className="text-white hover:text-[#ff2d55] transition-colors"
          >
            <SkipForward className="w-8 h-8" />
          </button>
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
            className={`${showPlaylist ? "text-[#ff2d55]" : "text-gray-400"} hover:text-white`}
          >
            <ListMusic className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Playlist Modal */}
      {showPlaylist && (
        <div className="fixed inset-0 z-50 bg-black/90" onClick={() => setShowPlaylist(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#1c1c1e] rounded-t-3xl p-4 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-4">播放列表</h3>
            {album.songs.map((s, index) => (
              <div
                key={s.id}
                onClick={() => {
                  router.push(
                    `/player/${encodeURIComponent(album.name)}/${encodeURIComponent(s.title)}`
                  );
                  setShowPlaylist(false);
                }}
                className={`flex items-center gap-3 py-3 border-b border-neutral-800 ${
                  s.title === songTitle ? "text-[#ff2d55]" : "text-white"
                }`}
              >
                <span className="w-6 text-center text-sm">
                  {s.title === songTitle && isPlaying ? (
                    <div className="flex gap-0.5 justify-center">
                      <div className="w-0.5 h-3 bg-[#ff2d55] animate-pulse" />
                      <div className="w-0.5 h-4 bg-[#ff2d55] animate-pulse" style={{ animationDelay: "0.1s" }} />
                      <div className="w-0.5 h-2 bg-[#ff2d55] animate-pulse" style={{ animationDelay: "0.2s" }} />
                    </div>
                  ) : (
                    index + 1
                  )}
                </span>
                <div className="flex-1">
                  <div className="font-medium">{s.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
