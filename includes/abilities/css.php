<?php
/**
 * Builderius CSS and commit-history abilities.
 *
 * Owns global and entity CSS reads, managed-block writes and CSS recovery
 * while relying on the parent abilities module for entity resolution,
 * optimistic concurrency, locks and commit creation.
 *
 * @package Daveden_Builder_Enhancements
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register CSS and commit-history abilities.
 *
 * @param array $settings_set_arg    Shared settings-set reference schema.
 * @param array $template_arg        Shared entity reference schema.
 * @param array $entity_type_arg     Shared entity-type schema.
 * @param array $expected_commit_arg Shared optimistic-concurrency schema.
 * @param array $force_arg           Shared dirty-tab override schema.
 */
function dbe_register_css_abilities( $settings_set_arg, $template_arg, $entity_type_arg, $expected_commit_arg, $force_arg ) {
	dbe_register_ability(
		'dbe/get-global-css',
		array(
			'label'               => __( 'Get global CSS', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Reads the site\'s saved global CSS — the ENTIRE framework stylesheet (reset, design tokens, utility classes), which the builder\'s update_global_css tool REPLACES wholesale rather than appending to. Returns the raw CSS plus the names of its named blocks (regions fenced by /* @block: name */ … /* @endblock */ comments). Pass block to fetch just one block\'s body instead of the whole stylesheet. To add or change CSS safely, prefer dbe/patch-global-css, which edits only a named block and can never clobber the framework.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'settings_set' => $settings_set_arg,
					'block'        => array(
						'type'        => 'string',
						'description' => __( 'Return only this named block\'s body (token-cheap).', 'daveden-builderius-enhancements' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'css'             => array( 'type' => 'string' ),
					'blocks'          => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
					'css_length'      => array( 'type' => 'integer' ),
					'settings_set_id' => array( 'type' => 'integer' ),
					'branch_id'       => array( 'type' => 'integer' ),
					'commit_name'     => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => 'dbe_ability_get_global_css',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/patch-global-css',
		array(
			'label'               => __( 'Patch global CSS (named block)', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Adds, replaces or deletes ONE named block in the global stylesheet — a region fenced by /* @block: name */ … /* @endblock */ — and saves the result as a new commit. Every byte outside the named block is preserved verbatim, so unlike update_global_css this can never wipe the framework. A block that does not exist yet is appended at the end of the stylesheet. Typical use: a "fonts" block holding @font-face rules plus a :root override of --heading-font-family / --body-font-family. Saving does not publish; run dbe/publish for the change to reach logged-out visitors (a logged-in user already sees saved commits).', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'block'           => array(
						'type'        => 'string',
						'pattern'     => '^[A-Za-z0-9_-]+$',
						'description' => __( 'The block name.', 'daveden-builderius-enhancements' ),
					),
					'css'             => array(
						'type'        => 'string',
						'maxLength'   => 1048576,
						'description' => __( 'The block\'s new body (omit when deleting).', 'daveden-builderius-enhancements' ),
					),
					'delete'          => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Remove the block entirely.', 'daveden-builderius-enhancements' ),
					),
					'dry_run'         => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview: return the action and resulting stylesheet length without saving.', 'daveden-builderius-enhancements' ),
					),
					'settings_set'    => $settings_set_arg,
					'expected_commit' => $expected_commit_arg,
					'force'           => $force_arg,
				),
				'required'             => array( 'block' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'action'      => array(
						'type' => 'string',
						'enum' => array( 'created', 'replaced', 'deleted' ),
					),
					'block'       => array( 'type' => 'string' ),
					'commit_name' => array(
						'type'        => 'string',
						'description' => __( 'The new commit (absent on a dry run).', 'daveden-builderius-enhancements' ),
					),
					'css_length'  => array( 'type' => 'integer' ),
					'dry_run'     => array( 'type' => 'boolean' ),
					'base_commit' => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => 'dbe_ability_patch_global_css',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/get-entity-css',
		array(
			'label'               => __( 'Get entity CSS', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Reads a template\'s saved entity CSS (the per-template stylesheet the builder\'s update_entity_css tool replaces wholesale). Returns the raw CSS plus the names of its named blocks (regions fenced by /* @block: name */ … /* @endblock */ comments). Pass block to fetch just one block\'s body. A template with no entity CSS returns an empty string, not an error. To add or change CSS safely, prefer dbe/patch-entity-css, which edits only a named block.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'    => $template_arg,
					'entity_type' => $entity_type_arg,
					'block'       => array(
						'type'        => 'string',
						'description' => __( 'Return only this named block\'s body (token-cheap).', 'daveden-builderius-enhancements' ),
					),
				),
				'required'             => array( 'template' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'css'         => array( 'type' => 'string' ),
					'blocks'      => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
					'css_length'  => array( 'type' => 'integer' ),
					'template_id' => array( 'type' => 'integer' ),
					'entity_type' => array( 'type' => 'string' ),
					'entity_id'   => array( 'type' => 'integer' ),
					'entity_slug' => array( 'type' => 'string' ),
					'branch_id'   => array( 'type' => 'integer' ),
					'commit_name' => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => 'dbe_ability_get_entity_css',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/patch-entity-css',
		array(
			'label'               => __( 'Patch entity CSS (named block)', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Adds, replaces or deletes ONE named block in a template\'s entity CSS — a region fenced by /* @block: name */ … /* @endblock */ — and saves the result as a new commit through Builderius\' own save channel, without touching the open builder store. CSS outside the named block is preserved verbatim. A block that does not exist yet is appended at the end; a template with no entity CSS at all gets one created. CAUTION: if a builder tab has that template open with unsaved changes, saving or closing that tab afterwards can overwrite this commit with the tab\'s stale copy — save or discard the tab first. Saving does not publish; run dbe/publish for the change to reach logged-out visitors.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'        => $template_arg,
					'entity_type'     => $entity_type_arg,
					'block'           => array(
						'type'        => 'string',
						'pattern'     => '^[A-Za-z0-9_-]+$',
						'description' => __( 'The block name.', 'daveden-builderius-enhancements' ),
					),
					'css'             => array(
						'type'        => 'string',
						'maxLength'   => 1048576,
						'description' => __( 'The block\'s new body (omit when deleting).', 'daveden-builderius-enhancements' ),
					),
					'delete'          => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Remove the block entirely.', 'daveden-builderius-enhancements' ),
					),
					'dry_run'         => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview: return the action and resulting stylesheet length without saving.', 'daveden-builderius-enhancements' ),
					),
					'expected_commit' => $expected_commit_arg,
					'force'           => $force_arg,
				),
				'required'             => array( 'template', 'block' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'action'      => array(
						'type' => 'string',
						'enum' => array( 'created', 'replaced', 'deleted' ),
					),
					'block'       => array( 'type' => 'string' ),
					'commit_name' => array(
						'type'        => 'string',
						'description' => __( 'The new commit (absent on a dry run).', 'daveden-builderius-enhancements' ),
					),
					'css_length'  => array( 'type' => 'integer' ),
					'dry_run'     => array( 'type' => 'boolean' ),
					'base_commit' => array( 'type' => 'string' ),
					'entity_type' => array( 'type' => 'string' ),
					'entity_id'   => array( 'type' => 'integer' ),
					'entity_slug' => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => 'dbe_ability_patch_entity_css',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/list-commits',
		array(
			'label'               => __( 'List saved commits', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Lists the saved commits of a template or of the global settings set (target "global"), newest first: name, date, description and — for the global set — each commit\'s stylesheet length, so a framework-clobbering save stands out as a sudden size drop. Use with dbe/restore-global-css-from-commit to roll the global CSS back to a pre-damage snapshot.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'target' => array(
						'type'        => 'string',
						'description' => __( '"global" (default) for the global settings set, or a template post ID/slug.', 'daveden-builderius-enhancements' ),
					),
					'limit'  => array(
						'type'        => 'integer',
						'default'     => 20,
						'description' => __( 'Maximum commits to return.', 'daveden-builderius-enhancements' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'commits'   => array(
						'type'  => 'array',
						'items' => array( 'type' => 'object' ),
					),
					'branch_id' => array( 'type' => 'integer' ),
					'active'    => array(
						'type'        => 'string',
						'description' => __( 'The active commit\'s name.', 'daveden-builderius-enhancements' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_list_commits',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/restore-global-css-from-commit',
		array(
			'label'               => __( 'Restore global CSS from a commit', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Recovery for a clobbered global stylesheet: reads the `css` setting from an earlier commit of the global settings set (find one with dbe/list-commits — a healthy framework is tens of KB) and saves it as a NEW commit, so the rollback is itself in history. Nothing else from the old commit is restored. Saving does not publish; run dbe/publish for the recovered CSS to reach logged-out visitors.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'commit'          => array(
						'type'        => 'string',
						'description' => __( 'The source commit name (from dbe/list-commits).', 'daveden-builderius-enhancements' ),
					),
					'dry_run'         => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview: return the source stylesheet\'s length and first lines without saving.', 'daveden-builderius-enhancements' ),
					),
					'settings_set'    => $settings_set_arg,
					'expected_commit' => $expected_commit_arg,
					'force'           => $force_arg,
				),
				'required'             => array( 'commit' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'commit_name'   => array(
						'type'        => 'string',
						'description' => __( 'The new commit holding the restored CSS (absent on a dry run).', 'daveden-builderius-enhancements' ),
					),
					'restored_from' => array( 'type' => 'string' ),
					'css_length'    => array( 'type' => 'integer' ),
					'preview'       => array(
						'type'        => 'string',
						'description' => __( 'First lines of the restored stylesheet (dry run only).', 'daveden-builderius-enhancements' ),
					),
					'dry_run'       => array( 'type' => 'boolean' ),
					'base_commit'   => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => 'dbe_ability_restore_global_css',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);
}

/**
 * Resolve a template reference to its saved entity CSS. Unlike the global
 * settings set, a template that has never had entity CSS simply lacks the
 * `css` settings entry — that is not an error; css_index -1 tells the
 * writer to append a fresh entry.
 *
 * @param string $template    Post ID or slug.
 * @param string $entity_type Entity type: template or component.
 * @return array|WP_Error { config, template_post, branch, commit, css, css_index }.
 */
function dbe_ability_load_entity_css( $template, $entity_type = 'template' ) {
	$loaded = dbe_ability_load_entity_config( $template, $entity_type );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}

	$css       = '';
	$css_index = -1;
	$settings  = $loaded['config']['template']['settings'] ?? array();
	foreach ( (array) $settings as $i => $s ) {
		if ( 'css' === ( $s['name'] ?? '' ) ) {
			$css       = (string) ( $s['value'] ?? '' );
			$css_index = (int) $i;
			break;
		}
	}

	$loaded['css']       = $css;
	$loaded['css_index'] = $css_index;
	return $loaded;
}

/*
 * ----------------------------------------------------------------------
 *  Global CSS named blocks (comment markers @block: name / @endblock)
 * ----------------------------------------------------------------------
 */

/**
 * Parse the named-block regions out of a stylesheet. A block is the region
 * between the `@block: name` comment marker and the next `@endblock`
 * comment marker; everything
 * outside blocks is the framework body, which patching never touches.
 *
 * @param string $css The full stylesheet.
 * @return array|WP_Error List of { name, start, end, body_start, body_end }
 *                        (string offsets; end is AFTER the endblock marker),
 *                        or an error for a start marker with no end.
 */
function dbe_ability_css_blocks( $css ) {
	return dbe_css_blocks_parse( $css );
}

/**
 * Replace, create or delete one named block in a stylesheet, leaving every
 * byte outside that block untouched — the fail-safe the raw replace-all
 * update_global_css channel lacks.
 *
 * @param string $css    The full stylesheet.
 * @param string $name   Block name ([A-Za-z0-9_-]+).
 * @param string $body   New block body (ignored when deleting).
 * @param bool   $delete Remove the block entirely.
 * @return array|WP_Error { css, action } where action is created|replaced|deleted.
 */
function dbe_ability_css_patch( $css, $name, $body, $delete = false ) {
	$blocks = dbe_ability_css_blocks( $css );
	if ( is_wp_error( $blocks ) ) {
		return $blocks;
	}
	$target = null;
	foreach ( $blocks as $b ) {
		if ( $b['name'] === $name ) {
			$target = $b;
			break;
		}
	}

	if ( $delete ) {
		if ( ! $target ) {
			return new WP_Error( 'dbe_no_block', sprintf( 'No block named "%s" to delete.', $name ) );
		}
		// Take a trailing newline with the block so no blank gap accrues.
		$end = $target['end'];
		if ( "\n" === substr( $css, $end, 1 ) ) {
			++$end;
		}
		return array(
			'css'    => substr( $css, 0, $target['start'] ) . substr( $css, $end ),
			'action' => 'deleted',
		);
	}

	$body = trim( (string) $body );
	if ( dbe_css_block_body_has_marker( $body ) ) {
		return new WP_Error( 'dbe_block_marker_in_body', 'A block body cannot contain @block or @endblock marker text.' );
	}
	if ( $target ) {
		return array(
			'css'    => substr( $css, 0, $target['body_start'] ) . "\n" . $body . "\n" . substr( $css, $target['body_end'] ),
			'action' => 'replaced',
		);
	}
	return array(
		'css'    => rtrim( $css ) . "\n\n/* @block: " . $name . " */\n" . $body . "\n/* @endblock */\n",
		'action' => 'created',
	);
}

/**
 * Write a new full stylesheet into the settings set's saved state as a new
 * commit (through Builderius' own mutation, like every other save here).
 *
 * @param array  $loaded      Result of dbe_ability_load_settings_set().
 * @param string $css         The new full stylesheet.
 * @param string $description     Commit description.
 * @param string $expected_commit Expected active commit name.
 * @return string|WP_Error The new commit name.
 */
function dbe_ability_save_global_css( $loaded, $css, $description, $expected_commit ) {
	$config = $loaded['config'];
	$config['template']['settings'][ $loaded['css_index'] ]['value'] = $css;
	return dbe_ability_create_commit(
		$loaded['branch']->ID,
		$config,
		false,
		$description,
		$expected_commit
	);
}

/*
 * ----------------------------------------------------------------------
 *  Global CSS execute callbacks
 * ----------------------------------------------------------------------
 */

/**
 * Handle dbe/get-global-css.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_get_global_css( $input ) {
	$loaded = dbe_ability_load_settings_set( $input['settings_set'] ?? '' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}
	$blocks = dbe_ability_css_blocks( $loaded['css'] );
	if ( is_wp_error( $blocks ) ) {
		return $blocks;
	}
	$names = wp_list_pluck( $blocks, 'name' );

	$css = $loaded['css'];
	if ( isset( $input['block'] ) && '' !== trim( (string) $input['block'] ) ) {
		$want = trim( (string) $input['block'] );
		$css  = null;
		foreach ( $blocks as $b ) {
			if ( $b['name'] === $want ) {
				$css = trim( substr( $loaded['css'], $b['body_start'], $b['body_end'] - $b['body_start'] ) );
				break;
			}
		}
		if ( null === $css ) {
			return new WP_Error(
				'dbe_no_block',
				sprintf( 'No block named "%s". Blocks: %s.', $want, $names ? implode( ', ', $names ) : '(none)' )
			);
		}
	}

	return array(
		'css'             => $css,
		'blocks'          => $names,
		'css_length'      => strlen( $loaded['css'] ),
		'settings_set_id' => $loaded['set_post']->ID,
		'branch_id'       => $loaded['branch']->ID,
		'commit_name'     => $loaded['commit']->post_name,
	);
}

/**
 * Handle dbe/patch-global-css.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_patch_global_css( $input ) {
	$block = trim( (string) ( $input['block'] ?? '' ) );
	if ( ! preg_match( '/^[A-Za-z0-9_-]+$/', $block ) ) {
		return new WP_Error( 'dbe_bad_block_name', 'Block names are letters, digits, hyphens and underscores.' );
	}
	$delete = ! empty( $input['delete'] );
	if ( isset( $input['css'] ) && strlen( (string) $input['css'] ) > 1048576 ) {
		return new WP_Error( 'dbe_css_too_large', 'A CSS block is limited to 1 MiB.' );
	}
	if ( ! $delete && ( ! isset( $input['css'] ) || '' === trim( (string) $input['css'] ) ) ) {
		return new WP_Error( 'dbe_no_css', 'Pass the block\'s css, or delete: true to remove it.' );
	}

	$loaded = dbe_ability_load_settings_set( $input['settings_set'] ?? '' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}
	if ( empty( $input['dry_run'] ) ) {
		$presence = dbe_ability_all_presence_precondition( ! empty( $input['force'] ) );
		if ( is_wp_error( $presence ) ) {
			return $presence;
		}
	}
	$preflight = dbe_ability_preflight( $loaded, $input );
	if ( is_wp_error( $preflight ) ) {
		return $preflight;
	}

	$patched = dbe_ability_css_patch( $loaded['css'], $block, (string) ( $input['css'] ?? '' ), $delete );
	if ( is_wp_error( $patched ) ) {
		return $patched;
	}
	if ( strlen( $patched['css'] ) > 2 * 1024 * 1024 ) {
		return new WP_Error( 'dbe_css_too_large', 'The resulting stylesheet exceeds the 2 MiB safety limit.' );
	}

	if ( ! empty( $input['dry_run'] ) ) {
		return array(
			'dry_run'     => true,
			'base_commit' => $loaded['commit']->post_name,
			'action'      => $patched['action'],
			'block'       => $block,
			'css_length'  => strlen( $patched['css'] ),
		);
	}

	$commit_name = dbe_ability_save_global_css(
		$loaded,
		$patched['css'],
		sprintf( '%s CSS block "%s" via dbe/patch-global-css', ucfirst( $patched['action'] ), $block ),
		(string) ( $input['expected_commit'] ?? '' )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	return array(
		'dry_run'     => false,
		'action'      => $patched['action'],
		'block'       => $block,
		'commit_name' => $commit_name,
		'base_commit' => $loaded['commit']->post_name,
		'css_length'  => strlen( $patched['css'] ),
	);
}

/**
 * Handle dbe/get-entity-css.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_get_entity_css( $input ) {
	$loaded = dbe_ability_load_entity_css( $input['template'] ?? '', $input['entity_type'] ?? 'template' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}
	$blocks = dbe_ability_css_blocks( $loaded['css'] );
	if ( is_wp_error( $blocks ) ) {
		return $blocks;
	}
	$names = wp_list_pluck( $blocks, 'name' );

	$css = $loaded['css'];
	if ( isset( $input['block'] ) && '' !== trim( (string) $input['block'] ) ) {
		$want = trim( (string) $input['block'] );
		$css  = null;
		foreach ( $blocks as $b ) {
			if ( $b['name'] === $want ) {
				$css = trim( substr( $loaded['css'], $b['body_start'], $b['body_end'] - $b['body_start'] ) );
				break;
			}
		}
		if ( null === $css ) {
			return new WP_Error(
				'dbe_no_block',
				sprintf( 'No block named "%s". Blocks: %s.', $want, $names ? implode( ', ', $names ) : '(none)' )
			);
		}
	}

	return array(
		'css'         => $css,
		'blocks'      => $names,
		'css_length'  => strlen( $loaded['css'] ),
		'template_id' => $loaded['template_post']->ID,
		'entity_type' => $loaded['entity_type'],
		'entity_id'   => $loaded['entity_post']->ID,
		'entity_slug' => $loaded['entity_post']->post_name,
		'branch_id'   => $loaded['branch']->ID,
		'commit_name' => $loaded['commit']->post_name,
	);
}

/**
 * Handle dbe/patch-entity-css.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_patch_entity_css( $input ) {
	$block = trim( (string) ( $input['block'] ?? '' ) );
	if ( ! preg_match( '/^[A-Za-z0-9_-]+$/', $block ) ) {
		return new WP_Error( 'dbe_bad_block_name', 'Block names are letters, digits, hyphens and underscores.' );
	}
	$delete = ! empty( $input['delete'] );
	if ( isset( $input['css'] ) && strlen( (string) $input['css'] ) > 1048576 ) {
		return new WP_Error( 'dbe_css_too_large', 'A CSS block is limited to 1 MiB.' );
	}
	if ( ! $delete && ( ! isset( $input['css'] ) || '' === trim( (string) $input['css'] ) ) ) {
		return new WP_Error( 'dbe_no_css', 'Pass the block\'s css, or delete: true to remove it.' );
	}

	$loaded = dbe_ability_load_entity_css( $input['template'] ?? '', $input['entity_type'] ?? 'template' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}
	$preflight = dbe_ability_preflight( $loaded, $input, $loaded['entity_post']->post_name );
	if ( is_wp_error( $preflight ) ) {
		return $preflight;
	}

	$patched = dbe_ability_css_patch( $loaded['css'], $block, (string) ( $input['css'] ?? '' ), $delete );
	if ( is_wp_error( $patched ) ) {
		return $patched;
	}
	if ( strlen( $patched['css'] ) > 2 * 1024 * 1024 ) {
		return new WP_Error( 'dbe_css_too_large', 'The resulting stylesheet exceeds the 2 MiB safety limit.' );
	}

	if ( ! empty( $input['dry_run'] ) ) {
		return array(
			'dry_run'     => true,
			'base_commit' => $loaded['commit']->post_name,
			'entity_type' => $loaded['entity_type'],
			'entity_id'   => $loaded['entity_post']->ID,
			'entity_slug' => $loaded['entity_post']->post_name,
			'action'      => $patched['action'],
			'block'       => $block,
			'css_length'  => strlen( $patched['css'] ),
		);
	}

	$config = $loaded['config'];
	if ( $loaded['css_index'] >= 0 ) {
		$config['template']['settings'][ $loaded['css_index'] ]['value'] = $patched['css'];
	} else {
		$config['template']['settings'][] = array(
			'name'  => 'css',
			'value' => $patched['css'],
		);
	}

	$commit_name = dbe_ability_create_commit(
		$loaded['branch']->ID,
		$config,
		false,
		sprintf( '%s CSS block "%s" via dbe/patch-entity-css', ucfirst( $patched['action'] ), $block ),
		(string) ( $input['expected_commit'] ?? '' )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	$out = array(
		'dry_run'     => false,
		'action'      => $patched['action'],
		'block'       => $block,
		'commit_name' => $commit_name,
		'base_commit' => $loaded['commit']->post_name,
		'entity_type' => $loaded['entity_type'],
		'entity_id'   => $loaded['entity_post']->ID,
		'entity_slug' => $loaded['entity_post']->post_name,
		'css_length'  => strlen( $patched['css'] ),
	);

	return $out;
}

/**
 * Handle dbe/list-commits.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_list_commits( $input ) {
	$target = trim( (string) ( $input['target'] ?? 'global' ) );
	$global = ( '' === $target || 'global' === $target );

	if ( $global ) {
		$loaded = dbe_ability_load_settings_set( $input['settings_set'] ?? '' );
	} else {
		$loaded = dbe_ability_load_config( $target );
	}
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}

	$limit   = max( 1, min( 100, (int) ( $input['limit'] ?? 20 ) ) );
	$commits = get_posts(
		array(
			'post_type'   => 'builderius_commit',
			'post_parent' => $loaded['branch']->ID,
			'post_status' => get_post_stati(),
			'numberposts' => $limit,
			'orderby'     => 'ID',
			'order'       => 'DESC',
		)
	);

	$rows = array();
	foreach ( $commits as $c ) {
		$row = array(
			'name'        => $c->post_name,
			'date'        => $c->post_date,
			'description' => $c->post_excerpt,
		);
		if ( $global ) {
			// The stylesheet length per commit: a framework clobber shows up
			// as a sudden drop from tens of KB to a few hundred bytes.
			$cfg = json_decode( (string) get_post_meta( $c->ID, 'content_config', true ), true );
			$len = null;
			foreach ( (array) ( $cfg['template']['settings'] ?? array() ) as $s ) {
				if ( 'css' === ( $s['name'] ?? '' ) ) {
					$len = strlen( (string) ( $s['value'] ?? '' ) );
					break;
				}
			}
			$row['css_length'] = $len;
		}
		$rows[] = $row;
	}

	return array(
		'commits'   => $rows,
		'branch_id' => $loaded['branch']->ID,
		'active'    => $loaded['commit']->post_name,
	);
}

/**
 * Handle dbe/restore-global-css-from-commit.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_restore_global_css( $input ) {
	$loaded = dbe_ability_load_settings_set( $input['settings_set'] ?? '' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}
	if ( empty( $input['dry_run'] ) ) {
		$presence = dbe_ability_all_presence_precondition( ! empty( $input['force'] ) );
		if ( is_wp_error( $presence ) ) {
			return $presence;
		}
	}
	$preflight = dbe_ability_preflight( $loaded, $input );
	if ( is_wp_error( $preflight ) ) {
		return $preflight;
	}

	$name  = trim( (string) ( $input['commit'] ?? '' ) );
	$found = get_posts(
		array(
			'post_type'   => 'builderius_commit',
			'post_parent' => $loaded['branch']->ID,
			'name'        => $name,
			'post_status' => get_post_stati(),
			'numberposts' => 1,
		)
	);
	if ( ! $found ) {
		return new WP_Error( 'dbe_no_source_commit', sprintf( 'No commit "%s" on the settings set\'s branch — check dbe/list-commits.', $name ) );
	}

	$cfg = json_decode( (string) get_post_meta( $found[0]->ID, 'content_config', true ), true );
	$css = null;
	foreach ( (array) ( $cfg['template']['settings'] ?? array() ) as $s ) {
		if ( 'css' === ( $s['name'] ?? '' ) ) {
			$css = (string) ( $s['value'] ?? '' );
			break;
		}
	}
	if ( null === $css || '' === $css ) {
		return new WP_Error( 'dbe_no_source_css', sprintf( 'Commit "%s" holds no css setting to restore.', $name ) );
	}

	if ( ! empty( $input['dry_run'] ) ) {
		return array(
			'dry_run'       => true,
			'base_commit'   => $loaded['commit']->post_name,
			'restored_from' => $name,
			'css_length'    => strlen( $css ),
			'preview'       => implode( "\n", array_slice( explode( "\n", $css ), 0, 12 ) ),
		);
	}

	$commit_name = dbe_ability_save_global_css(
		$loaded,
		$css,
		sprintf( 'Restore global CSS from commit %s via dbe/restore-global-css-from-commit', $name ),
		(string) ( $input['expected_commit'] ?? '' )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	return array(
		'dry_run'       => false,
		'commit_name'   => $commit_name,
		'base_commit'   => $loaded['commit']->post_name,
		'restored_from' => $name,
		'css_length'    => strlen( $css ),
	);
}
