<?php
/**
 * Builderius template lifecycle abilities.
 *
 * Keeps the template registration schemas and their callbacks together while
 * relying on the shared entity lookup and GraphQL transaction services in the
 * parent abilities module.
 *
 * @package Daveden_Builder_Enhancements
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register template lifecycle abilities.
 */
function dbe_register_template_abilities() {
	$apply_rules_arg = array(
		'type'        => array( 'object', 'null' ),
		'description' => __( 'Where the template applies: { "location": name, "conditions": rules }. Core locations: front_page, home, singulars, blog_posts, pages, archives, 404, entire_site; Pro adds custom_posts, post_type_archives, taxonomy_archives, tag_archives, author_archives, date/year/month/day_archives, search_results, attachment_posts. Conditions follow Builderius\' rule tree, e.g. {"condition":"or","rules":[{"condition":"and","rules":[{"name":"post_id","operator":"equals","value":3}]}]}. Pass null to clear the rules (the template then applies nowhere).', 'daveden-builderius-enhancements' ),
	);
	$template_row    = array(
		'type'       => 'object',
		'properties' => array(
			'id'          => array( 'type' => 'integer' ),
			'slug'        => array( 'type' => 'string' ),
			'title'       => array( 'type' => 'string' ),
			'enabled'     => array( 'type' => 'boolean' ),
			'type'        => array( 'type' => 'string' ),
			'technology'  => array( 'type' => 'string' ),
			'sort_order'  => array( 'type' => 'integer' ),
			'apply_rules' => array( 'type' => array( 'object', 'null' ) ),
			'hook'        => array( 'type' => array( 'object', 'null' ) ),
			'branch_id'   => array( 'type' => array( 'integer', 'null' ) ),
			'commit_name' => array( 'type' => array( 'string', 'null' ) ),
		),
	);

	dbe_register_ability(
		'dbe/get-template-settings',
		array(
			'label'               => __( 'Get template settings', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Reads a Builderius template\'s registration-level settings — title, slug, enabled state, type, technology, sort order and apply rules (location + conditions) — plus its branch and saved commit. These are the settings the builder\'s template dialog edits, not the module tree (dbe/get-subtree-html) or CSS (dbe/get-entity-css). Omit template to list every template.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template' => array(
						'type'        => 'string',
						'description' => __( 'Template post ID or slug. Omit for all templates.', 'daveden-builderius-enhancements' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'templates' => array(
						'type'  => 'array',
						'items' => $template_row,
					),
				),
			),
			'execute_callback'    => 'dbe_ability_get_template_settings',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/create-template',
		array(
			'label'               => __( 'Create a template', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Creates a Builderius template through the builder\'s own mutations, headlessly — no builder tab needed. Builderius initialises the master branch and an initial commit (site header/footer components, a <main> element and a default `wp` data variable), so dbe/get-subtree-html and dbe/apply-subtree-html work on it immediately. Type page uses the builder\'s createPageTemplate: pass page_id instead of a title — the title, slug and apply rule (that one page) all derive from the WP page or enabled custom-post; other inputs then act as post-create overrides. Types beyond regular/page/hook (e.g. doc) are created as regular and re-termed, matching the builder\'s behaviour. A non-page template is created enabled but applies nowhere until apply_rules is set (here or later via dbe/update-template). Creating never publishes; the new template reaches logged-out visitors only after dbe/publish.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'title'              => array(
						'type'        => 'string',
						'description' => __( 'Template title, shown in the builder\'s template list. Must be unique. Required unless page_id is passed.', 'daveden-builderius-enhancements' ),
					),
					'name'               => array(
						'type'        => 'string',
						'description' => __( 'Slug. Defaults to a sanitised form of the title. Must be unique.', 'daveden-builderius-enhancements' ),
					),
					'type'               => array(
						'type'        => 'string',
						'default'     => 'regular',
						'description' => __( 'Template type: regular, page (needs page_id), doc or hook (needs the hook fields below).', 'daveden-builderius-enhancements' ),
					),
					'page_id'            => array(
						'type'        => 'integer',
						'description' => __( 'Page templates: the WordPress page/post (or enabled custom-post) ID the template is for. Implies type page; one template per page.', 'daveden-builderius-enhancements' ),
					),
					'technology'         => array(
						'type'        => 'string',
						'default'     => 'html',
						'description' => __( 'Template technology. Sites normally have one: html.', 'daveden-builderius-enhancements' ),
					),
					'enabled'            => array(
						'type'        => 'boolean',
						'default'     => true,
						'description' => __( 'Whether the template is active. Disabled templates never render.', 'daveden-builderius-enhancements' ),
					),
					'sort_order'         => array(
						'type'        => 'integer',
						'description' => __( 'Priority among templates whose rules match the same request; lower wins. Defaults to 10.', 'daveden-builderius-enhancements' ),
					),
					'apply_rules'        => $apply_rules_arg,
					'hook'               => array(
						'type'        => 'string',
						'description' => __( 'Hook templates only: the WordPress hook name.', 'daveden-builderius-enhancements' ),
					),
					'hook_type'          => array(
						'type'        => 'string',
						'enum'        => array( 'action', 'filter' ),
						'description' => __( 'Hook templates only: action or filter.', 'daveden-builderius-enhancements' ),
					),
					'hook_accepted_args' => array(
						'type'        => 'integer',
						'description' => __( 'Hook templates only: accepted args count. Defaults to 1.', 'daveden-builderius-enhancements' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array( 'template' => $template_row ),
			),
			'execute_callback'    => 'dbe_ability_create_template',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/update-template',
		array(
			'label'               => __( 'Update template settings', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Updates a Builderius template\'s registration-level settings through the builder\'s own updateTemplate mutation: title, slug, enabled state, type, sort order and apply rules (location + conditions). Only the fields passed change. This edits the same settings as the builder\'s template dialog — an open builder tab that later saves that dialog can overwrite these values, so prefer editing with the tab closed. Module content and CSS are separate (dbe/apply-subtree-html, dbe/patch-entity-css). Changes reach logged-out visitors immediately for apply rules and enabled state (they live on the post, not in a release).', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'    => array(
						'type'        => 'string',
						'description' => __( 'Template post ID or slug.', 'daveden-builderius-enhancements' ),
					),
					'title'       => array( 'type' => 'string' ),
					'name'        => array(
						'type'        => 'string',
						'description' => __( 'New slug.', 'daveden-builderius-enhancements' ),
					),
					'enabled'     => array( 'type' => 'boolean' ),
					'type'        => array(
						'type'        => 'string',
						'description' => __( 'Template type: regular, page, doc or hook.', 'daveden-builderius-enhancements' ),
					),
					'sort_order'  => array( 'type' => 'integer' ),
					'apply_rules' => $apply_rules_arg,
				),
				'required'             => array( 'template' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array( 'template' => $template_row ),
			),
			'execute_callback'    => 'dbe_ability_update_template',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/delete-template',
		array(
			'label'               => __( 'Delete a template', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Permanently deletes a Builderius template through the builder\'s own deleteTemplate mutation, including its branches and commit history. This cannot be undone — there is no trash for Builderius templates. Requires confirm: true; confirm with the user before calling. A published release that included the template keeps rendering its already-built output until the next dbe/publish.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template' => array(
						'type'        => 'string',
						'description' => __( 'Template post ID or slug.', 'daveden-builderius-enhancements' ),
					),
					'confirm'  => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Must be true. Deletion is permanent; confirm with the user first.', 'daveden-builderius-enhancements' ),
					),
				),
				'required'             => array( 'template', 'confirm' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'result'      => array( 'type' => 'boolean' ),
					'message'     => array( 'type' => 'string' ),
					'template_id' => array( 'type' => 'integer' ),
					'slug'        => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => 'dbe_ability_delete_template',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);
}

/*
 * ----------------------------------------------------------------------
 *  Template lifecycle (create / read settings / update / delete)
 * ----------------------------------------------------------------------
 */

/**
 * Registration-level summary of a template post: the settings the builder's
 * template dialog edits, plus branch/commit so agents can go straight to the
 * content abilities.
 *
 * @param WP_Post $post Template post.
 * @return array
 */
function dbe_ability_template_summary( $post ) {
	$types        = wp_get_object_terms( $post->ID, 'builderius_template_type', array( 'fields' => 'slugs' ) );
	$technologies = wp_get_object_terms( $post->ID, 'builderius_template_technology', array( 'fields' => 'slugs' ) );
	$type         = ! is_wp_error( $types ) && $types ? (string) $types[0] : '';

	$apply_rules = json_decode( (string) get_post_meta( $post->ID, 'apply_rules_config', true ), true );
	if ( is_array( $apply_rules ) ) {
		unset( $apply_rules['version'] );
	} else {
		$apply_rules = null;
	}

	$hook = null;
	if ( 'hook' === $type ) {
		$hook = array(
			'hook'               => (string) get_post_meta( $post->ID, 'hook', true ),
			'hook_type'          => (string) get_post_meta( $post->ID, 'hook_type', true ),
			'hook_accepted_args' => (int) get_post_meta( $post->ID, 'hook_accepted_args', true ),
		);
	}

	$sort_order = (int) get_post_meta( $post->ID, 'sort_order', true );

	$branch_id   = null;
	$commit_name = null;
	$resolved    = dbe_ability_resolve_commit( $post );
	if ( ! is_wp_error( $resolved ) ) {
		$branch_id   = (int) $resolved['branch']->ID;
		$commit_name = (string) $resolved['commit']->post_name;
	}

	return array(
		'id'          => (int) $post->ID,
		'slug'        => (string) $post->post_name,
		'title'       => (string) $post->post_title,
		'enabled'     => 'publish' === $post->post_status,
		'type'        => $type,
		'technology'  => ! is_wp_error( $technologies ) && $technologies ? (string) $technologies[0] : '',
		'sort_order'  => $sort_order ? $sort_order : 10,
		'apply_rules' => $apply_rules,
		'hook'        => $hook,
		'branch_id'   => $branch_id,
		'commit_name' => $commit_name,
	);
}

/**
 * Validate and serialise an apply_rules input value for the mutation's
 * serialized_apply_rules_config argument.
 *
 * @param mixed $rules The ability's apply_rules input (array or null).
 * @return string|WP_Error JSON string, '' to clear, or an error.
 */
function dbe_ability_serialize_apply_rules( $rules ) {
	if ( null === $rules ) {
		return '';
	}
	if ( ! is_array( $rules ) || empty( $rules['location'] ) || ! is_string( $rules['location'] ) ) {
		return new WP_Error( 'dbe_bad_apply_rules', 'apply_rules needs a "location" name (e.g. pages, entire_site) and usually a "conditions" rule tree.' );
	}
	$config = array( 'location' => $rules['location'] );
	if ( isset( $rules['conditions'] ) ) {
		if ( ! is_array( $rules['conditions'] ) ) {
			return new WP_Error( 'dbe_bad_apply_rules', 'apply_rules.conditions must be a rule-tree object, e.g. {"condition":"or","rules":[…]}.' );
		}
		$config['conditions'] = $rules['conditions'];
	}
	$json = wp_json_encode( $config, JSON_UNESCAPED_UNICODE );
	if ( false === $json ) {
		return new WP_Error( 'dbe_bad_apply_rules', 'Could not encode apply_rules.' );
	}
	return $json;
}

/**
 * Handle dbe/get-template-settings.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_get_template_settings( $input ) {
	$ref = trim( (string) ( $input['template'] ?? '' ) );
	if ( '' !== $ref ) {
		$post = dbe_ability_find_entity_post( $ref, 'template' );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		$posts = array( $post );
	} else {
		$posts = get_posts(
			array(
				'post_type'   => 'builderius_template',
				'post_status' => get_post_stati(),
				'numberposts' => -1,
				'orderby'     => 'ID',
				'order'       => 'DESC',
			)
		);
	}

	return array( 'templates' => array_map( 'dbe_ability_template_summary', $posts ) );
}

/**
 * Builderius' create resolvers stamp local time into post_date_gmt, so on
 * any site east of UTC a new template is born "scheduled" one TZ-offset in
 * the future — invisible to the builder's list yet blocking its own slug.
 * Normalise to the status the caller actually asked for.
 *
 * @param int  $template_id New template post ID.
 * @param bool $enabled     Whether the caller wants the template active.
 */
function dbe_ability_fix_future_status( $template_id, $enabled = true ) {
	if ( 'future' === get_post_status( $template_id ) ) {
		wp_update_post(
			array(
				'ID'            => $template_id,
				'post_status'   => $enabled ? 'publish' : 'draft',
				'post_date'     => current_time( 'mysql' ),
				'post_date_gmt' => current_time( 'mysql', true ),
			)
		);
		clean_post_cache( $template_id );
	}
}

/**
 * Handle dbe/create-template.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_create_template( $input ) {
	$type    = trim( (string) ( $input['type'] ?? 'regular' ) );
	$page_id = (int) ( $input['page_id'] ?? 0 );
	if ( $page_id > 0 ) {
		$type = 'page';
	}

	/*
	 * Page templates come from the builder's own createPageTemplate: title,
	 * slug, parent and the one-page apply rule all derive from the WP page.
	 * Everything else the caller passed is applied afterwards as an update.
	 */
	if ( 'page' === $type ) {
		if ( $page_id < 1 ) {
			return new WP_Error( 'dbe_page_id_required', 'Page templates bind to one WordPress page — pass page_id.' );
		}
		$mutation = 'mutation DbeCreatePageTemplate($page_id: Int!) {'
			. ' createPageTemplate(page_id: $page_id) { template { id name title } }'
			. ' }';
		$data     = dbe_ability_graphql( 'dbeCreatePageTemplate', $mutation, array( 'page_id' => $page_id ) );
		if ( is_wp_error( $data ) ) {
			return $data;
		}
		$template_id = (int) ( $data['createPageTemplate']['template']['id'] ?? 0 );
		if ( ! $template_id ) {
			return new WP_Error( 'dbe_create_failed', 'createPageTemplate returned no template.' );
		}
		dbe_ability_fix_future_status( $template_id, (bool) ( $input['enabled'] ?? true ) );

		$overrides = array( 'template' => (string) $template_id );
		foreach ( array( 'title', 'name', 'enabled', 'sort_order', 'apply_rules' ) as $field ) {
			if ( array_key_exists( $field, $input ) ) {
				$overrides[ $field ] = $input[ $field ];
			}
		}
		if ( count( $overrides ) > 1 ) {
			$updated = dbe_ability_update_template( $overrides );
			if ( is_wp_error( $updated ) ) {
				return $updated;
			}
			return $updated;
		}
		return array( 'template' => dbe_ability_template_summary( get_post( $template_id ) ) );
	}

	$title = trim( (string) ( $input['title'] ?? '' ) );
	if ( '' === $title ) {
		return new WP_Error( 'dbe_title_required', 'Pass a template title.' );
	}

	// The createTemplate mutation only accepts registered provider types
	// (regular, hook). Anything else — e.g. doc — is the builder's own
	// pattern of a regular template re-termed in the type taxonomy.
	$mutation_type = in_array( $type, array( 'regular', 'hook' ), true ) ? $type : 'regular';

	$gql_input = array(
		'title'      => $title,
		'type'       => $mutation_type,
		'technology' => trim( (string) ( $input['technology'] ?? 'html' ) ),
		'enabled'    => (bool) ( $input['enabled'] ?? true ),
	);
	if ( ! empty( $input['name'] ) ) {
		$gql_input['name'] = sanitize_title( (string) $input['name'] );
	}
	if ( isset( $input['sort_order'] ) ) {
		$gql_input['sort_order'] = (int) $input['sort_order'];
	}
	if ( array_key_exists( 'apply_rules', $input ) && null !== $input['apply_rules'] ) {
		$rules = dbe_ability_serialize_apply_rules( $input['apply_rules'] );
		if ( is_wp_error( $rules ) ) {
			return $rules;
		}
		$gql_input['serialized_apply_rules_config'] = $rules;
	}
	if ( 'hook' === $type ) {
		if ( empty( $input['hook'] ) || empty( $input['hook_type'] ) ) {
			return new WP_Error( 'dbe_hook_required', 'Hook templates need hook and hook_type.' );
		}
		$gql_input['hook']               = (string) $input['hook'];
		$gql_input['hook_type']          = (string) $input['hook_type'];
		$gql_input['hook_accepted_args'] = (int) ( $input['hook_accepted_args'] ?? 1 );
	}

	$mutation = 'mutation DbeCreateTemplate($input: BuilderiusCreateTemplateInput!) {'
		. ' createTemplate(input: $input) { template { id name title } }'
		. ' }';
	$data     = dbe_ability_graphql( 'dbeCreateTemplate', $mutation, array( 'input' => $gql_input ) );
	if ( is_wp_error( $data ) ) {
		return $data;
	}
	$template_id = (int) ( $data['createTemplate']['template']['id'] ?? 0 );
	if ( ! $template_id ) {
		return new WP_Error( 'dbe_create_failed', 'createTemplate returned no template.' );
	}
	dbe_ability_fix_future_status( $template_id, (bool) ( $input['enabled'] ?? true ) );

	if ( $mutation_type !== $type ) {
		$term_result = wp_set_object_terms( $template_id, $type, 'builderius_template_type' );
		if ( is_wp_error( $term_result ) ) {
			return $term_result;
		}
		clean_post_cache( $template_id );
	}

	return array( 'template' => dbe_ability_template_summary( get_post( $template_id ) ) );
}

/**
 * Handle dbe/update-template.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_update_template( $input ) {
	$post = dbe_ability_find_entity_post( (string) ( $input['template'] ?? '' ), 'template' );
	if ( is_wp_error( $post ) ) {
		return $post;
	}

	$current_terms = wp_get_object_terms( $post->ID, 'builderius_template_type', array( 'fields' => 'slugs' ) );
	$current_type  = ! is_wp_error( $current_terms ) && $current_terms ? (string) $current_terms[0] : 'regular';

	$gql_input = array( 'id' => (int) $post->ID );
	if ( isset( $input['title'] ) && '' !== trim( (string) $input['title'] ) ) {
		$gql_input['title'] = trim( (string) $input['title'] );
	}
	if ( isset( $input['name'] ) && '' !== trim( (string) $input['name'] ) ) {
		$gql_input['name'] = sanitize_title( (string) $input['name'] );
	} elseif ( isset( $gql_input['title'] ) ) {
		// The resolver rewrites the slug from a new title; pin the current
		// slug so a title-only update does not silently change URLs/refs.
		$gql_input['name'] = (string) $post->post_name;
	}
	if ( isset( $input['enabled'] ) ) {
		$gql_input['enabled'] = (bool) $input['enabled'];
	}
	if ( isset( $input['sort_order'] ) ) {
		$gql_input['sort_order'] = (int) $input['sort_order'];
	}
	if ( array_key_exists( 'apply_rules', $input ) ) {
		$rules = dbe_ability_serialize_apply_rules( $input['apply_rules'] );
		if ( is_wp_error( $rules ) ) {
			return $rules;
		}
		$gql_input['serialized_apply_rules_config'] = $rules;
	}
	if ( count( $gql_input ) < 2 && empty( $input['type'] ) ) {
		return new WP_Error( 'dbe_nothing_to_update', 'Pass at least one field to change.' );
	}

	/*
	 * The resolver reads input.type unconditionally, so always send one.
	 * Its own term handling only covers switching TO regular or hook;
	 * hook needs the hook/hook_type arguments this ability does not carry,
	 * and other targets (page, doc) need the term set here afterwards.
	 */
	$new_type = isset( $input['type'] ) && '' !== trim( (string) $input['type'] ) ? trim( (string) $input['type'] ) : $current_type;
	if ( 'hook' === $new_type && 'hook' !== $current_type ) {
		return new WP_Error( 'dbe_hook_conversion', 'Converting to a hook template needs the hook fields — delete and recreate with dbe/create-template instead.' );
	}
	$gql_input['type'] = $new_type;

	$mutation = 'mutation DbeUpdateTemplate($input: BuilderiusUpdateTemplateInput!) {'
		. ' updateTemplate(input: $input) { template { id name title } }'
		. ' }';
	$data     = dbe_ability_graphql( 'dbeUpdateTemplate', $mutation, array( 'input' => $gql_input ) );
	if ( is_wp_error( $data ) ) {
		return $data;
	}
	$template_id = (int) ( $data['updateTemplate']['template']['id'] ?? $post->ID );

	// Enabling a template whose post_date is still in the future would be
	// re-scheduled straight back by WordPress; normalise the dates too.
	if ( ! empty( $input['enabled'] ) ) {
		dbe_ability_fix_future_status( $template_id, true );
	}

	if ( $new_type !== $current_type && ! in_array( $new_type, array( 'regular', 'hook' ), true ) ) {
		$term_result = wp_set_object_terms( $template_id, $new_type, 'builderius_template_type' );
		if ( is_wp_error( $term_result ) ) {
			return $term_result;
		}
	}

	clean_post_cache( $template_id );
	return array( 'template' => dbe_ability_template_summary( get_post( $template_id ) ) );
}

/**
 * Handle dbe/delete-template.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_delete_template( $input ) {
	if ( true !== ( $input['confirm'] ?? false ) ) {
		return new WP_Error( 'dbe_confirm_required', 'Deletion is permanent (branches and commit history included). Confirm with the user, then pass confirm: true.' );
	}
	$post = dbe_ability_find_entity_post( (string) ( $input['template'] ?? '' ), 'template' );
	if ( is_wp_error( $post ) ) {
		return $post;
	}
	$slug = (string) $post->post_name;

	$mutation = 'mutation DbeDeleteTemplate($id: Int!) {'
		. ' deleteTemplate(id: $id) { result message }'
		. ' }';
	$data     = dbe_ability_graphql( 'dbeDeleteTemplate', $mutation, array( 'id' => (int) $post->ID ) );
	if ( is_wp_error( $data ) ) {
		return $data;
	}

	return array(
		'result'      => (bool) ( $data['deleteTemplate']['result'] ?? false ),
		'message'     => (string) ( $data['deleteTemplate']['message'] ?? '' ),
		'template_id' => (int) $post->ID,
		'slug'        => $slug,
	);
}
