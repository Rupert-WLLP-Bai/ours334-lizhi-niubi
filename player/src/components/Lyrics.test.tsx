import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Lyrics } from './Lyrics';
import { PlayerProvider } from '@/app/player/PlayerContext';

// Mock scroll methods since JSDOM doesn't support them
window.HTMLElement.prototype.scrollTo = vi.fn();

describe('Lyrics Component', () => {
  const mockLyrics = [
    { time: 0, text: 'Line 1' },
    { time: 5, text: 'Line 2' },
    { time: 10, text: 'Line 3' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderLyrics = (props?: Partial<ComponentProps<typeof Lyrics>>) =>
    render(
      <PlayerProvider>
        <Lyrics lyrics={mockLyrics} currentTime={0} {...props} />
      </PlayerProvider>
    );

  it('renders all lyric lines', () => {
    renderLyrics();
    expect(screen.getByText('Line 1')).toBeDefined();
    expect(screen.getByText('Line 2')).toBeDefined();
    expect(screen.getByText('Line 3')).toBeDefined();
  });

  it('highlights the active lyric line', () => {
    const { container } = renderLyrics({ currentTime: 6 });
    const lines = container.querySelectorAll('[class*="lyricLine"]');
    expect(lines[1].className).toContain('active');
  });

  it('triggers onBackToCover when clicking container on mobile', () => {
    const onBackToCover = vi.fn();
    renderLyrics({ onBackToCover });
    fireEvent.click(screen.getByTestId('lyrics-scroll-container'));
    expect(onBackToCover).toHaveBeenCalledTimes(1);
  });

  it('shows seek indicator while user is scrolling', async () => {
    renderLyrics({ currentTime: -1 });
    const scrollContainer = screen.getByTestId('lyrics-scroll-container');
    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(screen.getByTestId('lyrics-seek-indicator')).toBeDefined();
    });
  });
});
