<?php
/**
 * Named-block CSS guard.
 *
 * The dbe/patch-global-css and dbe/patch-entity-css abilities fence their
 * additions as named-block regions (an "@block: name" comment through the
 * next "@endblock" comment), committed server-side. The open builder's
 * editor store never contains those regions, so the next builder save (of
 * ANY template, or a global data variable change) rewrites the stylesheet
 * from the stale store and the blocks silently vanish: verified repeatedly
 * in the field.
 *
 * This guard hooks the moment Builderius persists a commit's config
 * (`content_config` post meta on a `builderius_commit`) and merges back any
 * fenced block that the branch's previous head commit carried but the
 * incoming config lost. It runs BEFORE Builderius' own commit-created
 * listener regenerates the compiled global.css, so the re-injected blocks
 * reach the stylesheet file too. Deliberate block deletions are unaffected:
 * the abilities suspend the guard for their own writes.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

/**
 * Suspend flag, so DBE's own ability-driven commits (including an explicit
 * block delete) are never "repaired" back to the previous state.
 *
 * @param bool|null $set New state, or null to just read.
 * @return bool Whether the guard is currently suspended.
 */
function dbe_css_guard_suspended( $set = null ) {
	static $suspended = false;
	if ( null !== $set ) {
		$suspended = (bool) $set;
	}
	return $suspended;
}

/**
 * Extract the fenced named-block regions from a stylesheet.
 *
 * @param string $css The stylesheet.
 * @return array<string,string>|WP_Error Full region text keyed by block name.
 */
function dbe_css_guard_regions( $css ) {
	$regions = array();
	$blocks  = dbe_css_blocks_parse( $css );
	if ( is_wp_error( $blocks ) ) {
		return $blocks;
	}
	foreach ( $blocks as $block ) {
		$regions[ $block['name'] ] = substr( $css, $block['start'], $block['end'] - $block['start'] );
	}
	return $regions;
}

/**
 * Resolve the active commit that a new commit supersedes.
 *
 * @param WP_Post $branch     Builderius branch post.
 * @param int     $new_commit New commit post ID to exclude.
 * @return WP_Post|null
 */
function dbe_css_guard_previous_commit( $branch, $new_commit ) {
	$map  = json_decode( (string) get_post_meta( $branch->ID, 'active_commit', true ), true );
	$map  = is_array( $map ) ? $map : array();
	$name = (string) ( $map[ get_current_user_id() ] ?? ( $map ? reset( $map ) : '' ) );
	if ( '' !== $name ) {
		$found = get_posts(
			array(
				'post_type'   => 'builderius_commit',
				'post_parent' => $branch->ID,
				'name'        => $name,
				'post_status' => get_post_stati(),
				'numberposts' => 1,
				'exclude'     => array( $new_commit ),
			)
		);
		if ( $found ) {
			return $found[0];
		}
	}
	$found = get_posts(
		array(
			'post_type'   => 'builderius_commit',
			'post_parent' => $branch->ID,
			'post_status' => get_post_stati(),
			'numberposts' => 1,
			'exclude'     => array( $new_commit ),
			'orderby'     => 'ID',
			'order'       => 'DESC',
		)
	);
	return $found ? $found[0] : null;
}

/**
 * Read a commit's template-level `css` setting.
 *
 * @param int $commit_id The builderius_commit post ID.
 * @return string The stylesheet, '' when absent.
 */
function dbe_css_guard_read_css( $commit_id ) {
	$config = json_decode( (string) get_post_meta( $commit_id, 'content_config', true ), true );
	if ( ! is_array( $config ) ) {
		return '';
	}
	foreach ( (array) ( $config['template']['settings'] ?? array() ) as $s ) {
		if ( 'css' === ( $s['name'] ?? '' ) ) {
			return (string) ( $s['value'] ?? '' );
		}
	}
	return '';
}

add_action( 'added_post_meta', 'dbe_css_guard_on_commit_meta', 10, 3 );

/**
 * Merge lost named blocks back into a just-persisted commit config.
 *
 * Fires on the `content_config` meta write Builderius performs right after
 * inserting a commit post: after validation, before the commit-created
 * event that compiles CSS assets. Applies to every branch (global settings
 * set, templates, components), so both global and entity blocks survive.
 *
 * @param int    $meta_id  Meta row ID (unused).
 * @param int    $post_id  The commit post ID.
 * @param string $meta_key The meta key written.
 */
function dbe_css_guard_on_commit_meta( $meta_id, $post_id, $meta_key ) {
	if ( 'content_config' !== $meta_key || dbe_css_guard_suspended() || ! dbe_enabled( 'css_block_guard' ) ) {
		return;
	}
	$post = get_post( $post_id );
	if ( ! $post || 'builderius_commit' !== $post->post_type || ! $post->post_parent ) {
		return;
	}
	$branch = get_post( $post->post_parent );
	if ( ! $branch || 'builderius_branch' !== $branch->post_type ) {
		return;
	}

	// Resolve the active branch head this commit supersedes. Numeric commit ID
	// order is only a fallback for legacy branches without an active pointer.
	$prev = dbe_css_guard_previous_commit( $branch, $post_id );
	if ( ! $prev ) {
		return;
	}
	$prev_regions = dbe_css_guard_regions( dbe_css_guard_read_css( $prev->ID ) );
	if ( is_wp_error( $prev_regions ) ) {
		// The guard cannot preserve regions it cannot parse, but switching
		// off silently would hide that fenced blocks are now unprotected.
		error_log( 'DBE css_block_guard disabled for commit ' . $post_id . ': ' . $prev_regions->get_error_message() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		return;
	}
	if ( ! $prev_regions ) {
		return;
	}

	$config = json_decode( (string) get_post_meta( $post_id, 'content_config', true ), true );
	if ( ! is_array( $config ) || ! isset( $config['template'] ) || ! is_array( $config['template'] ) ) {
		return;
	}

	$css       = '';
	$css_index = -1;
	$settings  = (array) ( $config['template']['settings'] ?? array() );
	foreach ( $settings as $i => $s ) {
		if ( 'css' === ( $s['name'] ?? '' ) ) {
			$css       = (string) ( $s['value'] ?? '' );
			$css_index = (int) $i;
			break;
		}
	}

	$current_regions = dbe_css_guard_regions( $css );
	if ( is_wp_error( $current_regions ) ) {
		error_log( 'DBE css_block_guard disabled for commit ' . $post_id . ': ' . $current_regions->get_error_message() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		return;
	}
	$missing = array_diff_key( $prev_regions, $current_regions );
	if ( ! $missing ) {
		return;
	}

	$css = rtrim( $css );
	foreach ( $missing as $region ) {
		$css .= ( '' === $css ? '' : "\n\n" ) . $region;
	}
	$css .= "\n";

	if ( $css_index >= 0 ) {
		$settings[ $css_index ]['value'] = $css;
	} else {
		$settings[] = array(
			'name'  => 'css',
			'value' => $css,
		);
	}
	$config['template']['settings'] = $settings;

	$json = wp_json_encode( $config, JSON_UNESCAPED_UNICODE );
	if ( false === $json ) {
		return;
	}
	update_post_meta( $post_id, 'content_config', wp_slash( $json ) );
}
