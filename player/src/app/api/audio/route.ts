import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

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
    const file = await fs.readFile(audioPath);
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'audio/flac',
        'Content-Length': file.length.toString(),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
  }
}
