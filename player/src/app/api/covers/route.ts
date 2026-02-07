import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { resolveAlbumFilePath } from '@/lib/albums';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const album = searchParams.get('album');

  if (!album) {
    return NextResponse.json({ error: 'Missing album' }, { status: 400 });
  }

  const coverPath = resolveAlbumFilePath(album, 'cover.jpg');
  if (!coverPath) {
    return NextResponse.json({ error: 'Invalid album' }, { status: 400 });
  }

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
