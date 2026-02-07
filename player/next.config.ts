import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: "/api/covers",
        search: "?album=*",
      },
    ],
  },
};

export default nextConfig;
