<?php
/**
 * Builder-mode output: the chrome CSS and JS injected into the Builderius
 * builder page (a front-end request carrying `?builderius`).
 *
 * CSS is concatenated from per-feature files into a content-addressed uploads
 * bundle and linked directly in wp_head. This preserves render-blocking order
 * without adding the enabled CSS to every HTML response. If the uploads cache
 * cannot be written, the same trusted CSS falls back to inline delivery.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

require_once DBE_DIR . 'includes/builder-css-cache.php';

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
 * @param string[]|null $files Optional pre-resolved ordered file list.
 * @return string
 */
function dbe_builder_css( $files = null ) {
	$css   = '';
	$files = is_array( $files ) ? $files : dbe_builder_css_files();
	foreach ( $files as $file ) {
		$path = DBE_DIR . 'assets/builder/css/' . $file;
		if ( is_readable( $path ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading a bundled plugin CSS file, not a remote URL.
			$css .= "/* --- {$file} --- */\n" . file_get_contents( $path ) . "\n";
		}
	}
	return $css;
}

/**
 * The entity id of the template named in the builder entry URL, or 0.
 *
 * Builderius keys its persistent canvas tabs by entity id; the entry URL names
 * the template by slug. Resolved server-side so the head bootstrap can align
 * the stored active tab with the requested document before the SPA boots (see
 * the entryEntity block in dbe_print_builder_head()).
 *
 * @return int
 */
function dbe_builder_entry_entity_id(): int {
	if ( empty( $_GET['builderius_template'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only routing context, same signal builder mode itself keys on.
		return 0;
	}
	$slug = sanitize_title( wp_unslash( $_GET['builderius_template'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	if ( '' === $slug ) {
		return 0;
	}
	$posts = get_posts(
		array(
			'name'           => $slug,
			'post_type'      => 'builderius_template',
			'post_status'    => 'any',
			'posts_per_page' => 1,
			'fields'         => 'ids',
		)
	);
	return $posts ? (int) $posts[0] : 0;
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
	?>
	<script id="dbe-builder-store-bridge">
	(function (w, d) {
		function register() {
			try {
				var hooks = w.Builderius && w.Builderius.API && w.Builderius.API.hooks;
				var createElement = w.React && w.React.createElement;
				if (!hooks || typeof hooks.addFilter !== 'function' || !createElement) { return false; }
				hooks.addFilter('builderius.FooterPanelExtraButtons', 'dbe-store-bridge', function (component) {
					/* Capture the shared prop, then render Free's empty default or
					 * Pro/another extension's component unchanged. */
					return function DbeStoreBridge(props) {
						w.dbeBuilderiusStoreFns = props && props.storeFns;
						return component ? createElement(component, props) : null;
					};
				});
				return true;
			} catch (error) { return false; }
		}
		if (!register()) {
			d.addEventListener('builderius.api.started', register, { once: true });
		}
	})(window, document);
	</script>
	<?php

	if ( dbe_enabled( 'theme_switcher' ) || dbe_enabled( 'density_toggle' ) || dbe_enabled( 'panel_resize' ) || dbe_enabled( 'command_palette' ) || dbe_enabled( 'compact_panes' ) || dbe_enabled( 'panel_tabs' ) ) {
		$bootstrap = array(
			'theme'           => dbe_enabled( 'theme_switcher' ) ? dbe_setting( 'theme_default' ) : '',
			'density'         => dbe_enabled( 'density_toggle' ) ? dbe_setting( 'density_default' ) : '',
			'panelWidth'      => dbe_enabled( 'panel_resize' ),
			'panelVisibility' => dbe_enabled( 'command_palette' ),
			'compactPanes'    => dbe_enabled( 'compact_panes' ),
			'entryEntity'     => dbe_enabled( 'panel_tabs' ) ? dbe_builder_entry_entity_id() : 0,
		);
		?>
		<script id="dbe-theme-bootstrap">
		(function (d) {
			const cfg = <?php echo wp_json_encode( $bootstrap ); ?>;
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
				const mode = pick('dbeBuilderTheme', cfg.theme);
				d.dataset.dbeThemeMode = mode;
				d.dataset.dbeTheme = resolve(mode);
				// Auto keeps following the OS live, not just at load.
				try {
					matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
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
				/* Per-side widths; the pre-split shared key seeds a side that
				 * has never stored its own. Clamp mirrors builder.js. */
				const pwShared = pick('dbeBuilderPanelWidth', '');
				['Left', 'Right'].forEach((side) => {
					const pw = Number.parseInt(pick('dbeBuilderPanelWidth' + side, pwShared), 10);
					if (!Number.isNaN(pw)) {
						d.style.setProperty('--dbe-panel-width-' + side.toLowerCase(), Math.max(260, Math.min(600, pw)) + 'px');
					}
				});
			}
			if (cfg.panelVisibility) {
				try {
					const panels = JSON.parse(localStorage.getItem('dbeBuilderPanelVisibility') || '{}');
					d.classList.toggle('dbe-left-panel-hidden', panels.left === true);
					d.classList.toggle('dbe-right-panel-hidden', panels.right === true);
				} catch (e) {}
			}
			/*
			 * Builderius 1.3.6 restores the last-active persistent canvas tab
			 * AFTER the URL-requested document has already loaded — a wasted
			 * full preview load and a visible content swap, and the template
			 * named in the URL is abandoned (bug-reports
			 * 2026-08-16-builderius-canvas-loads-two-documents-on-entry).
			 * Align the stored active tab with the requested document BEFORE
			 * the SPA boots, so only one document loads and the URL wins.
			 */
			if (cfg.entryEntity) {
				try {
					const rawTabs = localStorage.getItem('builderius_open_tabs_v1');
					if (rawTabs) {
						const openTabs = JSON.parse(rawTabs);
						const entryKey = '0_' + cfg.entryEntity;
						if (openTabs && typeof openTabs === 'object' && openTabs.activeKey && openTabs.activeKey !== entryKey) {
							openTabs.activeKey = entryKey;
							localStorage.setItem('builderius_open_tabs_v1', JSON.stringify(openTabs));
						}
					}
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

	$bundle = dbe_builder_css_bundle();
	if ( false !== $bundle ) {
		// phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet -- direct head output is required because Builderius strips normal plugin enqueue hooks in builder mode.
		echo '<link id="dbe-builder-enhancements" rel="stylesheet" href="' . esc_url( $bundle['url'] ) . '" data-dbe-css-delivery="external">' . "\n";
		return;
	}

	$css = dbe_builder_css();
	if ( '' !== trim( $css ) ) {
		// Trusted plugin asset files — printed verbatim as a fail-soft fallback.
		echo '<style id="dbe-builder-enhancements" data-dbe-css-delivery="inline">' . "\n" . $css . '</style>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}
add_action( 'wp_head', 'dbe_print_builder_head', 999 );

/**
 * The JavaScript chunk manifest: delivery order, config key and the feature
 * ids that justify delivering each chunk.
 *
 * Every chunk registers behind a `typeof === 'function'` guard in builder.js
 * and every chunk-provided service has a no-op default there, so a chunk
 * whose features are all disabled can be skipped entirely — the runtime
 * degrades feature-by-feature rather than breaking. Each list holds the
 * feature ids the chunk itself checks with on('…'), curated against the
 * chunk sources; dbe_builder_chunks_needed() layers the one cross-chunk
 * dependency on top.
 *
 * @return array<string,array{config:string,features:string[]}> File stem
 *         (under assets/builder/js/chunks/) => config key and feature ids.
 */
function dbe_builder_chunk_manifest(): array {
	return array(
		'a11y'            => array(
			'config'   => 'a11y',
			'features' => array( 'chrome_landmarks', 'keyboard_shortcuts', 'tooltips' ),
		),
		'a11y-composites' => array(
			'config'   => 'a11yComposites',
			'features' => array( 'builderius_menu', 'element_moves', 'favourites_reorder', 'footer_toolbar', 'icon_declutter', 'inserter_keyboard', 'navigator_keyboard', 'panel_tabs', 'select_combobox', 'settings_accordions', 'tag_badges', 'tooltips', 'topbar_toolbar', 'tree_row_styling' ),
		),
		'workspace'       => array(
			'config'   => 'workspace',
			'features' => array( 'command_palette', 'compact_panes', 'css_code_default', 'density_toggle', 'keyboard_shortcuts', 'panel_detach', 'panel_resize', 'panel_tabs', 'preview_resize', 'reveal_selected', 'theme_switcher', 'tooltips' ),
		),
		'editing'         => array(
			'config'   => 'editing',
			'features' => array( 'attr_helpers', 'auto_bem', 'command_palette', 'condition_helpers', 'dblclick_rename', 'edit_as_html', 'element_moves', 'image_defaults', 'import_html', 'inline_rename', 'keyboard_shortcuts', 'navigator_paste', 'properties_reorder', 'save_shortcut', 'save_state_cue', 'tag_change', 'undo_delete', 'wrap_in' ),
		),
		'styles'          => array(
			'config'   => 'styles',
			'features' => array( 'css_code_default', 'css_hint_dialog', 'hide_minimap', 'scope_bar' ),
		),
		'integrations'    => array(
			'config'   => 'integrations',
			'features' => array( 'ai_terminal_tabs', 'presence_heartbeat' ),
		),
		'shortcuts'       => array(
			'config'   => 'shortcuts',
			// shortcuts_overlay lives in the commands chunk but drives this
			// chunk's discovery API (host.shortcuts), so it belongs here too.
			'features' => array( 'ai_terminal_tabs', 'command_palette', 'element_moves', 'keyboard_shortcuts', 'navigator_keyboard', 'save_shortcut', 'shortcuts_overlay' ),
		),
		'commands'        => array(
			'config'   => 'commands',
			'features' => array( 'auto_bem', 'collapse_expand_all', 'command_palette', 'context_menu', 'edit_as_html', 'element_moves', 'footer_toolbar', 'import_html', 'inline_rename', 'keyboard_shortcuts', 'navigator_keyboard', 'navigator_paste', 'navigator_row_actions', 'preview_context_menu', 'preview_rename', 'reveal_selected', 'save_split_button', 'shortcuts_overlay', 'tag_change', 'tree_search', 'wrap_in' ),
		),
	);
}

/**
 * Which chunks the current toggle set (and user) actually needs.
 *
 * A chunk is needed when any of its manifest features may emit output for the
 * current user. The commands controllers additionally consume services that
 * the editing, a11y-composites, workspace and shortcuts chunks register via
 * builder.js's set*Api hooks (rename/wrap/move verbs, the Navigator adapter,
 * panel verbs and shortcut discovery), so those four always accompany the
 * commands chunk rather than degrading its menus to the no-op defaults.
 *
 * @return array<string,bool> File stem => needed.
 */
function dbe_builder_chunks_needed(): array {
	$needed = array();
	foreach ( dbe_builder_chunk_manifest() as $stem => $chunk ) {
		$needed[ $stem ] = false;
		foreach ( $chunk['features'] as $id ) {
			if ( dbe_feature_output_permitted( $id ) ) {
				$needed[ $stem ] = true;
				break;
			}
		}
	}
	if ( $needed['commands'] ) {
		$needed['a11y-composites'] = true;
		$needed['workspace']       = true;
		$needed['editing']         = true;
		$needed['shortcuts']       = true;
	}
	return $needed;
}

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
 *
 * Chunks whose features are all disabled are not printed at all (see
 * dbe_builder_chunks_needed()); config.chunks records the decision so the
 * runtime can tell a deliberately omitted chunk from one that failed to load.
 * Every external tag carries `defer`, which preserves document order while
 * freeing the parser.
 */
function dbe_print_builder_footer() {
	if ( ! dbe_builder_output_allowed() ) {
		return;
	}

	$manifest     = dbe_builder_chunk_manifest();
	$runtime_path = DBE_DIR . 'assets/builder/js/core-runtime.js';
	$builder_path = DBE_DIR . 'assets/builder/js/builder.js';
	if ( ! is_readable( $runtime_path ) || ! is_readable( $builder_path ) ) {
		return;
	}
	$chunk_paths = array();
	foreach ( $manifest as $stem => $chunk ) {
		$path = DBE_DIR . 'assets/builder/js/chunks/' . $stem . '.js';
		if ( ! is_readable( $path ) ) {
			return;
		}
		$chunk_paths[ $stem ] = $path;
	}

	$flags = array();
	foreach ( dbe_features() as $id => $feature ) {
		if ( ! empty( $feature['js'] ) ) {
			$flags[ $id ] = dbe_feature_output_permitted( $id );
		}
	}
	$builderius_version = dbe_builderius_version();

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
			'version' => $builderius_version,
			'native'  => array(
				'elementShortcuts' => '' !== $builderius_version && version_compare( $builderius_version, '1.3.6-beta', '>=' ),
				'shortcutPanel'    => '' !== $builderius_version && version_compare( $builderius_version, '1.3.6-beta', '>=' ),
			),
		),
	);

	$config['adminUrls'] = array(
		'dashboard' => admin_url(),
		'releases'  => current_user_can( 'manage_options' ) ? admin_url( 'admin.php?page=builderius-releases' ) : '',
		'settings'  => current_user_can( 'manage_options' ) ? admin_url( 'admin.php?page=builderius-settings' ) : '',
	);

	$needed           = dbe_builder_chunks_needed();
	$config['chunks'] = array();
	foreach ( $manifest as $stem => $chunk ) {
		$config['chunks'][ $chunk['config'] ] = $needed[ $stem ];
	}

	$runtime_src = add_query_arg( 'ver', (string) filemtime( $runtime_path ), DBE_URL . 'assets/builder/js/core-runtime.js' );
	$builder_src = add_query_arg( 'ver', (string) filemtime( $builder_path ), DBE_URL . 'assets/builder/js/builder.js' );

	echo '<script id="dbe-builder-config">window.dbeBuilderEnhancements = ' . wp_json_encode( $config ) . ';</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo '<script id="dbe-builder-runtime-js" src="' . esc_url( $runtime_src ) . '" defer></script>' . "\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- deliberate: printed in dependency order because the enqueue pipeline is unproven under builder mode (see the function docblock).
	foreach ( $manifest as $stem => $chunk ) {
		if ( ! $needed[ $stem ] ) {
			continue;
		}
		$src = add_query_arg( 'ver', (string) filemtime( $chunk_paths[ $stem ] ), DBE_URL . 'assets/builder/js/chunks/' . $stem . '.js' );
		echo '<script id="dbe-builder-' . esc_attr( $stem ) . '-js" src="' . esc_url( $src ) . '" defer></script>' . "\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- deliberate: chunks register controllers before builder.js supplies its host services; defer preserves that order.
	}
	echo '<script id="dbe-builder-enhancements-js" src="' . esc_url( $builder_src ) . '" defer></script>' . "\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- deliberate: printed after the runtime and chunks so controllers register synchronously before boot.
}
add_action( 'wp_footer', 'dbe_print_builder_footer', 999 );

