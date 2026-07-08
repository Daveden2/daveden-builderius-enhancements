#!/usr/bin/env bash
#
# Build the distributable plugin zip.
#
# Produces dist/daveden-builderius-enhancements.zip whose single top-level
# folder is `daveden-builderius-enhancements/` — no version suffix — so
# WordPress recognises it as the same plugin on every install and offers an
# in-place replace/update instead of dropping a duplicate alongside the old
# copy. Dev-only files (.github, bin, CONTRIBUTING.md, …) are stripped via the
# export-ignore rules in .gitattributes.
#
# Builds from the last commit (HEAD), matching exactly what a release tag
# contains. Commit your changes before building a release zip.
#
# Usage: bin/build-zip.sh

set -euo pipefail

slug="daveden-builderius-enhancements"
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

version="$(grep -m1 -E '^\s*\*?\s*Version:' "$slug.php" | sed -E 's/.*Version:[[:space:]]*//; s/[[:space:]]*$//')"

mkdir -p dist
out="dist/$slug.zip"
rm -f "$out"

# --prefix forces the stable top-level folder; export-ignore rules in
# .gitattributes decide what is left out.
git archive --format=zip --prefix="$slug/" -o "$out" HEAD

echo "Built $out (version ${version:-unknown})"
echo "Top-level folder(s) in the zip:"
unzip -Z1 "$out" | awk -F/ 'NF>1 {print $1}' | sort -u
