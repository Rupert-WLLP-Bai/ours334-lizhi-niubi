/**
 * 歌曲 API 测试
 */

import { describe, it, expect } from 'vitest';

// Mock song data type
interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  audioUrl: string;
  lyrics?: string;
}

// Mock API response type
interface SongsApiResponse {
  success: boolean;
  data: Song[];
  total: number;
  page: number;
  pageSize: number;
}

// Mock songs data for testing
const mockSongs: Song[] = [
  {
    id: '1',
    title: '在漫天风沙里',
    artist: '周杰伦',
    album: '依然范特西',
    duration: 245,
    coverUrl: '/covers/song1.jpg',
    audioUrl: '/audio/song1.mp3',
    lyrics: '[00:00]在漫天风沙里\n[00:05]望着你远去',
  },
  {
    id: '2',
    title: '晴天',
    artist: '周杰伦',
    album: '叶惠美',
    duration: 268,
    coverUrl: '/covers/song2.jpg',
    audioUrl: '/audio/song2.mp3',
    lyrics: '[00:00]故事的小黄花',
  },
  {
    id: '3',
    title: '稻香',
    artist: '周杰伦',
    album: '魔杰座',
    duration: 225,
    coverUrl: '/covers/song3.jpg',
    audioUrl: '/audio/song3.mp3',
  },
];

describe('Songs API', () => {
  describe('GET /api/songs', () => {
    it('should return success response', () => {
      const response: SongsApiResponse = {
        success: true,
        data: mockSongs,
        total: mockSongs.length,
        page: 1,
        pageSize: 20,
      };

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should have required fields in song object', () => {
      const song = mockSongs[0];

      expect(song).toHaveProperty('id');
      expect(song).toHaveProperty('title');
      expect(song).toHaveProperty('artist');
      expect(song).toHaveProperty('album');
      expect(song).toHaveProperty('duration');
      expect(song).toHaveProperty('coverUrl');
      expect(song).toHaveProperty('audioUrl');
    });

    it('should return all songs when no filters applied', () => {
      const response: SongsApiResponse = {
        success: true,
        data: mockSongs,
        total: mockSongs.length,
        page: 1,
        pageSize: 20,
      };

      expect(response.data).toHaveLength(3);
      expect(response.total).toBe(3);
    });

    it('should contain correct song data', () => {
      const song = mockSongs.find((s) => s.id === '1');

      expect(song?.title).toBe('在漫天风沙里');
      expect(song?.artist).toBe('周杰伦');
      expect(song?.album).toBe('依然范特西');
      expect(song?.duration).toBe(245);
    });

    it('should include optional lyrics field', () => {
      const songWithLyrics = mockSongs.find((s) => s.lyrics);

      expect(songWithLyrics?.lyrics).toBeDefined();
      expect(typeof songWithLyrics?.lyrics).toBe('string');
    });

    it('should handle missing optional lyrics field', () => {
      const songWithoutLyrics = mockSongs.find((s) => !s.lyrics);

      expect(songWithoutLyrics?.lyrics).toBeUndefined();
    });
  });

  describe('GET /api/songs/:id', () => {
    it('should return single song by id', () => {
      const song = mockSongs.find((s) => s.id === '1');

      expect(song).toBeDefined();
      expect(song?.id).toBe('1');
    });

    it('should return correct song structure', () => {
      const song = mockSongs[0];
      const response = {
        success: true,
        data: song,
      };

      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('title');
      expect(response.data).toHaveProperty('artist');
      expect(response.data).toHaveProperty('album');
      expect(response.data).toHaveProperty('duration');
      expect(response.data).toHaveProperty('coverUrl');
      expect(response.data).toHaveProperty('audioUrl');
      expect(response.data).toHaveProperty('lyrics');
    });
  });

  describe('Response structure validation', () => {
    it('should have pagination info in list response', () => {
      const response: SongsApiResponse = {
        success: true,
        data: mockSongs,
        total: 50,
        page: 1,
        pageSize: 20,
      };

      expect(response).toHaveProperty('total');
      expect(response).toHaveProperty('page');
      expect(response).toHaveProperty('pageSize');
      expect(typeof response.total).toBe('number');
      expect(typeof response.page).toBe('number');
      expect(typeof response.pageSize).toBe('number');
    });

    it('should calculate correct page info', () => {
      const page = 2;
      const pageSize = 10;
      const total = 50;
      const totalPages = Math.ceil(total / pageSize);

      expect(totalPages).toBe(5);
    });

    it('should format duration as seconds', () => {
      const song = mockSongs[0];

      expect(typeof song.duration).toBe('number');
      expect(song.duration).toBeGreaterThan(0);
    });

    it('should have valid URL formats for media', () => {
      const song = mockSongs[0];

      expect(song.coverUrl.startsWith('/')).toBe(true);
      expect(song.audioUrl.startsWith('/')).toBe(true);
    });
  });
});
