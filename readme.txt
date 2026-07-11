=== Daveden Builder Enhancements ===
Contributors: daveden2
Requires at least: 6.4
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.9.0
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

= 1.9.0 =
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

= 1.8.1 =
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

= 1.8.0 =
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

= 1.7.1 =
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

= 1.7.0 =
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

= 1.6.0 =
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
