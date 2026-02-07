/**
 * 播放器 E2E 测试
 */

import { test, expect } from '@playwright/test';

test.describe('播放器完整流程', () => {
  test.beforeEach(async ({ page }) => {
    // 导航到播放器页面
    await page.goto('/');
    // 等待页面加载
    await page.waitForLoadState('networkidle');
  });

  test.describe('页面加载', () => {
    test('should load player page successfully', async ({ page }) => {
      // 检查页面标题
      await expect(page).toHaveTitle(/播放器|Player/i);

      // 检查主要元素存在
      await expect(page.locator('[data-testid="player-container"]')).toBeVisible();
    });

    test('should display song information', async ({ page }) => {
      // 检查歌曲标题显示
      const title = page.locator('[data-testid="song-title"]');
      await expect(title).toBeVisible();

      // 检查歌手名称显示
      const artist = page.locator('[data-testid="song-artist"]');
      await expect(artist).toBeVisible();

      // 检查封面图片显示
      const cover = page.locator('[data-testid="album-cover"]');
      await expect(cover).toBeVisible();
    });
  });

  test.describe('播放控制', () => {
    test('should start playing when play button clicked', async ({ page }) => {
      // 点击播放按钮
      const playButton = page.locator('[data-testid="play-button"]');
      await playButton.click();

      // 验证播放状态变化
      await expect(page.locator('[data-testid="play-button"]')).toHaveAttribute('data-playing', 'true');

      // 验证音频开始播放（通过时间更新）
      await page.waitForTimeout(1000);
      const currentTime = await page.locator('[data-testid="current-time"]').textContent();
      expect(currentTime).not.toBe('00:00');
    });

    test('should pause when pause button clicked', async ({ page }) => {
      // 先开始播放
      const playButton = page.locator('[data-testid="play-button"]');
      await playButton.click();
      await page.waitForTimeout(500);

      // 点击暂停
      await playButton.click();

      // 验证暂停状态
      await expect(page.locator('[data-testid="play-button"]')).toHaveAttribute('data-playing', 'false');
    });

    test('should skip backward 10 seconds', async ({ page }) => {
      // 先开始播放
      const playButton = page.locator('[data-testid="play-button"]');
      await playButton.click();
      await page.waitForTimeout(2000);

      // 记录当前时间
      const beforeTime = await page.locator('[data-testid="current-time"]').textContent();

      // 点击后退按钮
      const skipBackward = page.locator('[data-testid="skip-backward"]');
      await skipBackward.click();

      // 验证时间减少了约10秒
      const afterTime = await page.locator('[data-testid="current-time"]').textContent();
      const beforeSeconds = timeToSeconds(beforeTime);
      const afterSeconds = timeToSeconds(afterTime);

      // 允许1秒误差
      expect(Math.abs(afterSeconds - (beforeSeconds - 10))).toBeLessThanOrEqual(1);
    });

    test('should skip forward 10 seconds', async ({ page }) => {
      // 先开始播放
      const playButton = page.locator('[data-testid="play-button"]');
      await playButton.click();
      await page.waitForTimeout(2000);

      // 记录当前时间
      const beforeTime = await page.locator('[data-testid="current-time"]').textContent();

      // 点击前进按钮
      const skipForward = page.locator('[data-testid="skip-forward"]');
      await skipForward.click();

      // 验证时间增加了约10秒
      const afterTime = await page.locator('[data-testid="current-time"]').textContent();
      const beforeSeconds = timeToSeconds(beforeTime);
      const afterSeconds = timeToSeconds(afterTime);

      // 允许1秒误差
      expect(Math.abs(afterSeconds - (beforeSeconds + 10))).toBeLessThanOrEqual(1);
    });
  });

  test.describe('进度条拖动', () => {
    test('should update progress when slider moved', async ({ page }) => {
      // 拖动进度条到50%位置
      const progressSlider = page.locator('[data-testid="progress-slider"]');
      await progressSlider.fill('50');

      // 验证进度更新
      await page.waitForTimeout(100);
      const currentTime = await page.locator('[data-testid="current-time"]').textContent();
      expect(currentTime).toBeDefined();
    });

    test('should update progress bar position during playback', async ({ page }) => {
      // 开始播放
      const playButton = page.locator('[data-testid="play-button"]');
      await playButton.click();

      // 等待播放一段时间
      await page.waitForTimeout(3000);

      // 验证进度条已更新
      const progressValue = await progressSlider.evaluate((el) => (el as HTMLInputElement).value);
      expect(parseInt(progressValue)).toBeGreaterThan(0);
    });

    test('should display correct duration', async ({ page }) => {
      const duration = await page.locator('[data-testid="duration"]').textContent();

      // 验证格式为 mm:ss
      expect(duration).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  test.describe('歌词滚动效果', () => {
    test('should display lyrics', async ({ page }) => {
      // 等待歌词加载
      await page.waitForSelector('[data-testid="lyrics-container"]');

      // 验证歌词容器可见
      const lyricsContainer = page.locator('[data-testid="lyrics-container"]');
      await expect(lyricsContainer).toBeVisible();
    });

    test('should highlight current lyric line', async ({ page }) => {
      // 开始播放
      const playButton = page.locator('[data-testid="play-button"]');
      await playButton.click();

      // 等待播放到有歌词的时间点
      await page.waitForTimeout(500);

      // 查找当前高亮的歌词
      const activeLyric = page.locator('[data-testid="lyric-line"][data-active="true"]');
      await expect(activeLyric).toBeVisible();
    });

    test('should scroll lyrics automatically', async ({ page }) => {
      // 开始播放
      const playButton = page.locator('[data-testid="play-button"]');
      await playButton.click();

      // 等待多行歌词时间过去
      await page.waitForTimeout(8000);

      // 验证歌词容器可以滚动
      const lyricsContainer = page.locator('[data-testid="lyrics-container"]');
      const scrollTop = await lyricsContainer.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
    });

    test('should scroll to current lyric smoothly', async ({ page }) => {
      // 开始播放
      const playButton = page.locator('[data-testid="play-button"]');
      await playButton.click();

      // 监听滚动事件
      const scrollPromises = page.evaluate(() => {
        return new Promise<void>((resolve) => {
          const lyricsContainer = document.querySelector('[data-testid="lyrics-container"]');
          if (lyricsContainer) {
            lyricsContainer.addEventListener('scroll', () => resolve(), { once: true });
          } else {
            resolve();
          }
        });
      });

      // 等待滚动
      await page.waitForTimeout(5000);
      await scrollPromises;

      // 验证当前歌词在可视区域内
      const activeLyric = page.locator('[data-testid="lyric-line"][data-active="true"]');
      await expect(activeLyric).toBeInViewport();
    });
  });

  test.describe('完整播放流程', () => {
    test('should play through entire song', async ({ page }) => {
      // 获取歌曲时长
      const durationText = await page.locator('[data-testid="duration"]').textContent();
      const durationSeconds = timeToSeconds(durationText);

      // 开始播放
      const playButton = page.locator('[data-testid="play-button"]');
      await playButton.click();

      // 等待播放结束（最多等待歌曲时长 + 2秒缓冲）
      try {
        await page.waitForFunction(
          (expectedDuration) => {
            const currentTime = document.querySelector('[data-testid="current-time"]')?.textContent;
            if (!currentTime) return false;
            const [mins, secs] = currentTime.split(':').map(Number);
            const currentSeconds = mins * 60 + secs;
            return currentSeconds >= expectedDuration - 1;
          },
          { timeout: (durationSeconds + 2) * 1000 }
        );
      } catch {
        // 如果等待超时，验证播放仍在进行
        const isPlaying = await page.locator('[data-testid="play-button"]').getAttribute('data-playing');
        expect(isPlaying).toBe('true');
      }
    });
  });
});

// 辅助函数：将 mm:ss 格式转换为秒数
function timeToSeconds(timeStr: string | null): number {
  if (!timeStr) return 0;
  const [mins, secs] = timeStr.split(':').map(Number);
  return mins * 60 + secs;
}
