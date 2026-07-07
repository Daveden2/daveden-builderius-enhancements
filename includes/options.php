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
 * Whether Builderius Pro is active.
 *
 * Checked against the active-plugins option (network activation included) so no
 * admin-only include is pulled into the front-end builder request. Cached for
 * the request. Features flagged `requires_pro` are gated on this; see
 * dbe_enabled().
 *
 * @return bool
 */
function dbe_builderius_pro_active() {
	static $active = null;
	if ( null === $active ) {
		$plugin = 'builderius-pro/builderius-pro.php';
		$active = in_array( $plugin, (array) get_option( 'active_plugins', array() ), true )
			|| ( is_multisite() && array_key_exists( $plugin, (array) get_site_option( 'active_sitewide_plugins', array() ) ) );
	}
	return (bool) $active;
}

/**
 * Whether a feature toggle is enabled.
 *
 * A feature flagged `requires_pro` in the registry is reported disabled whenever
 * Builderius Pro is inactive, regardless of its saved toggle, so its CSS and JS
 * are never emitted (both dbe_builder_css_files() and the builder config gate on
 * this function).
 *
 * @param string $id Feature id from dbe_features().
 * @return bool
 */
function dbe_enabled( $id ) {
	$options = dbe_get_options();
	if ( empty( $options[ $id ] ) ) {
		return false;
	}
	$features = dbe_features();
	if ( ! empty( $features[ $id ]['requires_pro'] ) && ! dbe_builderius_pro_active() ) {
		return false;
	}
	return true;
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
	$input    = is_array( $input ) ? $input : array();
	$clean    = array();
	$features = dbe_features();
	$saved    = dbe_get_options();
	$pro      = dbe_builderius_pro_active();

	foreach ( $features as $id => $feature ) {
		// A Pro-locked toggle renders disabled, so the POST omits it. Keep the
		// saved preference rather than letting "absent" read as off. The user's
		// choice returns intact the moment Builderius Pro is active again.
		if ( ! empty( $feature['requires_pro'] ) && ! $pro ) {
			$clean[ $id ] = ! empty( $saved[ $id ] );
			continue;
		}
		$clean[ $id ] = ! empty( $input[ $id ] );
	}
	foreach ( dbe_enum_settings() as $id => $setting ) {
		// Same as above: a select under a Pro-locked parent renders disabled and
		// drops out of the POST, so preserve the saved choice instead of resetting
		// it to the default.
		$parent = isset( $setting['parent'] ) ? $setting['parent'] : '';
		if ( $parent && ! empty( $features[ $parent ]['requires_pro'] ) && ! $pro ) {
			$saved_value  = isset( $saved[ $id ] ) ? $saved[ $id ] : $setting['default'];
			$clean[ $id ] = array_key_exists( $saved_value, $setting['choices'] ) ? $saved_value : $setting['default'];
			continue;
		}
		$value        = isset( $input[ $id ] ) ? sanitize_key( $input[ $id ] ) : '';
		$clean[ $id ] = array_key_exists( $value, $setting['choices'] ) ? $value : $setting['default'];
	}

	return $clean;
}
