<?php
/**
 * Builderius save/publish and release-state abilities.
 *
 * Owns saved-versus-published status, release creation and release extraction
 * while relying on the parent abilities module for entity loading, presence
 * preconditions, GraphQL dispatch, locks and commit infrastructure.
 *
 * @package Daveden_Builder_Enhancements
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register save/publish and release-state abilities.
 *
 * @param array $entity_type_arg Shared entity-type schema.
 * @param array $force_arg       Shared dirty-tab override schema.
 */
function dbe_register_publishing_abilities( $entity_type_arg, $force_arg ) {
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
