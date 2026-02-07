import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { resolveAlbumFilePath } from '@/lib/albums';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const album = searchParams.get('album');
  const song = searchParams.get('song');

  if (!album || !song) {
    return NextResponse.json({ error: 'Missing album or song' }, { status: 400 });
  }

  const lrcPath = resolveAlbumFilePath(album, `${song}.lrc`);
  if (!lrcPath) {
    return NextResponse.json({ error: 'Invalid album or song' }, { status: 400 });
  }

  try {
    const content = await fs.readFile(lrcPath, 'utf-8');
    return NextResponse.json({ lyrics: content });
  } catch {
    return NextResponse.json({ error: 'Lyrics not found' }, { status: 404 });
  }
}
