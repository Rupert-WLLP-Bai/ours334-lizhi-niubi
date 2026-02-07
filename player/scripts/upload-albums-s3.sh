#!/usr/bin/env bash

set -euo pipefail

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found. Install AWS CLI v2 first."
  exit 1
fi

S3_BUCKET="${S3_BUCKET:-}"
S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-}"
S3_REGION="${S3_REGION:-auto}"
ASSET_PREFIX="${ASSET_PREFIX:-albums}"
ALBUMS_SOURCE_DIR="${ALBUMS_SOURCE_DIR:-../lizhi-lyrics/albums}"

# Optional controls
# SYNC_DELETE=true  -> add --delete
# DRY_RUN=true      -> add --dryrun
SYNC_DELETE="${SYNC_DELETE:-false}"
DRY_RUN="${DRY_RUN:-false}"

if [[ -z "$S3_BUCKET" ]]; then
  echo "S3_BUCKET is required."
  exit 1
fi

if [[ ! -d "$ALBUMS_SOURCE_DIR" ]]; then
  echo "ALBUMS_SOURCE_DIR does not exist: $ALBUMS_SOURCE_DIR"
  exit 1
fi

ASSET_PREFIX="${ASSET_PREFIX#/}"
ASSET_PREFIX="${ASSET_PREFIX%/}"
S3_TARGET="s3://${S3_BUCKET}/${ASSET_PREFIX}/"

AWS_ARGS=(--region "$S3_REGION")
if [[ -n "$S3_ENDPOINT_URL" ]]; then
  AWS_ARGS+=(--endpoint-url "$S3_ENDPOINT_URL")
fi

SYNC_EXTRA_ARGS=()
if [[ "$SYNC_DELETE" == "true" ]]; then
  SYNC_EXTRA_ARGS+=(--delete)
fi
if [[ "$DRY_RUN" == "true" ]]; then
  SYNC_EXTRA_ARGS+=(--dryrun)
fi

sync_group() {
  local include_pattern="$1"
  local content_type="$2"
  local cache_control="$3"

  aws "${AWS_ARGS[@]}" s3 sync "$ALBUMS_SOURCE_DIR/" "$S3_TARGET" \
    --only-show-errors \
    --exclude "*" \
    --include "$include_pattern" \
    --content-type "$content_type" \
    --cache-control "$cache_control" \
    "${SYNC_EXTRA_ARGS[@]}"
}

echo "Starting incremental sync to ${S3_TARGET}"
echo "Source: ${ALBUMS_SOURCE_DIR}"
if [[ "$DRY_RUN" == "true" ]]; then
  echo "Mode: dry-run"
fi
if [[ "$SYNC_DELETE" == "true" ]]; then
  echo "Delete: enabled"
else
  echo "Delete: disabled (default)"
fi

# Run by file type so metadata is correct and consistent.
sync_group "*.flac" "audio/flac" "public, max-age=31536000, immutable"
sync_group "*.m4a" "audio/mp4" "public, max-age=31536000, immutable"
sync_group "*.lrc" "text/plain; charset=utf-8" "public, max-age=300"
sync_group "info.json" "application/json; charset=utf-8" "public, max-age=300"
sync_group "cover.jpg" "image/jpeg" "public, max-age=31536000, immutable"

echo "Incremental sync finished."
echo "Target: ${S3_TARGET}"
