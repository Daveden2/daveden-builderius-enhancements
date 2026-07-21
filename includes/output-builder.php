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
 * restricts output to logged-in users who can open Builderius development
 * mode. Filterable in case a site gates Builderius access differently.
 *
 * @return bool
 */
function dbe_builder_output_allowed() {
	$allowed = dbe_is_builder_mode()
		&& is_user_logged_in()
		&& current_user_can( 'builderius-development' )
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
		if ( ! dbe_feature_output_permitted( $id ) ) {
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
 * Theme, density and workspace bootstrap printed on wp_head (before the styles,
 * so the first paint already has the user's preferences), followed by the
 * concatenated chrome CSS.
 */
function dbe_print_builder_head() {
	if ( ! dbe_builder_output_allowed() ) {
		return;
	}

	if ( dbe_enabled( 'theme_switcher' ) || dbe_enabled( 'density_toggle' ) || dbe_enabled( 'panel_resize' ) || dbe_enabled( 'command_palette' ) || dbe_enabled( 'compact_panes' ) ) {
		$bootstrap = array(
			'theme'           => dbe_enabled( 'theme_switcher' ) ? dbe_setting( 'theme_default' ) : '',
			'density'         => dbe_enabled( 'density_toggle' ) ? dbe_setting( 'density_default' ) : '',
			'panelWidth'      => dbe_enabled( 'panel_resize' ),
			'panelVisibility' => dbe_enabled( 'command_palette' ),
			'compactPanes'    => dbe_enabled( 'compact_panes' ),
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
			if (cfg.panelVisibility) {
				try {
					var panels = JSON.parse(localStorage.getItem('dbeBuilderPanelVisibility') || '{}');
					d.classList.toggle('dbe-left-panel-hidden', panels.left === true);
					d.classList.toggle('dbe-right-panel-hidden', panels.right === true);
				} catch (e) {}
			}
			/* Default narrow sessions to the primary editing surface before the
			 * builder mounts. builder.js replaces this seed with the user's chosen
			 * compact view and removes it when the breakpoint clears. */
			if (cfg.compactPanes) {
				try {
					if (matchMedia('(max-width: 720px)').matches) {
						d.classList.add('dbe-compact-panes');
						d.dataset.dbeCompactPane = 'canvas';
					}
				} catch (e) {}
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
 * Config object (inline — it varies per site and per toggle set), the small
 * core runtime and the builder feature runtime on wp_footer.
 *
 * The scripts are plain `<script src>` tags printed directly, NOT inlined and
 * NOT enqueued. Inlining the large feature runtime defeated browser caching
 * on every builder load, while the wp_enqueue
 * pipeline under `?builderius` remains unproven (builder mode strips foreign
 * hooks — see the header docblock in the main plugin file). Printed tags
 * sidestep both: the browser caches each file, dependency order is explicit,
 * and no enqueue machinery is involved. Each file is versioned by filemtime
 * so a plugin update — or an edit while developing — busts its cache
 * immediately.
 */
function dbe_print_builder_footer() {
	if ( ! dbe_builder_output_allowed() ) {
		return;
	}

	$runtime_path         = DBE_DIR . 'assets/builder/js/core-runtime.js';
	$a11y_path            = DBE_DIR . 'assets/builder/js/chunks/a11y.js';
	$a11y_composites_path = DBE_DIR . 'assets/builder/js/chunks/a11y-composites.js';
	$workspace_path       = DBE_DIR . 'assets/builder/js/chunks/workspace.js';
	$commands_path        = DBE_DIR . 'assets/builder/js/chunks/commands.js';
	$builder_path         = DBE_DIR . 'assets/builder/js/builder.js';
	if ( ! is_readable( $runtime_path ) || ! is_readable( $a11y_path ) || ! is_readable( $a11y_composites_path ) || ! is_readable( $workspace_path ) || ! is_readable( $commands_path ) || ! is_readable( $builder_path ) ) {
		return;
	}

	$flags = array();
	foreach ( dbe_features() as $id => $feature ) {
		if ( ! empty( $feature['js'] ) ) {
			$flags[ $id ] = dbe_feature_output_permitted( $id );
		}
	}

	$config = array(
		'features'   => $flags,
		'theme'      => array( 'default' => dbe_setting( 'theme_default' ) ),
		'density'    => array( 'default' => dbe_setting( 'density_default' ) ),
		'rowActions' => array( 'mode' => dbe_setting( 'row_actions_mode' ) ),
		'palette'    => array( 'shortcut' => dbe_setting( 'palette_shortcut' ) ),
		'heartbeat'  => dbe_heartbeat_config(),
		'i18n'       => dbe_builder_strings(),
		'version'    => DBE_VERSION,
		'builderius' => array(
			'version' => function_exists( 'builderius_get_version' ) ? builderius_get_version() : '',
		),
	);

	$config['adminUrls'] = array(
		'dashboard' => admin_url(),
		'releases'  => current_user_can( 'manage_options' ) ? admin_url( 'admin.php?page=builderius-releases' ) : '',
		'settings'  => current_user_can( 'manage_options' ) ? admin_url( 'admin.php?page=builderius-settings' ) : '',
	);

	// Server-side presence beats ride the presence_heartbeat toggle; the
	// nonce enables cookie-authenticated REST from the builder page.
	if ( dbe_feature_output_permitted( 'presence_heartbeat' ) ) {
		$config['presence'] = array(
			'url'                => rest_url( 'dbe/v1/presence' ),
			'nonce'              => wp_create_nonce( 'wp_rest' ),
			'interval'           => 20000,
			'transitionInterval' => 2500,
		);
	}

	$runtime_src         = add_query_arg( 'ver', (string) filemtime( $runtime_path ), DBE_URL . 'assets/builder/js/core-runtime.js' );
	$a11y_src            = add_query_arg( 'ver', (string) filemtime( $a11y_path ), DBE_URL . 'assets/builder/js/chunks/a11y.js' );
	$a11y_composites_src = add_query_arg( 'ver', (string) filemtime( $a11y_composites_path ), DBE_URL . 'assets/builder/js/chunks/a11y-composites.js' );
	$workspace_src       = add_query_arg( 'ver', (string) filemtime( $workspace_path ), DBE_URL . 'assets/builder/js/chunks/workspace.js' );
	$commands_src        = add_query_arg( 'ver', (string) filemtime( $commands_path ), DBE_URL . 'assets/builder/js/chunks/commands.js' );
	$builder_src         = add_query_arg( 'ver', (string) filemtime( $builder_path ), DBE_URL . 'assets/builder/js/builder.js' );

	echo '<script id="dbe-builder-config">window.dbeBuilderEnhancements = ' . wp_json_encode( $config ) . ';</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo '<script id="dbe-builder-runtime-js" src="' . esc_url( $runtime_src ) . '"></script>' . "\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- deliberate: printed in dependency order because the enqueue pipeline is unproven under builder mode (see the function docblock).
	echo '<script id="dbe-builder-a11y-js" src="' . esc_url( $a11y_src ) . '"></script>' . "\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- deliberate: registers the accessibility chunk before builder.js supplies its host services.
	echo '<script id="dbe-builder-a11y-composites-js" src="' . esc_url( $a11y_composites_src ) . '"></script>' . "\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- deliberate: registers APG composite controllers before builder.js supplies its host services.
	echo '<script id="dbe-builder-workspace-js" src="' . esc_url( $workspace_src ) . '"></script>' . "\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- deliberate: registers responsive workspace controllers before builder.js supplies its host services.
	echo '<script id="dbe-builder-commands-js" src="' . esc_url( $commands_src ) . '"></script>' . "\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- deliberate: registers command and Navigator interaction controllers before builder.js supplies its host services.
	echo '<script id="dbe-builder-enhancements-js" src="' . esc_url( $builder_src ) . '"></script>' . "\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- deliberate: printed after the runtime and chunks so controllers register synchronously before boot.
}
add_action( 'wp_footer', 'dbe_print_builder_footer', 999 );
