import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import styles from './Lyrics.module.css';
import { formatTime } from '@/lib/lyrics';

interface LyricLine {
  time: number;
  text: string;
}

interface LyricsProps {
  lyrics: LyricLine[];
  currentTime: number;
  onLineClick?: (time: number) => void;
  className?: string;
  onBackToCover?: () => void;
}

export const Lyrics: React.FC<LyricsProps> = ({
  lyrics,
  currentTime,
  onLineClick,
  className = '',
  onBackToCover,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [scrolledLineIndex, setScrolledLineIndex] = useState<number | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // Handle scroll to active line
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

      // Clear the auto-scrolling flag after the smooth scroll finishes (approx 500ms)
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 600);
    }
  }, [activeIndex, isUserScrolling, lyrics.length]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || lyrics.length === 0 || isAutoScrollingRef.current) return;
    
    // Set user scrolling state
    setIsUserScrolling(true);
    
    // Use requestAnimationFrame to throttle calculation
    const container = containerRef.current;
    
    // Only calculate closest line every few frames to save performance
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
    
    // Only update state if index actually changed to prevent unnecessary re-renders
    setScrolledLineIndex((prev) => (prev === closestIndex ? prev : closestIndex));

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      setScrolledLineIndex(null);
    }, 1500); // Shorter timeout for more responsive auto-scroll recovery
  }, [lyrics]);

  const handleConfirmSeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scrolledLineIndex !== null && onLineClick) {
      onLineClick(lyrics[scrolledLineIndex].time);
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
        onClick={() => {
          // On mobile, clicking anywhere that isn't the seek button returns to cover
          if (onBackToCover) onBackToCover();
        }}
      >
        <div className={styles.lyricsWrapper}>
          {/* Spacer - reduced to 30vh to bring first line up */}
          <div className="h-[30vh] w-full flex-shrink-0 pointer-events-none" />
          
          {lyrics.map((line, index) => (
            <div
              key={`${line.time}-${index}`}
              ref={index === activeIndex ? activeLineRef : null}
              className={`${styles.lyricLine} ${
                index === activeIndex ? styles.active : ''
              } ${index < activeIndex ? styles.past : ''} ${
                index === scrolledLineIndex ? styles.scrolled : ''
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <span className={styles.lyricText}>{line.text}</span>
            </div>
          ))}

          {/* Bottom spacer */}
          <div className="h-[40vh] w-full flex-shrink-0 pointer-events-none" />
        </div>
      </div>

      {/* Seek Indicator Line */}
      {scrolledLineIndex !== null && (
        <div className={styles.seekIndicator}>
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
