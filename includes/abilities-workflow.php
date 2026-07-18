<?php
/**
 * Agent-facing workflow abilities (PROTOTYPE).
 *
 * Broader headless-workflow gaps found while stress-testing the dynamic-data
 * abilities (see MILESTONE-dynamic-data-ai.md):
 *
 *  - dbe/duplicate-template     copy a template (content, entity CSS, data
 *                               variables, JS snippets) as an isolated,
 *                               disabled working copy
 *  - dbe/duplicate-component    copy a component definition, declared
 *                               properties included
 *  - dbe/list-settings-sets     enumerate the global settings sets so global
 *                               CSS work does not need a known reference
 *  - dbe/validate-js-snippet    structural syntax check for a snippet
 *                               without saving or executing it
 *  - dbe/manage-visibility-condition  read/set/clear an element's rendering
 *                               conditions, which subtree HTML preserves but
 *                               cannot express
 *  - dbe/manage-settings-set    read and update the global settings set's
 *                               non-CSS settings (breakpoints, responsive
 *                               strategy, fonts)
 *
 * Everything here builds on the saved-state helpers in abilities.php (loaded
 * first) and saves through Builderius' own GraphQL mutations, so the same
 * commit bookkeeping, events and cache flushes run as for a builder save.
 *
 * @package Daveden_Builder_Enhancements
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_abilities_api_init', 'dbe_register_workflow_abilities' );

/**
 * Register the workflow abilities.
 */
function dbe_register_workflow_abilities() {
	dbe_register_ability(
		'dbe/duplicate-template',
		array(
			'label'               => __( 'Duplicate a template', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Creates an isolated working copy of a Builderius template from its saved state: the module tree, entity CSS, entity-scoped data variables and JS snippets all ride along in the copied config. The copy is created DISABLED and without apply rules by default so it can never shadow the original on the front end — pass enabled: true and copy_apply_rules: true only when a live twin is genuinely wanted. Page-bound templates are duplicated as regular templates (a WordPress page can only bind one page template); hook templates keep their hook wiring. The copy starts a fresh commit history.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'         => array(
						'type'        => 'string',
						'description' => __( 'Source template post ID or slug.', 'daveden-builderius-enhancements' ),
					),
					'title'            => array(
						'type'        => 'string',
						'description' => __( 'Title for the copy. Defaults to "<source title> copy".', 'daveden-builderius-enhancements' ),
					),
					'name'             => array(
						'type'        => 'string',
						'description' => __( 'Slug for the copy. Defaults to WordPress\' unique slug for the title.', 'daveden-builderius-enhancements' ),
					),
					'enabled'          => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Enable the copy immediately. Default false: a duplicate that is live from birth can conflict with the original.', 'daveden-builderius-enhancements' ),
					),
					'copy_apply_rules' => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Copy the source\'s apply rules onto the duplicate. Default false so the copy applies nowhere until deliberately targeted.', 'daveden-builderius-enhancements' ),
					),
				),
				'required'             => array( 'template' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'template'    => array(
						'type'        => 'object',
						'description' => __( 'The duplicate\'s summary (id, slug, title, enabled, type, apply_rules, branch, commit).', 'daveden-builderius-enhancements' ),
					),
					'source'      => array(
						'type'        => 'object',
						'description' => __( 'The source template (id, slug) and the commit the content was copied from.', 'daveden-builderius-enhancements' ),
					),
					'commit_name' => array( 'type' => 'string' ),
					'notes'       => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_duplicate_template',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/duplicate-component',
		array(
			'label'               => __( 'Duplicate a component', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Creates a copy of a Builderius component definition from its saved state: the internal module tree, declared properties (and their derived props variable), entity CSS and entity-scoped data variables all ride along. The copy gets a fresh slug and commit history; existing instances keep pointing at the source component. Use this to fork a shared component before an experiment instead of editing the shared original in place.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'component' => array(
						'type'        => 'string',
						'description' => __( 'Source component post ID or slug.', 'daveden-builderius-enhancements' ),
					),
					'title'     => array(
						'type'        => 'string',
						'description' => __( 'Title for the copy. Defaults to "<source title> copy".', 'daveden-builderius-enhancements' ),
					),
					'name'      => array(
						'type'        => 'string',
						'description' => __( 'Slug for the copy. Defaults to WordPress\' unique slug for the title.', 'daveden-builderius-enhancements' ),
					),
				),
				'required'             => array( 'component' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'component'   => array(
						'type'        => 'object',
						'description' => __( 'The duplicate\'s summary (id, slug, title, props, branch, commit).', 'daveden-builderius-enhancements' ),
					),
					'source'      => array(
						'type'        => 'object',
						'description' => __( 'The source component (id, slug) and the commit the content was copied from.', 'daveden-builderius-enhancements' ),
					),
					'commit_name' => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => 'dbe_ability_duplicate_component',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/list-settings-sets',
		array(
			'label'               => __( 'List global settings sets', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Enumerates the site\'s Builderius global settings sets — the entities that carry the framework CSS, global data variables and global JS snippets. Most sites have exactly one; when several exist, the global CSS and data-variable abilities need a settings_set reference, and this ability is how an agent discovers the right one. Each row reports the set\'s identity, saved commit (for the expected_commit save flow), stylesheet size, named CSS blocks, and how many global data variables and JS snippets it holds.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'settings_sets' => array(
						'type'        => 'array',
						'description' => __( 'Per set: id, slug, title, technology, branch_id, commit_name, css_length, css_blocks, data_variables, js_snippets.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_list_settings_sets',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/validate-js-snippet',
		array(
			'label'               => __( 'Validate a JS snippet', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Structurally validates JavaScript before it is saved with dbe/manage-js-snippet: unbalanced brackets/braces/parentheses, unterminated strings, template literals, comments and regular expressions, and stray HTML are reported with line numbers. This is a structural scan, not a full ECMAScript parse — code that passes can still contain runtime or semantic errors, so treat a pass as "safe to save", not "proven correct". Nothing is saved or executed.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'code' => array(
						'type'        => 'string',
						'description' => __( 'The JavaScript source to check.', 'daveden-builderius-enhancements' ),
					),
				),
				'required'             => array( 'code' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'valid'  => array( 'type' => 'boolean' ),
					'errors' => array(
						'type'        => 'array',
						'description' => __( 'Structural problems found, each with a message and line number.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
					'checks' => array(
						'type'        => 'string',
						'description' => __( 'The level of validation performed (structural).', 'daveden-builderius-enhancements' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_validate_js_snippet',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/manage-visibility-condition',
		array(
			'label'               => __( 'Manage an element\'s rendering conditions', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Reads, sets or clears one element\'s rendering (visibility) conditions in the saved state — the setting dbe/apply-subtree-html preserves through data-dbe-id markers but cannot express in HTML. Conditions are OR-of-AND groups: pass groups as an array of arrays, each inner array a set of AND-ed rules { name, operator, value } and the outer array OR-ed — e.g. [[{"name":"user_logged_in","operator":"is","value":"true"}]] shows the element to logged-in users only. Rule names and operators are validated against Builderius\' installed rendering-condition registry (post_type, user_role, url_parameter, is_front_page, dynamic_data, expression, …). Conditions that read the wp system variable (post_type, post_meta, user_role, …) need matching fields in the wp query — the result warns when they look absent, because the builder maintains those automatically and this channel cannot; always prove the element with dbe/check-rendered-output afterwards. Alternatively pass expression for a raw Twig-style condition string. Use action: get first to read the current shape; set replaces the whole condition; clear removes it (the element always renders).', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'        => array(
						'type'        => 'string',
						'description' => __( 'Template or component post ID or slug.', 'daveden-builderius-enhancements' ),
					),
					'entity_type'     => array(
						'type'        => 'string',
						'enum'        => array( 'template', 'component' ),
						'default'     => 'template',
						'description' => __( 'Entity type of the template reference.', 'daveden-builderius-enhancements' ),
					),
					'module_id'       => array(
						'type'        => 'string',
						'description' => __( 'The element\'s module ID (find it with dbe/get-tree-outline).', 'daveden-builderius-enhancements' ),
					),
					'action'          => array(
						'type'        => 'string',
						'enum'        => array( 'get', 'set', 'clear' ),
						'description' => __( 'get reads, set replaces, clear removes the condition.', 'daveden-builderius-enhancements' ),
					),
					'groups'          => array(
						'type'        => 'array',
						'description' => __( 'For set: OR-ed groups, each an array of AND-ed rules { name, operator, value }. Omit value only for is_empty/is_not_empty operators.', 'daveden-builderius-enhancements' ),
						'items'       => array(
							'type'  => 'array',
							'items' => array(
								'type'                 => 'object',
								'properties'           => array(
									'name'     => array( 'type' => 'string' ),
									'operator' => array( 'type' => 'string' ),
									'value'    => array(
										'description' => __( 'The comparison value. key_value widgets (post_meta, user_meta, url_parameter, cookie) take "key:value" strings.', 'daveden-builderius-enhancements' ),
									),
								),
								'required'             => array( 'name' ),
								'additionalProperties' => false,
							),
						),
					),
					'expression'      => array(
						'type'        => 'string',
						'description' => __( 'For set: a raw condition expression string instead of groups (stored verbatim, evaluated by Builderius\' expression engine).', 'daveden-builderius-enhancements' ),
					),
					'dry_run'         => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview the condition value that WOULD be saved without committing.', 'daveden-builderius-enhancements' ),
					),
					'expected_commit' => array(
						'type'        => 'string',
						'description' => __( 'The active commit name from the preceding read. Required when saving.', 'daveden-builderius-enhancements' ),
					),
					'force'           => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Explicitly override a dirty Builderius-tab conflict.', 'daveden-builderius-enhancements' ),
					),
				),
				'required'             => array( 'template', 'module_id', 'action' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'action'      => array( 'type' => 'string' ),
					'condition'   => array(
						'description' => __( 'The condition value (current for get, resulting for set/clear).', 'daveden-builderius-enhancements' ),
					),
					'warnings'    => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
					'dry_run'     => array( 'type' => 'boolean' ),
					'commit_name' => array( 'type' => 'string' ),
					'base_commit' => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => 'dbe_ability_manage_visibility_condition',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/manage-settings-set',
		array(
			'label'               => __( 'Manage a global settings set', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Reads or updates the global settings set\'s non-CSS settings: the responsive strategy (desktop-first/mobile-first), the named breakpoints behind @media (--tablet)-style queries, and the font declarations. Builderius creates exactly one set per technology automatically, so there is no create or delete — use dbe/list-settings-sets to discover the sets and dbe/get-global-css / dbe/patch-global-css for the stylesheet itself. Changing breakpoints affects EVERY template\'s responsive CSS; changing the responsive strategy flips which direction the breakpoint media queries cascade — treat both as site-wide design decisions, read first with action: get, and save with the expected_commit flow.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'settings_set'        => array(
						'type'        => 'string',
						'description' => __( 'Global settings set post ID or slug. Omit when the site has one (the usual case).', 'daveden-builderius-enhancements' ),
					),
					'action'              => array(
						'type'        => 'string',
						'enum'        => array( 'get', 'update' ),
						'description' => __( 'get reads the settings; update writes the passed fields as a new commit.', 'daveden-builderius-enhancements' ),
					),
					'responsive_strategy' => array(
						'type'        => 'string',
						'enum'        => array( 'desktop-first', 'mobile-first' ),
						'description' => __( 'For update: the responsive strategy.', 'daveden-builderius-enhancements' ),
					),
					'breakpoints'         => array(
						'type'        => 'array',
						'description' => __( 'For update: the COMPLETE breakpoints list, replacing the current one. Each: { name: "--tablet", label, width, width_builder?, icon?, deletable? }.', 'daveden-builderius-enhancements' ),
						'items'       => array(
							'type'                 => 'object',
							'properties'           => array(
								'name'          => array( 'type' => 'string' ),
								'label'         => array( 'type' => 'string' ),
								'width'         => array( 'type' => 'integer' ),
								'width_builder' => array( 'type' => 'integer' ),
								'icon'          => array( 'type' => 'string' ),
								'deletable'     => array( 'type' => 'boolean' ),
							),
							'required'             => array( 'name', 'label', 'width' ),
							'additionalProperties' => false,
						),
					),
					'fonts'               => array(
						'type'        => 'array',
						'description' => __( 'For update: the COMPLETE font declarations list, replacing the current one. Each: { type, content }.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
					'dry_run'             => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview the resulting settings without committing.', 'daveden-builderius-enhancements' ),
					),
					'expected_commit'     => array(
						'type'        => 'string',
						'description' => __( 'The active commit name from the preceding get. Required when saving.', 'daveden-builderius-enhancements' ),
					),
					'force'               => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Explicitly override a dirty Builderius-tab conflict.', 'daveden-builderius-enhancements' ),
					),
				),
				'required'             => array( 'action' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'settings_set'        => array(
						'type'        => 'object',
						'description' => __( 'Identity: id, slug, title, technology.', 'daveden-builderius-enhancements' ),
					),
					'responsive_strategy' => array( 'type' => 'string' ),
					'breakpoints'         => array(
						'type'  => 'array',
						'items' => array( 'type' => 'object' ),
					),
					'fonts'               => array(
						'type'  => 'array',
						'items' => array( 'type' => 'object' ),
					),
					'css_length'          => array( 'type' => 'integer' ),
					'data_variables'      => array( 'type' => 'integer' ),
					'js_snippets'         => array( 'type' => 'integer' ),
					'dry_run'             => array( 'type' => 'boolean' ),
					'commit_name'         => array( 'type' => 'string' ),
					'base_commit'         => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => 'dbe_ability_manage_settings_set',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);
}

/*
 * ----------------------------------------------------------------------
 *  Duplication
 * ----------------------------------------------------------------------
 */

/**
 * Commit a config onto a branch this request just created. The branch cannot
 * have concurrent writers yet, so unlike dbe_ability_create_commit this
 * resolves the head itself and also handles the empty-branch first commit.
 *
 * @param int    $branch_id   Builderius branch post ID.
 * @param array  $config      Complete Builderius content config.
 * @param string $description Commit description.
 * @return string|WP_Error The new commit name.
 */
function dbe_ability_commit_fresh_branch( $branch_id, $config, $description ) {
	$json = wp_json_encode( $config, JSON_UNESCAPED_UNICODE );
	if ( false === $json ) {
		return new WP_Error( 'dbe_encode_failed', 'Could not encode the content config.' );
	}
	$lock = dbe_ability_acquire_branch_lock( $branch_id );
	if ( is_wp_error( $lock ) ) {
		return $lock;
	}
	try {
		$mutation = 'mutation DbeCreateCommit($input: BuilderiusCreateCommitInput!, $autopublish: Boolean!) {'
			. ' createCommit(input: $input, autopublish: $autopublish) { commit { name } }'
			. ' }';
		$data     = dbe_ability_graphql(
			'dbeDuplicateEntity',
			$mutation,
			array(
				'input'       => array(
					'branch_id'                 => (int) $branch_id,
					'serialized_content_config' => $json,
					'description'               => substr( (string) $description, 0, 500 ),
				),
				'autopublish' => false,
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

/**
 * Re-key every module id in a config — Builderius' own duplicate resolvers
 * do the same, because module ids become .uni-node-<id> CSS selectors and
 * two entities sharing ids would cross-style if they ever co-rendered.
 *
 * @param array $config The source content config.
 * @return array The config with fresh module ids, parents and indexes.
 */
function dbe_ability_rekey_config( $config ) {
	$modules = (array) ( $config['modules'] ?? array() );
	$map     = array();
	foreach ( array_keys( $modules ) as $old_id ) {
		$map[ $old_id ] = dbe_ability_make_id( array_flip( $map ) );
	}

	$new_modules = array();
	foreach ( $modules as $old_id => $module ) {
		$module['id'] = $map[ $old_id ];
		$parent       = (string) ( $module['parent'] ?? '' );
		if ( '' !== $parent && isset( $map[ $parent ] ) ) {
			$module['parent'] = $map[ $parent ];
		}
		$new_modules[ $map[ $old_id ] ] = $module;
	}

	$new_indexes = array();
	foreach ( (array) ( $config['indexes'] ?? array() ) as $key => $children ) {
		$new_key                 = isset( $map[ $key ] ) ? $map[ $key ] : $key;
		$new_indexes[ $new_key ] = array_values(
			array_map(
				static function ( $child ) use ( $map ) {
					return isset( $map[ $child ] ) ? $map[ $child ] : $child;
				},
				(array) $children
			)
		);
	}

	$config['modules'] = $new_modules;
	$config['indexes'] = $new_indexes;
	return $config;
}

/**
 * Copy a source entity's saved config onto a freshly created entity.
 *
 * @param WP_Post $new_post    The just-created entity post.
 * @param array   $config      The source entity's saved content config.
 * @param string  $description Commit description.
 * @return string|WP_Error The new commit name.
 */
function dbe_ability_copy_config_to( $new_post, $config, $description ) {
	$config   = dbe_ability_rekey_config( $config );
	$resolved = dbe_ability_resolve_commit( $new_post );
	if ( is_wp_error( $resolved ) && 'dbe_no_commit' !== $resolved->get_error_code() ) {
		return $resolved;
	}

	if ( is_wp_error( $resolved ) ) {
		// Empty branch: find it directly for the first commit.
		$branches = get_posts(
			array(
				'post_type'   => 'builderius_branch',
				'post_parent' => $new_post->ID,
				'post_status' => get_post_stati(),
				'numberposts' => 1,
				'orderby'     => 'ID',
				'order'       => 'ASC',
			)
		);
		if ( ! $branches ) {
			return new WP_Error( 'dbe_no_branch', 'The new entity has no branch to commit onto.' );
		}
		$branch_id = (int) $branches[0]->ID;
	} else {
		$branch_id = (int) $resolved['branch']->ID;
	}

	if ( isset( $config['template'] ) && is_array( $config['template'] ) ) {
		$config['template']['id'] = (int) $new_post->ID;
	}

	return dbe_ability_commit_fresh_branch( $branch_id, $config, $description );
}

/**
 * Handle dbe/duplicate-template.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_duplicate_template( $input ) {
	$source = dbe_ability_find_entity_post( (string) ( $input['template'] ?? '' ), 'template' );
	if ( is_wp_error( $source ) ) {
		return $source;
	}
	$resolved = dbe_ability_resolve_commit( $source );
	if ( is_wp_error( $resolved ) ) {
		return $resolved;
	}
	$summary = dbe_ability_template_summary( $source );
	$notes   = array();

	$title = trim( (string) ( $input['title'] ?? '' ) );
	if ( '' === $title ) {
		/* translators: %s: source item title. */
		$title = sprintf( __( '%s copy', 'daveden-builderius-enhancements' ), $source->post_title );
	}

	$type = $summary['type'];
	if ( 'page' === $type ) {
		// A WordPress page binds exactly one page template, so a live page
		// duplicate is impossible by construction — copy as a regular template.
		$type    = 'regular';
		$notes[] = 'The source is a page-bound template; the duplicate was created as a regular template with no page binding.';
	}

	$create = array(
		'title'      => $title,
		'type'       => $type,
		'technology' => '' !== $summary['technology'] ? $summary['technology'] : 'html',
		'enabled'    => ! empty( $input['enabled'] ),
		'sort_order' => $summary['sort_order'],
	);
	if ( ! empty( $input['name'] ) ) {
		$create['name'] = (string) $input['name'];
	}
	if ( 'hook' === $type && is_array( $summary['hook'] ) ) {
		$create['hook']               = $summary['hook']['hook'];
		$create['hook_type']          = $summary['hook']['hook_type'];
		$create['hook_accepted_args'] = $summary['hook']['hook_accepted_args'];
	}
	if ( ! empty( $input['copy_apply_rules'] ) && is_array( $summary['apply_rules'] ) ) {
		$create['apply_rules'] = $summary['apply_rules'];
	} elseif ( is_array( $summary['apply_rules'] ) ) {
		$notes[] = 'Apply rules were NOT copied — the duplicate applies nowhere until dbe/update-template targets it (pass copy_apply_rules: true to copy them).';
	}

	$created = dbe_ability_create_template( $create );
	if ( is_wp_error( $created ) ) {
		return $created;
	}
	$new_post = get_post( (int) $created['template']['id'] );
	if ( ! $new_post ) {
		return new WP_Error( 'dbe_create_failed', 'The duplicate template could not be reloaded after creation.' );
	}

	$commit_name = dbe_ability_copy_config_to(
		$new_post,
		$resolved['config'],
		sprintf( 'Duplicate of "%s" (%s) via dbe/duplicate-template', $source->post_name, $resolved['commit']->post_name )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	clean_post_cache( $new_post->ID );
	return array(
		'template'    => dbe_ability_template_summary( get_post( $new_post->ID ) ),
		'source'      => array(
			'id'          => (int) $source->ID,
			'slug'        => (string) $source->post_name,
			'commit_name' => (string) $resolved['commit']->post_name,
		),
		'commit_name' => $commit_name,
		'notes'       => $notes,
	);
}

/**
 * Handle dbe/duplicate-component.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_duplicate_component( $input ) {
	$source = dbe_ability_find_entity_post( (string) ( $input['component'] ?? '' ), 'component' );
	if ( is_wp_error( $source ) ) {
		return $source;
	}
	$resolved = dbe_ability_resolve_commit( $source );
	if ( is_wp_error( $resolved ) ) {
		return $resolved;
	}

	$title = trim( (string) ( $input['title'] ?? '' ) );
	if ( '' === $title ) {
		/* translators: %s: source item title. */
		$title = sprintf( __( '%s copy', 'daveden-builderius-enhancements' ), $source->post_title );
	}

	$technologies = wp_get_object_terms( $source->ID, 'builderius_template_technology', array( 'fields' => 'slugs' ) );
	$gql_input    = array(
		'title'      => $title,
		'technology' => ! is_wp_error( $technologies ) && $technologies ? (string) $technologies[0] : 'html',
	);
	if ( ! empty( $input['name'] ) ) {
		$gql_input['name'] = (string) $input['name'];
	}

	$mutation = 'mutation DbeCreateComponent($input: BuilderiusCreateComponentInput!) {'
		. ' createComponent(input: $input) { component { id name title } }'
		. ' }';
	$data     = dbe_ability_graphql( 'dbeDuplicateComponent', $mutation, array( 'input' => $gql_input ) );
	if ( is_wp_error( $data ) ) {
		return $data;
	}
	$component_id = (int) ( $data['createComponent']['component']['id'] ?? 0 );
	if ( ! $component_id ) {
		return new WP_Error( 'dbe_create_failed', 'createComponent returned no component.' );
	}
	$new_post = get_post( $component_id );

	$commit_name = dbe_ability_copy_config_to(
		$new_post,
		$resolved['config'],
		sprintf( 'Duplicate of "%s" (%s) via dbe/duplicate-component', $source->post_name, $resolved['commit']->post_name )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	clean_post_cache( $component_id );
	return array(
		'component'   => dbe_ability_component_summary( get_post( $component_id ) ),
		'source'      => array(
			'id'          => (int) $source->ID,
			'slug'        => (string) $source->post_name,
			'commit_name' => (string) $resolved['commit']->post_name,
		),
		'commit_name' => $commit_name,
	);
}

/*
 * ----------------------------------------------------------------------
 *  Settings-set discovery
 * ----------------------------------------------------------------------
 */

/**
 * Handle dbe/list-settings-sets.
 *
 * @return array|WP_Error Ability result.
 */
function dbe_ability_list_settings_sets() {
	$posts = get_posts(
		array(
			'post_type'   => 'builderius_sett_set',
			'post_status' => get_post_stati(),
			'numberposts' => -1,
			'orderby'     => 'ID',
			'order'       => 'ASC',
		)
	);

	$rows = array();
	foreach ( $posts as $post ) {
		$technologies = wp_get_object_terms( $post->ID, 'builderius_template_technology', array( 'fields' => 'slugs' ) );

		$row = array(
			'id'             => (int) $post->ID,
			'slug'           => (string) $post->post_name,
			'title'          => (string) $post->post_title,
			'technology'     => ! is_wp_error( $technologies ) && $technologies ? (string) $technologies[0] : '',
			'branch_id'      => null,
			'commit_name'    => null,
			'css_length'     => null,
			'css_blocks'     => array(),
			'data_variables' => 0,
			'js_snippets'    => 0,
		);

		$resolved = dbe_ability_resolve_commit( $post );
		if ( ! is_wp_error( $resolved ) ) {
			$row['branch_id']   = (int) $resolved['branch']->ID;
			$row['commit_name'] = (string) $resolved['commit']->post_name;
			foreach ( (array) ( $resolved['config']['template']['settings'] ?? array() ) as $s ) {
				$setting_name = $s['name'] ?? '';
				if ( 'css' === $setting_name ) {
					$css               = (string) ( $s['value'] ?? '' );
					$row['css_length'] = strlen( $css );
					$blocks            = dbe_ability_css_blocks( $css );
					if ( ! is_wp_error( $blocks ) ) {
						$row['css_blocks'] = array_values( wp_list_pluck( $blocks, 'name' ) );
					}
				} elseif ( 'dataVars' === $setting_name && is_array( $s['value'] ?? null ) ) {
					$row['data_variables'] = count( $s['value'] );
				} elseif ( 'customJs' === $setting_name && is_array( $s['value'] ?? null ) ) {
					$row['js_snippets'] = count( $s['value'] );
				}
			}
		}

		$rows[] = $row;
	}

	return array( 'settings_sets' => $rows );
}

/*
 * ----------------------------------------------------------------------
 *  JS snippet structural validation
 * ----------------------------------------------------------------------
 */

/**
 * Structurally scan JavaScript for the failure modes that actually reach
 * saved snippets: unbalanced delimiters, unterminated strings/templates/
 * comments/regexes, and pasted HTML. A deliberately small tokenizer, not an
 * ECMAScript parser — semantic errors pass through.
 *
 * @param string $code JavaScript source.
 * @return array<int,array{message:string,line:int}> Structural errors.
 */
function dbe_ability_js_structure_errors( $code ) {
	$errors = array();
	$len    = strlen( $code );
	$line   = 1;
	$stack  = array(); // Open delimiters: { ( [ and template-literal ${.
	$pairs  = array(
		'}' => '{',
		')' => '(',
		']' => '[',
	);

	// The last significant character decides whether a / starts a regex
	// (after operators/keywords) or is division (after values).
	$prev_significant = '';
	$regex_ok_words   = array( 'return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'instanceof', 'do', 'else', 'yield', 'await', 'throw' );

	if ( preg_match( '/^\s*</', $code ) ) {
		$errors[] = array(
			'message' => 'The code starts with "<" — this looks like HTML, not JavaScript. Snippets take raw JavaScript with no <script> wrapper.',
			'line'    => 1,
		);
	}

	$i = 0;
	while ( $i < $len ) {
		$c = $code[ $i ];

		if ( "\n" === $c ) {
			++$line;
			++$i;
			continue;
		}
		if ( ' ' === $c || "\t" === $c || "\r" === $c ) {
			++$i;
			continue;
		}

		// Comments.
		if ( '/' === $c && $i + 1 < $len && '/' === $code[ $i + 1 ] ) {
			$next = strpos( $code, "\n", $i );
			$i    = false === $next ? $len : $next;
			continue;
		}
		if ( '/' === $c && $i + 1 < $len && '*' === $code[ $i + 1 ] ) {
			$end = strpos( $code, '*/', $i + 2 );
			if ( false === $end ) {
				$errors[] = array(
					'message' => 'Unterminated /* comment.',
					'line'    => $line,
				);
				break;
			}
			$line += substr_count( $code, "\n", $i, $end - $i );
			$i     = $end + 2;
			continue;
		}

		// Strings.
		if ( '"' === $c || "'" === $c ) {
			$start_line = $line;
			$j          = $i + 1;
			$closed     = false;
			while ( $j < $len ) {
				if ( '\\' === $code[ $j ] ) {
					$j += 2;
					continue;
				}
				if ( $code[ $j ] === $c ) {
					$closed = true;
					break;
				}
				if ( "\n" === $code[ $j ] ) {
					break; // Plain strings cannot span lines unescaped.
				}
				++$j;
			}
			if ( ! $closed ) {
				$errors[] = array(
					'message' => sprintf( 'Unterminated %s string.', '"' === $c ? 'double-quoted' : 'single-quoted' ),
					'line'    => $start_line,
				);
				break;
			}
			$i                = $j + 1;
			$prev_significant = '"';
			continue;
		}

		// Template literals — track ${ } nesting through the shared stack.
		if ( '`' === $c ) {
			$start_line = $line;
			$j          = $i + 1;
			$closed     = false;
			while ( $j < $len ) {
				if ( '\\' === $code[ $j ] ) {
					$j += 2;
					continue;
				}
				if ( "\n" === $code[ $j ] ) {
					++$line;
					++$j;
					continue;
				}
				if ( '$' === $code[ $j ] && $j + 1 < $len && '{' === $code[ $j + 1 ] ) {
					// Re-enter code context inside the placeholder.
					$stack[] = array(
						'char' => '${',
						'line' => $line,
					);
					$i       = $j + 2;
					continue 2;
				}
				if ( '`' === $code[ $j ] ) {
					$closed = true;
					break;
				}
				++$j;
			}
			if ( ! $closed ) {
				$errors[] = array(
					'message' => 'Unterminated template literal.',
					'line'    => $start_line,
				);
				break;
			}
			$i                = $j + 1;
			$prev_significant = '"';
			continue;
		}

		// Regex literal vs division.
		if ( '/' === $c ) {
			$is_regex = '' === $prev_significant || false !== strpos( '(=,:;!&|?{}[+-*%^~<>', $prev_significant );
			if ( ! $is_regex ) {
				// …or after a keyword such as return.
				if ( preg_match( '/([A-Za-z_$][A-Za-z0-9_$]*)\s*$/', substr( $code, max( 0, $i - 32 ), min( 32, $i ) ), $m ) ) {
					$is_regex = in_array( $m[1], $regex_ok_words, true );
				}
			}
			if ( $is_regex ) {
				$start_line = $line;
				$j          = $i + 1;
				$in_class   = false;
				$closed     = false;
				while ( $j < $len ) {
					$rc = $code[ $j ];
					if ( '\\' === $rc ) {
						$j += 2;
						continue;
					}
					if ( "\n" === $rc ) {
						break;
					}
					if ( '[' === $rc ) {
						$in_class = true;
					} elseif ( ']' === $rc ) {
						$in_class = false;
					} elseif ( '/' === $rc && ! $in_class ) {
						$closed = true;
						break;
					}
					++$j;
				}
				if ( ! $closed ) {
					$errors[] = array(
						'message' => 'Unterminated regular expression literal.',
						'line'    => $start_line,
					);
					break;
				}
				$i                = $j + 1;
				$prev_significant = '"';
				continue;
			}
			$prev_significant = '/';
			++$i;
			continue;
		}

		if ( '{' === $c || '(' === $c || '[' === $c ) {
			$stack[]          = array(
				'char' => $c,
				'line' => $line,
			);
			$prev_significant = $c;
			++$i;
			continue;
		}
		if ( isset( $pairs[ $c ] ) ) {
			$top = array_pop( $stack );
			if ( null === $top ) {
				$errors[] = array(
					'message' => sprintf( 'Unexpected "%s" with no matching opener.', $c ),
					'line'    => $line,
				);
				break;
			}
			if ( '}' === $c && '${' === $top['char'] ) {
				// The placeholder's closing brace resumes the template literal.
				// Rescan from here as template text by re-entering literal mode.
				$j          = $i + 1;
				$closed     = false;
				$start_line = $line;
				while ( $j < $len ) {
					if ( '\\' === $code[ $j ] ) {
						$j += 2;
						continue;
					}
					if ( "\n" === $code[ $j ] ) {
						++$line;
						++$j;
						continue;
					}
					if ( '$' === $code[ $j ] && $j + 1 < $len && '{' === $code[ $j + 1 ] ) {
						$stack[] = array(
							'char' => '${',
							'line' => $line,
						);
						$i       = $j + 2;
						continue 2;
					}
					if ( '`' === $code[ $j ] ) {
						$closed = true;
						break;
					}
					++$j;
				}
				if ( ! $closed ) {
					$errors[] = array(
						'message' => 'Unterminated template literal.',
						'line'    => $start_line,
					);
					break;
				}
				$i                = $j + 1;
				$prev_significant = '"';
				continue;
			}
			if ( $pairs[ $c ] !== $top['char'] ) {
				$errors[] = array(
					'message' => sprintf( 'Mismatched "%s" — the closest unclosed opener is "%s" from line %d.', $c, $top['char'], $top['line'] ),
					'line'    => $line,
				);
				break;
			}
			$prev_significant = $c;
			++$i;
			continue;
		}

		$prev_significant = $c;
		++$i;
	}

	if ( array() === $errors ) {
		foreach ( $stack as $open ) {
			$errors[] = array(
				'message' => sprintf( 'Unclosed "%s".', '${' === $open['char'] ? '${ template placeholder' : $open['char'] ),
				'line'    => $open['line'],
			);
		}
	}

	return $errors;
}

/**
 * Handle dbe/validate-js-snippet.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_validate_js_snippet( $input ) {
	$code = (string) ( $input['code'] ?? '' );
	if ( '' === trim( $code ) ) {
		return new WP_Error( 'dbe_code_required', 'Pass the JavaScript code to validate.' );
	}

	$errors = dbe_ability_js_structure_errors( $code );

	return array(
		'valid'  => array() === $errors,
		'errors' => $errors,
		'checks' => 'structural',
	);
}

/*
 * ----------------------------------------------------------------------
 *  Element rendering (visibility) conditions
 * ----------------------------------------------------------------------
 */

/**
 * The rendering-condition registry, scraped from the Builderius (free + Pro)
 * condition config YAMLs on this site: name => { operators, needs }, where
 * needs are the wp-system-variable field tokens the condition's expression
 * reads (from its graphqlPath declaration). Scraping the shipped YAMLs keeps
 * the list current with the installed version; a site plugin's extra
 * conditions simply will not appear (callers warn rather than reject those).
 *
 * @return array<string,array{operators:array<int,string>,needs:array<int,array<int,string>>}>
 */
function dbe_ability_condition_registry() {
	static $registry = null;
	if ( null !== $registry ) {
		return $registry;
	}
	$registry = array();
	$files    = array(
		WP_PLUGIN_DIR . '/builderius/src/Bundle/ModuleBundle/Resources/config/modules_rendering_conditions.yml',
		WP_PLUGIN_DIR . '/builderius-pro/src/Bundle/ModuleBundle/Resources/config/modules_rendering_conditions.yml',
	);
	foreach ( $files as $file ) {
		if ( ! is_readable( $file ) ) {
			continue;
		}
		$yaml = (string) file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local plugin config file.
		// One block per condition: "- name: x" plus its 8-space-indented body.
		if ( ! preg_match_all( '/-\ name:\ ([a-z0-9_]+)\n((?:[ ]{8,}.*\n)*)/', $yaml, $blocks, PREG_SET_ORDER ) ) {
			continue;
		}
		foreach ( $blocks as $block ) {
			$name = $block[1];
			$body = $block[2];

			$operators = array();
			if ( preg_match( '/operators:\s*\[([^\]]*)\]/', $body, $m ) && preg_match_all( "/'([^']+)'/", $m[1], $ops ) ) {
				$operators = $ops[1];
			}

			/*
			 * Each graphqlPath row names a field the wp system variable must
			 * select. A row "query.foo.__aliasFor: bar" means the query holds
			 * "foo: bar", and the condition's expression reads wp.foo — so
			 * either token appearing in the query text counts. Argument rows
			 * (__args) carry no field of their own.
			 */
			$needs = array();
			if ( preg_match( '/graphqlPath:\n((?:[ ]{10,}.*\n)*)/', $body, $m )
				&& preg_match_all( '/"\'([^\']+)\'":\s*"?\'?([^\'"\n]*)/', $m[1], $paths, PREG_SET_ORDER ) ) {
				foreach ( $paths as $path ) {
					$segments = explode( '.', $path[1] );
					if ( in_array( '__args', $segments, true ) ) {
						continue;
					}
					$last = end( $segments );
					if ( '__aliasFor' === $last ) {
						array_pop( $segments );
						$alternatives = array_filter( array( end( $segments ), trim( $path[2] ) ) );
					} elseif ( '' !== $last ) {
						$alternatives = array( $last );
					} else {
						continue;
					}
					$needs[] = array_values( array_unique( $alternatives ) );
				}
			}

			$registry[ $name ] = array(
				'operators' => $operators,
				'needs'     => array_values( array_unique( $needs, SORT_REGULAR ) ),
			);
		}
	}
	return $registry;
}

/**
 * Build the stored visibilityCondition object from the ability's groups
 * input (outer array OR-ed, inner arrays AND-ed) — the same shape and the
 * same validation as the builder's own set_visibility_condition tool, with
 * one addition: conditions whose expressions read the wp system variable are
 * cross-checked against its saved query, because the builder maintains those
 * query fields automatically and this headless channel cannot.
 *
 * @param array $groups   Groups input.
 * @param array $warnings Collected warnings (by reference).
 * @return array|WP_Error The condition object.
 */
function dbe_ability_build_condition( $groups, &$warnings ) {
	if ( ! is_array( $groups ) || array() === $groups ) {
		return new WP_Error( 'dbe_groups_required', 'Pass groups (an array of rule arrays) or expression.' );
	}
	$registry = dbe_ability_condition_registry();
	$no_value = array( 'is_empty', 'is_not_empty' );

	// The wp system variable's saved query, for the graphqlPath cross-check.
	$wp_query_text = null;
	$global_vars   = dbe_ability_load_scoped_setting( array(), 'dataVars' );
	if ( ! is_wp_error( $global_vars ) ) {
		foreach ( $global_vars['vars'] as $entry ) {
			if ( 'wp' === ( $entry['b1'] ?? '' ) ) {
				$wp_query_text = (string) ( $entry['c1'] ?? '' );
				break;
			}
		}
	}

	$or_rules = array();
	foreach ( $groups as $g => $rules ) {
		if ( ! is_array( $rules ) || array() === $rules ) {
			return new WP_Error( 'dbe_bad_group', sprintf( 'Group %d is empty — every group needs at least one rule.', (int) $g + 1 ) );
		}
		$and_rules = array();
		foreach ( $rules as $rule ) {
			$rule = (array) $rule;
			$name = trim( (string) ( $rule['name'] ?? '' ) );
			if ( '' === $name ) {
				return new WP_Error( 'dbe_bad_rule', 'Every rule needs a condition name.' );
			}
			$operator = trim( (string) ( $rule['operator'] ?? '' ) );
			if ( '' === $operator ) {
				return new WP_Error( 'dbe_bad_rule', sprintf( 'Rule "%s" needs an operator.', $name ) );
			}

			if ( isset( $registry[ $name ] ) ) {
				$known_ops = $registry[ $name ]['operators'];
				if ( $known_ops && ! in_array( $operator, $known_ops, true ) ) {
					return new WP_Error(
						'dbe_bad_operator',
						sprintf( 'Invalid operator "%s" for condition "%s". Valid operators: %s.', $operator, $name, implode( ', ', $known_ops ) )
					);
				}
				foreach ( $registry[ $name ]['needs'] as $alternatives ) {
					if ( null === $wp_query_text ) {
						continue;
					}
					$found = false;
					foreach ( $alternatives as $token ) {
						if ( preg_match( '/\b' . preg_quote( $token, '/' ) . '\b/', $wp_query_text ) ) {
							$found = true;
							break;
						}
					}
					if ( ! $found ) {
						$warnings[] = sprintf(
							'Condition "%s" reads a wp system-variable field this site\'s `wp` query does not appear to select ("%s"). The builder adds it automatically; headless, add it via dbe/manage-data-variable (name: wp, allow_system: true), then prove the element renders with dbe/check-rendered-output.',
							$name,
							implode( '" / "', $alternatives )
						);
					}
				}
			} elseif ( array() !== $registry ) {
				$warnings[] = sprintf( 'Condition "%s" is not in Builderius\' shipped registry — saved anyway, but verify it renders (site plugins can add conditions).', $name );
			}

			$row = array(
				'name'     => $name,
				'operator' => $operator,
			);
			if ( array_key_exists( 'value', $rule ) && null !== $rule['value'] ) {
				$row['value'] = $rule['value'];
			} elseif ( ! in_array( $operator, $no_value, true ) ) {
				return new WP_Error( 'dbe_bad_rule', sprintf( 'Rule "%s" needs a value for operator "%s" (only is_empty/is_not_empty go without).', $name, $operator ) );
			}
			$and_rules[] = $row;
		}
		$or_rules[] = array(
			'type'      => 'group',
			'condition' => 'and',
			'rules'     => $and_rules,
		);
	}
	return array(
		'type'      => 'group',
		'condition' => 'or',
		'rules'     => $or_rules,
	);
}

/**
 * Handle dbe/manage-visibility-condition.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_manage_visibility_condition( $input ) {
	$action    = (string) ( $input['action'] ?? '' );
	$module_id = trim( (string) ( $input['module_id'] ?? '' ) );

	$loaded = dbe_ability_load_entity_config( (string) ( $input['template'] ?? '' ), $input['entity_type'] ?? 'template' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}
	if ( ! isset( $loaded['config']['modules'][ $module_id ] ) ) {
		return new WP_Error( 'dbe_no_module', sprintf( 'No module "%s" in this entity — check dbe/get-tree-outline.', $module_id ) );
	}

	$settings      = (array) ( $loaded['config']['modules'][ $module_id ]['settings'] ?? array() );
	$setting_index = -1;
	$current       = null;
	foreach ( $settings as $i => $s ) {
		if ( 'visibilityCondition' === ( $s['name'] ?? '' ) ) {
			$setting_index = (int) $i;
			$current       = $s['value'] ?? null;
			break;
		}
	}

	if ( 'get' === $action ) {
		return array(
			'action'      => 'get',
			'condition'   => $current,
			'warnings'    => array(),
			'dry_run'     => false,
			'base_commit' => (string) $loaded['commit']->post_name,
		);
	}

	$warnings = array();
	if ( 'set' === $action ) {
		$expression = trim( (string) ( $input['expression'] ?? '' ) );
		if ( '' !== $expression && ! empty( $input['groups'] ) ) {
			return new WP_Error( 'dbe_condition_conflict', 'Pass groups OR expression, not both.' );
		}
		if ( '' !== $expression ) {
			$value = $expression;
		} else {
			$value = dbe_ability_build_condition( $input['groups'] ?? array(), $warnings );
			if ( is_wp_error( $value ) ) {
				return $value;
			}
		}
		if ( -1 === $setting_index ) {
			$settings[] = array(
				'name'  => 'visibilityCondition',
				'value' => $value,
			);
		} else {
			$settings[ $setting_index ]['value'] = $value;
		}
	} elseif ( 'clear' === $action ) {
		if ( -1 === $setting_index ) {
			return array(
				'action'      => 'clear',
				'condition'   => null,
				'warnings'    => array( 'The element had no rendering condition — nothing to clear.' ),
				'dry_run'     => false,
				'base_commit' => (string) $loaded['commit']->post_name,
			);
		}
		array_splice( $settings, $setting_index, 1 );
		$value = null;
	} else {
		return new WP_Error( 'dbe_bad_action', 'action must be get, set or clear.' );
	}

	if ( ! empty( $input['dry_run'] ) ) {
		return array(
			'action'      => $action,
			'condition'   => $value,
			'warnings'    => $warnings,
			'dry_run'     => true,
			'base_commit' => (string) $loaded['commit']->post_name,
		);
	}

	$preflight = dbe_ability_preflight( $loaded, $input, (string) $loaded['entity_post']->post_name );
	if ( is_wp_error( $preflight ) ) {
		return $preflight;
	}

	$config                                      = $loaded['config'];
	$config['modules'][ $module_id ]['settings'] = array_values( $settings );

	$commit_name = dbe_ability_create_commit(
		$loaded['branch']->ID,
		$config,
		false,
		sprintf( '%s rendering condition on %s via dbe/manage-visibility-condition', 'set' === $action ? 'Set' : 'Clear', $module_id ),
		(string) ( $input['expected_commit'] ?? '' )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	return array(
		'action'      => $action,
		'condition'   => $value,
		'warnings'    => $warnings,
		'dry_run'     => false,
		'commit_name' => $commit_name,
		'base_commit' => (string) $loaded['commit']->post_name,
	);
}

/*
 * ----------------------------------------------------------------------
 *  Settings-set management (non-CSS global settings)
 * ----------------------------------------------------------------------
 */

/**
 * Handle dbe/manage-settings-set.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_manage_settings_set( $input ) {
	$action = (string) ( $input['action'] ?? '' );
	if ( ! in_array( $action, array( 'get', 'update' ), true ) ) {
		return new WP_Error( 'dbe_bad_action', 'action must be get or update.' );
	}

	$loaded = dbe_ability_load_settings_set( (string) ( $input['settings_set'] ?? '' ) );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}

	$settings = (array) ( $loaded['config']['template']['settings'] ?? array() );
	$indexes  = array(
		'responsiveStrategy' => -1,
		'breakpoints'        => -1,
		'fonts'              => -1,
		'dataVars'           => -1,
		'customJs'           => -1,
	);
	foreach ( $settings as $i => $s ) {
		$setting_name = (string) ( $s['name'] ?? '' );
		if ( array_key_exists( $setting_name, $indexes ) ) {
			$indexes[ $setting_name ] = (int) $i;
		}
	}
	$read = static function ( $key, $fallback ) use ( $settings, $indexes ) {
		return -1 !== $indexes[ $key ] ? $settings[ $indexes[ $key ] ]['value'] : $fallback;
	};

	$technologies = wp_get_object_terms( $loaded['set_post']->ID, 'builderius_template_technology', array( 'fields' => 'slugs' ) );
	$summary      = array(
		'settings_set'        => array(
			'id'         => (int) $loaded['set_post']->ID,
			'slug'       => (string) $loaded['set_post']->post_name,
			'title'      => (string) $loaded['set_post']->post_title,
			'technology' => ! is_wp_error( $technologies ) && $technologies ? (string) $technologies[0] : (string) $loaded['set_post']->post_name,
		),
		'responsive_strategy' => (string) $read( 'responsiveStrategy', 'desktop-first' ),
		'breakpoints'         => (array) $read( 'breakpoints', array() ),
		'fonts'               => (array) $read( 'fonts', array() ),
		'css_length'          => strlen( $loaded['css'] ),
		'data_variables'      => is_array( $read( 'dataVars', null ) ) ? count( $read( 'dataVars', array() ) ) : 0,
		'js_snippets'         => is_array( $read( 'customJs', null ) ) ? count( $read( 'customJs', array() ) ) : 0,
		'base_commit'         => (string) $loaded['commit']->post_name,
	);

	if ( 'get' === $action ) {
		$summary['dry_run'] = false;
		return $summary;
	}

	$changed = false;
	if ( isset( $input['responsive_strategy'] ) ) {
		$strategy = (string) $input['responsive_strategy'];
		if ( ! in_array( $strategy, array( 'desktop-first', 'mobile-first' ), true ) ) {
			return new WP_Error( 'dbe_bad_strategy', 'responsive_strategy must be desktop-first or mobile-first.' );
		}
		$summary['responsive_strategy'] = $strategy;
		$changed                        = true;
	}
	if ( isset( $input['breakpoints'] ) ) {
		$clean = array();
		foreach ( (array) $input['breakpoints'] as $bp ) {
			$bp    = (array) $bp;
			$name  = trim( (string) ( $bp['name'] ?? '' ) );
			$width = (int) ( $bp['width'] ?? 0 );
			if ( ! preg_match( '/^--[a-z][a-z0-9-]*$/', $name ) ) {
				return new WP_Error( 'dbe_bad_breakpoint', sprintf( 'Breakpoint name "%s" must be a --slug custom-media name (e.g. --tablet).', $name ) );
			}
			if ( $width < 1 ) {
				return new WP_Error( 'dbe_bad_breakpoint', sprintf( 'Breakpoint %s needs a positive width.', $name ) );
			}
			$row     = array(
				'label'         => '' !== trim( (string) ( $bp['label'] ?? '' ) ) ? trim( (string) $bp['label'] ) : ucfirst( ltrim( $name, '-' ) ),
				'name'          => $name,
				'width'         => $width,
				'width_builder' => isset( $bp['width_builder'] ) ? (int) $bp['width_builder'] : $width,
				'icon'          => (string) ( $bp['icon'] ?? 'desktop' ),
				'deletable'     => isset( $bp['deletable'] ) ? (bool) $bp['deletable'] : true,
			);
			$clean[] = $row;
		}
		if ( array() === $clean ) {
			return new WP_Error( 'dbe_bad_breakpoint', 'The breakpoints list cannot be empty — every template\'s responsive CSS references these.' );
		}
		$summary['breakpoints'] = $clean;
		$changed                = true;
	}
	if ( isset( $input['fonts'] ) ) {
		$summary['fonts'] = array_values( (array) $input['fonts'] );
		$changed          = true;
	}
	if ( ! $changed ) {
		return new WP_Error( 'dbe_nothing_to_update', 'Pass at least one of responsive_strategy, breakpoints or fonts.' );
	}

	if ( ! empty( $input['dry_run'] ) ) {
		$summary['dry_run'] = true;
		return $summary;
	}

	$presence = dbe_ability_all_presence_precondition( ! empty( $input['force'] ) );
	if ( is_wp_error( $presence ) ) {
		return $presence;
	}
	$preflight = dbe_ability_preflight( $loaded, $input );
	if ( is_wp_error( $preflight ) ) {
		return $preflight;
	}

	$config = $loaded['config'];
	$writes = array(
		'responsiveStrategy' => $summary['responsive_strategy'],
		'breakpoints'        => $summary['breakpoints'],
		'fonts'              => $summary['fonts'],
	);
	foreach ( $writes as $setting_name => $value ) {
		if ( -1 === $indexes[ $setting_name ] ) {
			$config['template']['settings'][] = array(
				'name'  => $setting_name,
				'value' => $value,
			);
		} else {
			$config['template']['settings'][ $indexes[ $setting_name ] ]['value'] = $value;
		}
	}

	$commit_name = dbe_ability_create_commit(
		$loaded['branch']->ID,
		$config,
		false,
		'Update global settings via dbe/manage-settings-set',
		(string) ( $input['expected_commit'] ?? '' )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	$summary['dry_run']     = false;
	$summary['commit_name'] = $commit_name;
	return $summary;
}
