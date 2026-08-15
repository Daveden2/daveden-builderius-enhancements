<?php
/**
 * Admin bar: applied-template link compatibility + second-builder-tab warning.
 *
 * 1. Makes Builderius' own admin-bar menu trigger keyboard-focusable. The
 *    parent plugin renders a div with menuitem semantics but no Tab stop.
 * 2. Uses Builderius' native applied-template link when present. Older parent
 *    versions retain DBE's direct "Edit template" fallback.
 * 3. Before following either link, warns if the builder already appears to be
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
 * Make the native Builderius menu focusable and add DBE's legacy edit link
 * only when the parent plugin does not provide its own applied-template item.
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

	// Builderius renders its top-level menu trigger as a div role="menuitem"
	// without a Tab stop. Re-adding the existing node merges this supported
	// meta value without replacing Builderius' title, children or classes.
	$wp_admin_bar->add_node(
		array(
			'id'   => 'builderius',
			'meta' => array( 'tabindex' => 0 ),
		)
	);

	// Builderius 1.3.6-beta supplies the applied-template link natively. Keep
	// the reflection-based DBE fallback only for parent versions without it.
	if ( $wp_admin_bar->get_node( 'builderius-applied-template' ) ) {
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
 * Keep keyboard focus visible on Builderius' native top-level admin-bar item.
 *
 * Builderius' coloured inner wrapper covers WordPress' focused background, so
 * use one inset ring and suppress any competing outer outline.
 */
function dbe_adminbar_focus_styles() {
	if ( ! dbe_enabled( 'presence_heartbeat' ) || ! is_user_logged_in() || is_admin() || ! is_admin_bar_showing() ) {
		return;
	}
	?>
<style id="dbe-adminbar-builderius-focus">
#wpadminbar #wp-admin-bar-builderius > .ab-item:focus-visible {
	outline: none;
}
#wpadminbar #wp-admin-bar-builderius > .ab-item:focus-visible .builderius-status-wrapper {
	background-color: transparent;
	box-shadow: inset 0 0 0 2px currentColor;
}
#wpadminbar #wp-admin-bar-builderius > .ab-item:focus-visible .builderius-status-wrapper span {
	color: inherit;
}
#wpadminbar #wp-admin-bar-builderius > .ab-item:focus-visible .builderius-status-wrapper svg path {
	fill: currentColor;
}
#wpadminbar #wp-admin-bar-builderius .ab-submenu [role="menuitem"]:focus-visible,
#wpadminbar #wp-admin-bar-builderius .ab-submenu [role="menuitemradio"]:focus-visible {
	box-shadow: inset 0 0 0 2px currentColor;
	outline: none;
}
#wpadminbar #wp-admin-bar-builderius .builderius-status-item[aria-disabled="true"] {
	cursor: default;
}
@media (forced-colors: active) {
	#wpadminbar #wp-admin-bar-builderius > .ab-item:focus-visible .builderius-status-wrapper,
	#wpadminbar #wp-admin-bar-builderius .ab-submenu [role="menuitem"]:focus-visible,
	#wpadminbar #wp-admin-bar-builderius .ab-submenu [role="menuitemradio"]:focus-visible {
		box-shadow: none;
		outline: 2px solid CanvasText;
		outline-offset: -2px;
	}
}
</style>
	<?php
}
add_action( 'wp_head', 'dbe_adminbar_focus_styles', 999 );

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
	function enhanceBuilderiusMenu() {
		var menu = document.getElementById('wp-admin-bar-builderius');
		var trigger = menu && menu.querySelector(':scope > .ab-item');
		var submenu = menu && menu.querySelector(':scope > .ab-sub-wrapper');
		var submenuList = submenu && submenu.querySelector(':scope > ul[id]');
		if (!trigger || !submenu || !submenuList) { return; }
		var preview = submenu.querySelector('#wp-admin-bar-builderius-preview-mode');
		var previewContainer = preview && preview.querySelector(':scope > .ab-item');
		var previewGroup = previewContainer && previewContainer.querySelector('.builderius-status-management-wrapper');
		var previewHeading = previewGroup && previewGroup.querySelector('.status-heading');
		var previewItems = previewGroup ? Array.prototype.slice.call(previewGroup.querySelectorAll('.builderius-status-item')) : [];
		var suppressFocusOpen = false;
		submenuList.querySelectorAll(':scope > li').forEach(function (item) {
			item.setAttribute('role', 'none');
		});
		if (previewContainer) { previewContainer.setAttribute('role', 'none'); }
		if (previewGroup) {
			previewGroup.setAttribute('role', 'group');
			if (previewHeading) {
				previewHeading.id = previewHeading.id || 'dbe-builderius-preview-mode-label';
				previewGroup.setAttribute('aria-labelledby', previewHeading.id);
			}
		}
		previewItems.forEach(function (item) {
			var current = item.classList.contains('active');
			item.setAttribute('role', 'menuitemradio');
			item.setAttribute('tabindex', '-1');
			item.setAttribute('aria-checked', current ? 'true' : 'false');
			if (current) { item.setAttribute('aria-disabled', 'true'); }
			else { item.removeAttribute('aria-disabled'); }
			var indicator = item.querySelector('i');
			if (indicator) { indicator.setAttribute('aria-hidden', 'true'); }
		});
		submenuList.setAttribute('aria-labelledby', trigger.id || 'dbe-builderius-adminbar-trigger');
		if (!trigger.id) { trigger.id = 'dbe-builderius-adminbar-trigger'; }
		function menuItems() {
			return Array.prototype.slice.call(submenu.querySelectorAll('[role="menuitemradio"], a[role="menuitem"]'));
		}
		function setRovingItem(item) {
			menuItems().forEach(function (candidate) {
				candidate.setAttribute('tabindex', candidate === item ? '0' : '-1');
			});
		}
		function setMenuOpen(open) {
			menu.classList.toggle('hover', open);
			trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
			if (!open) { setRovingItem(null); }
		}
		function focusItem(index) {
			var items = menuItems();
			if (!items.length) { return; }
			var target = items[(index + items.length) % items.length];
			setMenuOpen(true);
			setRovingItem(target);
			target.focus();
		}
		setRovingItem(null);
		trigger.setAttribute('aria-haspopup', 'menu');
		trigger.setAttribute('aria-controls', submenuList.id);
		trigger.addEventListener('focus', function () {
			if (!suppressFocusOpen) { setMenuOpen(true); }
		});
		trigger.addEventListener('keydown', function (e) {
			if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== ' ') { return; }
			e.preventDefault();
			focusItem(e.key === 'ArrowUp' ? menuItems().length - 1 : 0);
		});
		menu.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && menu.contains(document.activeElement)) {
				e.preventDefault();
				suppressFocusOpen = true;
				trigger.focus();
				suppressFocusOpen = false;
				setMenuOpen(false);
				return;
			}
			var current = e.target.closest && e.target.closest('[role="menuitemradio"], a[role="menuitem"]');
			var items = menuItems();
			var index = items.indexOf(current);
			if (index < 0) { return; }
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
				e.preventDefault();
				if (e.key === 'Home') { focusItem(0); }
				else if (e.key === 'End') { focusItem(items.length - 1); }
				else { focusItem(index + (e.key === 'ArrowDown' ? 1 : -1)); }
				return;
			}
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				if (current.getAttribute('aria-disabled') !== 'true') { current.click(); }
			}
		});
		menu.addEventListener('focusin', function (e) {
			var current = e.target.closest && e.target.closest('[role="menuitemradio"], a[role="menuitem"]');
			if (current && submenu.contains(current)) {
				setMenuOpen(true);
				setRovingItem(current);
			}
		});
		menu.addEventListener('focusout', function (e) {
			if (!menu.contains(e.relatedTarget)) { setMenuOpen(false); }
		});
		menu.addEventListener('mouseenter', function () { setMenuOpen(true); });
		menu.addEventListener('mouseleave', function () {
			if (!menu.contains(document.activeElement)) { setMenuOpen(false); }
		});
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', enhanceBuilderiusMenu, { once: true });
	} else {
		enhanceBuilderiusMenu();
	}
	// The builder page heartbeats into localStorage (builder.js); a beat
	// fresher than HB.staleAfter means a builder tab is (very likely) open.
	function freshestBeat(value) {
		if (value && typeof value.t === 'number') {
			return (Date.now() - value.t) <= HB.staleAfter ? value : null;
		}
		if (!value || !value.tabs || typeof value.tabs !== 'object' || Array.isArray(value.tabs)) { return null; }
		return Object.keys(value.tabs).map(function (id) {
			return value.tabs[id];
		}).filter(function (beat) {
			return beat && typeof beat.t === 'number' && (Date.now() - beat.t) <= HB.staleAfter;
		}).sort(function (a, b) {
			return b.t - a.t;
		})[0] || null;
	}
	document.addEventListener('click', function (e) {
		var a = e.target.closest && e.target.closest('#wp-admin-bar-builderius-applied-template > a, #wp-admin-bar-dbe-open-template > a');
		if (!a) { return; }
		var raw = null;
		try { raw = localStorage.getItem(HB.key); } catch (err) {}
		if (!raw) { return; }
		var stored;
		try { stored = JSON.parse(raw); } catch (err) { return; }
		var beat = freshestBeat(stored);
		if (!beat) { return; }
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
