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
 * Everything is registry-driven: each feature lists its own files under
 * `css` and any shared infrastructure it depends on under `shared_css`
 * (see dbe_features()), so adding a feature never requires editing this
 * function. Numeric prefixes keep the original cascade order — never
 * alphabetise or reorder (e.g. the tag-badge mono font rule must follow
 * the blanket UI-font rule).
 *
 * @return string[] File names relative to assets/builder/css/.
 */
function dbe_builder_css_files() {
	$files = array();

	// Token layer: emitted whenever anything is on (declarations only).
	$files[] = '00-tokens.css';

	foreach ( dbe_features() as $id => $feature ) {
		if ( ! dbe_enabled( $id ) ) {
			continue;
		}
		foreach ( array( 'css', 'shared_css' ) as $key ) {
			if ( empty( $feature[ $key ] ) ) {
				continue;
			}
			foreach ( $feature[ $key ] as $file ) {
				$files[] = $file;
			}
		}
	}

	$files = array_unique( $files );
	sort( $files, SORT_STRING ); // Numeric prefixes define the cascade order.

	return array_values( $files );
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

	if ( dbe_enabled( 'theme_switcher' ) || dbe_enabled( 'density_toggle' ) || dbe_enabled( 'panel_resize' ) ) {
		$bootstrap = array(
			'theme'      => dbe_enabled( 'theme_switcher' ) ? dbe_setting( 'theme_default' ) : '',
			'density'    => dbe_enabled( 'density_toggle' ) ? dbe_setting( 'density_default' ) : '',
			'panelWidth' => dbe_enabled( 'panel_resize' ),
		);
		?>
		<script id="dbe-theme-bootstrap">
		(function (d) {
			var cfg = <?php echo wp_json_encode( $bootstrap ); ?>;
			function pick(key, fallback) {
				try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
			}
			/*
			 * The MODE (light / dark / auto — what the user chose) lives in
			 * data-dbe-theme-mode and localStorage; data-dbe-theme only ever
			 * carries the RESOLVED light/dark. Resolving auto here, before
			 * first paint, means the stylesheets need no "auto" selectors at
			 * all — auto under a dark OS is byte-identical to the dark theme.
			 */
			function resolve(mode) {
				try {
					return mode === 'auto'
						? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
						: mode;
				} catch (e) { return mode === 'auto' ? 'dark' : mode; }
			}
			if (cfg.theme) {
				var mode = pick('dbeBuilderTheme', cfg.theme);
				d.dataset.dbeThemeMode = mode;
				d.dataset.dbeTheme = resolve(mode);
				// Auto keeps following the OS live, not just at load.
				try {
					matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
						if (d.dataset.dbeThemeMode === 'auto') { d.dataset.dbeTheme = resolve('auto'); }
					});
				} catch (e) {}
			}
			if (cfg.density) { d.dataset.dbeDensity = pick('dbeBuilderDensity', cfg.density); }
			/*
			 * Panel width, seeded pre-paint for the same reason as the theme:
			 * builder.js can only write it once the SPA has mounted (~1s in),
			 * and by then the canvas has painted at the stylesheet's 320px
			 * fallback — restoring a stored width later made the canvas
			 * visibly snap. Set inline on <html>, which the panel rules'
			 * var() resolves through, so the FIRST paint is already at the
			 * stored width. Clamp mirrors DBE_PANEL_MIN/MAX in builder.js.
			 */
			if (cfg.panelWidth) {
				var pw = parseInt(pick('dbeBuilderPanelWidth', ''), 10);
				if (!isNaN(pw)) {
					d.style.setProperty('--dbe-panel-width', Math.max(260, Math.min(600, pw)) + 'px');
				}
			}
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
 * Config object (inline — it varies per site and per toggle set) and the
 * builder chrome script on wp_footer.
 *
 * The script is a plain `<script src>` tag printed directly, NOT inlined and
 * NOT enqueued: at ~400 KB it is the plugin's largest asset and inlining
 * defeated browser caching on every builder load, while the wp_enqueue
 * pipeline under `?builderius` remains unproven (builder mode strips foreign
 * hooks — see the header docblock in the main plugin file). A printed tag
 * sidesteps both: the browser caches the file, and no enqueue machinery is
 * involved. Versioned by filemtime so a plugin update — or an edit while
 * developing — busts the cache immediately.
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
		'features'   => $flags,
		'theme'      => array( 'default' => dbe_setting( 'theme_default' ) ),
		'density'    => array( 'default' => dbe_setting( 'density_default' ) ),
		'rowActions' => array( 'mode' => dbe_setting( 'row_actions_mode' ) ),
		'heartbeat'  => dbe_heartbeat_config(),
		'i18n'       => dbe_builder_strings(),
		'version'    => DBE_VERSION,
	);

	$src = add_query_arg( 'ver', (string) filemtime( $path ), DBE_URL . 'assets/builder/js/builder.js' );

	echo '<script id="dbe-builder-config">window.dbeBuilderEnhancements = ' . wp_json_encode( $config ) . ';</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo '<script id="dbe-builder-enhancements-js" src="' . esc_url( $src ) . '"></script>' . "\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- deliberate: the enqueue pipeline is unproven under builder mode (see the function docblock); a printed tag is the delivery proven to survive it.
}
add_action( 'wp_footer', 'dbe_print_builder_footer', 999 );
