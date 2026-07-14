=== Daveden Builder Enhancements ===
Contributors: daveden2
Tags: builderius, page builder, accessibility, admin, editor
Requires at least: 6.4
Tested up to: 7.0
Stable tag: 1.13.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Quality-of-life, theming and accessibility enhancements for the Builderius builder UI, each behind its own toggle.

== Description ==

Daveden Builder Enhancements refines the Builderius builder's own interface with independent toggles across six areas: appearance and theming (light / dark / auto, density, design tokens), a friendlier Navigator (search, keyboard tree, row quick actions, detachable panel), editing tools (a flatter right-click menu, wrap and unwrap, inline rename, undo/redo, element shortcuts and a command palette), Styles-panel helpers, and workflow extras such as Cmd/Ctrl+S to save. Keyboard and screen-reader access is a design goal throughout.

Everything is configured under **Builderius → Builder Enhance**, and every feature can be switched off without affecting the rest.

The plugin targets Builderius 1.3.5-beta and requires Builderius to be active. The plugin directory name must contain "builderius" — see the header docblock in `daveden-builderius-enhancements.php` and the FAQ below.

= Credits =

Several features were suggested by the Builderius and the wider web design community. Thank you:

* Inline rename — Israel Reyes and Tim Gray
* Follow selection in the tree — Israel Reyes
* HTML attribute helpers — Tim Gray
* Detachable Navigator — Tim Gray
* Density toggle (compact mode) — Max Ziebell
* Light / dark / auto theme — David McCan
* Navigator row quick actions — TRẦN ĐỨC LƯƠNG (@evanscliff)

Suggested a feature that shipped? Open an issue on GitHub to be credited.

== Installation ==

1. Download the latest release zip from the GitHub repository and install it via Plugins → Add New Plugin → Upload Plugin (or unzip it into `wp-content/plugins/`, keeping the folder name).
2. Make sure Builderius is installed and active, then activate the plugin.
3. Adjust the toggles under Builderius → Builder Enhance — sensible defaults are on out of the box.

== Frequently Asked Questions ==

= Why must the plugin folder keep "builderius" in its name? =

Builderius' builder mode removes the hooks of every plugin it does not recognise. A folder name containing "builderius" is what keeps this plugin's enhancements alive inside the builder; rename the folder and the plugin goes quiet there.

= Do I need Builderius Pro? =

No. A few features enhance Pro-only surfaces (such as the CSS code editor helpers); those are marked on the settings screen and simply stay unavailable without Pro.

= How do I suggest a feature or report a bug? =

Open an issue on the GitHub repository. Suggestions that ship are credited in this readme.

== Changelog ==

A short summary of recent releases. The full, detailed notes for every release live in CHANGELOG.md in the plugin repository.

= 1.13.0 =
Navigator row quick actions. Props to TRẦN ĐỨC LƯƠNG (@evanscliff) for the suggestion.
* New: Duplicate and Delete buttons appear on the Navigator row under your pointer or keyboard focus (Navigator tab, on by default), with full keyboard and screen-reader support — from a focused row, Tab reaches the buttons and Escape returns.
* Focus follows the action: to the copy after duplicating, to a neighbouring row after deleting.
* Delete asks for a confirming second press (the button turns solid red and renames to "Confirm delete") and remains undoable with Ctrl/Cmd+Z while Undo delete is on.
* A sub-setting can pin the buttons to the selected row instead of showing them on hover.
* Fixed: in the light theme, an element's display-conditions view (the settings panel's conditions mode) rendered dark-on-dark — the "New condition" button, the condition cards, the separators, the date/time fields, and the comparison, value and multi-value pickers all kept their native dark surfaces. All now follow the light theme; dark is unchanged.
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
Adds Navigator row quick actions: accessible Duplicate and Delete buttons on the hovered or focused Navigator row, on by default. Toggle or tune it under Builderius → Builder Enhance → Navigator.
