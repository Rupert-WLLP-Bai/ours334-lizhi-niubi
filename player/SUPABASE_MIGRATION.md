# Supabase Migration Guide

## 1) Required environment variables

Add these in `player/.env`:

```env
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_SCHEMA=public
SUPABASE_PRIMARY=true
SUPABASE_SYNC_DISABLED=false
```

Notes:
- Use `service_role` key, not `publishable`/`anon`.
- Keep this key server-side only.

## 2) Initialize schema

Open Supabase SQL Editor and execute:

`scripts/sql/supabase-init.sql`

This creates:
- `users`
- `auth_sessions`
- `favorite_songs`
- `playlist_items`
- `playback_logs`

## 3) One-time backfill from sqlite

Run in `player/`:

```bash
npm run migrate:sqlite:supabase
```

Optional:

```bash
npm run migrate:sqlite:supabase -- --dry-run
npm run migrate:sqlite:supabase -- --batch-size 1000
npm run migrate:sqlite:supabase -- --from-created-at 2026-02-08T00:00:00.000Z
```

## 4) Verify sync counts

```bash
npm run verify:sqlite:supabase
```

`OK` means Supabase row count is at least local sqlite row count for that table.

## 5) Runtime behavior

After this change (`SUPABASE_PRIMARY=true`):
- Reads use Supabase as source of truth.
- Writes go to Supabase first, with best-effort local sqlite backup.
- Affected tables:
  - `playback_logs`
  - `users`
  - `auth_sessions`
  - `favorite_songs`
  - `playlist_items`
- If Supabase write fails, request fails (local backup is not promoted to primary write).

To force fallback to local sqlite reads/writes:

```env
SUPABASE_PRIMARY=false
```

To temporarily disable cloud sync:

```env
SUPABASE_SYNC_DISABLED=true
```
