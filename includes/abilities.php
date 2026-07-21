<?php
/**
 * Agent-facing subtree HTML abilities (PROTOTYPE).
 *
 * Registers two WordPress Abilities API abilities that expose the HTML
 * converter server-side, so MCP-connected agents (e.g. via Novamira's
 * adapter) can read and edit a template's structure as HTML in one round
 * trip instead of a chain of per-module operations:
 *
 *  - dbe/get-subtree-html    serialise a module subtree to HTML, each
 *                            element carrying its data-dbe-id marker
 *  - dbe/apply-subtree-html  sanitise + reconcile edited HTML back onto
 *                            the subtree and save through Builderius' own
 *                            createCommit GraphQL mutation (autopublished)
 *
 * Unlike the builder dialogs (which edit the LIVE store), these work on the
 * SAVED state: the active commit of the template's branch. Saving creates a
 * new commit through the same mutation the builder's Save button uses, so
 * every Builderius event, head-commit bookkeeping step and cache flush runs.
 * An open builder session will NOT see the new commit until reloaded.
 *
 * Module types expressible server-side: HtmlElement, Collection,
 * SubCollection, Template. Anything else in a serialised subtree (Component,
 * SvgCode, HtmlCode, composites) is emitted as a <dbe-keep data-dbe-id="…">
 * placeholder; on apply the placeholder preserves that module and its whole
 * subtree untouched (it may be moved by moving the placeholder). Inline
 * <svg> in submitted markup is stripped with a note — the builder dialog
 * remains the SVG-capable channel, because PHP's HTML parser lowercases
 * attribute names (viewBox → viewbox) and would corrupt the stored markup.
 *
 * Sanitisation mirrors builder.js at entry: script-bearing elements and
 * unknown tags are stripped, on* handlers and javascript:/vbscript:/
 * script-bearing data: URLs are removed, and the dbe markers are consumed,
 * never stored. Builderius renders these settings raw, so this gate plus the
 * unfiltered_html permission below is the whole defence — keep them in sync
 * with the client-side twins in builder.js.
 *
 * @package Daveden_Builder_Enhancements
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/abilities/templates.php';
require_once __DIR__ . '/abilities/components.php';
require_once __DIR__ . '/abilities/css.php';
require_once __DIR__ . '/abilities/data.php';
require_once __DIR__ . '/abilities/snippets.php';
require_once __DIR__ . '/abilities/structure.php';
require_once __DIR__ . '/abilities/publishing.php';

/*
 * ----------------------------------------------------------------------
 *  Registration
 * ----------------------------------------------------------------------
 */

add_action( 'wp_abilities_api_categories_init', 'dbe_register_ability_category' );

/**
 * Category for the plugin's abilities.
 */
function dbe_register_ability_category() {
	wp_register_ability_category(
		'builderius-content',
		array(
			'label'       => __( 'Builderius content', 'daveden-builderius-enhancements' ),
			'description' => __( 'Read and edit Builderius template content as HTML.', 'daveden-builderius-enhancements' ),
		)
	);
}

add_action( 'wp_abilities_api_init', 'dbe_register_abilities' );

/**
 * Register one ability, honouring the settings-page toggles.
 *
 * Every ability in this file registers through this wrapper. An ability
 * switched off on the Agent abilities tab (or with the master switch off)
 * is simply never registered, so it does not exist for a connected agent:
 * it is absent from discovery and cannot be executed. dbe_ability_enabled()
 * also refuses ids missing from the dbe_abilities() registry, so a new
 * ability must be added there (with settings copy) before it can go live.
 *
 * @param string $id   Ability id, e.g. "dbe/extract-release".
 * @param array  $args wp_register_ability() arguments.
 */
function dbe_register_ability( $id, $args ) {
	if ( ! dbe_ability_enabled( $id ) ) {
		return;
	}
	wp_register_ability( $id, $args );
}

/**
 * Register the get/apply subtree HTML abilities.
 */
function dbe_register_abilities() {
	// Nothing registers while the master switch is off (dbe_register_ability()
	// gates every ability on it), so skip building the schemas altogether.
	if ( ! dbe_abilities_enabled() ) {
		return;
	}
	$template_arg        = array(
		'type'        => 'string',
		'description' => __( 'Template post ID or slug by default. When entity_type is "component", pass a Builderius component post ID or slug instead.', 'daveden-builderius-enhancements' ),
	);
	$entity_type_arg     = array(
		'type'        => 'string',
		'enum'        => array( 'template', 'component' ),
		'default'     => 'template',
		'description' => __( 'Builderius entity type to target. Defaults to template for backwards compatibility; use component for shared component definitions.', 'daveden-builderius-enhancements' ),
	);
	$expected_commit_arg = array(
		'type'        => 'string',
		'description' => __( 'The active commit name returned by the preceding read or dry run. Required when saving; the mutation fails if saved state has changed.', 'daveden-builderius-enhancements' ),
	);
	$force_arg           = array(
		'type'        => 'boolean',
		'default'     => false,
		'description' => __( 'Explicitly override a dirty Builderius-tab conflict. Use only after confirming that overwriting the tab state is intended.', 'daveden-builderius-enhancements' ),
	);

	dbe_register_structure_abilities( $template_arg, $entity_type_arg, $expected_commit_arg, $force_arg );

	dbe_register_publishing_abilities( $entity_type_arg, $force_arg );

	$settings_set_arg = array(
		'type'        => 'string',
		'description' => __( 'Global settings set post ID or slug. Omit when the site has one (the usual case).', 'daveden-builderius-enhancements' ),
	);

	dbe_register_css_abilities( $settings_set_arg, $template_arg, $entity_type_arg, $expected_commit_arg, $force_arg );

	dbe_register_template_abilities();

	dbe_register_data_abilities( $settings_set_arg, $entity_type_arg, $expected_commit_arg, $force_arg );

	dbe_register_snippet_abilities( $settings_set_arg, $entity_type_arg, $expected_commit_arg, $force_arg );

	dbe_register_component_abilities( $expected_commit_arg, $force_arg );
}

/**
 * Editing abilities can turn markup into raw-rendered module settings, so
 * they take the abilities master switch (the Agent abilities tab) plus
 * unfiltered_html plus Builderius' own development capability, which the
 * createCommit endpoint checks anyway. Per-ability toggles are enforced at
 * registration time by dbe_register_ability().
 */
function dbe_ability_permission() {
	return dbe_abilities_enabled()
		&& current_user_can( 'unfiltered_html' )
		&& current_user_can( 'builderius-development' );
}

/**
 * Read-only abilities (dbe/status) never touch raw markup, so they skip the
 * unfiltered_html requirement but still need the builder development
 * capability — they report on unpublished development state.
 */
function dbe_ability_read_permission() {
	return dbe_abilities_enabled()
		&& current_user_can( 'builderius-development' );
}

/*
 * ----------------------------------------------------------------------
 *  Saved-state access (entity → branch → active commit → config)
 * ----------------------------------------------------------------------
 */

/**
 * Normalise an ability entity type.
 *
 * @param mixed $entity_type Input entity type.
 * @return string|WP_Error Normalised entity type.
 */
function dbe_ability_entity_type( $entity_type ) {
	$entity_type = trim( strtolower( (string) $entity_type ) );
	if ( '' === $entity_type ) {
		return 'template';
	}
	if ( in_array( $entity_type, array( 'template', 'component' ), true ) ) {
		return $entity_type;
	}
	return new WP_Error( 'dbe_bad_entity_type', 'entity_type must be "template" or "component".' );
}

/**
 * Resolve a template or component reference to its post.
 *
 * @param string $ref         Post ID or slug.
 * @param string $entity_type Entity type: template or component.
 * @return WP_Post|WP_Error The entity post.
 */
function dbe_ability_find_entity_post( $ref, $entity_type = 'template' ) {
	$entity_type = dbe_ability_entity_type( $entity_type );
	if ( is_wp_error( $entity_type ) ) {
		return $entity_type;
	}

	$ref       = trim( (string) $ref );
	$post_type = 'component' === $entity_type ? 'builderius_component' : 'builderius_template';
	if ( is_numeric( $ref ) ) {
		$post = get_post( (int) $ref );
	} else {
		// Not get_page_by_path(): a template post's post_parent points at the
		// post it applies to, which that function misreads as a hierarchy.
		$found = get_posts(
			array(
				'post_type'   => $post_type,
				'name'        => $ref,
				'post_status' => get_post_stati(),
				'numberposts' => 1,
			)
		);
		$post  = $found ? $found[0] : null;
	}
	if ( ! $post || $post_type !== $post->post_type ) {
		return new WP_Error( 'dbe_no_entity', sprintf( 'No %s found for "%s".', $post_type, $ref ) );
	}
	return $post;
}

/**
 * Resolve a template or component reference to its saved content config.
 *
 * @param string $ref         Post ID or slug.
 * @param string $entity_type Entity type: template or component.
 * @return array|WP_Error { config, entity_post, entity_type, template_post, branch, commit }.
 */
function dbe_ability_load_entity_config( $ref, $entity_type = 'template' ) {
	$entity_type = dbe_ability_entity_type( $entity_type );
	if ( is_wp_error( $entity_type ) ) {
		return $entity_type;
	}

	$post = dbe_ability_find_entity_post( $ref, $entity_type );
	if ( is_wp_error( $post ) ) {
		return $post;
	}

	$resolved = dbe_ability_resolve_commit( $post );
	if ( is_wp_error( $resolved ) ) {
		return $resolved;
	}
	if ( empty( $resolved['config']['modules'] ) || ! isset( $resolved['config']['indexes'] ) ) {
		return new WP_Error( 'dbe_bad_config', 'The active commit has no readable content config.' );
	}

	return array(
		'config'        => $resolved['config'],
		'entity_post'   => $post,
		'entity_type'   => $entity_type,
		'template_post' => $post,
		'branch'        => $resolved['branch'],
		'commit'        => $resolved['commit'],
	);
}

/**
 * Resolve a template reference to its saved content config.
 *
 * @param string $template Post ID or slug.
 * @return array|WP_Error { config, template_post, branch, commit }.
 */
function dbe_ability_load_config( $template ) {
	return dbe_ability_load_entity_config( $template, 'template' );
}

/**
 * Resolve a VCS-owning post (template, global settings set, component) to
 * its branch (master preferred), active commit and decoded content config.
 * The active-commit pointer is per-user; fall back to any user's, then to
 * the newest commit.
 *
 * @param WP_Post $post The owning post.
 * @return array|WP_Error { branch, commit, config }.
 */
function dbe_ability_resolve_commit( $post ) {
	$branches = get_posts(
		array(
			'post_type'   => 'builderius_branch',
			'post_parent' => $post->ID,
			'post_status' => get_post_stati(),
			'numberposts' => -1,
			'orderby'     => 'ID',
			'order'       => 'ASC',
		)
	);
	if ( ! $branches ) {
		return new WP_Error( 'dbe_no_branch', 'The entity has no branch (never opened in the builder?).' );
	}
	$branch = null;
	foreach ( $branches as $b ) {
		if ( 'master' === $b->post_name ) {
			$branch = $b;
			break;
		}
	}
	if ( ! $branch ) {
		$branch = $branches[0];
	}

	// Per-user active commit pointer; fall back to any user's.
	$map  = json_decode( (string) get_post_meta( $branch->ID, 'active_commit', true ), true );
	$map  = is_array( $map ) ? $map : array();
	$name = $map[ get_current_user_id() ] ?? ( $map ? reset( $map ) : '' );

	$commit = null;
	if ( $name ) {
		$found  = get_posts(
			array(
				'post_type'   => 'builderius_commit',
				'post_parent' => $branch->ID,
				'name'        => $name,
				'post_status' => get_post_stati(),
				'numberposts' => 1,
			)
		);
		$commit = $found ? $found[0] : null;
	}
	if ( ! $commit ) {
		$found  = get_posts(
			array(
				'post_type'   => 'builderius_commit',
				'post_parent' => $branch->ID,
				'post_status' => get_post_stati(),
				'numberposts' => 1,
				'orderby'     => 'ID',
				'order'       => 'DESC',
			)
		);
		$commit = $found ? $found[0] : null;
	}
	if ( ! $commit ) {
		return new WP_Error( 'dbe_no_commit', 'The entity branch has no commits.' );
	}

	$config = json_decode( (string) get_post_meta( $commit->ID, 'content_config', true ), true );
	if ( ! is_array( $config ) ) {
		return new WP_Error( 'dbe_bad_config', 'The active commit has no readable content config.' );
	}

	return array(
		'branch' => $branch,
		'commit' => $commit,
		'config' => $config,
	);
}

/**
 * Resolve the global settings set (post type builderius_sett_set) — the
 * entity whose saved config carries the site's global CSS in the settings
 * entry named `css`. There is normally exactly one per technology; an
 * explicit ID/slug narrows it when a site has several.
 *
 * @param string $ref Optional post ID or slug; '' for the single set.
 * @return array|WP_Error { config, set_post, branch, commit, css, css_index }.
 */
function dbe_ability_load_settings_set( $ref = '' ) {
	$ref = trim( (string) $ref );
	if ( '' !== $ref && is_numeric( $ref ) ) {
		$post = get_post( (int) $ref );
		if ( ! $post || 'builderius_sett_set' !== $post->post_type ) {
			$post = null;
		}
	} else {
		$posts = get_posts(
			array(
				'post_type'   => 'builderius_sett_set',
				'post_status' => get_post_stati(),
				'numberposts' => -1,
				'orderby'     => 'ID',
				'order'       => 'ASC',
			)
		);
		if ( '' !== $ref ) {
			$post = null;
			foreach ( $posts as $p ) {
				if ( $p->post_name === $ref ) {
					$post = $p;
					break;
				}
			}
		} else {
			if ( count( $posts ) > 1 ) {
				return new WP_Error(
					'dbe_ambiguous_set',
					'Several global settings sets exist — pass settings_set: ' . implode( ', ', wp_list_pluck( $posts, 'post_name' ) )
				);
			}
			$post = $posts ? $posts[0] : null;
		}
	}
	if ( ! $post ) {
		return new WP_Error( 'dbe_no_settings_set', sprintf( 'No builderius_sett_set found%s.', '' !== $ref ? " for \"$ref\"" : '' ) );
	}

	$resolved = dbe_ability_resolve_commit( $post );
	if ( is_wp_error( $resolved ) ) {
		return $resolved;
	}

	$css       = null;
	$css_index = -1;
	$settings  = $resolved['config']['template']['settings'] ?? array();
	foreach ( (array) $settings as $i => $s ) {
		if ( 'css' === ( $s['name'] ?? '' ) ) {
			$css       = (string) ( $s['value'] ?? '' );
			$css_index = (int) $i;
			break;
		}
	}
	if ( null === $css ) {
		return new WP_Error( 'dbe_no_css_setting', 'The settings set\'s saved config has no `css` setting.' );
	}

	return array(
		'config'    => $resolved['config'],
		'set_post'  => $post,
		'branch'    => $resolved['branch'],
		'commit'    => $resolved['commit'],
		'css'       => $css,
		'css_index' => $css_index,
	);
}


/*
 * ----------------------------------------------------------------------
 *  Component registry (slug -> label + declared property names)
 * ----------------------------------------------------------------------
 */

/**
 * Map every registered component to its label and declared property names,
 * read from each component's active-commit config (`template.settings`
 * entry `componentTmplProperties`). Drives the `<dbe-component name="…">`
 * serialisation and lets apply validate prop attributes against what the
 * component actually declares.
 *
 * @return array<string,array{label:string,props:array<string,array>}>
 *         keyed by component slug (post_name).
 */
function dbe_ability_component_registry() {
	static $registry = null;
	if ( null !== $registry ) {
		return $registry;
	}
	$registry   = array();
	$components = get_posts(
		array(
			'post_type'   => 'builderius_component',
			'post_status' => get_post_stati(),
			'numberposts' => -1,
		)
	);
	foreach ( $components as $component ) {
		$props  = array();
		$branch = get_posts(
			array(
				'post_type'   => 'builderius_branch',
				'post_parent' => $component->ID,
				'post_status' => get_post_stati(),
				'numberposts' => 1,
				'orderby'     => 'ID',
				'order'       => 'ASC',
			)
		);
		if ( $branch ) {
			$commit = get_posts(
				array(
					'post_type'   => 'builderius_commit',
					'post_parent' => $branch[0]->ID,
					'post_status' => get_post_stati(),
					'numberposts' => 1,
					'orderby'     => 'ID',
					'order'       => 'DESC',
				)
			);
			if ( $commit ) {
				$cfg = json_decode( (string) get_post_meta( $commit[0]->ID, 'content_config', true ), true );
				foreach ( (array) ( $cfg['template']['settings'] ?? array() ) as $s ) {
					if ( 'componentTmplProperties' === ( $s['name'] ?? '' ) && is_array( $s['value'] ?? null ) ) {
						foreach ( $s['value'] as $def ) {
							if ( ! empty( $def['name'] ) ) {
								// HTML parsers lowercase attribute names. Key the
								// registry case-insensitively, but retain the canonical
								// Builderius property name for storage.
								$props[ strtolower( $def['name'] ) ] = $def;
							}
						}
					}
				}
			}
		}
		$registry[ $component->post_name ] = array(
			'label' => $component->post_title,
			'props' => $props,
		);
	}
	return $registry;
}


/*
 * ----------------------------------------------------------------------
 *  Save — Builderius' own createCommit mutation, via internal REST
 * ----------------------------------------------------------------------
 */

/**
 * Check dirty-tab presence and the caller's expected active commit.
 *
 * @param array  $loaded Loaded template/settings-set state.
 * @param array  $input  Ability input.
 * @param string $slug   Template slug for presence checking, or ''.
 * @return true|WP_Error
 */
function dbe_ability_preflight( $loaded, $input, $slug = '' ) {
	// A dry run is read-only: it must never be blocked by an open builder
	// tab, or agents cannot even preview while the user is working.
	if ( ! empty( $input['dry_run'] ) ) {
		return true;
	}
	if ( '' !== $slug && function_exists( 'dbe_presence_precondition' ) ) {
		$presence = dbe_presence_precondition( $slug, ! empty( $input['force'] ) );
		if ( is_wp_error( $presence ) ) {
			return $presence;
		}
	}
	$expected = trim( (string) ( $input['expected_commit'] ?? '' ) );
	if ( '' === $expected ) {
		return new WP_Error(
			'dbe_expected_commit_required',
			'Pass expected_commit from the preceding read or dry run before saving.'
		);
	}
	$current = (string) $loaded['commit']->post_name;
	if ( $expected !== $current ) {
		return new WP_Error(
			'dbe_commit_conflict',
			sprintf( 'Saved state changed: expected commit %s, current commit %s. Reload, rebase the change and try again.', $expected, $current ),
			array(
				'expected_commit' => $expected,
				'current_commit'  => $current,
			)
		);
	}
	return true;
}

/**
 * Check every template for a dirty builder tab.
 *
 * @param bool $force Explicit conflict override.
 * @return true|WP_Error
 */
function dbe_ability_all_presence_precondition( $force = false ) {
	if ( ! function_exists( 'dbe_presence_precondition' ) ) {
		return true;
	}
	$templates = get_posts(
		array(
			'post_type'   => 'builderius_template',
			'post_status' => get_post_stati(),
			'numberposts' => -1,
		)
	);
	foreach ( $templates as $template ) {
		$result = dbe_presence_precondition( $template->post_name, $force );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
	}
	return true;
}

/**
 * Current active commit name for a branch and the current user.
 *
 * @param int $branch_id Builderius branch post ID.
 * @return string
 */
function dbe_ability_branch_head_name( $branch_id ) {
	$map  = json_decode( (string) get_post_meta( $branch_id, 'active_commit', true ), true );
	$map  = is_array( $map ) ? $map : array();
	$name = (string) ( $map[ get_current_user_id() ] ?? ( $map ? reset( $map ) : '' ) );
	if ( '' !== $name ) {
		// The pointer can go stale (commit deleted); an unverified name would
		// diverge from dbe_ability_resolve_commit's fallback and make every
		// save fail dbe_commit_conflict with no way out. Verify it exists.
		$exists = get_posts(
			array(
				'post_type'   => 'builderius_commit',
				'post_parent' => $branch_id,
				'name'        => $name,
				'post_status' => get_post_stati(),
				'numberposts' => 1,
				'fields'      => 'ids',
			)
		);
		if ( ! $exists ) {
			$name = '';
		}
	}
	if ( '' !== $name ) {
		return $name;
	}
	$latest = get_posts(
		array(
			'post_type'   => 'builderius_commit',
			'post_parent' => $branch_id,
			'post_status' => get_post_stati(),
			'numberposts' => 1,
			'orderby'     => 'ID',
			'order'       => 'DESC',
		)
	);
	return $latest ? (string) $latest[0]->post_name : '';
}

/**
 * Acquire a short, database-atomic lock around a DBE branch commit.
 *
 * @param int $branch_id Builderius branch post ID.
 * @return array|WP_Error Lock details.
 */
function dbe_ability_acquire_branch_lock( $branch_id ) {
	$key   = 'dbe_ability_lock_' . (int) $branch_id;
	$token = wp_generate_uuid4();
	$value = array(
		'token' => $token,
		'time'  => time(),
	);
	if ( ! add_option( $key, $value, '', false ) ) {
		$current = get_option( $key );
		if ( is_array( $current ) && (int) ( $current['time'] ?? 0 ) < ( time() - 30 ) ) {
			delete_option( $key );
		}
		if ( ! add_option( $key, $value, '', false ) ) {
			return new WP_Error( 'dbe_branch_busy', 'Another DBE mutation is already saving this branch. Try again.' );
		}
	}
	return array(
		'key'   => $key,
		'token' => $token,
	);
}

/**
 * Release a branch lock only when it is still ours.
 *
 * @param array $lock Lock returned by dbe_ability_acquire_branch_lock().
 */
function dbe_ability_release_branch_lock( $lock ) {
	$current = get_option( $lock['key'] );
	if ( is_array( $current ) && hash_equals( (string) $lock['token'], (string) ( $current['token'] ?? '' ) ) ) {
		delete_option( $lock['key'] );
	}
}

/**
 * Dispatch a GraphQL mutation through Builderius' own REST endpoint, the
 * same channel the builder UI uses, so permissions, events and cache
 * flushes all apply.
 *
 * @param string $name      Operation name reported to the endpoint.
 * @param string $mutation  GraphQL document.
 * @param array  $variables GraphQL variables.
 * @return array|WP_Error The mutation's `data` array.
 */
function dbe_ability_graphql( $name, $mutation, $variables = array() ) {
	/*
	 * Builderius Pro's builderius_get_current_user hook caches the current
		user in its runtime cache the first time anything applies the filter.
		Under OAuth-authenticated REST (the MCP adapter) that first application
		can happen BEFORE authentication resolves the user, poisoning the cache
		with user 0 and failing the mutation's capability check. The ability's
		own permission callback has already vouched for the real user, so pin
		the filter to them for the duration of the internal dispatch.
	 */
	$pin_user = static function () {
		return wp_get_current_user();
	};
	add_filter( 'builderius_get_current_user', $pin_user, PHP_INT_MAX );

	/*
	 * DBE's own commits are authoritative, including deliberate named-block
	 * deletions, so the CSS block guard must not "repair" them.
	 */
	if ( function_exists( 'dbe_css_guard_suspended' ) ) {
		dbe_css_guard_suspended( true );
	}

	try {
		$request = new WP_REST_Request( 'POST', '/wp/v2/builderius' );
		$request->set_header( 'Content-Type', 'application/json' );
		$request->set_body(
			wp_json_encode(
				array(
					'queries' => array(
						array(
							'name'      => $name,
							'query'     => $mutation,
							'variables' => $variables,
						),
					),
				)
			)
		);
		$response = rest_do_request( $request );
	} finally {
		remove_filter( 'builderius_get_current_user', $pin_user, PHP_INT_MAX );
		if ( function_exists( 'dbe_css_guard_suspended' ) ) {
			dbe_css_guard_suspended( false );
		}
	}

	if ( $response->is_error() ) {
		$err = $response->as_error();
		return new WP_Error( 'dbe_graphql_failed', $name . ' request failed: ' . $err->get_error_message() );
	}
	$data   = $response->get_data();
	$result = is_array( $data ) ? reset( $data ) : null;
	if ( ! empty( $result['errors'] ) ) {
		// The executor flattens GraphQL errors to plain message strings.
		return new WP_Error( 'dbe_graphql_failed', $name . ' rejected: ' . implode( ' | ', array_map( 'strval', $result['errors'] ) ) );
	}
	return is_array( $result['data'] ?? null ) ? $result['data'] : array();
}

/**
 * Create a commit holding $config on $branch_id. Runs the exact mutation
 * the builder's Save button sends.
 *
 * @param int    $branch_id      Builderius branch post ID.
 * @param array  $config         Complete Builderius content config.
 * @param bool   $autopublish    Whether Builderius should autopublish.
 * @param string $description    Commit description.
 * @param string $expected_commit Expected active commit name.
 * @return string|WP_Error The new commit name.
 */
function dbe_ability_create_commit( $branch_id, $config, $autopublish = false, $description = 'Applied via dbe/apply-subtree-html', $expected_commit = '' ) {
	$expected_commit = trim( (string) $expected_commit );
	if ( '' === $expected_commit ) {
		return new WP_Error( 'dbe_expected_commit_required', 'Pass expected_commit from the preceding read or dry run before saving.' );
	}
	$json = wp_json_encode( $config, JSON_UNESCAPED_UNICODE );
	if ( false === $json ) {
		return new WP_Error( 'dbe_encode_failed', 'Could not encode the content config.' );
	}
	$lock = dbe_ability_acquire_branch_lock( $branch_id );
	if ( is_wp_error( $lock ) ) {
		return $lock;
	}
	try {
		$current = dbe_ability_branch_head_name( $branch_id );
		if ( $expected_commit !== $current ) {
			return new WP_Error(
				'dbe_commit_conflict',
				sprintf( 'Saved state changed: expected commit %s, current commit %s. Reload, rebase the change and try again.', $expected_commit, $current ),
				array(
					'expected_commit' => $expected_commit,
					'current_commit'  => $current,
				)
			);
		}
		$mutation = 'mutation DbeCreateCommit($input: BuilderiusCreateCommitInput!, $autopublish: Boolean!) {'
			. ' createCommit(input: $input, autopublish: $autopublish) { commit { name autopublished } }'
			. ' }';
		$data     = dbe_ability_graphql(
			'dbeApplySubtreeHtml',
			$mutation,
			array(
				'input'       => array(
					'branch_id'                 => (int) $branch_id,
					'serialized_content_config' => $json,
					'description'               => substr( (string) $description, 0, 500 ),
				),
				'autopublish' => (bool) $autopublish,
			)
		);
		if ( is_wp_error( $data ) ) {
			return $data;
		}
		$name = $data['createCommit']['commit']['name'] ?? '';
		if ( '' === $name ) {
			return new WP_Error( 'dbe_commit_failed', 'createCommit returned no commit name.' );
		}
		return $name;
	} finally {
		dbe_ability_release_branch_lock( $lock );
	}
}

/*
 * ----------------------------------------------------------------------
 *  Shared scoped-setting services (dataVars, customJs, …)
 * ----------------------------------------------------------------------
 */

/**
 * Load one named template setting (dataVars, customJs, …) for the requested
 * scope: the global settings set (default) or one entity's saved config.
 * Saved entries use the builder's compact keys (dataVars: a1 = type,
 * b1 = name, c1 = value/query, d1 = GraphQL variables JSON; customJs:
 * a1 = label, b1 = id, c1 = code, d1 = attributes, e1 = external,
 * h1 = footer, l1 = loading, x1 = enabled, g1 = description, p1 = priority).
 *
 * @param array  $input        Ability input (template / entity_type / settings_set).
 * @param string $setting_name The settings entry to extract.
 * @return array|WP_Error { loaded, scope, slug, vars, vars_index }.
 */
function dbe_ability_load_scoped_setting( $input, $setting_name ) {
	$template = trim( (string) ( $input['template'] ?? '' ) );
	if ( '' !== $template ) {
		$loaded = dbe_ability_load_entity_config( $template, $input['entity_type'] ?? 'template' );
		$scope  = 'entity';
		$slug   = is_wp_error( $loaded ) ? '' : (string) $loaded['entity_post']->post_name;
	} else {
		$loaded = dbe_ability_load_settings_set( $input['settings_set'] ?? '' );
		$scope  = 'global';
		$slug   = '';
	}
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}

	$vars       = array();
	$vars_index = -1;
	$settings   = $loaded['config']['template']['settings'] ?? array();
	foreach ( (array) $settings as $i => $s ) {
		if ( ( $s['name'] ?? '' ) === $setting_name ) {
			$vars       = is_array( $s['value'] ?? null ) ? $s['value'] : array();
			$vars_index = (int) $i;
			break;
		}
	}

	return array(
		'loaded'     => $loaded,
		'scope'      => $scope,
		'slug'       => $slug,
		'vars'       => $vars,
		'vars_index' => $vars_index,
	);
}


/**
 * Run the write-side preconditions (all-templates presence for global scope,
 * dirty-tab and expected_commit preflight) and commit an updated scoped
 * setting through Builderius' own mutation.
 *
 * @param array  $state        State from dbe_ability_load_scoped_setting().
 * @param string $setting_name The settings entry to write.
 * @param array  $vars         The entry's new value.
 * @param array  $input        Ability input (expected_commit / force).
 * @param string $description  Commit description.
 * @return string|WP_Error The new commit name.
 */
function dbe_ability_save_scoped_setting( $state, $setting_name, $vars, $input, $description ) {
	$loaded = $state['loaded'];

	if ( 'global' === $state['scope'] ) {
		$presence = dbe_ability_all_presence_precondition( ! empty( $input['force'] ) );
		if ( is_wp_error( $presence ) ) {
			return $presence;
		}
	}
	$preflight = dbe_ability_preflight( $loaded, $input, $state['slug'] );
	if ( is_wp_error( $preflight ) ) {
		return $preflight;
	}

	$config = $loaded['config'];
	if ( -1 === $state['vars_index'] ) {
		$config['template']['settings'][] = array(
			'name'  => $setting_name,
			'value' => $vars,
		);
	} else {
		$config['template']['settings'][ $state['vars_index'] ]['value'] = $vars;
	}

	return dbe_ability_create_commit(
		$loaded['branch']->ID,
		$config,
		false,
		$description,
		(string) ( $input['expected_commit'] ?? '' )
	);
}
