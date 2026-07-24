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
 * Headline capabilities staged for later 2.x release lines.
 *
 * The current integration history contains the already-tested implementation
 * of these features, but the public roadmap introduces them one minor release
 * at a time. This map is the single availability boundary used by settings,
 * runtime output and server-side registration.
 *
 * @return array<string,string> Capability id => first available major.minor.
 */
function dbe_release_availability() {
	return array(
		'agent_abilities' => '2.1',
		'style_inspector' => '2.2',
	);
}

/**
 * Extract a comparable major.minor release line from a plugin version.
 *
 * Development suffixes such as 2.1.0-dev-1 belong to the 2.1 release line,
 * so version_compare() against the final 2.1.0 string would be too strict.
 *
 * @param string $version Plugin version.
 * @return string Major.minor, or 0.0 for an invalid value.
 */
function dbe_release_line( $version ) {
	if ( preg_match( '/^(\d+)\.(\d+)/', (string) $version, $matches ) ) {
		return (int) $matches[1] . '.' . (int) $matches[2];
	}
	return '0.0';
}

/**
 * Test a staged capability against an explicit plugin version.
 *
 * Kept pure so the release-boundary regression suite can exercise every 2.x
 * line without redefining DBE_VERSION in separate processes.
 *
 * @param string $capability Capability id from dbe_release_availability().
 * @param string $version    Plugin version to test.
 * @return bool
 */
function dbe_release_feature_available_for_version( $capability, $version ) {
	$availability = dbe_release_availability();
	if ( ! isset( $availability[ $capability ] ) ) {
		return true;
	}
	return version_compare( dbe_release_line( $version ), $availability[ $capability ], '>=' );
}

/**
 * Whether a staged headline capability belongs to the current release line.
 *
 * The filter is a developer-only escape hatch for testing future work locally;
 * public behaviour always follows the version-derived default.
 *
 * @param string $capability Capability id from dbe_release_availability().
 * @return bool
 */
function dbe_release_feature_available( $capability ) {
	$available = dbe_release_feature_available_for_version( $capability, DBE_VERSION );

	/**
	 * Filter staged feature availability for local integration testing.
	 *
	 * @param bool   $available  Version-derived availability.
	 * @param string $capability Capability id.
	 * @param string $version    Current plugin version.
	 */
	return (bool) apply_filters( 'dbe_release_feature_available', $available, $capability, DBE_VERSION );
}

/**
 * Settings-page tabs, in display order.
 *
 * @return array<string,string> slug => label.
 */
function dbe_tabs() {
	$tabs = array(
		'dashboard'  => __( 'Dashboard', 'daveden-builderius-enhancements' ),
		'appearance' => __( 'Appearance', 'daveden-builderius-enhancements' ),
		'navigator'  => __( 'Navigator', 'daveden-builderius-enhancements' ),
		'editing'    => __( 'Editing', 'daveden-builderius-enhancements' ),
		'styles'     => __( 'Styles panel', 'daveden-builderius-enhancements' ),
		'workflow'   => __( 'Workflow', 'daveden-builderius-enhancements' ),
	);
	if ( dbe_release_feature_available( 'agent_abilities' ) ) {
		$tabs['abilities'] = __( 'Agent abilities', 'daveden-builderius-enhancements' );
	}
	return $tabs;
}

/**
 * Logical settings-page sections inside each feature tab, in display order.
 *
 * The feature registry remains the source of truth for each toggle; these
 * sections only control how the settings page groups and prioritises them.
 *
 * @return array<string,array<int,array{title:string,description:string,features:array<int,string>}>>
 */
function dbe_feature_sections() {
	return array(
		'appearance' => array(
			array(
				'title'       => __( 'Start here', 'daveden-builderius-enhancements' ),
				'description' => __( 'The broad builder polish most people will notice on every session.', 'daveden-builderius-enhancements' ),
				'features'    => array( 'theme_switcher', 'density_toggle', 'focus_visibility', 'controls_styling', 'design_tokens' ),
			),
			array(
				'title'       => __( 'Builder chrome', 'daveden-builderius-enhancements' ),
				'description' => __( 'Layout and scanning improvements for the top bar, tabs, searches and side panels.', 'daveden-builderius-enhancements' ),
				'features'    => array( 'panel_resize', 'compact_panes', 'topbar_toolbar', 'tab_styling', 'search_affordance', 'tree_row_styling' ),
			),
		),
		'navigator'  => array(
			array(
				'title'       => __( 'Find and understand elements', 'daveden-builderius-enhancements' ),
				'description' => __( 'The highest-value Navigator upgrades for finding, reading and moving through the tree.', 'daveden-builderius-enhancements' ),
				'features'    => array( 'tree_search', 'reveal_selected', 'navigator_keyboard', 'collapse_expand_all', 'tag_badges', 'icon_declutter' ),
			),
			array(
				'title'       => __( 'Act on the tree', 'daveden-builderius-enhancements' ),
				'description' => __( 'Tools for working faster once the right element is in view.', 'daveden-builderius-enhancements' ),
				'features'    => array( 'navigator_row_actions', 'favourites_reorder', 'panel_detach' ),
			),
		),
		'editing'    => array(
			array(
				'title'       => __( 'Accessibility foundations', 'daveden-builderius-enhancements' ),
				'description' => __( 'Keyboard and screen-reader fixes that make the builder chrome reachable before adding power tools.', 'daveden-builderius-enhancements' ),
				'features'    => array( 'settings_accordions', 'select_combobox', 'panel_tabs', 'footer_toolbar', 'inserter_keyboard', 'builderius_menu', 'ai_terminal_tabs', 'chrome_landmarks' ),
			),
			array(
				'title'       => __( 'Everyday element actions', 'daveden-builderius-enhancements' ),
				'description' => __( 'Frequent right-click and Navigator actions, kept near the top because they change day-to-day editing speed.', 'daveden-builderius-enhancements' ),
				'features'    => array( 'context_menu', 'element_moves', 'navigator_paste', 'inline_rename', 'dblclick_rename', 'undo_delete', 'wrap_in' ),
			),
			array(
				'title'       => __( 'Element helpers', 'daveden-builderius-enhancements' ),
				'description' => __( 'Targeted helpers for attributes, images, display conditions and component properties.', 'daveden-builderius-enhancements' ),
				'features'    => array( 'attr_helpers', 'image_defaults', 'condition_helpers', 'properties_reorder' ),
			),
			array(
				'title'       => __( 'Power tools', 'daveden-builderius-enhancements' ),
				'description' => __( 'Experimental or Pro-only tools for bulk editing and faster command-driven work.', 'daveden-builderius-enhancements' ),
				'features'    => array( 'command_palette', 'keyboard_shortcuts', 'edit_as_html', 'import_html', 'tag_change' ),
			),
		),
		'styles'     => array(
			array(
				'title'       => __( 'CSS editor workflow', 'daveden-builderius-enhancements' ),
				'description' => __( 'Pro-focused helpers for opening, reading and protecting the CSS code editor.', 'daveden-builderius-enhancements' ),
				'features'    => array( 'css_code_default', 'scope_bar', 'style_inspector', 'css_hint_dialog', 'hide_minimap' ),
			),
			array(
				'title'       => __( 'Class naming', 'daveden-builderius-enhancements' ),
				'description' => __( 'Naming support for cleaner selectors before CSS is written.', 'daveden-builderius-enhancements' ),
				'features'    => array( 'auto_bem' ),
			),
		),
		'workflow'   => array(
			array(
				'title'       => __( 'Saving and protection', 'daveden-builderius-enhancements' ),
				'description' => __( 'The safeguards and shortcuts that protect builder work and make saving clearer.', 'daveden-builderius-enhancements' ),
				'features'    => array( 'save_shortcut', 'save_state_cue', 'presence_heartbeat', 'css_block_guard', 'save_split_button' ),
			),
			array(
				'title'       => __( 'Guidance and previewing', 'daveden-builderius-enhancements' ),
				'description' => __( 'On-screen guidance plus canvas helpers for checking responsive behaviour and overlay contrast.', 'daveden-builderius-enhancements' ),
				'features'    => array( 'tooltips', 'shortcuts_overlay', 'preview_resize', 'overlay_contrast' ),
			),
		),
	);
}

/**
 * Curated, additive feature presets for the settings dashboard.
 *
 * Applying a preset only enables its listed features; it never disables an
 * existing choice and the user must still save the settings form.
 *
 * @return array<string,array{title:string,description:string,features:array<int,string>}>
 */
function dbe_feature_presets() {
	$presets = array(
		'accessibility' => array(
			'title'       => __( 'Accessibility essentials', 'daveden-builderius-enhancements' ),
			'description' => __( 'Keyboard routes, screen-reader structure, visible focus and clearer controls across the builder.', 'daveden-builderius-enhancements' ),
			'features'    => array( 'focus_visibility', 'controls_styling', 'compact_panes', 'topbar_toolbar', 'footer_toolbar', 'select_combobox', 'ai_terminal_tabs', 'panel_tabs', 'settings_accordions', 'chrome_landmarks', 'navigator_keyboard', 'inserter_keyboard', 'builderius_menu', 'tooltips', 'overlay_contrast' ),
		),
		'keyboard'      => array(
			'title'       => __( 'Keyboard workflow', 'daveden-builderius-enhancements' ),
			'description' => __( 'Fast movement, element actions, command search, shortcuts and reliable saving without leaving the keyboard.', 'daveden-builderius-enhancements' ),
			'features'    => array( 'compact_panes', 'navigator_keyboard', 'inserter_keyboard', 'panel_tabs', 'settings_accordions', 'footer_toolbar', 'context_menu', 'element_moves', 'inline_rename', 'keyboard_shortcuts', 'command_palette', 'shortcuts_overlay', 'save_shortcut', 'focus_visibility' ),
		),
		'visual'        => array(
			'title'       => __( 'Visual polish', 'daveden-builderius-enhancements' ),
			'description' => __( 'A calmer theme, clearer hierarchy and more readable controls without changing editing behaviour.', 'daveden-builderius-enhancements' ),
			'features'    => array( 'design_tokens', 'tab_styling', 'search_affordance', 'controls_styling', 'focus_visibility', 'tree_row_styling', 'theme_switcher', 'density_toggle', 'tag_badges', 'icon_declutter', 'panel_resize', 'overlay_contrast' ),
		),
		'safety'        => array(
			'title'       => __( 'Safer editing', 'daveden-builderius-enhancements' ),
			'description' => __( 'Undo, save-state feedback, conflict protection and guarded CSS workflows that reduce accidental loss.', 'daveden-builderius-enhancements' ),
			'features'    => array( 'undo_delete', 'save_state_cue', 'save_shortcut', 'presence_heartbeat', 'css_block_guard', 'scope_bar', 'css_hint_dialog', 'attr_helpers', 'image_defaults', 'condition_helpers' ),
		),
		'power'         => array(
			'title'       => __( 'Power editing', 'daveden-builderius-enhancements' ),
			'description' => __( 'Command-driven structure, HTML and class tools for experienced Builderius users. Includes experimental features.', 'daveden-builderius-enhancements' ),
			'features'    => array( 'context_menu', 'wrap_in', 'element_moves', 'navigator_paste', 'inline_rename', 'dblclick_rename', 'undo_delete', 'keyboard_shortcuts', 'command_palette', 'edit_as_html', 'import_html', 'tag_change', 'css_code_default', 'scope_bar', 'style_inspector', 'auto_bem', 'hide_minimap' ),
		),
	);
	foreach ( $presets as &$preset ) {
		$preset['features'] = array_values(
			array_filter(
				$preset['features'],
				function ( $feature_id ) {
					return dbe_release_feature_available( $feature_id );
				}
			)
		);
	}
	unset( $preset );
	return $presets;
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
 * - cap:  optional capability the CURRENT user must hold for this feature's
 *         builder output to be emitted (see dbe_feature_output_permitted()).
 *         The HTML converter features use `unfiltered_html`, since they turn
 *         pasted markup into elements Builderius renders raw. The settings
 *         page is unaffected — an administrator still configures the toggle.
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
			'description' => __( 'Wires the bottom bar of editor tools (Custom CSS, JavaScript, Dynamic Data, Sense AI and so on) as a keyboard toolbar: one Tab stop with arrow-key navigation, each available tool announces whether its panel is open, the shared panel is a labelled group, and unavailable tools are identified as coming soon without entering the keyboard sequence. Also wires the Global / Template scope tabs inside the JavaScript and Dynamic Data tools as a vertical tab list.', 'daveden-builderius-enhancements' ),
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
			'description' => __( 'Wires the Sense AI terminal session tabs (Claude Code, Gemini CLI and so on) as a proper tab list for screen readers and the keyboard: the tabs announce which session is active, arrow keys move between them and switch with one Tab stop, the terminal below is exposed as their tab panel, and the "new session" button gets a clear name in place of its bare plus sign, plus a proper pop-up menu (arrow keys to choose an agent, Escape to close). In reachable remote terminals, Ctrl+` moves focus back to the active session tab so xterm cannot trap keyboard users. Purely additive: clicking to switch is left to Builderius.', 'daveden-builderius-enhancements' ),
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
			'description' => __( 'Marks each part of the builder as a named landmark region for screen readers: the top toolbar, the element library / element settings panel, the canvas, the Navigator and the footer bar. It also names the canvas preview frame. You can then jump straight to a section from the screen reader\'s landmark list or with its region-jump keys, the way the WordPress block editor\'s regions work.', 'daveden-builderius-enhancements' ),
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
			'description' => __( 'Adds a filter box above the tree that hides non-matching branches while keeping the ancestors of matching elements visible for context. A live count reports the results.', 'daveden-builderius-enhancements' ),
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
			'summary'     => __( 'The tree follows your selection; a path remains when it is hidden.', 'daveden-builderius-enhancements' ),
			'description' => __( 'When you click an element in the preview, the Navigator opens the branches down to it and scrolls it into view. If the Navigator is hidden, a compact path above the canvas keeps the selected element in context.', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '78-selection-context.css' ),
			'js'          => true,
		),
		'navigator_keyboard'    => array(
			'title'       => __( 'Navigator keyboard tree', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Full arrow-key navigation of the tree, WordPress style.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Makes the Navigator behave like the WordPress list view: the arrow keys move through the elements (the canvas selection follows), the right arrow opens a branch and steps into it, the left arrow closes it and steps out to the parent, and Home and End jump to the first and last. The same keys navigate the canvas while it is in selection mode, including when the Navigator panel is hidden. The tree is exposed to screen readers as a proper tree, so each element announces its level, whether it is expanded, and its position.', 'daveden-builderius-enhancements' ),
			'tab'         => 'navigator',
			'css'         => array( '79-navigator-keyboard.css' ),
			'js'          => true,
		),
		'navigator_row_actions' => array(
			'title'       => __( 'Navigator row quick actions', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Duplicate and Delete buttons on the hovered or focused row.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Shows Duplicate and Delete buttons at the right edge of a Navigator row when you point at it or move keyboard focus onto it. From a focused row, Tab reaches the buttons and Escape returns to the row; after duplicating, focus lands on the copy, and after deleting it moves to a neighbouring row. Delete asks for a confirming second press, then offers Undo when Undo / redo element changes is on. Can also be set to sit permanently on the selected row.', 'daveden-builderius-enhancements' ),
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
			'description' => __( 'Reorganises the Navigator right-click menu around the actions used most often, with compact flyouts for inserting, moving and advanced tools. Includes full keyboard support (arrow keys, Home/End and Escape); unavailable commands remain discoverable and explain why they cannot currently run. Also adds a right-click copy and remove menu to the class chips in the Styles editor.', 'daveden-builderius-enhancements' ),
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
			'summary'     => __( 'Reorder, indent and outdent elements from the keyboard or menus.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Move an element among its siblings with Alt+Up/Down, move it into its previous sibling with Alt+Right, or move it out one level with Alt+Left while its Navigator row is focused. The same actions appear in the right-click menu and command palette, alongside Select parent for navigation.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array(),
			'js'          => true,
		),
		'navigator_paste'       => array(
			'title'       => __( 'Paste where you click', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Paste lands on the right-clicked row, or at top level from empty space.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Makes Paste in the Navigator right-click menu insert into the element you right-clicked, instead of whichever element happens to be selected, and adds a right-click menu to the empty space below the tree with Paste at top level. Either way, you can paste without selecting anything first.', 'daveden-builderius-enhancements' ),
			'tab'         => 'editing',
			'css'         => array(),
			'shared_css'  => array( '01-infra.css', '30-context-menu.css' ),
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
			'title'       => __( 'Undo / redo element changes', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Undo element structure and selected DBE property changes.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Undo adding, deleting or structurally moving an element, plus class, attribute and tag changes made through DBE, from the confirmation message or with Cmd/Ctrl+Z. A deleted element is restored, an added element is removed, and a reordered, indented or outdented element returns to its previous position. The message then offers Redo; Cmd/Ctrl+Shift+Z also redoes the change. Other settings changes are not covered.', 'daveden-builderius-enhancements' ),
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
			'summary'     => __( 'Arrow-key navigation of the element Inserter and favourites.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Makes the element Inserter navigable from the keyboard the way the WordPress block inserter is: each category is one Tab stop, the arrow keys move between its available elements, and Enter or Space inserts. Elements marked “Soon” are announced as coming soon and excluded from the keyboard sequence. The favourite-elements strip also becomes one vertical toolbar Tab stop with action-led names such as “Insert Heading”. Without this feature, reaching a lower category or later favourite means tabbing through every element above it.', 'daveden-builderius-enhancements' ),
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
			'title'        => __( 'Builder keyboard shortcuts', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'Shortcuts for selected elements and builder regions.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Adds block-editor-style shortcuts for the selected element: duplicate (Cmd/Ctrl+Shift+D), cut (Cmd/Ctrl+X), add before or after, rename (F2), and edit text in the canvas (Enter to start, Escape to finish). Direct shortcuts move focus to the Element library, Settings, Canvas, Navigator or Footer bar—even from a search field or code editor—so you can bypass the builder’s long Tab sequence. The command palette and shortcuts overlay list the same routes. Experimental: Builderius is adding its own shortcuts, so some may overlap or be retired.', 'daveden-builderius-enhancements' ),
			'tab'          => 'editing',
			'css'          => array( '32-rename.css', '81-keyboard-shortcuts.css' ),
			'shared_css'   => array( '01-infra.css', '30-context-menu.css' ),
			'js'           => true,
			'experimental' => true,
		),
		'edit_as_html'          => array(
			'title'        => __( 'Edit as HTML', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'Edit an element and its children as HTML markup.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Adds Edit as HTML to the right-click menu. Its code editor auto-closes non-void tags and suggests HTML tags, attributes and existing Builderius classes. Existing data-dbe-id markers preserve labels, conditions and other settings; components use <dbe-component>, while unsupported modules use <dbe-keep> and remain unchanged. A review step shows updated, added, removed and sanitised items before anything is applied, with a clear warning that the complete operation cannot be undone. Scripts, event handlers, dangerous URLs and unknown elements are removed. Experimental, and requires Builderius Pro.', 'daveden-builderius-enhancements' ),
			'tab'          => 'editing',
			'css'          => array( '85-edit-html.css' ),
			'shared_css'   => array( '01-infra.css', '30-context-menu.css' ),
			'js'           => true,
			'cap'          => 'unfiltered_html',
			'requires_pro' => true,
			'experimental' => true,
		),
		'import_html'           => array(
			'title'        => __( 'Import HTML', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'Paste HTML and turn it into real elements.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Adds Import HTML to the right-click menu: paste markup into a code editor that auto-closes non-void tags and suggests HTML tags, attributes and existing Builderius classes, check the live preview of the elements it will create, and insert them into the chosen element (or after it, when that element cannot hold children). Several top-level elements are fine. Pasted <template> elements become Template modules, and an element carrying a data-b-context attribute (or data-dbe-module="collection") becomes a Collection, so dynamic lists can be imported ready to bind. Add data-dbe-label="…" to any element to name it in the Navigator. Script tags, event-handler attributes, javascript:, vbscript: and script-bearing data: URLs, and unknown elements are stripped before anything is created. The dialog warns that a complete import cannot be undone as one action. Experimental, and requires Builderius Pro.', 'daveden-builderius-enhancements' ),
			'tab'          => 'editing',
			'css'          => array( '85-edit-html.css' ),
			'shared_css'   => array( '01-infra.css', '30-context-menu.css' ),
			'js'           => true,
			'cap'          => 'unfiltered_html',
			'requires_pro' => true,
			'experimental' => true,
		),
		'tag_change'            => array(
			'title'        => __( 'Change HTML tag from the Navigator', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'Swap an element\'s HTML tag from the right-click menu.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Adds a Change tag flyout to an element\'s right-click menu in the Navigator, so you can swap a div for a section, a p for an h2 and so on without opening the settings panel. If the element\'s label was just its tag, the label follows the new tag. Experimental, and requires Builderius Pro.', 'daveden-builderius-enhancements' ),
			'tab'          => 'editing',
			'css'          => array(),
			'shared_css'   => array( '01-infra.css', '30-context-menu.css' ),
			'js'           => true,
			'cap'          => 'unfiltered_html',
			'requires_pro' => true,
			'experimental' => true,
		),
		'command_palette'       => array(
			'title'        => __( 'Command palette', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'A searchable command palette on Cmd/Ctrl+K, with a top-bar button.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Press Cmd/Ctrl+K (the shortcut is changeable below) or use the palette button in the top bar for a searchable command palette, including when focus is inside the preview canvas. Add classes, HTML attributes and child elements with minimal Emmet syntax (e.g. section.hero>h1{Title}+p{Lead}), run element and structure actions, persistently show or hide either side panel, jump between builder regions, and open key WordPress or Builderius admin pages in a new tab. Unavailable commands stay visible and explain what is needed; empty searches and invalid input receive inline guidance. Event-handler attributes and javascript: URLs are stripped. Experimental.', 'daveden-builderius-enhancements' ),
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
		'style_inspector'       => array(
			'title'        => __( 'Style inspector', 'daveden-builderius-enhancements' ),
			'summary'      => __( 'Inspect an element’s computed CSS and jump straight to its rules.', 'daveden-builderius-enhancements' ),
			'description'  => __( 'Adds a Styles flyout to element context menus and matching command-palette actions for opening local, global and template or component class styles directly. Inspect styles opens a persistent DevTools-like panel with searchable computed properties and the live authored rules affecting the rendered element, including nested selectors, inherited declarations grouped by ancestor, their scope and active media-query context. Rule edit buttons return to Builderius’s own Styles editor rather than introducing a second editing surface. Experimental, and requires Builderius Pro.', 'daveden-builderius-enhancements' ),
			'tab'          => 'styles',
			'css'          => array( '45-style-inspector.css' ),
			'shared_css'   => array( '30-context-menu.css' ),
			'js'           => true,
			'requires_pro' => true,
			'experimental' => true,
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
			'summary'     => __( 'A compact, dismissible hint under the CSS editor.', 'daveden-builderius-enhancements' ),
			/* translators: %local% and %selector% are literal Builderius CSS scope tokens. */
			'description' => __( 'Replaces Builderius’ two-line %local% / %selector% notification under the CSS editor with a compact, dismissible hint, reclaiming the vertical space for the editor. The full explanation moves into a dialog and is reworded so both tokens are described consistently and breakpoints are explained the same way for each (the stock wording differs between them).', 'daveden-builderius-enhancements' ),
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
			'title'       => __( 'Save status', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Clean, unsaved, saving, saved and failed status beside Save.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Shows when module or settings changes are unsaved, when a save is running and when it has succeeded. A failed save keeps the changes marked as unsaved and prompts you to try again.', 'daveden-builderius-enhancements' ),
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
			'title'       => __( 'Keyboard access for the Save options menu', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Keyboard and screen-reader access to Save and Publish options.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Builderius draws the Save button’s dropdown trigger inside the Save button itself, where keyboard and screen-reader users cannot reach it. This adds a separate, named menu button beside Save, with arrow-key navigation, unavailable-state announcements and Escape focus return for the Save to Development / Publish to Live menu. The proper fix still belongs in Builderius (reported upstream), so this compatibility layer can be retired when Builderius provides an accessible split button.', 'daveden-builderius-enhancements' ),
			'tab'         => 'workflow',
			'css'         => array( '35-save-menu.css' ),
			'shared_css'  => array( '03-topbar-layout.css' ),
			'js'          => true,
		),
		'css_block_guard'       => array(
			'title'       => __( 'CSS named-block guard', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Keeps agent-added CSS blocks safe across builder saves.', 'daveden-builderius-enhancements' ),
			'description' => __( 'CSS added server-side by AI agents (the dbe/patch-global-css and dbe/patch-entity-css abilities) lives in named blocks fenced by @block comments. A builder save rebuilds the stylesheet from the open editor, which has never seen those blocks, so without protection they silently vanish on the next save. This guard re-attaches any block the previous save carried before the new save is stored, for both the global stylesheet and per-template CSS. Blocks removed through the abilities themselves stay removed.', 'daveden-builderius-enhancements' ),
			'tab'         => 'workflow',
			'css'         => false,
			'js'          => false,
		),
		'presence_heartbeat'    => array(
			'title'       => __( 'Builder tab protection', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Warns about duplicate tabs and protects unsaved builder work from agent saves.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Adds an “Edit template” link to the front-end admin bar and warns before Builderius opens in a second tab. Tabs with unsaved changes also report their state to DBE, which blocks agent saves to the same template until the tab is saved or closed. An explicit force option is still available when the conflict is understood.', 'daveden-builderius-enhancements' ),
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
		'compact_panes'         => array(
			'title'       => __( 'Compact workspace views', 'daveden-builderius-enhancements' ),
			'summary'     => __( 'Keeps one usable builder view on narrow screens.', 'daveden-builderius-enhancements' ),
			'description' => __( 'Below 720 CSS pixels, replaces overlapping panels and a zero-width canvas with a compact Builder view selector. Element library, Element settings, Canvas and Navigator are presented one at a time; changing view is announced, keyboard focus follows the chosen view, and the wider workspace layout returns unchanged when space is available again.', 'daveden-builderius-enhancements' ),
			'tab'         => 'appearance',
			'css'         => array( '83-compact-panes.css' ),
			'shared_css'  => array( '03-topbar-layout.css' ),
			'js'          => true,
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
 * The feature registry restricted to the current public release line.
 *
 * Keep dbe_features() complete so future preferences and sanitisation can be
 * preserved across a temporary downgrade. User-facing settings and summaries
 * use this filtered view so staged features have no premature entry point.
 *
 * @return array<string,array<string,mixed>>
 */
function dbe_available_features() {
	$features = dbe_features();
	if ( ! dbe_release_feature_available( 'style_inspector' ) ) {
		unset( $features['style_inspector'] );
	}
	return $features;
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

/**
 * Access groups for the Agent abilities tab, in display order.
 *
 * Read abilities inspect state, Write abilities change saved development
 * state, and Execute abilities perform consequential lifecycle operations.
 *
 * @return array<string,array{label:string,description:string}>
 */
function dbe_ability_groups() {
	return array(
		'read'    => array(
			'label'       => __( 'Read', 'daveden-builderius-enhancements' ),
			'description' => __( 'Inspect saved Builderius state without changing it.', 'daveden-builderius-enhancements' ),
		),
		'write'   => array(
			'label'       => __( 'Write', 'daveden-builderius-enhancements' ),
			'description' => __( 'Create or update saved development state as a new commit.', 'daveden-builderius-enhancements' ),
		),
		'execute' => array(
			'label'       => __( 'Execute', 'daveden-builderius-enhancements' ),
			'description' => __( 'Restore, delete, publish or rebuild Builderius state.', 'daveden-builderius-enhancements' ),
		),
	);
}

/**
 * The agent-ability registry.
 *
 * Every dbe/* WordPress ability the plugin can register, described once so the
 * settings tab, option defaults and sanitisation all derive from it (the same
 * pattern as dbe_features()). The full registration (schemas, callbacks) lives
 * in includes/abilities.php and only runs for abilities enabled here.
 *
 * Each entry:
 * - title/summary: settings-page copy (registration descriptions are agent-facing).
 * - group:   access class from dbe_ability_groups().
 * - danger:  destructive or code-executing ability; defaults OFF, rendered with a warning.
 * - risk_label/risk_note: optional warning copy for a non-destructive high-risk ability.
 * - caution: ability that deletes content or goes live; defaults on, badged.
 *
 * @return array<string,array<string,mixed>>
 */
function dbe_abilities() {
	return array(
		/* --------------------------------------------------------------- Read */
		'dbe/get-subtree-html'               => array(
			'title'   => __( 'Get subtree as HTML', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Read a template or component subtree from the saved state as HTML.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/get-tree-outline'               => array(
			'title'   => __( 'Get tree outline', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Read a compact element outline so an agent can target elements by label.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/get-global-css'                 => array(
			'title'   => __( 'Get global CSS', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Read the saved global stylesheet and its named blocks.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/get-entity-css'                 => array(
			'title'   => __( 'Get entity CSS', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Read a template\'s saved entity CSS and its named blocks.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/list-commits'                   => array(
			'title'   => __( 'List commits', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Read a template\'s or the global stylesheet\'s commit history.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/get-template-settings'          => array(
			'title'   => __( 'Get template settings', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Read a template\'s registration-level settings.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/list-components'                => array(
			'title'   => __( 'List components', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Read the available components and their declared properties.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/get-data-variables'             => array(
			'title'   => __( 'Get data variables', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Read the saved dynamic-data variables and their GraphQL queries.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/get-js-snippets'                => array(
			'title'   => __( 'Get JS snippets', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Read the saved custom JavaScript snippets.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/status'                         => array(
			'title'   => __( 'Save/publish status', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Report each template\'s saved commit against the published release.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/get-dynamic-data-schema'        => array(
			'title'   => __( 'Get dynamic-data schema', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Read the live GraphQL schema data variables run against, without an open builder tab.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/resolve-data-variable'          => array(
			'title'   => __( 'Resolve a data variable', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Schema-validate and actually resolve one data variable in a chosen page context.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/inspect-binding-value'          => array(
			'title'   => __( 'Inspect a binding value', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Report the resolved type and shape at a binding path before a Collection binds it.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/resolve-metabox-field'          => array(
			'title'   => __( 'Resolve a Meta Box field', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Map a Meta Box field id or label to its builder helper name and GraphQL read recipe.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/check-rendered-output'          => array(
			'title'   => __( 'Check rendered output', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Fetch one authenticated front-end render and scan it for silent dynamic-data failures.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/check-render-scenarios'         => array(
			'title'   => __( 'Check render scenarios', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Run the rendered-output scan across a matrix of query parameters and cookies.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/get-rendered-styles'            => array(
			'title'   => __( 'Get matched styles', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Read the entity and global CSS rules that target one module, with media context.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/list-settings-sets'             => array(
			'title'   => __( 'List settings sets', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Enumerate the global settings sets that carry framework CSS and global variables.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		'dbe/validate-js-snippet'            => array(
			'title'   => __( 'Validate a JS snippet', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Structurally check snippet JavaScript for unbalanced or unterminated syntax without saving.', 'daveden-builderius-enhancements' ),
			'group'   => 'read',
		),
		/* -------------------------------------------------------------- Write */
		'dbe/apply-subtree-html'             => array(
			'title'   => __( 'Apply subtree HTML', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Save edited HTML back onto a subtree as a new commit.', 'daveden-builderius-enhancements' ),
			'group'   => 'write',
		),
		'dbe/patch-global-css'               => array(
			'title'   => __( 'Patch global CSS', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Edit one named block of the global stylesheet; everything outside it is preserved.', 'daveden-builderius-enhancements' ),
			'group'   => 'write',
		),
		'dbe/patch-entity-css'               => array(
			'title'   => __( 'Patch entity CSS', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Edit one named block of a template\'s entity CSS as a new commit.', 'daveden-builderius-enhancements' ),
			'group'   => 'write',
		),
		'dbe/create-template'                => array(
			'title'   => __( 'Create template', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Create a Builderius template headlessly, ready for content abilities.', 'daveden-builderius-enhancements' ),
			'group'   => 'write',
		),
		'dbe/update-template'                => array(
			'title'   => __( 'Update template settings', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Change a template\'s title, slug, enabled state or apply rules.', 'daveden-builderius-enhancements' ),
			'group'   => 'write',
		),
		'dbe/create-component'               => array(
			'title'   => __( 'Create component', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Create a reusable Builderius component headlessly.', 'daveden-builderius-enhancements' ),
			'group'   => 'write',
		),
		'dbe/manage-component-property'      => array(
			'title'   => __( 'Manage component properties', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Add, update or remove a component\'s declared properties.', 'daveden-builderius-enhancements' ),
			'group'   => 'write',
		),
		'dbe/manage-data-variable'           => array(
			'title'   => __( 'Manage data variables', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Create, update or delete a dynamic-data variable in the saved state.', 'daveden-builderius-enhancements' ),
			'group'   => 'write',
		),
		'dbe/manage-js-snippet'              => array(
			'title'      => __( 'Manage JS snippets', 'daveden-builderius-enhancements' ),
			'summary'    => __( 'Create, update or delete a custom JavaScript snippet in the saved state.', 'daveden-builderius-enhancements' ),
			'group'      => 'write',
			'danger'     => true,
			'risk_label' => __( 'Code execution', 'daveden-builderius-enhancements' ),
			'risk_note'  => __( 'Off by default because saved JavaScript executes for site visitors. Turn it on only for a specific trusted task, review the complete code before saving, and switch it off again afterwards.', 'daveden-builderius-enhancements' ),
		),
		'dbe/duplicate-template'             => array(
			'title'   => __( 'Duplicate template', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Copy a template as a disabled working twin — content, entity CSS, variables and snippets included.', 'daveden-builderius-enhancements' ),
			'group'   => 'write',
		),
		'dbe/duplicate-component'            => array(
			'title'   => __( 'Duplicate component', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Copy a component definition with its declared properties, for safe forks of shared blocks.', 'daveden-builderius-enhancements' ),
			'group'   => 'write',
		),
		'dbe/manage-visibility-condition'    => array(
			'title'   => __( 'Manage rendering conditions', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Read, set or clear an element\'s visibility conditions in the saved state.', 'daveden-builderius-enhancements' ),
			'group'   => 'write',
		),
		'dbe/manage-settings-set'            => array(
			'title'   => __( 'Manage global settings set', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Read or update the global breakpoints, responsive strategy and fonts. Site-wide impact.', 'daveden-builderius-enhancements' ),
			'group'   => 'write',
			'caution' => true,
		),
		/* ------------------------------------------------------------ Execute */
		'dbe/restore-global-css-from-commit' => array(
			'title'   => __( 'Restore global CSS from a commit', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Recover a clobbered stylesheet by re-saving an earlier commit\'s CSS.', 'daveden-builderius-enhancements' ),
			'group'   => 'execute',
		),
		'dbe/delete-template'                => array(
			'title'   => __( 'Delete template', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Permanently delete a template, its branches and its history. Asks for confirmation.', 'daveden-builderius-enhancements' ),
			'group'   => 'execute',
			'caution' => true,
		),
		'dbe/delete-component'               => array(
			'title'   => __( 'Delete component', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Permanently delete an unused component and its history. Asks for confirmation.', 'daveden-builderius-enhancements' ),
			'group'   => 'execute',
			'caution' => true,
		),
		'dbe/publish'                        => array(
			'title'   => __( 'Publish a release', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Publish selected pages/templates with release tags; required components and global settings are included automatically. This is go-live for visitors.', 'daveden-builderius-enhancements' ),
			'group'   => 'execute',
			'caution' => true,
		),
		'dbe/extract-release'                => array(
			'title'   => __( 'Extract a release (work on a release)', 'daveden-builderius-enhancements' ),
			'summary' => __( 'Rebuild ALL development state from a published release. Deletes every template, component and settings set first, including commit history and the framework CSS, then recreates them from the release.', 'daveden-builderius-enhancements' ),
			'group'   => 'execute',
			'danger'  => true,
		),
	);
}

/**
 * The option key holding an ability's toggle.
 *
 * @param string $ability_id Ability id, e.g. "dbe/extract-release".
 * @return string e.g. "ability_extract_release".
 */
function dbe_ability_option_key( $ability_id ) {
	return 'ability_' . str_replace( '-', '_', substr( (string) $ability_id, 4 ) );
}
