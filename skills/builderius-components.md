---
name: builderius-components
description: Author Builderius components headlessly — definitions, declared properties, internals, instances with overrides, and nesting — through the dbe/* abilities. Activate before creating or restructuring any Builderius component over MCP, and when instance props render empty.
---

# Component authoring through the dbe/* abilities

A component is a reusable module tree with its own entity CSS, data
variables, JS snippets and **declared properties**. Instances placed in
templates (or other components) can override those properties. Editing a
component's definition changes every instance immediately on save — no
per-template work.

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
