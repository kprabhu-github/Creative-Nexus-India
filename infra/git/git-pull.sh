#!/bin/bash
# git-pull.sh — Pull latest changes from remote
# Usage: ./infra/git-pull.sh [branch]
#   If no branch specified, pulls the dev branch (master)

set -euo pipefail
source "$(dirname "$0")/config.sh"

check_git_repo

BRANCH="${1:-$BRANCH_DEV}"

# ── Safety check: detect any local changes that could be lost ──
UNSTAGED=$(git diff --name-only 2>/dev/null)
STAGED=$(git diff --cached --name-only 2>/dev/null)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null)

HAS_CHANGES=false

if [ -n "$STAGED" ]; then
  HAS_CHANGES=true
  log "WARNING: You have STAGED changes that are not committed:"
  echo "$STAGED" | while read -r f; do log "  (staged)    $f"; done
fi

if [ -n "$UNSTAGED" ]; then
  HAS_CHANGES=true
  log "WARNING: You have UNSTAGED changes (modified files):"
  echo "$UNSTAGED" | while read -r f; do log "  (modified)  $f"; done
fi

if [ -n "$UNTRACKED" ]; then
  HAS_CHANGES=true
  log "WARNING: You have UNTRACKED files (new files not yet added):"
  echo "$UNTRACKED" | while read -r f; do log "  (untracked) $f"; done
fi

if [ "$HAS_CHANGES" = true ]; then
  log ""
  log "Local changes detected. These must be saved before pulling."
  log ""
  log "Options:"
  log "  1. Auto-save — commit & push all changes now, then pull  (recommended)"
  log "  2. Abort    — exit so you can handle changes manually"
  log ""
  read -r -p "Auto-save and continue? (Y/n): " choice
  if [[ "$choice" =~ ^[Nn]$ ]]; then
    log "Pull aborted by user. Save your changes manually, then re-run."
    exit 0
  fi

  log ""
  auto_commit_and_push "wip: auto-save before pull [$(date '+%Y-%m-%d %H:%M')]"
  log ""
fi

# ── Safe to pull ──────────────────────────────────────
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "$BRANCH" ]; then
  log "Switching to $BRANCH..."
  git checkout "$BRANCH" || die "Failed to checkout $BRANCH"
fi

log "Pulling latest from $REMOTE/$BRANCH..."
git pull "$REMOTE" "$BRANCH" || die "Pull failed. Check network or try: git pull $REMOTE $BRANCH --rebase"

log "Done. Up to date with $REMOTE/$BRANCH."
