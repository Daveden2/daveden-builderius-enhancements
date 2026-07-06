<?php
/**
 * Per-scope CSS provider for the scope guard.
 *
 * The builder's Styles code editor shows a selector's existing rules no
 * matter which scope (Global/Template) is active — the scope only routes
 * where edits are SAVED. To warn when the shown rules live in the OTHER
 * scope, the builder JS needs to know which scope owns which selectors.
 * That is not readable from the page (the store keys are unnamed closures),
 * but it IS readable here: Builderius persists each entity's state in a
 * `builderius_dsm` post whose JSON config carries the raw stylesheet under
 * the `css` key. post_name is the entity slug; the global stylesheet lives
 * under the slug `global-settings`. The newest row per slug matches what the
 * builder loads (verified against the live editor on 1.3.5-beta).
 *
 * The payload reflects the last SAVED state — in-session drafts index after
 * the next save (the JS re-fetches through the REST route below).
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

/**
 * The newest saved CSS blob for a DSM entity slug.
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
	if ( ! $id ) {
		return null;
	}
	$config = json_decode( get_post_field( 'post_content', (int) $id ), true );
	if ( is_array( $config ) && isset( $config['css'] ) && is_string( $config['css'] ) ) {
		return $config['css'];
	}
	return null;
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
			'template' => dbe_dsm_css( $slug ),
			'global'   => dbe_dsm_css( 'global-settings' ),
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
					'template' => dbe_dsm_css( (string) $request->get_param( 'template' ) ),
					'global'   => dbe_dsm_css( 'global-settings' ),
				);
			},
		)
	);
}
add_action( 'rest_api_init', 'dbe_register_scope_css_route' );
