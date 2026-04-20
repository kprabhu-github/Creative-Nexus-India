#!/bin/bash
# zip-for-hostinger.sh — Create a clean zip of the project for Hostinger upload
# Usage: ./infra/git/zip-for-hostinger.sh

set -euo pipefail
source "$(dirname "$0")/config.sh"

check_git_repo

# Go to project root (2 levels up from infra/git/)
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
OUTPUT_DIR="$PROJECT_ROOT/infra/builds"
ZIP_NAME="${REPO_NAME}_${TIMESTAMP}.zip"
ZIP_PATH="$OUTPUT_DIR/$ZIP_NAME"

mkdir -p "$OUTPUT_DIR"

log "============================================"
log "  Creating zip for Hostinger upload"
log "============================================"
log "Project:  $PROJECT_ROOT"
log "Output:   $ZIP_PATH"
log ""

cd "$PROJECT_ROOT"

# Exclusions — things that shouldn't go to Hostinger
EXCLUDES=(
  "*.git*"           # git metadata
  "node_modules/*"   # deps (reinstalled on server)
  ".next/*"          # Next.js build cache
  "out/*"            # Next.js export
  "build/*"          # production build artifacts
  "dist/*"           # dist artifacts
  "coverage/*"       # test coverage
  ".DS_Store"        # macOS junk
  "*.log"            # log files
  "**/logs/*"        # log directories
  ".env*"            # env secrets
  ".vercel/*"        # vercel metadata
  "*.tsbuildinfo"    # typescript cache
  "infra/builds/*"   # prior zips
  ".vscode/*"        # editor config
  ".idea/*"          # editor config
  ".claude/*"        # claude internals
  "_claude_skills_temp/*"
)

# Build exclude args for zip
EXCLUDE_ARGS=()
for pattern in "${EXCLUDES[@]}"; do
  EXCLUDE_ARGS+=(-x "$pattern")
done

log "Zipping project (this may take a moment)..."
zip -r "$ZIP_PATH" . "${EXCLUDE_ARGS[@]}" > /dev/null || die "Zip failed."

SIZE=$(du -h "$ZIP_PATH" | cut -f1)

log ""
log "============================================"
log "  Zip created: $ZIP_NAME"
log "  Size:        $SIZE"
log "  Location:    $ZIP_PATH"
log "============================================"
log ""
log "Upload this file via Hostinger File Manager, then extract."
