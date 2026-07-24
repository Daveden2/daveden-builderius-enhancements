---
name: builderius-components
description: Decide when Builderius page UI should become a reusable component, infer text/select/boolean props, and author component definitions, instances, nesting and static-JSON-driven repeating patterns through the dbe/* abilities. Activate before building or restructuring repeated or reusable UI, before creating any Builderius component over MCP, and when instance props render empty.
---

# Component authoring through the dbe/* abilities

A component is a reusable module tree with its own entity CSS, data
variables, JS snippets and **declared properties**. Instances placed in
templates (or other components) can override those properties. Editing a
component's definition changes every instance immediately on save — no
per-template work.

## Make the component decision before building

Inventory the proposed page structure before authoring modules. Prefer a
component when any of these is true:

- the same semantic pattern occurs at least twice;
- the pattern is likely to be reused on another page;
- several instances share structure and styling but vary in content or a
  small visual state;
- the pattern has a clear product-level name such as card, testimonial,
  pricing tier, callout, navigation or footer.

Keep one-off page composition in the template. Do not create a component for a
generic wrapper, a layout used once, or markup whose instances would need
substantially different internal trees. Check `dbe/list-components` first and
extend an existing semantic match when its contract fits; do not create a
near-duplicate by appearance alone.

Define props only for instance-level variation:

- `text`: free text, URLs, labels, numbers represented as copy, or a binding
  path;
- `select`: a closed, stable set of variants such as size, alignment, tone or
  heading level; mark exactly one option as the default;
- `boolean`: an independent on/off state such as showing an icon, badge or
  secondary action.

Keep structural markup, class names, spacing and implementation details inside
the component. If two instances need different structures, split the
component or keep the pattern local rather than adding a prop that smuggles
markup or CSS through text.

## Collapse repeated static content into data

When siblings repeat the same structure, do not duplicate one module subtree
per row. Use one Collection and Template, then drive it from static JSON while
the content is fixed. If the whole pattern is also reusable, put that
Collection inside the component; otherwise keep the Collection in its page
template.

1. Model the repeated records as a small array of consistently shaped objects.
2. For a small fixed dataset, put literal JSON directly on the Collection,
   for example
   `data-b-context='[{"label":"First"},{"label":"Second"}]'`.
   For a larger, shared or soon-to-be-dynamic dataset, store it as a
   namespaced global `json` data variable with `dbe/manage-data-variable`;
   global variables are the dependable Collection source in Builderius
   1.3.5-beta.
3. Use one `<template>` child for the repeated row and bind its fields with
   `{{field_name}}`. A list uses one item template; a table uses one row
   template inside `<tbody>`, while headings stay outside the Collection.
4. When component instances need a named source, declare a text prop such as
   `items_source` whose default is the global binding (for example
   `[[feature_grid_items]]`) and bind the internal Collection with
   `data-b-context="[[[props.items_source]]]"`.
5. Verify the default instance in a real render. Instance-level array
   overrides are not dependable in this Builderius version; when instances
   need different datasets, pass a scalar selector and let the component
   query or derive the array, or create distinct global JSON variables and
   prove each binding.

Static JSON is a modelling step, not a permanent requirement. Replace it with
a real query later when the content becomes editorial or remote, without
changing the component's repeated structure.

Move component-owned selectors into that component's entity CSS. Keep
page-layout selectors that position the component among its siblings in the
template's entity CSS. Props carry content and stable variants; they do not
carry CSS declarations or arbitrary class strings.

## The toolkit

- `dbe/list-components` — every component with its declared properties and
  saved commit. Read this FIRST; it is the prop reference for instances.
- `dbe/create-component` — the builder's createComponent mutation plus a
  scaffold commit (root `<div>`, `wp` data variable, declared properties),
  so the content abilities work immediately. Titles map to snake_case
  slugs (`Feature Card` → `feature_card`).
- `dbe/manage-component-property` — add/update/delete declared properties.
- `dbe/delete-component` — permanent; refused while anything still uses it
  (the usage list comes back — remove those instances first).
- Internals, styles and data: the standard abilities with
  **`entity_type: "component"`** — `dbe/get-subtree-html`,
  `dbe/apply-subtree-html`, `dbe/get-entity-css`, `dbe/patch-entity-css`,
  `dbe/get-data-variables`, `dbe/manage-data-variable`,
  `dbe/get-js-snippets`, `dbe/manage-js-snippet`.

## Properties — how the pipeline actually resolves them

Two things exist per component, and they MUST stay in step (the abilities
do this for you — never edit them by hand):

1. `componentTmplProperties` — the declared definitions the builder UI
   shows: `{ type, name, label, placeholder | options }`.
2. A hidden `props` **json data variable** holding `{ name: default }`.
   The render pipeline resolves every prop through this variable, and an
   instance override only applies to a key that **already exists** in it.
   A prop missing from `props` renders empty even when the instance sets
   it — the classic "my override does nothing" failure.

Property types: `text` (placeholder = default; may be a `[[binding]]`),
`select` (options with exactly one `default: true`), `boolean`
(placeholder true/false). Names are **lowercase snake_case** — instance
overrides travel as HTML attributes, which lowercase silently.

Properties cannot be renamed: instance overrides across every template
reference the name. Delete and redeclare, then re-apply overrides.
Deleting is refused while the component's own internals still reference
the prop — remove those references first.

## Using props inside the component

- Text content: `[[props.heading_text]]` (escaped) or
  `[[[props.heading_text]]]` (raw).
- Attributes, including a Collection's `data-b-context`:
  `data-b-context="[[[props.items_query]]]"` — pass a whole binding path
  in via a text prop whose placeholder is the default binding, e.g.
  `[[wp.nav_menu__main_navigation.items]]`.

## Instances

Place and edit instances with `dbe/apply-subtree-html` on the template:

```html
<dbe-component name="feature_card"
               heading_text="Instant settlements"
               variant="featured"></dbe-component>
```

- Every attribute except `name` is a prop override, validated against the
  declared list — undeclared attributes are dropped with a note.
- An instance with no overrides uses the declared defaults.
- Existing instances serialise the same way (with their `data-dbe-id`);
  edit the attributes and re-apply to change overrides.
- Components nest: put `<dbe-component>` inside another component's
  internals. Deletion order is inside-out — template instances, then the
  outer component, then the inner.

## Build recipe (new component, verified)

1. `dbe/create-component` with `title` and `props`.
2. `dbe/get-subtree-html` (`entity_type: "component"`) → author internals
   in one `dbe/apply-subtree-html`, binding `[[props.x]]` where instances
   should vary. Add concise `data-dbe-label` values to the component root and
   meaningful internal groups, controls and bound content so instances are
   straightforward to inspect in the Navigator.
3. `dbe/patch-entity-css` (`entity_type: "component"`) for its styles —
   scoped to the component, shipped with every instance.
4. Place instances in a template; verify the rendered page logged in.
   Both the defaults and each override should show — an empty prop means
   the `props` data variable is out of step (re-run
   `dbe/manage-component-property` update to regenerate it).
