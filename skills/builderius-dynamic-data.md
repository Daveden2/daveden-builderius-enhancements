---
name: builderius-dynamic-data
description: Wire dynamic WordPress data (post fields, Meta Box/ACF fields, settings pages, menus) into Builderius templates. Activate BEFORE attempting any dynamic content in Builderius — it prevents the most expensive dead-ends (Dynamic Shortcodes, wrong helper names, stale previews).
---

# Dynamic data in Builderius

Builderius pulls dynamic content through its **data variables** (a GraphQL
layer), rendered with `{{field}}` bindings and Collection→Template loops.

## The golden rules (each one learnt the expensive way)

1. **Never use Dynamic Shortcodes inside Builderius.** `{metabox:...}`
   cannot read Meta Box **settings pages** at all (only post/term/user), and
   `{option:}` / `{call:}` need a privileged Power-Shortcode context. Do not
   probe them — go straight to data variables. Dynamic Shortcodes remain
   fine on non-Builderius surfaces (Gutenberg etc.).
2. **The system `wp` variable is not editable.** `manage_data_variable`
   update on `wp` is rejected as system-managed. Extend it with
   `apply_dynamic_data_helper` instead.
3. **Auto-generated field helpers are named from the field LABEL,
   slugified — not the field id.** E.g. a Meta Box field with id `phone` but
   label "Phone Number (Office)" becomes helper
   `wp.company_details__phone_number_office_`. Never guess from the id: run
   `list_dynamic_data_helpers` and match.
4. **A `graphQLQuery` variable may store an empty value on `create`.**
   After creating one, run an `update` with the same query, then verify with
   `get_dynamic_data`. Silent failure otherwise.
5. **The builder preview caches its GraphQL snapshot.** After changing
   WordPress data outside the builder (menus, fields), `get_dynamic_data` /
   `get_rendered_html` can serve stale results until the builder tab is
   closed and reopened. Do not debug "wrong data" until you have ruled out
   the cache.
6. **`set_visibility_condition` applies on the front end, not in the
   canvas.** A conditionally hidden element still shows in the preview and
   in `get_rendered_html`. Do not "fix" a condition that is already correct.

## Loops: Collection → Template

A Collection module loops its `<template>` child over a JSON array; each
item's fields render via `{{field}}` placeholders inside the template.
Static siblings of the `<template>` render once.

- **Data-bound loop**: the Collection's `data-b-context` attribute resolves
  a data variable to a JSON array at render time.
- **Literal loop**: `data-b-context` may hold a literal JSON array directly
  (e.g. `[{"title":"…"},{"title":"…"}]`). The DBE Import HTML dialog can
  build this automatically from repeated markup (collapse repeats + extract
  content), and `dbe/get-subtree-html` / `dbe/apply-subtree-html` round-trip
  it as a plain stored attribute.

## Workflow

1. `list_dynamic_data_helpers` — find existing helpers (see rule 3).
2. Extend `wp` via `apply_dynamic_data_helper` for post/field/menu data.
3. Add a separate `graphQLQuery` variable for custom or taxonomy-filtered
   queries (read `builderius://graphql-schema` first; remember rule 4).
4. Bind scalars with `{{...}}` in module content; loop lists with
   Collection→Template.
5. Verify with `get_dynamic_data`, then check the rendered result — and if
   it looks stale, rule 5.
