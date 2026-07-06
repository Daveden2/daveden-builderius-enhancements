<?php
/**
 * Plugin Name:       Daveden Builder Enhancements
 * Description:       Quality-of-life, theming and accessibility enhancements for the Builderius builder UI — each behind its own toggle.
 * Version:           1.0.0
 * Author:            Daveden Digital
 * License:           GPL-2.0-or-later
 * Text Domain:       daveden-builderius-enhancements
 * Requires at least: 6.4
 * Requires PHP:      7.4
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

define( 'DBE_VERSION', '1.0.0' );
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
\YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(
	'https://github.com/Daveden2/daveden-builderius-enhancements/',
	__FILE__,
	'daveden-builderius-enhancements'
);

require_once DBE_DIR . 'includes/features.php';
require_once DBE_DIR . 'includes/options.php';
require_once DBE_DIR . 'includes/settings-page.php';
require_once DBE_DIR . 'includes/output-builder.php';
require_once DBE_DIR . 'includes/output-preview.php';
require_once DBE_DIR . 'includes/admin-bar.php';

register_activation_hook( __FILE__, 'dbe_activate' );

/**
 * Seed the options row on activation so every toggle exists explicitly.
 */
function dbe_activate() {
	add_option( 'daveden_builder_enhancements', dbe_default_options(), '', true );
}
