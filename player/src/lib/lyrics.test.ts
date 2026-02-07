import { describe, it, expect } from 'vitest';
import { parseLyrics, formatTime, findCurrentLyric } from './lyrics';

describe('Lyrics Library', () => {
  describe('parseLyrics', () => {
    it('should parse standard LRC format correctly', () => {
      const lrc = `
        [00:01.00]First line
        [00:02.50]Second line
        [00:05.00]Third line
      `;
      const result = parseLyrics(lrc);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ time: 1, text: 'First line' });
      expect(result[1]).toEqual({ time: 2.5, text: 'Second line' });
    });

    it('should handle empty lines and invalid formats', () => {
      const lrc = `
        [00:01.00]Valid line
        
        [invalid]Oops
        [00:02.00]
      `;
      const result = parseLyrics(lrc);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Valid line');
    });
  });

  describe('formatTime', () => {
    it('should format seconds into MM:SS correctly', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(65)).toBe('1:05');
      expect(formatTime(3601)).toBe('60:01');
    });
  });

  describe('findCurrentLyric', () => {
    const lyrics = [
      { time: 0, text: 'Line 1' },
      { time: 10, text: 'Line 2' },
      { time: 20, text: 'Line 3' },
    ];

    it('should find the correct index based on time', () => {
      expect(findCurrentLyric(lyrics, 5)).toBe(0);
      expect(findCurrentLyric(lyrics, 10)).toBe(1);
      expect(findCurrentLyric(lyrics, 15)).toBe(1);
      expect(findCurrentLyric(lyrics, 25)).toBe(2);
      expect(findCurrentLyric(lyrics, -1)).toBe(-1);
    });
  });
});
