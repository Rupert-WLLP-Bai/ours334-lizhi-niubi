import "./globals.css";
import { PlayerProvider } from "./player/PlayerContext";
import { GlobalPlayer } from "@/components/GlobalPlayer";

export const metadata = {
  title: "LIZHI MUSIC",
  description: "Modern Music Player",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black overflow-x-hidden">
        <PlayerProvider>
          <GlobalPlayer>
            {children}
          </GlobalPlayer>
        </PlayerProvider>
      </body>
    </html>
  );
}
