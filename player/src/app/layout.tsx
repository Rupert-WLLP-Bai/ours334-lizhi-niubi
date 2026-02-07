import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "李志音乐播放器",
  description: "模仿 iPhone 原生 Music 样式的李志音乐播放器",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
