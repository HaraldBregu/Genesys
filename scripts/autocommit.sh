#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [[ -z "$(git status --porcelain)" ]]; then
  echo "no changes"
  exit 0
fi

msg="${1:-chore: autocommit $(date +'%Y-%m-%d %H:%M:%S')}"

git add -A
git commit -m "$msg"

if [[ "${PUSH:-0}" == "1" ]]; then
  git push
fi
