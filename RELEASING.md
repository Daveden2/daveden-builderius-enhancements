# Releasing

Releases ship from `main`. Day-to-day work lands on `develop` via pull request;
a release is a `develop → main` pull request, merged with a **merge commit** so
the two branches keep a shared history. Once that PR merges, automation does
the rest: `auto-release.yml` tags main's tip, creates the GitHub release with
notes from `readme.txt`, and builds and attaches the distributable zip. The
bundled update checker serves updates from the published release.

`main` is protected: pull request required, and the `phpcs` and `release-check`
checks must pass. Merge commits are allowed (linear history is not required),
so the release PR merges without a force push or rewrite.

## Versioning

Semantic versioning. Patch (`x.y.Z`) for bug fixes; minor (`x.Y.0`) for new
features or a change in a feature's default (e.g. flipping one to experimental /
off by default); major for breaking changes.

## Steps

1. **Land everything on `develop`.** All feature/fix PRs are merged into
   `develop` and its `phpcs` check is green.

2. **Bump the version on `develop`.** In one commit:
   - `daveden-builderius-enhancements.php` — the `Version:` header **and** the
     `DBE_VERSION` constant.
   - `readme.txt` — the `Stable tag:` field.
   - `readme.txt` — a new `= X.Y.Z =` block at the top of the Changelog, in the
     existing `* New/Fixed/Improved/Changed:` style, British English. This
     block becomes the GitHub release notes verbatim, so write it for users.
   - `CHANGELOG.md` — a new `## X.Y.Z` section with the full, detailed notes.

   Run `composer phpcs` locally, then commit as `Release X.Y.Z: <summary>` and
   push `develop`.

3. **Open the release PR: `develop → main`**, titled `Release X.Y.Z`. The
   `release-check` workflow verifies the bump is complete (all three version
   strings agree, the version is newer than the latest tag, and both changelog
   blocks exist) and `phpcs` lints the code. Both must be green to merge.

4. **Merge the PR with "Create a merge commit"** (not squash — squashing would
   diverge `main` from `develop`). Message: `Merge develop into main: release
   X.Y.Z`.

5. **Done — automation takes over.** On the push to `main`,
   `auto-release.yml`:
   - re-verifies the version strings;
   - tags **main's tip** as `vX.Y.Z` (the tip, not the bump commit, so the tag
     can never miss code that main already has — the 1.10.0 failure mode);
   - creates the GitHub release, notes taken from the `= X.Y.Z =` block in
     `readme.txt` plus a link to `CHANGELOG.md`;
   - builds the zip and attaches it as `daveden-builderius-enhancements.zip`,
     the asset the update checker prefers.

   Confirm the release appeared with the zip attached (Actions → "Tag and
   publish release"). A red run means a version-string mismatch — fix on
   `develop` and merge again; nothing has been tagged or published.

6. **Close any release-tracking issues**, referencing the release.

## Hotfixes

For a fix that cannot wait for the next `develop` release:

1. Branch from `main`: `hotfix/X.Y.Z` (patch bump).
2. Fix, bump the version and both changelogs (same as step 2 above), PR into
   `main`. `release-check` and `phpcs` gate it as usual.
3. Merge with a merge commit — automation tags and publishes as above.
4. **Back-merge `main` into `develop`** straight away so the branches share
   history and develop carries the fix.

## Notes

- The version lives in three places: the plugin header, `DBE_VERSION`, and the
  readme `Stable tag`. `release-check` refuses the PR if they disagree.
- A merge to `main` without a version bump (e.g. a docs-only change) is safe:
  `auto-release.yml` sees the existing tag and does nothing.
- `release.yml` (attach zip on a manually published release) is kept as a
  fallback for hand-cut releases; the automated path does not trigger it, and
  attaches the zip itself instead.
- The maintainer is the sole reviewer; the release PR needs no approval, only
  green checks.
