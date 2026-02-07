# 李志音乐播放器 - iOS Music UI 设计文档

## 1. 设计概述

**设计风格**: iOS 原生 Music 应用风格
**主题**: 黑色背景 + 白色文字 (Dark Mode)
**目标**: 打造沉浸式音乐播放体验

---

## 2. 颜色方案

### 2.1 主色调

```css
:root {
  /* 背景色 - 纯黑 */
  --bg-primary: #000000;
  --bg-secondary: #1c1c1e;
  --bg-tertiary: #2c2c2e;

  /* 文字颜色 - 白色系 */
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.6);
  --text-tertiary: rgba(255, 255, 255, 0.4);

  /* 强调色 - iOS 橙色/红色系 */
  --accent-primary: #ff2d55;  /* iOS Music 粉红 */
  --accent-hover: #ff4772;

  /* 专辑封面渐变 */
  --album-gradient-start: #1a1a2e;
  --album-gradient-end: #16213e;

  /* 进度条颜色 */
  --progress-track: rgba(255, 255, 255, 0.2);
  --progress-filled: #ffffff;

  /* 歌词高亮 */
  --lyric-active: #ffffff;
  --lyric-inactive: rgba(255, 255, 255, 0.5);
  --lyric-shadow: rgba(255, 2, 85, 0.5);
}
```

### 2.2 图标颜色

```css
:root {
  --icon-primary: #ffffff;
  --icon-secondary: rgba(255, 255, 255, 0.7);
  --icon-active: #ff2d55;
}
```

---

## 3. 组件尺寸与间距

### 3.1 整体容器

```css
.player-container {
  width: 100%;
  max-width: 428px; /* iPhone max width */
  height: 100vh;
  background-color: var(--bg-primary);
  padding: 0 20px;
  box-sizing: border-box;
}
```

### 3.2 专辑封面

```css
.album-cover-container {
  display: flex;
  justify-content: center;
  padding-top: 60px;
  padding-bottom: 30px;
}

.album-cover {
  width: 280px;
  height: 280px;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8),
              0 8px 20px rgba(0, 0, 0, 0.4);
  object-fit: cover;
  transition: transform 0.3s ease;
}

.album-cover.playing {
  animation: gentle-pulse 3s ease-in-out infinite;
}
```

### 3.3 歌曲信息区域

```css
.song-info {
  text-align: center;
  padding: 20px 0;
}

.song-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.song-artist {
  font-size: 18px;
  color: var(--text-secondary);
  font-weight: 400;
}
```

### 3.4 进度条

```css
.progress-container {
  padding: 20px 0 10px;
}

.progress-time {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  margin-bottom: 8px;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background-color: var(--progress-track);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
}

.progress-fill {
  height: 100%;
  background-color: var(--progress-filled);
  border-radius: 2px;
  width: 35%;
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  background-color: var(--progress-filled);
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.progress-bar:hover .progress-fill::after {
  opacity: 1;
}
```

### 3.5 播放控制按钮

```css
.playback-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 40px;
  padding: 20px 0;
}

.control-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 12px;
  transition: transform 0.15s ease, opacity 0.2s ease;
}

.control-btn:active {
  transform: scale(0.92);
}

.control-btn svg {
  fill: var(--icon-primary);
}

.btn-small {
  width: 32px;
  height: 32px;
}

.btn-medium {
  width: 44px;
  height: 44px;
}

.btn-large {
  width: 64px;
  height: 64px;
}

.play-pause-btn {
  background-color: var(--accent-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-pause-btn svg {
  fill: #ffffff;
}
```

### 3.6 歌词区域

```css
.lyrics-container {
  height: 200px;
  overflow: hidden;
  text-align: center;
  padding: 10px 0;
  position: relative;
}

.lyrics-wrapper {
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.lyric-line {
  font-size: 16px;
  color: var(--lyric-inactive);
  padding: 12px 20px;
  transition: all 0.3s ease;
  cursor: pointer;
  line-height: 1.5;
}

.lyric-line.active {
  font-size: 20px;
  font-weight: 600;
  color: var(--lyric-active);
  text-shadow: 0 0 20px var(--lyric-shadow);
  transform: scale(1.05);
}

.lyric-line:hover {
  color: var(--text-secondary);
}
```

---

## 4. 动画效果说明

### 4.1 专辑封面动画

```css
@keyframes gentle-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 25px 70px rgba(255, 45, 85, 0.15);
  }
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.album-cover.spinning {
  animation: spin-slow 20s linear infinite;
}
```

### 4.2 播放按钮动画

```css
@keyframes scale-bounce {
  0% { transform: scale(1); }
  50% { transform: scale(0.9); }
  100% { transform: scale(1); }
}

.playing .play-pause-btn {
  animation: scale-bounce 0.3s ease;
}
```

### 4.3 进度条填充动画

```css
.progress-fill {
  transition: width 0.1s linear;
}
```

### 4.4 歌词滚动动画

```css
.lyric-line {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.lyrics-wrapper {
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
```

### 4.5 页面切换动画

```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-enter {
  animation: fade-in 0.3s ease forwards;
}

.slide-enter {
  animation: slide-up 0.4s ease forwards;
}
```

---

## 5. CSS 样式变量完整清单

```css
:root {
  /* ===== 颜色系统 ===== */
  /* 背景 */
  --bg-primary: #000000;
  --bg-secondary: #1c1c1e;
  --bg-tertiary: #2c2c2e;
  --bg-card: #1c1c1e;

  /* 文字 */
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.6);
  --text-tertiary: rgba(255, 255, 255, 0.4);
  --text-inverse: #000000;

  /* 强调色 */
  --accent-primary: #ff2d55;
  --accent-secondary: #ff375f;
  --accent-gradient-start: #ff2d55;
  --accent-gradient-end: #ff6b8a;

  /* 功能色 */
  --success: #30d158;
  --warning: #ffcc00;
  --error: #ff453a;
  --info: #0a84ff;

  /* 专辑封面 */
  --album-shadow: rgba(0, 0, 0, 0.8);
  --album-glow: rgba(255, 45, 85, 0.2);

  /* 进度条 */
  --progress-track: rgba(255, 255, 255, 0.2);
  --progress-filled: #ffffff;
  --progress-knob: #ffffff;

  /* 歌词 */
  --lyric-active: #ffffff;
  --lyric-inactive: rgba(255, 255, 255, 0.5);
  --lyric-shadow: rgba(255, 2, 85, 0.5);

  /* 按钮 */
  --btn-icon: #ffffff;
  --btn-icon-active: #ff2d55;

  /* 边框和分割线 */
  --border-color: rgba(255, 255, 255, 0.1);
  --divider-color: rgba(255, 255, 255, 0.08);

  /* ===== 尺寸系统 ===== */
  /* 圆角 */
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-xxl: 48px;

  /* 专辑封面 */
  --album-size-sm: 160px;
  --album-size-md: 240px;
  --album-size-lg: 320px;
  --album-radius: 16px;

  /* 按钮尺寸 */
  --btn-icon-sm: 24px;
  --btn-icon-md: 32px;
  --btn-icon-lg: 44px;
  --btn-play-size: 64px;

  /* 进度条 */
  --progress-height: 4px;
  --progress-knob-size: 12px;

  /* 歌词 */
  --lyric-font-sm: 14px;
  --lyric-font-md: 16px;
  --lyric-font-lg: 20px;
  --lyric-line-height: 1.6;

  /* ===== 字体系统 ===== */
  --font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
                 'SF Pro Text', 'Helvetica Neue', sans-serif;

  --font-size-xs: 11px;
  --font-size-sm: 13px;
  --font-size-md: 15px;
  --font-size-lg: 17px;
  --font-size-xl: 20px;
  --font-size-xxl: 24px;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* ===== 阴影系统 ===== */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 20px 60px rgba(0, 0, 0, 0.8);

  /* ===== 动画系统 ===== */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.3s ease;
  --transition-slow: 0.5s ease;

  --timing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --timing-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --timing-sharp: cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 6. 响应式设计

```css
/* iPhone SE / 小屏设备 */
@media (max-width: 375px) {
  .album-cover {
    width: 240px;
    height: 240px;
  }

  .song-title {
    font-size: 20px;
  }

  .lyrics-container {
    height: 160px;
  }
}

/* iPhone Pro Max */
@media (min-width: 428px) {
  .player-container {
    max-width: 428px;
    margin: 0 auto;
  }
}

/* 横屏模式 */
@media (orientation: landscape) {
  .player-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    align-items: center;
    padding: 20px 60px;
  }

  .album-cover-container {
    padding-top: 0;
  }

  .album-cover {
    width: 300px;
    height: 300px;
  }

  .lyrics-container {
    height: 280px;
  }
}
```

---

## 7. 组件结构

```
player/
├── components/
│   ├── AlbumCover/
│   │   ├── AlbumCover.tsx
│   │   └── AlbumCover.css
│   ├── SongInfo/
│   │   ├── SongInfo.tsx
│   │   └── SongInfo.css
│   ├── ProgressBar/
│   │   ├── ProgressBar.tsx
│   │   └── ProgressBar.css
│   ├── PlaybackControls/
│   │   ├── PlaybackControls.tsx
│   │   └── PlaybackControls.css
│   ├── Lyrics/
│   │   ├── Lyrics.tsx
│   │   └── Lyrics.css
│   └── Playlist/
│       ├── Playlist.tsx
│       └── Playlist.css
├── styles/
│   ├── variables.css    # CSS 变量
│   ├── animations.css   # 动画定义
│   └── global.css       # 全局样式
└── hooks/
    └── usePlayer.ts     # 播放器状态管理
```

---

## 8. 图标规范

推荐使用 SVG 图标，保持一致风格：

| 图标 | 尺寸 | 用途 |
|------|------|------|
| 播放 | 32x32 | 开始播放 |
| 暂停 | 32x32 | 暂停播放 |
| 上一首 | 24x24 | 上一首 |
| 下一首 | 24x24 | 下一首 |
| 随机播放 | 24x24 | shuffle |
| 循环播放 | 24x24 | repeat |
| 喜欢 | 24x24 | favorite |
| 不喜欢 | 24x24 | unfavorite |

---

## 9. 无障碍设计

```css
/* 焦点状态 */
button:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 4px;
}

/* 减小动态效果 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  :root {
    --text-secondary: rgba(255, 255, 255, 0.8);
    --progress-track: rgba(255, 255, 255, 0.4);
  }
}
```

---

## 10. 设计原则

1. **简洁至上**: 去除多余装饰，聚焦内容
2. **一致性**: 统一的间距、颜色、字体
3. **视觉层次**: 通过大小、粗细、颜色区分主次
4. **流畅动画**: 微妙的过渡效果增强体验
5. **无障碍**: 考虑色盲、视障用户需求

---

**文档版本**: 1.0
**最后更新**: 2026-02-07
