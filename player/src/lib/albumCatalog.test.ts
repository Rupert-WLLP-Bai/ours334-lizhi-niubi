import { describe, expect, it } from "vitest";
import {
  findAlbumInCatalog,
  findSongInCatalog,
  normalizeSongOrderKey,
  stripKnownExtension,
  type AlbumCatalogIndex,
} from "./albumCatalog";

const sampleIndex: AlbumCatalogIndex = {
  generatedAt: "2026-02-07T00:00:00.000Z",
  albumCount: 1,
  songCount: 2,
  albums: [
    {
      id: "f",
      name: "F",
      year: "2018-01-01",
      hasCover: true,
      coverFileName: "cover.jpg",
      songs: [
        {
          id: "f-门",
          title: "门",
          album: "F",
          audioBaseName: "李志 - 门",
          audioFileName: "李志 - 门.flac",
          hasLyric: true,
        },
        {
          id: "f-女神",
          title: "女神",
          album: "F",
          audioBaseName: "李志 - 女神",
          audioFileName: "李志 - 女神.flac",
          hasLyric: true,
        },
      ],
    },
  ],
};

describe("albumCatalog helpers", () => {
  it("removes known extensions", () => {
    expect(stripKnownExtension("a.flac")).toBe("a");
    expect(stripKnownExtension("a.m4a")).toBe("a");
    expect(stripKnownExtension("a.mp3")).toBe("a");
    expect(stripKnownExtension("a.lrc")).toBe("a");
  });

  it("normalizes order keys", () => {
    expect(normalizeSongOrderKey("李志 - 门")).toBe("门");
    expect(normalizeSongOrderKey("门")).toBe("门");
  });

  it("finds album and song from index", () => {
    expect(findAlbumInCatalog(sampleIndex, "F")?.name).toBe("F");
    expect(findSongInCatalog(sampleIndex, "F", "李志 - 门")?.title).toBe("门");
    expect(findSongInCatalog(sampleIndex, "F", "不存在")).toBeNull();
  });
});
