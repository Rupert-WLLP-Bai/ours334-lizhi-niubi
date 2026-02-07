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
  const lrcPath = path.join(albumsDir, album, `${song}.lrc`);

  try {
    const content = await fs.readFile(lrcPath, 'utf-8');
    return NextResponse.json({ lyrics: content });
  } catch {
    return NextResponse.json({ error: 'Lyrics not found' }, { status: 404 });
  }
}
