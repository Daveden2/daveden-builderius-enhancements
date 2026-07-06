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
 *         Shared/infrastructure files (00-tokens, 01-infra, 30-context-menu)
 *         are OR-gated in dbe_builder_css_files(), not listed per feature.
 * - js:   whether the toggle is exposed to builder.js via the config object.
 *
 * @return array<string,array<string,mixed>>
 */
function dbe_features() {
	return array(
		/* ---------------------------------------------------------- Appearance */
		'design_tokens'       => array(
			'title'       => __( 'Typography & design tokens', 'daveden-builderius-enhancements' ),
			'description' => __( 'Normalise the builder chrome to a single UI font, consistent field labels, group headers and elevation levels.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '10-typography.css' ),
			'js'          => false,
		),
		'tab_styling'         => array(
			'title'       => __( 'Tab styling', 'daveden-builderius-enhancements' ),
			'description' => __( 'Accent-underline tabs across the builder — panel tabs, document tabs, scope switchers, settings tab strips — plus a full-width search field in the CSS vars tab.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '11-tabs.css' ),
			'js'          => false,
		),
		'search_affordance'   => array(
			'title'       => __( 'Search field affordance', 'daveden-builderius-enhancements' ),
			'description' => __( 'A magnifier icon inside every chrome search field (Navigator filter, CSS vars search, panel-header search) so they read as search at a glance.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '73-search-affordance.css' ),
			'js'          => false,
		),
		'controls_styling'    => array(
			'title'       => __( 'Controls styling', 'daveden-builderius-enhancements' ),
			'description' => __( 'Restyle inserter tiles, inputs, selects, segmented radios and buttons with the token palette (WCAG AA contrast).', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '12-controls.css' ),
			'js'          => false,
		),
		'focus_visibility'    => array(
			'title'       => __( 'Focus visibility', 'daveden-builderius-enhancements' ),
			'description' => __( 'A visible focus ring on every interactive element in the builder chrome (WCAG 2.4.7).', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '13-focus.css' ),
			'js'          => false,
		),
		'tree_row_styling'    => array(
			'title'       => __( 'Navigator row styling', 'daveden-builderius-enhancements' ),
			'description' => __( 'Larger, scannable tree rows with hover/selected states, no decorative drag-handle strip (dragging still works).', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '14-tree-rows.css' ),
			'js'          => true,
		),
		'theme_switcher'      => array(
			'title'       => __( 'Theme switcher (light / dark / auto)', 'daveden-builderius-enhancements' ),
			'description' => __( 'A top-bar button that switches the builder chrome between light, dark and auto (follows the operating system).', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '60-theme.css' ),
			'js'          => true,
		),
		'density_toggle'      => array(
			'title'       => __( 'Density toggle', 'daveden-builderius-enhancements' ),
			'description' => __( 'A top-bar button that switches between comfortable and compact spacing for panels and tree rows.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '62-density.css' ),
			'js'          => true,
		),

		/* ----------------------------------------------------------- Navigator */
		'tag_badges'          => array(
			'title'       => __( 'HTML tag badges', 'daveden-builderius-enhancements' ),
			'description' => __( 'Show each element\'s HTML tag (e.g. <section>) next to its label in the Navigator instead of its first CSS class.', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '20-tag-badges.css' ),
			'js'          => true,
		),
		'icon_declutter'      => array(
			'title'       => __( 'Icon de-clutter', 'daveden-builderius-enhancements' ),
			'description' => __( 'Hide repetitive element-type icons in the Navigator, keeping them only where they carry meaning (Collections and Templates).', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '21-icon-declutter.css' ),
			'js'          => true,
		),
		'collapse_expand_all' => array(
			'title'       => __( 'Collapse & expand controls', 'daveden-builderius-enhancements' ),
			'description' => __( 'Navigator header buttons: expand all rows, and collapse subtrees while keeping the top-level document skeleton visible.', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '22-nav-header.css' ),
			'js'          => true,
		),
		'tree_search'         => array(
			'title'       => __( 'Navigator search', 'daveden-builderius-enhancements' ),
			'description' => __( 'A filter box above the tree that dims rows not matching the typed label or HTML tag.', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '70-tree-search.css' ),
			'js'          => true,
		),
		'favourites_reorder'  => array(
			'title'       => __( 'Rearrange favourites', 'daveden-builderius-enhancements' ),
			'description' => __( 'A rearrange button on the favourites bar switches into drag mode: drag the icons (or use the arrow keys) into your preferred order, remembered per browser.', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '23-favourites-reorder.css' ),
			'js'          => true,
		),

		/* ------------------------------------------------------------- Editing */
		'context_menu'        => array(
			'title'       => __( 'Context-menu enhancements', 'daveden-builderius-enhancements' ),
			'description' => __( 'Hover flyout submenus and full keyboard support (arrow keys, Home/End, Escape) for the Navigator right-click menu.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array(),
			'js'          => true,
		),
		'wrap_in'             => array(
			'title'       => __( 'Wrap in…', 'daveden-builderius-enhancements' ),
			'description' => __( 'Right-click an element (or a multi-selection of siblings) and wrap it in a div, template, or collection with template.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array(),
			'js'          => true,
		),
		'inline_rename'       => array(
			'title'       => __( 'Inline rename', 'daveden-builderius-enhancements' ),
			'description' => __( 'Rename an element directly on its Navigator row via the context menu, or reset its label back to the default (its HTML tag).', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array( '32-rename.css' ),
			'js'          => true,
		),
		'undo_delete'         => array(
			'title'       => __( 'Undo / redo delete', 'daveden-builderius-enhancements' ),
			'description' => __( 'Cmd/Ctrl+Z restores the last deleted element (Shift redoes it), with a status toast.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array(),
			'js'          => true,
		),
		'multi_select'        => array(
			'title'       => __( 'Multi-select', 'daveden-builderius-enhancements' ),
			'description' => __( 'Cmd/Ctrl+click and Shift+click select multiple Navigator rows for bulk remove or wrap.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array( '31-multi-select.css' ),
			'js'          => true,
		),

		/* -------------------------------------------------------- Styles panel */
		'css_code_default'    => array(
			'title'       => __( 'CSS code editor by default', 'daveden-builderius-enhancements' ),
			'description' => __( 'Open the Styles tab in the CSS code editor, keep the panel compact with an opt-in widen button, and keep Content/Styles tabs visible in code mode.', 'daveden-builderius-enhancements' ),
			'tab'         => 'styles',
			'css'         => array( '40-css-code-default.css' ),
			'js'          => true,
		),
		'scope_bar'           => array(
			'title'       => __( 'CSS scope bar', 'daveden-builderius-enhancements' ),
			'description' => __( 'A level indicator (local / global / template) and an instant Global–Template switch directly in the Styles code editor.', 'daveden-builderius-enhancements' ),
			'tab'         => 'styles',
			'css'         => array( '41-scope-bar.css' ),
			'js'          => true,
		),
		'scope_guard'         => array(
			'title'       => __( 'Scope guard', 'daveden-builderius-enhancements' ),
			'description' => __( 'Warns when the selector shown in the Styles editor keeps its saved rules in the other scope — the editor displays rules from both scopes, but edits save to the active one. Can also switch scope automatically. Tracks saved styles, so rules added since the last save index after the next save.', 'daveden-builderius-enhancements' ),
			'tab'         => 'styles',
			'css'         => array( '42-scope-guard.css' ),
			'js'          => true,
		),
		'auto_bem'            => array(
			'title'       => __( 'Bulk class naming', 'daveden-builderius-enhancements' ),
			'description' => __( 'Right-click an element for “Add class names…”: a dialog suggests flat block-element class names (e.g. hero, hero-title, hero-image) for the element and its subtree, editable per row, then applies them in one pass.', 'daveden-builderius-enhancements' ),
			'tab'         => 'styles',
			'css'         => array( '33-auto-bem.css' ),
			'js'          => true,
		),

		/* ------------------------------------------------------------ Workflow */
		'tooltips'            => array(
			'title'       => __( 'Tooltips & accessible names', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds tooltips and aria-labels to ~25 icon-only builder buttons that ship without either.', 'daveden-builderius-enhancements' ),
			'tab'         => 'workflow',
			'css'         => array( '50-tooltips.css' ),
			'js'          => true,
		),
		'shortcuts_overlay'   => array(
			'title'       => __( 'Keyboard shortcuts overlay', 'daveden-builderius-enhancements' ),
			'description' => __( 'Press ? in the builder for a dialog listing native and added keyboard shortcuts.', 'daveden-builderius-enhancements' ),
			'tab'         => 'workflow',
			'css'         => array( '71-shortcuts.css' ),
			'js'          => true,
		),
		'save_state_cue'      => array(
			'title'       => __( 'Unsaved-changes cue', 'daveden-builderius-enhancements' ),
			'description' => __( 'Shows an “Unsaved” marker by the Save button whenever the current template has changes that would be lost on reload.', 'daveden-builderius-enhancements' ),
			'tab'         => 'workflow',
			'css'         => array( '72-save-cue.css' ),
			'js'          => true,
		),
		'presence_heartbeat'  => array(
			'title'       => __( 'Second-tab warning', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds an “Edit template” admin-bar link on the front end and warns before opening the builder in a second tab.', 'daveden-builderius-enhancements' ),
			'tab'         => 'workflow',
			'css'         => array(),
			'js'          => true,
		),
		'preview_resize'      => array(
			'title'       => __( 'Preview resize handles', 'daveden-builderius-enhancements' ),
			'description' => __( 'Drag handles on both edges of the canvas resize it around the centre for container-query work — the width readout in the top bar updates live, and clicking a breakpoint button snaps back to that breakpoint.', 'daveden-builderius-enhancements' ),
			'tab'         => 'workflow',
			'css'         => array( '74-preview-resize.css' ),
			'js'          => true,
		),
		'overlay_contrast'    => array(
			'title'       => __( 'Canvas overlay contrast fix', 'daveden-builderius-enhancements' ),
			'description' => __( 'Fixes the hover/selection overlay label colours in the canvas so state is distinguishable and labels meet WCAG AA.', 'daveden-builderius-enhancements' ),
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
		'theme_default'   => array(
			'parent'  => 'theme_switcher',
			'title'   => __( 'Default theme', 'daveden-builderius-enhancements' ),
			'choices' => array(
				'auto'  => __( 'Auto (follow the operating system)', 'daveden-builderius-enhancements' ),
				'light' => __( 'Light', 'daveden-builderius-enhancements' ),
				'dark'  => __( 'Dark', 'daveden-builderius-enhancements' ),
			),
			'default' => 'auto',
		),
		'density_default' => array(
			'parent'  => 'density_toggle',
			'title'   => __( 'Default density', 'daveden-builderius-enhancements' ),
			'choices' => array(
				'comfortable' => __( 'Comfortable', 'daveden-builderius-enhancements' ),
				'compact'     => __( 'Compact', 'daveden-builderius-enhancements' ),
			),
			'default' => 'comfortable',
		),
		'scope_guard_mode' => array(
			'parent'  => 'scope_guard',
			'title'   => __( 'When the rules live in the other scope', 'daveden-builderius-enhancements' ),
			'choices' => array(
				'warn' => __( 'Show a warning with a switch button', 'daveden-builderius-enhancements' ),
				'auto' => __( 'Switch scope automatically', 'daveden-builderius-enhancements' ),
			),
			'default' => 'warn',
		),
	);
}
