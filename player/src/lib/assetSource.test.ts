import { describe, expect, it } from "vitest";
import {
  buildCloudAssetUrl,
  getAssetBaseUrl,
  getAssetPrefix,
  getAssetSource,
  isCloudAssetSource,
} from "./assetSource";

describe("assetSource", () => {
  it("defaults to local asset source", () => {
    expect(getAssetSource({})).toBe("local");
    expect(isCloudAssetSource({})).toBe(false);
  });

  it("supports cloud source", () => {
    expect(getAssetSource({ ASSET_SOURCE: "cloud" })).toBe("cloud");
    expect(isCloudAssetSource({ ASSET_SOURCE: "cloud" })).toBe(true);
  });

  it("normalizes base URL and prefix", () => {
    expect(getAssetBaseUrl({ ASSET_BASE_URL: "https://cdn.example.com/" })).toBe(
      "https://cdn.example.com"
    );
    expect(getAssetPrefix({ ASSET_PREFIX: "/albums/v1/" })).toBe("albums/v1");
  });

  it("builds encoded cloud asset URLs", () => {
    const url = buildCloudAssetUrl("在每一条伤心的应天大街上", "李志 - 一个夜晚.flac", {
      ASSET_BASE_URL: "https://cdn.example.com/",
      ASSET_PREFIX: "albums",
    });

    expect(url).toBe(
      "https://cdn.example.com/albums/%E5%9C%A8%E6%AF%8F%E4%B8%80%E6%9D%A1%E4%BC%A4%E5%BF%83%E7%9A%84%E5%BA%94%E5%A4%A9%E5%A4%A7%E8%A1%97%E4%B8%8A/%E6%9D%8E%E5%BF%97%20-%20%E4%B8%80%E4%B8%AA%E5%A4%9C%E6%99%9A.flac"
    );
  });
});
