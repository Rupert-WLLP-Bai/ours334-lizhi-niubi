# 项目架构文档

## 1. 项目概述

这是一个李志音乐播放器项目，包含以下模块：

| 模块 | 目录 | 技术栈 | 职责 |
|------|------|--------|------|
| player | `/player` | Next.js 16 + React 19 + TypeScript | 前端播放器 UI |
| gdrive_downloader | `/gdrive_downloader` | Python 3.12 + gdown + aria2c | Google Drive 文件下载工具 |
| lyrics | `/src/lib/lyrics.ts` | TypeScript | 歌词解析库 |
| lizhi-lyrics | `/lizhi-lyrics` | 静态数据 | 专辑歌词文件存储 |

## 2. 目录结构

```
/home/pejoy/ours334-lizhi-niubi/
├── player/                    # Next.js 前端项目
│   ├── src/
│   │   └── app/
│   │       ├── page.tsx       # 首页 (默认模板)
│   │       ├── layout.tsx    # 根布局
│   │       └── globals.css   # 全局样式 (Tailwind)
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── next-env.d.ts
├── gdrive_downloader/         # Python 下载工具
│   ├── src/
│   │   └── gdrive_downloader/
│   │       └── __init__.py   # 主逻辑
│   ├── manifest.json
│   └── pyproject.toml
├── lizhi-lyrics/              # 静态歌词数据
│   └── albums/                # 专辑目录
│       ├── 1701/
│       ├── 8/
│       ├── F/
│       ├── 你好，郑州/
│       ├── 在每一条伤心的应天大街上/
│       ├── 我爱南京/
│       ├── 梵高先生/
│       ├── 被禁忌的游戏/
│       └── 这个世界会好吗/
├── src/
│   └── lib/
│       └── lyrics.ts         # 歌词解析工具
└── package.json              # 根目录 (空)
```

## 3. 数据流设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         数据流向                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  静态歌词数据          API/下载工具              前端播放器        │
│  lizhi-lyrics ──▶  lyrics.ts ──▶  player (Next.js)              │
│     (文件)             (解析)                (展示/播放)        │
│                                                                  │
│  Google Drive ──▶ gdrive_downloader ──▶ downloads/             │
│     (源)                  (工具)                 (目标)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 4. 当前代码评估

### 4.1 lyrics.ts (优秀)
- ✅ 职责单一，功能清晰
- ✅ 完整的 TypeScript 类型定义
- ✅ 良好的正则表达式处理毫秒精度
- ✅ 清晰的注释和文档

### 4.2 gdrive_downloader (良好)
- ✅ 使用 dataclass 和 slots 优化内存
- ✅ 良好的类型注解
- ✅ 关注点分离 (_collect, _write, _run)
- ⚠️ main 函数职责较重，可进一步拆分

### 4.3 player (基础阶段)
- ⚠️ 缺少组件拆分 (当前只有默认模板页面)
- ⚠️ 缺少类型定义文件
- ⚠️ 缺少 API 路由
- ⚠️ 缺少状态管理
- ⚠️ globals.css 过于简单

## 5. 优化建议

### 5.1 前端项目结构优化

```
player/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 首页
│   │   ├── layout.tsx            # 根布局
│   │   ├── globals.css           # 全局样式
│   │   ├── api/                  # API 路由
│   │   │   ├── songs/            # 歌曲相关
│   │   │   └── lyrics/           # 歌词相关
│   │   └── (routes)/             # 页面路由
│   │       ├── playlist/
│   │       └── player/
│   ├── components/              # 组件
│   │   ├── ui/                   # 基础 UI 组件
│   │   │   ├── Button/
│   │   │   ├── Card/
│   │   │   └── Slider/
│   │   ├── player/               # 播放器组件
│   │   │   ├── Player.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── VolumeControl.tsx
│   │   │   └── PlaybackControls.tsx
│   │   └── lyrics/               # 歌词组件
│   │       ├── LyricDisplay.tsx
│   │       └── LyricLine.tsx
│   ├── lib/                      # 工具库
│   │   ├── lyrics.ts             # 歌词解析
│   │   ├── api.ts                # API 调用
│   │   └── hooks/                # 自定义 Hooks
│   │       ├── usePlayer.ts
│   │       ├── useLyrics.ts
│   │       └── usePlaylist.ts
│   ├── store/                    # 状态管理
│   │   ├── playerStore.ts
│   │   └── playlistStore.ts
│   ├── types/                    # 类型定义
│   │   ├── song.ts
│   │   ├── lyric.ts
│   │   └── player.ts
│   └── constants/               # 常量
│       └── index.ts
├── public/                       # 静态资源
│   ├── images/
│   └── audio/
└── package.json
```

### 5.2 类型定义建议

```typescript
// src/types/song.ts
export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // 秒
  url: string;
  coverUrl?: string;
  lyricsUrl?: string;
}

// src/types/player.ts
export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  currentSong: Song | null;
  playlist: Song[];
  shuffle: boolean;
  repeat: 'none' | 'one' | 'all';
}
```

### 5.3 状态管理建议

推荐使用 Zustand (轻量级):

```typescript
// src/store/playerStore.ts
import { create } from 'zustand';
import { PlayerState, Song } from '@/types';

interface PlayerStore extends PlayerState {
  play: (song?: Song) => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  next: () => void;
  prev: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPlaylist: (songs: Song[]) => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  currentSong: null,
  playlist: [],
  shuffle: false,
  repeat: 'none',

  play: (song) => set({ isPlaying: true, currentSong: song }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  seek: (time) => set({ currentTime: time }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  next: () => { /* 实现逻辑 */ },
  prev: () => { /* 实现逻辑 */ },
  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),
  toggleRepeat: () => set((state) => ({ repeat: ... })),
  setPlaylist: (songs) => set({ playlist: songs }),
}));
```

### 5.4 代码分割和懒加载

```typescript
// src/app/page.tsx
import { lazy, Suspense } from 'react';

const Player = lazy(() => import('@/components/player/Player'));
const LyricDisplay = lazy(() => import('@/components/lyrics/LyricDisplay'));

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Player />
      <LyricDisplay />
    </Suspense>
  );
}
```

### 5.5 错误处理完善

```typescript
// src/lib/api.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchSongs(): Promise<Song[]> {
  try {
    const res = await fetch('/api/songs');
    if (!res.ok) {
      throw new ApiError('Failed to fetch songs', res.status);
    }
    return res.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('Failed to fetch songs:', error);
    throw new ApiError('Network error', 0, error);
  }
}
```

## 6. 扩展性建议

### 6.1 插件化歌词解析

```typescript
// src/lib/lyrics/parsers/index.ts
export interface LyricParser {
  extensions: string[];
  parse(content: string): LyricLine[];
}

export class LrcParser implements LyricParser {
  extensions = ['.lrc'];
  parse(content: string): LyricLine[] { /* ... */ }
}

export class QrcParser implements LyricParser {
  extensions = ['.qrc'];
  parse(content: string): LyricLine[] { /* ... */ }
}
```

### 6.2 多播放器后端支持

```typescript
// src/lib/player/base.ts
export interface AudioPlayer {
  play(): Promise<void>;
  pause(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  on(event: string, callback: (data: unknown) => void): void;
}

// 实现类: Html5AudioPlayer, HowlerPlayer, WebAudioPlayer
```

## 7. 代码异味识别

| 问题 | 位置 | 建议 |
|------|------|------|
| 页面未使用歌词解析工具 | `player/src/app/page.tsx` | 移除或集成歌词组件 |
| 缺少共享类型定义 | 全局 | 创建 `types/` 目录 |
| CSS 变量分散 | `globals.css` | 统一到 Tailwind 配置 |
| API 端点未实现 | 缺失 | 添加 Next.js API Routes |
| 错误边界未设置 | 全局 | 添加 Error Boundary |
| 缺少 loading 状态 | 全局 | 添加 Suspense fallback |

## 8. 总结

当前项目处于早期阶段，核心歌词解析工具质量较高。前端项目需要：
1. 建立完整的类型系统
2. 拆分组件粒度
3. 添加状态管理
4. 实现 API 路由
5. 完善错误处理

建议优先级：
1. **P0**: 创建 `src/types/` 类型定义
2. **P1**: 拆分组件目录结构
3. **P1**: 实现 Zustand 状态管理
4. **P2**: 添加 API 路由
5. **P2**: 实现懒加载和错误边界
