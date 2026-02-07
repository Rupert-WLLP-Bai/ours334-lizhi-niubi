import Link from "next/link";
import { ArrowLeft, Clock3, ListMusic, PlayCircle } from "lucide-react";
import { StatsRefreshButton } from "@/components/StatsRefreshButton";
import { getPlaybackLogDbPath, getPlaybackStats } from "@/lib/playbackLogs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;

  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", { hour12: false });
}

export default function StatsPage() {
  const { summary, albums, songs, thresholdSeconds } = getPlaybackStats();
  const dbPath = getPlaybackLogDbPath();

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32">
      {/* Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-gradient-to-b from-[#ff2d55]/10 to-transparent pointer-events-none -z-10 blur-3xl opacity-50" />

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        <header className="flex flex-wrap items-end justify-between gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-4xl font-righteous tracking-tight mb-4">播放数据统计 <span className="text-xs font-poppins font-normal text-white/30 ml-4 tracking-widest uppercase">Analytics</span></h1>
            <p className="text-sm text-white/40 max-w-xl">
              统计口径：单次播放 ≥ <span className="text-white font-bold">{thresholdSeconds}s</span> 记为 1 次；时长按会话累计。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatsRefreshButton />
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-full border border-white/10 hover:bg-white/5 transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              返回首页
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="border border-white/10 bg-white/[0.02] p-8 shadow-xl hover:border-[#ff2d55]/30 transition-all group">
            <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase tracking-widest font-bold mb-4 group-hover:text-white/60 transition-colors">
              <Clock3 className="w-4 h-4" />
              总播放时长
            </div>
            <div className="text-3xl font-bold font-righteous">{formatDuration(summary.totalPlayedSeconds)}</div>
          </div>
          <div className="border border-white/10 bg-white/[0.02] p-8 shadow-xl hover:border-[#ff2d55]/30 transition-all group">
            <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase tracking-widest font-bold mb-4 group-hover:text-white/60 transition-colors">
              <PlayCircle className="w-4 h-4" />
              有效播放次数
            </div>
            <div className="text-3xl font-bold font-righteous">{summary.playCount}</div>
          </div>
          <div className="border border-white/10 bg-white/[0.02] p-8 shadow-xl hover:border-[#ff2d55]/30 transition-all group">
            <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase tracking-widest font-bold mb-4 group-hover:text-white/60 transition-colors">
              <ListMusic className="w-4 h-4" />
              记录歌曲数
            </div>
            <div className="text-3xl font-bold font-righteous">{summary.songCount}</div>
          </div>
          <div className="border border-white/10 bg-white/[0.02] p-8 shadow-xl hover:border-[#ff2d55]/30 transition-all group">
            <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase tracking-widest font-bold mb-4 group-hover:text-white/60 transition-colors">
              <ListMusic className="w-4 h-4" />
              记录专辑数
            </div>
            <div className="text-3xl font-bold font-righteous">{summary.albumCount}</div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-12">
          <section className="border border-white/10 overflow-hidden bg-black/40 shadow-2xl backdrop-blur-sm">
            <div className="px-8 py-6 text-lg font-bold text-white/90 border-b border-white/5 flex items-center justify-between">
              <span>专辑播放排行</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/20">Top Albums</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-white/30 text-[10px] uppercase tracking-widest">
                    <th className="text-left px-8 py-4 font-bold">专辑</th>
                    <th className="text-right px-8 py-4 font-bold">播放时长</th>
                    <th className="text-right px-8 py-4 font-bold">有效次数</th>
                    <th className="text-right px-8 py-4 font-bold">歌曲数</th>
                    <th className="text-right px-8 py-4 font-bold">最近播放</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {albums.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-white/20 italic">
                        暂无专辑统计数据
                      </td>
                    </tr>
                  ) : (
                    albums.map((album) => (
                      <tr key={album.albumName} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-8 py-5 font-bold text-white/80 group-hover:text-white">{album.albumName}</td>
                        <td className="px-8 py-5 text-right tabular-nums text-white/60">{formatDuration(album.totalPlayedSeconds)}</td>
                        <td className="px-8 py-5 text-right tabular-nums text-white/60">{album.playCount}</td>
                        <td className="px-8 py-5 text-right tabular-nums text-white/60">{album.songCount}</td>
                        <td className="px-8 py-5 text-right text-white/20 tabular-nums text-xs">{formatDateTime(album.lastPlayedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="border border-white/10 overflow-hidden bg-black/40 shadow-2xl backdrop-blur-sm">
            <div className="px-8 py-6 text-lg font-bold text-white/90 border-b border-white/5 flex items-center justify-between">
              <span>单曲播放明细</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/20">Song Details</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-white/30 text-[10px] uppercase tracking-widest">
                    <th className="text-left px-8 py-4 font-bold">歌曲</th>
                    <th className="text-left px-8 py-4 font-bold">专辑</th>
                    <th className="text-right px-8 py-4 font-bold">时长</th>
                    <th className="text-right px-8 py-4 font-bold">次数</th>
                    <th className="text-right px-8 py-4 font-bold">最近播放</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {songs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-white/20 italic">
                        暂无播放数据
                      </td>
                    </tr>
                  ) : (
                    songs.map((song) => (
                      <tr key={song.songId} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-8 py-5 font-bold text-white/80 group-hover:text-white">{song.songTitle}</td>
                        <td className="px-8 py-5 text-white/40 text-xs">{song.albumName}</td>
                        <td className="px-8 py-5 text-right tabular-nums text-white/60">{formatDuration(song.totalPlayedSeconds)}</td>
                        <td className="px-8 py-5 text-right tabular-nums text-white/60">{song.playCount}</td>
                        <td className="px-8 py-5 text-right text-white/20 tabular-nums text-xs">{formatDateTime(song.lastPlayedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <p className="text-[10px] text-white/10 break-all font-mono">DB: {dbPath}</p>
      </div>
    </div>
  );
}
