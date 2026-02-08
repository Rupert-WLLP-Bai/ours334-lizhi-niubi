import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import styles from './Lyrics.module.css';
import { formatTime } from '@/lib/lyrics';
import { usePlayer } from '@/app/player/PlayerContext';

export interface LyricLine {
  time: number;
  text: string;
}

interface LyricsProps {
  lyrics: LyricLine[];
  currentTime: number;
  className?: string;
  onBackToCover?: () => void;
}

export const Lyrics: React.FC<LyricsProps> = ({
  lyrics,
  currentTime,
  className = '',
  onBackToCover,
}) => {
  const { seekTo } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [scrolledLineIndex, setScrolledLineIndex] = useState<number | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoScrollingRef = useRef(false);

  const activeIndex = useMemo(() => {
    let activeIdx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime >= lyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  }, [currentTime, lyrics]);

  useEffect(() => {
    if (activeIndex >= 0 && activeLineRef.current && containerRef.current && !isUserScrolling) {
      const container = containerRef.current;
      const activeLine = activeLineRef.current;
      const targetScroll = activeLine.offsetTop - (container.clientHeight / 2) + (activeLine.clientHeight / 2);

      isAutoScrollingRef.current = true;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });

      if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current);
      autoScrollTimeoutRef.current = setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 600);
    }
  }, [activeIndex, isUserScrolling, lyrics.length]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || lyrics.length === 0 || isAutoScrollingRef.current) return;
    setIsUserScrolling(true);
    
    const container = containerRef.current;
    const scrollCenter = container.scrollTop + container.clientHeight / 2;
    const lines = container.getElementsByClassName(styles.lyricLine);
    
    let closestIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as HTMLElement;
      const lineCenter = line.offsetTop + line.clientHeight / 2;
      const distance = Math.abs(scrollCenter - lineCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    
    setScrolledLineIndex((prev) => (prev === closestIndex ? prev : closestIndex));

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      setScrolledLineIndex(null);
    }, 1500);
  }, [lyrics]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current);
    };
  }, []);

  const handleConfirmSeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scrolledLineIndex !== null) {
      seekTo(lyrics[scrolledLineIndex].time);
      setIsUserScrolling(false);
      setScrolledLineIndex(null);
    }
  };

  return (
    <div className={`${styles.lyricsRoot} ${className}`}>
      <div
        ref={containerRef}
        className={`${styles.lyricsContainer} scrollbar-hide`}
        onScroll={handleScroll}
        data-testid="lyrics-scroll-container"
        onClick={() => {
          if (onBackToCover) onBackToCover();
        }}
      >
        <div className={styles.lyricsWrapper}>
          <div className="h-[24vh] md:h-[30vh] w-full flex-shrink-0 pointer-events-none" />
          {lyrics.map((line, index) => (
            <div
              key={`${line.time}-${index}`}
              ref={index === activeIndex ? activeLineRef : null}
              className={`${styles.lyricLine} ${
                index === activeIndex ? styles.active : ''
              } ${index < activeIndex ? styles.past : ''} ${
                index === scrolledLineIndex ? styles.scrolled : ''
              }`}
            >
              <span className={styles.lyricText}>{line.text}</span>
            </div>
          ))}
          <div className="h-[30vh] md:h-[40vh] w-full flex-shrink-0 pointer-events-none" />
        </div>
      </div>

      {scrolledLineIndex !== null && (
        <div className={styles.seekIndicator} data-testid="lyrics-seek-indicator">
          <div className={styles.seekLine} />
          <div className={styles.seekTime}>{formatTime(lyrics[scrolledLineIndex].time)}</div>
          <button className={styles.seekButton} onClick={handleConfirmSeek}>
            <Play className="w-4 h-4 fill-current" />
          </button>
        </div>
      )}
    </div>
  );
};
