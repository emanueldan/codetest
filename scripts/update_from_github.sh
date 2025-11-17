#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/update_from_github.sh <repository-url> [branch]

Ensures the current working tree is synced with the given GitHub repository.
Provide the HTTPS clone URL (e.g. https://github.com/user/repo.git). The optional
branch argument defaults to the current branch name.
USAGE
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

REPO_URL="$1"
BRANCH="${2:-$(git rev-parse --abbrev-ref HEAD)}"

if [[ -z "$REPO_URL" ]]; then
  echo "Repository URL is required." >&2
  exit 1
fi

if git remote | grep -qx origin; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

echo "Fetching latest changes from $REPO_URL (branch: $BRANCH)..."
if ! git fetch origin "$BRANCH"; then
  echo "Unable to fetch from origin/$BRANCH" >&2
  exit 1
fi

echo "Checking out $BRANCH..."
git checkout "$BRANCH" >/dev/null 2>&1 || git checkout -b "$BRANCH"

echo "Resetting working tree to origin/$BRANCH..."
git reset --hard "origin/$BRANCH"

echo "Repository is now aligned with origin/$BRANCH."
