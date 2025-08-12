#!/usr/bin/env bash
set -euo pipefail
if [ $# -lt 2 ]; then
  echo "Usage: ./setup_github.sh <github-username> <repo-name>"
  exit 1
fi
USERNAME="$1"
REPO="$2"

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin "https://github.com/${USERNAME}/${REPO}.git"
git push -u origin main

echo ""
echo "Now open: https://github.com/${USERNAME}/${REPO}/settings/pages"
echo "Ensure 'GitHub Actions' is selected. First deploy will appear under the Actions tab."
