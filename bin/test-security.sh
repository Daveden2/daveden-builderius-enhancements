#!/usr/bin/env bash

set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
wp_path="${1:-${DBE_WP_PATH:-}}"

if [ -z "$wp_path" ]; then
  echo "Pass a WordPress path with DBE active, or set DBE_WP_PATH." >&2
  exit 2
fi

wp --path="$wp_path" eval-file "$root/tests/security-regressions.php"

if grep -R -E 'uses:[[:space:]]+[^#[:space:]]+@v[0-9]+' "$root/.github/workflows"; then
  echo "GitHub Actions must be pinned to full commit SHAs." >&2
  exit 1
fi

build_line="$(grep -n -m1 'name: Build and checksum' "$root/.github/workflows/auto-release.yml" | cut -d: -f1)"
tag_line="$(grep -n -m1 'name: Tag main' "$root/.github/workflows/auto-release.yml" | cut -d: -f1)"
if [ -z "$build_line" ] || [ -z "$tag_line" ] || [ "$build_line" -ge "$tag_line" ]; then
  echo "The release archive must be built before the release tag is pushed." >&2
  exit 1
fi

echo "Security and release workflow checks passed."
