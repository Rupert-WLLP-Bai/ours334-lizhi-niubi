## 2026-02-07

### Status
- Cloud mode is implemented but currently not available as a stable default in this environment; use `ASSET_SOURCE=local` for now.

### Added
- Added cloud asset configuration helper: `src/lib/assetSource.ts`
  - Supports `ASSET_SOURCE=local|cloud`
  - Supports `ASSET_BASE_URL` and `ASSET_PREFIX`
  - Builds encoded cloud object URLs for Chinese album/song names
- Added shared album catalog/index library: `src/lib/albumCatalog.ts`
  - Scans local albums directory (`flac`, `m4a`, `lrc`, `cover.jpg`, `info.json`)
  - Generates normalized song/album metadata for API use
  - Supports loading cached index from `src/data/albums-index.json`
- Added index build script: `scripts/build-album-index.mjs`
  - Scans `../lizhi-lyrics/albums`
  - Outputs `src/data/albums-index.json`
- Added S3 upload script: `scripts/upload-albums-s3.sh`
  - Uploads album assets to S3-compatible bucket
  - Sets content type and cache-control by file type
  - Uses incremental `aws s3 sync` (new/changed files only)
  - Defaults to **no delete** for remote objects
  - Supports optional `SYNC_DELETE=true` and `DRY_RUN=true`
- Added env example: `.env.example`
- Added tests:
  - `src/lib/assetSource.test.ts`
  - `src/lib/albumCatalog.test.ts`
- Added generated album index data:
  - `src/data/albums-index.json` (10 albums, 104 songs)

### Changed
- Updated `src/app/api/songs/route.ts`
  - `local` mode: scans filesystem
  - `cloud` mode: reads `src/data/albums-index.json`
  - Response shape remains compatible with existing frontend
- Updated `src/app/api/audio/route.ts`
  - `local` mode: keeps local streaming + range requests
  - `cloud` mode: resolves song from catalog index and returns `307` redirect to bucket/CDN URL
- Updated `src/app/api/lyrics/route.ts`
  - `local` mode: keeps local `.lrc` reading
  - `cloud` mode: fetches `.lrc` from bucket/CDN and returns `{ lyrics }`
- Updated `src/app/api/covers/route.ts`
  - `local` mode: keeps local image read
  - `cloud` mode: resolves album from index and returns `307` redirect to `cover.jpg`
- Updated `package.json` scripts
  - Added `build:album-index`
  - Added `upload:albums:s3`

### Verified
- `npm run build:album-index`
- `npm run test:run` (16 tests passed)
- `npm run lint`
- `npm run build`

### 2026-02-07 (mp3 + Cover.jpg compatibility)

### Changed
- Updated `src/lib/albumCatalog.ts`
  - Added `.mp3` into supported audio extensions for catalog scan
  - Added case-insensitive cover detection and persisted `coverFileName`
- Updated `src/app/api/audio/route.ts`
  - Added `.mp3` lookup in local mode
  - Added `audio/mpeg` content type for mp3 responses
- Updated `src/app/api/covers/route.ts`
  - Local mode now supports both `cover.jpg` and `Cover.jpg`
  - Cloud mode now uses `coverFileName` from index to avoid case mismatch
- Updated `scripts/build-album-index.mjs`
  - Added `.mp3` scan support
  - Added `coverFileName` output in `src/data/albums-index.json`
- Updated `scripts/upload-albums-s3.sh`
  - Added upload sync for `*.mp3`
  - Added upload sync for both `cover.jpg` and `Cover.jpg`
- Updated `src/lib/music.ts`
  - Added `.mp3` compatibility in legacy local scanner
- Regenerated `src/data/albums-index.json`
  - Current result: 14 albums, 166 songs

### Verified
- `npm run test:run` (16 tests passed)
- `npm run build` (pass)
