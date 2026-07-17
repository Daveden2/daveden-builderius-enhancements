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
  the resulting markup (with the ids new elements would get),
  kept/added/removed counts and `base_commit` without saving.
- `dbe/list-commits` — the audit trail; every apply is a described commit.

## The save contract (dry run → expected_commit → save)

Every real (non-dry-run) save REQUIRES `expected_commit` — the
`base_commit`/`commit_name` returned by the preceding read or dry run.
Saving without it fails `dbe_expected_commit_required`; saving with a stale
one fails `dbe_commit_conflict` (someone else committed in between — re-read,
rebase your edit onto the fresh HTML, and try again). So the flow is always:

1. `dbe/get-subtree-html` (or a dry-run apply) — note the commit name.
2. Edit, then `dry_run: true` — check counts, `stripped`,
   `unknown_markers`, `binding_warnings`.
3. Apply for real with `expected_commit` set.

While a builder tab has this template open with UNSAVED changes, real saves
fail with `dbe_builder_tab_conflict` (dry runs still work). Do not retry
blindly: surface it, get the tab saved or discarded, or pass `force: true`
only after the user explicitly confirms overwriting the tab's state.

Payload limits: 256 KB of HTML, 5000 elements, nesting depth 100 — target
the smallest subtree that contains your change.

## Rules of the markup

- **Keep the `data-dbe-id` markers** on elements you are keeping — the
  element's label, conditions and non-HTML settings survive only through
  its marker. Unmarked elements are created fresh; missing markers mean
  delete. Typo'd markers come back in `unknown_markers` — check them.
- **A kept marker does NOT keep the element's children.** The payload
  expresses the complete subtree: an element passed as `<section
  data-dbe-id="…"></section>` keeps that section but DELETES everything
  inside it. To append a sibling section you must apply on the parent and
  include every existing branch's full markup (`dbe/get-subtree-html`
  first, then edit). When in doubt, target the smallest subtree that
  contains your change.
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

Data-bound and literal loops are both fully expressible — a whole dynamic
section (Collection → Template → SubCollection → Template) can be authored
in one apply:

- A `data-b-context` attribute makes an element a Collection; its
  `<template>` child is the repeated part, `{{field}}` placeholders bind
  each item's fields. Static siblings of the `<template>` render once.
- **Data-bound**: `data-b-context="[[global_var.path.to.array]]"` — double
  square brackets, GLOBAL variable with a snake_case name (the builder UI
  rejects camelCase names; see builderius-dynamic-data for the syntax rules
  and query recipes).
- **Literal**: `data-b-context` may hold a literal JSON array directly.
- **Nested**: a `data-source` attribute makes an element a SubCollection —
  loop-item-relative, `{{ }}` form: `data-source="{{posts_query.posts}}"`
  (works over query results and ACF repeater rows alike). It needs its own
  `<template>` child.
- `data-dbe-module="collection"` / `"subcollection"` forces the module type
  when there is no binding yet.
- Applies return `binding_warnings` naming every silent-empty-loop trap it
  can detect ({{ }} in data-b-context, non-global variable, [[ ]] in
  data-source, missing `<template>` child). Fix them all — a mis-wired loop
  renders one empty placeholder row with no error anywhere.

## After applying

- A logged-in front-end fetch shows the saved result immediately — verify
  there. `dbe/publish` is go-live for logged-out visitors only, on explicit
  user approval (see the builderius-save-publish skill).
- An open builder session will not show the new commit until reloaded — and
  a builder tab with UNSAVED changes on this template blocks real saves
  outright (`dbe_builder_tab_conflict`; see the save contract above).
- The abilities need the `edit_as_html` feature enabled and a user with
  `unfiltered_html` + `builderius-development` capabilities.
