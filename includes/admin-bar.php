<?php
/**
 * Admin bar: "Edit template" link + second-builder-tab warning.
 *
 * 1. Adds an item to the Builderius admin-bar menu on the logged-in front end
 *    (alongside the native dev/live preview switch): a direct link that opens
 *    the Builderius template applied to the current page in the builder,
 *    labelled with the template's name.
 * 2. Before following that link, warns if the builder already appears to be
 *    open in another tab (two builder tabs can overwrite each other's
 *    changes). Detection: the builder page writes a heartbeat into
 *    localStorage (see builder.js); the front-end click handler treats a beat
 *    fresher than the configured staleness window as "open" and asks for
 *    confirmation. Same-origin only — exactly the case that matters, since
 *    the builder runs on front-end URLs of this site.
 *
 * HOW THE TEMPLATE IS RESOLVED
 *   Builderius resolves the applied template during the front-end render and
 *   caches the \WP_Post in its BuilderiusRuntimeObjectCache service under
 *   'builderius_template_post'. The service container isn't exposed, but the
 *   plugin's hook callbacks (service objects) sit in $wp_filter and hold
 *   references to that cache — a bounded reflection walk over
 *   Builderius-owned callback objects finds it. Prototype-grade by design:
 *   the proper fix is Builderius exposing the applied template (it already
 *   generates the same URL for its posts-table row action via
 *   BuilderiusTemplateFromPostFactory::generateBuilderModeLink()).
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

/**
 * Find Builderius' runtime object cache service by walking the service
 * objects registered in $wp_filter. Bounded: only Builderius-namespaced
 * objects, max depth 3, each object visited once.
 *
 * @return object|null
 */
function dbe_builderius_runtime_cache() {
	static $cache = null, $searched = false;
	if ( $searched ) {
		return $cache;
	}
	$searched = true;

	$cache_class = '\Builderius\Bundle\TemplateBundle\Cache\BuilderiusRuntimeObjectCache';
	if ( ! class_exists( $cache_class ) ) {
		return null;
	}

	global $wp_filter;
	$queue = array();
	foreach ( $wp_filter as $hook ) {
		if ( ! ( $hook instanceof WP_Hook ) ) {
			continue;
		}
		foreach ( $hook->callbacks as $cbs ) {
			foreach ( $cbs as $cb ) {
				$fn = isset( $cb['function'] ) ? $cb['function'] : null;
				if ( is_array( $fn ) && isset( $fn[0] ) && is_object( $fn[0] )
					&& str_contains( get_class( $fn[0] ), 'Builderius' ) ) {
					$queue[ spl_object_id( $fn[0] ) ] = $fn[0];
				}
			}
		}
	}

	$seen = array();
	for ( $depth = 0; $depth < 3 && ! empty( $queue ); $depth++ ) {
		$next = array();
		foreach ( $queue as $id => $obj ) {
			if ( isset( $seen[ $id ] ) ) {
				continue;
			}
			$seen[ $id ] = true;
			if ( $obj instanceof $cache_class ) {
				$cache = $obj;
				return $cache;
			}
			// Walk own + inherited (incl. parent-private) properties.
			for ( $ref = new ReflectionObject( $obj ); $ref; $ref = $ref->getParentClass() ) {
				foreach ( $ref->getProperties() as $prop ) {
					if ( $prop->isStatic() ) {
						continue;
					}
					$prop->setAccessible( true );
					if ( ! $prop->isInitialized( $obj ) ) {
						continue;
					}
					$values = $prop->getValue( $obj );
					$values = is_array( $values ) ? $values : array( $values );
					foreach ( $values as $v ) {
						if ( is_object( $v ) && ! isset( $seen[ spl_object_id( $v ) ] )
							&& str_contains( get_class( $v ), 'Builderius' ) ) {
							$next[ spl_object_id( $v ) ] = $v;
						}
					}
				}
			}
		}
		$queue = $next;
	}

	return $cache;
}

/**
 * Add the "Edit template" node under the native Builderius admin-bar menu.
 *
 * @param WP_Admin_Bar $wp_admin_bar Admin bar instance.
 */
function dbe_adminbar_edit_template( WP_Admin_Bar $wp_admin_bar ) {
	if ( ! dbe_enabled( 'presence_heartbeat' ) ) {
		return;
	}
	// Logged-in front end only — the builder itself has no admin bar, and in
	// wp-admin there is no "current page" to resolve a template for.
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only mode detection.
	if ( is_admin() || isset( $_GET['builderius'] ) || isset( $_GET['builderius_inner_prev'] ) ) {
		return;
	}
	// Builderius adds its parent node only for builderius developers with the
	// admin bar showing — piggyback on that rather than re-checking.
	if ( ! $wp_admin_bar->get_node( 'builderius' ) ) {
		return;
	}

	$runtime_cache = dbe_builderius_runtime_cache();
	$template_post = $runtime_cache ? $runtime_cache->get( 'builderius_template_post' ) : false;
	if ( ! ( $template_post instanceof WP_Post ) ) {
		return;
	}

	// Same URL shape Builderius uses for its own posts-table row action.
	$factory = '\Builderius\Bundle\TemplateBundle\Factory\BuilderiusTemplateFromPostFactory';
	if ( class_exists( $factory ) ) {
		$href = $factory::generateBuilderModeLink( $template_post );
	} else {
		$permalink = get_permalink( $template_post->ID );
		$href      = $permalink . ( str_contains( $permalink, '?' ) ? '&' : '?' ) . 'builderius';
	}

	$wp_admin_bar->add_node(
		array(
			'parent' => 'builderius',
			'id'     => 'dbe-open-template',
			'title'  => sprintf(
				/* translators: %s: Builderius template name */
				__( 'Edit template: %s', 'daveden-builderius-enhancements' ),
				esc_html( $template_post->post_title )
			),
			'href'   => esc_url( $href ),
			'meta'   => array( 'title' => __( 'Open this page\'s Builderius template in the builder', 'daveden-builderius-enhancements' ) ),
		)
	);
}
add_action( 'admin_bar_menu', 'dbe_adminbar_edit_template', 9999 );

/**
 * Front-end click guard: confirm before opening the builder when a builder
 * tab already appears to be open (fresh heartbeat in localStorage).
 */
function dbe_adminbar_second_tab_warning() {
	if ( ! dbe_enabled( 'presence_heartbeat' ) ) {
		return;
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only mode detection.
	if ( ! is_user_logged_in() || is_admin() || isset( $_GET['builderius'] ) || isset( $_GET['builderius_inner_prev'] ) || ! is_admin_bar_showing() ) {
		return;
	}
	$heartbeat = dbe_heartbeat_config();
	?>
<script id="dbe-adminbar-open-template">
(function () {
	'use strict';
	var HB = <?php echo wp_json_encode( $heartbeat ); ?>;
	var MSG = 
	<?php
	echo wp_json_encode(
		array(
			'open' => __( 'The Builderius builder already appears to be open in another tab', 'daveden-builderius-enhancements' ),
			'warn' => __( 'Editing in two builder tabs at once can overwrite each other’s changes. Open the builder here anyway?', 'daveden-builderius-enhancements' ),
		)
	);
	?>
	;
	// The builder page heartbeats into localStorage (builder.js); a beat
	// fresher than HB.staleAfter means a builder tab is (very likely) open.
	document.addEventListener('click', function (e) {
		var a = e.target.closest && e.target.closest('#wp-admin-bar-dbe-open-template > a');
		if (!a) { return; }
		var raw = null;
		try { raw = localStorage.getItem(HB.key); } catch (err) {}
		if (!raw) { return; }
		var beat;
		try { beat = JSON.parse(raw); } catch (err) { return; }
		if (!beat || typeof beat.t !== 'number' || (Date.now() - beat.t) > HB.staleAfter) { return; }
		var msg = MSG.open
			+ (beat.title ? ':\n“' + beat.title + '”' : '')
			+ '\n\n' + MSG.warn;
		if (!window.confirm(msg)) {
			e.preventDefault();
			e.stopPropagation();
		}
	}, true);
})();
</script>
	<?php
}
add_action( 'wp_footer', 'dbe_adminbar_second_tab_warning', 999 );
