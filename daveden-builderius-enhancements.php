<?php
/**
 * Plugin Name:       Daveden Builder Enhancements
 * Plugin URI:        https://github.com/Daveden2/daveden-builderius-enhancements
 * Description:       Quality-of-life, theming and accessibility enhancements for the Builderius builder UI, each behind its own toggle.
 * Version:           1.12.1
 * Author:            Daveden Digital
 * Author URI:        https://daveden.co.uk
 * License:           GPL-2.0-or-later
 * Text Domain:       daveden-builderius-enhancements
 * Domain Path:       /languages
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Requires Plugins:  builderius
 *
 * Builderius (the free wordpress.org plugin, slug "builderius") is a hard
 * dependency. On WordPress 6.5+ the Requires Plugins header above enforces it
 * natively — blocking activation until Builderius is active and offering to
 * install/activate it. On 6.4 the header is ignored, so the dbe_activate()
 * guard and the runtime dbe_builderius_is_active() check below still apply.
 *
 * Targets Builderius 1.3.5-beta. Every selector, store access
 * (window.__builderiusStoreFns) and hook (Builderius.API.hooks) the builder
 * assets rely on was audited against that version — re-audit after any
 * Builderius update. All JS features fail soft (try/catch, presence checks),
 * so a selector drift degrades to "feature missing", never a broken builder.
 *
 * CRITICAL — the plugin directory name MUST contain "builderius". In builder
 * mode Builderius removes EVERY hook whose callback file lives under
 * wp-content/plugins unless the file path contains an allowlisted plugin name
 * ('builderius' / 'builderius-pro') — see PluginsHooksRemovalHook (runs on
 * `wp` priority 1, front-end builder mode only) and PluginsVersionsProvider.
 * The slug daveden-builderius-enhancements passes that substring check; rename
 * the folder and every wp_head/wp_footer feature silently vanishes in the
 * builder. Re-verify the check after Builderius updates.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

define( 'DBE_VERSION', '1.12.1' );
define( 'DBE_FILE', __FILE__ );
define( 'DBE_DIR', plugin_dir_path( __FILE__ ) );
define( 'DBE_URL', plugin_dir_url( __FILE__ ) );

require_once DBE_DIR . 'vendor/plugin-update-checker/plugin-update-checker.php';

/*
 * Automatic updates from GitHub: the checker compares DBE's Version header
 * against the latest release tag on the public repo and surfaces updates on
 * the Plugins screen. Release flow: bump version → commit → tag vX.Y.Z →
 * publish a GitHub release.
 */
$dbe_update_checker = \YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(
	'https://github.com/Daveden2/daveden-builderius-enhancements/',
	__FILE__,
	'daveden-builderius-enhancements'
);

/*
 * Plugin icon for the WordPress updates UI (the update row and the plugin
 * details modal). Served from the installed plugin's own assets, so it
 * always matches the running version.
 */

/*
 * Prefer the clean zip attached to each release (built by bin/build-zip.sh,
 * unpacks to daveden-builderius-enhancements/) over GitHub's auto-generated
 * source archive, which unpacks to a version-suffixed folder and would install
 * as a duplicate plugin. Falls back to the source zip if no matching asset is
 * attached (PREFER_RELEASE_ASSETS is the default preference).
 */
$dbe_update_checker->getVcsApi()->enableReleaseAssets( '/daveden-builderius-enhancements\.zip$/i' );

$dbe_update_checker->addResultFilter(
	function ( $info ) {
		$info->icons = array(
			'svg' => DBE_URL . 'assets/icon.svg',
			'1x'  => DBE_URL . 'assets/icon-128.png',
			'2x'  => DBE_URL . 'assets/icon-256.png',
		);
		return $info;
	}
);

/**
 * Is Builderius active?
 *
 * DBE is a companion to Builderius and has nothing to enhance without it.
 * We detect the parent by a function Builderius declares unconditionally at
 * the top of its main file, rather than a hard-coded plugin path — that keeps
 * the check working if Builderius is ever installed under a different folder
 * and needs no wp-admin/includes/plugin.php include on the front end.
 *
 * Only reliable from plugins_loaded onwards: network-activated plugins load
 * before per-site ones, so if DBE is network-active on a multisite and
 * Builderius is activated per site, Builderius has not loaded yet while DBE's
 * own file runs. dbe_bootstrap() defers the check accordingly. The activation
 * guard may call it earlier — there the plugin being activated is loaded last,
 * after every already-active plugin, so the check holds.
 *
 * @return bool
 */
function dbe_builderius_is_active() {
	return function_exists( 'builderius_get_version' );
}

require_once DBE_DIR . 'includes/update-info-fallback.php';
require_once DBE_DIR . 'includes/features.php';
require_once DBE_DIR . 'includes/i18n-builder.php';
require_once DBE_DIR . 'includes/options.php';
require_once DBE_DIR . 'includes/settings-page.php';

add_action( 'plugins_loaded', 'dbe_bootstrap', 0 );

/**
 * Include the builder-facing output once every active plugin has loaded.
 *
 * Builder-facing output only makes sense when Builderius is running. If the
 * parent plugin is inactive, skip these features (they hook wp_head/wp_footer/
 * admin_bar to enhance the builder) and surface an admin notice instead. The
 * settings screen above still loads so toggles remain reachable.
 *
 * Deferred to plugins_loaded (rather than decided at load time) so the
 * detection also works on multisite when DBE is network-active and Builderius
 * is activated per site — see dbe_builderius_is_active(). Everything these
 * files register (wp_head, wp_footer, admin_bar_menu) fires later still.
 */
function dbe_bootstrap() {
	if ( dbe_builderius_is_active() ) {
		require_once DBE_DIR . 'includes/output-builder.php';
		require_once DBE_DIR . 'includes/output-preview.php';
		require_once DBE_DIR . 'includes/admin-bar.php';
	} else {
		add_action( 'admin_notices', 'dbe_builderius_missing_notice' );
	}
}

/**
 * Warn that Builderius is required when the parent plugin is not active.
 */
function dbe_builderius_missing_notice() {
	if ( ! current_user_can( 'activate_plugins' ) ) {
		return;
	}
	printf(
		'<div class="notice notice-warning"><p>%s</p></div>',
		esc_html__(
			'Daveden Builder Enhancements is a companion to Builderius and stays dormant until Builderius is active. Please activate Builderius to use its enhancements.',
			'daveden-builderius-enhancements'
		)
	);
}

/**
 * Load bundled translations from /languages. WordPress loads community
 * language packs on its own; this covers translations shipped with the
 * plugin itself (it is distributed from GitHub, not wordpress.org).
 */
function dbe_load_textdomain() {
	load_plugin_textdomain( 'daveden-builderius-enhancements', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}
add_action( 'init', 'dbe_load_textdomain' );

register_activation_hook( __FILE__, 'dbe_activate' );

/**
 * Refuse activation without Builderius, then seed the options row so every
 * toggle exists explicitly. Builderius is a hard dependency: there is nothing
 * to enhance without it, so we block activation with a friendly message rather
 * than let the plugin activate into a no-op state.
 */
function dbe_activate() {
	if ( ! dbe_builderius_is_active() ) {
		deactivate_plugins( plugin_basename( __FILE__ ) );
		wp_die(
			esc_html__(
				'Daveden Builder Enhancements requires the Builderius plugin. Please install and activate Builderius first, then activate this plugin.',
				'daveden-builderius-enhancements'
			),
			esc_html__( 'Builderius required', 'daveden-builderius-enhancements' ),
			array( 'back_link' => true )
		);
	}

	add_option( 'daveden_builder_enhancements', dbe_default_options(), '', true );
}
