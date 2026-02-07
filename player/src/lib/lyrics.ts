export interface LyricLine {
  time: number;
  text: string;
}

export function parseLyrics(lrcContent: string): LyricLine[] {
  const lines = lrcContent.split('\n');
  const lyrics: LyricLine[] = [];

  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const time = minutes * 60 + seconds + milliseconds / 1000;
      const text = line.replace(timeRegex, '').trim();

      if (text) {
        lyrics.push({ time, text });
      }
    }
  }

  return lyrics;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function findCurrentLyric(lyrics: LyricLine[], currentTime: number): number {
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (lyrics[i].time <= currentTime) {
      return i;
    }
  }
  return -1;
}
