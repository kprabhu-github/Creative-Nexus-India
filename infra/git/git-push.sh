#!/bin/bash
# git-push.sh — Stage, commit, and push changes to the dev branch (master)
# Usage: ./infra/git-push.sh "commit message"

set -euo pipefail
source "$(dirname "$0")/config.sh"

check_git_repo

# Ensure we're on the dev branch
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "$BRANCH_DEV" ]; then
  die "You are on '$CURRENT', not '$BRANCH_DEV'. Switch first: git checkout $BRANCH_DEV"
fi

# Get commit message — from argument or prompt
if [ -n "${1:-}" ]; then
  MESSAGE="$1"
else
  read -r -p "Commit message: " MESSAGE
  if [ -z "$MESSAGE" ]; then
    die "Commit message cannot be empty."
  fi
fi

log "Staging all changes..."
git add -A

# Check if there's anything to commit
if git diff --cached --quiet; then
  log "Nothing to commit. Working tree is clean."
  exit 0
fi

log "Committing: $MESSAGE"
git commit -m "$MESSAGE"

log "Pushing to $REMOTE/$BRANCH_DEV..."
git push "$REMOTE" "$BRANCH_DEV" || die "Push failed. Try: git pull $REMOTE $BRANCH_DEV --rebase"

log "Done. Changes pushed to $REMOTE/$BRANCH_DEV."
