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
 * Registry-derived defaults: every feature on, except experimental ones which
 * default off; enums at their declared default.
 *
 * @return array<string,mixed>
 */
function dbe_default_options(): array {
	$defaults = array();
	foreach ( dbe_features() as $id => $feature ) {
		$defaults[ $id ] = empty( $feature['experimental'] );
	}
	foreach ( dbe_enum_settings() as $id => $setting ) {
		$defaults[ $id ] = $setting['default'];
	}
	// Agent abilities: the master switch is opt-in, individual abilities
	// default on underneath it, and destructive/code-executing (danger)
	// abilities are individually opt-in as well.
	$defaults['abilities_enabled'] = false;
	foreach ( dbe_abilities() as $ability_id => $ability ) {
		$defaults[ dbe_ability_option_key( $ability_id ) ] = empty( $ability['danger'] );
	}
	return $defaults;
}

/**
 * The saved options merged over the defaults.
 *
 * @return array<string,mixed>
 */
function dbe_get_options(): array {
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
function dbe_builderius_pro_active(): bool {
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
function dbe_enabled( string $id ): bool {
	if ( ! dbe_feature_available( $id ) ) {
		return false;
	}
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
 * Whether a feature's builder output may be emitted to the CURRENT user.
 *
 * Extends dbe_enabled() with an optional per-feature capability gate: a
 * feature that declares a `cap` in the registry is reported to the builder
 * runtime only for users who hold that capability, even with the toggle on and
 * Builderius Pro active. Shared JavaScript chunks can still be delivered for
 * other features, so the runtime takes an immutable snapshot of these flags at
 * boot. This is a DBE builder-output gate only: the settings page still shows
 * the toggle (an administrator, who holds every capability, configures it for
 * everyone).
 *
 * The HTML converter features (Edit as HTML, Import HTML, Change tag) declare
 * `unfiltered_html`. They turn pasted or typed markup into stored elements
 * that Builderius renders raw — the same trust boundary WordPress's
 * `unfiltered_html` capability governs. On single site that is administrators
 * and editors; on multisite, only super admins (unless a site grants it), so
 * a lower-privileged builder user cannot use these DBE tools to plant markup
 * that runs for visitors. Builderius itself separately authorises all builder
 * writes with its `builderius-development` capability.
 *
 * @param string $id Feature id from dbe_features().
 * @return bool
 */
function dbe_feature_output_permitted( string $id ): bool {
	if ( ! dbe_enabled( $id ) ) {
		return false;
	}
	$features = dbe_features();
	$cap      = isset( $features[ $id ]['cap'] ) ? (string) $features[ $id ]['cap'] : '';

	/**
	 * Filter the capability a feature requires before its builder output is
	 * emitted. Return an empty string to drop the gate for a feature.
	 *
	 * @param string $cap Capability from the registry ('' when none).
	 * @param string $id  Feature id.
	 */
	$cap = (string) apply_filters( 'dbe_feature_cap', $cap, $id );

	if ( '' !== $cap && ! current_user_can( $cap ) ) {
		return false;
	}
	return true;
}

/**
 * Whether the agent abilities are enabled at all (the master switch).
 *
 * @return bool
 */
function dbe_abilities_enabled(): bool {
	if ( ! dbe_release_feature_available( 'agent_abilities' ) ) {
		return false;
	}
	$options = dbe_get_options();
	return ! empty( $options['abilities_enabled'] );
}

/**
 * Whether one agent ability is active: the master switch AND its own toggle.
 *
 * Registration in includes/abilities.php gates on this, so a disabled
 * ability is never registered and never appears to a connected agent.
 *
 * @param string $ability_id Ability id from dbe_abilities(), e.g. "dbe/publish".
 * @return bool
 */
function dbe_ability_enabled( string $ability_id ): bool {
	if ( ! dbe_abilities_enabled() ) {
		return false;
	}
	$registry = dbe_abilities();
	if ( ! isset( $registry[ $ability_id ] ) ) {
		return false;
	}
	$options = dbe_get_options();
	return ! empty( $options[ dbe_ability_option_key( $ability_id ) ] );
}

/**
 * An enum setting's current value.
 *
 * @param string $id Setting id from dbe_enum_settings().
 * @return string
 */
function dbe_setting( string $id ): string {
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
function dbe_any_enabled(): bool {
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
function dbe_sanitise_options( mixed $input ): array {
	$input    = is_array( $input ) ? $input : array();
	$clean    = array();
	$features = dbe_features();
	$saved    = dbe_get_options();
	$pro      = dbe_builderius_pro_active();

	foreach ( $features as $id => $feature ) {
		// A staged or parent-replaced feature has no field in this settings form.
		// Preserve its preference across a DBE or Builderius downgrade.
		if ( ! dbe_feature_available( $id ) ) {
			$clean[ $id ] = ! empty( $saved[ $id ] );
			continue;
		}
		// A Pro-locked toggle renders disabled, so the POST omits it. Keep the
		// saved preference rather than letting "absent" read as off. The user's
		// choice returns intact the moment Builderius Pro is active again.
		if ( ! empty( $feature['requires_pro'] ) && ! $pro ) {
			$clean[ $id ] = ! empty( $saved[ $id ] );
			continue;
		}
		$clean[ $id ] = ! empty( $input[ $id ] );
	}
	if ( dbe_release_feature_available( 'agent_abilities' ) ) {
		$clean['abilities_enabled'] = ! empty( $input['abilities_enabled'] );
		foreach ( array_keys( dbe_abilities() ) as $ability_id ) {
			$key           = dbe_ability_option_key( $ability_id );
			$clean[ $key ] = ! empty( $input[ $key ] );
		}
	} else {
		$clean['abilities_enabled'] = ! empty( $saved['abilities_enabled'] );
		foreach ( array_keys( dbe_abilities() ) as $ability_id ) {
			$key           = dbe_ability_option_key( $ability_id );
			$clean[ $key ] = ! empty( $saved[ $key ] );
		}
	}

	foreach ( dbe_enum_settings() as $id => $setting ) {
		// A select renders disabled whenever its parent feature is Pro-locked or
		// simply switched off, and a disabled control is absent from the POST.
		// Treat any absent select as "unchanged" and keep the saved choice, so a
		// parent toggled off and on again returns with its setting intact rather
		// than silently reset to the default.
		if ( ! isset( $input[ $id ] ) ) {
			$saved_value  = isset( $saved[ $id ] ) ? $saved[ $id ] : $setting['default'];
			$clean[ $id ] = array_key_exists( $saved_value, $setting['choices'] ) ? $saved_value : $setting['default'];
			continue;
		}
		$value        = sanitize_key( $input[ $id ] );
		$clean[ $id ] = array_key_exists( $value, $setting['choices'] ) ? $value : $setting['default'];
	}

	return $clean;
}
