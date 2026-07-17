---
name: builderius-subtree-html
description: Build and edit Builderius template structure as plain HTML through the dbe/* abilities — one round trip instead of chains of per-module calls. Activate for any structural work on a Builderius template via MCP (adding sections, restructuring, bulk edits) when the DBE plugin is on the site.
---

# Editing Builderius structure as HTML (dbe/* abilities)

The DBE abilities serialise a template's **saved state** (the branch's
active commit) to readable HTML and reconcile edited HTML back, saving
through Builderius' own commit mutation. They are dramatically cheaper than
per-module tool chains for structural work.

## The toolkit

- `dbe/get-tree-outline` — one line per element (id, tag, classes, label,
  depth). Use it FIRST to find the module id you want, instead of reading
  whole-template HTML.
- `dbe/get-subtree-html` — the subtree as HTML; every element carries a
  `data-dbe-id` marker. Omit `module_id` for the whole template.
- `dbe/apply-subtree-html` — sanitises and reconciles edited HTML onto the
  subtree, then commits. **Always run `dry_run: true` first**: it returns
  the resulting markup (with the ids new elements would get) and
  kept/added/removed counts without saving.
- `dbe/list-commits` — the audit trail; every apply is a described commit.

## Rules of the markup

- **Keep the `data-dbe-id` markers** on elements you are keeping — the
  element's label, conditions and non-HTML settings survive only through
  its marker. Unmarked elements are created fresh; missing markers mean
  delete. Typo'd markers come back in `unknown_markers` — check them.
- **Exactly one root element**, the subtree root (its identity is forced to
  the `module_id` you pass).
- `<dbe-keep data-dbe-id="…">` placeholders stand in for modules HTML
  cannot express (Components, SvgCode, code blocks). Leave them in place —
  or move them to move the module. Never invent one.
- `<dbe-component name="slug" prop="value">` inserts a component instance;
  props are validated against what the component declares.
- `data-dbe-label="…"` names an element in the Navigator.
- Inline `<svg>` is stripped server-side (PHP would lowercase `viewBox`);
  use the builder's Edit-as-HTML dialog for SVG work, or a `<dbe-keep>` for
  an existing SvgCode module.
- **Never store `aria-*` or `focusable` attributes inside SVG markup.**
  Builderius' SVG validation disallows them, and an SVG that slips through
  silently EMPTIES the template's generated HTML at save/publish time — the
  published page renders blank. Hide a decorative icon by wrapping it in a
  `<span aria-hidden="true">` instead (allowed, and what the DBE dialogs do
  automatically when they strip those attributes).
- Script tags, event handlers and dangerous URLs are always stripped and
  reported in `stripped`.

## Collections (loops) in the HTML path

- A `data-b-context` attribute on an element makes it a Collection; its
  `<template>` child is the repeated part, `{{field}}` placeholders bind
  each item's fields. Static siblings of the `<template>` render once.
- `data-b-context` may hold a **literal JSON array** — fully expressible in
  this HTML path, round-trips cleanly.
- `data-dbe-module="collection"` / `"subcollection"` forces the module type
  when there is no binding yet.
- For loops bound to WordPress data (not literal JSON), see the
  builderius-dynamic-data skill.

## After applying

- Saving is not publishing: `dbe/status` → `dbe/publish` to make it live
  (see the builderius-save-publish skill).
- An open builder session will not show the new commit until reloaded.
- The abilities need the `edit_as_html` feature enabled and a user with
  `unfiltered_html` + `builderius-development` capabilities.
