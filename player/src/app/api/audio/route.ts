import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { resolveAlbumFilePath } from "@/lib/albums";
import { findSongInCatalog, loadAlbumCatalogIndex } from "@/lib/albumCatalog";
import { buildCloudAssetUrl, isCloudAssetSource } from "@/lib/assetSource";

const SUPPORTED_AUDIO_EXTENSIONS = [".flac", ".m4a"] as const;

type ResolvedAudioFile =
  | { audioPath: string; fileSize: number; contentType: string }
  | null
  | "invalid";

function getAudioContentType(extension: (typeof SUPPORTED_AUDIO_EXTENSIONS)[number]): string {
  if (extension === ".m4a") return "audio/mp4";
  return "audio/flac";
}

async function resolveAudioFile(album: string, song: string): Promise<ResolvedAudioFile> {
  const candidates = SUPPORTED_AUDIO_EXTENSIONS.map(ext => ({
    ext,
    path: resolveAlbumFilePath(album, `${song}${ext}`),
  }));

  const validCandidates = candidates.filter(
    (candidate): candidate is { ext: (typeof SUPPORTED_AUDIO_EXTENSIONS)[number]; path: string } =>
      candidate.path !== null
  );

  if (validCandidates.length !== candidates.length) {
    return "invalid";
  }

  for (const candidate of validCandidates) {
    try {
      const stats = await stat(candidate.path);
      if (stats.isFile()) {
        return {
          audioPath: candidate.path,
          fileSize: stats.size,
          contentType: getAudioContentType(candidate.ext),
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function resolveCloudAudioRedirect(album: string, song: string): Promise<string | null> {
  const index = await loadAlbumCatalogIndex();
  const songRecord = findSongInCatalog(index, album, song);
  if (!songRecord) return null;
  const url = buildCloudAssetUrl(album, songRecord.audioFileName);
  if (!url) {
    throw new Error("ASSET_BASE_URL is missing for cloud audio mode");
  }
  return url;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const album = searchParams.get('album');
  const song = searchParams.get('song');

  if (!album || !song) {
    return NextResponse.json({ error: 'Missing album or song' }, { status: 400 });
  }

  if (isCloudAssetSource()) {
    try {
      const redirectUrl = await resolveCloudAudioRedirect(album, song);
      if (!redirectUrl) {
        return NextResponse.json({ error: "Audio not found" }, { status: 404 });
      }
      return NextResponse.redirect(redirectUrl, 307);
    } catch (error) {
      console.error("Cloud audio redirect error:", error);
      return NextResponse.json({ error: "Cloud audio unavailable" }, { status: 500 });
    }
  }

  const resolvedAudio = await resolveAudioFile(album, song);
  if (resolvedAudio === "invalid") {
    return NextResponse.json({ error: 'Invalid album or song' }, { status: 400 });
  }
  if (!resolvedAudio) {
    return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
  }

  try {
    const { audioPath, fileSize, contentType } = resolvedAudio;
    const range = request.headers.get('range');

    if (range) {
      const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!rangeMatch) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      let start: number;
      let end: number;

      if (!rangeMatch[1] && !rangeMatch[2]) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      if (!rangeMatch[1]) {
        const suffixLength = parseInt(rangeMatch[2], 10);
        if (Number.isNaN(suffixLength) || suffixLength <= 0) {
          return new NextResponse(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` },
          });
        }
        start = Math.max(fileSize - suffixLength, 0);
        end = fileSize - 1;
      } else {
        start = parseInt(rangeMatch[1], 10);
        end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

        if (
          Number.isNaN(start) ||
          Number.isNaN(end) ||
          start < 0 ||
          start >= fileSize ||
          end < start
        ) {
          return new NextResponse(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` },
          });
        }

        end = Math.min(end, fileSize - 1);
      }

      const chunksize = end - start + 1;

      // Create a Node.js readable stream for the range
      const fileStream = createReadStream(audioPath, { start, end });
      
      // Convert Node.js readable stream to Web readable stream
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        }
      });

      return new NextResponse(stream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': contentType,
        },
      });
    } else {
      const fileStream = createReadStream(audioPath);
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        }
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
        },
      });
    }
  } catch (error) {
    console.error('Audio stream error:', error);
    return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
  }
}
