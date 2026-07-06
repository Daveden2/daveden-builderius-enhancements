<?php
/**
 * Options access, defaults and sanitisation.
 *
 * One autoloaded array option (`daveden_builder_enhancements`) holds every
 * toggle as an explicit boolean plus the enum settings. All reads pass
 * through the registry-derived defaults, so features added later default on
 * without a migration.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

const DBE_OPTION = 'daveden_builder_enhancements';

/**
 * Registry-derived defaults: every feature on, enums at their declared default.
 *
 * @return array<string,mixed>
 */
function dbe_default_options() {
	$defaults = array_fill_keys( array_keys( dbe_features() ), true );
	foreach ( dbe_enum_settings() as $id => $setting ) {
		$defaults[ $id ] = $setting['default'];
	}
	return $defaults;
}

/**
 * The saved options merged over the defaults.
 *
 * @return array<string,mixed>
 */
function dbe_get_options() {
	static $options = null;
	if ( null === $options ) {
		$options = wp_parse_args( (array) get_option( DBE_OPTION, array() ), dbe_default_options() );
	}
	return $options;
}

/**
 * Whether a feature toggle is enabled.
 *
 * @param string $id Feature id from dbe_features().
 * @return bool
 */
function dbe_enabled( $id ) {
	$options = dbe_get_options();
	return ! empty( $options[ $id ] );
}

/**
 * An enum setting's current value.
 *
 * @param string $id Setting id from dbe_enum_settings().
 * @return string
 */
function dbe_setting( $id ) {
	$options = dbe_get_options();
	$enums   = dbe_enum_settings();
	$value   = isset( $options[ $id ] ) ? (string) $options[ $id ] : '';
	if ( isset( $enums[ $id ] ) && ! array_key_exists( $value, $enums[ $id ]['choices'] ) ) {
		$value = $enums[ $id ]['default'];
	}
	return $value;
}

/**
 * Whether any feature at all is enabled (skip output entirely when not).
 *
 * @return bool
 */
function dbe_any_enabled() {
	foreach ( array_keys( dbe_features() ) as $id ) {
		if ( dbe_enabled( $id ) ) {
			return true;
		}
	}
	return false;
}

/**
 * Sanitise the posted options array.
 *
 * Unchecked checkboxes are absent from the POST, so every registry id is
 * written back as an explicit boolean; enums are validated against their
 * declared choices. Nothing outside the registry is accepted.
 *
 * @param mixed $input Raw posted value.
 * @return array<string,mixed>
 */
function dbe_sanitise_options( $input ) {
	$input = is_array( $input ) ? $input : array();
	$clean = array();

	foreach ( array_keys( dbe_features() ) as $id ) {
		$clean[ $id ] = ! empty( $input[ $id ] );
	}
	foreach ( dbe_enum_settings() as $id => $setting ) {
		$value        = isset( $input[ $id ] ) ? sanitize_key( $input[ $id ] ) : '';
		$clean[ $id ] = array_key_exists( $value, $setting['choices'] ) ? $value : $setting['default'];
	}

	return $clean;
}
