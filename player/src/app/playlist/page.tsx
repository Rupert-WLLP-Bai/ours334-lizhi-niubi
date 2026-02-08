"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Heart, Play, Trash2 } from "lucide-react";

type AuthUser = {
  id: number;
  email: string;
  role: string;
};

type PlaylistItem = {
  songId: string;
  songTitle: string;
  albumName: string;
  position: number;
  createdAt: string;
};

export default function PlaylistPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [removingSongId, setRemovingSongId] = useState<string | null>(null);
  const [movingSongId, setMovingSongId] = useState<string | null>(null);
  const firstSong = items[0];

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const meResponse = await fetch("/api/auth/me", { cache: "no-store" });
        const meData = await meResponse.json();
        if (!active) return;
        const currentUser = meData.user ?? null;
        setUser(currentUser);
        if (!currentUser) {
          setItems([]);
          setLoading(false);
          return;
        }

        const playlistResponse = await fetch("/api/library/playlist?playlistId=later", {
          cache: "no-store",
        });
        if (!playlistResponse.ok) {
          setItems([]);
          setLoading(false);
          return;
        }
        const playlistData = await playlistResponse.json();
        if (!active) return;
        setItems(playlistData.items || []);
      } catch {
        if (!active) return;
        setUser(null);
        setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const removeSong = async (songId: string) => {
    if (!user || !songId) return;
    setRemovingSongId(songId);
    try {
      const response = await fetch("/api/library/playlist/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistId: "later",
          songId,
        }),
      });
      if (!response.ok) return;
      setItems((prev) => prev.filter((item) => item.songId !== songId));
    } finally {
      setRemovingSongId(null);
    }
  };

  const moveSong = async (index: number, direction: -1 | 1) => {
    if (!user || movingSongId) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const previousItems = items;
    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    const nextItems = reordered.map((item, position) => ({ ...item, position }));

    setMovingSongId(moved.songId);
    setItems(nextItems);

    try {
      const response = await fetch("/api/library/playlist/items/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistId: "later",
          songIds: nextItems.map((item) => item.songId),
        }),
      });
      if (!response.ok) {
        setItems(previousItems);
      }
    } catch {
      setItems(previousItems);
    } finally {
      setMovingSongId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-gradient-to-b from-[#ff2d55]/10 to-transparent pointer-events-none -z-10 blur-3xl opacity-50" />

      <header className="sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <Link href="/" className="p-2 rounded-full hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Link>
          <h2 className="text-xs md:text-sm font-bold uppercase tracking-widest text-white/60">我的歌单</h2>
          <div className="w-9" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <section className="px-4 pt-6 pb-6 md:px-6 md:pt-10 md:pb-8 flex items-end gap-4 md:gap-8">
          <div className="relative w-24 h-24 md:w-44 md:h-44 flex-shrink-0 bg-white/5 shadow-2xl border border-white/10">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff2d55]/30 via-[#ff2d55]/10 to-black" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Heart className="w-8 h-8 md:w-12 md:h-12 text-[#ff2d55] fill-current" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <span className="hidden md:inline-block px-3 py-1 bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest mb-3">
              Playlist
            </span>
            <h1 className="text-2xl md:text-5xl font-bold tracking-tight">红心歌单</h1>
            <div className="mt-2 text-xs md:text-sm text-white/45 flex flex-wrap items-center gap-2 md:gap-3">
              <span>{items.length} 首歌曲</span>
              <span className="text-white/20">•</span>
              <span className="truncate">{user ? user.email : "未登录"}</span>
            </div>
            <div className="mt-4">
              {user && firstSong ? (
                <Link
                  href={`/player/${encodeURIComponent(firstSong.albumName)}/${encodeURIComponent(firstSong.songTitle)}?from=playlist`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ff2d55] text-white text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(255,45,85,0.35)]"
                >
                  <Play className="w-4 h-4 fill-current" />
                  播放歌单
                </Link>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white/45 text-sm font-bold cursor-not-allowed"
                >
                  <Play className="w-4 h-4 fill-current" />
                  播放歌单
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="px-4 md:px-6">
          <div className="h-px w-full bg-white/5" />
        </section>

        <section className="px-4 md:px-6 pt-5 pb-20">
          <div className="max-w-5xl">
        {loading ? (
          <div className="text-center py-12 text-white/35">加载中...</div>
        ) : !user ? (
          <div className="border border-dashed border-white/15 p-8 text-center">
            <p className="text-white/50 mb-4">登录后可查看你的歌单</p>
            <Link
              href={`/auth/login?next=${encodeURIComponent("/playlist")}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#ff2d55] text-white text-sm font-bold"
            >
              登录
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="border border-dashed border-white/15 p-8 text-center text-white/45">
            还没有收藏歌曲，去播放页点红心添加吧
          </div>
        ) : (
          <div className="border border-white/10 overflow-hidden bg-black/40">
            <div className="grid grid-cols-[32px_1fr_208px] md:grid-cols-[40px_1fr_220px] px-3 md:px-4 py-3 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/25 border-b border-white/10">
              <span>#</span>
              <span>歌曲</span>
              <span className="text-right pr-1 md:pr-2">操作</span>
            </div>
            <div className="divide-y divide-white/5">
              {items.map((item, index) => (
                <div
                  key={`${item.songId}-${item.position}`}
                  className="group grid grid-cols-[32px_1fr_208px] md:grid-cols-[40px_1fr_220px] items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 hover:bg-white/5 transition-colors"
                >
                  <span className="text-xs md:text-sm text-white/30 font-bold">{index + 1}</span>
                  <Link
                    href={`/player/${encodeURIComponent(item.albumName)}/${encodeURIComponent(item.songTitle)}?from=playlist`}
                    className="min-w-0"
                  >
                    <div className="font-bold text-white/90 text-sm md:text-[15px] leading-tight truncate group-hover:text-white transition-colors">
                      {item.songTitle}
                    </div>
                    <div className="text-[11px] md:text-xs text-white/35 truncate">{item.albumName}</div>
                  </Link>
                  <div className="flex justify-end items-center">
                    <div className="flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveSong(index, -1)}
                          disabled={index === 0 || movingSongId !== null}
                          className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-white/15 text-white/40 hover:text-white hover:border-white/35 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                          title="上移"
                          aria-label={`上移 ${item.songTitle}`}
                        >
                          <ChevronUp className="w-4 h-4 md:w-4.5 md:h-4.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSong(index, 1)}
                          disabled={index === items.length - 1 || movingSongId !== null}
                          className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-white/15 text-white/40 hover:text-white hover:border-white/35 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                          title="下移"
                          aria-label={`下移 ${item.songTitle}`}
                        >
                          <ChevronDown className="w-4 h-4 md:w-4.5 md:h-4.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/player/${encodeURIComponent(item.albumName)}/${encodeURIComponent(item.songTitle)}?from=playlist`}
                          className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-[#ff2d55]/20 text-[#ff2d55] hover:bg-[#ff2d55]/30 hover:text-white flex items-center justify-center transition-colors"
                          title="播放"
                          aria-label={`播放 ${item.songTitle}`}
                        >
                          <Play className="w-[18px] h-[18px] md:w-5 md:h-5 fill-current ml-[1px]" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeSong(item.songId)}
                          disabled={removingSongId === item.songId || movingSongId !== null}
                          className="w-10 h-10 md:w-11 md:h-11 rounded-full border border-white/15 text-white/40 hover:text-white hover:border-white/35 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                          title="删除"
                          aria-label={`删除 ${item.songTitle}`}
                        >
                          <Trash2 className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
          </div>
        </section>
      </main>
    </div>
  );
}
