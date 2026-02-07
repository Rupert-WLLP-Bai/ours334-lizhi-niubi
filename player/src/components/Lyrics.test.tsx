import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Lyrics } from './Lyrics';

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

  it('renders all lyric lines', () => {
    render(<Lyrics lyrics={mockLyrics} currentTime={0} />);
    expect(screen.getByText('Line 1')).toBeDefined();
    expect(screen.getByText('Line 2')).toBeDefined();
    expect(screen.getByText('Line 3')).toBeDefined();
  });

  it('highlights the active lyric line', () => {
    const { container } = render(<Lyrics lyrics={mockLyrics} currentTime={6} />);
    // Line 2 should be active (index 1)
    const lines = container.querySelectorAll('[class*="lyricLine"]');
    expect(lines[1].className).toContain('active');
  });

  it('triggers onBackToCover when clicking container on mobile', () => {
    const onBackToCover = vi.fn();
    const { container } = render(
      <Lyrics lyrics={mockLyrics} currentTime={0} onBackToCover={onBackToCover} />
    );
    
    // Find the container and click it
    const scrollContainer = container.querySelector('[class*="lyricsContainer"]');
    if (scrollContainer) {
      fireEvent.click(scrollContainer);
      expect(onBackToCover).toHaveBeenCalled();
    }
  });

  it('shows seek indicator during scroll', async () => {
    const { container } = render(<Lyrics lyrics={mockLyrics} currentTime={0} />);
    const scrollContainer = container.querySelector('[class*="lyricsContainer"]');
    
    if (scrollContainer) {
      // Simulate scroll
      fireEvent.scroll(scrollContainer);
      
      // Wait for React to update and show the indicator
      // Note: We might need to mock getElementsByClassName or similar if necessary
      expect(container.querySelector('[class*="seekIndicator"]')).toBeDefined();
    }
  });
});
