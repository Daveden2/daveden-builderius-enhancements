---
name: builderius-save-publish
description: Understand and drive the Builderius save vs publish split. Activate when front-end output is missing or stale, when a page "renders blank", or before verifying any Builderius work in a real browser.
---

# Save vs publish in Builderius

Builderius has TWO states and they never blur:

- **Saved (development)**: the builder's Save button, `builderius_builder_save`,
  `dbe/apply-subtree-html` and `dbe/patch-global-css` all write commits to the
  entity's development branch. "Saved to development" means exactly that.
- **Published (release)**: the front end renders **exclusively** from a
  published release. No release = **no Builderius output at all** — the theme
  fallback renders instead, which for a mostly-empty page looks like a blank
  page. There is no logged-in dev preview on the front end.

The single most common false bug report follows from this: work is saved,
the front end shows nothing (or old content), and the missing publish gets
misdiagnosed as a rendering bug. **Before blaming template content, check
the publish state.**

## The loop: save → publish → verify

1. **Status**: `dbe/status` — per template: the saved commit and whether it
   is in the published release (`unpublished_changes`), plus the site's
   current published release (`null` means the site has NEVER published).
2. **Publish**: `dbe/publish` — the builder's own createRelease mutation.
   Bundles the listed templates' saved commits (Builderius adds global
   settings sets and any components automatically), auto-increments a
   semver version, replaces the previously published release. `dry_run`
   previews the version and entities first. It publishes SAVED commits —
   save pending work first.
3. **Verify**: fetch the real page (HTTP or a browser tool), not just the
   builder canvas — then `dbe/status` should show `unpublished_changes:
   false`.

## Related staleness traps

- An open builder session does NOT see commits created ability-side
  (`dbe/apply-subtree-html`, `dbe/patch-global-css`) until the builder tab
  is reloaded.
- The builder MCP's `get_rendered_html` / `inspect_entity` can serve a stale
  snapshot after out-of-band changes; re-open the builder tab rather than
  re-querying in a loop.
- `set_visibility_condition` applies on the front end only — the canvas and
  `get_rendered_html` still show conditionally hidden elements.
