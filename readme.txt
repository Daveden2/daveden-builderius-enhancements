=== Daveden Builder Enhancements ===
Contributors: daveden2
Tags: builderius, page builder, accessibility, admin, editor
Requires at least: 6.4
Tested up to: 7.0
Stable tag: 2.0.3
Requires PHP: 8.2
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Quality-of-life, theming and accessibility enhancements for the Builderius builder UI, each behind its own toggle.

== Description ==

Daveden Builder Enhancements refines the Builderius builder's own interface with independent toggles across six areas: appearance and theming (light / dark / auto, density, design tokens), accessibility (keyboard tree navigation, region shortcuts, screen-reader announcements), a friendlier Navigator (search, row quick actions, detachable panel), editing tools (a flatter right-click menu, wrap and unwrap, inline rename, undo/redo, element shortcuts, a command palette and opt-in HTML authoring), Styles-panel helpers, and workflow extras such as Cmd/Ctrl+S to save. Keyboard and screen-reader access is a design goal throughout.

Everything is configured under **Builderius → Builder Enhancements**, and every feature can be switched off without affecting the rest.

The plugin targets Builderius 1.3.6-beta and requires Builderius to be active. The plugin directory name must contain "builderius" — see the header docblock in `daveden-builderius-enhancements.php` and the FAQ below.

= Credits =

Several features were suggested by the Builderius and the wider web design community. Thank you:

* Inline rename — Israel Reyes and Tim Gray
* Follow selection in the tree — Israel Reyes
* HTML attribute helpers — Tim Gray
* Detachable Navigator — Tim Gray
* Density toggle (compact mode) — Max Ziebell
* Light / dark / auto theme — David McCan
* Navigator row quick actions — TRẦN ĐỨC LƯƠNG (@evanscliff)
* Command palette button in the top bar — @chanart
* Assignable command palette shortcut — @chanart

Suggested a feature that shipped? Open an issue on GitHub to be credited.

== Installation ==

1. Download the latest release zip from the GitHub repository and install it via Plugins → Add New Plugin → Upload Plugin (or unzip it into `wp-content/plugins/`, keeping the folder name).
2. Make sure Builderius is installed and active, then activate the plugin.
3. Adjust the toggles under Builderius → Builder Enhancements — sensible defaults are on out of the box.

== Frequently Asked Questions ==

= Why must the plugin folder keep "builderius" in its name? =

Builderius' builder mode removes the hooks of every plugin it does not recognise. A folder name containing "builderius" is what keeps this plugin's enhancements alive inside the builder; rename the folder and the plugin goes quiet there.

= Do I need Builderius Pro? =

No. A few features enhance Pro-only surfaces (such as the CSS code editor helpers); those are marked on the settings screen and simply stay unavailable without Pro.

= How do I suggest a feature or report a bug? =

Report bugs as issues on the GitHub repository. For questions, ideas and general chat, use the repository's Discussions tab. Suggestions that ship are credited in this readme.

= Can I support the plugin's development? =

Yes — the repository's Sponsor button lists the ways (GitHub Sponsors, Ko-fi or PayPal). The plugin stays free either way.

== Changelog ==

A short summary of recent releases. The full, detailed notes for every release live in CHANGELOG.md in the plugin repository.

= 2.0.3 =
Builderius 1.3.6 compatibility, direct preview actions and a faster, calmer builder.
* New: the preview right-click menu and Rename from the preview are stable, on-by-default features. Right-click a rendered element or use Shift+F10/Menu for its familiar element actions, and rename its Navigator label there or with F2 without changing visible text or its HTML tag.
* Changed: DBE now extends Builderius 1.3.6-beta's native admin bar, canvas tabs, change history, rename, Auto-BEM, favourites editor, CSS workflow, context menu, Wrap in dialog, shortcuts, save state and full-width preview instead of loading overlapping replacements. Downgrade-safe fallbacks remain for older Builderius versions.
* Accessibility: the native admin bar, persistent canvas tabs, favourites editor, element menus and Wrap in dialog gain complete keyboard models, clear names and states, contained focus where appropriate, reliable focus return and one visible high-contrast focus treatment.
* Fixed: DBE's store-backed features now work with Builderius Free on its own. Opening a builder URL honours the requested document instead of first restoring a different saved tab, and preview Rename no longer appears twice beside Builderius's native action.
* Improved: resize the left and right panels independently. Builderius menu links regain consistent full-row cards and focus targets, and long class names remain readable inside menus and command results.
* Performance: DBE now defers its builder runtime and delivers only the JavaScript chunks required by enabled features. Shortcut discovery has its own cacheable chunk, and redundant Navigator refresh work is suppressed.
* Development: the supported baseline is now PHP 8.2 with current PHP, JavaScript, CSS and GitHub Actions checks.

= 2.0.1 =
A fix for element names lost when editing a component as HTML.
* Fixed: editing a subtree as HTML renamed every component inside it. A component's own Navigator name was not written into the HTML, so applying the edit fell back to the component's registered name — or just "Component" — and the name you had given that instance was gone. Names now survive the round trip, and a component inserted by Import HTML or the shorthand keeps the name it was given.

= 2.0.0 =
A rebuilt settings screen, new HTML authoring tools, and a thorough accessibility and performance pass.
* New: Edit as HTML (Pro, experimental, off by default). Edit an element and everything inside it as plain HTML, then apply the changes back. A preview shows exactly what will change first.
* New: Import HTML (Pro, experimental, off by default). Paste markup from anywhere, preview the elements it will create, and insert them. Repeated blocks can be collapsed into a Collection, and a pasted SVG stays editable.
* New: Change tag. Change an element's HTML tag from the Navigator or the command palette, keeping its label and any data binding.
* New: a shorthand for building elements quickly from the command palette. See the Emmet guide in the repository.
* New: Paste where you click in the Navigator, so a pasted element lands where you point rather than at the top of the tree.
* New: quick-start presets on the settings dashboard switch on a considered set of accessibility, keyboard, visual, safer-editing or power-editing features in one step, without turning anything off. Nothing changes until you review and save.
* Improved: the settings screen has been rebuilt. A tab rail shows how much of each section is switched on, every feature is a name, a switch and a plain description, and one switch turns a whole tab or section on or off. A new Accessibility tab gathers the keyboard and screen-reader features that were scattered across the other tabs.
* Improved: most features have come through testing and are no longer marked experimental, so they are on by default. Edit as HTML and Import HTML stay off, and now carry a warning on the settings screen, because each rewrites a whole element in one step that cannot be undone.
* Improved: the right-click menu is shorter and easier to scan, with grouped flyouts for inserting, moving and advanced tools. Press Enter to start editing a text element and Escape to finish. Navigator search hides branches that do not match, and Follow selection keeps your place visible even when the Navigator is hidden.
* Improved: changes you can undo now offer an Undo button in their confirmation message, and Redo after undoing. Save status reports Unsaved, Saving and Saved, and includes settings-only edits.
* Improved: the code behind the plugin has been reorganised for maintainability and speed. The builder loads faster, stays responsive while you work, and the plugin now cleans up properly after itself when a feature is switched off.
* Improved: a thorough accessibility pass across the builder, covering keyboard focus, screen reader announcements, target sizes, forced-colours mode and the narrow-window layout.
* Fixed: a round of fixes across the Navigator, the right-click and class menus, undo and redo, and the settings screen. The full list is in CHANGELOG.md.
* Security: markup pasted through the HTML tools is cleaned before it reaches the builder, and those tools are available only to users already allowed to post unfiltered HTML.

= 1.14.0 =
Accessible settings groups and image defaults, an assignable command-palette shortcut, and a round of accessibility and light-theme fixes across the footer tools and top bar.
* New: Settings groups (Editing tab, on by default) — the settings panel's collapsible group headings become real keyboard stops that announce whether they are open and toggle with Enter or Space. Collapsed groups render none of their fields, so this is the only keyboard route to those settings.
* New: Image defaults (Editing tab, on by default) — a newly added Image element starts with a visible built-in placeholder and an empty alt attribute instead of rendering as a broken, invisible image; picking a real image replaces the placeholder and keeps the alt.
* New: the command palette's keyboard shortcut is assignable. The default moves to the conventional Cmd/Ctrl+K (Firefox on Windows and Linux reserves the old Ctrl+Shift+K for its DevTools console), with Cmd/Ctrl+/ and the old combination as alternatives — and a top-bar button now opens the palette too, its tooltip showing the current shortcut.
* Improved: the JavaScript and Dynamic Data tools' configure panel is now accessible — the Enabled switch is a proper labelled switch with an on/off glyph in both themes (previously a black pill in light mode), every field label is wired to its control, the per-item actions button has a name, and the actions menu is fully keyboard-operable.
* Improved: that actions menu opens anchored to its row's button instead of wherever the pointer happened to be — for keyboard and mouse alike, in every browser; where the browser supports CSS anchor positioning it stays attached while open.
* Fixed: at narrower window sizes the plugin's top-bar buttons (theme, density, palette, the unsaved marker) overlapped the canvas width field and breakpoint buttons; the bar now reflows below 1280px so nothing overlaps.
* Fixed: another round of light-theme contrast — the footer snippet/variable panels and their configure column, the Run and Get data buttons, the New JS Snippet / New Data Variable popup, the class chips' caret and remove controls, the Navigator's New variable button, the component "Exit properties" bar, and the settings' description tiles.
* Fixed: SOON badges in native menus no longer sit on top of the row labels.

= 1.13.1 =
A canvas-loading fix for remembered panel widths.
* Fixed: with Resizable side panels on and a remembered panel width, the canvas painted at the default width and then visibly snapped narrower or wider about a second into loading the builder. The remembered width is now applied before the first paint, so the canvas opens at its final size.

= 1.13.0 =
Navigator row quick actions. Props to TRẦN ĐỨC LƯƠNG (@evanscliff) for the suggestion.
* New: Duplicate and Delete buttons appear on the Navigator row under your pointer or keyboard focus (Navigator tab, on by default), with full keyboard and screen-reader support — from a focused row, Tab reaches the buttons and Escape returns.
* Focus follows the action: to the copy after duplicating, to a neighbouring row after deleting.
* Delete asks for a confirming second press (the button turns solid red and renames to "Confirm delete") and remains undoable with Ctrl/Cmd+Z while Undo delete is on.
* A sub-setting can pin the buttons to the selected row instead of showing them on hover.
* Fixed: in the light theme, an element's display-conditions view (the settings panel's conditions mode) rendered dark-on-dark — the "New condition" button, the condition cards, the separators, the date/time fields, and the comparison, value and multi-value pickers all kept their native dark surfaces. All now follow the light theme; dark is unchanged. Props to Tim Gray (@snipkin) for the report.
* New: Display-condition helpers (Editing tab, on by default) — opens a blank, ready-to-choose condition when an element has none yet (removed again if you leave without touching it), gives every condition field a proper screen-reader label, and marks elements that carry conditions: a dot and count on the conditions button, and a dot on their Navigator rows that screen readers announce.
* Improved: the multi-value condition pickers are now keyboard-operable — the picker is focusable and announces itself, Enter or the arrows open it, Space ticks a value, and Escape closes and returns.
* Fixed: the dynamic data picker (the stack-icon pop-up, shared with the CSS vars and transformation-function lists) rendered black-on-black in the light theme wherever it appeared — including its hovered and keyboard-focused items; it now follows the theme, dark unchanged. Its controls also gained the visible focus ring they were missing in both themes.

= 1.12.4 =
Fixes for the CSS vars tab and the detachable Navigator, plus label polish.
* Fixed: opening the Navigator's CSS vars tab hid the left settings panel and made the panel widths flicker; with the Navigator detached, the same tab left the canvas squeezed beside the empty dock.
* Improved: the canvas glides open and closed with the Navigator when detaching or docking (instant under reduced motion), and the preview drag handles report the correct width range to assistive technology.
* Changed: the keyboard-shortcuts overlay shows your own platform's keys (⇧⌘D-style glyphs on a Mac), no longer lists the withdrawn multi-select shortcuts, and the Auto-BEM and command-palette labels are tidied.

= 1.12.3 =
Hotfixes for the tree context menu's actions and the light-theme toasts.
* Fixed: the plugin's context-menu actions (Auto-BEM, Rename, Wrap in and the rest) did nothing and left the menu open, and Cut could paste a stray copy.
* Fixed: light-theme notification toasts drew almost-black text on a black card.

= 1.12.2 =
A multisite activation fix, two favourites bar repairs, and screen-reader landmarks.
* Fixed: network-activated installs with Builderius activated per site wrongly reported Builderius as inactive.
* Fixed: light-theme favourites icons carried a heavy dark outline, and the strip spilt over the tree footer while a footer panel was open.
* New: each major part of the builder is exposed as a named landmark region, the way the block editor's regions work.

= 1.12.1 =
Repairs around the native "hide side panels" toggle, an opt-in keyboard route into the Save options menu, and a tidier settings screen.
* Fixed: the builder's own "hide side panels" button looked dead, preview resize drags collapsed partway with panels hidden, and opening the Save dropdown cleared the "Unsaved" marker.
* New (experimental, off by default): a keyboard-reachable "Save options" button beside Save.
* Improved: the settings screen shows one concise line per feature, with the full explanation behind an info button.

= 1.12.0 =
A quality release across the board: Cmd/Ctrl+S to save, a faster and lighter builder chrome, reduced-motion support, and a long list of robustness and screen-reader fixes.
* New: press Cmd/Ctrl+S to save the template from anywhere in the builder.
* Improved: the builder chrome script is served as a normal cacheable file, the busiest interface work does far less per change, and all animations respect "reduce motion".
* Fixed: sticky "Unsaved" markers, shortcuts going quiet after an interrupted rename, stray blank attribute rows, silent footer re-render failures, and several screen-reader counts and names.

Older releases are documented in CHANGELOG.md in the plugin repository.

== Upgrade Notice ==

= 1.13.0 =
Adds Navigator row quick actions: accessible Duplicate and Delete buttons on the hovered or focused Navigator row, on by default. Toggle or tune it under Builderius → Builder Enhancements → Navigator.
