=== Daveden Builder Enhancements ===
Contributors: davedendigital
Requires at least: 6.4
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.5.2
License: GPLv2 or later

Quality-of-life, theming and accessibility enhancements for the Builderius
builder UI, each behind its own toggle (admin menu: Builderius → Builder
Enhance; a top-level menu when Builderius is inactive).

Targets Builderius 1.3.5-beta. The plugin directory name must contain
"builderius" — see the header docblock in daveden-builderius-enhancements.php.

== Credits ==

Several features were suggested by the Builderius and wider web-design
community. Thank you:

* Inline rename — Israel Reyes and Tim Gray
* Follow selection in the tree — Israel Reyes
* HTML attribute helpers — Tim Gray
* Density toggle (compact mode) — Max Ziebell
* Light / dark / auto theme — David McCan

Suggested a feature that shipped? Open an issue on GitHub to be credited.

== Changelog ==

= 1.5.2 =
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

= 1.5.1 =
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

= 1.5.0 =
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

= 1.4.0 =
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

= 1.3.0 =
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

= 1.2.1 =
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

= 1.2.0 =
* Multi-select: dragging one row of a multi-selection now moves the whole
  selection — the remaining rows follow the dropped row into place, keeping
  their Navigator order (a toast reports how many moved).
* Multi-select: on a Mac only Cmd+click toggles rows into the selection;
  Ctrl+click is the system right-click gesture and now opens the context
  menu as expected. Ctrl+click still works on Windows and Linux.

= 1.1.0 =
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

= 1.0.0 =
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
