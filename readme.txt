=== Daveden Builder Enhancements ===
Contributors: daveden2
Requires at least: 6.4
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.10.1
License: GPLv2 or later

Quality-of-life, theming and accessibility enhancements for the Builderius
builder UI, each behind its own toggle (admin menu: Builderius → Builder
Enhance).

Targets Builderius 1.3.5-beta. The plugin directory name must contain
"builderius" — see the header docblock in daveden-builderius-enhancements.php.

== Credits ==

Several features were suggested by the Builderius and the wider web design
community. Thank you:

* Inline rename — Israel Reyes and Tim Gray
* Follow selection in the tree — Israel Reyes
* HTML attribute helpers — Tim Gray
* Detachable Navigator — Tim Gray
* Density toggle (compact mode) — Max Ziebell
* Light / dark / auto theme — David McCan

Suggested a feature that shipped? Open an issue on GitHub to be credited.

== Changelog ==

A short summary of each release. The full, detailed notes live in CHANGELOG.md
in the plugin repository.

= 1.10.1 =
Ships the finishing work that was completed just after 1.10.0 was tagged and so
never reached the 1.10.0 download. If the command palette showed no keyboard
shortcuts and the right-click menu had no accelerators, this restores them.
* New: the command palette now groups its commands under labelled dividers, adds
  the commands it was missing (Copy, Auto-BEM, Wrap in a div / figure / template /
  collection) and shows each command's keyboard shortcut, right-aligned.
* New: the right-click menu shows the keyboard shortcut on every actionable row.
* Improved: a picked Section from the quick element menu now brings its native
  container, so it is laid out and ready to fill like the native inserter's Section.
* Fixed: clicking a settings-panel or Navigator tab now keeps focus on the tab so
  the arrow keys continue from there.
* Fixed: the element Attributes repeater is legible again in the light theme (it
  rendered dark-on-dark).

= 1.10.0 =
A big accessibility pass across the builder, plus two experimental keyboard tools.
* New: the Navigator, the Builderius file menu, the panel tabs and the element
  Inserter can now all be operated by keyboard and screen reader.
* New (experimental, off by default): element keyboard shortcuts (duplicate, cut,
  add before, add after, rename) and a command palette (Cmd/Ctrl+Shift+K) for
  quickly adding classes, attributes and elements.
* Improved: the Global/Template scope switch is now a proper tab list, more icon
  buttons carry tooltips, and the HTML attribute fields are labelled.
* Fixed: horizontal tabs and toolbars move on Left/Right only; the custom
  dropdowns close when you tab away; the scope switch no longer flickers and keeps
  a visible focus ring; the menu logo stays visible when open; and the Auto-BEM
  checkboxes can be ticked again.

= 1.9.0 =
* New: accessibility improvements for the Sense AI session tabs, themed to match
  the builder in light and auto modes.
* Improved: undo/redo now covers adding an element as well as deleting one, and
  selected text is clearer in every theme.

= 1.8.1 =
* Fixed: the preview resize handles now reach the full-width "All" breakpoint and
  drag smoothly across the whole range.
* Fixed: the side-panel resize grip no longer clashes with Builderius' own resize
  bar, and the breakpoint switcher announces the right breakpoint.
* Changed: preview resize handles are now experimental and off by default on new
  installs.

= 1.8.0 =
* New: keyboard-accessible top-bar breakpoint switcher, bottom-bar editor tools,
  and the builder's custom select dropdowns.
* Improved: the theme and density switches announce their new state, and toggle
  switches show a tick or dash so their state does not rely on colour alone.
* Fixed: several light-theme contrast issues, the class-chip caret menu, and a
  duplicate search icon.
* Changed: the plugin now requires Builderius to be active.

= 1.7.1 =
* Improved: the active class chip gains the full right-click menu, and the
  detachable Navigator shows a clear grab bar.
* Fixed: added a plugin site link for sub-sites where plugin details are hidden.

= 1.7.0 =
* New: resizable side panels, a tidier CSS selector hint, a detachable Navigator
  (experimental), and "Figure" in the Wrap in… menu.
* Fixed: the Navigator tab labels no longer truncate in a narrow panel.

= 1.6.0 =
* Changed: the CSS scope bar now shows only the active scope's rules, so an edit
  can no longer be forked into the wrong scope.
* Removed: the separate CSS scope guard toggle; the scope bar now does its job.
* Fixed: the light-theme class-picker dropdown is readable again.

= 1.5.2 =
* Fixed: the right-click menu no longer runs off the bottom of the screen.
* Changed: context-menu rows are more compact.

= 1.5.1 =
* Fixed: you can now start a rule in an empty CSS scope straight from the scope
  switch, and light-theme component property labels are readable.
* Changed: the CSS code editor, scope bar and scope guard now require Builderius Pro.

= 1.5.0 =
* New: the builder UI is now translatable.
* Fixed: the CSS scope guard reads the live saved state rather than stale snapshots.
* Changed: the settings-page copy is rewritten in plain British English.

= 1.4.0 =
* New: move and navigate elements, rearrangeable component properties, and HTML
  attribute helpers.
* Improved: the right-click menu is one flat, grouped list, and Wrap in… gains Unwrap.
* Fixed: light-theme contrast on the component properties panel.

= 1.3.0 =
* New: double-click to rename, and follow-selection in the tree.
* Improved: Wrap in… keeps the wrapper in place and preserves the element's
  identity, and Auto-BEM works on not-yet-painted elements.
* Multi-select is temporarily withdrawn while its drag behaviour is reworked.

= 1.2.1 =
* Fixed: a broad light-theme contrast pass across the builder chrome (icons, tabs,
  menus, modals, chips and more).

= 1.2.0 =
* Improved: dragging one row of a multi-selection now moves the whole selection.
* Fixed: on a Mac, Ctrl+click opens the context menu (Cmd+click toggles the selection).

= 1.1.0 =
* New: a CSS scope guard, and copy/remove options on the Styles class chips.
* Fixed: several light-theme contrast issues; the plugin icon shows in the updates UI.

= 1.0.0 =
* Initial public release: appearance and theming, an enhanced Navigator, editing
  tools (right-click menu, wrap, rename, undo/redo), Styles-panel helpers, and
  workflow extras — each behind its own toggle.
