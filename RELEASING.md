# Releasing

Releases ship from `main`. Day-to-day work lands on `develop` via pull request;
a release is a `develop → main` pull request, merged with a **merge commit** so
the two branches keep a shared history. The bundled update checker serves updates
from the published GitHub release.

`main` is protected: pull request required, the `phpcs` check must pass, and it
must be up to date. Merge commits are allowed (linear history is not required), so
the release PR merges without a force push or rewrite.

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
     existing `* New/Fixed/Improved/Changed:` style, British English.

   Run `composer phpcs` locally, then commit as `Release X.Y.Z: <summary>` and
   push `develop`.

3. **Open the release PR: `develop → main`**, titled `Release X.Y.Z`. Wait for
   the `phpcs` check to pass on it.

4. **Merge the PR with "Create a merge commit"** (not squash — squashing would
   diverge `main` from `develop`). Message: `Merge develop into main: release
   X.Y.Z`.

5. **Tag the release commit.** Tag the version-bump commit (not the merge
   commit), matching earlier tags:

   ```sh
   git fetch origin
   git tag -a vX.Y.Z <release-commit-sha> -m "Release X.Y.Z: <summary>"
   git push origin vX.Y.Z
   ```

6. **Publish the GitHub release** for `vX.Y.Z` (title `X.Y.Z`, notes from the
   changelog). Publishing fires `.github/workflows/release.yml`, which builds the
   distributable zip and attaches it as `daveden-builderius-enhancements.zip` —
   the asset the update checker prefers. Confirm the zip is attached.

7. **Close any release-tracking issues**, referencing the release.

## Notes

- The version lives in exactly two files: the main plugin file (header +
  `DBE_VERSION`) and `readme.txt` (`Stable tag`). Keep all three in step.
- `phpcs` runs on pushes to `develop` and on PRs into `develop` and `main`, so
  the release PR is checked before it can merge.
- The maintainer is the sole reviewer; approve/merge the release PR yourself.
