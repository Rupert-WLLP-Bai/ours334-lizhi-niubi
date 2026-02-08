"use client";

import { useEffect, useState, useMemo, use } from "react";
import Image from "next/image";
import { parseLyrics, LyricLine } from "@/lib/lyrics";
import { Lyrics } from "@/components";
import { usePlayer, type Song, type Album } from "../../PlayerContext";

type PlayerParams = {
  album: string;
  song: string;
};

function getAdaptiveTitleSizeClass(text?: string) {
  const length = (text || "").trim().length;
  if (length >= 42) return "text-lg sm:text-xl md:text-2xl";
  if (length >= 30) return "text-xl sm:text-2xl md:text-3xl";
  if (length >= 20) return "text-2xl sm:text-3xl md:text-4xl";
  return "text-3xl md:text-4xl";
}

export default function PlayerPage(props: { params: Promise<PlayerParams> }) {
  const resolvedParams = use(props.params);
  
  const albumName = useMemo(() => {
    try {
      return decodeURIComponent(resolvedParams.album);
    } catch {
      return resolvedParams.album;
    }
  }, [resolvedParams.album]);

  const songTitle = useMemo(() => {
    try {
      return decodeURIComponent(resolvedParams.song);
    } catch {
      return resolvedParams.song;
    }
  }, [resolvedParams.song]);

  const { isPlaying, currentTime } = usePlayer();
  
  const [song, setSong] = useState<Song | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileView, setMobileView] = useState<"cover" | "lyrics">("cover");

  // Load song data
  useEffect(() => {
    fetch("/api/songs")
      .then((res) => res.json())
      .then((data) => {
        const foundAlbum = (data.albums || []).find((a: Album) => a.name === albumName);
        if (foundAlbum) {
          const foundSong = foundAlbum.songs.find((s: Song) => s.title === songTitle);
          setSong(foundSong || null);
        }
        setLoading(false);
      });
  }, [albumName, songTitle]);

  // Load lyrics
  useEffect(() => {
    let isMounted = true;
    if (song?.lyricPath) {
      fetch(song.lyricPath)
        .then((res) => res.json())
        .then((data) => {
          if (isMounted) {
            setLyrics(parseLyrics(data.lyrics || ""));
          }
        });
    } else {
      const timeout = setTimeout(() => {
        if (isMounted) setLyrics([]);
      }, 0);
      return () => {
        isMounted = false;
        clearTimeout(timeout);
      };
    }
    return () => { isMounted = false; };
  }, [song?.lyricPath]);

  const hasLyrics = lyrics.length > 0;

  return (
    <div className="w-full max-w-6xl h-full mx-auto flex flex-col md:flex-row md:items-center px-6 md:px-12 md:gap-12 lg:gap-24 overflow-hidden">
      <div className="relative w-full h-full flex flex-col md:flex-row md:items-center overflow-hidden">
        
        {/* Cover View */}
        <div 
          className={`absolute inset-0 md:relative md:inset-auto flex flex-col items-center justify-center transition-all duration-500 ease-in-out ${
            !hasLyrics 
              ? 'w-full md:w-full md:flex-shrink-0 opacity-100' 
              : mobileView === 'cover' 
                ? 'translate-x-0 opacity-100 md:w-auto md:flex-shrink-0' 
                : '-translate-x-full opacity-0 md:translate-x-0 md:opacity-100 md:w-auto md:flex-shrink-0'
          } ${hasLyrics ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={() => hasLyrics && setMobileView('lyrics')}
        >
          <div className={`relative transition-all duration-700 shadow-2xl ${
            !hasLyrics 
              ? 'w-80 h-80 sm:w-96 sm:h-96 lg:w-[500px] lg:h-[500px]' 
              : 'w-72 h-72 sm:w-80 sm:h-80 md:w-64 md:h-64 lg:w-[420px] lg:h-[420px]'
          }`}>
            {song?.coverPath && (
              <Image
                key={song.coverPath}
                src={song.coverPath}
                alt={song.title}
                fill
                unoptimized
                priority
                className={`rounded-3xl object-cover transition-all duration-700 animate-in fade-in zoom-in-95 ${isPlaying ? 'scale-100 shadow-[0_40px_100px_rgba(0,0,0,0.5)]' : 'scale-95'}`}
              />
            )}
          </div>

          <div className={`mt-8 md:mt-10 w-full text-center transition-all duration-500 ${!hasLyrics ? '' : 'md:text-left'} ${loading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
              <h2
                className={`${getAdaptiveTitleSizeClass(song?.title)} font-bold tracking-tight leading-tight whitespace-normal break-words`}
              >
                {song?.title || "..."}
              </h2>
              <p className={`${!hasLyrics ? 'text-lg md:text-2xl' : 'text-base md:text-xl'} text-white/40 font-medium mt-2 whitespace-normal break-words`}>
                {song?.album || "..."}
              </p>
          </div>
        </div>

        {/* Lyrics View */}
        {hasLyrics && (
          <div 
            className={`absolute inset-0 md:relative md:inset-auto md:flex-1 h-full flex flex-col transition-all duration-500 ease-in-out ${
              mobileView === 'lyrics' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 md:translate-x-0 md:opacity-100'
            }`}
          >
             <Lyrics 
               lyrics={lyrics} 
               currentTime={currentTime} 
               onBackToCover={() => setMobileView("cover")}
             />
          </div>
        )}
      </div>
    </div>
  );
}
