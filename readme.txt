=== Daveden Builder Enhancements ===
Contributors: davedendigital
Requires at least: 6.4
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

Quality-of-life, theming and accessibility enhancements for the Builderius
builder UI, each behind its own toggle (admin menu: Builderius → Builder
Enhance; a top-level menu when Builderius is inactive).

Targets Builderius 1.3.5-beta. The plugin directory name must contain
"builderius" — see the header docblock in daveden-builderius-enhancements.php.

== Changelog ==

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
