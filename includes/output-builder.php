<?php
/**
 * Builder-mode output: the chrome CSS and JS injected into the Builderius
 * builder page (a front-end request carrying `?builderius`).
 *
 * CSS is concatenated from per-feature files and printed inline in wp_head —
 * inline is deliberate: it is guaranteed to be in the document before the
 * builder SPA paints (no flash of stock chrome), the payload varies with the
 * saved toggles so there is nothing to cache-bust, and inline printing is the
 * only delivery proven to survive builder mode.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

/**
 * Whether the current request is a builder-mode page view.
 *
 * @return bool
 */
function dbe_is_builder_mode() {
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only mode detection.
	return isset( $_GET['builderius'] );
}

/**
 * Whether this request should receive the builder enhancements at all.
 *
 * The prototype emitted for anonymous `?builderius` requests; the plugin
 * restricts output to logged-in users who can edit content. Filterable in
 * case a site gates Builderius access on a different capability.
 *
 * @return bool
 */
function dbe_builder_output_allowed() {
	$allowed = dbe_is_builder_mode()
		&& is_user_logged_in()
		&& current_user_can( 'edit_posts' )
		&& dbe_any_enabled();

	/**
	 * Filter whether builder-mode output is emitted for this request.
	 *
	 * @param bool $allowed Computed default.
	 */
	return (bool) apply_filters( 'dbe_builder_output_allowed', $allowed );
}

/**
 * Heartbeat contract shared by builder.js (writer) and admin-bar.php (reader)
 * — defined once so the key and timings cannot drift.
 *
 * @return array<string,int|string>
 */
function dbe_heartbeat_config() {
	return array(
		'key'        => 'dbeBuilderiusOpen',
		'interval'   => 2500,
		'staleAfter' => 8000,
	);
}

/**
 * The ordered list of CSS files to emit for the current toggles.
 *
 * Infrastructure files are OR-gated on their consumers; per-feature files
 * come from the registry. Numeric prefixes keep the original cascade order —
 * never alphabetise or reorder (e.g. the tag-badge mono font rule must follow
 * the blanket UI-font rule).
 *
 * @return string[] File names relative to assets/builder/css/.
 */
function dbe_builder_css_files() {
	$files = array();

	// Token layer: emitted whenever anything is on (declarations only).
	$files[] = '00-tokens.css';

	// Toast + hidden auto context menu, shared by several features.
	if ( dbe_enabled( 'wrap_in' ) || dbe_enabled( 'undo_delete' )
		|| dbe_enabled( 'auto_bem' ) || dbe_enabled( 'inline_rename' )
		|| dbe_enabled( 'keyboard_shortcuts' ) ) {
		$files[] = '01-infra.css';
	}

	// Navigator flex layout: any feature that injects rows above the tree
	// needs the tree to flex into the remaining panel height, or the footer
	// (delete element / edit favourites) gets clipped.
	if ( dbe_enabled( 'tree_search' ) || dbe_enabled( 'collapse_expand_all' ) || dbe_enabled( 'favourites_reorder' ) ) {
		$files[] = '02-nav-layout.css';
	}

	foreach ( dbe_features() as $id => $feature ) {
		if ( ! dbe_enabled( $id ) || empty( $feature['css'] ) ) {
			continue;
		}
		foreach ( $feature['css'] as $file ) {
			$files[] = $file;
		}
	}

	// Injected context-menu items / flyout chrome, shared by several features.
	if ( dbe_enabled( 'context_menu' ) || dbe_enabled( 'wrap_in' ) || dbe_enabled( 'inline_rename' )
		|| dbe_enabled( 'collapse_expand_all' ) || dbe_enabled( 'scope_bar' )
		|| dbe_enabled( 'auto_bem' ) || dbe_enabled( 'keyboard_shortcuts' ) ) {
		$files[] = '30-context-menu.css';
	}

	$files = array_unique( $files );
	sort( $files, SORT_STRING ); // Numeric prefixes define the cascade order.

	return $files;
}

/**
 * Concatenate the enabled CSS files.
 *
 * @return string
 */
function dbe_builder_css() {
	$css = '';
	foreach ( dbe_builder_css_files() as $file ) {
		$path = DBE_DIR . 'assets/builder/css/' . $file;
		if ( is_readable( $path ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading a bundled plugin CSS file, not a remote URL.
			$css .= "/* --- {$file} --- */\n" . file_get_contents( $path ) . "\n";
		}
	}
	return $css;
}

/**
 * Theme/density bootstrap printed on wp_head (before the styles, so the first
 * paint is already in the right theme), followed by the concatenated chrome CSS.
 */
function dbe_print_builder_head() {
	if ( ! dbe_builder_output_allowed() ) {
		return;
	}

	if ( dbe_enabled( 'theme_switcher' ) || dbe_enabled( 'density_toggle' ) ) {
		$bootstrap = array(
			'theme'   => dbe_enabled( 'theme_switcher' ) ? dbe_setting( 'theme_default' ) : '',
			'density' => dbe_enabled( 'density_toggle' ) ? dbe_setting( 'density_default' ) : '',
		);
		?>
		<script id="dbe-theme-bootstrap">
		(function (d) {
			var cfg = <?php echo wp_json_encode( $bootstrap ); ?>;
			function pick(key, fallback) {
				try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
			}
			if (cfg.theme)   { d.dataset.dbeTheme   = pick('dbeBuilderTheme', cfg.theme); }
			if (cfg.density) { d.dataset.dbeDensity = pick('dbeBuilderDensity', cfg.density); }
		})(document.documentElement);
		</script>
		<?php
	}

	$css = dbe_builder_css();
	if ( '' !== trim( $css ) ) {
		// Trusted plugin asset files — printed verbatim.
		echo '<style id="dbe-builder-enhancements">' . "\n" . $css . '</style>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}
add_action( 'wp_head', 'dbe_print_builder_head', 999 );

/**
 * Config object and the builder chrome script printed inline on wp_footer
 * (same rationale as the CSS; enqueue behaviour under `?builderius` is unproven).
 */
function dbe_print_builder_footer() {
	if ( ! dbe_builder_output_allowed() ) {
		return;
	}

	$path = DBE_DIR . 'assets/builder/js/builder.js';
	if ( ! is_readable( $path ) ) {
		return;
	}

	$flags = array();
	foreach ( dbe_features() as $id => $feature ) {
		if ( ! empty( $feature['js'] ) ) {
			$flags[ $id ] = dbe_enabled( $id );
		}
	}

	$config = array(
		'features'  => $flags,
		'theme'     => array( 'default' => dbe_setting( 'theme_default' ) ),
		'density'   => array( 'default' => dbe_setting( 'density_default' ) ),
		'heartbeat' => dbe_heartbeat_config(),
		'i18n'      => dbe_builder_strings(),
		'version'   => DBE_VERSION,
	);

	echo '<script id="dbe-builder-config">window.dbeBuilderEnhancements = ' . wp_json_encode( $config ) . ';</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo '<script id="dbe-builder-enhancements-js">' . "\n" . file_get_contents( $path ) . "\n" . '</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped, WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Trusted inline JS from a bundled plugin file, not a remote URL.
}
add_action( 'wp_footer', 'dbe_print_builder_footer', 999 );
