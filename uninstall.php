<?php
/**
 * Uninstall: remove everything the plugin stored.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

/**
 * Remove DBE data from the current site's options table.
 */
function dbe_uninstall_site_data(): void {
	global $wpdb;

	delete_option( 'daveden_builder_enhancements' );
	delete_option( 'external_updates-daveden-builderius-enhancements' );

	$uploads = wp_upload_dir( null, false, true );
	if ( empty( $uploads['error'] ) && ! empty( $uploads['basedir'] ) ) {
		$cache_directory = trailingslashit( $uploads['basedir'] ) . 'dbe-builder-css';
		$cache_files     = glob( trailingslashit( $cache_directory ) . 'builder-*.css' );
		if ( is_array( $cache_files ) ) {
			foreach ( $cache_files as $cache_file ) {
				if ( 1 === preg_match( '/^builder-[a-f0-9]{64}\.css$/', basename( $cache_file ) ) ) {
					wp_delete_file( $cache_file );
				}
			}
		}
		// This succeeds only when the plugin-owned directory is empty.
		@rmdir( $cache_directory ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged,WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
	}
}

if ( is_multisite() ) {
	$site_ids = get_sites(
		array(
			'fields' => 'ids',
			'number' => 0,
		)
	);
	foreach ( $site_ids as $site_id ) {
		switch_to_blog( (int) $site_id );
		dbe_uninstall_site_data();
		restore_current_blog();
	}
} else {
	dbe_uninstall_site_data();
}

// The bundled Plugin Update Checker keeps its update-check state in its own
// options row (and the site-wide copy on multisite).
delete_site_option( 'external_updates-daveden-builderius-enhancements' );
