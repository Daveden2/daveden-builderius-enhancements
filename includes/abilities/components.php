<?php
/**
 * Builderius component lifecycle abilities.
 *
 * Keeps component registration schemas and callbacks together while relying
 * on the parent abilities module for shared entity, commit, lock and GraphQL
 * services.
 *
 * @package Daveden_Builder_Enhancements
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register component lifecycle abilities.
 *
 * @param array $expected_commit_arg Shared optimistic-concurrency schema.
 * @param array $force_arg           Shared dirty-tab override schema.
 */
function dbe_register_component_abilities( $expected_commit_arg, $force_arg ) {
	$component_ref_arg = array(
		'type'        => 'string',
		'description' => __( 'Component post ID or slug.', 'daveden-builderius-enhancements' ),
	);
	$prop_def_schema   = array(
		'type'       => 'object',
		'properties' => array(
			'name'        => array( 'type' => 'string' ),
			'type'        => array(
				'type' => 'string',
				'enum' => array( 'text', 'select', 'boolean' ),
			),
			'label'       => array( 'type' => 'string' ),
			'placeholder' => array(
				'description' => __( 'The default value: a string for text (may be a [[binding]]), a boolean for boolean.', 'daveden-builderius-enhancements' ),
			),
			'options'     => array(
				'type'        => 'array',
				'description' => __( 'select only: [{ value, label?, default? }].', 'daveden-builderius-enhancements' ),
				'items'       => array( 'type' => 'object' ),
			),
		),
	);

	dbe_register_ability(
		'dbe/list-components',
		array(
			'label'               => __( 'List components', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Lists every Builderius component with its declared properties (from the saved state) and branch/commit. Components are reusable module trees; instances are placed in templates with <dbe-component name="slug" prop="value"> in dbe/apply-subtree-html, and a component\'s internals are edited with the same subtree/CSS/data abilities using entity_type: "component". Inside a component, a declared property is referenced as [[props.name]] (escaped) or [[[props.name]]] (raw), e.g. in a Collection\'s data-b-context.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'component' => array(
						'type'        => 'string',
						'description' => __( 'Component post ID or slug. Omit for all components.', 'daveden-builderius-enhancements' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'components' => array(
						'type'  => 'array',
						'items' => array( 'type' => 'object' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_list_components',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/create-component',
		array(
			'label'               => __( 'Create a component', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Creates a Builderius component through the builder\'s own createComponent mutation, headlessly, then scaffolds its saved config (a single root <div>, the standard wp data variable, and any declared properties) so the content abilities work on it immediately: author its internals with dbe/apply-subtree-html and its styles with dbe/patch-entity-css, both with entity_type: "component". Titles map to snake_case slugs (hyphens become underscores). Declared properties become instance attributes (<dbe-component name="slug" my_prop="…">) and are read inside the component as [[props.my_prop]] / [[[props.my_prop]]]. Components may nest other components (place <dbe-component> in their internals).', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'title'      => array(
						'type'        => 'string',
						'description' => __( 'Component title. Must be unique; the slug is derived from it (or from name).', 'daveden-builderius-enhancements' ),
					),
					'name'       => array(
						'type'        => 'string',
						'description' => __( 'Slug (snake_case). Defaults to the sanitised title.', 'daveden-builderius-enhancements' ),
					),
					'technology' => array(
						'type'    => 'string',
						'default' => 'html',
					),
					'props'      => array(
						'type'        => 'array',
						'description' => __( 'Declared properties. Names are lowercase snake_case (attribute names lowercase in HTML). Types: text (placeholder = default, may be a [[binding]]), select (options with one default: true), boolean (placeholder true/false).', 'daveden-builderius-enhancements' ),
						'items'       => $prop_def_schema,
					),
				),
				'required'             => array( 'title' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array( 'component' => array( 'type' => 'object' ) ),
			),
			'execute_callback'    => 'dbe_ability_create_component',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/manage-component-property',
		array(
			'label'               => __( 'Create, update or delete a component property', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Manages a component\'s declared properties (the componentTmplProperties of its saved config), committed through Builderius\' own mutation. Property names are lowercase snake_case and cannot be renamed — instance overrides across templates reference the name, so delete and redeclare instead, then re-apply overrides. Deleting is refused while the component\'s own internals still reference [[props.name]]; remove those references first with dbe/apply-subtree-html (entity_type: "component"). Read dbe/list-components first for the current properties and expected_commit.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'component'       => $component_ref_arg,
					'action'          => array(
						'type' => 'string',
						'enum' => array( 'create', 'update', 'delete' ),
					),
					'name'            => array(
						'type'        => 'string',
						'description' => __( 'The property name (lowercase snake_case, e.g. heading_text).', 'daveden-builderius-enhancements' ),
					),
					'type'            => array(
						'type' => 'string',
						'enum' => array( 'text', 'select', 'boolean' ),
					),
					'label'           => array( 'type' => 'string' ),
					'placeholder'     => array(
						'description' => __( 'The default value: a string for text (may be a [[binding]]), a boolean for boolean.', 'daveden-builderius-enhancements' ),
					),
					'options'         => array(
						'type'        => 'array',
						'description' => __( 'select only: [{ value, label?, default? }] with exactly one default: true.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
					'dry_run'         => array(
						'type'    => 'boolean',
						'default' => false,
					),
					'expected_commit' => $expected_commit_arg,
					'force'           => $force_arg,
				),
				'required'             => array( 'component', 'action', 'name' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'action'      => array( 'type' => 'string' ),
					'property'    => array( 'type' => array( 'object', 'null' ) ),
					'properties'  => array(
						'type'  => 'array',
						'items' => array( 'type' => 'object' ),
					),
					'commit_name' => array( 'type' => 'string' ),
					'base_commit' => array( 'type' => 'string' ),
					'dry_run'     => array( 'type' => 'boolean' ),
				),
			),
			'execute_callback'    => 'dbe_ability_manage_component_property',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/delete-component',
		array(
			'label'               => __( 'Delete a component', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Permanently deletes a Builderius component through the builder\'s own deleteComponent mutation, including its branches and commit history. Refused while any template or component still uses it (the usage list is returned — remove those instances first with dbe/apply-subtree-html). Requires confirm: true; confirm with the user before calling.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'component' => $component_ref_arg,
					'confirm'   => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Must be true. Deletion is permanent; confirm with the user first.', 'daveden-builderius-enhancements' ),
					),
				),
				'required'             => array( 'component', 'confirm' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'result'       => array( 'type' => 'boolean' ),
					'message'      => array( 'type' => 'string' ),
					'component_id' => array( 'type' => 'integer' ),
					'slug'         => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => 'dbe_ability_delete_component',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);
}

/*
 * ----------------------------------------------------------------------
 *  Component authoring (definition posts + declared properties)
 * ----------------------------------------------------------------------
 */

/**
 * Validate one declared-property definition.
 *
 * @param array $def  Candidate definition (name/type/label/placeholder/options).
 * @return array|WP_Error The normalised definition.
 */
function dbe_ability_validate_prop_def( $def ) {
	$name = trim( (string) ( $def['name'] ?? '' ) );
	if ( ! preg_match( '/^[a-z][a-z0-9_]*$/', $name ) ) {
		return new WP_Error( 'dbe_bad_prop_name', 'Property names are lowercase snake_case (heading_text) — HTML lowercases attribute names, so anything else cannot round-trip on instances.' );
	}
	$type = (string) ( $def['type'] ?? 'text' );
	if ( ! in_array( $type, array( 'text', 'select', 'boolean' ), true ) ) {
		return new WP_Error( 'dbe_bad_prop_type', 'Property types are text, select or boolean.' );
	}
	$normalised = array(
		'type'  => $type,
		'name'  => $name,
		'label' => '' !== trim( (string) ( $def['label'] ?? '' ) ) ? trim( (string) $def['label'] ) : ucwords( str_replace( '_', ' ', $name ) ),
	);
	if ( 'select' === $type ) {
		$options = $def['options'] ?? null;
		if ( ! is_array( $options ) || array() === $options ) {
			return new WP_Error( 'dbe_bad_prop_options', 'A select property needs options: [{ value, label?, default? }].' );
		}
		$defaults = 0;
		$clean    = array();
		foreach ( $options as $option ) {
			if ( ! is_array( $option ) || ! isset( $option['value'] ) ) {
				return new WP_Error( 'dbe_bad_prop_options', 'Every select option needs a value.' );
			}
			$row = array( 'value' => (string) $option['value'] );
			if ( isset( $option['label'] ) ) {
				$row['label'] = (string) $option['label'];
			}
			if ( ! empty( $option['default'] ) ) {
				$row['default'] = true;
				++$defaults;
			}
			$clean[] = $row;
		}
		if ( 1 !== $defaults ) {
			return new WP_Error( 'dbe_bad_prop_options', 'Mark exactly one select option default: true — the builder uses it as the instance default.' );
		}
		$normalised['options'] = $clean;
	} elseif ( 'boolean' === $type ) {
		$normalised['placeholder'] = (bool) ( $def['placeholder'] ?? false );
	} elseif ( isset( $def['placeholder'] ) ) {
		$normalised['placeholder'] = (string) $def['placeholder'];
	}
	return $normalised;
}

/**
 * Default values for the component's `props` json data variable, keyed by
 * property name. The render pipeline resolves props THROUGH this variable —
 * instance overrides only apply to keys that exist here, so every declared
 * property must appear with a non-null default (mirrors the builder JS).
 *
 * @param array $props Declared property definitions.
 * @return array name => default value.
 */
function dbe_ability_props_defaults( $props ) {
	$defaults = array();
	foreach ( $props as $def ) {
		$name = (string) ( $def['name'] ?? '' );
		if ( '' === $name ) {
			continue;
		}
		if ( 'select' === ( $def['type'] ?? '' ) ) {
			$value = '';
			foreach ( (array) ( $def['options'] ?? array() ) as $option ) {
				if ( ! empty( $option['default'] ) ) {
					$value = (string) ( $option['value'] ?? '' );
					break;
				}
			}
			$defaults[ $name ] = $value;
		} elseif ( 'boolean' === ( $def['type'] ?? '' ) ) {
			$defaults[ $name ] = (bool) ( $def['placeholder'] ?? false );
		} else {
			$defaults[ $name ] = (string) ( $def['placeholder'] ?? '' );
		}
	}
	return $defaults;
}

/**
 * Write a component's declared properties AND its derived `props` data
 * variable into $config in one pass, so both always change in one commit.
 *
 * @param array $config Component content config (modified in place semantics — returned).
 * @param array $props  Declared property definitions.
 * @return array The updated config.
 */
function dbe_ability_sync_component_props( $config, $props ) {
	$settings    = (array) ( $config['template']['settings'] ?? array() );
	$decl_index  = -1;
	$vars_index  = -1;
	$props_index = -1;
	foreach ( $settings as $i => $s ) {
		if ( 'componentTmplProperties' === ( $s['name'] ?? '' ) ) {
			$decl_index = (int) $i;
		}
		if ( 'dataVars' === ( $s['name'] ?? '' ) ) {
			$vars_index = (int) $i;
		}
	}

	if ( -1 === $decl_index ) {
		$settings[] = array(
			'name'  => 'componentTmplProperties',
			'value' => array_values( $props ),
		);
	} else {
		$settings[ $decl_index ]['value'] = array_values( $props );
	}

	$vars = -1 !== $vars_index && is_array( $settings[ $vars_index ]['value'] ?? null ) ? $settings[ $vars_index ]['value'] : array();
	foreach ( $vars as $i => $entry ) {
		if ( 'props' === ( $entry['b1'] ?? '' ) ) {
			$props_index = (int) $i;
			break;
		}
	}
	$props_entry = array(
		'a1' => 'json',
		'b1' => 'props',
		'c1' => dbe_ability_props_defaults( $props ),
	);
	if ( array() === $props ) {
		if ( -1 !== $props_index ) {
			array_splice( $vars, $props_index, 1 );
		}
	} elseif ( -1 === $props_index ) {
		$vars[] = $props_entry;
	} else {
		$vars[ $props_index ] = $props_entry;
	}
	if ( -1 === $vars_index ) {
		$settings[] = array(
			'name'  => 'dataVars',
			'value' => $vars,
		);
	} else {
		$settings[ $vars_index ]['value'] = $vars;
	}

	$config['template']['settings'] = array_values( $settings );
	return $config;
}

/**
 * Summary row for one component: identity, declared properties, saved state.
 *
 * @param WP_Post $post Component post.
 * @return array
 */
function dbe_ability_component_summary( $post ) {
	$technologies = wp_get_object_terms( $post->ID, 'builderius_template_technology', array( 'fields' => 'slugs' ) );

	$props       = array();
	$branch_id   = null;
	$commit_name = null;
	$resolved    = dbe_ability_resolve_commit( $post );
	if ( ! is_wp_error( $resolved ) ) {
		$branch_id   = (int) $resolved['branch']->ID;
		$commit_name = (string) $resolved['commit']->post_name;
		foreach ( (array) ( $resolved['config']['template']['settings'] ?? array() ) as $s ) {
			if ( 'componentTmplProperties' === ( $s['name'] ?? '' ) && is_array( $s['value'] ?? null ) ) {
				$props = array_values( $s['value'] );
			}
		}
	}

	return array(
		'id'          => (int) $post->ID,
		'slug'        => (string) $post->post_name,
		'title'       => (string) $post->post_title,
		'technology'  => ! is_wp_error( $technologies ) && $technologies ? (string) $technologies[0] : '',
		'props'       => $props,
		'branch_id'   => $branch_id,
		'commit_name' => $commit_name,
	);
}

/**
 * Handle dbe/list-components.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_list_components( $input ) {
	$ref = trim( (string) ( $input['component'] ?? '' ) );
	if ( '' !== $ref ) {
		$post = dbe_ability_find_entity_post( $ref, 'component' );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		$posts = array( $post );
	} else {
		$posts = get_posts(
			array(
				'post_type'   => 'builderius_component',
				'post_status' => get_post_stati(),
				'numberposts' => -1,
				'orderby'     => 'ID',
				'order'       => 'DESC',
			)
		);
	}

	return array( 'components' => array_map( 'dbe_ability_component_summary', $posts ) );
}

/**
 * Handle dbe/create-component.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_create_component( $input ) {
	$title = trim( (string) ( $input['title'] ?? '' ) );
	if ( '' === $title ) {
		return new WP_Error( 'dbe_title_required', 'Pass a component title.' );
	}

	$props = array();
	foreach ( (array) ( $input['props'] ?? array() ) as $def ) {
		$valid = dbe_ability_validate_prop_def( (array) $def );
		if ( is_wp_error( $valid ) ) {
			return $valid;
		}
		foreach ( $props as $existing ) {
			if ( $existing['name'] === $valid['name'] ) {
				return new WP_Error( 'dbe_duplicate_prop', sprintf( 'Property "%s" is declared twice.', $valid['name'] ) );
			}
		}
		$props[] = $valid;
	}

	$gql_input = array(
		'title'      => $title,
		'technology' => trim( (string) ( $input['technology'] ?? 'html' ) ),
	);
	if ( ! empty( $input['name'] ) ) {
		$gql_input['name'] = (string) $input['name'];
	}

	$mutation = 'mutation DbeCreateComponent($input: BuilderiusCreateComponentInput!) {'
		. ' createComponent(input: $input) { component { id name title } }'
		. ' }';
	$data     = dbe_ability_graphql( 'dbeCreateComponent', $mutation, array( 'input' => $gql_input ) );
	if ( is_wp_error( $data ) ) {
		return $data;
	}
	$component_id = (int) ( $data['createComponent']['component']['id'] ?? 0 );
	if ( ! $component_id ) {
		return new WP_Error( 'dbe_create_failed', 'createComponent returned no component.' );
	}
	$post = get_post( $component_id );

	/*
	 * The mutation seeds an empty initial commit. Scaffold a builder-shaped
	 * config on top of it — through the same createCommit mutation — so the
	 * subtree/CSS/data abilities can work with the component immediately.
	 * The version stamp is copied from the global settings set's saved
	 * config, which always reflects this site's plugin versions.
	 */
	$version = array();
	$set     = dbe_ability_load_settings_set( '' );
	if ( ! is_wp_error( $set ) && is_array( $set['config']['version'] ?? null ) ) {
		$version = $set['config']['version'];
	}

	$root_id  = dbe_ability_make_id();
	$settings = array(
		array(
			'name'  => 'dataVars',
			'value' => array(
				array(
					'a1' => 'graphQLQuery',
					'b1' => 'wp',
					'c1' => "query {\n    post {\n        title: post_title\n        content: post_content\n    }\n}",
				),
			),
		),
	);
	$config   = array(
		'version'  => $version,
		'modules'  => array(
			$root_id => array(
				'id'       => $root_id,
				'name'     => 'HtmlElement',
				'label'    => $title,
				'parent'   => '',
				'settings' => array(
					array(
						'name'  => 'tag',
						'value' => 'div',
					),
				),
			),
		),
		'indexes'  => array(
			'root'   => array( $root_id ),
			$root_id => array(),
		),
		'template' => array(
			'technology' => $gql_input['technology'],
			'settings'   => $settings,
			'id'         => $component_id,
		),
	);
	if ( array() !== $props ) {
		$config = dbe_ability_sync_component_props( $config, $props );
	}

	$resolved = dbe_ability_resolve_commit( $post );
	if ( is_wp_error( $resolved ) ) {
		return $resolved;
	}
	$commit_name = dbe_ability_create_commit(
		$resolved['branch']->ID,
		$config,
		false,
		sprintf( 'Scaffold component "%s" via dbe/create-component', $post->post_name ),
		(string) $resolved['commit']->post_name
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	clean_post_cache( $component_id );
	return array( 'component' => dbe_ability_component_summary( get_post( $component_id ) ) );
}

/**
 * Handle dbe/manage-component-property.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_manage_component_property( $input ) {
	$action = (string) ( $input['action'] ?? '' );
	$name   = trim( (string) ( $input['name'] ?? '' ) );
	if ( ! in_array( $action, array( 'create', 'update', 'delete' ), true ) ) {
		return new WP_Error( 'dbe_bad_action', 'action must be create, update or delete.' );
	}

	$state = dbe_ability_load_scoped_setting(
		array(
			'template'    => (string) ( $input['component'] ?? '' ),
			'entity_type' => 'component',
		),
		'componentTmplProperties'
	);
	if ( is_wp_error( $state ) ) {
		return $state;
	}
	$loaded = $state['loaded'];
	$props  = $state['vars'];

	$existing_index = -1;
	foreach ( $props as $i => $def ) {
		if ( ( $def['name'] ?? '' ) === $name ) {
			$existing_index = (int) $i;
			break;
		}
	}

	$row = null;
	if ( 'delete' === $action ) {
		if ( -1 === $existing_index ) {
			return new WP_Error( 'dbe_no_prop', sprintf( 'No property "%s" — check dbe/list-components.', $name ) );
		}
		// Internals still reading [[props.x]] would silently resolve to
		// nothing; make the dependency visible instead of breaking it.
		$references = substr_count( wp_json_encode( $loaded['config']['modules'] ), 'props.' . $name );
		if ( $references > 0 ) {
			return new WP_Error(
				'dbe_prop_in_use',
				sprintf( 'The component\'s internals reference props.%s %d time(s) — remove those references first with dbe/apply-subtree-html (entity_type: "component").', $name, $references )
			);
		}
		array_splice( $props, $existing_index, 1 );
	} elseif ( 'create' === $action ) {
		if ( -1 !== $existing_index ) {
			return new WP_Error( 'dbe_prop_exists', sprintf( 'Property "%s" already exists — use action: update.', $name ) );
		}
		$valid = dbe_ability_validate_prop_def(
			array(
				'name'        => $name,
				'type'        => $input['type'] ?? 'text',
				'label'       => $input['label'] ?? '',
				'placeholder' => $input['placeholder'] ?? null,
				'options'     => $input['options'] ?? null,
			)
		);
		if ( is_wp_error( $valid ) ) {
			return $valid;
		}
		$props[] = $valid;
		$row     = $valid;
	} else {
		if ( -1 === $existing_index ) {
			return new WP_Error( 'dbe_no_prop', sprintf( 'No property "%s" — use action: create, or check dbe/list-components.', $name ) );
		}
		$current = $props[ $existing_index ];
		$valid   = dbe_ability_validate_prop_def(
			array(
				'name'        => $name,
				'type'        => $input['type'] ?? ( $current['type'] ?? 'text' ),
				'label'       => $input['label'] ?? ( $current['label'] ?? '' ),
				'placeholder' => array_key_exists( 'placeholder', $input ) ? $input['placeholder'] : ( $current['placeholder'] ?? null ),
				'options'     => $input['options'] ?? ( $current['options'] ?? null ),
			)
		);
		if ( is_wp_error( $valid ) ) {
			return $valid;
		}
		$props[ $existing_index ] = $valid;
		$row                      = $valid;
	}

	if ( ! empty( $input['dry_run'] ) ) {
		return array(
			'dry_run'     => true,
			'action'      => $action,
			'property'    => $row,
			'properties'  => array_values( $props ),
			'base_commit' => (string) $loaded['commit']->post_name,
		);
	}

	$preflight = dbe_ability_preflight( $loaded, $input, $state['slug'] );
	if ( is_wp_error( $preflight ) ) {
		return $preflight;
	}

	// Declarations and the derived `props` data variable must move together —
	// the render pipeline resolves instance overrides through that variable.
	$config = dbe_ability_sync_component_props( $loaded['config'], array_values( $props ) );

	$commit_name = dbe_ability_create_commit(
		$loaded['branch']->ID,
		$config,
		false,
		sprintf( '%s component property "%s" via dbe/manage-component-property', ucfirst( $action ), $name ),
		(string) ( $input['expected_commit'] ?? '' )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	return array(
		'dry_run'     => false,
		'action'      => $action,
		'property'    => $row,
		'properties'  => array_values( $props ),
		'commit_name' => $commit_name,
		'base_commit' => (string) $loaded['commit']->post_name,
	);
}

/**
 * Handle dbe/delete-component.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_delete_component( $input ) {
	if ( true !== ( $input['confirm'] ?? false ) ) {
		return new WP_Error( 'dbe_confirm_required', 'Deletion is permanent (branches and commit history included). Confirm with the user, then pass confirm: true.' );
	}
	$post = dbe_ability_find_entity_post( (string) ( $input['component'] ?? '' ), 'component' );
	if ( is_wp_error( $post ) ) {
		return $post;
	}
	$slug = (string) $post->post_name;

	$usage_query = 'query DbeCheckComponentUsage($id: Int!) {'
		. ' checkComponentUsage(id: $id) { id name title entity_type }'
		. ' }';
	$usage       = dbe_ability_graphql( 'dbeCheckComponentUsage', $usage_query, array( 'id' => (int) $post->ID ) );
	if ( is_wp_error( $usage ) ) {
		return $usage;
	}
	$locations = is_array( $usage['checkComponentUsage'] ?? null ) ? $usage['checkComponentUsage'] : array();
	if ( array() !== $locations ) {
		$names = array();
		foreach ( $locations as $location ) {
			$names[] = sprintf( '%s "%s"', (string) ( $location['entity_type'] ?? 'entity' ), (string) ( $location['name'] ?? $location['title'] ?? '?' ) );
		}
		return new WP_Error(
			'dbe_component_in_use',
			sprintf( 'Component "%s" is still used by: %s. Remove those instances first with dbe/apply-subtree-html.', $slug, implode( ', ', $names ) )
		);
	}

	$mutation = 'mutation DbeDeleteComponent($id: Int!) {'
		. ' deleteComponent(id: $id) { result message }'
		. ' }';
	$data     = dbe_ability_graphql( 'dbeDeleteComponent', $mutation, array( 'id' => (int) $post->ID ) );
	if ( is_wp_error( $data ) ) {
		return $data;
	}

	return array(
		'result'       => (bool) ( $data['deleteComponent']['result'] ?? false ),
		'message'      => (string) ( $data['deleteComponent']['message'] ?? '' ),
		'component_id' => (int) $post->ID,
		'slug'         => $slug,
	);
}
