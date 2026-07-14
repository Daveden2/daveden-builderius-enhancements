# Changelog — full detail

The plugin `readme.txt` carries a concise summary of each release for users.
This file keeps the full, detailed notes.

## 1.13.0
Navigator row quick actions (issue #54) — inline Duplicate and Delete on
Navigator rows, requested as the Bricks-style hover icons but built so
keyboard and screen-reader users get the same shortcut.

* Added (#54): a new **Navigator row quick actions** feature (Navigator tab,
  on by default). Duplicate and Delete buttons appear at the right edge of a
  Navigator row on pointer hover or keyboard focus. Both actions drive the
  native context-menu channels (`Duplicate` / `Remove`), so rendering, save
  state and the undo-delete capture behave exactly as if the menu had been
  used; deletes stay undoable with Ctrl/Cmd+Z while Undo delete is on.
* The implementation deliberately differs from the Bricks reference (mouse-
  only list items injected inside every row, no roles, no keyboard path):
  Builderius rows are themselves `<button>` elements inside the ARIA tree the
  Navigator keyboard feature maintains, so per-row injection would nest
  buttons inside buttons and pollute the tree semantics, and React re-renders
  would wipe the injected nodes. Instead ONE floating cluster of two real
  buttons lives after the tree scroller in DOM order — Tab from a focused row
  reaches Duplicate then Delete, Escape returns to the row — and is overlaid
  on the target row's right edge.
* Positioning is a progressive enhancement: browsers with CSS anchor
  positioning track the row (and tree scrolling, via `position-visibility`)
  natively; others take a `getBoundingClientRect` fallback with a scroll
  clamp that blanks the cluster while its row is outside the scrollport.
* Accessible names carry the target element's label ("Duplicate “Hero”",
  read from the store, not the badge-decorated row text) and update as the
  target changes; outcomes are announced through the existing polite status
  toast ("Duplicated element" / "Deleted element"); nothing is announced on
  mere show/hide. After duplicating, focus lands on the copy's row; after
  deleting, on the next row outside the removed subtree (else the previous
  row, else the parent), matching the WordPress list-view shape.
* Delete is two-step, matching the native footer delete's arm-then-confirm
  pattern: the first activation renames the button to "Confirm delete “X”",
  paints it solid red and announces "Press again to confirm" through the
  status toast; the second performs the delete. It stands down after four
  seconds, when the cluster retargets or hides, or on Escape (a second
  Escape then returns focus to the row as usual).
* A **Show the buttons** sub-setting picks between "On hover or keyboard
  focus" (default) and "Always, on the selected row", which keeps the cluster
  pinned to the selection.
* The cluster yields to the real right-click menu, hides during row drags and
  while inline rename is active, and survives React re-renders by re-resolving
  its target row by node id on every tick. New `--dbe-danger` token (both
  themes, AA on the raised surface) gives Delete its destructive hover/focus
  state.
* With the Navigator keyboard tree feature off, rows are still natively
  focusable so the buttons still appear on focus; without the roving tab stop,
  Tab only reaches the cluster after the last row — turn Navigator keyboard
  tree on for the intended row → Tab → actions flow.
* Fixed: in the light theme, an element's display-conditions view (the
  settings panel's conditions mode) rendered dark-on-dark: the "New
  condition" button, the condition cards (resting and editing), the
  group/rule separator bars and the date/time inputs all kept their native
  dark-scale surfaces (`--primary-1/2`, `--black-alt-1`) while the remapped
  foreground went light-theme dark (the button computed to roughly 1.1:1).
  A new leak-audit pass in 60-theme.css repaints those surfaces from the
  theme tokens, pins the chip's accent hover to the light-legible accent,
  and un-inverts the date/time picker glyph. The dark theme is untouched.
* Fixed: the conditions-view light-theme pass now also covers the field
  controls a chosen condition reveals — the `builderiusSelect` operator
  select ("Equals…", computed to roughly 1.5:1 on its native near-black
  fill), the `builderiusMultiSelect` value pickers and their dropdown
  lists, the select-with-free-input variants and their toggles. The
  family's native focus cue (a mid-tone accent border, under 3:1 on light
  surfaces) is pinned to the light theme's darker accent.
* Added (#54 follow-up): a **Display-condition helpers** feature (Editing
  tab, on by default), the attr_helpers pattern applied to conditions:
  - Opening the conditions mode on an element with none seeds a blank,
    ready-to-choose condition card (focused only when you are already
    working in the settings panel — never stolen from the Navigator).
    The native "New condition" click writes a placeholder rule into the
    element's `visibilityCondition` setting immediately, so a seeded card
    the user never interacted with is removed again on leaving: through
    its own X while it is still mounted, or through the settings upsert
    channel when the panel moved on first — either way the element is
    left exactly as it was. Any pointer or key interaction inside the
    card disarms the auto-clean (the store test alone raced the async
    type commit — observed with Dynamic data, whose chosen card was
    briefly indistinguishable from an untouched one and got removed).
    Seeding fires only when the view opens, never while browsing
    elements with the (sticky) view already open.
  - Every condition field gets a real accessible name: the per-card
    remove button ("Remove condition"), the comparison select, the value
    inputs (from their placeholder), the free-input toggles, and each
    checkbox in the multi-value pickers (from its option's text).
  - The multi-value pickers (`builderiusMultiSelect`) were mouse-only —
    an unfocusable div trigger. They are now wired as comboboxes: the
    trigger is a tab stop announcing its field and chosen values,
    Enter/Space/ArrowDown open it and focus the first option, the
    options are real checkboxes (Space ticks, Tab or arrows move), and
    Escape closes and returns to the trigger.
  - Elements that carry conditions are marked: the conditions-mode
    header button gains a dot and announces the count ("Dynamic data
    conditions (2 set)"), and their Navigator rows gain a dot with a
    visually-hidden ", has display conditions" suffix for screen
    readers. The row marks survive React re-renders (re-applied per
    tick, the tag-badge precedent).
* Docs: readme.txt reorganised to the WordPress plugin handbook layout —
  proper header fields (Tags, License URI), a ≤150-character short
  description, Description / Installation / FAQ / Upgrade Notice sections,
  and a changelog trimmed to recent releases (this file remains the full
  history). Feature suggestions now carry props, starting with
  TRẦN ĐỨC LƯƠNG (@evanscliff) for the row quick actions.

## 1.12.4
Repairs for the CSS vars tab (a 1.12.1 regression) and the detachable
Navigator's canvas reclaim, plus community label polish.

* Fixed (#49): opening the Navigator's CSS vars tab hid the left settings
  panel and dropped every panel-width pin, flickering the right panel's
  width. Builderius collapses the LEFT panel on its own for that tab
  (inline zero widths, with the right wrapper widened to 600px), and the
  1.12.1 hide-side-panels detection read the left wrapper alone — so the
  tab switch was mistaken for the native toggle and `dbe-panels-hidden`
  went up. The real toggle zeroes BOTH wrappers (verified live), so
  detection now requires both; the CSS vars clamp in 11-tabs.css also
  gained the `html:not(.dbe-panels-hidden)` scope every other width pin
  already has, so the genuine toggle is no longer defeated on that tab.
* Fixed (#51): detaching the Navigator while the CSS vars tab was open
  left the canvas squeezed at the docked reserve and pinned the float to
  the docked width — the CSS vars clamp carries one more class than
  76-panel-detach's float and reclaim rules and out-specified them. The
  clamp now stands down under `body:not(.dbe-nav-detached)`.
* Improved (#51): the canvas reclaim on detach/dock now animates on the
  same .25s ease the docked panel already uses instead of snapping (with
  a `prefers-reduced-motion` opt-out; panel-resize drags still suspend
  the transition), and the preview handles' ARIA range follows the
  canvas maximum when it moves — `dbeSyncHandleAria` is write-on-change
  and re-runs from `schedule()`, with detach/dock triggering a resync
  immediately and again once the transition settles.
* Changed (#50): the keyboard-shortcuts overlay renders every combo for
  the viewer's own platform through the same `dbeAccel` helper the
  context-menu hints use — the Mac glyph stack (⇧⌘D, ⌥⌘T) there,
  Ctrl+Shift+D / Ctrl+Alt+T elsewhere — replacing the dual
  "Cmd/Ctrl+Alt" spelling. The settings-page feature description, which
  is server-rendered for every platform, keeps the dual convention but
  now says "Opt/Alt" (the Mac key is Option, not Alt).
* Fixed: the shortcuts overlay still advertised the Cmd/Ctrl+click and
  Shift+click multi-selection rows (and Esc's "clear the
  multi-selection" clause) although multi_select was withdrawn from the
  registry on 6 Jul 2026 — the rows described shortcuts that do
  nothing. They are now gated on the feature and return with it.
* Changed (#52): the Auto-BEM item in the elements context menu and all
  five command-palette entries drop their ellipses (community
  suggestion), and the palette's Add entries are pluralised — Add
  classes / Add attributes / Add elements (Emmet) — since each input
  accepts several at once. The redundant `autoBemMenu`, `paletteRename`
  and `paletteAutoBem` strings are removed (the palette reuses
  `rename`/`autoBem`), and the palette-shortcut description in the
  overlay says "add classes / attributes / elements" to match. Submenu
  items (Wrap in…, Save to…) keep their ellipses.

## 1.12.3
Hotfixes: the 1.12.0 dedup left every injected context-menu action dead,
the menu-driver behind Cut raced the closing menu, and the light theme
drew the Sonner toasts dark-on-dark.

* Fixed: the 1.12.0 "verified-safe fixes" pass deduplicated each injected
  menu item's inline close recipe (`removeSubmenus()` + the native
  `builderius.contextMenu.hide` action) into one shared `closeCtxMenu()` —
  but the helper's body was the recursive call `closeCtxMenu()` instead of
  the recipe, so every activation that ended with it threw "Maximum call
  stack size exceeded" and stopped there: Auto-BEM, Rename, Reset label,
  Wrap in / Unwrap, Expand children, Move up/down and Select parent all did
  nothing, with the native menu left open. The helper now performs the
  close recipe it was extracted to hold.
* Fixed: context-menu Cut (= driven native Copy then Remove) did nothing,
  or occasionally pasted a stray copy. `driveContextMenuItem` dispatched
  its synthetic contextmenu while the visible menu could still be open, so
  the poll found the old ENRICHED dialog: the exact-label match failed on
  rows carrying accel hints ("Copy" reads "Copy⌘C"), and React recycles
  the reused dialog's rows, so the node found as "Copy" could be another
  item by the time the click landed. The driver now closes any open menu
  and waits for it to unmount before opening its own, and the label match
  ignores the injected `.dbe-ctx-accel` hint. Benefits every drive user:
  ctx-menu Cut, the palette element ops and undo's forged Paste.
* Fixed (theme, light): the native Sonner toasts ("Template saved",
  "Copied …") pair a `--contrast` (#000) card with `--base-2` text, which
  the light remap turns near-black — dark-on-dark. The light theme now
  gives the card a token surface (`--dbe-l2` + hairlines on three edges,
  the left edge stays the native status strip). Dark theme untouched.

## 1.12.2
A multisite activation fix (#45), two favourites bar repairs, and a new
screen-reader landmarks feature.

* Fixed (#45): WordPress loads network-activated plugins before per-site
  ones, so on a multisite with DBE network-active and Builderius activated
  per site, the load-time `function_exists( 'builderius_get_version' )`
  check ran before Builderius had loaded and DBE went dormant on every
  subsite, warning that Builderius was inactive. The include decision now
  runs in `dbe_bootstrap()` on `plugins_loaded` priority 0, by which point
  every active plugin has loaded regardless of the activation mix; all the
  gated hooks (`wp_head`, `wp_footer`, `admin_bar_menu`, `admin_notices`)
  fire later still.
* Fixed (theme, light): each `.uniModTree__favouritesListItem` keeps its
  native dark-scale border (`--primary-2`, near-black), a heavy outline on
  the light panel. Leak audit pass 16 softens it to the theme hairline
  (`--dbe-line`); the dark theme keeps the native value.
* Fixed (nav layout): the favourites strip is a flex column of fixed-size
  icons with visible overflow, so when the Navigator loses height (Sense AI
  or another footer panel expanded) the icons spilt over the tree footer's
  delete and edit-favourites buttons and on under the footer bar. The strip
  now scrolls within the remaining height. Two traps: one overflow axis set
  to auto computes the other to auto as well, and the resulting scrollbar
  squeezed the 26px icons inside the ~31px strip, so the scrollbar is hidden
  (wheel, drag and focus-driven scrolling still work, and the icon clipped
  at the edge shows there is more below); and overflow other than visible
  drops the strip's min-content width floor in the container's row layout,
  so its width is pinned with `flex: 0 0 auto`.
* New (chrome_landmarks, on by default): named landmark regions for the
  builder chrome, the way the WordPress block editor exposes its regions.
  Stamped each schedule() tick, attributes written only when they differ:
  Top toolbar, Element library / Element settings (the left panel is
  contextual, so its label is re-read from what it currently holds), Canvas,
  Navigator and Footer bar. `role="region"` is only a landmark when named,
  so every stamp pairs the role with an `aria-label`. Rode along: the footer
  tools panel (footer_toolbar) is demoted from `role="region"` to a labelled
  `role="group"`, so the footer contributes exactly one landmark; the name
  still announces on entry and the `aria-controls` wiring is unchanged.

## 1.12.1
Fixes around the native "hide side panels" toggle, an opt-in Save-menu
keyboard route, and concise settings copy. PRs #41–#43.

* Fixed: native "hide side panels" collapses both panel wrappers with INLINE
  width/min/max-width: 0 — and two DBE stylesheets pinned exactly those
  properties with !important (75-panel-resize.css deliberately beats the
  native resize bar; 40-css-code-default.css clamps CSS-mode's 600px
  auto-widen), so the toggle went inert. builder.js now mirrors the native
  state onto html.dbe-panels-hidden (detected from the inline max-width: 0 on
  .uniLeftPanelOuter — no class appears anywhere natively), synced whenever
  panel_resize OR css_code_default is on, and every width pin in both files
  is scoped to :not(.dbe-panels-hidden). The drag grips hide with the panels.
* Fixed (preview_resize): while the panels are hidden, Builderius pins the
  canvas to width:100% and IGNORES the numeric width channel (the readout and
  breakpoint band update, the canvas never resizes) — handing the drag to
  that channel below the widest breakpoint collapsed the canvas to nothing.
  While hidden, dbeApplyPreviewWidth now owns the width across the whole
  range through the inline+guard channel and keeps the breakpoint band in
  step by clicking the button whose range covers the width.
* New (save_split_button — experimental, OFF by default): the Save button's
  dropdown trigger is a div INSIDE the <button> (invalid nesting, mouse-only,
  reported upstream). Opt-in stopgap: a real sibling "Save options" menu
  button (aria-haspopup + live aria-expanded, native caret svg, colours and
  height mirrored from the Save button's computed box each tick, flex-pinned
  against the top bar's 4px-gap row), the native strip hidden, the menu
  dialog anchored right-aligned under the button (its native placement uses
  the click event's clientX/Y — programmatic opens need coordinate-carrying
  events), focus on the first enabled item, arrows/Home/End/Enter inside,
  disabled items focusable and announced, Escape native. With the toggle off
  the Save button is byte-for-byte native — the feature CSS is not even
  emitted. Rode along: the Unsaved cue no longer rebaselines on caret clicks.
* Improved: every registry entry gains a one-line `summary`; the settings
  screen shows it under the title with the full description behind an info
  disclosure (aria-expanded/aria-controls, 24px target, "More about <title>"
  name). Progressive enhancement matches the tab bar: no JavaScript = full
  descriptions visible, buttons hidden. aria-describedby now points at the
  summary.

## 1.12.0
Cmd/Ctrl+S to save, cacheable chrome-script delivery, the auto theme resolved
at bootstrap, plugin-wide reduced-motion support, a hot-path performance pass,
nine robustness fixes, ARIA structure polish, and two new CI gates. PRs #31,
#33–#39.

* New (save_shortcut): Cmd/Ctrl+S saves the template. Capture-phase and
  deliberately not gated on inputs or the code editors (matching the WordPress
  block editor); acts — and suppresses the browser's save-page dialog — only
  when the native Save button is present. Targets `.uniPanelButtonPrimary.saveBtn`
  specifically: the breakpoints modal mounts an earlier, disabled primary Save
  that a bare class selector would hit (the save cue was re-anchored to the
  same selector). With no unsaved changes Builderius wires the button's
  onClick as a no-op, so a clean-template press is intentionally inert.
* Improved: builder.js is delivered as a printed `<script src>` versioned by
  filemtime instead of ~400 KB inlined into every builder page. Verified live:
  first load 107 KB gzip, reload a ~300-byte revalidation; no enqueue
  machinery, so builder mode's foreign-hook stripping has nothing to strip.
  The config object stays inline.
* Improved (theme_switcher): the auto MODE is resolved to a concrete
  light/dark by the head bootstrap before first paint, with a matchMedia
  listener re-resolving live. `data-dbe-theme` now only ever holds the
  resolved value; the chosen mode moved to `data-dbe-theme-mode` (same
  `dbeBuilderTheme` storage key, so saved preferences keep their meaning).
  Deletes all 74 light+auto selector pairs, the duplicated auto-dark palette
  and the Monaco auto media block (−168 lines); auto-under-a-dark-OS is now
  byte-identical to the dark theme, where it was previously approximate.
  Note: any user CSS targeting `[data-dbe-theme="auto"]` no longer matches.
* Improved: reduced motion. `--dbe-t` (and the panel-detach `--dbe-speed`)
  are zeroed under `prefers-reduced-motion: reduce` in 00-tokens.css, which
  ships whenever any feature is on; files with motion outside the tokens keep
  their own guards.
* Improved: hot-path performance on the schedule() tick, verified live on a
  149-row template. navSyncAria is one top-down traversal (levels from
  parent+1, sibling counts once per list, wrappers stamped once, structural
  visibility instead of offsetParent reads); the breakpoints fiber scan is
  cached and invalidated by Builderius' own breakpoint actions; scope
  isolation memoises its stylesheet parse; the tree filter early-outs when
  idle; tag badges use one lazy canvas pass; the favourites/properties drags
  are rAF-gated; Auto-BEM and undo-capture subtree walks use an O(n)
  parent→children index instead of per-node scans.
* Fixed: nine robustness gaps. Rename guards self-heal when a re-render
  detaches the input (undo/redo, Escape, F2 and the palette no longer go
  quiet); the save cue's baseline reset is delegated to document so a Save
  button remount cannot wedge it; attr_helpers strips its seeded blank
  attribute through the settings channel when the panel unmounts first; the
  footer bar/panel observers are shared and node-tracked (they doubled up and
  their done-once flags outlived replaced nodes); the navigator keydown flag
  lives on the panel node; the dead window.monaco theming path is removed
  (the CSS invert IS the light theme — setTheme underneath it would invert
  the editor back to dark); the All CSS flash poll is generation-counted;
  combobox keyboard-open polls via waitFor instead of a fixed 60 ms delay;
  missing null/Element guards in the Emmet insert and chip-menu Escape.
* Fixed: ARIA structure. Presentational <li> wrappers restore the
  listbox→option chain in the element picker and command palette; the
  class-chip menu gains an accessible name, click (not mousedown) activation,
  a correct ArrowUp wrap and Home/End; the tag/class select listboxes mint
  per-widget ids so aria-controls can never be ambiguous; the admin settings
  tabs complete the APG pattern with panel ids + aria-controls; the
  preview-overlay observer patches overlays nested in added subtrees.
* Changed: the release tail is automated — merging the release PR tags main's
  tip, creates the GitHub release with notes from readme.txt and attaches the
  zip (auto-release.yml), with release-check gating the PR for a complete,
  consistent version bump. ESLint + Stylelint now lint assets/ in CI (they
  caught two real var redeclarations on day one); shared infrastructure CSS
  is declared per-feature in the registry (shared_css) and
  dbe_builder_css_files() is a plain registry fold, proven output-identical;
  uninstall removes the update checker's options row; RELEASING.md documents
  the automated flow and the hotfix path; the zip no longer ships
  RELEASING.md, docs/, composer or npm tooling files.

## 1.11.0
A new "All CSS" jump in the CSS scope bar, plus light-theme polish across the
Navigator and Styles panel and find-widget fixes in the CSS code editor.

* New (scope_bar): an "All CSS" button beside the Global/Template switch opens the
  full stylesheet for the active scope — the same view as the Navigator's
  Selectors → All CSS — and flashes the current selector's rule so you can see
  where it sits among everything else. The scope bar lives in the element's Styles
  editor while the All CSS view lives in the Selectors tab (separate panels), so
  the button drives the route for you: open Selectors, pick the selector (which
  mounts the Selector CSS | All CSS sub-tabs, re-clicking through the list's
  post-navigation re-renders), switch to All CSS, then reveal-and-highlight the
  rule via Builderius' exposed Monaco API (window.monaco is not global;
  window.Builderius.API.monaco is). It follows the active Global/Template scope
  (shared store value) and is disabled at the local %local% level, which has no
  shared rule to jump to. The control is the Builderius CSS-file glyph (cloned
  from the native CSS-mode icon) so the scope switch keeps its full label width;
  its accessible name and tooltip carry the "All CSS" label.
* Fixed: Navigator tree rows drew a hard black border in the light theme. Stock
  borders the rows in --primary-2 (#2e2f32), which vanishes into the dark rows
  but reads as a heavy black box on the light theme's white rows. The resting
  border is softened to the hairline token so the row label carries the
  attention, matching how the border recedes in dark mode. Light/auto only, and
  not forced — stock's stateful recolours (the selected row's accent border,
  drag activation) still win.
* Fixed: the class-name chips in the Styles panel sat on borderline contrast.
  The selected/active chip was near-black text on the mid-tone --accent-normal
  (~6:1) and the applied-class ("others") chips were --dbe-text-2 on the grey
  --dbe-line-hi (~6:1) — both technically AA but weak. The active chip is now a
  filled darkened-accent pill with white text (~6.5:1, and clearly distinct from
  the grey chips), and the other chips use the strongest text token (~9.4:1).
  The active chip's :hover is pinned to the strong fill so hover no longer drops
  it back to the light accent (which would have sunk the white text to ~2.8:1).
  Light and auto themes only; dark is untouched.
* Fixed: the find widget's search field was badly cramped. Below ~411px of
  editor width Monaco collapses the widget and pins it to 170px, which in the
  clamped-narrow Styles panel squeezed the input down to ~46px. It is now
  re-clamped to the panel's own width (input ~95px at the default width, wider
  as the panel grows); a widened panel (Resizable side panels) clears Monaco's
  threshold and keeps the full-size widget untouched.
* Fixed: the find widget's search field showed as a dark box in the light theme.
  The field is a `<textarea class="input">`, which slipped past the `.inputarea`
  exemption in the control styling and inherited the panel's light `--dbe-l2`
  fill; the editor's light theme then inverts its pixels, turning that fill
  near-black. Monaco's own inputs are now left to Monaco's chrome, so the field
  inverts in step with the rest of the widget (and stays correct in dark mode).
* Fixed: the canvas preview took the builder's colour scheme. `color-scheme` is
  set per theme (in 00-tokens.css) for native controls, but it inherits — so it
  reached the preview `<iframe>` element, and a page with a transparent
  background then painted on the dark UA backdrop in the dark theme, unlike the
  front end. Reset to `color-scheme: normal` on `.uniIframePanel iframe` so the
  previewed page renders in its own scheme, matching the published site.

## 1.10.1
A packaging fix. Three commits landed on `main` immediately after the `v1.10.0`
tag was cut, so they were merged into the branch but never included in the
`v1.10.0` release zip (which is built from the tag). This release re-cuts the
package from the full `main` so those changes actually ship. There is no new
feature work here beyond what 1.10.0 was meant to contain.

* Command palette: commands are grouped under labelled dividers (Add to element,
  Structure, Element, Go to); an empty group's divider hides while filtering. Adds
  the commands the palette was missing next to the context menu — Copy, Auto-BEM,
  and Wrap in a div / figure / template / collection (gated on the `wrap_in` and
  `auto_bem` features). Each command shows its keyboard shortcut right-aligned,
  mirroring the block editor.
* Right-click menu: the keyboard shortcut is shown, right-aligned, on both the
  injected rows (Cut, Rename, Add before / after) and the native rows (Duplicate,
  Copy, Paste, Remove). Native hints are appended after the menu is assembled so
  the hint text never corrupts the textContent the clustering and Remove-last
  layout depend on.
* Section quick-add: a Section added through the quick element picker now inserts
  the native Builderius structure — `section > div.container[data-container="true"]`
  — as the section's first child, so it is laid out and ready to fill like the
  native inserter's Section instead of a bare full-bleed section.
* Panel tabs: clicking a Content/Styles or Elements/Selectors/CSS-vars tab now
  restores focus to the freshly mounted active tab (Builderius suppresses
  focus-on-click and remounts the strip), so the arrow-key flow continues from the
  clicked tab. Activating Styles keeps focus in the CSS editor it mounts.
* Fixed: the element Attributes repeater rendered dark-on-dark in the light theme
  (rows, name/value fields, per-row actions and the "Add attribute" button kept
  their native dark-scale surfaces). Repainted from the theme tokens for light and
  auto; dark is untouched.

## 1.10.0
A large accessibility pass across the builder, plus two experimental
keyboard-driven productivity features.

* New: "Navigator keyboard tree". The Navigator now works like the WordPress list
  view: the arrow keys move through the elements (the canvas selection follows), the
  right arrow opens a branch and steps into it, the left arrow closes it and steps out
  to the parent, and Home and End jump to the first and last. It is also exposed to
  screen readers as a proper tree, so each element announces its level, whether it is
  expanded, and its position.
* New: "Accessible Builderius menu". The Builderius menu (the sidebar of templates,
  pages, components and admin links) is now keyboard and screen-reader operable. The
  menu button announces that it opens the menu, focus moves into it when it opens, and
  it is exposed as a tree: the arrow keys move between the collapsible category headings
  and their items, the right and left arrows open and close a category, Enter or Space
  toggles a heading or opens an item, and Escape (or the panel's Close button) closes
  the menu and returns focus to the button.
* New: "Accessible panel tabs". The settings panel's Content / Styles strip and the
  Navigator's Elements / Selectors / CSS vars strip are now proper tab lists: each tab
  announces that it is a tab and whether it is current, and each strip is one Tab stop
  where the arrow keys move between the tabs (Home and End jump to the ends). Clicking a
  tab now moves keyboard focus to it, so the arrow keys carry on from the tab you
  clicked. Builderius suppresses focus-on-click for these buttons (focus fell to the
  page body) and remounts the strip when the tab switches, so the focus is restored to
  the freshly mounted active tab once the switch settles, unless activating the tab
  mounted the CSS editor, which keeps focus.
* New: "Inserter keyboard navigation". The element Inserter is now navigable like the
  WordPress block inserter: each category is one Tab stop, the arrow keys move between
  the elements within a category (Home and End jump to its first and last), and Enter
  or Space inserts.
* New: "Element keyboard shortcuts" (experimental, off by default). Shortcuts in the
  style of the WordPress block editor for the element selected in the Navigator:
  duplicate (Cmd/Ctrl+Shift+D), cut (Cmd/Ctrl+X), add an element before or after it
  (Cmd/Ctrl+Alt+T / Cmd/Ctrl+Alt+Y, via a quick element picker) and rename (F2). The
  new actions also appear in the right-click menu, and there are shortcuts to move
  focus between the Navigator, settings panel, canvas and Inserter. Off by default
  while Builderius adds its own shortcuts. The right-click menu now also shows each
  action's shortcut right-aligned, like the block editor's menu, on the native rows
  (Duplicate, Copy, Paste, Remove) as well as the injected ones (Cut, Rename, Add
  before / after).
* New: "Command palette" (experimental, off by default). Press Cmd/Ctrl+Shift+K for a
  searchable command palette. With an element selected it can add one or more classes,
  add HTML attributes and add child elements with a minimal Emmet syntax
  (e.g. section.hero>h1{Title}+p{Lead}). It also runs the element actions — duplicate,
  copy, cut, delete, rename, add before / after, wrap in a div / figure / template /
  collection, and Auto-BEM — plus the move-to-area jumps. Commands are grouped under
  labelled dividers (Add to element, Structure, Element, Go to) and each shows its
  keyboard shortcut right-aligned, mirroring the block editor.
* Improved: the Global / Template scope switch inside the JavaScript and Dynamic Data
  editor tools is now a proper vertical tab list, keyboard-operable and announced to
  screen readers.
* Improved: more of the builder's icon-only buttons now carry tooltips and accessible
  names, the native browser tooltips are themed to match in light and dark, and the
  tooltip bubble now sits above modal dialogs instead of behind them.
* Improved: the HTML attribute name and value fields in an element's Advanced panel now
  have accessible names (they were announced as unlabelled edit boxes).
* Fixed: horizontal tab lists and toolbars (the panel tabs, the Sense AI session tabs
  and the bottom-bar editor tools) moved on the up and down arrows as well as left and
  right. Per the ARIA guidance they now move on Left/Right only; the breakpoint radio
  group keeps both axes, as radios should.
* Fixed: the builder's custom select dropdowns (the preview picker, the
  responsive-strategy select and the element HTML-tag and class fields) stayed open
  behind the control when you tabbed out of them. They now close as focus leaves.
* Fixed: the CSS scope switch in the Styles panel flickered (its label was rewritten on
  a loop) and its keyboard focus ring was clipped and invisible. Both are fixed.
* Fixed: the Builderius logo on the menu button disappeared while the menu was open,
  because its dark artwork sat on the dark active button. It now stays visible in both
  themes.
* Fixed: the Auto-BEM dialog's checkboxes could not be ticked, because a builder-level
  click handler swallowed clicks landing outside its own area. They work now.
* Fixed: in the light theme, an element's Attributes repeater rendered dark-on-dark —
  the attribute rows, their name/value fields and the "Add attribute" button were all
  black text on a near-black fill. They now use the light theme's surfaces and text.
* Improved: adding a Section through the quick element picker now brings the native
  Builderius structure with it (section &gt; div.container[data-container="true"]), so a
  picked Section is laid out and ready to fill like the native inserter's, rather than
  an empty full-bleed section.

## 1.9.0
* New: "Accessible AI session tabs". The tabs for the Sense AI chats have gotten some
  accessibility improvements
* Improved: in light and auto themes, the Sense AI terminal session strip now matches 
  the rest of the builder. The terminal itself keeps its own dark theme.
* Improved: "Undo / redo delete" is now "Undo / redo add & delete". Cmd/Ctrl+Z now also 
  undoes adding an element (removing it), and Shift redoes it, alongside the existing 
  restore of a deleted element. Moving elements and changing their settings 
  are still not covered.
* Improved: Selected text now uses a clear accent highlight at a legible contrast 
  in every theme.

## 1.8.1
* Fixed: the preview resize handles could not return to the "All" (full-width)
  breakpoint. Dragging fully open landed one band short (Desktop, or Tablet on a
  narrower canvas) because the base state has no numeric width to drag to. The
  handle now reaches it, and dragging spans the whole available width.
* Fixed: on a canvas wider than your widest breakpoint, dragging past that
  breakpoint jumped the preview to full width and the readout jittered. The drag
  is now smooth across the whole range with the true width shown throughout.
* Fixed: a brief flicker to full width the first time a drag crossed the widest
  breakpoint.
* Changed: "Preview resize handles" is now experimental and off by default on new
  installs. Above your widest breakpoint the builder has no canvas size of its
  own, so the handle sizes the preview itself; a Builderius update could affect
  that. Existing installs keep their current setting.
* Fixed: the resizable side-panel grip clashed with Builderius' own left-panel
  resize bar, which sat under the grip and swallowed the drag. The native bar is
  now set aside while the panel-resize feature is on.
* Fixed: the breakpoint radio group could announce the wrong current breakpoint
  to a screen reader after a resize. Its checked state now tracks the active
  breakpoint at every step.

## 1.8.0
* New: "Top-bar keyboard groups". The breakpoint switcher becomes a proper radio
  group: a screen reader announces which breakpoint is current and how many there
  are, and the arrow keys move between and select them from a single Tab stop.
  The canvas width and zoom fields are grouped and labelled.
* New: "Bottom-bar keyboard toolbar". The bar of editor tools (Custom CSS,
  JavaScript, Dynamic Data, Sense AI and so on) becomes a keyboard toolbar: one
  Tab stop with arrow-key navigation, each tool tells a screen reader whether its
  panel is open, the shared panel is a labelled region, and locked (Pro) tools
  are announced as locked rather than being silent, dead buttons.
* New: "Accessible select comboboxes". The builder's custom select popovers (the
  top-bar preview picker, the responsive-strategy select, the element HTML-tag
  select and others) are now proper ARIA comboboxes: combobox / listbox / option
  roles with the current value announced, a single Tab stop, and arrow keys to
  move through the options with Enter to choose. It is purely additive — typing
  to filter and clicking to choose are still handled entirely by Builderius.
* Fixed: in light mode, the option you arrow to in the element HTML-tag select
  kept the native dark highlight behind dark text (dark-on-dark). The focused and
  hovered option now follow the theme, meeting WCAG AA contrast in both themes.
* Fixed: the settings-page toggle switches now show a tick (on) or a dash (off)
  inside the knob, so their state no longer relies on the knob position and track
  colour alone (WCAG 1.4.1). The glyph is decorative; the checkbox itself still
  conveys the state to assistive tech.
* Improved: the theme switcher now announces the new mode ("Theme set to dark")
  through a live region on each switch, so screen reader users hear the change.
  The density toggle does the same. Both buttons also keep their accessible name
  in step with their current state.
* Improved: the top-bar canvas width and zoom fields now have accessible names
  (previously they were announced as unlabelled edit boxes).
* Fixed: the active class chip's caret menu is now consistent. It previously
  opened the native "Close"-only menu instead of the full copy/remove menu when
  the click landed just off the small caret; the whole caret area now opens the
  enriched menu every time.
* Fixed: the "Search for element" field no longer shows two magnifier icons. It
  ships its own icon in current Builderius, so the plugin no longer adds a second.
* Fixed: the "coming soon" badges in the element context menu's Save to submenu
  no longer overlap the item text.
* Fixed: in light mode, the reused select popover (the top-bar "Property: …"
  preview picker and others) floated its options on a dark fill with black text,
  leaving them unreadable (black-on-black). The dropdown, its options and its
  search field now follow the theme, meeting WCAG AA contrast.
* Changed: the plugin now requires Builderius to be active. Activation is blocked
  with a clear message if Builderius is not present, and the builder enhancements
  stay dormant (with an admin notice) if Builderius is later deactivated.

## 1.7.1
* Improved: the active class chip in the Styles editor now offers the same
  right-click menu as the other class chips. Right-click it, or use its caret,
  to copy the class name (with or without the leading dot), copy every class at
  once, remove it from the element, or close it. Previously the active chip only
  had a caret menu with a single "Close" item.
* Improved: the detachable Navigator now shows a grabber bar across the top of
  the floating panel, with a grab cursor and a "Drag to move" tooltip, so it is
  clear where to grab it to reposition it.
* Fixed: added a Plugin URI so a "Visit plugin site" link appears on the Plugins
  screen where "View details" is not offered, such as a multisite sub-site,
  where WordPress reserves plugin details for Super Admins in the Network Admin.

## 1.7.0
* New: Resizable side panels (Appearance). Each side panel gets a drag handle on
  its inner edge, with full keyboard support (arrow keys, Home/End). The settings
  panel and the Navigator share one width, so resizing either resizes both, and
  the width is remembered. This replaces the old one-shot "widen settings panel"
  button, which has been removed.
* New: Tidy selector hint (Styles panel). Builderius' two-line %local% /
  %selector% notification under the CSS editor is replaced with a compact,
  dismissable hint, reclaiming the vertical space. The full explanation moves into
  a dialog and is reworded so both tokens are described the same way and
  breakpoints are explained consistently for each. The stock wording only
  mentions the breakpoint variables for %local% and only the breakpoints switcher
  for a class. The hint wraps onto a second line when the panel is dragged narrow,
  rather than truncating with an ellipsis.
* New: Detachable Navigator (Navigator, experimental, off by default). A detach
  button in the Navigator header floats the panel over the canvas; drag it by its
  header, resize from the bottom corner, and dock it again with the same button.
  Its position is remembered. Experimental because it floats over the builder
  chrome, so a Builderius update could shift it.
* New: "Figure" added to the right-click Wrap in… menu, alongside Div, Template
  and Collection.
* Fixed: the Navigator tab labels (Elements / Selectors / CSS vars) no longer
  truncate in a narrow panel; the strip now wraps rather than clipping a label.

## 1.6.0
* Changed: the CSS scope bar now keeps the Styles editor accurate about scope.
  Builderius shows a class's rules whichever scope is active (the Global/Template
  switch only decides where a save lands), so the same rules appeared under both
  scopes and an edit could be forked into the wrong one. The editor now shows
  only the active scope's rules for the selected class: it labels the scope you
  are editing, and when the rules actually live in the other scope it hides them
  behind a short note with a one-click switch, instead of presenting them as if
  they were yours. A global-only class reads as Global, a component or template
  class reads under that scope, and a scope with no rules reads as empty. Applies
  to class selectors at the base breakpoint.
* Removed: the separate CSS scope guard toggle. Its job, warning when a class's
  rules live in the other scope, is now done by the CSS scope bar, which reads
  the live editor state rather than a saved-styles index. That means it needs no
  background refresh and updates the moment you switch scope or selector. If you
  relied on the scope guard, turn on the CSS scope bar to keep the same
  protection. The guard's REST endpoint has also been removed.
* Fixed: in the light theme, the class picker dropdown (the list of existing
  classes shown when you add a class in the Styles panel) rendered dark text on
  a dark surface, leaving the class names unreadable. The dropdown, its group
  headings and its items now use the light theme's surface and text tokens. The
  dark theme is unchanged.

## 1.5.2
* Fixed: the tree context menu clipped its lower items when opened low on the
  screen. Builderius positions the menu from the click point before our extra
  rows (Rename, Wrap in, Move up/down, Unwrap and so on) are added, and never
  re-measures, so a fully-loaded menu could run past the bottom of the viewport.
  It is now re-clamped into view once the rows are in: shifted up to fit, or
  capped and scrolled when it is genuinely taller than the viewport. The Wrap in
  and Save to flyouts are unaffected.
* Changed: context-menu rows are more compact. The native menu's generous row
  padding made a loaded menu tall and sparse; rows are now tighter (still above
  the 24px minimum pointer-target size) with slimmer cluster separators, cutting
  a full menu's height by roughly a quarter. Native and injected rows, and the
  flyouts, all share the tighter spacing.

## 1.5.1
* Fixed: the Global/Template scope switch could not add rules to a scope the
  class was not already in. When a class had saved rules in only one scope,
  Builderius kept forcing the editor back to that scope, so switching to the
  empty scope to start a rule there was ignored (the Selectors tab was the only
  way in). The scope bar and scope guard now re-point the editor at the chosen
  scope through Builderius' own cssSelector hook, so the first rule saves where
  you asked; once a class has rules in both scopes the native behaviour is
  unchanged. Reported upstream to Builderius.
* Fixed: in the light theme, a placed component's instance property labels
  rendered black-on-black. The label rows kept a native dark surface while the
  text was remapped for the light theme; both now use the theme tokens.
* Changed: the CSS code editor, CSS scope bar and CSS scope guard now require
  Builderius Pro, since they depend on the Pro CSS code editor and
  template-specific CSS. When Pro is inactive these features stay off (the
  native CSS-mode icon is left in place), their settings rows are disabled with
  a note, and your saved on/off choices are kept for when Pro is active again.

## 1.5.0
* Fixed — the CSS scope guard was reading weeks-stale stylesheets. Builderius
  keeps the current saved state in its branch/commit storage (the newest
  builderius_commit named by the branch's active_commit meta), not in the
  builderius_dsm snapshot posts the guard indexed, and the global stylesheet's
  entity is the settings set (the old global-settings slug is defunct). The
  guard and its refresh route now resolve the live commit, keeping the old
  snapshot read as a fallback for installs without commit rows.
* Changed — the settings-page copy is rewritten in plain British English: every
  description now says what the feature does in full sentences, with
  consistent terms throughout.
* New — the builder UI is translatable. Every string the plugin renders in the
  builder (tooltips, menus, dialogs, toasts, screen-reader announcements) now
  goes through WordPress internationalisation and ships on the config object,
  with a POT template in /languages and bundled-translation loading. The only
  strings left in English are the native Builderius menu labels the plugin
  matches against to drive the builder.

## 1.4.0
* New — Move & navigate elements: right-click an element for Move up / Move down
  (reorder it among its siblings) and Select parent (move the selection up one
  level). A new toggle.
* New — Rearrange component properties: a rearrange button on a component's
  properties panel switches into drag mode; drag the properties (or use the
  arrow keys) into a new order, saved with the component. A new toggle.
* New — HTML attribute helpers: when an element's Advanced panel opens with no
  HTML attributes, a blank row is ready to type into (removed again if left
  empty), and the name field suggests common attributes (id, role, aria-*,
  data-…). A new toggle. Props Tim Gray.
* Wrap in… : adds Unwrap — remove a wrapper element and promote its children up
  one level, dropping the empty shell (the inverse of wrapping).
* Context menu: the right-click menu is now one flat, logically-grouped list —
  the everyday actions one click away — instead of nested flyout groups.
  Flyouts are kept only where an action branches (Wrap in…, Save to…). Full
  keyboard support is unchanged.
* Rearrange component properties: an expanded property (which Builderius gives
  no collapse control) now collapses to a uniform strip during reorder and
  shows its real name, so it can be grabbed and moved like the others.
* Light theme: the component properties panel — the New property button, the
  property rows and the select-option rows — no longer renders black-on-black;
  repainted with the theme's surface and text tokens.

## 1.3.0
* New — Double-click to rename: double-click an element on its Navigator row to
  rename it inline, without opening the right-click menu (a new toggle).
* New — Follow selection in the tree: when you click an element in the preview,
  the Navigator expands the branches down to it and scrolls it into view, so the
  selected element is always visible in the tree (a new toggle). Props Israel
  Reyes.
* Wrap in… : wrapping an element in a div, template or collection now keeps the
  wrapper in the element's original position instead of appending it at the end
  of its parent, and the wrapped element keeps its identity (a real move, not a
  copy). Rebuilt on the builder's own add and move actions — no clipboard, and
  it repaints and saves like any native edit.
* Multi-select is temporarily withdrawn: dragging a multi-selection did not
  reliably move the whole selection, so the option has been removed for now
  while it is reworked. Single-element wrap, rename and remove are unaffected.
* Auto-BEM: the class-naming feature and its context-menu item are now named
  "Auto-BEM" (was "Add class names…" / "Bulk class naming"), the clearer name.
* Auto-BEM: an element the canvas has not painted — such as the empty container
  a freshly-added Section ships with — can now be ticked and named. Whether a
  row is class-able is decided from the element itself rather than the preview.

## 1.2.1
Light-theme contrast and dark-surface fixes across the builder chrome:
* Native icons, footer-bar tabs, muted labels and white headings now meet
  WCAG AA contrast in the light theme — the dark-palette foreground tokens are
  remapped once, instead of leaking through the native rules that paint them.
* Content-tab category accordions no longer paint a dark band on hover.
* Media Queries / breakpoints modal: repainted as a light surface (was a dark
  card with near-unreadable text).
* Builderius menu tiles, the Navigator right-click menu hover, applied-class
  chips, tooltips, switch tracks and the idle Save button: fixed
  black-on-dark and low-contrast states.
* Sense AI connect panel: heading and token field themed for the light mode.
* Preview resize handles now show a persistent capsule grip, so the drag
  affordance is visible at rest (hover/focus still highlight it in the accent).

## 1.2.0
* Multi-select: dragging one row of a multi-selection now moves the whole
  selection — the remaining rows follow the dropped row into place, keeping
  their Navigator order (a toast reports how many moved).
* Multi-select: on a Mac only Cmd+click toggles rows into the selection;
  Ctrl+click is the system right-click gesture and now opens the context
  menu as expected. Ctrl+click still works on Windows and Linux.

## 1.1.0
* New scope guard toggle: warns when the rules shown in the Styles code
  editor live in the other CSS scope, with a one-click switch on its own row.
* Copy menu on the Styles editor class chips: copy with or without the
  leading dot, copy all classes, and now remove the class from the element;
  the menu also renders in the builder's own typeface instead of the system
  font.
* Context menu: the native Actions header is styled as a group heading;
  scope badge wording clarified; scope-bar edge padding.
* Light theme fixes: tag select, segmented radio pills and the Monaco
  editor island.
* Plugin icon shown in the WordPress updates UI.
* CODEOWNERS file so pull requests request the maintainer's review.

## 1.0.0
* Initial public release.
* Appearance: unified typography and design tokens, light/dark/auto theme
  switcher, density toggle, tab styling, search affordance, controls styling,
  focus visibility, Navigator row styling.
* Navigator: HTML tag badges, icon de-clutter, collapse/expand controls, tree
  search, rearrangeable favourites bar (drag or arrow keys, remembered per
  browser), and an end-of-scroll gap so the last row clears the scrollbar.
* Editing: regrouped right-click menu with hover flyouts and full keyboard
  support (Clipboard, Name & classes, Structure, Save to; Remove kept last),
  Wrap in…, inline rename with label reset, undo/redo delete, multi-select.
* Styles panel: CSS code editor by default, scope badge with an instant
  Global/Template switch, bulk class naming (Auto-BEM).
* Workflow: preview resize handles on both canvas edges for container-query
  work (live width readout, breakpoint snap, keyboard-operable),
  keyboard-shortcuts overlay, unsaved-changes cue, tooltips and accessible
  names for icon-only buttons, second-tab warning, canvas overlay contrast
  fix.
* Settings live under Builderius → Builder Enhance with a Dashboard tab;
  breakpoint tooltips read the site's real breakpoints.
* Automatic updates from GitHub releases via plugin-update-checker.
