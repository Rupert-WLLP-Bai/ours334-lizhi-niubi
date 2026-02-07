"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from "react";

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
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [playMode, setPlayMode] = useState<"list" | "single" | "shuffle">("list");

  return (
    <PlayerContext.Provider value={{
      isPlaying, setIsPlaying,
      currentTime, setCurrentTime,
      duration, setDuration,
      isSeeking, setIsSeeking,
      playMode, setPlayMode
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
