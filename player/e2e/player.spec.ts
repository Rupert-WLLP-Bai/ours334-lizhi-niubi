import { test, expect, type Page } from '@playwright/test';

async function openAlbumPage(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /LIZHI MUSIC/i })).toBeVisible();

  const firstAlbumLink = page.getByTestId('home-album-link').first();
  await expect(firstAlbumLink).toBeVisible();
  const albumHref = await firstAlbumLink.getAttribute('href');
  expect(albumHref).toBeTruthy();
  await page.goto(albumHref!);

  await expect(page).toHaveURL(/\/player\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function openPlayerPage(page: Page) {
  await openAlbumPage(page);

  const lrcSongLink = page.getByTestId('album-song-link').filter({
    has: page.locator('span:has-text("LRC")'),
  }).first();

  if (await lrcSongLink.count()) {
    const songHref = await lrcSongLink.getAttribute('href');
    expect(songHref).toBeTruthy();
    await page.goto(songHref!);
  } else {
    const fallbackSongHref = await page.getByTestId('album-song-link').first().getAttribute('href');
    expect(fallbackSongHref).toBeTruthy();
    await page.goto(fallbackSongHref!);
  }

  await expect(page).toHaveURL(/\/player\/[^/]+\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
}

test.describe('Music Player E2E', () => {
  test('full navigation and playback flow', async ({ page }) => {
    await openPlayerPage(page);

    const audio = page.locator('audio');
    await expect(audio).toHaveAttribute('src', /\/api\/audio\?/);

    const playToggleButton = page.getByTestId('play-toggle-button').first();
    await expect(playToggleButton).toBeVisible();
    await playToggleButton.click();

    await expect(audio).toHaveCount(1);
  });

  test('mobile view toggles between cover and lyrics', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openPlayerPage(page);

    const coverView = page.getByTestId('player-cover-view');
    const lyricsContainer = page.getByTestId('lyrics-scroll-container');

    await expect(coverView).toBeVisible();
    await coverView.click();

    await expect(lyricsContainer).toBeVisible();
    await lyricsContainer.click();
    await expect(coverView).toBeVisible();
  });

  test('playback modes cycle in expected order', async ({ page }) => {
    await openPlayerPage(page);

    const modeButton = page.getByTestId('play-mode-button');
    await expect(modeButton).toBeVisible();

    await expect(modeButton.locator('svg.lucide-repeat')).toBeVisible();
    await modeButton.click();

    await expect(modeButton.locator('svg.lucide-repeat-1')).toBeVisible();
    await modeButton.click();

    await expect(modeButton.locator('svg.lucide-shuffle')).toBeVisible();
    await modeButton.click();

    await expect(modeButton.locator('svg.lucide-repeat')).toBeVisible();
  });
});
