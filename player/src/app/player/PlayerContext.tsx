"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from "react";

export interface Song {
  id: string;
  title: string;
  album: string;
  audioPath: string;
  lyricPath: string | null;
  coverPath: string;
}

export interface Album {
  id: string;
  name: string;
  coverPath: string;
  songs: Song[];
}

interface PlayerContextType {
  isPlaying: boolean;
  setIsPlaying: (val: boolean) => void;
  currentTime: number;
  setCurrentTime: (val: number) => void;
  duration: number;
  setDuration: (val: number) => void;
  isSeeking: boolean;
  setIsSeeking: (val: boolean) => void;
  playMode: "list" | "single" | "shuffle";
  setPlayMode: (mode: "list" | "single" | "shuffle") => void;
  seekTo: (time: number) => void;
  setSeekToFn: (fn: (time: number) => void) => void;
  currentSong: Song | null;
  setCurrentSong: (song: Song | null) => void;
  currentAlbum: Album | null;
  setCurrentAlbum: (album: Album | null) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [playMode, setPlayMode] = useState<"list" | "single" | "shuffle">("list");
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  
  const seekToFnRef = useRef<(time: number) => void>(() => {});

  const seekTo = useCallback((time: number) => {
    seekToFnRef.current(time);
  }, []);

  const setSeekToFn = useCallback((fn: (time: number) => void) => {
    seekToFnRef.current = fn;
  }, []);

  return (
    <PlayerContext.Provider value={{
      isPlaying, setIsPlaying,
      currentTime, setCurrentTime,
      duration, setDuration,
      isSeeking, setIsSeeking,
      playMode, setPlayMode,
      seekTo, setSeekToFn,
      currentSong, setCurrentSong,
      currentAlbum, setCurrentAlbum
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
}