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

## 2026-02-08

### Added
- Added Supabase migration and sync tooling:
  - `scripts/sql/supabase-init.sql` (Postgres schema for logs + user library tables)
  - `scripts/migrate-sqlite-to-supabase.mjs` (SQLite -> Supabase backfill)
  - `scripts/verify-sqlite-supabase-sync.mjs` (row count verification)
  - `SUPABASE_MIGRATION.md` (usage guide)
- Added npm scripts:
  - `migrate:sqlite:supabase`
  - `verify:sqlite:supabase`
- Added Supabase env examples in `.env.example`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_SCHEMA`
  - `SUPABASE_SYNC_DISABLED`

### Changed
- Updated `src/lib/playbackLogs.js`
  - Playback log insert now includes explicit `created_at`
  - Added background dual-write sync to Supabase `playback_logs`
- Updated `src/lib/userLibraryStore.js`
  - Added background dual-write sync for:
    - `users`
    - `auth_sessions`
    - `favorite_songs`
    - `playlist_items`
  - Local SQLite remains primary source of truth for reads
- Added `src/lib/supabaseSync.js`
  - Centralized Supabase REST sync helper with safe async error handling

### 2026-02-08 (Supabase primary mode)

### Added
- Added Supabase primary store modules:
  - `src/lib/userLibraryStoreSupabase.js`
  - `src/lib/playbackLogsSupabase.js`
- Added Supabase primary env flag:
  - `SUPABASE_PRIMARY=true` in `.env.example`

### Changed
- Updated auth/library/playback API routes to read/write via Supabase primary stores:
  - `src/app/api/auth/*.ts`
  - `src/app/api/admin/users/route.ts`
  - `src/app/api/library/**/*.ts`
  - `src/app/api/playback/*.ts`
- Updated `src/lib/auth.ts` session/user helpers to async Supabase-backed flows
- Updated `src/app/stats/page.tsx` to read stats through Supabase path
- Updated `src/lib/supabaseSync.js`
  - Added primary mode detection
  - Added generic Supabase GET/insert/pagination helpers
  - Disabled background sync queue when primary mode is enabled (avoids duplicate writes)

### Behavior
- Supabase is now primary source for reads and writes when configured.
- Local sqlite is retained as best-effort backup.

### Added
- Added lightweight auth pages and APIs:
  - `src/app/auth/login/page.tsx` (public login page, no public register)
  - `src/app/api/auth/login/route.ts`
  - `src/app/api/auth/logout/route.ts`
  - `src/app/api/auth/me/route.ts`
- Added admin-only user creation API:
  - `src/app/api/admin/users/route.ts`
- Added user library APIs:
  - `src/app/api/library/favorites/route.ts`
  - `src/app/api/library/playlist/route.ts`
  - `src/app/api/library/playlist/items/route.ts`
  - `src/app/api/library/playlist/items/reorder/route.ts`
- Added auth/library data stores:
  - `src/lib/auth.ts`
  - `src/lib/userLibraryStore.js`
- Added migration script:
  - `scripts/migrate-logs-to-user.mjs`
  - Added npm script `migrate:logs:user`

### Changed
- Updated `src/lib/playbackLogs.js`
  - Added `user_id` support and user-scoped stats filtering
- Updated `src/app/api/playback/log/route.ts`
  - Unauthenticated playback logs now return `204` (not persisted)
  - Authenticated playback logs are persisted with `user_id`
- Updated `src/app/api/playback/stats/route.ts`
  - Supports user-scoped stats using auth cookie
- Updated `src/components/GlobalPlayer.tsx`
  - Added auth-aware favorites and "later queue" controls
  - Playlist panel now reads/writes user playlist data
- Updated `src/app/player/[album]/page.tsx`
  - Added "稍后播" action per song row (auth-aware)
- Updated `src/app/page.tsx`
  - Added login/logout entry in top header
  - Removed album cover direct-play trigger to avoid mobile mis-taps
- Updated mobile UI density:
  - `src/app/player/[album]/page.tsx` (smaller hero on narrow screens)
  - `src/components/Lyrics.tsx` and `src/components/Lyrics.module.css` (smaller mobile lyrics and tighter spacing)

### Data Migration
- Ran log ownership migration:
  - Target user: `1762161822@qq.com` (role: `admin`)
  - Migrated all existing logs to that user
  - Remaining `NULL user_id`: `0`

### Verified
- `npm run test:run` (16 tests passed)
- `npm run build` (pass)
