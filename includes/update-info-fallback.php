<?php
/**
 * Local fallback for the "View details" / changelog modal.
 *
 * The update checker populates that modal by fetching readme.txt from GitHub.
 * When the request fails — GitHub unreachable, or its 60-requests-per-hour
 * unauthenticated rate limit (shared per server IP) exhausted — WordPress falls
 * through to the wordpress.org plugins API, which answers "Plugin not found"
 * because this plugin is not hosted there.
 *
 * This filter runs after the update checker (priority 100 vs its 20). When no
 * usable info was produced, it builds the info object from the bundled
 * readme.txt, so the modal always shows the changelog and never reaches
 * wordpress.org. When the update checker did serve real info, it is left
 * untouched.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

add_filter( 'plugins_api', 'dbe_plugin_information_fallback', 100, 3 );

/**
 * Serve plugin-information from the bundled readme.txt when the remote lookup
 * came back empty.
 *
 * @param false|object|WP_Error $result The result from earlier filters / core.
 * @param string                $action The requested plugins_api action.
 * @param object                $args   Request arguments (expects ->slug).
 * @return false|object|WP_Error
 */
function dbe_plugin_information_fallback( $result, $action, $args ) {
	if ( 'plugin_information' !== $action
		|| empty( $args->slug )
		|| 'daveden-builderius-enhancements' !== $args->slug ) {
		return $result;
	}

	// The update checker already returned usable info — leave it be.
	if ( is_object( $result ) && ! empty( $result->sections ) ) {
		return $result;
	}

	$readme_path = DBE_DIR . 'readme.txt';
	$parser_path = DBE_DIR . 'vendor/plugin-update-checker/vendor/PucReadmeParser.php';
	if ( ! is_readable( $readme_path ) || ! is_readable( $parser_path ) ) {
		return $result;
	}

	if ( ! class_exists( 'PucReadmeParser' ) ) {
		require_once $parser_path;
	}

	$parser = new PucReadmeParser();
	$readme = $parser->parse_readme( $readme_path );
	if ( empty( $readme['sections'] ) ) {
		return $result;
	}

	if ( ! function_exists( 'get_plugin_data' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}
	$header = get_plugin_data( DBE_FILE, false, false );

	$info                    = new stdClass();
	$info->name              = $header['Name'];
	$info->slug              = 'daveden-builderius-enhancements';
	$info->version           = '' !== $readme['stable_tag'] ? $readme['stable_tag'] : $header['Version'];
	$info->author            = $header['AuthorURI']
		? sprintf( '<a href="%s">%s</a>', esc_url( $header['AuthorURI'] ), esc_html( $header['AuthorName'] ) )
		: $header['AuthorName'];
	$info->homepage          = $header['PluginURI'];
	$info->requires          = $readme['requires_at_least'];
	$info->tested            = $readme['tested_up_to'];
	$info->requires_php      = $readme['requires_php'];
	$info->short_description = $readme['short_description'];
	$info->sections          = $readme['sections'];
	$info->download_link     = '';

	return $info;
}
