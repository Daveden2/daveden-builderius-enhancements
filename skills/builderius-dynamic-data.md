---
name: builderius-dynamic-data
description: Wire WordPress, ACF, Meta Box, relationship, media, request and external data into Builderius templates. Use before building dynamic content, Collections, nested loops, recursive trees, component data props, expressions, meta queries or PHP-backed fields; includes verified fallbacks and render-failure triage.
---

# Dynamic data in Builderius

Builderius resolves WordPress data through GraphQL data variables, then binds
global values with square brackets and loop-item values with curly brackets.
Read `builderius://graphql-schema` before writing a query because the schema is
site-dependent.

## Core workflow

1. Inspect the current entity and read its existing data variables before
   changing anything. Read the schema before writing a query: in a builder
   session read `builderius://graphql-schema`; headless, call
   `dbe/get-dynamic-data-schema` (search or expand a type — it reflects this
   site's ACF/Meta Box/Pro fields). Use `list_dynamic_data_helpers` only for
   current-context helpers such as settings pages and menus.
2. Create one GLOBAL `graphQLQuery` variable per coherent source. Use
   snake_case names. Entity-scoped variables are not dependable rendered
   binding sources and cannot drive Collections.
3. Verify the query result before building markup. Headless, call
   `dbe/resolve-data-variable` with the target page as context — it validates
   against the live schema (naming real unknown-field errors) AND returns the
   runtime value. In a builder session `get_dynamic_data { refresh: true }`
   works too. A successful save proves syntax only.
4. Before binding a Collection, call `dbe/inspect-binding-value` on the
   intended `data-b-context` path: it classifies the resolved value
   (list/object/scalar) and flags the silent-empty-loop and Mustache-fatal
   shapes before they reach markup.
5. Build Collection -> Template -> optional SubCollection -> Template. Use
   small query limits while proving nested loops.
6. Prove the render with `dbe/check-rendered-output` (leaked Templates,
   unresolved bindings, PHP errors, expected text, blank labels) and, for
   URL-driven listings, `dbe/check-render-scenarios` with a matrix of query
   parameters and cookies. Do not treat a clean builder preview or an empty
   loop as proof that the source is genuinely empty.

For headless changes, read `dbe/get-data-variables`, pass its commit as
`expected_commit` to `dbe/manage-data-variable`, then reload any open builder
tab. Updating the system `wp` variable requires `allow_system: true`.

## Known-good bindings

- Read a global scalar with `[[variable.path]]`; use `[[[variable.path]]]`
  for deliberately raw global HTML.
- Bind a Collection source with
  `data-b-context="[[variable.query.posts]]"` or the triple-square form. Both
  resolve arrays in verified render tests.
- Bind a nested SubCollection with a loop-relative path such as
  `data-source="{{posts_query.posts}}"`, `data-source="{{terms}}"` or
  `data-source="{{repeater_rows}}"`.
- Inside a Template, read the current row with `{{field}}` or
  `{{expression}}`. Bind trusted raw HTML only when the source has already
  been sanitised. Verified Builderius 1.3.5-beta renders trusted HTML through
  both double- and triple-curly forms in ordinary content, so double curly
  braces are not a security boundary.
- Bind values inside attributes normally, for example
  `href="mailto:{{lower(email)}}"`.
- A Collection may also use literal JSON or an interactive URL source. For a
  URL use `data-b-context`, `data-b-interactive` and
  `data-b-bind--data-content`; DBE converts that wiring to Builderius'
  `interactiveMode`. Verify the endpoint shape, CORS and loading behaviour.

Known-broken forms and their fallbacks:

- A global Collection bound with curly braces can render one empty placeholder
  row. Use square brackets and the full global path.
- A nested SubCollection bound with square brackets loses the row context.
  Use `data-source="{{path}}"`.
- A bare `data-source-url`, or interactive attributes without
  `interactiveMode`, can fetch data without rendering the Template. Use the
  complete interactive wiring.
- A scalar, falsey or null Collection source can leak an unresolved
  `<template>`. An object may render once. Normalise all loop sources to
  arrays.

## Choosing a source

- Current post/user/menu context: read or extend the guarded system `wp`
  variable. It cannot be renamed or deleted.
- Another post, term or user: query it explicitly by ID, slug, login, name or
  taxonomy argument. Do not mutate `wp` to impersonate another object.
- Posts: `posts_query(arguments: { post_type: "post", posts_per_page: 10,
  no_found_rows: true }) { posts { ... } }`.
- Terms: `terms_query(arguments: { taxonomy: "category", hide_empty: false })
  { terms { ... } }`.
- Users: `users_query(arguments: { role: "author", number: 12 }) { users {
  ... } }`.
- External JSON: use a URL Collection only when client-side fetching is
  acceptable and the endpoint already returns the required array. For private,
  authenticated, cached or reshaped data, use a prefixed PHP wrapper through
  `php_function_output`.
- Repeated static markup: convert one representative child to a Template,
  lift sample values into literal JSON while proving the structure, then
  replace the literal source with a real query variable.

Alias fields aggressively so template bindings stay short. Prefer separate
variables while investigating: one broken resolver can blank a large combined
variable and hide the responsible branch.

## Queries and expressions

Use `@transform` for output-side formatting of the selected field. Its
expression can read the field's alias and sibling fields:

```graphql
price_label: acf_value(name: "ticket_price")
  @transform(expression: "price_label > 0 ? '£' ~ price_label : 'Free'")
```

Use `expression_result` for a named derived value that reads earlier sibling
fields, particularly private intermediates:

```graphql
raw_count: expression_result(expression: "count(rows ?: [])") @private
count_label: expression_result(expression: "'Count ' ~ raw_count")
```

Directives such as `@transform` and `@recursive` change output after a resolver
returns. They do not change the input seen by another resolver argument. When
an argument needs a computed or sanitised value, calculate it on the input
side with a verified expression, GraphQL variable or render-pure PHP wrapper.

Useful ExpressionLanguage operations include `~`, ternaries, `?:`, `and`,
`or`, `not`, `in`, comparisons, arithmetic, `is_empty`, `is_numeric`,
`foreach`, `filter`, `pluck`, `merge`, `flatten`, `sum`, `count`, `join`,
`trim`, `intval`, `date` and `strtotime`. Verify unfamiliar functions in the
live schema/runtime before depending on them.

Quoting rules:

- Use double quotes for GraphQL strings and single quotes inside expression
  strings.
- Prefer quoted WordPress values: `post_type: "event"`,
  `taxonomy: "category"`. Verify old enum-style examples before copying them.
- Interpolate a scalar argument with `"{{field}}"`. Prefer triple braces when
  the whole argument is an array or object: `terms: "{{{term_ids}}}"`.

## Request-driven queries

`url_parameter`, `cookie_parameter` and `server_parameter` read sanitised
request values. A URL fallback only covers a missing parameter; an explicitly
blank query value remains blank.

Never feed raw request data into `orderby`, `order`, `meta_key`, search,
taxonomy roots or meta comparisons. Normalise blanks, coerce numbers and
allowlist option values before interpolation. A render-pure PHP wrapper is the
verified path when `expression_result` cannot reliably feed a later resolver:

```graphql
{
  topic: php_function_output(
    function: "dbe_dynamic_stress_query_value"
    arguments: ["topic", "news", "slug", "news,events"]
    fallback: "news"
  ) @private
  results: posts_query(arguments: {
    post_type: "post"
    tax_query: { array: [
      { taxonomy: "category", field: "slug", terms: ["{{topic}}"] }
    ] }
    no_found_rows: true
  }) {
    posts_count
    posts { title: post_title }
  }
}
```

For recursive pages or terms, allowlist and select the root first, then render
`children @recursive(depth: n)`. Keep the current `post` context separate from
the URL-selected root. Do not expect `@recursive` to filter each level.

For custom pagination, select `pagination` with a dedicated
`pagination_url_param_name`, omit `no_found_rows`, and render `links` as raw
HTML. Avoid `paged`; WordPress may canonical-redirect it before the custom
query sees it.

## Nested relationships and Collections

Terms -> posts works by selecting `term_id` on each term and interpolating it
into the child `posts_query`. Posts -> terms can use built-in taxonomy fields
or a nested `terms_query(object_ids: ["{{ID}}"])` after selecting `ID`.

Deep Collections are dependable when every parent exposes an array and every
child uses a row-relative `data-source`. Verified fixtures rendered both:

- event -> terms -> events -> ACF repeater rows
- terms -> events -> terms -> events -> ACF repeater rows

Keep `posts_per_page` small because fan-out grows quickly. When nesting stops,
inspect the saved data variable, verify the parent row's actual shape, then
check the child's binding syntax.

A nested posts query inside a user row using `author: "{{ID}}"` saved but
blanked the whole variable in Builderius 1.3.5-beta. Use a separate root
`posts_query(arguments: { author: 123 })` unless the target runtime proves the
nested form works. Also check fixture ownership; `post_author = 0` can make a
correct author query look broken.

## Component data props

A declared component prop whose default/placeholder points to a global array
binding can drive an internal Collection through `[[props.items]]` or
`[[[props.items]]]`. `dbe/apply-subtree-html` may warn that `props` is not a
global variable; inside a component this can be a false positive, so render
the instance before deciding.

Verified limitations in Builderius 1.3.5-beta:

- Instance-level square-bracket array overrides did not preserve the array;
  the component's internal Template remained unresolved.
- Literal JSON array/object attributes caused a Twig fatal after quote
  escaping.
- Dotted object reads such as `[[props.meta.source]]` did not resolve.

Prefer a declared array prop with a global-binding default. When instances
need variation, pass a scalar selector and let the component query or derive
its own array.

## ACF and Meta Box

- ACF scalar: `acf_value(name: "field_name")`. Use field names, especially
  inside repeaters and groups; field-key lookup was inconsistent.
- ACF repeater: `acf_repeater_value(name: "rows") { child:
  acf_value(name: "child") }`, then bind a SubCollection to the alias.
- ACF group: use a direct group object or `acf_group_value`, selecting child
  fields by name.
- ACF options: query the Root against the actual value owner. A default ACF
  options store uses `options`, not the options page menu slug.
- Meta Box scalar: `metabox_value(field_id: "field_id")`. Multi-value fields
  can return arrays; verify and use `join`, `count` or a nested loop.
- Meta Box group: a direct object and `metabox_group_value` both worked.
- Meta Box settings: pass the runtime `option_name` owner, not necessarily the
  admin page slug. Discover helper names rather than guessing them.

For a selected custom post type by slug, an explicit `posts_query` with
`post_name__in` was more dependable than root `post(identifier: "slug", ...)`
in the verified fixtures.

## Relationships

Use ACF's typed resolvers when templates need related object fields or loops:

- `acf_relationship_value` for Relationship posts
- `acf_post_object_value` / `acf_post_objects_value`
- `acf_user_value` / `acf_users_value`
- `acf_taxonomy_value` / `acf_taxonomies_value`

Meta Box Relationships are registered objects, not ordinary
`metabox_value` fields, and no first-class relationship resolver was exposed
in the verified runtime. Wrap `MB_Relationships_API::get_connected()` in a
prefixed render-pure PHP function that returns plain arrays, then loop the
`php_function_output` result.

## Media and attachments

Respect ACF image/file/link return formats. For arrays, bind nested properties
or derive scalar aliases from a private raw field.

Native `has_featured_image` rendered safely, but selecting nested
`featured_image { ... }` collapsed the whole data variable in Builderius
1.3.5-beta. The verified fallback is a PHP wrapper that accepts a post ID and
returns plain arrays/scalars from:

- `get_post_thumbnail_id()` and `wp_get_attachment_image_src()`
- `_wp_attachment_image_alt`, caption, description, title and MIME type
- `wp_get_attachment_image_srcset()` and
  `wp_get_attachment_image_sizes()`
- `wp_get_attachment_metadata()` and selected named sizes

Expose stable keys such as `url`, `width`, `height`, `alt`, `caption`,
`description`, `title`, `mime_type`, `srcset`, `sizes_attr`, `sizes` and
`metadata`. An empty `srcset` is valid when WordPress has no responsive
candidates.

## Date and time

Treat display and storage values separately:

- ACF date pickers honour their configured display format, but store `Ymd`.
  Filter/order the raw meta with `meta_value` or `meta_value_num` and a
  `NUMERIC` comparison, for example `value: "20261001"`.
- Meta Box date/datetime fields can return stored strings such as
  `2026-09-01` and `2026-10-01 09:30`; compare compatible date strings with
  `type: "DATE"`.
- Compare Unix timestamps with `type: "NUMERIC"` and order with
  `meta_value_num`.

Never sort or filter on formatted display text. Derive display labels only
after the raw comparison value is selected.

## Falsey and empty values

Verified scalar behaviour is not normal JSON rendering:

- `false` and `true` rendered as visible words.
- Numeric `0`, string `"0"`, `null` and `""` rendered blank in text and
  attributes.
- `[]` rendered as `[]`; an empty PHP object rendered similarly in scalar
  output.
- `is_empty(false)`, `is_empty(0)` and `is_empty("0")` all reported empty.
- An expression whose final result was numeric zero also rendered blank.

When zero must be visible, return a labelled scalar such as
`"Count " ~ count(rows ?: [])`. Never bind unknown arrays/objects directly as
text; they can cause a Mustache/PHP type fatal. Expose explicit display aliases
such as `"[]"`, `"{}"` and `"0"`.

Empty array Collection sources render no rows. Reject or normalise every other
source type before binding a Collection.

## PHP escape hatch

Use `php_function_output` only for small, prefixed, allowlisted wrappers that
return plain scalars or arrays. Keep render-time functions pure. Builderius
forbids database writes during resolution, so option updates, post writes and
`set_transient()` can force the resolver to return its fallback. Cache outside
the render-time function when needed.

Never accept a user-controlled function name. Treat all arguments as
untrusted. For external APIs, use the WordPress HTTP API and keep credentials
outside GraphQL strings.

Missing PHP functions can cleanly return scalar or array fallbacks. Use
`fallback: []` for loop sources so a failure produces zero rows without
leaking the Template.

## Failure triage

Check in this order:

1. Read the saved variable and confirm the expected branch and query text.
2. Resolve it in context: `dbe/resolve-data-variable` names schema errors a
   save cannot catch and shows the runtime value; in a builder session use
   `get_dynamic_data { refresh: true }`.
3. Resolve every `dbe/apply-subtree-html` `binding_warning`. Malformed JSON,
   invalid URL sources and wrong Collection binding forms are known to warn
   before they leak unresolved Templates.
4. Run `dbe/check-rendered-output` — it scans for `<template>`, unresolved
   `[[...]]` and `{{...}}`, `Fatal error`, `Warning:`, missing expected text
   and blank labels in one authenticated fetch.
5. Split a combined query until the failing resolver branch is isolated.
6. Verify the source type at every Collection boundary with
   `dbe/inspect-binding-value` and add an explicit array fallback.

The same scan exists as a shell script for local files and cookie-jar fetches:

```bash
bin/check-dynamic-render.sh --insecure --cookie /path/to/cookies.txt \
  --expect "Expected row" --nonblank-label "Posts count:" \
  https://example.test/stress-page/
```

Both fail on unresolved bindings, leaked Templates, PHP warnings or
fatals, missing expected text and labels without a visible following value.

Important failure semantics:

- `dbe/manage-data-variable` can accept a bad nested GraphQL field that only
  fails at render. In the verified probe, a sibling count became blank and
  the row Template leaked unresolved.
- Direct binding of an `@private` field is blank, but a later
  `expression_result` may expose a derived alias. `@private` is an output
  control, not a secrecy boundary.
- A visibility condition affects the front end, not necessarily the builder
  canvas.
- `get_dynamic_data { refresh: true }` is the first response to stale values.

## Acceptance checks

When extending this skill, prove each new pattern with a disposable fixture,
a saved data variable, a rendered page and the scanner above. Useful coverage
includes:

- static repeat -> query-backed Collection
- terms -> posts and posts -> ACF repeater rows
- deep nested Collections in both directions
- recursive trees with allowlisted request-selected roots
- component prop defaults and instance overrides
- ACF/Meta Box groups, relationships, media and date fields
- false, zero, empty, null, array and object values
- missing PHP functions, bad GraphQL branches and malformed Collection sources

Document the smallest known-good pattern, the observed failure, the stable
fallback and the Builderius version. Do not promote an unrendered save or a
builder-only preview to a verified recipe.
