import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import styles from './Lyrics.module.css';

interface LyricLine {
  time: number;
  text: string;
}

interface LyricsProps {
  lyrics: LyricLine[];
  currentTime: number;
  onLineClick?: (time: number) => void;
  className?: string;
}

export const Lyrics: React.FC<LyricsProps> = ({
  lyrics,
  currentTime,
  onLineClick,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Smooth scroll to active line
  useEffect(() => {
    if (activeIndex >= 0 && activeLineRef.current && containerRef.current && !isUserScrolling) {
      const container = containerRef.current;
      const activeLine = activeLineRef.current;
      const containerHeight = container.clientHeight;
      const activeLineTop = activeLine.offsetTop;
      const activeLineHeight = activeLine.clientHeight;
      const targetScroll = activeLineTop - (containerHeight / 2) + (activeLineHeight / 2);

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [activeIndex, isUserScrolling]);

  const handleScroll = useCallback(() => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 2000);
  }, []);

  const handleLineClick = (line: LyricLine) => {
    if (onLineClick) {
      onLineClick(line.time);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.lyricsContainer} ${className} scrollbar-hide`}
      onScroll={handleScroll}
      style={{ height: '100%', maxWidth: 'none' }}
    >
      <div className={styles.lyricsWrapper}>
        {lyrics.length === 0 ? (
          <div className={styles.emptyState}>
            <p>暂无歌词</p>
            <p className={styles.hint}>播放音乐时自动显示歌词</p>
          </div>
        ) : (
          <>
            <div className="h-[40vh] flex-shrink-0" />
            {lyrics.map((line, index) => (
              <div
                key={`${line.time}-${index}`}
                ref={index === activeIndex ? activeLineRef : null}
                className={`${styles.lyricLine} ${
                  index === activeIndex ? styles.active : ''
                } ${index < activeIndex ? styles.past : ''}`}
                onClick={() => handleLineClick(line)}
              >
                <span className={styles.lyricText}>{line.text}</span>
              </div>
            ))}
            <div className="h-[40vh] flex-shrink-0" />
          </>
        )}
      </div>
    </div>
  );
};

export type { LyricLine, LyricsProps };