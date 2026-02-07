import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { resolveAlbumFilePath } from '@/lib/albums';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const album = searchParams.get('album');
  const song = searchParams.get('song');

  if (!album || !song) {
    return NextResponse.json({ error: 'Missing album or song' }, { status: 400 });
  }

  const audioPath = resolveAlbumFilePath(album, `${song}.flac`);
  if (!audioPath) {
    return NextResponse.json({ error: 'Invalid album or song' }, { status: 400 });
  }

  try {
    const stats = await stat(audioPath);
    const fileSize = stats.size;
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
          'Content-Type': 'audio/flac',
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
          'Content-Type': 'audio/flac',
          'Accept-Ranges': 'bytes',
        },
      });
    }
  } catch (error) {
    console.error('Audio stream error:', error);
    return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
  }
}
