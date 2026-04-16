#!/bin/bash
# config.sh — Shared variables for all infra scripts
# Source this file: source "$(dirname "$0")/config.sh"

# ── Repository ────────────────────────────────────────
REPO_NAME="CreativeNexus2.0"
REPO_DESC="Creative Nexus Agency Command Centre — AI-native agency operating system"
REPO_VISIBILITY="--private"   # --private or --public
REMOTE="origin"

# ── Branches ──────────────────────────────────────────
BRANCH_DEV="master"           # daily feature development
BRANCH_TEST="test"            # intermediate testing
BRANCH_PROD="prod"            # production (Hostinger pulls from here)

# ── Logging ───────────────────────────────────────────
LOG_DIR="$(cd "$(dirname "$0")" && pwd)/logs"
LOG_FILE="$LOG_DIR/git-operations.log"

# ── Helpers ───────────────────────────────────────────

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Log a message to both console and log file
log() {
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  local message="[$timestamp] $1"
  echo "$message"
  echo "$message" >> "$LOG_FILE"
}

# Log an error and exit
die() {
  log "ERROR: $1"
  exit 1
}

# Check if working directory is clean
check_clean() {
  if [ -n "$(git status --porcelain)" ]; then
    die "Working directory has uncommitted changes. Commit or stash first."
  fi
}

# Ensure we're in a git repository
check_git_repo() {
  if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    die "Not inside a git repository."
  fi
}

# Safely merge source into target, handle conflicts gracefully
safe_merge() {
  local source="$1"
  local target="$2"

  log "Switching to $target..."
  git checkout "$target" || die "Failed to checkout $target"

  log "Pulling latest $target from $REMOTE..."
  git pull "$REMOTE" "$target" 2>/dev/null || log "WARN: Could not pull $target (may not exist on remote yet)"

  log "Merging $source into $target..."
  if ! git merge "$source" -m "deploy: merge $source → $target [$(date '+%Y-%m-%d %H:%M')]"; then
    log "MERGE CONFLICT detected while merging $source into $target."
    log "Aborting merge to keep $target in a clean state."
    git merge --abort
    git checkout "$BRANCH_DEV"
    log ""
    log "── What to do ──────────────────────────────────────"
    log "1. Switch to $target:    git checkout $target"
    log "2. Start the merge:      git merge $source"
    log "3. Resolve conflicts in your editor"
    log "4. Commit:               git add . && git commit"
    log "5. Push:                 git push $REMOTE $target"
    log "6. Switch back:          git checkout $BRANCH_DEV"
    log "────────────────────────────────────────────────────"
    die "Deploy aborted due to merge conflicts. Resolve manually (see above)."
  fi

  log "Pushing $target to $REMOTE..."
  git push "$REMOTE" "$target" || die "Failed to push $target to $REMOTE"

  log "Successfully deployed $source → $target."
}

# Auto stage, commit, and push all local changes
# Usage: auto_commit_and_push "commit message"
auto_commit_and_push() {
  local msg="${1:-wip: auto-save before operation [$(date '+%Y-%m-%d %H:%M')]}"

  log "Staging all changes..."
  git add -A

  if git diff --cached --quiet; then
    log "Nothing to commit. Working tree is clean."
    return 0
  fi

  log "Committing: $msg"
  git commit -m "$msg"

  log "Pushing to $REMOTE/$BRANCH_DEV..."
  if ! git push "$REMOTE" "$BRANCH_DEV" 2>/dev/null; then
    log "WARN: Push failed (remote may not exist yet). Commit saved locally."
    return 0
  fi

  log "Changes committed and pushed."
}
