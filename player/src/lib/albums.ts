import path from "path";

export const ALBUMS_DIR = path.resolve(
  process.cwd(),
  "..",
  "lizhi-lyrics",
  "albums"
);

function isSafeSegment(segment: string): boolean {
  return (
    segment.length > 0 &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("/") &&
    !segment.includes("\\") &&
    !segment.includes("\0")
  );
}

export function resolveAlbumPath(album: string): string | null {
  if (!isSafeSegment(album)) return null;

  const resolved = path.resolve(ALBUMS_DIR, album);
  if (!resolved.startsWith(`${ALBUMS_DIR}${path.sep}`)) return null;

  return resolved;
}

export function resolveAlbumFilePath(
  album: string,
  fileName: string
): string | null {
  const albumPath = resolveAlbumPath(album);
  if (!albumPath || !isSafeSegment(fileName)) return null;

  const resolved = path.resolve(albumPath, fileName);
  if (!resolved.startsWith(`${albumPath}${path.sep}`)) return null;

  return resolved;
}
