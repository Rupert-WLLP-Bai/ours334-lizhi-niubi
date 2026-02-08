"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type MeResponse = {
  user: {
    id: number;
    email: string;
    role: string;
  } | null;
};

export default function LoginPage() {
  const router = useRouter();
  const [nextUrl, setNextUrl] = useState("/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    setNextUrl(search.get("next") || "/");
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: MeResponse) => {
        if (!active) return;
        if (data.user) {
          router.replace(nextUrl);
          return;
        }
        setBootstrapping(false);
      })
      .catch(() => {
        if (active) setBootstrapping(false);
      });
    return () => {
      active = false;
    };
  }, [nextUrl, router]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || "登录失败，请重试");
        return;
      }
      router.replace(nextUrl);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="text-sm uppercase tracking-[0.2em] text-white/30">Loading</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm border border-white/10 bg-black/50 backdrop-blur-sm p-6 sm:p-8">
        <h1 className="text-2xl font-righteous tracking-tight mb-2">
          登录 <span className="text-[#ff2d55]">LIZHI MUSIC</span>
        </h1>
        <p className="text-sm text-white/40 mb-6">使用邮箱和密码登录，访问收藏与歌单数据。</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.15em] text-white/40">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="mt-2 w-full px-3 py-2.5 bg-black border border-white/20 focus:border-[#ff2d55] outline-none transition-colors text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.15em] text-white/40">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-2 w-full px-3 py-2.5 bg-black border border-white/20 focus:border-[#ff2d55] outline-none transition-colors text-sm"
            />
          </label>

          {error && (
            <p className="text-xs text-[#ff8fa3] border border-[#ff2d55]/30 bg-[#ff2d55]/10 px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-[#ff2d55] text-white font-bold text-sm hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "登录中..." : "登录"}
          </button>
        </form>

        <div className="mt-5 text-xs text-white/35 flex items-center justify-between">
          <span>当前不开放公开注册</span>
          <Link href="/" className="text-white/60 hover:text-white transition-colors">
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
