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
