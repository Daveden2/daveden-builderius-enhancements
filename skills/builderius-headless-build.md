---
name: builderius-headless-build
description: Build complete Builderius pages through the dbe/* abilities alone — no builder tab, no Sense AI MCP. Activate FIRST for any Builderius work over MCP when the DBE plugin is on the site; it maps every job to its ability and links the focused skills, so you load only what the task needs.
---

# Headless Builderius builds (the dbe/* ability map)

Everything below runs server-side against the **saved state** through
Builderius' own mutations. No builder tab needs to be open; an open tab
will not see your commits until reloaded, and its stale save can overwrite
yours — the dirty-tab preflight blocks that unless you pass `force: true`.

## Ability map — one line each

**Templates**
- `dbe/get-template-settings` — title/slug/enabled/type/sort order/apply
  rules + branch/commit. Omit `template` for all.
- `dbe/create-template` — regular/doc/hook templates by `title`; **page
  templates by `page_id`** (title, slug and the one-page apply rule derive
  from the WP page). New templates start with header/footer components and
  an empty `<main>`.
- `dbe/update-template` — only passed fields change; a title-only update
  keeps the slug; type page/doc changes re-term correctly.
- `dbe/duplicate-template` — an isolated working copy (content, entity CSS,
  variables, snippets); born disabled with no apply rules unless asked.
- `dbe/delete-template` — permanent (branches + history); `confirm: true`.

**Structure** (see `builderius-subtree-html`)
- `dbe/get-tree-outline` → `dbe/get-subtree-html` → `dbe/apply-subtree-html`
  (dry run first, then save with `expected_commit`).
- When authoring new markup, add concise `data-dbe-label` values to meaningful
  sections, layout groups, loops, controls and key content so the finished
  Navigator is easy to scan. The subtree skill contains the naming rules.
- `dbe/manage-visibility-condition` — get/set/clear an element's rendering
  conditions (OR-of-AND `groups` of `{name, operator, value}` rules, validated
  against the installed registry); subtree HTML preserves conditions but
  cannot express them.

**CSS** (see `builderius-css-safety`)
- Template-scoped: `dbe/get-entity-css` / `dbe/patch-entity-css` — named
  blocks; this is where per-template CSS belongs.
- Global: `dbe/get-global-css` / `dbe/patch-global-css` — one named block
  per patch, framework preserved; `dbe/restore-global-css-from-commit`
  recovers a clobber.
- `dbe/get-rendered-styles` — the entity + global rules matching one module
  (with media context) when no builder tab exists for computed styles.
- `dbe/list-settings-sets` / `dbe/manage-settings-set` — discover the global
  settings sets; read/update breakpoints, responsive strategy and fonts
  (site-wide impact — read first, expected_commit to save).

**Dynamic data** (see `builderius-dynamic-data`)
- `dbe/get-data-variables` / `dbe/manage-data-variable` — global scope
  (default) drives Collections; entity scope via `template`. snake_case
  names; GraphQL syntax checked at save; the system `wp` variable needs
  `allow_system: true` and can never be renamed or deleted.
- Verification quartet: `dbe/get-dynamic-data-schema` (live schema, no
  builder tab) → `dbe/resolve-data-variable` (schema-validate AND resolve in
  a page context) → `dbe/inspect-binding-value` (is this path a safe
  Collection source?) → `dbe/check-rendered-output` /
  `dbe/check-render-scenarios` (prove the render, including query-parameter
  and cookie matrices).
- `dbe/resolve-metabox-field` — map a Meta Box field id/label to its exact
  GraphQL read recipe and the builder's auto-helper name; don't guess.

**JavaScript**
- `dbe/get-js-snippets` / `dbe/manage-js-snippet` — global (site-wide) or
  per-template. snake_case labels; defaults external file + footer +
  enabled. Vanilla JS in a DOMContentLoaded wrapper, event delegation on
  `data-*` hooks, CSS state classes — never inline styles from JS.
- `dbe/validate-js-snippet` — structural check (unbalanced/unterminated
  syntax, pasted HTML) before manage-js-snippet saves.

**Components** (see `builderius-components`)
- `dbe/list-components` / `dbe/create-component` /
  `dbe/manage-component-property` / `dbe/delete-component`; instances are
  placed as `<dbe-component name="slug" prop="value">` in apply-subtree-html.
- Before authoring repeated UI, run the component decision: reuse an existing
  semantic component or create one with inferred text/select/boolean props.
  Repeated static rows should normally become one component Collection backed
  by a small global JSON variable, not duplicated module trees.
- `dbe/duplicate-component` — fork a shared component (props included)
  before an experiment; instances keep pointing at the source.

**State & go-live** (see `builderius-save-publish`)
- `dbe/status` — saved vs published per entity; `dbe/list-commits` — audit
  trail; `dbe/publish` — select pages/templates, add release tags, preview the
  automatically included components/global settings, then go live **only on
  explicit user approval**.

## The build loop for a new page

1. `dbe/create-template` (with `page_id` for a one-page template, or
   `apply_rules` for a location) — enabled from birth, but nothing public
   until publish.
2. `dbe/get-subtree-html` → author the whole page structure in ONE
   `dbe/apply-subtree-html` call (dry run, then save). Give meaningful new
   elements Navigator labels and bind data with Collection loops where content
   is dynamic.
3. `dbe/patch-entity-css` for the page's styles, in named blocks.
4. Verify the REAL page: `dbe/check-rendered-output` fetches it as a
   logged-in user (saved commits render for logged-in users — no publish
   needed) and scans for leaked Templates, unresolved bindings, PHP errors,
   expected text and blank labels.
5. `dbe/publish` only when the user says go.

## The save contract (applies to every writing ability)

Read (or dry-run) first; pass the returned `commit_name`/`base_commit` as
`expected_commit` when saving. A stale value fails `dbe_commit_conflict` —
re-read, rebase your change, retry. Never loop blindly on `force: true`.

## Gotchas that cost real time

- **Save ≠ publish**: logged-out visitors only see published releases.
  A "blank page" is usually a missing release or a logged-out check.
- Builder-tab saves rewrite global settings from the editor store —
  template-scoped CSS belongs in ENTITY CSS, and expect to re-patch global
  blocks after a tab save.
- snake_case everywhere the builder UI edits a name: data variables, JS
  snippet labels, component slugs and props.
- Whitespace quirk: end an element's leading text with `&#160;` before an
  inline child, and keep trailing punctuation inside the last inline
  element.
- Never store `aria-*`/`focusable` inside SVG markup — wrap decorative
  icons in `<span aria-hidden="true">` instead.
