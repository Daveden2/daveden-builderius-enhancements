<?php
/**
 * Builderius dynamic-data abilities.
 *
 * Owns global and entity data-variable reads and writes while relying on
 * the parent abilities module for scoped-setting loading, optimistic
 * concurrency, locks and commit creation.
 *
 * @package Daveden_Builder_Enhancements
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register dynamic-data abilities.
 *
 * @param array $settings_set_arg    Shared settings-set reference schema.
 * @param array $entity_type_arg     Shared entity-type schema.
 * @param array $expected_commit_arg Shared optimistic-concurrency schema.
 * @param array $force_arg           Shared dirty-tab override schema.
 */
function dbe_register_data_abilities( $settings_set_arg, $entity_type_arg, $expected_commit_arg, $force_arg ) {
	$scope_template_arg = array(
		'type'        => 'string',
		'description' => __( 'Template (or component) post ID or slug for ENTITY-scoped variables. Omit to work on the GLOBAL settings set — data-variable-backed Collections usually bind global variables; literal JSON and URL sources do not need a data variable.', 'daveden-builderius-enhancements' ),
	);

	dbe_register_ability(
		'dbe/get-data-variables',
		array(
			'label'               => __( 'Get data variables', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Reads Builderius dynamic-data variables from the saved state: the GLOBAL settings set by default (data-variable-backed Collections can bind these with data-b-context="[[name.path]]" or data-b-context="[[[name.path]]]"), or one template\'s entity-scoped variables when template is passed. Collections can also use literal JSON or URL sources when those resolve to arrays. Each entry has name, type (graphQLQuery, json, …) and value (the GraphQL query text or JSON). The `wp` entry is the system variable (flagged system: true) — the current post/user/menu context. Returns the branch and commit for the expected_commit save flow.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'     => $scope_template_arg,
					'entity_type'  => $entity_type_arg,
					'settings_set' => $settings_set_arg,
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'scope'       => array(
						'type' => 'string',
						'enum' => array( 'global', 'entity' ),
					),
					'entity_id'   => array( 'type' => array( 'integer', 'null' ) ),
					'entity_slug' => array( 'type' => array( 'string', 'null' ) ),
					'branch_id'   => array( 'type' => 'integer' ),
					'commit_name' => array( 'type' => 'string' ),
					'variables'   => array(
						'type'  => 'array',
						'items' => array(
							'type'       => 'object',
							'properties' => array(
								'name'      => array( 'type' => 'string' ),
								'type'      => array( 'type' => 'string' ),
								'value'     => array( 'type' => 'string' ),
								'variables' => array( 'type' => array( 'string', 'null' ) ),
								'system'    => array( 'type' => 'boolean' ),
							),
						),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_get_data_variables',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/manage-data-variable',
		array(
			'label'               => __( 'Create, update or delete a data variable', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Creates, updates or deletes a Builderius dynamic-data variable in the saved state, committed through Builderius\' own mutation. Works on the GLOBAL settings set by default (usual for data-variable-backed Collection loops) or one template when template is passed. Names are snake_case (the builder UI cannot edit camelCase names). graphQLQuery values are syntax-checked before saving; verify the query actually returns data on the rendered page afterwards (logged-in users see saved commits — no publish needed). Collections may also use literal JSON or URL sources when no data variable is needed. The system `wp` variable cannot be created, renamed or deleted; updating its query needs allow_system: true — that is the headless equivalent of the builder\'s dynamic-data helpers (e.g. adding nav_menu or metabox_value fields for settings pages). Read dbe/get-data-variables first for the current state and expected_commit. An open builder tab will not see the change until reloaded — and its own save can overwrite this; the dirty-tab preflight protects against that.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'action'          => array(
						'type' => 'string',
						'enum' => array( 'create', 'update', 'delete' ),
					),
					'name'            => array(
						'type'        => 'string',
						'description' => __( 'The variable name. snake_case for create (e.g. team_data, never teamData).', 'daveden-builderius-enhancements' ),
					),
					'new_name'        => array(
						'type'        => 'string',
						'description' => __( 'Update only: rename the variable (snake_case). Bindings using the old name are NOT rewritten.', 'daveden-builderius-enhancements' ),
					),
					'type'            => array(
						'type'        => 'string',
						'enum'        => array( 'graphQLQuery', 'json' ),
						'default'     => 'graphQLQuery',
						'description' => __( 'Create only: the variable type.', 'daveden-builderius-enhancements' ),
					),
					'value'           => array(
						'type'        => 'string',
						'maxLength'   => 262144,
						'description' => __( 'The GraphQL query text (graphQLQuery) or JSON text (json). Required for create; optional on update (omit to keep the current value when only renaming).', 'daveden-builderius-enhancements' ),
					),
					'variables'       => array(
						'type'        => array( 'object', 'string', 'null' ),
						'description' => __( 'graphQLQuery only: GraphQL variables as a JSON object. Rarely needed.', 'daveden-builderius-enhancements' ),
					),
					'allow_system'    => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Required to update the system `wp` variable\'s query. Never allows renaming or deleting it.', 'daveden-builderius-enhancements' ),
					),
					'template'        => $scope_template_arg,
					'entity_type'     => $entity_type_arg,
					'settings_set'    => $settings_set_arg,
					'dry_run'         => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview: validate and return the resulting variable without saving.', 'daveden-builderius-enhancements' ),
					),
					'expected_commit' => $expected_commit_arg,
					'force'           => $force_arg,
				),
				'required'             => array( 'action', 'name' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'action'      => array( 'type' => 'string' ),
					'scope'       => array( 'type' => 'string' ),
					'variable'    => array(
						'type'        => array( 'object', 'null' ),
						'description' => __( 'The resulting variable (null after delete).', 'daveden-builderius-enhancements' ),
					),
					'commit_name' => array( 'type' => 'string' ),
					'base_commit' => array( 'type' => 'string' ),
					'dry_run'     => array( 'type' => 'boolean' ),
				),
			),
			'execute_callback'    => 'dbe_ability_manage_data_variable',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);
}

/**
 * Load the dataVars setting for the requested scope.
 *
 * @param array $input Ability input (template / entity_type / settings_set).
 * @return array|WP_Error { loaded, scope, slug, vars, vars_index }.
 */
function dbe_ability_load_data_vars( $input ) {
	return dbe_ability_load_scoped_setting( $input, 'dataVars' );
}

/**
 * Ability-facing shape of a saved dataVars entry.
 *
 * @param array $entry Saved entry (a1/b1/c1/d1 keys).
 * @return array
 */
function dbe_ability_data_var_row( $entry ) {
	return array(
		'name'      => (string) ( $entry['b1'] ?? '' ),
		'type'      => (string) ( $entry['a1'] ?? '' ),
		'value'     => is_string( $entry['c1'] ?? null ) ? $entry['c1'] : wp_json_encode( $entry['c1'] ?? null ),
		'variables' => isset( $entry['d1'] ) && null !== $entry['d1'] ? (string) $entry['d1'] : null,
		'system'    => 'wp' === ( $entry['b1'] ?? '' ),
	);
}

/**
 * Syntax-check a GraphQL document with Builderius' bundled parser. Schema
 * validation happens at render time; this catches broken documents before
 * they are committed.
 *
 * @param string $query GraphQL document.
 * @return true|WP_Error
 */
function dbe_ability_validate_graphql_syntax( $query ) {
	if ( ! class_exists( '\Builderius\GraphQL\Language\Parser' ) ) {
		return true;
	}
	try {
		\Builderius\GraphQL\Language\Parser::parse( $query );
	} catch ( \Throwable $e ) {
		return new WP_Error( 'dbe_bad_graphql', 'GraphQL syntax error: ' . $e->getMessage() );
	}
	return true;
}

/**
 * Handle dbe/get-data-variables.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_get_data_variables( $input ) {
	$state = dbe_ability_load_data_vars( $input );
	if ( is_wp_error( $state ) ) {
		return $state;
	}
	$loaded = $state['loaded'];

	return array(
		'scope'       => $state['scope'],
		'entity_id'   => 'entity' === $state['scope'] ? (int) $loaded['entity_post']->ID : null,
		'entity_slug' => 'entity' === $state['scope'] ? (string) $loaded['entity_post']->post_name : null,
		'branch_id'   => (int) $loaded['branch']->ID,
		'commit_name' => (string) $loaded['commit']->post_name,
		'variables'   => array_map( 'dbe_ability_data_var_row', $state['vars'] ),
	);
}

/**
 * Handle dbe/manage-data-variable.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_manage_data_variable( $input ) {
	$action = (string) ( $input['action'] ?? '' );
	$name   = trim( (string) ( $input['name'] ?? '' ) );
	if ( '' === $name ) {
		return new WP_Error( 'dbe_name_required', 'Pass the variable name.' );
	}
	if ( isset( $input['value'] ) && strlen( (string) $input['value'] ) > 262144 ) {
		return new WP_Error( 'dbe_value_too_large', 'A data-variable value is limited to 256 KiB.' );
	}
	if ( array_key_exists( 'variables', $input ) && null !== $input['variables'] ) {
		$variables_json = is_string( $input['variables'] ) ? $input['variables'] : wp_json_encode( $input['variables'] );
		if ( false === $variables_json || strlen( $variables_json ) > 65536 ) {
			return new WP_Error( 'dbe_variables_too_large', 'GraphQL variables are limited to 64 KiB of JSON.' );
		}
	}

	$state = dbe_ability_load_data_vars( $input );
	if ( is_wp_error( $state ) ) {
		return $state;
	}
	$loaded = $state['loaded'];
	$vars   = $state['vars'];

	$existing_index = -1;
	foreach ( $vars as $i => $entry ) {
		if ( ( $entry['b1'] ?? '' ) === $name ) {
			$existing_index = (int) $i;
			break;
		}
	}

	// The system variable: never created, renamed or deleted; its query is
	// editable only on explicit opt-in (the helper-equivalent channel).
	if ( 'wp' === $name && 'update' !== $action ) {
		return new WP_Error( 'dbe_system_variable', 'The `wp` variable is system-managed — it cannot be created or deleted.' );
	}
	if ( 'wp' === $name && empty( $input['allow_system'] ) ) {
		return new WP_Error( 'dbe_system_variable', 'Updating the system `wp` variable needs allow_system: true (and never a rename).' );
	}
	if ( 'wp' === $name && ! empty( $input['new_name'] ) ) {
		return new WP_Error( 'dbe_system_variable', 'The `wp` variable cannot be renamed.' );
	}

	$snake = '/^[a-z][a-z0-9_]*$/';
	$row   = null;

	if ( 'create' === $action ) {
		if ( -1 !== $existing_index ) {
			return new WP_Error( 'dbe_variable_exists', sprintf( 'Variable "%s" already exists — use action: update.', $name ) );
		}
		if ( ! preg_match( $snake, $name ) ) {
			return new WP_Error( 'dbe_bad_variable_name', 'Variable names are snake_case (team_data, never teamData) — camelCase names become uneditable in the builder UI.' );
		}
		$type  = (string) ( $input['type'] ?? 'graphQLQuery' );
		$value = (string) ( $input['value'] ?? '' );
		if ( '' === trim( $value ) ) {
			return new WP_Error( 'dbe_value_required', 'Pass the variable\'s value (GraphQL query or JSON).' );
		}
		$entry = array(
			'a1' => $type,
			'b1' => $name,
			'c1' => $value,
		);
	} elseif ( 'update' === $action ) {
		if ( -1 === $existing_index ) {
			return new WP_Error( 'dbe_no_variable', sprintf( 'No variable "%s" in this scope — use action: create, or check dbe/get-data-variables.', $name ) );
		}
		$entry = $vars[ $existing_index ];
		if ( ! empty( $input['new_name'] ) ) {
			$new_name = trim( (string) $input['new_name'] );
			if ( ! preg_match( $snake, $new_name ) ) {
				return new WP_Error( 'dbe_bad_variable_name', 'Variable names are snake_case (team_data, never teamData).' );
			}
			foreach ( $vars as $other ) {
				if ( ( $other['b1'] ?? '' ) === $new_name ) {
					return new WP_Error( 'dbe_variable_exists', sprintf( 'Variable "%s" already exists.', $new_name ) );
				}
			}
			$entry['b1'] = $new_name;
		}
		if ( isset( $input['value'] ) && '' !== trim( (string) $input['value'] ) ) {
			$entry['c1'] = (string) $input['value'];
		}
	} elseif ( 'delete' === $action ) {
		if ( -1 === $existing_index ) {
			return new WP_Error( 'dbe_no_variable', sprintf( 'No variable "%s" in this scope.', $name ) );
		}
	} else {
		return new WP_Error( 'dbe_bad_action', 'action must be create, update or delete.' );
	}

	if ( 'delete' !== $action ) {
		if ( array_key_exists( 'variables', $input ) && null !== $input['variables'] ) {
			$gql_vars = is_string( $input['variables'] ) ? $input['variables'] : wp_json_encode( $input['variables'], JSON_UNESCAPED_UNICODE );
			if ( null === json_decode( (string) $gql_vars, true ) ) {
				return new WP_Error( 'dbe_bad_variables', 'variables must be valid JSON.' );
			}
			$entry['d1'] = (string) $gql_vars;
		}
		$type = (string) ( $entry['a1'] ?? 'graphQLQuery' );
		if ( 'graphQLQuery' === $type ) {
			$valid = dbe_ability_validate_graphql_syntax( (string) $entry['c1'] );
			if ( is_wp_error( $valid ) ) {
				return $valid;
			}
		} elseif ( 'json' === $type && is_string( $entry['c1'] ) && null === json_decode( $entry['c1'], true ) ) {
			return new WP_Error( 'dbe_bad_json', 'The value is not valid JSON.' );
		}
		$row = dbe_ability_data_var_row( $entry );
	}

	if ( 'delete' === $action ) {
		array_splice( $vars, $existing_index, 1 );
	} elseif ( 'create' === $action ) {
		$vars[] = $entry;
	} else {
		$vars[ $existing_index ] = $entry;
	}

	if ( ! empty( $input['dry_run'] ) ) {
		return array(
			'dry_run'     => true,
			'action'      => $action,
			'scope'       => $state['scope'],
			'variable'    => $row,
			'base_commit' => (string) $loaded['commit']->post_name,
		);
	}

	$commit_name = dbe_ability_save_scoped_setting(
		$state,
		'dataVars',
		$vars,
		$input,
		sprintf( '%s data variable "%s" via dbe/manage-data-variable', ucfirst( $action ), 'update' === $action && ! empty( $input['new_name'] ) ? $name . ' → ' . $input['new_name'] : $name )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	return array(
		'dry_run'     => false,
		'action'      => $action,
		'scope'       => $state['scope'],
		'variable'    => $row,
		'commit_name' => $commit_name,
		'base_commit' => (string) $loaded['commit']->post_name,
	);
}
