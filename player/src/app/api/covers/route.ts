import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const album = searchParams.get('album');

  if (!album) {
    return NextResponse.json({ error: 'Missing album' }, { status: 400 });
  }

  const albumsDir = path.join(process.cwd(), '..', 'lizhi-lyrics', 'albums');
  const coverPath = path.join(albumsDir, album, 'cover.jpg');

  try {
    const file = await fs.readFile(coverPath);
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Cover not found' }, { status: 404 });
  }
}
