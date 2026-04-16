#!/bin/bash
# prod-deploy.sh — Merge test → prod and push
# Usage: ./infra/prod-deploy.sh
#
# Flow: test (verified) → prod (Hostinger production)
# Only run this AFTER test-deploy.sh and verifying everything works on test.
# This ensures production only receives code that passed testing.

set -euo pipefail
source "$(dirname "$0")/config.sh"

check_git_repo

# Auto-save uncommitted changes before deploy
if [ -n "$(git status --porcelain)" ]; then
  log "Uncommitted changes detected. Saving before deploy..."
  auto_commit_and_push "wip: auto-save before prod deploy [$(date '+%Y-%m-%d %H:%M')]"
  log ""
fi

log "============================================"
log "  Deploying $BRANCH_TEST → $BRANCH_PROD"
log "============================================"
log ""

# Safety confirmation
echo "You are about to deploy to PRODUCTION."
echo "This merges '$BRANCH_TEST' → '$BRANCH_PROD'."
echo ""
read -r -p "Continue? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  log "Production deploy cancelled by user."
  exit 0
fi

log ""

# Pull latest test first
log "Pulling latest $BRANCH_TEST..."
git checkout "$BRANCH_TEST"
git pull "$REMOTE" "$BRANCH_TEST" 2>/dev/null || log "WARN: Could not pull $BRANCH_TEST"

# Merge test → prod
safe_merge "$BRANCH_TEST" "$BRANCH_PROD"

# Return to dev branch
log "Switching back to $BRANCH_DEV..."
git checkout "$BRANCH_DEV"

log ""
log "============================================"
log "  Production deploy complete!"
log "  $BRANCH_PROD is now up to date with $BRANCH_TEST."
log "  Hostinger can pull from '$BRANCH_PROD'."
log "============================================"
