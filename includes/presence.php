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
 * plus a slow keep-alive), stored as short-lived per-tab records per template.
 * Mutation abilities check those records before writing and fail closed when
 * any fresh tab has unsaved work.
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

/**
 * Whether a presence slug identifies a real Builderius entity.
 *
 * @param string $slug Template or component slug.
 * @return bool Whether the entity exists.
 */
function dbe_presence_entity_exists( $slug ) {
	$posts = get_posts(
		array(
			'name'           => $slug,
			'post_type'      => array( 'builderius_template', 'builderius_component' ),
			'post_status'    => 'any',
			'posts_per_page' => 1,
			'fields'         => 'ids',
			'no_found_rows'  => true,
		)
	);
	return ! empty( $posts );
}

/**
 * Maximum simultaneously dirty tabs retained for one entity.
 *
 * @return int Record ceiling.
 */
function dbe_presence_record_limit() {
	return 20;
}

add_action( 'rest_api_init', 'dbe_presence_register_route' );

/**
 * POST dbe/v1/presence { entity: <template slug>, tab: <id>, dirty: <bool> }.
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
				'tab'    => array(
					'type'              => 'string',
					'required'          => true,
					'validate_callback' => function ( $value ) {
						return is_string( $value ) && preg_match( '/^[A-Za-z0-9_-]{16,100}$/', $value );
					},
				),
			),
			'callback'            => 'dbe_presence_beat',
		)
	);
}

/**
 * Store or clear one tab's beat without masking other dirty tabs.
 *
 * @param WP_REST_Request $request The request.
 * @return array
 */
function dbe_presence_beat( $request ) {
	$user   = wp_get_current_user();
	$entity = (string) $request['entity'];
	if ( ! dbe_presence_entity_exists( $entity ) ) {
		return new WP_Error( 'dbe_unknown_entity', 'Presence can only be recorded for an existing Builderius template or component.', array( 'status' => 404 ) );
	}
	$key     = dbe_presence_key( $entity );
	$tab     = (string) $request['tab'];
	$records = dbe_presence_records( $entity );
	if ( (bool) $request['dirty'] ) {
		if ( ! isset( $records[ $tab ] ) && count( $records ) >= dbe_presence_record_limit() ) {
			return new WP_Error( 'dbe_presence_limit', 'Too many dirty builder tabs are already recorded for this entity.', array( 'status' => 429 ) );
		}
		if ( isset( $records[ $tab ] ) && (int) ( $records[ $tab ]['user_id'] ?? 0 ) !== (int) $user->ID ) {
			return new WP_Error( 'dbe_presence_tab_conflict', 'That builder-tab identifier belongs to another user.', array( 'status' => 409 ) );
		}
		$records[ $tab ] = array(
			'user_id' => (int) $user->ID,
			'user'    => $user->user_login,
			'tab'     => $tab,
			'time'    => time(),
		);
	} elseif ( isset( $records[ $tab ] ) && (int) ( $records[ $tab ]['user_id'] ?? 0 ) === (int) $user->ID ) {
		unset( $records[ $tab ] );
	}
	if ( $records ) {
		set_transient( $key, $records, dbe_presence_ttl() );
	} else {
		delete_transient( $key );
	}
	return array( 'ok' => true );
}

/**
 * Fresh dirty-tab records for a template, keyed by tab ID.
 *
 * @param string $slug The template slug.
 * @return array<string,array{user_id:int,user:string,tab:string,time:int}>
 */
function dbe_presence_records( $slug ) {
	$records = get_transient( dbe_presence_key( $slug ) );
	if ( ! is_array( $records ) ) {
		return array();
	}
	$cutoff = time() - dbe_presence_ttl();
	foreach ( $records as $tab => $record ) {
		if ( ! is_array( $record ) || (int) ( $record['time'] ?? 0 ) < $cutoff ) {
			unset( $records[ $tab ] );
		}
	}
	return $records;
}

/**
 * Fresh dirty-tab records for a template.
 *
 * @param string $slug The template slug.
 * @return array<string,array{user_id:int,user:string,tab:string,time:int}>
 */
function dbe_presence_dirty( $slug ) {
	return dbe_presence_records( $slug );
}

/**
 * The warning string the abilities attach when a dirty tab is present, or
 * '' when the coast is clear.
 *
 * @param string $slug The template slug.
 * @return string
 */
function dbe_presence_warning( $slug ) {
	$records = dbe_presence_dirty( $slug );
	if ( ! $records ) {
		return '';
	}
	return __(
		'This template has unsaved changes in another Builderius tab. Saving this agent edit now could overwrite that work. Save or discard the tab’s changes, reload it, then try again.',
		'daveden-builderius-enhancements'
	);
}

/**
 * Fail a mutation while a dirty builder tab exists unless explicitly forced.
 *
 * @param string $slug  Template slug.
 * @param bool   $force Whether the authorised caller explicitly overrides.
 * @return true|WP_Error
 */
function dbe_presence_precondition( $slug, $force = false ) {
	if ( $force || ! dbe_presence_dirty( $slug ) ) {
		return true;
	}
	return new WP_Error(
		'dbe_builder_tab_conflict',
		dbe_presence_warning( $slug ),
		array(
			'template'  => $slug,
			'tab_count' => count( dbe_presence_dirty( $slug ) ),
		)
	);
}
