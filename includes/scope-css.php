<?php
/**
 * Per-scope CSS provider for the scope guard.
 *
 * The builder's Styles code editor shows a selector's existing rules no
 * matter which scope (Global/Template) is active — the scope only routes
 * where edits are SAVED. To warn when the shown rules live in the OTHER
 * scope, the builder JS needs to know which scope owns which selectors.
 * That is not readable from the page (the store keys are unnamed closures),
 * but it IS readable here from Builderius' persistence layer.
 *
 * Storage model (verified on 1.3.5-beta, 7 Jul 2026): every entity's saved
 * state lives in the branch/commit chain — entity post (`builderius_template`
 * / `builderius_component` / `builderius_sett_set`) → `builderius_branch`
 * (post_parent = entity) → `builderius_commit` rows (post_parent = branch),
 * each commit's post_content being the JSON config with the raw stylesheet
 * under the `css` key. The branch's `active_commit` meta (an array keyed by
 * blog ID → commit hash = commit post_name) names the checked-out commit.
 * The GLOBAL stylesheet's entity is the `builderius_sett_set` post.
 *
 * `builderius_dsm` posts are only point-in-time snapshots (they froze here on
 * 21 Jun 2026 — reading them fed the guard weeks-stale CSS, so classes saved
 * since then resolved to "no scope owns this" and the warning never fired).
 * They are kept only as a fallback for installs without branch/commit rows.
 *
 * The payload reflects the last SAVED state — in-session drafts index after
 * the next save (the JS re-fetches through the REST route below).
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

/**
 * The `css` blob from a Builderius JSON config post.
 *
 * @param int $post_id Post whose post_content is an entity JSON config.
 * @return string|null Raw CSS, or null when the key can't be resolved.
 */
function dbe_config_post_css( $post_id ) {
	if ( ! $post_id ) {
		return null;
	}
	$config = json_decode( get_post_field( 'post_content', (int) $post_id ), true );
	if ( is_array( $config ) && isset( $config['css'] ) && is_string( $config['css'] ) ) {
		return $config['css'];
	}
	return null;
}

/**
 * The newest saved CSS blob for a DSM entity slug (legacy snapshot storage —
 * fallback only; see the file header).
 *
 * @param string $slug DSM post_name ('home', 'global-settings', …).
 * @return string|null Raw CSS, or null when the entity/key can't be resolved.
 */
function dbe_dsm_css( $slug ) {
	global $wpdb;
	if ( '' === $slug ) {
		return null;
	}
	$id = $wpdb->get_var(
		$wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'builderius_dsm' AND post_name = %s ORDER BY ID DESC LIMIT 1",
			$slug
		)
	);
	return $id ? dbe_config_post_css( (int) $id ) : null;
}

/**
 * The current saved CSS for a Builderius entity, from its branch/commit
 * chain: newest branch under the entity, the branch's `active_commit` meta
 * (blog ID → commit hash) naming the checked-out commit, that commit's
 * config `css`. Falls back to the branch's newest commit when the meta is
 * missing or doesn't resolve.
 *
 * @param int $entity_id builderius_template / builderius_sett_set /
 *                       builderius_component post ID.
 * @return string|null Raw CSS, or null when no commit resolves.
 */
function dbe_branch_commit_css( $entity_id ) {
	global $wpdb;
	if ( ! $entity_id ) {
		return null;
	}
	$branch_id = $wpdb->get_var(
		$wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'builderius_branch' AND post_parent = %d ORDER BY ID DESC LIMIT 1",
			$entity_id
		)
	);
	if ( ! $branch_id ) {
		return null;
	}
	$commit_id = null;
	$active    = get_post_meta( (int) $branch_id, 'active_commit', true );
	if ( is_string( $active ) && '' !== $active ) {
		$active = json_decode( $active, true );
	}
	if ( is_array( $active ) ) {
		$hash = isset( $active[ get_current_blog_id() ] ) ? $active[ get_current_blog_id() ] : reset( $active );
		if ( is_string( $hash ) && '' !== $hash ) {
			$commit_id = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'builderius_commit' AND post_parent = %d AND post_name = %s ORDER BY ID DESC LIMIT 1",
					$branch_id,
					$hash
				)
			);
		}
	}
	if ( ! $commit_id ) {
		$commit_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'builderius_commit' AND post_parent = %d ORDER BY ID DESC LIMIT 1",
				$branch_id
			)
		);
	}
	return $commit_id ? dbe_config_post_css( (int) $commit_id ) : null;
}

/**
 * The current saved CSS for the template scope.
 *
 * @param string $slug Template post_name ('home', …).
 * @return string|null
 */
function dbe_template_scope_css( $slug ) {
	global $wpdb;
	if ( '' === $slug ) {
		return null;
	}
	$entity_id = $wpdb->get_var(
		$wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'builderius_template' AND post_name = %s ORDER BY ID DESC LIMIT 1",
			$slug
		)
	);
	$css = dbe_branch_commit_css( (int) $entity_id );
	return null !== $css ? $css : dbe_dsm_css( $slug );
}

/**
 * The current saved CSS for the global scope. Its entity is the
 * `builderius_sett_set` post (the settings set — post_name 'html' on
 * current builds; older snapshots used the DSM slug 'global-settings').
 *
 * @return string|null
 */
function dbe_global_scope_css() {
	global $wpdb;
	$entity_id = $wpdb->get_var(
		"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'builderius_sett_set' ORDER BY ID DESC LIMIT 1"
	);
	$css = dbe_branch_commit_css( (int) $entity_id );
	if ( null !== $css ) {
		return $css;
	}
	$slug = $entity_id ? get_post_field( 'post_name', (int) $entity_id ) : '';
	$css  = dbe_dsm_css( (string) $slug );
	return null !== $css ? $css : dbe_dsm_css( 'global-settings' );
}

/**
 * Slug of the template being edited in this builder-mode request: the
 * explicit ?builderius_template param when present, else the applied
 * template Builderius resolved for the visited URL (same runtime-cache
 * channel the admin-bar link uses).
 *
 * @return string Empty when unresolved (the guard fails soft).
 */
function dbe_current_template_slug() {
	if ( isset( $_GET['builderius_template'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return sanitize_title( wp_unslash( $_GET['builderius_template'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}
	$runtime_cache = dbe_builderius_runtime_cache();
	$template_post = $runtime_cache ? $runtime_cache->get( 'builderius_template_post' ) : false;
	if ( $template_post instanceof WP_Post ) {
		return $template_post->post_name;
	}
	return '';
}

/**
 * The config payload the builder JS consumes.
 *
 * @return array{mode:string,templateSlug:string,css:array{template:?string,global:?string},restUrl:string,restNonce:string}
 */
function dbe_scope_guard_config() {
	$slug = dbe_current_template_slug();
	return array(
		'mode'         => dbe_setting( 'scope_guard_mode' ),
		'templateSlug' => $slug,
		'css'          => array(
			'template' => dbe_template_scope_css( $slug ),
			'global'   => dbe_global_scope_css(),
		),
		'restUrl'      => rest_url( 'dbe/v1/scope-css' ),
		'restNonce'    => wp_create_nonce( 'wp_rest' ),
	);
}

/**
 * Refresh route: the builder JS re-fetches both scopes after a Save so the
 * provenance index tracks newly saved rules.
 */
function dbe_register_scope_css_route() {
	register_rest_route(
		'dbe/v1',
		'/scope-css',
		array(
			'methods'             => 'GET',
			'permission_callback' => function () {
				return current_user_can( 'edit_posts' );
			},
			'args'                => array(
				'template' => array(
					'type'              => 'string',
					'required'          => false,
					'sanitize_callback' => 'sanitize_title',
				),
			),
			'callback'            => function ( $request ) {
				return array(
					'template' => dbe_template_scope_css( (string) $request->get_param( 'template' ) ),
					'global'   => dbe_global_scope_css(),
				);
			},
		)
	);
}
add_action( 'rest_api_init', 'dbe_register_scope_css_route' );
