---
name: builderius-dynamic-data
description: Wire dynamic WordPress data (post fields, Meta Box/ACF fields, repeaters, settings pages, menus) into Builderius templates, with verified GraphQL recipes for nested queries, transforms and expressions. Activate BEFORE attempting any dynamic content in Builderius — it prevents the most expensive dead-ends.
---

# Dynamic data in Builderius

Builderius pulls dynamic content through its **data variables** (a GraphQL
layer), rendered with `{{field}}` bindings and Collection→Template loops.
Read `builderius://graphql-schema` before writing any query.

## The golden rules (each one learnt the expensive way)

1. **Never use Dynamic Shortcodes inside Builderius.** `{metabox:...}`
   cannot read Meta Box **settings pages** at all (only post/term/user), and
   `{option:}` / `{call:}` need a privileged Power-Shortcode context. Do not
   probe them — go straight to data variables.
2. **The system `wp` variable is not editable.** `manage_data_variable`
   update on `wp` is rejected as system-managed. Extend it with
   `apply_dynamic_data_helper` instead. Helpers cover the CURRENT post/user
   context; loop data comes from `graphQLQuery` variables instead.
3. **Custom fields in queries need no helpers.** Select them directly on any
   Post/Term/User: `metabox_value(field_id: "job_role")` (Meta Box, uses the
   field ID) or `acf_value(name: "venue")` (ACF, uses the field name), and
   alias them for clean bindings: `role: metabox_value(field_id: "job_role")`.
   The label-slugified helper names (e.g. `wp.company__phone_number_office_`)
   apply only to auto-generated helpers for Meta Box SETTINGS PAGES — never
   guess those from the field id; run `list_dynamic_data_helpers` and match.
4. **A `graphQLQuery` variable can store an empty value on `create`.**
   Verify with `get_dynamic_data` after creating; if empty, re-send the same
   query with an `update`.
5. **The preview cache is bustable.** `get_dynamic_data { refresh: true }`
   refetches from the backend — use it after changing WordPress data outside
   the builder, before debugging "wrong data".
6. **`set_visibility_condition` applies on the front end, not the canvas.**
   A conditionally hidden element still shows in the preview and in
   `get_rendered_html`.

## Binding syntax — the two-bracket trap

- A Collection's `data-b-context` binds a **GLOBAL** data variable with
  **double square brackets** and the full path to the array:
  `data-b-context="[[teamData.terms_query.terms]]"`. The `{{ }}` form, or an
  entity-scoped variable, silently renders ONE empty placeholder row — no
  error, indistinguishable from an empty query result.
- A nested SubCollection binds **loop-item-relative** with `{{ }}` in a
  different attribute: `data-source="{{posts_query.posts}}"`.
- Leaf bindings inside a template: `{{field}}` (escaped), `{{{field}}}`
  (raw HTML). They interpolate inside attribute values too:
  `href="mailto:{{email}}"`.
- `dbe/apply-subtree-html` validates all of this and returns
  `binding_warnings` — fix every warning before trusting the result.

## Verified query recipes

**Nested taxonomy → each term's own posts** (one variable, no per-term
queries — `{{term_id}}` resolves against the parent loop item):

```graphql
{ terms_query(arguments: { taxonomy: "department", hide_empty: false,
    meta_key: "dept_order", orderby: "meta_value_num", order: "ASC" }) {
  terms {
    term_id            # must be selected for {{term_id}} to resolve below
    name
    posts_query(arguments: {
      post_type: team                # UNQUOTED enum-style, never "team"
      posts_per_page: -1
      orderby: "menu_order", order: "ASC"
      tax_query: { array: [ { taxonomy: "department", field: "term_id",
                              terms: "{{term_id}}" } ] }
    }) {
      posts {
        post_title
        role:  metabox_value(field_id: "job_role")
        email: metabox_value(field_id: "email_address")
        skills: metabox_value(field_id: "key_skills")   # arrays come back as arrays
      }
    }
  }
} }
```

**ACF fields and a repeater as a nested loop source** (`acf_repeater_value`
returns rows; alias sub-fields inside it, then loop them with a
SubCollection `data-source="{{speakers}}"`):

```graphql
{ posts_query(arguments: { post_type: event, posts_per_page: -1,
    meta_key: "event_date", orderby: "meta_value", order: "ASC" }) {
  posts {
    post_title
    event_date: acf_value(name: "event_date")   # respects the field's return format
    venue:      acf_value(name: "venue")
    speakers:   acf_repeater_value(name: "speakers") {
      speaker_name: acf_value(name: "speaker_name")
      talk_topic:   acf_value(name: "talk_topic")
    }
  }
} }
```

**Computed fields.** Three tools, in order of preference:

- `@transform` directive on a field — the expression's variables are the
  field's OWN ALIAS and its sibling fields (there is NO `value` variable):
  `price_label: acf_value(name: "ticket_price")
   @transform(expression: "price_label > 0 ? '£' ~ price_label : 'Free'")`
- `expression_result(expression: "...")` — plain Symfony ExpressionLanguage
  (`~` concatenation, ternaries, comparisons). It has NO implicit data
  context — `expression_result(expression: "1 + 1")` works, referencing
  other fields does not; prefer `@transform` for that.
- `php_function_output(function: "get_bloginfo", arguments: ["name"])` —
  calls a PHP function per row; `fallback` argument available. Use
  sparingly and never with user-controlled function names.

**Query performance**: `WP_Query` arguments accept `cache_results`,
`update_post_meta_cache`, `update_post_term_cache` and `no_found_rows` —
set `no_found_rows: true` on loops that never paginate.

## Workflow

1. Read `builderius://graphql-schema`; check `list_dynamic_data_helpers`
   only for current-context (settings pages, menus) needs.
2. Create a GLOBAL `graphQLQuery` variable (`manage_data_variable` in a
   builder session — entity-scoped variables cannot drive Collections).
3. Verify resolution with `get_dynamic_data { refresh: true }` BEFORE
   building markup — a wrong query and a wrong binding look identical later.
4. Build the loop: Collection (`data-b-context="[[var.path]]"`) → `<template>`
   → optional SubCollection (`data-source="{{path}}"`) → `<template>`. The
   whole structure can be authored in one `dbe/apply-subtree-html` call (see
   the builderius-subtree-html skill) or with `add_module_tree`.
5. Verify the rendered rows on the front end while logged in (saved commits
   render for logged-in users; no publish needed to check).
