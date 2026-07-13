=== Daveden Builder Enhancements ===
Contributors: daveden2
Requires at least: 6.4
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.12.3
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

= 1.12.3 =
Hotfixes for the tree context menu's actions and the light-theme toasts.
* Fixed: choosing any of the plugin's context-menu actions (Auto-BEM,
  Rename, Reset label, Wrap in, Expand children and the rest) did nothing
  and left the menu open — a 1.12.0 refactor made the shared menu-close
  helper call itself. The helper now closes the menu again.
* Fixed: Cut from the context menu did nothing, or occasionally pasted a
  stray copy of the element. Driving the native menu straight after the
  visible one could pick up the old, still-open dialog, where the shortcut
  hints break the item match and a re-render can swap rows mid-click. The
  driver now waits for the menu to fully close first.
* Fixed: in the light theme, the notification toasts ("Template saved",
  "Copied" and so on) drew almost-black text on a black card; the card now
  uses the light theme's surface. The dark theme is unchanged.

= 1.12.2 =
A multisite activation fix, two favourites bar repairs, and screen-reader
landmarks for the builder.
* Fixed: on a multisite install with the plugin network-activated and
  Builderius activated per site, the plugin wrongly reported Builderius as
  inactive and stayed dormant on every subsite.
* Fixed: in the light theme, every favourites bar icon carried a heavy dark
  outline; the border now uses the theme's subtle hairline. The dark theme is
  unchanged.
* Fixed: while a footer panel (Sense AI, Custom CSS and so on) was open, the
  favourites icons spilt over the Navigator's delete and edit-favourites
  buttons. The strip now scrolls within the space available instead.
* New: Screen-reader landmarks. Each major part of the builder (the top
  toolbar, the element library / element settings panel, the canvas, the
  Navigator and the footer bar) is exposed as a named landmark region, so
  screen reader users can jump straight to a section from the landmark list,
  the way the WordPress block editor's regions work.

= 1.12.1 =
Repairs around the native "hide side panels" toggle, an opt-in keyboard route
into the Save options menu, and a tidier settings screen.
* Fixed: the builder's own "hide side panels" button looked dead — the
  Resizable side panels and CSS-code-editor features were pinning the panels
  open against it. Both now stand aside while the panels are hidden.
* Fixed: with the side panels hidden, dragging the preview resize handles
  collapsed the canvas partway through the range; the drag now works across
  the full width, with the matching breakpoint still lighting up as you cross
  it.
* Fixed: opening the Save button's dropdown no longer clears the "Unsaved"
  marker (opening the menu is not a save).
* New (experimental, off by default): keyboard access for the Save options
  menu. Builderius draws the dropdown trigger inside the Save button itself,
  where no keyboard or screen reader can reach it; this optional stopgap
  replaces it with a real "Save options" button beside Save. Off by default —
  the Save button stays completely native unless you opt in, and the proper
  fix has been reported to Builderius.
* Improved: the settings screen now shows one concise line per feature, with
  the full explanation behind a small info button next to each title.

= 1.12.0 =
A quality release across the board: Cmd/Ctrl+S to save, a faster and lighter
builder chrome, reduced-motion support, and a long list of robustness and
screen-reader fixes.
* New: press Cmd/Ctrl+S to save the template from anywhere in the builder,
  including the code editors — no more reaching for the Save button or landing
  in the browser's save-page dialog. Its own toggle (Workflow), on by default.
* Improved: the builder chrome script is now served as a normal cacheable file
  instead of being embedded in every builder page, so after the first visit the
  builder loads it from cache rather than downloading it again.
* Improved: the "auto" theme resolves to light or dark before the first paint,
  and auto on a dark operating system is now exactly the dark theme (it was
  previously a close approximation).
* Improved: the busiest interface work — Navigator tree semantics, breakpoint
  lookups, style-scope checks, drag reordering, Auto-BEM collection — does far
  less per change, so large templates feel snappier.
* Improved: all plugin animations now respect the operating system's "reduce
  motion" setting.
* Fixed: the "Unsaved" marker could stick permanently after the builder redrew
  the Save button, and could clear before a save had actually finished.
* Fixed: undo/redo, Escape, F2 and the command palette could all go quiet after
  a tree redraw interrupted an inline rename.
* Fixed: a blank attribute row left over from the attribute helpers could be
  saved with the element if the settings panel closed before it was tidied.
* Fixed: the bottom-bar toolbar and the AI session tabs could silently stop
  updating after the builder replaced the footer; they now re-attach.
* Fixed: screen readers now hear correct option counts in the element picker
  and the command palette, the class-chip menu has a proper name, and its
  arrow keys behave predictably (with Home and End added).
* Fixed: uninstalling now also removes the update checker's stored data, and
  the download zip no longer carries development files.
* Changed: releases are now tagged and published automatically when the
  release pull request merges, and the JavaScript and CSS are linted in CI
  alongside the existing PHP checks.

= 1.11.0 =
A new "All CSS" jump in the scope bar, plus light-theme polish in the Navigator
and Styles panel and find-widget fixes.
* New: an "All CSS" button (the Builderius CSS-file icon) beside the Global/Template
  switch opens the full stylesheet for the active scope and highlights where the
  current selector's CSS lives — the same view as Selectors → All CSS, one click
  away from the element you're styling. Requires Builderius Pro.
* Fixed: Navigator tree rows had a hard black border in the light theme; it is now
  a soft hairline so the element names stand out, as they do in dark mode.
* Fixed: the class-name chips in the Styles panel had weak contrast in the light
  theme; both the selected chip and the other class chips are now clearly legible.
* Fixed: the find widget (Cmd/Ctrl+F) search field was cramped to a sliver in the
  narrow Styles panel; it now uses the panel's full width, and grows when widened.
* Fixed: the find widget's search field showed as a dark box in the light theme;
  it now matches the rest of the editor.
* Fixed: the canvas preview took on the builder's colour scheme (e.g. a dark
  background in the dark theme); it now renders in the page's own scheme, matching
  the front end.

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
