=== Daveden Builder Enhancements ===
Contributors: davedendigital
Requires at least: 6.4
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.2.0
License: GPLv2 or later

Quality-of-life, theming and accessibility enhancements for the Builderius
builder UI, each behind its own toggle (admin menu: Builderius → Builder
Enhance; a top-level menu when Builderius is inactive).

Targets Builderius 1.3.5-beta. The plugin directory name must contain
"builderius" — see the header docblock in daveden-builderius-enhancements.php.

== Changelog ==

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
