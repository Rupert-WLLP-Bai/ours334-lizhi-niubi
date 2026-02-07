import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs, createReadStream, statSync } from 'fs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const album = searchParams.get('album');
  const song = searchParams.get('song');

  if (!album || !song) {
    return NextResponse.json({ error: 'Missing album or song' }, { status: 400 });
  }

  const albumsDir = path.join(process.cwd(), '..', 'lizhi-lyrics', 'albums');
  const audioPath = path.join(albumsDir, album, `${song}.flac`);

  try {
    const stats = statSync(audioPath);
    const fileSize = stats.size;
    const range = request.headers.get('range');

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

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