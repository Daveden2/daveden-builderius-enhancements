<?php
/**
 * Server-side builder presence.
 *
 * The presence_heartbeat feature's localStorage beat only reaches other tabs
 * in the SAME browser. Agent abilities (dbe/apply-subtree-html and friends)
 * run server-side and cannot see it, yet they need to know when a builder
 * tab has the target template open with unsaved changes: closing or saving
 * such a tab autosaves its whole stale snapshot, overwriting any commit the
 * ability just made (the dirty-tab clobber).
 *
 * So builder.js also posts a lightweight beat here (on dirty-state change,
 * plus a slow keep-alive), stored as a short-lived transient per template.
 * dbe_presence_dirty() lets the abilities warn in their result when a fresh
 * dirty beat exists for the template they are about to commit to.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

/**
 * Beat lifetime in seconds. Twice the keep-alive interval, so one missed
 * beat does not read as "tab closed" but a genuinely closed tab expires
 * quickly.
 *
 * @return int
 */
function dbe_presence_ttl() {
	return 60;
}

/**
 * The transient key for a template's presence record.
 *
 * @param string $slug The template slug.
 * @return string
 */
function dbe_presence_key( $slug ) {
	return 'dbe_presence_' . md5( $slug );
}

add_action( 'rest_api_init', 'dbe_presence_register_route' );

/**
 * POST dbe/v1/presence { entity: <template slug>, dirty: <bool> }.
 */
function dbe_presence_register_route() {
	register_rest_route(
		'dbe/v1',
		'/presence',
		array(
			'methods'             => 'POST',
			'permission_callback' => function () {
				return current_user_can( 'builderius-development' );
			},
			'args'                => array(
				'entity' => array(
					'type'              => 'string',
					'required'          => true,
					'validate_callback' => function ( $value ) {
						return is_string( $value ) && preg_match( '/^[A-Za-z0-9_-]{1,100}$/', $value );
					},
				),
				'dirty'  => array(
					'type'     => 'boolean',
					'required' => true,
				),
			),
			'callback'            => 'dbe_presence_beat',
		)
	);
}

/**
 * Store a beat. Last writer wins: the warning only needs "someone has a
 * dirty tab", not a full session roster.
 *
 * @param WP_REST_Request $request The request.
 * @return array
 */
function dbe_presence_beat( $request ) {
	$user = wp_get_current_user();
	set_transient(
		dbe_presence_key( (string) $request['entity'] ),
		array(
			'user'  => $user ? $user->user_login : '',
			'dirty' => (bool) $request['dirty'],
			'time'  => time(),
		),
		dbe_presence_ttl()
	);
	return array( 'ok' => true );
}

/**
 * A fresh dirty-tab record for a template, or null.
 *
 * @param string $slug The template slug.
 * @return array|null { user, dirty, time } when a fresh dirty beat exists.
 */
function dbe_presence_dirty( $slug ) {
	$record = get_transient( dbe_presence_key( $slug ) );
	if ( ! is_array( $record ) || empty( $record['dirty'] ) ) {
		return null;
	}
	if ( ( time() - (int) ( $record['time'] ?? 0 ) ) > dbe_presence_ttl() ) {
		return null;
	}
	return $record;
}

/**
 * The warning string the abilities attach when a dirty tab is present, or
 * '' when the coast is clear.
 *
 * @param string $slug The template slug.
 * @return string
 */
function dbe_presence_warning( $slug ) {
	$record = dbe_presence_dirty( $slug );
	if ( ! $record ) {
		return '';
	}
	return sprintf(
		'A builder tab has "%s" open with UNSAVED changes (user %s, seen %ds ago). Saving or closing that tab will overwrite this commit with the tab\'s stale snapshot — that tab must save or discard first, then reload, before further builder edits.',
		$slug,
		$record['user'],
		max( 0, time() - (int) $record['time'] )
	);
}
