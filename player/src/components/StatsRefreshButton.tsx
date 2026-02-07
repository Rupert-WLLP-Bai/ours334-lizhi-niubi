"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function StatsRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
      className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full border border-white/15 hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      disabled={isPending}
    >
      <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "刷新中..." : "刷新数据"}
    </button>
  );
}
