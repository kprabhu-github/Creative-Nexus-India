#!/bin/bash
# setup-repo.sh — One-time setup: create GitHub repo, set up branches, push.
#
# Prerequisites: gh CLI installed and authenticated (brew install gh && gh auth login)
# Usage: ./infra/setup-repo.sh

set -euo pipefail
source "$(dirname "$0")/config.sh"

echo "============================================"
echo "  CreativeNexus 2.0 — Repository Setup"
echo "============================================"
echo ""

check_git_repo

# ── Step 1: Verify gh CLI ─────────────────────────────
log "Checking GitHub CLI..."
if ! command -v gh &>/dev/null; then
  die "GitHub CLI (gh) is not installed. Run: brew install gh"
fi

if ! gh auth status &>/dev/null 2>&1; then
  die "GitHub CLI is not authenticated. Run: gh auth login"
fi

GH_USER=$(gh api user --jq '.login')
log "Authenticated as: $GH_USER"

# ── Step 2: Create repository ─────────────────────────
log ""
log "Checking if repository $GH_USER/$REPO_NAME exists..."
if gh repo view "$GH_USER/$REPO_NAME" &>/dev/null 2>&1; then
  log "Repository $GH_USER/$REPO_NAME already exists."
  read -r -p "Continue with existing repo? (y/N): " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    log "Setup cancelled by user."
    exit 0
  fi
else
  log "Creating repository: $GH_USER/$REPO_NAME..."
  if ! gh repo create "$REPO_NAME" $REPO_VISIBILITY --description "$REPO_DESC" 2>&1; then
    die "Failed to create repository. Check your GitHub permissions and try again."
  fi
  log "Repository created successfully."
fi

# ── Step 3: Rename branch to master if needed ─────────
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "$BRANCH_DEV" ]; then
  log ""
  log "Renaming branch '$CURRENT' → '$BRANCH_DEV'..."
  git branch -m "$CURRENT" "$BRANCH_DEV" || die "Failed to rename branch."
  log "Branch renamed."
fi

# ── Step 4: Set remote ───────────────────────────────
log ""
log "Configuring remote '$REMOTE'..."
REPO_URL="https://github.com/$GH_USER/$REPO_NAME.git"
if git remote get-url "$REMOTE" &>/dev/null 2>&1; then
  git remote set-url "$REMOTE" "$REPO_URL"
  log "Updated existing remote → $REPO_URL"
else
  git remote add "$REMOTE" "$REPO_URL"
  log "Added remote → $REPO_URL"
fi

# ── Step 5: Stage, commit, and push dev branch ───────
log ""
log "Staging and committing all current code..."
git add -A
if ! git diff --cached --quiet; then
  git commit -m "feat: initial commit — CreativeNexus 2.0 Agency Command Centre"
  log "Initial commit created."
else
  log "All changes already committed."
fi

log "Pushing $BRANCH_DEV to $REMOTE..."
git push -u "$REMOTE" "$BRANCH_DEV" || die "Failed to push $BRANCH_DEV."
log "$BRANCH_DEV pushed."

# ── Step 6: Create and push test branch ──────────────
log ""
log "Creating '$BRANCH_TEST' branch from $BRANCH_DEV..."
if git show-ref --verify --quiet "refs/heads/$BRANCH_TEST" 2>/dev/null; then
  log "Branch '$BRANCH_TEST' already exists locally. Skipping."
else
  git branch "$BRANCH_TEST" "$BRANCH_DEV"
  log "Branch '$BRANCH_TEST' created."
fi
git push -u "$REMOTE" "$BRANCH_TEST" || die "Failed to push $BRANCH_TEST."
log "$BRANCH_TEST pushed."

# ── Step 7: Create and push prod branch ──────────────
log ""
log "Creating '$BRANCH_PROD' branch from $BRANCH_DEV..."
if git show-ref --verify --quiet "refs/heads/$BRANCH_PROD" 2>/dev/null; then
  log "Branch '$BRANCH_PROD' already exists locally. Skipping."
else
  git branch "$BRANCH_PROD" "$BRANCH_DEV"
  log "Branch '$BRANCH_PROD' created."
fi
git push -u "$REMOTE" "$BRANCH_PROD" || die "Failed to push $BRANCH_PROD."
log "$BRANCH_PROD pushed."

# ── Step 8: Set default branch on GitHub ─────────────
log ""
log "Setting '$BRANCH_DEV' as default branch on GitHub..."
gh api -X PATCH "repos/$GH_USER/$REPO_NAME" -f default_branch="$BRANCH_DEV" > /dev/null \
  || die "Failed to set default branch."
log "Default branch set to $BRANCH_DEV."

# Ensure we end on dev
git checkout "$BRANCH_DEV"

log ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "  Repo:     https://github.com/$GH_USER/$REPO_NAME"
echo "  Branches: $BRANCH_DEV (dev) → $BRANCH_TEST (testing) → $BRANCH_PROD (production)"
echo ""
echo "  Daily workflow:"
echo "    ./infra/git-push.sh \"feat: message\"   Push to $BRANCH_DEV"
echo "    ./infra/git-pull.sh                    Pull latest $BRANCH_DEV"
echo "    ./infra/test-deploy.sh                 Merge $BRANCH_DEV → $BRANCH_TEST"
echo "    ./infra/prod-deploy.sh                 Merge $BRANCH_TEST → $BRANCH_PROD"
echo ""
echo "  Hostinger: pull from '$BRANCH_PROD' branch."
echo ""
log "Setup completed successfully."
