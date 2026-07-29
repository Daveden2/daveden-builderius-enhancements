<?php
/**
 * Builderius JavaScript-snippet abilities.
 *
 * Owns global and entity JavaScript-snippet reads and writes while relying
 * on the parent abilities module for scoped-setting loading, optimistic
 * concurrency, locks and commit creation.
 *
 * @package Daveden_Builder_Enhancements
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register JavaScript-snippet abilities.
 *
 * @param array $settings_set_arg    Shared settings-set reference schema.
 * @param array $entity_type_arg     Shared entity-type schema.
 * @param array $expected_commit_arg Shared optimistic-concurrency schema.
 * @param array $force_arg           Shared dirty-tab override schema.
 */
function dbe_register_snippet_abilities( $settings_set_arg, $entity_type_arg, $expected_commit_arg, $force_arg ) {
	$js_scope_template_arg = array(
		'type'        => 'string',
		'description' => __( 'Template (or component) post ID or slug for that entity\'s snippets — the right scope for page-specific behaviour. Omit for the GLOBAL settings set: site-wide snippets loaded on every Builderius page.', 'daveden-builderius-enhancements' ),
	);

	dbe_register_ability(
		'dbe/get-js-snippets',
		array(
			'label'               => __( 'Get JS snippets', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Reads the Custom JS snippets from the saved state: the GLOBAL settings set by default (site-wide), or one template\'s snippets when template is passed. Each snippet has a label, generated id, code, and delivery options (external file vs inline, footer vs header, loading strategy, priority, enabled). Returns the branch and commit for the expected_commit save flow.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'     => $js_scope_template_arg,
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
					'snippets'    => array(
						'type'  => 'array',
						'items' => array( 'type' => 'object' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_get_js_snippets',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/manage-js-snippet',
		array(
			'label'               => __( 'Create, update or delete a JS snippet', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Creates, updates or deletes a Custom JS snippet in the saved state, committed through Builderius\' own mutation — the headless equivalent of the builder\'s JavaScript footer tool. Global scope by default (site-wide); pass template for page-specific snippets. Labels are snake_case (the builder UI cannot edit camelCase names). Defaults: served as a generated external file, in the footer, enabled. Write vanilla JS wrapped in DOMContentLoaded, use event delegation with data-* attribute hooks, and toggle CSS state classes rather than inline styles. Read dbe/get-js-snippets first for the current state and expected_commit. Saved snippets render for logged-in users immediately; logged-out visitors need dbe/publish.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'action'          => array(
						'type' => 'string',
						'enum' => array( 'create', 'update', 'delete' ),
					),
					'snippet'         => array(
						'type'        => 'string',
						'description' => __( 'The snippet\'s label or id. For create, the new snippet\'s label (snake_case, e.g. faq_accordion).', 'daveden-builderius-enhancements' ),
					),
					'new_label'       => array(
						'type'        => 'string',
						'description' => __( 'Update only: rename the snippet (snake_case). The generated id is stable across renames.', 'daveden-builderius-enhancements' ),
					),
					'code'            => array(
						'type'        => 'string',
						'maxLength'   => 262144,
						'description' => __( 'The JavaScript source. Required for create.', 'daveden-builderius-enhancements' ),
					),
					'footer'          => array(
						'type'        => 'boolean',
						'description' => __( 'Insert in the footer (default true) or the header (false).', 'daveden-builderius-enhancements' ),
					),
					'external'        => array(
						'type'        => 'boolean',
						'description' => __( 'Serve as a generated external .js file (default true) or as an inline script (false).', 'daveden-builderius-enhancements' ),
					),
					'loading'         => array(
						'type'        => 'string',
						'enum'        => array( '', 'async', 'defer' ),
						'description' => __( 'Loading strategy for external snippets.', 'daveden-builderius-enhancements' ),
					),
					'enabled'         => array( 'type' => 'boolean' ),
					'description'     => array(
						'type'        => 'string',
						'maxLength'   => 4096,
						'description' => __( 'Shown in the builder\'s snippet configure panel.', 'daveden-builderius-enhancements' ),
					),
					'priority'        => array(
						'type'        => 'integer',
						'description' => __( 'Load order among snippets; lower loads first. Default 10.', 'daveden-builderius-enhancements' ),
					),
					'template'        => $js_scope_template_arg,
					'entity_type'     => $entity_type_arg,
					'settings_set'    => $settings_set_arg,
					'dry_run'         => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview: validate and return the resulting snippet without saving.', 'daveden-builderius-enhancements' ),
					),
					'expected_commit' => $expected_commit_arg,
					'force'           => $force_arg,
				),
				'required'             => array( 'action', 'snippet' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'action'      => array( 'type' => 'string' ),
					'scope'       => array( 'type' => 'string' ),
					'snippet'     => array(
						'type'        => array( 'object', 'null' ),
						'description' => __( 'The resulting snippet (null after delete).', 'daveden-builderius-enhancements' ),
					),
					'commit_name' => array( 'type' => 'string' ),
					'base_commit' => array( 'type' => 'string' ),
					'dry_run'     => array( 'type' => 'boolean' ),
				),
			),
			'execute_callback'    => 'dbe_ability_manage_js_snippet',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);
}

/*
 * ----------------------------------------------------------------------
 *  Custom JS snippets (customJs in the saved config)
 * ----------------------------------------------------------------------
 */

/**
 * Ability-facing shape of a saved customJs entry. Absent h1/x1 mean
 * footer and enabled — the renderer's defaults.
 *
 * @param array $entry Saved entry (a1/b1/c1/d1/e1/h1/l1/x1/g1/p1 keys).
 * @return array
 */
function dbe_ability_js_snippet_row( $entry ) {
	return array(
		'label'       => (string) ( $entry['a1'] ?? '' ),
		'id'          => (string) ( $entry['b1'] ?? '' ),
		'code'        => (string) ( $entry['c1'] ?? '' ),
		'external'    => ! empty( $entry['e1'] ),
		'footer'      => ! isset( $entry['h1'] ) || false !== $entry['h1'],
		'loading'     => (string) ( $entry['l1'] ?? '' ),
		'enabled'     => ! isset( $entry['x1'] ) || false !== $entry['x1'],
		'description' => (string) ( $entry['g1'] ?? '' ),
		'priority'    => (int) ( ( $entry['p1'] ?? '' ) !== '' ? $entry['p1'] : 10 ),
	);
}

/**
 * Handle dbe/get-js-snippets.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_get_js_snippets( $input ) {
	$state = dbe_ability_load_scoped_setting( $input, 'customJs' );
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
		'snippets'    => array_map( 'dbe_ability_js_snippet_row', $state['vars'] ),
	);
}

/**
 * Handle dbe/manage-js-snippet.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_manage_js_snippet( $input ) {
	$action = (string) ( $input['action'] ?? '' );
	$ref    = trim( (string) ( $input['snippet'] ?? '' ) );
	if ( '' === $ref ) {
		return new WP_Error( 'dbe_snippet_required', 'Pass the snippet\'s label or id (the new label for create).' );
	}
	if ( isset( $input['code'] ) && strlen( (string) $input['code'] ) > 262144 ) {
		return new WP_Error( 'dbe_code_too_large', 'JavaScript snippets are limited to 256 KiB.' );
	}
	if ( isset( $input['description'] ) && strlen( (string) $input['description'] ) > 4096 ) {
		return new WP_Error( 'dbe_description_too_large', 'Snippet descriptions are limited to 4096 bytes.' );
	}
	if ( ! in_array( $action, array( 'create', 'update', 'delete' ), true ) ) {
		return new WP_Error( 'dbe_bad_action', 'action must be create, update or delete.' );
	}

	$state = dbe_ability_load_scoped_setting( $input, 'customJs' );
	if ( is_wp_error( $state ) ) {
		return $state;
	}
	$loaded   = $state['loaded'];
	$snippets = $state['vars'];

	// Resolve by exact id first, then by label; a duplicated label is
	// ambiguous and must be addressed by id.
	$existing_index = -1;
	$label_matches  = array();
	foreach ( $snippets as $i => $entry ) {
		if ( ( $entry['b1'] ?? '' ) === $ref ) {
			$existing_index = (int) $i;
			$label_matches  = array( (int) $i );
			break;
		}
		if ( ( $entry['a1'] ?? '' ) === $ref ) {
			$label_matches[] = (int) $i;
		}
	}
	if ( -1 === $existing_index && 1 === count( $label_matches ) ) {
		$existing_index = $label_matches[0];
	}
	if ( count( $label_matches ) > 1 ) {
		$ids = array();
		foreach ( $label_matches as $i ) {
			$ids[] = (string) ( $snippets[ $i ]['b1'] ?? '' );
		}
		return new WP_Error( 'dbe_ambiguous_snippet', sprintf( 'Several snippets are labelled "%s" — pass one of the ids: %s.', $ref, implode( ', ', $ids ) ) );
	}

	$snake = '/^[a-z][a-z0-9_]*$/';
	$row   = null;

	if ( 'create' === $action ) {
		if ( -1 !== $existing_index ) {
			return new WP_Error( 'dbe_snippet_exists', sprintf( 'Snippet "%s" already exists — use action: update.', $ref ) );
		}
		if ( ! preg_match( $snake, $ref ) ) {
			return new WP_Error( 'dbe_bad_snippet_label', 'Snippet labels are snake_case (faq_accordion, never faqAccordion) — camelCase labels become uneditable in the builder UI.' );
		}
		if ( '' === trim( (string) ( $input['code'] ?? '' ) ) ) {
			return new WP_Error( 'dbe_code_required', 'Pass the snippet\'s code.' );
		}
		$entry = array(
			'a1' => $ref,
			'b1' => 'snippet_' . (string) round( microtime( true ) * 1000 ),
			'c1' => (string) $input['code'],
			'd1' => array(),
			'e1' => ! isset( $input['external'] ) || false !== $input['external'],
		);
	} elseif ( 'delete' === $action ) {
		if ( -1 === $existing_index ) {
			return new WP_Error( 'dbe_no_snippet', sprintf( 'No snippet "%s" in this scope — check dbe/get-js-snippets.', $ref ) );
		}
	} else {
		if ( -1 === $existing_index ) {
			return new WP_Error( 'dbe_no_snippet', sprintf( 'No snippet "%s" in this scope — use action: create, or check dbe/get-js-snippets.', $ref ) );
		}
		$entry = $snippets[ $existing_index ];
		if ( ! empty( $input['new_label'] ) ) {
			$new_label = trim( (string) $input['new_label'] );
			if ( ! preg_match( $snake, $new_label ) ) {
				return new WP_Error( 'dbe_bad_snippet_label', 'Snippet labels are snake_case (faq_accordion, never faqAccordion).' );
			}
			$entry['a1'] = $new_label;
		}
		if ( isset( $input['code'] ) && '' !== trim( (string) $input['code'] ) ) {
			$entry['c1'] = (string) $input['code'];
		}
		if ( isset( $input['external'] ) ) {
			$entry['e1'] = (bool) $input['external'];
		}
	}

	if ( 'delete' !== $action ) {
		if ( isset( $input['footer'] ) ) {
			$entry['h1'] = (bool) $input['footer'];
		}
		if ( isset( $input['loading'] ) ) {
			$entry['l1'] = (string) $input['loading'];
		}
		if ( isset( $input['enabled'] ) ) {
			$entry['x1'] = (bool) $input['enabled'];
		}
		if ( isset( $input['description'] ) ) {
			$entry['g1'] = (string) $input['description'];
		}
		if ( isset( $input['priority'] ) ) {
			$entry['p1'] = (string) (int) $input['priority'];
		}
		$row = dbe_ability_js_snippet_row( $entry );
	}

	if ( 'delete' === $action ) {
		array_splice( $snippets, $existing_index, 1 );
	} elseif ( 'create' === $action ) {
		$snippets[] = $entry;
	} else {
		$snippets[ $existing_index ] = $entry;
	}

	if ( ! empty( $input['dry_run'] ) ) {
		return array(
			'dry_run'     => true,
			'action'      => $action,
			'scope'       => $state['scope'],
			'snippet'     => $row,
			'base_commit' => (string) $loaded['commit']->post_name,
		);
	}

	$commit_name = dbe_ability_save_scoped_setting(
		$state,
		'customJs',
		$snippets,
		$input,
		sprintf( '%s JS snippet "%s" via dbe/manage-js-snippet', ucfirst( $action ), 'update' === $action && ! empty( $input['new_label'] ) ? $ref . ' → ' . $input['new_label'] : $ref )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	return array(
		'dry_run'     => false,
		'action'      => $action,
		'scope'       => $state['scope'],
		'snippet'     => $row,
		'commit_name' => $commit_name,
		'base_commit' => (string) $loaded['commit']->post_name,
	);
}
