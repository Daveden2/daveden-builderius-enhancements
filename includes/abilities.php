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

	dbe_register_ability(
		'dbe/status',
		array(
			'label'               => __( 'Get save/publish status', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Reports the save vs publish state of Builderius templates or components. Saving (the builder Save button, createCommit, dbe/apply-subtree-html) writes to the development branch, which a LOGGED-IN user already sees on the front end — so save-only is enough to preview. Logged-out visitors render from a published release only; with no release ever published they get the theme fallback, which looks like a blank page. For each entity this returns its active saved commit, whether that work is in the selected published release, and whether saved/published deliverable HTML is empty. Omit template to report on every entity of the selected type; pass release to inspect a specific Builderius release version or ID.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'    => array(
						'type'        => 'string',
						'description' => __( 'Entity post ID or slug. Omit for all entities of the selected type.', 'daveden-builderius-enhancements' ),
					),
					'entity_type' => $entity_type_arg,
					'release'     => array(
						'type'        => 'string',
						'description' => __( 'Builderius release post ID, version/title, or slug to inspect. Omit for the latest published release.', 'daveden-builderius-enhancements' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'published_release' => array(
						'type'        => array( 'object', 'null' ),
						'description' => __( 'The currently published release (id, version, date), or null if the site has never published — in which case logged-out visitors get no Builderius output (logged-in users still see dev-branch saves).', 'daveden-builderius-enhancements' ),
					),
					'templates'         => array(
						'type'        => 'array',
						'description' => __( 'Per template: id, slug, title, branch_id, saved commit name/date, release inclusion, unpublished_changes, and saved/published deliverable lengths so empty published output is visible.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
					'components'        => array(
						'type'        => 'array',
						'description' => __( 'Per component when entity_type is component: id, slug, title, branch_id, saved commit, release inclusion, unpublished_changes, and saved/published deliverable lengths.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
					'entities'          => array(
						'type'        => 'array',
						'description' => __( 'The selected entity-type rows, matching either templates or components.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_status',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/publish',
		array(
			'label'               => __( 'Publish a release', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Creates and publishes a Builderius release from the templates\' saved (active) commits — the missing publish half of the save → publish → verify loop. This is the same createRelease mutation as the builder\'s Publish action: it bundles the active commit of every listed template (plus all global settings sets and any components they use) and makes the result live for logged-out visitors, replacing the previously published release. Publishing is go-live, not preview — a logged-in user already sees saved commits, so publish only on explicit user approval. Check dbe/status first; run with dry_run to see what would be released. Save any pending work first — this publishes saved commits, not unsaved builder edits.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'templates'        => array(
						'type'        => 'array',
						'items'       => array( 'type' => 'string' ),
						'description' => __( 'Template post IDs or slugs to include. Omit to include every template that has saved work.', 'daveden-builderius-enhancements' ),
					),
					'version'          => array(
						'type'        => 'string',
						'description' => __( 'Release version label. Omit to auto-increment the latest release\'s patch number (1.0.0 when the site has never published).', 'daveden-builderius-enhancements' ),
					),
					'description'      => array(
						'type'        => 'string',
						'description' => __( 'Release description shown in the builder\'s release list.', 'daveden-builderius-enhancements' ),
					),
					'dry_run'          => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview only: return the version and entities that WOULD be released without publishing.', 'daveden-builderius-enhancements' ),
					),
					'expected_commits' => array(
						'type'        => 'array',
						'description' => __( 'Required when publishing. One template/commit pair for every entity returned by the preceding dry run.', 'daveden-builderius-enhancements' ),
						'items'       => array(
							'type'                 => 'object',
							'properties'           => array(
								'template' => array( 'type' => 'string' ),
								'commit'   => array( 'type' => 'string' ),
							),
							'required'             => array( 'template', 'commit' ),
							'additionalProperties' => false,
						),
					),
					'force'            => $force_arg,
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'release'  => array(
						'type'        => array( 'object', 'null' ),
						'description' => __( 'The published release (id, version, status); null on a dry run.', 'daveden-builderius-enhancements' ),
					),
					'version'  => array( 'type' => 'string' ),
					'entities' => array(
						'type'        => 'array',
						'description' => __( 'The templates included (id, slug, saved commit).', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
					'dry_run'  => array( 'type' => 'boolean' ),
				),
			),
			'execute_callback'    => 'dbe_ability_publish',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/extract-release',
		array(
			'label'               => __( 'Extract a release (work on a release)', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Rebuilds the DEVELOPMENT state from a Builderius release — the builder\'s "work on a release" action, via the same extractRelease mutation. Builderius first DELETES every existing template, component and global settings set (framework CSS and all commit history included), then recreates each entity from the release\'s bundled configs with a fresh single-commit history. The release itself is untouched and stays published, so logged-out visitors see no change. Use when development state is missing or meaningless while a release exists — the classic case is a migrated site whose builder shows empty templates although the live pages render fine — or to roll development back to what is published. This destroys ALL unpublished work; requires confirm: true after explicit user approval. Always run with dry_run first: it reports the release contents and everything that would be deleted. Close open builder tabs before extracting and reload them afterwards — a stale tab\'s save would resurrect deleted state.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'release' => array(
						'type'        => 'string',
						'description' => __( 'Builderius release post ID, version/title, or slug to extract. Omit for the latest published release.', 'daveden-builderius-enhancements' ),
					),
					'dry_run' => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview only: report the release contents and the current entities that WOULD be deleted, without extracting.', 'daveden-builderius-enhancements' ),
					),
					'confirm' => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Must be true to extract. Extraction permanently replaces all development state; confirm with the user first.', 'daveden-builderius-enhancements' ),
					),
					'force'   => $force_arg,
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'release'   => array(
						'type'        => 'object',
						'description' => __( 'The release being extracted (id, version, date).', 'daveden-builderius-enhancements' ),
					),
					'contains'  => array(
						'type'        => 'array',
						'description' => __( 'The release\'s bundled entities (slug, name, entity_type, type) that extraction recreates.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
					'replaces'  => array(
						'type'        => 'object',
						'description' => __( 'Slugs of the current templates, components and settings_sets that extraction deletes first.', 'daveden-builderius-enhancements' ),
					),
					'after'     => array(
						'type'        => array( 'object', 'null' ),
						'description' => __( 'Slugs of the templates, components and settings_sets present after extraction; null on a dry run.', 'daveden-builderius-enhancements' ),
					),
					'extracted' => array( 'type' => 'boolean' ),
					'dry_run'   => array( 'type' => 'boolean' ),
					'message'   => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => 'dbe_ability_extract_release',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

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
 *  Save/publish state + publishing
 * ----------------------------------------------------------------------
 */

/**
 * The currently published release post, or null. The front end renders from
 * this for LOGGED-OUT visitors (BuilderiusDeliverableReleaseProvider): no
 * release, no public Builderius output. A logged-in user sees the dev
 * branch's saved commits regardless, so a release is a go-live step, not a
 * preview step.
 *
 * @return WP_Post|null
 */
function dbe_ability_published_release() {
	return dbe_ability_resolve_release();
}

/**
 * Resolve a Builderius release by ID, title/version or slug.
 *
 * @param string $ref Optional release reference; empty means latest published.
 * @return WP_Post|WP_Error|null
 */
function dbe_ability_resolve_release( $ref = '' ) {
	$ref = trim( (string) $ref );
	if ( '' !== $ref && is_numeric( $ref ) ) {
		$post = get_post( (int) $ref );
		if ( $post && 'builderius_release' === $post->post_type ) {
			return $post;
		}
		return new WP_Error( 'dbe_no_release', sprintf( 'No builderius_release found for "%s".', $ref ) );
	}
	if ( '' !== $ref ) {
		$posts = get_posts(
			array(
				'post_type'   => 'builderius_release',
				'post_status' => get_post_stati(),
				'numberposts' => 1,
				'orderby'     => 'date',
				'order'       => 'DESC',
				's'           => $ref,
			)
		);
		foreach ( $posts as $post ) {
			if ( $post->post_title === $ref || $post->post_name === $ref ) {
				return $post;
			}
		}
		$posts = get_posts(
			array(
				'post_type'   => 'builderius_release',
				'post_status' => get_post_stati(),
				'numberposts' => -1,
				'orderby'     => 'date',
				'order'       => 'DESC',
			)
		);
		foreach ( $posts as $post ) {
			if ( $post->post_title === $ref || $post->post_name === $ref ) {
				return $post;
			}
		}
		return new WP_Error( 'dbe_no_release', sprintf( 'No builderius_release found for "%s".', $ref ) );
	}

	$posts = get_posts(
		array(
			'post_type'   => 'builderius_release',
			'post_status' => array( 'publish', 'future' ),
			'numberposts' => 1,
			'orderby'     => 'date',
			'order'       => 'DESC',
		)
	);
	return $posts ? $posts[0] : null;
}

/**
 * Every selected entity that has saved work (a branch with at least one
 * commit), resolved through dbe_ability_load_entity_config so branch/commit
 * selection is identical to the editing abilities'.
 *
 * @param array|null $refs        Entity IDs/slugs to restrict to, or null for all.
 * @param string     $entity_type Entity type: template or component.
 * @return array{loaded:array,errors:array} loaded rows from
 *         dbe_ability_load_entity_config keyed by entity ID.
 */
function dbe_ability_load_entities( $refs = null, $entity_type = 'template' ) {
	$entity_type = dbe_ability_entity_type( $entity_type );
	if ( is_wp_error( $entity_type ) ) {
		return array(
			'loaded' => array(),
			'errors' => array(
				array(
					'entity' => '',
					'error'  => $entity_type->get_error_message(),
				),
			),
		);
	}
	if ( null === $refs ) {
		$refs = get_posts(
			array(
				'post_type'   => 'component' === $entity_type ? 'builderius_component' : 'builderius_template',
				'post_status' => get_post_stati(),
				'numberposts' => -1,
				'fields'      => 'ids',
			)
		);
	}
	$loaded = array();
	$errors = array();
	foreach ( $refs as $ref ) {
		$row = dbe_ability_load_entity_config( (string) $ref, $entity_type );
		if ( is_wp_error( $row ) ) {
			$errors[] = array(
				'entity'      => (string) $ref,
				'entity_type' => $entity_type,
				'error'       => $row->get_error_message(),
			);
			continue;
		}
		$loaded[ $row['entity_post']->ID ] = $row;
	}
	return array(
		'loaded' => $loaded,
		'errors' => $errors,
	);
}

/**
 * Every template that has saved work.
 *
 * @param array|null $refs Template IDs/slugs to restrict to, or null for all.
 * @return array{loaded:array,errors:array} Loaded rows keyed by template ID.
 */
function dbe_ability_load_templates( $refs = null ) {
	return dbe_ability_load_entities( $refs, 'template' );
}

/**
 * Handle dbe/status.
 *
 * @param array $input Ability input.
 * @return array Ability result.
 */
function dbe_ability_status( $input ) {
	$entity_type = dbe_ability_entity_type( $input['entity_type'] ?? 'template' );
	if ( is_wp_error( $entity_type ) ) {
		return $entity_type;
	}
	$refs    = ( isset( $input['template'] ) && '' !== trim( (string) $input['template'] ) )
		? array( $input['template'] )
		: null;
	$release = dbe_ability_resolve_release( $input['release'] ?? '' );
	if ( is_wp_error( $release ) ) {
		return $release;
	}

	// The published snapshot per entity lives in the release's DSM children;
	// comparing its stored config against the active commit's answers "is
	// the saved work live?" without any rendering.
	$dsm_by_name = array();
	if ( $release ) {
		$dsm_posts = get_posts(
			array(
				'post_type'   => 'builderius_dsm',
				'post_parent' => $release->ID,
				'post_status' => get_post_stati(),
				'numberposts' => -1,
			)
		);
		foreach ( $dsm_posts as $dsm ) {
			$dsm_by_name[ $dsm->post_name ] = $dsm;
		}
	}

	$result = dbe_ability_load_entities( $refs, $entity_type );
	$rows   = array();
	foreach ( $result['loaded'] as $entity_id => $row ) {
		$slug            = $row['entity_post']->post_name;
		$commit          = $row['commit'];
		$dsm             = $dsm_by_name[ $slug ] ?? null;
		$saved_config    = (string) get_post_meta( $commit->ID, 'content_config', true );
		$released_config = $dsm ? (string) get_post_meta( $dsm->ID, 'content_config', true ) : '';
		$saved_html      = (string) $commit->post_content;
		$released_html   = $dsm ? (string) $dsm->post_content : '';
		$saved_empty     = '' === trim( $saved_html );
		$released_empty  = $dsm && '' === trim( $released_html );
		$rows[]          = array(
			'template_id'                  => $entity_id,
			'entity_type'                  => $row['entity_type'],
			'entity_id'                    => $entity_id,
			'slug'                         => $slug,
			'title'                        => $row['entity_post']->post_title,
			'branch_id'                    => $row['branch']->ID,
			'saved_commit'                 => $commit->post_name,
			'saved_at'                     => $commit->post_date,
			'in_published_release'         => (bool) $dsm,
			'unpublished_changes'          => ! $dsm || md5( $saved_config ) !== md5( $released_config ),
			'saved_config_length'          => strlen( $saved_config ),
			'published_config_length'      => strlen( $released_config ),
			'saved_deliverable_length'     => strlen( $saved_html ),
			'published_deliverable_length' => strlen( $released_html ),
			'saved_deliverable_empty'      => $saved_empty,
			'published_deliverable_empty'  => $released_empty,
			'published_release_broken'     => (bool) ( $dsm && $released_empty ),
		);
	}

	return array(
		'published_release' => $release ? array(
			'id'      => $release->ID,
			'version' => $release->post_title,
			'date'    => $release->post_date,
		) : null,
		'templates'         => 'template' === $entity_type ? $rows : array(),
		'components'        => 'component' === $entity_type ? $rows : array(),
		'entities'          => $rows,
		'errors'            => $result['errors'],
	);
}

/**
 * Handle dbe/publish.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_publish( $input ) {
	$refs   = ( ! empty( $input['templates'] ) && is_array( $input['templates'] ) ) ? $input['templates'] : null;
	$result = dbe_ability_load_templates( $refs );
	if ( ! $result['loaded'] ) {
		return new WP_Error(
			'dbe_nothing_to_publish',
			'No template with saved work found.' . ( $result['errors'] ? ' ' . wp_json_encode( $result['errors'] ) : '' )
		);
	}
	if ( empty( $input['dry_run'] ) ) {
		foreach ( $result['loaded'] as $row ) {
			if ( function_exists( 'dbe_presence_precondition' ) ) {
				$presence = dbe_presence_precondition( $row['template_post']->post_name, ! empty( $input['force'] ) );
				if ( is_wp_error( $presence ) ) {
					return $presence;
				}
			}
		}
	}

	$version = isset( $input['version'] ) ? trim( (string) $input['version'] ) : '';
	if ( '' === $version ) {
		// Auto-bump: patch-increment the latest release's version when it
		// reads as semver, else start at 1.0.0.
		$latest = get_posts(
			array(
				'post_type'   => 'builderius_release',
				'post_status' => get_post_stati(),
				'numberposts' => 1,
				'orderby'     => 'date',
				'order'       => 'DESC',
			)
		);
		if ( $latest && preg_match( '/^(\d+)\.(\d+)\.(\d+)$/', $latest[0]->post_title, $m ) ) {
			$version = $m[1] . '.' . $m[2] . '.' . ( (int) $m[3] + 1 );
		} else {
			$version = '1.0.0';
		}
	}
	if ( strlen( $version ) > 64 || ! preg_match( '/^[A-Za-z0-9][A-Za-z0-9._-]*$/', $version ) ) {
		return new WP_Error( 'dbe_bad_release_version', 'The release version must be 1-64 letters, digits, dots, hyphens or underscores.' );
	}

	$entities = array();
	$ids      = array();
	foreach ( $result['loaded'] as $tid => $row ) {
		$ids[]      = array( 'id' => $tid );
		$entities[] = array(
			'template_id'  => $tid,
			'slug'         => $row['template_post']->post_name,
			'saved_commit' => $row['commit']->post_name,
		);
	}

	if ( ! empty( $input['dry_run'] ) ) {
		return array(
			'dry_run'  => true,
			'release'  => null,
			'version'  => $version,
			'entities' => $entities,
		);
	}

	$expected = array();
	foreach ( (array) ( $input['expected_commits'] ?? array() ) as $pair ) {
		if ( is_array( $pair ) && isset( $pair['template'], $pair['commit'] ) ) {
			$expected[ (string) $pair['template'] ] = trim( (string) $pair['commit'] );
		}
	}
	foreach ( $result['loaded'] as $tid => $row ) {
		$slug = $row['template_post']->post_name;
		$want = $expected[ $slug ] ?? $expected[ (string) $tid ] ?? '';
		$have = (string) $row['commit']->post_name;
		if ( '' === $want ) {
			return new WP_Error(
				'dbe_expected_commits_required',
				sprintf( 'Pass expected_commits for every template from the preceding dry run; %s is missing.', $slug )
			);
		}
		if ( $want !== $have ) {
			return new WP_Error(
				'dbe_commit_conflict',
				sprintf( 'Saved state changed for %s: expected commit %s, current commit %s. Run the publish dry run again.', $slug, $want, $have )
			);
		}
	}

	$description = isset( $input['description'] ) ? substr( (string) $input['description'], 0, 500 ) : 'Published via dbe/publish';
	$mutation    = 'mutation DbeCreateRelease($input: BuilderiusCreateReleaseInput!) {'
		. ' createRelease(input: $input) { release { id version status } }'
		. ' }';
	$data        = dbe_ability_graphql(
		'dbePublish',
		$mutation,
		array(
			'input' => array(
				'version'                  => $version,
				'tags'                     => array(),
				'description'              => $description,
				'serialized_entities_data' => wp_json_encode( $ids ),
				'publish'                  => true,
			),
		)
	);
	if ( is_wp_error( $data ) ) {
		return $data;
	}
	$release = $data['createRelease']['release'] ?? null;
	if ( ! $release ) {
		return new WP_Error( 'dbe_publish_failed', 'createRelease returned no release.' );
	}

	return array(
		'dry_run'  => false,
		'release'  => $release,
		'version'  => $version,
		'entities' => $entities,
	);
}

/**
 * Slugs of every current Builderius development entity, grouped the way
 * extraction treats them: it deletes all three groups before recreating
 * entities from the release.
 *
 * @return array{templates:array,components:array,settings_sets:array}
 */
function dbe_ability_dev_entity_slugs() {
	$groups = array();
	foreach ( array(
		'templates'     => 'builderius_template',
		'components'    => 'builderius_component',
		'settings_sets' => 'builderius_sett_set',
	) as $key => $post_type ) {
		$groups[ $key ] = array_map(
			static function ( $post ) {
				return $post->post_name;
			},
			get_posts(
				array(
					'post_type'   => $post_type,
					'post_status' => get_post_stati(),
					'numberposts' => -1,
					'orderby'     => 'title',
					'order'       => 'ASC',
				)
			)
		);
	}
	return $groups;
}

/**
 * Handle dbe/extract-release.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_extract_release( $input ) {
	$release = dbe_ability_resolve_release( $input['release'] ?? '' );
	if ( is_wp_error( $release ) ) {
		return $release;
	}
	if ( ! $release ) {
		return new WP_Error( 'dbe_no_release', 'This site has no Builderius release to extract. Publish one first with dbe/publish.' );
	}

	// The release's bundled entities live in its DSM children; each DSM's
	// entity typing is JSON in the post excerpt.
	$contains  = array();
	$dsm_posts = get_posts(
		array(
			'post_type'   => 'builderius_dsm',
			'post_parent' => $release->ID,
			'post_status' => get_post_stati(),
			'numberposts' => -1,
			'orderby'     => 'title',
			'order'       => 'ASC',
		)
	);
	foreach ( $dsm_posts as $dsm ) {
		$excerpt    = json_decode( (string) $dsm->post_excerpt, true );
		$contains[] = array(
			'slug'        => $dsm->post_name,
			'name'        => $dsm->post_title,
			'entity_type' => is_array( $excerpt ) ? (string) ( $excerpt['entity_type'] ?? '' ) : '',
			'type'        => is_array( $excerpt ) ? (string) ( $excerpt['type'] ?? '' ) : '',
		);
	}

	$report = array(
		'release'  => array(
			'id'      => $release->ID,
			'version' => $release->post_title,
			'date'    => $release->post_date,
		),
		'contains' => $contains,
		'replaces' => dbe_ability_dev_entity_slugs(),
	);

	if ( ! empty( $input['dry_run'] ) ) {
		$report['dry_run']   = true;
		$report['extracted'] = false;
		$report['after']     = null;
		return $report;
	}
	if ( true !== ( $input['confirm'] ?? false ) ) {
		return new WP_Error(
			'dbe_confirm_required',
			'Extraction deletes every template, component and global settings set (commit history included) and rebuilds them from the release. Confirm with the user, then pass confirm: true.'
		);
	}
	if ( function_exists( 'dbe_presence_precondition' ) ) {
		foreach ( $report['replaces']['templates'] as $slug ) {
			$presence = dbe_presence_precondition( $slug, ! empty( $input['force'] ) );
			if ( is_wp_error( $presence ) ) {
				return $presence;
			}
		}
	}

	$data = dbe_ability_graphql(
		'dbeExtractRelease',
		'mutation DbeExtractRelease($id: Int!) { extractRelease(id: $id) { result message } }',
		array( 'id' => (int) $release->ID )
	);
	if ( is_wp_error( $data ) ) {
		return $data;
	}
	$outcome = $data['extractRelease'] ?? array();
	if ( empty( $outcome['result'] ) ) {
		return new WP_Error(
			'dbe_extract_failed',
			'extractRelease reported failure' . ( empty( $outcome['message'] ) ? '.' : ': ' . $outcome['message'] )
		);
	}

	$report['dry_run']   = false;
	$report['extracted'] = true;
	$report['message']   = (string) ( $outcome['message'] ?? '' );
	$report['after']     = dbe_ability_dev_entity_slugs();
	return $report;
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
