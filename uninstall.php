<?php
/**
 * Uninstall: remove everything the plugin stored.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'daveden_builder_enhancements' );

// The bundled Plugin Update Checker keeps its update-check state in its own
// options row (and the site-wide copy on multisite).
delete_option( 'external_updates-daveden-builderius-enhancements' );
delete_site_option( 'external_updates-daveden-builderius-enhancements' );
