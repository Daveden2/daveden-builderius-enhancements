<?php
/**
 * Uninstall: remove the options row.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'daveden_builder_enhancements' );
