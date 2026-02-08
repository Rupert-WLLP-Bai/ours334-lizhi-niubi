"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, ListMusic, Music2, Play } from "lucide-react";

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

      <main className="max-w-5xl mx-auto px-4 md:px-6 pt-8">
        <section className="border border-white/10 bg-white/[0.02] p-5 md:p-7 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#ff2d55]/20 text-[#ff2d55] flex items-center justify-center">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">红心歌单</h1>
              <p className="text-xs text-white/40">点歌曲页红心自动加入</p>
            </div>
          </div>
          <div className="text-sm text-white/50">
            {user ? `当前用户：${user.email}` : "未登录"}
          </div>
        </section>

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
            <div className="grid grid-cols-[36px_1fr_88px] md:grid-cols-[40px_1fr_120px] px-4 py-3 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/25 border-b border-white/10">
              <span>#</span>
              <span>歌曲</span>
              <span className="text-right">播放</span>
            </div>
            <div className="divide-y divide-white/5">
              {items.map((item, index) => (
                <Link
                  key={`${item.songId}-${item.position}`}
                  href={`/player/${encodeURIComponent(item.albumName)}/${encodeURIComponent(item.songTitle)}?from=playlist`}
                  className="grid grid-cols-[36px_1fr_88px] md:grid-cols-[40px_1fr_120px] items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm text-white/30 font-bold">{index + 1}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-white/90 leading-snug break-words">{item.songTitle}</div>
                    <div className="text-xs text-white/35 truncate">{item.albumName}</div>
                  </div>
                  <div className="flex justify-end items-center gap-2 text-white/40">
                    <ListMusic className="w-4 h-4" />
                    <Play className="w-4 h-4 fill-current text-[#ff2d55]" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
