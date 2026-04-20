#!/bin/bash
# test-deploy.sh — Merge master → test and push
# Usage: ./infra/test-deploy.sh
#
# Flow: master (dev) → test (intermediate testing)
# Run this when you want to test your latest work before going to production.

set -euo pipefail
source "$(dirname "$0")/config.sh"

check_git_repo

# Always return to master, even on error or Ctrl+C
trap 'git checkout "$BRANCH_DEV" 2>/dev/null' EXIT

# Auto-save uncommitted changes before deploy
if [ -n "$(git status --porcelain)" ]; then
  log "Uncommitted changes detected. Saving before deploy..."
  auto_commit_and_push "wip: auto-save before test deploy [$(date '+%Y-%m-%d %H:%M')]"
  log ""
fi

log "============================================"
log "  Deploying $BRANCH_DEV → $BRANCH_TEST"
log "============================================"
log ""

# Pull latest dev first
log "Pulling latest $BRANCH_DEV..."
git checkout "$BRANCH_DEV"
git pull "$REMOTE" "$BRANCH_DEV" 2>/dev/null || log "WARN: Could not pull $BRANCH_DEV (may not exist on remote yet)"

# Merge dev → test
safe_merge "$BRANCH_DEV" "$BRANCH_TEST"

# Return to dev branch
log "Switching back to $BRANCH_DEV..."
git checkout "$BRANCH_DEV"

log ""
log "============================================"
log "  Test deploy complete!"
log "  $BRANCH_TEST is now up to date with $BRANCH_DEV."
log "============================================"
