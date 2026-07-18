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
  props are validated against what the component declares
  (`dbe/list-components` is the reference; authoring lives in the
  `builderius-components` skill).
- `data-dbe-label="…"` names an element in the Navigator. It is consumed as
  module metadata and does not render as a front-end HTML attribute.
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

## Navigator labels for authored elements

When creating or substantially rebuilding markup, add `data-dbe-label` to
meaningful structural elements and important working parts. A useful Navigator
should explain the page at a glance rather than read as a wall of `Div`,
`Paragraph` and `Template` rows.

- Label sections, major layout groups, Collections/Templates, forms, controls
  and key content such as headings, media and calls to action.
- Use short, human-readable role names: `Hero`, `Hero heading`, `Services
  grid`, `Service item template`, `Contact form`, `Submit button`.
- Use a consistent section prefix where it disambiguates repeated parts, such
  as `Pricing heading` and `Pricing cards`.
- Do not label every incidental wrapper or repeat the bare tag name. Leave a
  label off when it would add no information.
- Preserve useful labels on retained elements. To rename one deliberately,
  keep its `data-dbe-id` and change or add `data-dbe-label`.

```html
<section data-dbe-label="Services">
  <h2 data-dbe-label="Services heading">What we do</h2>
  <div class="services-grid" data-dbe-label="Services grid">
    <!-- cards -->
  </div>
</section>
```

## Collections (loops) in the HTML path

Data-bound and literal loops are both fully expressible — a whole dynamic
section (Collection → Template → SubCollection → Template) can be authored
in one apply:

- A `data-b-context` attribute makes an element a Collection; its
  `<template>` child is the repeated part. Static siblings of the `<template>`
  render once.
- **Data-bound**: `data-b-context="[[global_var.path.to.array]]"` or
  `data-b-context="[[[global_var.path.to.array]]]"` — a GLOBAL variable with a
  snake_case name (the builder UI rejects camelCase names; see
  builderius-dynamic-data for the syntax rules and query recipes). Builderius
  serialises arrays/objects to JSON through both square-bracket helpers, so
  double-square collection sources are valid.
- **URL source**: use the interactive Collection wiring:
  `data-b-context="https://example.test/items.json"
  data-b-interactive="my_source"
  data-b-bind--data-content="my_source"`. The URL must return JSON in the
  expected array shape. DBE writes Builderius' `interactiveMode` setting from
  this HTML. A bare `data-source-url` attribute, or fetched `data-content`
  without interactive mode, may stay in the rendered markup with its
  `<template>` untouched. This is client-side fetching; verify loading/failure
  behaviour and CORS for remote origins.
- **Output filtering**: square brackets are the scalar escaped/raw boundary:
  `[[path]]` calls Builderius' escaped helper and `[[[path]]]` calls its raw
  helper. Collection arrays work through either form. Current-item curly
  expressions are different: verified renders show both `{{expression}}` and
  `{{{expression}}}` can output HTML in normal element content, so do not rely
  on double curly braces as sanitisation.
- **Item expressions**: template text and attributes can contain expression
  functions directly, not just field names: `{{upper(title)}}`,
  `{{price > 0 ? '£' ~ price : 'Free'}}`,
  `href="mailto:{{lower(email)}}"`.
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

## Repeated static markup conversion

When source HTML contains repeated siblings that are structurally alike, treat
them as a likely dynamic-data opportunity:

- Repeated `<li>`, `<tr>`, cards, tiles, gallery figures, navigation items and
  testimonial blocks should usually become one Collection with one
  `<template>` child.
- The Builder UI Import HTML dialog detects these groups and can collapse
  them automatically. If "Extract the repeated content into each collection's
  data source (JSON)" is enabled, DBE lifts copy-to-copy differences into a
  literal JSON `data-b-context` and replaces the first copy's leaves with
  `{{field_or_expression}}` placeholders.
- That literal JSON is a safe bridge, not the preferred final state when the
  content already exists in WordPress. Replace it with a global
  `graphQLQuery` data variable and a `[[[var.path.to.items]]]` binding after
  the data variable verifies. If the final source is an external JSON endpoint
  instead, use the interactive URL-source attributes and verify the endpoint
  returns the same array shape as the bridge JSON.
- Headless applies cannot change a kept module's Builderius type. To convert
  an existing HtmlElement grid/list into a Collection, apply on its parent:
  keep the surrounding parent/intro markup, remove the repeated group's
  `data-dbe-id`, and submit the group as a fresh Collection with
  `data-b-context` and a `<template>`.
- For nested repeated groups inside each item, prefer a SubCollection inside
  the template (`data-source="{{acf_repeater_rows}}"`,
  `data-source="{{posts_query.posts}}"`, etc.). Do not create multiple global
  Collections for parent-relative data.
- Recursive templates are for hierarchical data where each item can have
  children of the same shape, such as menus, page trees or nested terms. Do
  not use recursion merely because a flat list has repeated cards.

Conversion workflow:

1. Paste/import the static HTML and let DBE collapse obvious repeats, or author
   the Collection/Template markup directly.
2. If the converter generated literal JSON, inspect the field names it lifted
   and use those names as draft aliases for the real GraphQL query.
3. Create/update the global data variable via `dbe/manage-data-variable`;
   verify it before saving the final structural binding.
4. Swap `data-b-context='[{"..."}]'` for
   `data-b-context="[[real_var.query.items]]"` or
   `data-b-context="[[[real_var.query.items]]]"` and keep the template's
   `{{field_or_expression}}` placeholders. For a URL source, put the URL in
   `data-b-context`, add matching `data-b-interactive` and
   `data-b-bind--data-content`, and confirm the URL returns a JSON array
   compatible with those placeholders.
5. Dry-run `dbe/apply-subtree-html`, fix every `binding_warnings` entry, save
   with `expected_commit`, then verify real rendered rows while logged in.

## After applying

- A logged-in front-end fetch shows the saved result immediately — verify
  there. `dbe/publish` is go-live for logged-out visitors only, on explicit
  user approval (see the builderius-save-publish skill).
- An open builder session will not show the new commit until reloaded — and
  a builder tab with UNSAVED changes on this template blocks real saves
  outright (`dbe_builder_tab_conflict`; see the save contract above).
- The abilities need the `edit_as_html` feature enabled and a user with
  `unfiltered_html` + `builderius-development` capabilities.
