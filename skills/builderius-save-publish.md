---
name: builderius-save-publish
description: Understand and drive the Builderius save vs publish split. Activate when front-end output is missing or stale, when a page "renders blank", or before verifying any Builderius work in a real browser.
---

# Save vs publish in Builderius

Builderius has TWO states, and who sees which depends on being logged in:

- **Saved (development)**: the builder's Save button, `builderius_builder_save`,
  `dbe/apply-subtree-html` and `dbe/patch-*-css` all write commits to the
  entity's development branch. A **logged-in** user viewing the front end
  renders these saved commits directly — save-only is enough to preview real
  pages in a browser or with an authenticated HTTP fetch.
- **Published (release)**: **logged-out** visitors render exclusively from a
  published release. No release = no public Builderius output — the theme
  fallback renders instead, which for a mostly-empty page looks blank.

So publishing is **go-live, not preview**. Save, verify logged-in, and run
`dbe/publish` only when the user explicitly approves making the work public.
A cookie-less fetch (`credentials: omit`, curl without cookies) is the way to
check what the public actually sees.

The classic false bug report: work is saved, a LOGGED-OUT check shows nothing
or old content, and the missing release gets misdiagnosed as a rendering bug.
**Before blaming template content, check the publish state and which auth
state you are testing with.**

## The loop: save → verify (logged in) → publish on approval

1. **Status**: `dbe/status` — per template: the saved commit and whether it
   is in the published release (`unpublished_changes`), plus the site's
   current published release (`null` means the site has NEVER published).
2. **Verify saved work**: fetch the real page while authenticated (browser
   with a logged-in session, or curl with a `wordpress_logged_in_*` cookie).
3. **Publish** (only on explicit approval): `dbe/publish` — the builder's own
   createRelease mutation. Select page-bound templates with `pages`, other
   Builderius templates with `templates`, and add release taxonomy terms with
   `tags`. Omit both selectors to include every saved page/template.
   Builderius always adds every global settings set and recursively adds the
   components used by the selection; these dependencies cannot be excluded.
   The dry run groups the actual result into `pages`, `templates`,
   `components` and `global_settings_sets`.
   The ability auto-increments a semver version and replaces the previous release.
   **Always dry-run first — publishing requires it**: the dry run returns
   the complete inclusion plan and an `expected_commits` list; pass that list
   back unchanged for the real publish. It covers selected pages/templates,
   component dependencies and global settings, and fails if any saved state
   changed in between. It publishes SAVED commits — save pending work first.
   A builder tab with unsaved changes blocks publishing
   (`dbe_builder_tab_conflict`); `force: true` overrides only on explicit user
   approval.
4. **Verify public**: a cookie-less fetch of the page, then `dbe/status`
   should show `unpublished_changes: false`.

## The reverse direction: extract a release into development

`dbe/extract-release` is the builder's "work on a release" action (Builderius'
own `extractRelease` mutation): it rebuilds the DEVELOPMENT state from a
release. The classic need is a migrated site whose live pages render from a
release while the builder shows nothing meaningful — extraction repopulates
the dev branches from what is published.

It is the most destructive ability in the set: Builderius first **deletes
every template, component and global settings set** (framework CSS and all
commit history included), then recreates each entity from the release with a
fresh single-commit history. The release itself stays published, so
logged-out visitors see no change.

1. **Always dry-run first**: returns the release's bundled entities
   (`contains`) and everything that would be deleted (`replaces`).
2. Get **explicit user approval**, then pass `confirm: true`.
3. Close open builder tabs first and reload them after — a stale tab's save
   would resurrect deleted state (the dirty-tab preflight blocks this;
   `force: true` overrides only on explicit approval).

## Related staleness traps

- An open builder session does NOT see commits created ability-side
  (`dbe/apply-subtree-html`, `dbe/patch-global-css`, `dbe/patch-entity-css`)
  until the builder tab is reloaded — and a tab with unsaved changes will
  OVERWRITE those commits when it saves or closes. The abilities therefore
  refuse real saves while such a tab exists (`dbe_builder_tab_conflict`;
  dry runs still work). Surface it and get the tab saved or discarded, or
  pass `force: true` only on explicit user approval.
- The builder MCP's `get_dynamic_data` accepts `refresh: true` to bypass its
  cached GraphQL snapshot; `get_rendered_html` / `inspect_entity` may still
  serve stale module state after out-of-band changes — re-open the builder
  tab rather than re-querying in a loop.
- `set_visibility_condition` applies on the front end only — the canvas and
  `get_rendered_html` still show conditionally hidden elements.
