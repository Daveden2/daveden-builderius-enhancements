---
name: builderius-css-safety
description: Read or change Builderius global and entity CSS without destroying the framework, and recover if it has been clobbered. Activate BEFORE any global CSS work (fonts, tokens, framework additions) — the naive write path replaces the ENTIRE stylesheet.
---

# CSS safety in Builderius

On a Builderius site the "global CSS" **is** the whole design system: the
reset, every `--color-*` / `--spacing-*` token, `.container`, `.button`, the
grid utilities. One wrong write loses all of it.

## The hazard

`update_global_css` (builder MCP) **replaces the entire global stylesheet;
it is not additive.** Writing "just a small `@font-face` block" through it
wipes the framework — every page loses its layout, and entity CSS is left
referencing undefined variables. There is no `get_global_css` tool to warn
you; the read path is `get_css_framework { includeRawCss: true }` →
"Framework Raw CSS". (`update_entity_css` is replace-all in the same way.)

## Safe paths (prefer the DBE abilities)

- **Read**: `dbe/get-global-css` / `dbe/get-entity-css` — the saved
  stylesheet plus its named blocks. Pass `block` to fetch one block's body
  (much cheaper than the whole sheet).
- **Write**: `dbe/patch-global-css` / `dbe/patch-entity-css` — each edits
  exactly ONE named block, a region fenced by
  `/* @block: name */ … /* @endblock */`. Everything outside the block is
  preserved byte-for-byte, so the framework (or hand-written entity CSS)
  cannot be clobbered. A new block name is appended at the end; a template
  with no entity CSS gets one created. Both support `delete` and `dry_run`,
  and each write is its own described commit.
- **Real saves require `expected_commit`** — the commit name returned by the
  preceding read or dry run. Without it the save fails
  `dbe_expected_commit_required`; a stale one fails `dbe_commit_conflict`
  (re-read and retry). While any builder tab has unsaved changes, saves also
  fail `dbe_builder_tab_conflict` (dry runs still work) — get the tab saved
  or discarded, or pass `force: true` only on explicit user approval.
- **Blocks survive builder saves.** DBE's CSS guard (css_block_guard
  feature, on by default) re-attaches any fenced block that a builder save
  would silently drop — the builder's editor store never contains
  ability-added blocks, and without the guard the next save of ANY template
  (or a global data variable change) wiped them. Because of the guard,
  **removing a block must go through the ability's `delete: true`** —
  hand-deleting the fenced region in the builder's CSS editor will be
  undone on the next save.
- Typical use — brand fonts: patch a `fonts` block containing the
  `@font-face` rules plus a `:root` override of `--heading-font-family` /
  `--body-font-family`. The framework already applies those variables to
  headings and `body`, so redefining them is enough.
- Saving is not publishing: `dbe/publish` makes changes visible to
  logged-out visitors; a logged-in user already sees saved commits (see the
  builderius-save-publish skill).

If you must use `update_global_css` (no DBE on the site): read the full
"Framework Raw CSS" first, append your additions to that captured block,
and write back **framework + additions**, never additions alone — and know
that your additions will NOT survive later builder saves without the guard.

## Recovery — the framework has been wiped

Builderius is git-backed; the pre-damage stylesheet survives in an earlier
commit of the global settings set.

1. `dbe/list-commits { target: "global" }` — each row carries
   `css_length`; the clobber is the sudden drop (tens of KB → a few hundred
   bytes). The last healthy commit is the one before the drop.
2. `dbe/restore-global-css-from-commit { commit: "<name>", dry_run: true }`
   — check the length and preview look right; note the `base_commit`.
3. Re-run without `dry_run`, passing that `base_commit` as
   `expected_commit`. The rollback is saved as a NEW commit (history keeps
   the accident too), then `dbe/publish` if the public site needs it.

## Entity CSS still follows the tiers

For section styling, the normal cascade applies: framework classes first
(`get_css_framework` + search → `manage_module_class`), then named entity
classes — via `dbe/patch-entity-css` when working ability-side, or
`update_entity_css` in a live builder session (replace-all: read entity CSS
first and append) — and per-module `%local%` CSS never, unless explicitly
requested. Always use framework variables, never raw values.
