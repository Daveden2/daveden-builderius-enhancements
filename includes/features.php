<?php
/**
 * Feature registry — the single source of truth.
 *
 * Every toggle the plugin offers is described here once. The settings page,
 * default options, sanitisation, builder CSS concatenation and the JS config
 * object are all derived from this array — add a feature here and it appears
 * everywhere.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

/**
 * Settings-page tabs, in display order.
 *
 * @return array<string,string> slug => label.
 */
function dbe_tabs() {
	return array(
		'dashboard'  => __( 'Dashboard', 'daveden-builderius-enhancements' ),
		'appearance' => __( 'Appearance', 'daveden-builderius-enhancements' ),
		'navigator'  => __( 'Navigator', 'daveden-builderius-enhancements' ),
		'editing'    => __( 'Editing', 'daveden-builderius-enhancements' ),
		'styles'     => __( 'Styles panel', 'daveden-builderius-enhancements' ),
		'workflow'   => __( 'Workflow', 'daveden-builderius-enhancements' ),
	);
}

/**
 * The feature registry.
 *
 * Each entry:
 * - title/description: settings-page copy.
 * - tab:  settings-page tab slug (see dbe_tabs()).
 * - css:  builder CSS files (assets/builder/css/) emitted when enabled.
 * - shared_css: infrastructure files this feature also needs (01-infra's
 *         toast + hidden auto menu, 02-nav-layout's Navigator flex layout,
 *         30-context-menu's injected item / flyout chrome). Shared files are
 *         deduplicated across features by dbe_builder_css_files(); 00-tokens
 *         is emitted whenever anything at all is on and is not listed here.
 * - js:   whether the toggle is exposed to builder.js via the config object.
 *
 * @return array<string,array<string,mixed>>
 */
function dbe_features() {
	return array(
		/* ---------------------------------------------------------- Appearance */
		'design_tokens'         => array(
			'title'       => __( 'Typography & design tokens', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'One consistent typeface and tidier labels across the builder.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Applies one consistent typeface across the builder and tidies field labels, group headings and panel shadows to match.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '10-typography.css' ),
			'js'          => false,
		),
		'tab_styling'           => array(
			'title'       => __( 'Tab styling', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Clear accent underlines on every tab in the builder.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Gives every tab in the builder a clear underline in the accent colour (panel tabs, document tabs, scope switchers and settings tabs), and widens the search field in the CSS vars tab.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '11-tabs.css' ),
			'js'          => false,
		),
		'search_affordance'     => array(
			'title'       => __( 'Search field icons', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Adds the missing magnifying-glass icons to search fields.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds a magnifying-glass icon to the builder search fields that lack one (the Navigator filter and the CSS vars search) so each reads as a search box at a glance. The Inserter search keeps its own built-in icon.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '73-search-affordance.css' ),
			'js'          => false,
		),
		'controls_styling'      => array(
			'title'       => __( 'Controls styling', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Restyles buttons, inputs and dropdowns with accessible contrast.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Restyles buttons, inputs, dropdowns, segmented radios and the element inserter with the plugin\'s colour palette, meeting WCAG AA contrast.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '12-controls.css' ),
			'js'          => false,
		),
		'focus_visibility'      => array(
			'title'       => __( 'Focus visibility', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'A visible focus ring on every control.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Shows a visible focus ring on every interactive control in the builder, as required by WCAG 2.4.7.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '13-focus.css' ),
			'js'          => false,
		),
		'tree_row_styling'      => array(
			'title'       => __( 'Navigator row styling', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Larger, easier-to-scan Navigator rows.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Makes Navigator rows larger and easier to scan, with clear hover and selected states. The decorative drag-handle strip is removed; dragging still works.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '14-tree-rows.css' ),
			'js'          => true,
		),
		'theme_switcher'        => array(
			'title'       => __( 'Theme switcher (light / dark / auto)', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Light, dark or follow-the-OS builder theme.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds a top-bar button that switches the builder between light and dark themes, or follows your operating system automatically.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '60-theme.css' ),
			'shared_css'  => array( '03-topbar-layout.css' ),
			'js'          => true,
		),
		'density_toggle'        => array(
			'title'       => __( 'Density toggle', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Comfortable or compact spacing, switched from the top bar.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds a top-bar button that switches panel and Navigator spacing between comfortable and compact.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '62-density.css' ),
			'shared_css'  => array( '03-topbar-layout.css' ),
			'js'          => true,
		),
		'topbar_toolbar'        => array(
			'title'       => __( 'Top-bar keyboard groups', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Screen-reader grouping and arrow keys for the top-bar controls.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Gives the top-bar control clusters proper grouping for screen readers and keyboard users: the breakpoint switcher becomes a radio group (announces which breakpoint is current, arrow keys move and select it, one Tab stop), and the canvas width and zoom fields are grouped and labelled.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => false,
			'js'          => true,
		),
		'footer_toolbar'        => array(
			'title'       => __( 'Bottom-bar keyboard toolbar', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Makes the bottom tool bar one Tab stop with arrow keys.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Wires the bottom bar of editor tools (Custom CSS, JavaScript, Dynamic Data, Sense AI and so on) as a keyboard toolbar: one Tab stop with arrow-key navigation, each tool announces whether its panel is open, the shared panel is a labelled group, and locked tools are announced as such. Also wires the Global / Template scope tabs inside the JavaScript and Dynamic Data tools as a vertical tab list.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => false,
			'shared_css'  => array( '04-menu-anchor.css' ),
			'js'          => true,
		),
		'select_combobox'       => array(
			'title'       => __( 'Accessible select comboboxes', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Keyboard and screen-reader support for the custom selects.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Makes the builder\'s custom select popovers (the preview picker, the responsive-strategy select, the element HTML-tag select and others) usable with a screen reader and the keyboard: proper combobox / listbox / option roles, one Tab stop, and arrow keys to move through the options with Enter to choose. Purely additive — typing to filter and clicking to choose are left to Builderius.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array( '77-select-combobox.css' ),
			'js'          => true,
		),
		'ai_terminal_tabs'      => array(
			'title'       => __( 'Accessible AI session tabs', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Proper tabs and keyboard access for the Sense AI sessions.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Wires the Sense AI terminal session tabs (Claude Code, Gemini CLI and so on) as a proper tab list for screen readers and the keyboard: the tabs announce which session is active, arrow keys move between them and switch with one Tab stop, the terminal below is exposed as their tab panel, and the "new session" button gets a clear name in place of its bare plus sign, plus a proper pop-up menu (arrow keys to choose an agent, Escape to close). Purely additive: clicking to switch is left to Builderius.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => false,
			'js'          => true,
		),
		'panel_tabs'            => array(
			'title'       => __( 'Accessible panel tabs', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Arrow-key tab strips in the settings panel and Navigator.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Wires the panel tab strips as proper tab lists for screen readers and the keyboard: the settings panel\'s Content / Styles tabs and the Navigator\'s Elements / Selectors / CSS vars tabs. Each tab announces that it is a tab and whether it is current, and each strip becomes one Tab stop where the arrow keys move between the tabs and switch them (Home and End jump to the first and last).', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => false,
			'js'          => true,
		),
		'settings_accordions'   => array(
			'title'       => __( 'Accessible settings groups', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Keyboard and screen-reader access for the settings-panel groups.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Makes the element settings panel\'s collapsible groups (Primary, Advanced, Attributes and so on) usable from the keyboard and a screen reader. Each group heading becomes a real Tab stop that announces itself as a button and whether its group is open, and Enter or Space opens and closes it. Without this the headings cannot take keyboard focus at all, so the settings inside a collapsed group are unreachable without a mouse.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array( '84-settings-accordions.css' ),
			'js'          => true,
		),
		'chrome_landmarks'      => array(
			'title'       => __( 'Screen-reader landmarks', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Named landmark regions for each part of the builder.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Marks each part of the builder as a named landmark region for screen readers: the top toolbar, the element library / element settings panel, the canvas, the Navigator and the footer bar. You can then jump straight to a section from the screen reader\'s landmark list or with its region-jump keys, the way the WordPress block editor\'s regions work.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => false,
			'js'          => true,
		),

		/* ----------------------------------------------------------- Navigator */
		'tag_badges'            => array(
			'title'       => __( 'HTML tag badges', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Shows each element\'s HTML tag in the Navigator.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Shows each element\'s HTML tag (such as <section>) next to its label in the Navigator, in place of its first CSS class.', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '20-tag-badges.css' ),
			'js'          => true,
		),
		'icon_declutter'        => array(
			'title'       => __( 'Tidier Navigator icons', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Hides repeated Navigator icons, keeping the meaningful ones.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Hides the repeated element-type icons in the Navigator, keeping only the ones that carry meaning (Collections and Templates).', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '21-icon-declutter.css' ),
			'js'          => true,
		),
		'collapse_expand_all'   => array(
			'title'       => __( 'Collapse & expand buttons', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'One-click expand or collapse of the whole tree.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds two buttons to the Navigator header: one expands every row, the other collapses the tree down to its top-level sections.', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '22-nav-header.css' ),
			'shared_css'  => array( '02-nav-layout.css', '30-context-menu.css' ),
			'js'          => true,
		),
		'tree_search'           => array(
			'title'       => __( 'Navigator search', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'A filter box for the Navigator tree.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds a filter box above the tree that dims any row whose label or HTML tag does not match what you type.', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '70-tree-search.css' ),
			'shared_css'  => array( '02-nav-layout.css' ),
			'js'          => true,
		),
		'favourites_reorder'    => array(
			'title'       => __( 'Rearrange favourites', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Drag or arrow-key reordering of the favourites bar.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds a rearrange button to the favourites bar. Drag the icons, or use the arrow keys, to put them in your preferred order; the order is remembered in your browser.', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '23-favourites-reorder.css' ),
			'shared_css'  => array( '02-nav-layout.css' ),
			'js'          => true,
		),
		'reveal_selected'       => array(
			'title'       => __( 'Follow selection in the tree', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'The tree opens and scrolls to whatever you select.', 'daveden-builderius-enhancements' ),
			'description' => __( 'When you click an element in the preview, the Navigator opens the branches down to it and scrolls it into view, so your selection is never hidden in a collapsed part of the tree.', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array(),
			'js'          => true,
		),
		'navigator_keyboard'    => array(
			'title'       => __( 'Navigator keyboard tree', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Full arrow-key navigation of the tree, WordPress style.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Makes the Navigator behave like the WordPress list view: the arrow keys move through the elements (the canvas selection follows), the right arrow opens a branch and steps into it, the left arrow closes it and steps out to the parent, and Home and End jump to the first and last. The tree is exposed to screen readers as a proper tree, so each element announces its level, whether it is expanded, and its position.', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '79-navigator-keyboard.css' ),
			'js'          => true,
		),
		'navigator_row_actions' => array(
			'title'       => __( 'Navigator row quick actions', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Duplicate and Delete buttons on the hovered or focused row.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Shows Duplicate and Delete buttons at the right edge of a Navigator row when you point at it or move keyboard focus onto it. From a focused row, Tab reaches the buttons and Escape returns to the row; after duplicating, focus lands on the copy, and after deleting it moves to a neighbouring row. Delete asks for a confirming second press, and remains undoable with Ctrl/Cmd+Z while Undo delete is on. Can also be set to sit permanently on the selected row.', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '83-row-actions.css' ),
			'shared_css'  => array( '01-infra.css' ),
			'js'          => true,
		),
		'panel_detach'          => array(
			'title'        => __( 'Detachable Navigator', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'Float the Navigator over the canvas.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Adds a detach button to the Navigator header so you can float the panel over the canvas. Drag it by its header, resize it from the bottom corner, and dock it again with the same button. Its position is remembered. Experimental: it floats the panel over the builder chrome, so a Builderius update could shift it.', 'daveden-builderius-enhancements' ),
			'tab'          => 'navigator',
			'css'          => array( '76-panel-detach.css' ),
			'js'           => true,
			'experimental' => true,
		),

		/* ------------------------------------------------------------- Editing */
		'context_menu'          => array(
			'title'       => __( 'Right-click menu enhancements', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'A flatter, keyboard-friendly right-click menu.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Reorganises the Navigator right-click menu into one flat, logically grouped list, so everyday actions are one click away. Includes full keyboard support (arrow keys, Home/End, Escape) and keeps submenus only where an action branches (Wrap in…, Save to…). Also adds a right-click copy and remove menu to the class chips in the Styles editor.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array(),
			'shared_css'  => array( '30-context-menu.css' ),
			'js'          => true,
		),
		'wrap_in'               => array(
			'title'       => __( 'Wrap in… / Unwrap', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Wrap elements in a div, template or collection - and unwrap.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Right-click an element to wrap it in a div, a template or a collection with template. Unwrap does the reverse: it moves the children up one level and removes the empty wrapper.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array(),
			'shared_css'  => array( '01-infra.css', '30-context-menu.css' ),
			'js'          => true,
		),
		'element_moves'         => array(
			'title'       => __( 'Move & navigate elements', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Move up, move down and select parent in the right-click menu.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds Move up, Move down and Select parent to the right-click menu, so you can reorder an element among its siblings or step the selection up a level.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array(),
			'js'          => true,
		),
		'inline_rename'         => array(
			'title'       => __( 'Inline rename', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Rename an element directly on its Navigator row.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Lets you rename an element directly on its Navigator row from the right-click menu, or reset its label to the default (its HTML tag).', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array( '32-rename.css' ),
			'shared_css'  => array( '01-infra.css', '30-context-menu.css' ),
			'js'          => true,
		),
		'dblclick_rename'       => array(
			'title'       => __( 'Double-click to rename', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Double-click a row to rename it.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Double-click an element\'s Navigator row to rename it in place, without opening the right-click menu.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array( '32-rename.css' ),
			'js'          => true,
		),
		'undo_delete'           => array(
			'title'       => __( 'Undo / redo add & delete', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Cmd/Ctrl+Z restores deleted elements and undoes adds.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Press Cmd/Ctrl+Z to undo adding or deleting an element: a deleted element is restored, and one you just added is removed. Add Shift (Cmd/Ctrl+Shift+Z) to redo. A brief message confirms each step. Moving elements and changing their settings are not covered.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array(),
			'shared_css'  => array( '01-infra.css' ),
			'js'          => true,
		),

		/*
		 * 'multi_select' is temporarily withdrawn (6 Jul 2026): the multi-row
		 * drag never reliably carried the whole selection, so the option is
		 * removed from the registry — it no longer appears in settings and its
		 * JS/CSS are not wired. The supporting code (bindMultiSelect /
		 * bindMultiDrag / removeMulti / the context-menu multi branches) is
		 * parked in place; restore this entry to bring the feature back.
		 */

		'properties_reorder'    => array(
			'title'       => __( 'Rearrange component properties', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Drag or arrow-key reordering of component properties.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds a rearrange button to a component\'s properties panel. Drag the properties, or use the arrow keys, to change their order; the new order is saved with the component.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array( '24-properties-reorder.css' ),
			'js'          => true,
		),
		'attr_helpers'          => array(
			'title'       => __( 'HTML attribute helpers', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'A ready-to-type attribute row plus common-name suggestions.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Opens a blank, ready-to-type row when an element has no HTML attributes yet (it is removed again if left empty), and suggests common attribute names such as id, role, aria-* and data-*.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array( '34-attr-helpers.css' ),
			'js'          => true,
		),
		'image_defaults'        => array(
			'title'       => __( 'Image placeholder & default alt', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'New Image elements get a visible placeholder and an alt attribute.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Gives a newly inserted Image element a built-in placeholder graphic (an inline SVG, no file involved) so it is visible on the canvas straight away, and an empty alt attribute so the image is never missing one — empty alt marks it as decorative until you write the real text. Choosing an image from the media library replaces the placeholder, and the alt attribute is filled from the media library\'s alt text when one is set.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array(),
			'js'          => true,
		),
		'condition_helpers'     => array(
			'title'       => __( 'Display-condition helpers', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'A ready blank condition, labelled fields, and cues where conditions exist.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Helps with an element\'s display conditions (the settings panel\'s conditions mode). Opens a blank, ready-to-choose condition when an element has none yet (it is removed again if you leave without touching it), gives every condition field a proper screen-reader label, makes the multi-value pickers keyboard-operable, and marks elements that carry conditions: a dot on the conditions button and on their Navigator rows, announced to screen readers.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array( '36-conditions.css' ),
			'js'          => true,
		),
		'inserter_keyboard'     => array(
			'title'       => __( 'Inserter keyboard navigation', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Arrow-key navigation of the element Inserter.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Makes the element Inserter navigable from the keyboard the way the WordPress block inserter is: each category is one Tab stop, the arrow keys move between the elements within a category (Home and End jump to its first and last), and Enter or Space inserts. Without it, reaching a lower category means tabbing through every element above it.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array( '78-inserter-keyboard.css' ),
			'js'          => true,
		),
		'builderius_menu'       => array(
			'title'       => __( 'Accessible Builderius menu', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Keyboard and screen-reader access for the Builderius menu.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Makes the Builderius menu (the sidebar of templates, pages, components and admin links) usable from the keyboard and a screen reader. The menu button announces that it opens the menu, focus moves into it when it opens, and it is exposed as a tree: the arrow keys move between the collapsible category headings and their items, the right and left arrows open and close a category, Enter or Space toggles a heading or opens an item, Home and End jump to the ends, and Escape (or the panel’s Close button) closes the menu and returns focus to the button.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array( '80-builderius-menu.css' ),
			'js'          => true,
		),
		'keyboard_shortcuts'    => array(
			'title'        => __( 'Element keyboard shortcuts', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'Block-editor-style shortcuts for the selected element.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Adds keyboard shortcuts, in the style of the WordPress block editor, for the element selected in the Navigator: duplicate (Cmd/Ctrl+Shift+D), cut (Cmd/Ctrl+X), add an element before or after it (Cmd/Ctrl+Opt/Alt+T / Cmd/Ctrl+Opt/Alt+Y, via a quick element picker) and rename (F2). The new actions also appear in the right-click menu. Plus shortcuts to jump between the builder’s regions (the Navigator, settings panel, canvas and Inserter). Experimental: Builderius is adding its own shortcuts, so this may overlap or be retired.', 'daveden-builderius-enhancements' ),
			'tab'          => 'editing',
			'css'          => array( '32-rename.css', '81-keyboard-shortcuts.css' ),
			'shared_css'   => array( '01-infra.css', '30-context-menu.css' ),
			'js'           => true,
			'experimental' => true,
		),
		'command_palette'       => array(
			'title'        => __( 'Command palette', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'A searchable command palette on Cmd/Ctrl+K, with a top-bar button.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Press Cmd/Ctrl+K (the shortcut is changeable below) or use the palette button in the top bar for a searchable command palette. With an element selected it can add classes, add HTML attributes and add child elements with a minimal Emmet syntax (e.g. section.hero>h1{Title}+p{Lead}), plus run the element actions and jump between the builder’s regions. Experimental.', 'daveden-builderius-enhancements' ),
			'tab'          => 'editing',
			'css'          => array( '82-command-palette.css' ),
			'shared_css'   => array( '01-infra.css', '03-topbar-layout.css', '30-context-menu.css' ),
			'js'           => true,
			'experimental' => true,
		),

		/* -------------------------------------------------------- Styles panel */
		'css_code_default'      => array(
			'title'        => __( 'CSS code editor by default', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'Opens the Styles tab straight into the CSS code editor.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Opens the Styles tab straight into the CSS code editor and keeps the Content and Styles tabs visible while you are there. (To widen the panel for more room, use the Resizable side panels feature.) Requires Builderius Pro: the CSS code editor is a Pro feature, so this stays off (and the CSS-mode icon is left in place) when Pro is inactive.', 'daveden-builderius-enhancements' ),
			'tab'          => 'styles',
			'css'          => array( '40-css-code-default.css' ),
			'js'           => true,
			'requires_pro' => true,
		),
		'scope_bar'             => array(
			'title'        => __( 'CSS scope bar', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'Shows and switches where CSS edits are saved.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Shows where your CSS edits will be saved (local, global or template) and adds an instant Global/Template switch, directly in the Styles code editor. Also keeps the editor honest: it shows only the active scope’s rules for the selected class, so global and template CSS never look merged, and it hides the other scope’s rules (with a one-click switch) instead of letting you fork them by mistake. Adds an “All CSS” button that jumps to the full stylesheet for the active scope (the same view as Selectors → All CSS) and highlights where the current selector’s rules sit within it. Requires Builderius Pro: global and template CSS scopes, and the code editor it sits in, are Pro features.', 'daveden-builderius-enhancements' ),
			'tab'          => 'styles',
			'css'          => array( '41-scope-bar.css', '43-scope-isolation.css' ),
			'shared_css'   => array( '30-context-menu.css' ),
			'js'           => true,
			'requires_pro' => true,
		),
		'auto_bem'              => array(
			'title'       => __( 'Auto-BEM', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Suggested BEM class names for an element and its children.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Right-click an element and choose Auto-BEM to get suggested block and element class names (such as hero, hero__title and hero__image) for it and everything inside it. Edit any suggestion, then apply them all in one go.', 'daveden-builderius-enhancements' ),
			'tab'         => 'styles',
			'css'         => array( '33-auto-bem.css' ),
			'shared_css'  => array( '01-infra.css', '30-context-menu.css' ),
			'js'          => true,
		),

		'hide_minimap'          => array(
			'title'        => __( 'Hide the code minimap', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'Removes the code editor\'s minimap strip.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Removes the minimap (the small code-overview strip on the right of the CSS code editor) and reclaims the width Monaco reserves for it, so long lines run to the edge of the panel. It switches the editor option off inside the builder\'s bundled Monaco; if a Builderius update ever changes that, it falls back to simply hiding the minimap from view.', 'daveden-builderius-enhancements' ),
			'tab'          => 'styles',
			'css'          => array( '42-minimap.css' ),
			'js'           => true,
			'experimental' => true,
		),
		'css_hint_dialog'       => array(
			'title'       => __( 'Tidy selector hint', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'A compact, dismissable hint under the CSS editor.', 'daveden-builderius-enhancements' ),
			// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment -- %local% and %selector% are literal Builderius tokens shown to the user, not printf placeholders.
			'description' => __( 'Replaces Builderius’ two-line %local% / %selector% notification under the CSS editor with a compact, dismissable hint, reclaiming the vertical space for the editor. The full explanation moves into a dialog and is reworded so both tokens are described consistently and breakpoints are explained the same way for each (the stock wording differs between them).', 'daveden-builderius-enhancements' ),
			'tab'         => 'styles',
			'css'         => array( '44-css-hint.css' ),
			'js'          => true,
		),

		/* ------------------------------------------------------------ Workflow */
		'tooltips'              => array(
			'title'       => __( 'Tooltips & accessible names', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Tooltips and names for the unlabelled icon buttons.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds tooltips and accessible names to around 25 icon-only builder buttons that ship without either.', 'daveden-builderius-enhancements' ),
			'tab'         => 'workflow',
			'css'         => array( '50-tooltips.css' ),
			'js'          => true,
		),
		'shortcuts_overlay'     => array(
			'title'       => __( 'Keyboard shortcuts overlay', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Press ? for a list of keyboard shortcuts.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Press ? in the builder to see a list of keyboard shortcuts, both the native ones and those added by this plugin.', 'daveden-builderius-enhancements' ),
			'tab'         => 'workflow',
			'css'         => array( '71-shortcuts.css' ),
			'js'          => true,
		),
		'save_state_cue'        => array(
			'title'       => __( 'Unsaved-changes marker', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'An unsaved-changes marker beside the Save button.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Shows an “Unsaved” marker next to the Save button whenever the template has changes that would be lost on reload.', 'daveden-builderius-enhancements' ),
			'tab'         => 'workflow',
			'css'         => array( '72-save-cue.css' ),
			'shared_css'  => array( '03-topbar-layout.css' ),
			'js'          => true,
		),
		'save_shortcut'         => array(
			'title'       => __( 'Save with Cmd/Ctrl+S', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Cmd/Ctrl+S saves the template.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Saves the template with Cmd/Ctrl+S, the shortcut every editor trains into your fingers, instead of opening the browser’s save-page dialog. It works wherever you are in the builder, including the code editors, just like the WordPress block editor.', 'daveden-builderius-enhancements' ),
			'tab'         => 'workflow',
			'css'         => false,
			'js'          => true,
		),
		'save_split_button'     => array(
			'title'        => __( 'Keyboard access for the Save options menu', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'Opt-in keyboard access for the Save options menu.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Builderius draws the Save button’s dropdown trigger inside the Save button itself, where no keyboard or screen reader can reach it — the Save to Development / Publish to Live menu is mouse-only. This replaces that trigger with a real button beside Save (announced as a menu, arrow keys inside, Escape to close). Experimental and off by default: it restyles a core control, and the proper fix belongs in Builderius (reported upstream) — this is a stopgap for keyboard users until then.', 'daveden-builderius-enhancements' ),
			'tab'          => 'workflow',
			'css'          => array( '35-save-menu.css' ),
			'shared_css'   => array( '03-topbar-layout.css' ),
			'js'           => true,
			'experimental' => true,
		),
		'presence_heartbeat'    => array(
			'title'       => __( 'Second-tab warning', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'An admin-bar edit link plus a second-tab warning.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds an “Edit template” link to the admin bar on the front end, and warns you before the builder opens in a second tab.', 'daveden-builderius-enhancements' ),
			'tab'         => 'workflow',
			'css'         => array(),
			'js'          => true,
		),
		'preview_resize'        => array(
			'title'        => __( 'Preview resize handles', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'Drag handles to resize the preview canvas.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Adds drag handles to both edges of the preview so you can resize it around the centre, which is handy for container-query work. The width readout updates as you drag and the matching breakpoint lights up as you cross it; past your widest breakpoint you can keep dragging to preview any width up to the full canvas. Experimental: above your widest breakpoint the builder has no canvas size of its own, so the handle sizes the canvas itself — a Builderius update could affect that.', 'daveden-builderius-enhancements' ),
			'tab'          => 'workflow',
			'css'          => array( '74-preview-resize.css' ),
			'js'           => true,
			'experimental' => true,
		),
		'panel_resize'          => array(
			'title'       => __( 'Resizable side panels', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Drag to set the side panels\' width.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds a drag handle to the inner edge of each side panel so you can set their width. The settings panel and the Navigator share one width, so resizing either resizes both. Your chosen width is remembered. Replaces the old one-shot "widen settings panel" button.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '75-panel-resize.css' ),
			'js'          => true,
		),
		'overlay_contrast'      => array(
			'title'       => __( 'Preview overlay contrast fix', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Readable labels on the canvas hover and selection overlays.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Fixes the label colours on the preview\'s hover and selection overlays, so you can tell the two apart and the labels meet WCAG AA contrast.', 'daveden-builderius-enhancements' ),
			'tab'         => 'workflow',
			'css'         => array(),
			'js'          => false,
		),
	);
}

/**
 * Non-boolean settings (rendered as selects under their parent feature).
 *
 * @return array<string,array<string,mixed>>
 */
function dbe_enum_settings() {
	return array(
		'theme_default'    => array(
			'parent'  => 'theme_switcher',
			'title'   => __( 'Default theme', 'daveden-builderius-enhancements' ),
			'choices' => array(
				'auto'  => __( 'Auto (follows the operating system)', 'daveden-builderius-enhancements' ),
				'light' => __( 'Light', 'daveden-builderius-enhancements' ),
				'dark'  => __( 'Dark', 'daveden-builderius-enhancements' ),
			),
			'default' => 'auto',
		),
		'density_default'  => array(
			'parent'  => 'density_toggle',
			'title'   => __( 'Default density', 'daveden-builderius-enhancements' ),
			'choices' => array(
				'comfortable' => __( 'Comfortable', 'daveden-builderius-enhancements' ),
				'compact'     => __( 'Compact', 'daveden-builderius-enhancements' ),
			),
			'default' => 'comfortable',
		),
		'row_actions_mode' => array(
			'parent'  => 'navigator_row_actions',
			'title'   => __( 'Show the buttons', 'daveden-builderius-enhancements' ),
			'choices' => array(
				'hover'  => __( 'On hover or keyboard focus', 'daveden-builderius-enhancements' ),
				'always' => __( 'Always, on the selected row', 'daveden-builderius-enhancements' ),
			),
			'default' => 'hover',
		),
		// Ctrl+Shift+K, the palette's original shortcut, is reserved by Firefox
		// on Windows and Linux for the DevTools Web Console — the browser handles
		// it before the page ever sees the event, so it cannot be intercepted.
		// The default is now the widespread command-palette convention Cmd/Ctrl+K.
		'palette_shortcut' => array(
			'parent'  => 'command_palette',
			'title'   => __( 'Keyboard shortcut', 'daveden-builderius-enhancements' ),
			'choices' => array(
				'mod-k'       => __( 'Cmd/Ctrl+K (recommended)', 'daveden-builderius-enhancements' ),
				'mod-slash'   => __( 'Cmd/Ctrl+/', 'daveden-builderius-enhancements' ),
				'mod-shift-k' => __( 'Cmd/Ctrl+Shift+K (the old default; Firefox on Windows and Linux reserves it for the DevTools console)', 'daveden-builderius-enhancements' ),
			),
			'default' => 'mod-k',
		),
	);
}
