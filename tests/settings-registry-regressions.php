<?php
/**
 * Focused settings-registry and option-sanitisation regressions.
 *
 * Two things are guarded here:
 *
 * 1. The taxonomy invariants the settings page relies on. Every feature must
 *    live in a tab that exists and in a declared section of that tab, or it
 *    silently falls into the "Other enhancements" bucket where nobody expects
 *    it.
 * 2. Enum preservation in dbe_sanitise_options(). A select whose parent feature
 *    is switched off renders disabled and therefore drops out of the POST. If
 *    "absent" were read as "reset", switching a feature off and on again would
 *    silently lose the user's choice.
 *
 * Runs without WordPress by stubbing only the small API surface the feature and
 * option registries use.
 *
 * @package Daveden_Builder_Enhancements
 */

define( 'ABSPATH', __DIR__ );

$plugin_source = file_get_contents( dirname( __DIR__ ) . '/daveden-builderius-enhancements.php' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local test fixture, never a URL.
if ( ! preg_match( "/define\( 'DBE_VERSION', '([^']+)' \);/", $plugin_source, $version_match ) ) {
	fwrite( STDERR, "Could not read DBE_VERSION.\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite -- CLI test failure output.
	exit( 1 );
}
define( 'DBE_VERSION', $version_match[1] );

/*
 * dbe_get_options() caches for the request, so the saved fixture is fixed for
 * the whole run and every sanitisation case is written against it.
 */
$dbe_test_option             = array(
	'theme_switcher'   => true,
	'theme_default'    => 'dark',
	'density_default'  => 'compact',
	'palette_shortcut' => 'mod-slash',
);
$dbe_test_builderius_version = '1.3.6-beta';

/**
 * Return the Builderius compatibility fixture version.
 *
 * @return string
 */
function builderius_get_version() {
	global $dbe_test_builderius_version;
	return $dbe_test_builderius_version;
}

/**
 * Stub WordPress translation for a registry-only test.
 *
 * @param string $text Source text.
 * @return string
 */
function __( $text ) {
	return $text;
}

/**
 * Stub WordPress filters without changing the version-derived result.
 *
 * @param string $hook  Filter name.
 * @param mixed  $value Filter value.
 * @return mixed
 */
function apply_filters( $hook, $value ) {
	return $value;
}

/**
 * Merge saved values over defaults like wp_parse_args().
 *
 * @param array $args     Saved values.
 * @param array $defaults Default values.
 * @return array
 */
function wp_parse_args( $args, $defaults ) {
	return array_merge( $defaults, $args );
}

/**
 * Return the test plugin option and an active Builderius Pro fixture.
 *
 * @param string $name     Option name.
 * @param mixed  $fallback Fallback value.
 * @return mixed
 */
function get_option( $name, $fallback = false ) {
	global $dbe_test_option;
	if ( 'daveden_builder_enhancements' === $name ) {
		return $dbe_test_option;
	}
	if ( 'active_plugins' === $name ) {
		return array( 'builderius-pro/builderius-pro.php' );
	}
	return $fallback;
}

/**
 * Return the supplied fallback for unused network options.
 *
 * @param string $name     Option name.
 * @param mixed  $fallback Fallback value.
 * @return mixed
 */
function get_site_option( $name, $fallback = false ) {
	return $fallback;
}

/** Keep this fixture in single-site mode. */
function is_multisite() {
	return false;
}

/**
 * Grant the capability gates exercised by dbe_enabled().
 *
 * @param string $capability Capability name.
 * @return bool
 */
function current_user_can( $capability ) {
	return '' !== $capability;
}

/**
 * Minimal sanitize_key() equivalent for enum-option tests.
 *
 * @param mixed $value Raw value.
 * @return string
 */
function sanitize_key( $value ) {
	return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) );
}

/**
 * Plural form stub: the settings page counts experimental features.
 *
 * @param string $single Singular text.
 * @param string $plural Plural text.
 * @param int    $number Count.
 * @return string
 */
function _n( $single, $plural, $number ) {
	return 1 === (int) $number ? $single : $plural;
}

require_once dirname( __DIR__ ) . '/includes/features.php';
require_once dirname( __DIR__ ) . '/includes/options.php';

$failures = array();

/**
 * Record one regression without stopping the remaining checks.
 *
 * @param bool   $condition Whether the assertion passed.
 * @param string $message   Failure detail.
 * @return void
 */
function dbe_settings_test_assert( $condition, $message ) {
	global $failures;
	if ( ! $condition ) {
		$failures[] = $message;
	}
}

/* ------------------------------------------------ Taxonomy invariants */

$dbe_tab_list = dbe_tabs();
$sections     = dbe_feature_sections();
$features     = dbe_available_features();

$placed = array();
foreach ( $sections as $tab_slug => $tab_sections ) {
	dbe_settings_test_assert(
		isset( $dbe_tab_list[ $tab_slug ] ),
		sprintf( 'Sections declared for tab "%s", which is not in dbe_tabs().', $tab_slug )
	);
	foreach ( $tab_sections as $section ) {
		foreach ( $section['features'] as $feature_id ) {
			// A section may list a feature staged for a later release line; it is
			// simply skipped while unavailable. It must never list an unknown id.
			if ( ! isset( $features[ $feature_id ] ) ) {
				dbe_settings_test_assert(
					isset( dbe_features()[ $feature_id ] ),
					sprintf( 'Section "%s" lists unknown feature "%s".', $section['title'], $feature_id )
				);
				continue;
			}
			dbe_settings_test_assert(
				$features[ $feature_id ]['tab'] === $tab_slug,
				sprintf( 'Feature "%s" is sectioned under "%s" but registered to tab "%s".', $feature_id, $tab_slug, $features[ $feature_id ]['tab'] )
			);
			dbe_settings_test_assert(
				! isset( $placed[ $feature_id ] ),
				sprintf( 'Feature "%s" appears in more than one section.', $feature_id )
			);
			$placed[ $feature_id ] = $tab_slug;
		}
	}
}

foreach ( $features as $feature_id => $feature ) {
	dbe_settings_test_assert(
		isset( $dbe_tab_list[ $feature['tab'] ] ),
		sprintf( 'Feature "%s" is registered to tab "%s", which is not in dbe_tabs().', $feature_id, $feature['tab'] )
	);
	dbe_settings_test_assert(
		isset( $placed[ $feature_id ] ),
		sprintf( 'Feature "%s" is in no section, so it falls into "Other enhancements".', $feature_id )
	);
}

foreach ( dbe_enum_settings() as $enum_id => $enum ) {
	dbe_settings_test_assert(
		isset( $features[ $enum['parent'] ] ) || isset( dbe_features()[ $enum['parent'] ] ),
		sprintf( 'Enum "%s" hangs off unknown parent feature "%s".', $enum_id, $enum['parent'] )
	);
	dbe_settings_test_assert(
		array_key_exists( $enum['default'], $enum['choices'] ),
		sprintf( 'Enum "%s" defaults to "%s", which is not one of its choices.', $enum_id, $enum['default'] )
	);
}

foreach ( dbe_feature_presets() as $preset_id => $preset ) {
	foreach ( $preset['features'] as $feature_id ) {
		dbe_settings_test_assert(
			isset( $features[ $feature_id ] ),
			sprintf( 'Preset "%s" enables "%s", which is not available in this release line.', $preset_id, $feature_id )
		);
	}
}

/* -------------------------- Builderius-native feature retirement */

$native_feature_ids = array( 'auto_bem', 'css_code_default', 'dblclick_rename', 'inline_rename', 'preview_resize', 'save_state_cue', 'scope_bar', 'undo_delete' );
$replaced_ids       = array_keys( dbe_builderius_replaced_features() );
sort( $replaced_ids );

dbe_settings_test_assert(
	$native_feature_ids === $replaced_ids,
	'Builderius 1.3.6-beta did not retire exactly the audited native duplicates.'
);

foreach ( $native_feature_ids as $feature_id ) {
	dbe_settings_test_assert(
		! dbe_feature_replaced_by_builderius_for_version( $feature_id, '1.3.5-beta' ),
		sprintf( 'Feature "%s" retired before Builderius 1.3.6-beta.', $feature_id )
	);
	dbe_settings_test_assert(
		dbe_feature_replaced_by_builderius_for_version( $feature_id, '1.3.6-beta' ),
		sprintf( 'Feature "%s" remains available on Builderius 1.3.6-beta.', $feature_id )
	);
	dbe_settings_test_assert(
		! isset( $features[ $feature_id ] ) && ! dbe_enabled( $feature_id ),
		sprintf( 'Feature "%s" still appears or emits output after native replacement.', $feature_id )
	);
}

foreach ( array( 'context_menu', 'favourites_reorder', 'keyboard_shortcuts', 'tag_badges' ) as $feature_id ) {
	dbe_settings_test_assert(
		! dbe_feature_replaced_by_builderius_for_version( $feature_id, '1.3.6-beta' ),
		sprintf( 'Additive feature "%s" was retired prematurely.', $feature_id )
	);
}

/* ------------------------------- Enum preservation in the sanitiser */

// The regression this guards: a select whose parent feature is off renders
// disabled, so it is absent from the POST. Absent must mean "unchanged".
$clean = dbe_sanitise_options(
	array(
		'density_default' => 'comfortable',
	)
);

foreach ( $native_feature_ids as $feature_id ) {
	dbe_settings_test_assert(
		! empty( $clean[ $feature_id ] ),
		sprintf( 'Saving settings discarded retired feature preference "%s".', $feature_id )
	);
}

dbe_settings_test_assert(
	'dark' === $clean['theme_default'],
	sprintf( 'An absent enum was reset instead of preserved (theme_default became "%s", expected "dark").', $clean['theme_default'] )
);
dbe_settings_test_assert(
	'mod-slash' === $clean['palette_shortcut'],
	sprintf( 'An absent enum was reset instead of preserved (palette_shortcut became "%s").', $clean['palette_shortcut'] )
);
dbe_settings_test_assert(
	'comfortable' === $clean['density_default'],
	'A posted enum value was not applied.'
);
dbe_settings_test_assert(
	false === $clean['theme_switcher'],
	'An absent checkbox must read as off.'
);
dbe_settings_test_assert(
	! array_key_exists( 'evil_key', dbe_sanitise_options( array( 'evil_key' => '1' ) ) ),
	'A key outside the registry was accepted.'
);

$invalid = dbe_sanitise_options( array( 'theme_default' => 'chartreuse' ) );
dbe_settings_test_assert(
	'auto' === $invalid['theme_default'],
	sprintf( 'An invalid posted enum should fall back to its default, got "%s".', $invalid['theme_default'] )
);

if ( $failures ) {
	fwrite( STDERR, "Settings registry regressions FAILED:\n- " . implode( "\n- ", $failures ) . "\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite -- CLI test failure output.
	exit( 1 );
}

echo 'Settings registry regressions passed for ' . DBE_VERSION . ".\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Trusted CLI test output.
