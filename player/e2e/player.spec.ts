import { test, expect } from '@playwright/test';

test.describe('Music Player E2E', () => {
  test('full navigation and playback flow', async ({ page }) => {
    // 1. Home Page
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('LIZHI MUSIC');
    
    // Wait for albums to load
    const albumCard = page.locator('a[href^="/player/"]').first();
    await expect(albumCard).toBeVisible();
    const albumName = await albumCard.locator('h4').innerText();
    
    // 2. Album Page
    await albumCard.click();
    await expect(page.locator('h1')).toContainText(albumName);
    
    const songItem = page.locator('a[href*="/player/"]').first();
    await expect(songItem).toBeVisible();
    const songTitle = await songItem.locator('div.font-bold').innerText();
    
    // 3. Player Page
    await songItem.click();
    // Wait for player layout to render
    await expect(page.locator('h2')).toContainText(songTitle);
    
    // 4. Playback Controls
    const playButton = page.locator('button >> svg.lucide-play, button >> svg.lucide-pause');
    await expect(playButton).toBeVisible();
    
    // Test toggle play
    const initialIsPlaying = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      return audio ? !audio.paused : false;
    });
    
    await page.locator('button >> svg.lucide-pause, button >> svg.lucide-play').first().click();
    
    const nextIsPlaying = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      return audio ? !audio.paused : false;
    });
    expect(nextIsPlaying).not.toBe(initialIsPlaying);
  });

  test('mobile view toggle lyrics', async ({ page }) => {
    // Set to mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    // Go to a known song (adjusting path as needed)
    await page.goto('/');
    await page.locator('a[href^="/player/"]').first().click();
    await page.locator('a[href*="/player/"]').first().click();
    
    // Should see cover first
    const coverImage = page.locator('main img').first();
    await expect(coverImage).toBeVisible();
    
    // Click cover to switch to lyrics
    await coverImage.click();
    
    // More robust way: find by text content that looks like lyrics
    await expect(page.locator('span[class*="lyricText"]').first()).toBeVisible();
    
    // Click background to return
    await page.locator('div[class*="lyricsContainer"]').click();
    await expect(coverImage).toBeVisible();
  });

  test('playback modes cycle', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href^="/player/"]').first().click();
    await page.locator('a[href*="/player/"]').first().click();
    
    // Find play mode button
    const modeButton = page.locator('button >> svg.lucide-repeat, button >> svg.lucide-repeat-1, button >> svg.lucide-shuffle');
    
    // Initial: List (Repeat)
    await expect(page.locator('button >> svg.lucide-repeat')).toBeVisible();
    
    // Click -> Single (Repeat1)
    await modeButton.click();
    await expect(page.locator('button >> svg.lucide-repeat-1')).toBeVisible();
    
    // Click -> Shuffle
    await modeButton.click();
    await expect(page.locator('button >> svg.lucide-shuffle')).toBeVisible();
    
    // Click -> Back to List
    await modeButton.click();
    await expect(page.locator('button >> svg.lucide-repeat')).toBeVisible();
  });
});