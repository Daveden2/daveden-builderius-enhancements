<?php
/**
 * Focused security and data-integrity regression checks.
 *
 * Run through WordPress so the plugin and Builderius data types are loaded:
 * wp --path=/path/to/wordpress eval-file tests/security-regressions.php
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WP_CLI' ) ) {
	return;
}

$dbe_test_failures = array();

/**
 * Record one failed assertion without stopping later checks.
 *
 * @param bool   $condition Whether the assertion passed.
 * @param string $message   Failure detail.
 */
function dbe_test_assert( $condition, $message ) {
	global $dbe_test_failures;
	if ( ! $condition ) {
		$dbe_test_failures[] = $message;
		WP_CLI::warning( $message );
	}
}

$admins = get_users(
	array(
		'role'   => 'administrator',
		'number' => 1,
		'fields' => 'ID',
	)
);
if ( $admins ) {
	wp_set_current_user( (int) $admins[0] );
}

dbe_test_assert( function_exists( 'dbe_ability_parse_fragment' ), 'The subtree ability parser is not loaded.' );
dbe_test_assert( function_exists( 'dbe_css_blocks_parse' ), 'The shared CSS block parser is not loaded.' );
dbe_test_assert( function_exists( 'dbe_presence_beat' ), 'The presence service is not loaded.' );

if ( function_exists( 'dbe_ability_parse_fragment' ) ) {
	$type_mismatch = dbe_ability_parse_fragment(
		'<div data-dbe-id="component-1"></div>',
		array( 'component-1' => 'Component' )
	);
	dbe_test_assert(
		! is_wp_error( $type_mismatch ) && ! empty( $type_mismatch['invalid_markers'] ),
		'A Component marker was accepted on an HtmlElement.'
	);

	$unknown_component = dbe_ability_parse_fragment(
		'<dbe-component name="missing-component" data-dbe-id="component-1"></dbe-component>',
		array( 'component-1' => 'Component' )
	);
	dbe_test_assert(
		! is_wp_error( $unknown_component ) && ! empty( $unknown_component['invalid_markers'] ),
		'An unknown component slug could remove a marked Component.'
	);

	$invalid_keep = dbe_ability_parse_fragment(
		'<dbe-keep data-dbe-id="element-1"></dbe-keep>',
		array( 'element-1' => 'HtmlElement' )
	);
	dbe_test_assert(
		! is_wp_error( $invalid_keep ) && ! empty( $invalid_keep['invalid_markers'] ),
		'A dbe-keep placeholder was accepted for an editable HtmlElement.'
	);

	$url_source_collection = dbe_ability_parse_fragment(
		'<ul data-source-url="https://example.test/items.json"><template><li>{{title}}</li></template></ul>',
		array()
	);
	dbe_test_assert(
		! is_wp_error( $url_source_collection ) && 'Collection' === ( $url_source_collection['roots'][0]['module'] ?? '' ),
		'A data-source-url element was not parsed as a Collection.'
	);

	$interactive_url_source_collection = dbe_ability_parse_fragment(
		'<ul data-b-context="https://example.test/items.json" data-b-interactive="items" data-b-bind--data-content="items"><template><li>{{title}}</li></template></ul>',
		array()
	);
	$interactive_settings              = ! is_wp_error( $interactive_url_source_collection )
		? dbe_ability_node_settings( $interactive_url_source_collection['roots'][0], 'Collection' )
		: array();
	dbe_test_assert(
		in_array(
			array(
				'name'  => 'interactiveMode',
				'value' => true,
			),
			$interactive_settings,
			true
		),
		'An interactive Collection source did not enable the Builderius interactiveMode setting.'
	);

	$limits    = dbe_ability_html_limits();
	$oversized = dbe_ability_parse_fragment( str_repeat( 'x', $limits['bytes'] + 1 ), array() );
	dbe_test_assert(
		is_wp_error( $oversized ) && 'dbe_html_too_large' === $oversized->get_error_code(),
		'Oversized HTML was not rejected before parsing.'
	);

	$deep_html = str_repeat( '<div>', $limits['depth'] + 1 ) . str_repeat( '</div>', $limits['depth'] + 1 );
	$too_deep  = dbe_ability_parse_fragment( $deep_html, array() );
	dbe_test_assert(
		is_wp_error( $too_deep ) && 'dbe_html_too_deep' === $too_deep->get_error_code(),
		'Over-nested HTML was not rejected.'
	);

	$original_libxml_state = libxml_use_internal_errors( false );
	dbe_ability_parse_fragment( '<div>ok</div>', array() );
	dbe_test_assert( false === libxml_use_internal_errors(), 'The HTML parser did not restore libxml error handling.' );
	libxml_use_internal_errors( $original_libxml_state );
}

if ( function_exists( 'dbe_ability_binding_warnings' ) ) {
	$square_bracket_collection = array(
		'module'   => 'Collection',
		'tag'      => 'ul',
		'attrs'    => array(
			array(
				'name'  => 'data-b-context',
				'value' => '[[[wp.posts]]]',
			),
		),
		'children' => array(
			array(
				'module'   => 'Template',
				'tag'      => 'template',
				'attrs'    => array(),
				'children' => array(),
				'content'  => '',
			),
		),
		'content'  => '',
	);
	dbe_test_assert(
		array() === dbe_ability_binding_warnings( $square_bracket_collection ),
		'A triple-square Collection binding was reported as invalid.'
	);

	$double_square_collection                      = $square_bracket_collection;
	$double_square_collection['attrs'][0]['value'] = '[[wp.posts]]';
	dbe_test_assert(
		array() === dbe_ability_binding_warnings( $double_square_collection ),
		'A double-square Collection binding was reported as invalid.'
	);

	$url_context_collection                      = $square_bracket_collection;
	$url_context_collection['attrs'][0]['value'] = 'https://dbe-playground.test/wp-json/dbe-test/v1/items';
	dbe_test_assert(
		array() === dbe_ability_binding_warnings( $url_context_collection ),
		'A URL-like Collection data-b-context source was reported as invalid.'
	);

	$url_attr_collection          = $square_bracket_collection;
	$url_attr_collection['attrs'] = array(
		array(
			'name'  => 'data-source-url',
			'value' => 'https://dbe-playground.test/wp-json/dbe-test/v1/items',
		),
	);
	dbe_test_assert(
		array() !== dbe_ability_binding_warnings( $url_attr_collection ),
		'A bare Collection data-source-url source was accepted without interactive wiring.'
	);

	$interactive_url_collection          = $square_bracket_collection;
	$interactive_url_collection['attrs'] = array(
		array(
			'name'  => 'data-b-context',
			'value' => 'https://dbe-playground.test/wp-json/dbe-test/v1/items',
		),
		array(
			'name'  => 'data-b-interactive',
			'value' => 'dbe_url_source',
		),
		array(
			'name'  => 'data-b-bind--data-content',
			'value' => 'dbe_url_source',
		),
	);
	dbe_test_assert(
		array() === dbe_ability_binding_warnings( $interactive_url_collection ),
		'An interactive URL Collection source was reported as invalid.'
	);

	$bad_url_collection                      = $url_attr_collection;
	$bad_url_collection['attrs'][0]['value'] = 'javascript:alert(1)';
	dbe_test_assert(
		array() !== dbe_ability_binding_warnings( $bad_url_collection ),
		'A dangerous Collection data-source-url was accepted.'
	);
}

if ( function_exists( 'dbe_css_blocks_parse' ) ) {
	$valid_css = "/* @block: test */\n.example {}\n/* @endblock */\n";
	dbe_test_assert( 1 === count( dbe_css_blocks_parse( $valid_css ) ), 'A valid named CSS block did not parse.' );

	$invalid_css = array(
		'duplicate'    => $valid_css . $valid_css,
		'nested'       => "/* @block: outer */\n/* @block: inner */\n/* @endblock */\n/* @endblock */",
		'orphan end'   => '/* @endblock */',
		'unterminated' => '/* @block: open */ .example {}',
		'malformed'    => '/* @block test */ .example {}',
	);
	foreach ( $invalid_css as $case => $css ) {
		dbe_test_assert( is_wp_error( dbe_css_blocks_parse( $css ) ), 'CSS parser accepted ' . $case . ' markers.' );
	}
	dbe_test_assert(
		dbe_css_block_body_has_marker( '.a {} /* @endblock */ .escaped {}' ),
		'A submitted CSS body could escape its managed block.'
	);
}

if ( function_exists( 'dbe_ability_preflight' ) ) {
	$loaded = array( 'commit' => (object) array( 'post_name' => 'base-commit' ) );
	dbe_test_assert(
		'dbe_expected_commit_required' === dbe_ability_preflight( $loaded, array(), '' )->get_error_code(),
		'A mutation did not require expected_commit.'
	);
	dbe_test_assert(
		'dbe_commit_conflict' === dbe_ability_preflight( $loaded, array( 'expected_commit' => 'stale-commit' ), '' )->get_error_code(),
		'A stale expected_commit was accepted.'
	);
	dbe_test_assert(
		true === dbe_ability_preflight( $loaded, array( 'expected_commit' => 'base-commit' ), '' ),
		'The current expected_commit was rejected.'
	);
}

if ( function_exists( 'dbe_presence_beat' ) ) {
	$slug          = 'dbe-security-regression-' . wp_generate_password( 12, false, false );
	$presence_tabs = array(
		'11111111111111111111111111111111',
		'22222222222222222222222222222222',
	);
	try {
		foreach ( $presence_tabs as $presence_tab ) {
			$request = new WP_REST_Request( 'POST' );
			$request->set_param( 'entity', $slug );
			$request->set_param( 'tab', $presence_tab );
			$request->set_param( 'dirty', true );
			dbe_presence_beat( $request );
		}
		dbe_test_assert( 2 === count( dbe_presence_dirty( $slug ) ), 'Two dirty tabs were not tracked independently.' );

		$clean = new WP_REST_Request( 'POST' );
		$clean->set_param( 'entity', $slug );
		$clean->set_param( 'tab', $presence_tabs[0] );
		$clean->set_param( 'dirty', false );
		dbe_presence_beat( $clean );
		dbe_test_assert( 1 === count( dbe_presence_dirty( $slug ) ), 'A clean tab cleared another tab’s dirty state.' );
		dbe_test_assert( is_wp_error( dbe_presence_precondition( $slug ) ), 'A dirty tab did not block a mutation.' );
		dbe_test_assert( true === dbe_presence_precondition( $slug, true ), 'An explicit presence override was rejected.' );
	} finally {
		delete_transient( dbe_presence_key( $slug ) );
	}
}

if ( function_exists( 'dbe_ability_render_token_user' ) ) {
	// The loopback render token: garbage, oversized and consumed tokens must
	// never authenticate, a valid token must authenticate exactly once, and
	// an already-authenticated request must be left untouched.
	$dbe_prev_header = isset( $_SERVER['HTTP_X_DBE_RENDER_TOKEN'] )
		? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_DBE_RENDER_TOKEN'] ) )
		: null;
	try {
		$_SERVER['HTTP_X_DBE_RENDER_TOKEN'] = 'not-a-real-token';
		dbe_test_assert( false === dbe_ability_render_token_user( false ), 'A garbage render token authenticated.' );

		$_SERVER['HTTP_X_DBE_RENDER_TOKEN'] = str_repeat( 'a', 200 );
		dbe_test_assert( false === dbe_ability_render_token_user( false ), 'An oversized render token was not rejected outright.' );

		$dbe_token = wp_generate_password( 64, false, false );
		set_transient( 'dbe_render_token_' . hash( 'sha256', $dbe_token ), array( 'user' => (int) $admins[0] ), 60 );
		$_SERVER['HTTP_X_DBE_RENDER_TOKEN'] = $dbe_token;
		dbe_test_assert( dbe_ability_render_token_user( false ) === (int) $admins[0], 'A valid render token did not authenticate its minting user.' );
		dbe_test_assert( false === dbe_ability_render_token_user( false ), 'A render token authenticated twice — it must be single use.' );

		set_transient( 'dbe_render_token_' . hash( 'sha256', $dbe_token ), array( 'user' => (int) $admins[0] ), 60 );
		dbe_test_assert( 42 === dbe_ability_render_token_user( 42 ), 'A render token overrode an already-authenticated user.' );
		delete_transient( 'dbe_render_token_' . hash( 'sha256', $dbe_token ) );
	} finally {
		if ( null === $dbe_prev_header ) {
			unset( $_SERVER['HTTP_X_DBE_RENDER_TOKEN'] );
		} else {
			$_SERVER['HTTP_X_DBE_RENDER_TOKEN'] = $dbe_prev_header;
		}
	}
}

if ( function_exists( 'dbe_ability_render_url' ) ) {
	// The loopback fetcher must refuse foreign hosts — it carries an
	// authentication token, so it must never become an SSRF proxy.
	dbe_test_assert(
		'dbe_foreign_host' === dbe_ability_render_url( array( 'url' => 'https://example.com/' ) )->get_error_code(),
		'The render fetcher accepted a foreign host.'
	);
	dbe_test_assert(
		! is_wp_error( dbe_ability_render_url( array( 'url' => home_url( '/' ) ) ) ),
		'The render fetcher rejected its own site.'
	);
}

if ( $dbe_test_failures ) {
	WP_CLI::error( sprintf( '%d security regression check(s) failed.', count( $dbe_test_failures ) ) );
}

WP_CLI::success( 'Security regression checks passed.' );
