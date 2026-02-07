"use client";

import { useEffect, useState, useMemo, use } from "react";
import Image from "next/image";
import { parseLyrics, LyricLine } from "@/lib/lyrics";
import { Lyrics } from "@/components";
import { usePlayer } from "../../PlayerContext";

interface Song {
  title: string;
  album: string;
  lyricPath: string | null;
  coverPath: string;
}

interface Album {
  name: string;
  coverPath: string;
  songs: Song[];
}

type PlayerParams = {
  album: string;
  song: string;
};

export default function PlayerPage(props: { params: Promise<PlayerParams> }) {
  const resolvedParams = use(props.params);
  const albumName = useMemo(() => decodeURIComponent(resolvedParams.album), [resolvedParams.album]);
  const songTitle = useMemo(() => decodeURIComponent(resolvedParams.song), [resolvedParams.song]);

  const { isPlaying, currentTime, setCurrentTime } = usePlayer();
  
  const [song, setSong] = useState<Song | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileView, setMobileView] = useState<"cover" | "lyrics">("cover");

  // Load song data
  useEffect(() => {
    fetch("/api/songs")
      .then((res) => res.json())
      .then((data) => {
        const foundAlbum = (data.albums || []).find((a: any) => a.name === albumName);
        if (foundAlbum) {
          const foundSong = foundAlbum.songs.find((s: any) => s.title === songTitle);
          setSong(foundSong || null);
        }
        setLoading(false);
      });
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
        setLyrics(parseLyrics(data.lyrics || ""));
      });
  }, [song?.lyricPath]);

  return (
    <div className="w-full max-w-6xl h-full mx-auto flex flex-col md:flex-row md:items-center px-6 md:px-12 md:gap-12 lg:gap-24 overflow-hidden">
      <div className="relative w-full h-full flex flex-col md:flex-row md:items-center overflow-hidden">
        
        {/* Cover View */}
        <div 
          className={`absolute inset-0 md:relative md:inset-auto md:w-auto md:flex-shrink-0 flex flex-col items-center md:items-start justify-center transition-all duration-500 ease-in-out cursor-pointer ${
            mobileView === 'cover' ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 md:translate-x-0 md:opacity-100'
          }`}
          onClick={() => setMobileView('lyrics')}
        >
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-64 md:h-64 lg:w-[420px] lg:h-[420px] shadow-2xl">
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

          <div className={`mt-6 md:mt-8 w-full text-center md:text-left transition-all duration-500 ${loading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
              <h2 className="text-3xl md:text-4xl font-bold truncate tracking-tight">{song?.title || "..."}</h2>
              <p className="text-lg md:text-2xl text-white/40 font-medium truncate mt-1">{song?.album || "..."}</p>
          </div>
        </div>

        {/* Lyrics View */}
        <div 
          className={`absolute inset-0 md:relative md:inset-auto md:flex-1 h-full flex flex-col transition-all duration-500 ease-in-out ${
            mobileView === 'lyrics' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 md:translate-x-0 md:opacity-100'
          }`}
        >
           <Lyrics 
             lyrics={lyrics} 
             currentTime={currentTime} 
             onLineClick={(t) => setCurrentTime(t)}
             onBackToCover={() => setMobileView("cover")}
           />
        </div>
      </div>
    </div>
  );
}
