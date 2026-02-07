import React, { useRef, useEffect, useCallback, useState } from 'react';
import styles from './Lyrics.module.css';

interface LyricLine {
  time: number;
  text: string;
}

interface LyricsProps {
  lyrics: LyricLine[];
  currentTime: number;
  onLineClick?: (time: number) => void;
  height?: number;
}

export const Lyrics: React.FC<LyricsProps> = ({
  lyrics,
  currentTime,
  onLineClick,
  height = 300,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchY, setTouchY] = useState<number | null>(null);

  // Find active line based on current time
  useEffect(() => {
    let activeIdx = 0;
    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime >= lyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }
    setActiveIndex(activeIdx);
  }, [currentTime, lyrics]);

  // Smooth scroll to active line
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeLine = activeLineRef.current;
      const containerHeight = container.clientHeight;
      const activeLineTop = activeLine.offsetTop;
      const activeLineHeight = activeLine.clientHeight;
      const targetScroll = activeLineTop - (containerHeight / 2) + (activeLineHeight / 2);

      requestAnimationFrame(() => {
        container.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth',
        });
      });
    }
  }, [activeIndex]);

  // Handle touch/mouse drag for seeking
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setTouchY(clientY);
  };

  const handleTouchMove = useCallback(
    (e: TouchEvent | React.MouseEvent) => {
      if (touchY === null || !containerRef.current) return;

      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = touchY - clientY;

      // Manual scrolling
      containerRef.current.scrollTop += deltaY * 1.5;
      setTouchY(clientY);
    },
    [touchY]
  );

  const handleTouchEnd = () => {
    setTouchY(null);
  };

  // Click on lyric line to seek
  const handleLineClick = (line: LyricLine) => {
    if (onLineClick) {
      onLineClick(line.time);
    }
  };

  // Manual scroll detection
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    // Could implement parallax effect or other visual feedback here
  }, []);

  return (
    <div
      ref={containerRef}
      className={styles.lyricsContainer}
      style={{ height }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove as React.TouchEventHandler}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      onScroll={handleScroll}
    >
      <div className={styles.lyricsWrapper}>
        {lyrics.length === 0 ? (
          <div className={styles.emptyState}>
            <p>暂无歌词</p>
            <p className={styles.hint}>播放音乐时自动显示歌词</p>
          </div>
        ) : (
          <>
            {/* Padding at top */}
            <div className={styles.paddingLine} />

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
                {index === activeIndex && (
                  <span className={styles.timeIndicator}>
                    {formatTime(line.time)}
                  </span>
                )}
              </div>
            ))}

            {/* Padding at bottom */}
            <div className={styles.paddingLine} />
          </>
        )}
      </div>
    </div>
  );
};

// Format time helper
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export type { LyricLine, LyricsProps };
