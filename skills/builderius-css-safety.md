---
name: builderius-css-safety
description: Read or change Builderius global CSS without destroying the framework, and recover if it has been clobbered. Activate BEFORE any global CSS work (fonts, tokens, framework additions) — the naive write path replaces the ENTIRE stylesheet.
---

# Global CSS safety in Builderius

On a Builderius site the "global CSS" **is** the whole design system: the
reset, every `--color-*` / `--spacing-*` token, `.container`, `.button`, the
grid utilities. One wrong write loses all of it.

## The hazard

`update_global_css` (builder MCP) **replaces the entire global stylesheet;
it is not additive.** Writing "just a small `@font-face` block" through it
wipes the framework — every page loses its layout, and entity CSS is left
referencing undefined variables. There is no `get_global_css` tool to warn
you; the read path is `get_css_framework { includeRawCss: true }` →
"Framework Raw CSS".

## Safe paths (prefer the DBE abilities)

- **Read**: `dbe/get-global-css` — the saved stylesheet plus its named
  blocks. Pass `block` to fetch one block's body (much cheaper than the
  whole ~50 KB sheet).
- **Write**: `dbe/patch-global-css` — edits exactly ONE named block, a
  region fenced by `/* @block: name */ … /* @endblock */`. Everything
  outside the block is preserved byte-for-byte, so the framework cannot be
  clobbered. A new block name is appended at the end. Supports `delete` and
  `dry_run`. Each write is its own commit with a descriptive message.
- Typical use — brand fonts: patch a `fonts` block containing the
  `@font-face` rules plus a `:root` override of `--heading-font-family` /
  `--body-font-family`. The framework already applies those variables to
  headings and `body`, so redefining them is enough.
- Saving is not publishing: run `dbe/publish` for the change to reach the
  front end (see the builderius-save-publish skill).

If you must use `update_global_css` (no DBE on the site): read the full
"Framework Raw CSS" first, append your additions to that captured block,
and write back **framework + additions**, never additions alone.

## Recovery — the framework has been wiped

Builderius is git-backed; the pre-damage stylesheet survives in an earlier
commit of the global settings set.

1. `dbe/list-commits { target: "global" }` — each row carries
   `css_length`; the clobber is the sudden drop (tens of KB → a few hundred
   bytes). The last healthy commit is the one before the drop.
2. `dbe/restore-global-css-from-commit { commit: "<name>", dry_run: true }`
   — check the length and preview look right.
3. Re-run without `dry_run`. The rollback is saved as a NEW commit (history
   keeps the accident too), then `dbe/publish` to make it live.

## Entity CSS still follows the tiers

This skill covers the global sheet only. For section styling, the normal
cascade applies: framework classes first (`get_css_framework` + search →
`manage_module_class`), then named entity classes via `update_entity_css`
(which is ALSO replace-all — read entity CSS first and append), and
per-module `%local%` CSS never, unless explicitly requested. Always use
framework variables, never raw values.
