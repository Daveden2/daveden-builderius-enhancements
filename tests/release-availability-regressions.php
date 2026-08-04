<?php
/**
 * Focused release-line availability regressions.
 *
 * Runs without WordPress by stubbing only the small API surface used by the
 * feature and option registries.
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

$dbe_test_option = array();

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
function dbe_release_test_assert( $condition, $message ) {
	global $failures;
	if ( ! $condition ) {
		$failures[] = $message;
	}
}

$matrix = array(
	'1.14.0'       => array( false, false ),
	'2.0.0-dev-16' => array( false, false ),
	'2.1.0-dev-1'  => array( false, false ),
	'2.1.3'        => array( false, false ),
	'2.2.0-rc.1'   => array( true, false ),
	'2.3.0-dev-1'  => array( true, true ),
	'3.0.0'        => array( true, true ),
	'invalid'      => array( false, false ),
);

foreach ( $matrix as $version => $expected ) {
	dbe_release_test_assert(
		dbe_release_feature_available_for_version( 'agent_abilities', $version ) === $expected[0],
		'Agent abilities availability is wrong for ' . $version . '.'
	);
	dbe_release_test_assert(
		dbe_release_feature_available_for_version( 'style_inspector', $version ) === $expected[1],
		'Style inspector availability is wrong for ' . $version . '.'
	);
}

$current_agent = dbe_release_feature_available_for_version( 'agent_abilities', DBE_VERSION );
$current_style = dbe_release_feature_available_for_version( 'style_inspector', DBE_VERSION );

$dbe_test_option                      = dbe_default_options();
$dbe_test_option['abilities_enabled'] = true;
$dbe_test_option['style_inspector']   = true;
foreach ( array_keys( dbe_abilities() ) as $ability_id ) {
	$dbe_test_option[ dbe_ability_option_key( $ability_id ) ] = true;
}

dbe_release_test_assert(
	array_key_exists( 'abilities', dbe_tabs() ) === $current_agent,
	'The Agent abilities settings tab does not match the current release line.'
);
dbe_release_test_assert(
	array_key_exists( 'style_inspector', dbe_available_features() ) === $current_style,
	'The settings feature registry does not match style-inspector availability.'
);
dbe_release_test_assert(
	dbe_abilities_enabled() === $current_agent,
	'The saved Agent abilities master switch bypasses its release boundary.'
);
dbe_release_test_assert(
	dbe_enabled( 'style_inspector' ) === $current_style,
	'The saved Style inspector toggle bypasses its release boundary.'
);

$sanitised = dbe_sanitise_options( array() );
if ( ! $current_agent ) {
	dbe_release_test_assert(
		! empty( $sanitised['abilities_enabled'] ),
		'Saving an earlier release discarded the staged Agent abilities preference.'
	);
}
if ( ! $current_style ) {
	dbe_release_test_assert(
		! empty( $sanitised['style_inspector'] ),
		'Saving an earlier release discarded the staged Style inspector preference.'
	);
}

if ( $failures ) {
	foreach ( $failures as $failure ) {
		fwrite( STDERR, $failure . "\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite -- CLI test failure output.
	}
	exit( 1 );
}

echo 'Release availability checks passed for ' . DBE_VERSION . ".\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Trusted CLI test output.
