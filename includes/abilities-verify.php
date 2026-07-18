<?php
/**
 * Agent-facing dynamic-data verification abilities (PROTOTYPE).
 *
 * The verification half of the dynamic-data workflow (see
 * MILESTONE-dynamic-data-ai.md): rendered-output checks so agents can prove a
 * dynamic-data change actually renders instead of trusting a saved commit.
 *
 *  - dbe/check-rendered-output   fetch one authenticated front-end render and
 *                                scan it for the silent dynamic-data failure
 *                                classes (leaked <template>, unresolved
 *                                bindings, PHP notices, missing/blank values)
 *  - dbe/check-render-scenarios  run the same scan across a matrix of query
 *                                parameters/cookies (filters, pagination,
 *                                recursive roots, falsey inputs)
 *  - dbe/get-dynamic-data-schema live GraphQL schema discovery (via
 *                                introspection through Builderius' own
 *                                dynamic-data request channel)
 *  - dbe/resolve-data-variable   schema-validate AND actually resolve one
 *                                data variable in a chosen page context
 *  - dbe/inspect-binding-value   resolved type/shape at a binding path —
 *                                catches scalar/object Collection sources
 *                                before they reach Mustache
 *  - dbe/get-rendered-styles     the authored CSS rules that match one
 *                                module, entity and global scope combined
 *
 * Dynamic-data resolution rides Builderius' own front-end channel: a POST to
 * any page URL with ?builderius_data_request and a JSON dataVars payload is
 * answered (for builderius-development users) with the resolved values, with
 * the page's real WordPress query context established. GraphQL introspection
 * executes through the same channel, which also powers real schema
 * validation via Builderius' bundled graphql-php.
 *
 * The loopback fetch authenticates with a single-use, 60-second token bound
 * to the invoking user, carried in a request header and redeemed through
 * determine_current_user — so the fetched page renders exactly what that
 * logged-in user would see (dev-branch saves included), without cookies or
 * passwords. Only same-site URLs are fetchable.
 *
 * @package Daveden_Builder_Enhancements
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_abilities_api_init', 'dbe_register_verify_abilities' );

/**
 * Register the verification abilities.
 */
function dbe_register_verify_abilities() {
	$expect_args = array(
		'expect'          => array(
			'type'        => 'array',
			'items'       => array( 'type' => 'string' ),
			'description' => __( 'Plain-text strings that MUST appear in the rendered HTML.', 'daveden-builderius-enhancements' ),
		),
		'absent'          => array(
			'type'        => 'array',
			'items'       => array( 'type' => 'string' ),
			'description' => __( 'Plain-text strings that must NOT appear (e.g. a row that a filter should exclude).', 'daveden-builderius-enhancements' ),
		),
		'nonblank_labels' => array(
			'type'        => 'array',
			'items'       => array( 'type' => 'string' ),
			'description' => __( 'Label texts that must be followed by visible non-blank text — catches bindings that resolve to empty (numeric 0, "0", null and "" all render blank).', 'daveden-builderius-enhancements' ),
		),
	);

	dbe_register_ability(
		'dbe/check-rendered-output',
		array(
			'label'               => __( 'Check rendered output', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Fetches one front-end page as the invoking user (an authenticated loopback — logged-in users see saved dev-branch commits, so no publish is needed) and scans the HTML for the dynamic-data failures that save-time validation cannot catch: leaked <template> elements, unresolved [[...]] or {{...}} bindings, PHP warnings/fatals, missing expected text, unexpectedly present text, and labels with blank values. Interactive (client-side URL-source) Collections are exempt from the template/binding scan — their markup legitimately ships to the browser. A saved data variable with a bad nested field, a scalar Collection source or a runtime resolver failure all pass dbe/manage-data-variable but fail here — run this after every dynamic-data save. Pass page (post ID or path) or a same-site url, plus optional query args.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array_merge(
					array(
						'page'  => array(
							'type'        => 'string',
							'description' => __( 'WordPress post ID or path (e.g. "dbe-dynamic-stress" or "/events/") to fetch. Use this OR url.', 'daveden-builderius-enhancements' ),
						),
						'url'   => array(
							'type'        => 'string',
							'description' => __( 'Full same-site URL to fetch. Other hosts are refused.', 'daveden-builderius-enhancements' ),
						),
						'query' => array(
							'type'                 => 'object',
							'additionalProperties' => array( 'type' => 'string' ),
							'description'          => __( 'Query parameters to append, e.g. {"topic": "dbe-stress-build", "listing_page": "2"}.', 'daveden-builderius-enhancements' ),
						),
					),
					$expect_args
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'passed'      => array( 'type' => 'boolean' ),
					'url'         => array( 'type' => 'string' ),
					'status_code' => array( 'type' => 'integer' ),
					'failures'    => array(
						'type'        => 'array',
						'description' => __( 'Each failure: check, message, and up to five matches with line numbers.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
					'html_length' => array( 'type' => 'integer' ),
				),
			),
			'execute_callback'    => 'dbe_ability_check_rendered_output',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/check-render-scenarios',
		array(
			'label'               => __( 'Check render scenarios', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Runs dbe/check-rendered-output across a matrix of request scenarios against one page — each scenario sets its own query parameters and/or cookies and its own expectations. This is how URL-driven listings are proven: default filters, a valid override, an invalid value falling back, pagination pages, cookie-segmented content and recursive roots, in one call. Shared expect/absent/nonblank_labels apply to every scenario on top of the per-scenario ones. At most ten scenarios per call; every scenario fetch runs the full failure scan (leaked templates, unresolved bindings, PHP errors).', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array_merge(
					array(
						'page'      => array(
							'type'        => 'string',
							'description' => __( 'WordPress post ID or path to fetch. Use this OR url.', 'daveden-builderius-enhancements' ),
						),
						'url'       => array(
							'type'        => 'string',
							'description' => __( 'Full same-site URL to fetch. Other hosts are refused.', 'daveden-builderius-enhancements' ),
						),
						'scenarios' => array(
							'type'        => 'array',
							'description' => __( 'Up to ten scenarios. Each: { label, query?: {name: value}, cookies?: {name: value}, expect?: [], absent?: [], nonblank_labels?: [] }.', 'daveden-builderius-enhancements' ),
							'items'       => array(
								'type'                 => 'object',
								'properties'           => array(
									'label'           => array( 'type' => 'string' ),
									'query'           => array(
										'type' => 'object',
										'additionalProperties' => array( 'type' => 'string' ),
									),
									'cookies'         => array(
										'type' => 'object',
										'additionalProperties' => array( 'type' => 'string' ),
									),
									'expect'          => array(
										'type'  => 'array',
										'items' => array( 'type' => 'string' ),
									),
									'absent'          => array(
										'type'  => 'array',
										'items' => array( 'type' => 'string' ),
									),
									'nonblank_labels' => array(
										'type'  => 'array',
										'items' => array( 'type' => 'string' ),
									),
								),
								'required'             => array( 'label' ),
								'additionalProperties' => false,
							),
						),
					),
					$expect_args
				),
				'required'             => array( 'scenarios' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'passed'    => array( 'type' => 'boolean' ),
					'scenarios' => array(
						'type'        => 'array',
						'description' => __( 'Per scenario: label, url, status_code, passed and failures.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_check_render_scenarios',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	$context_args = array(
		'page'  => array(
			'type'        => 'string',
			'description' => __( 'WordPress post ID or path establishing the resolution context (current post, archive, URL parameters). Defaults to the site front page.', 'daveden-builderius-enhancements' ),
		),
		'url'   => array(
			'type'        => 'string',
			'description' => __( 'Full same-site URL establishing the context instead of page.', 'daveden-builderius-enhancements' ),
		),
		'query' => array(
			'type'                 => 'object',
			'additionalProperties' => array( 'type' => 'string' ),
			'description'          => __( 'Query parameters for the context request — url_parameter() resolvers read these.', 'daveden-builderius-enhancements' ),
		),
	);

	dbe_register_ability(
		'dbe/get-dynamic-data-schema',
		array(
			'label'               => __( 'Get the dynamic-data GraphQL schema', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Returns the LIVE Builderius dynamic-data GraphQL schema — the Root query type every data variable runs against, including fields added by Builderius Pro, ACF, Meta Box and other integrations on this site. No open builder tab is needed. By default returns the Root fields (name, arguments, return type) and an index of type names; pass type to expand one type\'s fields, or search to find fields/types by name fragment. Use this instead of guessing field names: a wrong nested field saves fine but silently blanks the whole variable at render.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'type'    => array(
						'type'        => 'string',
						'description' => __( 'A type name to expand (e.g. Post, User, Term, Pagination). Case-sensitive.', 'daveden-builderius-enhancements' ),
					),
					'search'  => array(
						'type'        => 'string',
						'description' => __( 'Case-insensitive fragment matched against type and field names (e.g. "acf", "meta", "pagination").', 'daveden-builderius-enhancements' ),
					),
					'refresh' => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Bypass the cached schema (use after activating a plugin that extends it).', 'daveden-builderius-enhancements' ),
					),
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'root_fields' => array(
						'type'        => 'array',
						'description' => __( 'The Root query fields: name, args, type.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
					'type'        => array(
						'type'        => array( 'object', 'null' ),
						'description' => __( 'The expanded type (name, kind, fields) when type was passed.', 'daveden-builderius-enhancements' ),
					),
					'matches'     => array(
						'type'        => 'array',
						'description' => __( 'Search hits as "Type.field: ReturnType" rows when search was passed.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
					'type_names'  => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_get_dynamic_data_schema',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/resolve-data-variable',
		array(
			'label'               => __( 'Resolve a data variable', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Validates AND actually resolves one dynamic-data variable, returning its runtime value in a chosen page context — the missing proof step between "the query saved" and "the page renders". The query is first validated against the live GraphQL schema (unknown fields and bad arguments are reported with messages, which dbe/manage-data-variable\'s syntax check cannot see), then executed through Builderius\' own dynamic-data channel with the context page\'s real WordPress query state, so wp/current-post/url_parameter resolvers behave exactly as on the front end. Pass name for a saved variable (its [[dep]] dependencies resolve too) or graphql_query for an ad-hoc probe. Large values are compacted (lists truncated, long strings clipped) unless full: true.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array_merge(
					array(
						'name'          => array(
							'type'        => 'string',
							'description' => __( 'A saved data variable name. Global scope by default; pass template for entity scope.', 'daveden-builderius-enhancements' ),
						),
						'graphql_query' => array(
							'type'        => 'string',
							'description' => __( 'An ad-hoc GraphQL query to resolve instead of a saved variable. Saved global variables are still available as [[dep]] interpolations. (The query parameter carries URL parameters for the context request instead.)', 'daveden-builderius-enhancements' ),
						),
						'template'      => array(
							'type'        => 'string',
							'description' => __( 'Template (or component) post ID or slug for ENTITY-scoped variables. Omit for the global settings set.', 'daveden-builderius-enhancements' ),
						),
						'entity_type'   => array(
							'type'        => 'string',
							'enum'        => array( 'template', 'component' ),
							'default'     => 'template',
							'description' => __( 'Entity type when template is passed.', 'daveden-builderius-enhancements' ),
						),
						'settings_set'  => array(
							'type'        => 'string',
							'description' => __( 'Global settings set post ID or slug. Omit when the site has one.', 'daveden-builderius-enhancements' ),
						),
						'full'          => array(
							'type'        => 'boolean',
							'default'     => false,
							'description' => __( 'Return the complete value without compaction. Use only when the compact preview is not enough.', 'daveden-builderius-enhancements' ),
						),
					),
					$context_args
				),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'validation' => array(
						'type'        => 'object',
						'description' => __( 'Schema validation: valid plus error messages (an invalid query is still executed so you can see the runtime effect).', 'daveden-builderius-enhancements' ),
					),
					'value'      => array(
						'description' => __( 'The resolved value (compacted unless full: true; compaction is flagged in truncated).', 'daveden-builderius-enhancements' ),
					),
					'truncated'  => array( 'type' => 'boolean' ),
					'value_size' => array(
						'type'        => 'integer',
						'description' => __( 'Byte length of the full JSON-encoded value.', 'daveden-builderius-enhancements' ),
					),
					'url'        => array( 'type' => 'string' ),
					'resolved'   => array(
						'type'        => 'array',
						'description' => __( 'Every variable name resolved in the request (the target plus its dependencies).', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'string' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_resolve_data_variable',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/inspect-binding-value',
		array(
			'label'               => __( 'Inspect a binding value', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Reports the resolved type and compact shape at a binding path — run this on a Collection\'s data-b-context source BEFORE binding it, because a source that is not an array renders a silent empty loop (scalars/null leave the <template> markup in the page; an object renders exactly once). Accepts a saved-variable path ("var.path.to.items", with or without [[ ]]/[[[ ]]] wrapping) or a literal JSON source. Returns the value\'s type, list/object classification, row count, first-row keys, a small preview, and whether it is safe as a Collection source in the chosen page context.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array_merge(
					array(
						'binding'      => array(
							'type'        => 'string',
							'description' => __( 'The binding to inspect: "var.path.to.items", "[[var.path]]", "[[[var.path]]]", or a literal JSON array/object.', 'daveden-builderius-enhancements' ),
						),
						'template'     => array(
							'type'        => 'string',
							'description' => __( 'Template (or component) post ID or slug for ENTITY-scoped variables. Omit for the global settings set.', 'daveden-builderius-enhancements' ),
						),
						'entity_type'  => array(
							'type'        => 'string',
							'enum'        => array( 'template', 'component' ),
							'default'     => 'template',
							'description' => __( 'Entity type when template is passed.', 'daveden-builderius-enhancements' ),
						),
						'settings_set' => array(
							'type'        => 'string',
							'description' => __( 'Global settings set post ID or slug. Omit when the site has one.', 'daveden-builderius-enhancements' ),
						),
					),
					$context_args
				),
				'required'             => array( 'binding' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'resolved_type'   => array(
						'type'        => 'string',
						'description' => __( 'list | object | string | number | boolean | null | missing.', 'daveden-builderius-enhancements' ),
					),
					'collection_safe' => array(
						'type'        => 'boolean',
						'description' => __( 'Whether this value is safe as a Collection source (a non-empty list of rows).', 'daveden-builderius-enhancements' ),
					),
					'count'           => array( 'type' => array( 'integer', 'null' ) ),
					'item_keys'       => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
					'preview'         => array(
						'description' => __( 'Compacted value preview.', 'daveden-builderius-enhancements' ),
					),
					'warnings'        => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
					'url'             => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => 'dbe_ability_inspect_binding_value',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/resolve-metabox-field',
		array(
			'label'               => __( 'Resolve a Meta Box field', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Maps a Meta Box field to the exact ways Builderius dynamic data can read it, so agents stop guessing: the builder\'s auto-generated helper name (derived from the slugified field LABEL, not the id — field id rc_number labelled "RC Number (CAC)" becomes wp.…__rc_number_cac_), the GraphQL accessor and arguments for headless data variables (settings-page fields need option_name, the storage owner, which is NOT always the admin page id), group children, and the array/clone caveats. Searches every registered field by id or label fragment across posts, users, terms and settings pages. Term fields get a warning: Builderius ships no term Meta Box helper and term meta_value() has returned false in testing — use a php_function_output wrapper.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'field'       => array(
						'type'        => 'string',
						'description' => __( 'The field id, or a fragment of the id or label, to search for.', 'daveden-builderius-enhancements' ),
					),
					'object_type' => array(
						'type'        => 'string',
						'enum'        => array( 'post', 'user', 'term', 'setting', 'network_setting', 'comment' ),
						'description' => __( 'Limit the search to one Meta Box object type.', 'daveden-builderius-enhancements' ),
					),
				),
				'required'             => array( 'field' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'matches' => array(
						'type'        => 'array',
						'description' => __( 'Per field: id, label, type, object_type, context (post type or settings page), builder_helper, graphql read recipe, children, warnings.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
					'total'   => array(
						'type'        => 'integer',
						'description' => __( 'Total matches before the 20-row cap.', 'daveden-builderius-enhancements' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_resolve_metabox_field',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/get-rendered-styles',
		array(
			'label'               => __( 'Get a module\'s matched styles', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Returns the authored CSS rules that target one module, gathered from the saved entity CSS and the global stylesheet — the headless stand-in for the builder\'s computed-styles tool when no live builder tab is connected. Rules are matched against the module\'s tag, id, classes and its uni-node id (per-module %local% styles compile to .uni-node-<id> selectors), with their media-query context preserved. This reports what the stylesheets SAY, not what a browser computed — cascade order and specificity are returned so you can reason about conflicts, but inherited values and runtime layout are out of scope.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'       => array(
						'type'        => 'string',
						'description' => __( 'Template or component post ID or slug.', 'daveden-builderius-enhancements' ),
					),
					'entity_type'    => array(
						'type'        => 'string',
						'enum'        => array( 'template', 'component' ),
						'default'     => 'template',
						'description' => __( 'Entity type of the template reference.', 'daveden-builderius-enhancements' ),
					),
					'module_id'      => array(
						'type'        => 'string',
						'description' => __( 'The module whose matched rules to report (find ids with dbe/get-tree-outline).', 'daveden-builderius-enhancements' ),
					),
					'include_global' => array(
						'type'        => 'boolean',
						'default'     => true,
						'description' => __( 'Also match rules from the global stylesheet (framework classes).', 'daveden-builderius-enhancements' ),
					),
				),
				'required'             => array( 'template', 'module_id' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'module' => array(
						'type'        => 'object',
						'description' => __( 'The module\'s identity: id, tag, html id, classes, label.', 'daveden-builderius-enhancements' ),
					),
					'rules'  => array(
						'type'        => 'array',
						'description' => __( 'Matched rules in source order: selector, declarations, media, source (entity|global), matched_by.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_get_rendered_styles',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);
}

/*
 * ----------------------------------------------------------------------
 *  Authenticated loopback fetch
 * ----------------------------------------------------------------------
 */

add_filter( 'determine_current_user', 'dbe_ability_render_token_user', 30 );

/**
 * Redeem a loopback render token: single use, 60-second TTL, bound to the
 * user who minted it. The token only ever reaches this site (the fetcher
 * refuses foreign hosts), travels in a header (never logged in access logs
 * or cached as part of the URL) and grants nothing the minting user does
 * not already have.
 *
 * @param int|false $user_id The user determined so far.
 * @return int|false
 */
function dbe_ability_render_token_user( $user_id ) {
	if ( $user_id ) {
		return $user_id;
	}
	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- the token is only hashed and compared, never stored or echoed.
	$token = isset( $_SERVER['HTTP_X_DBE_RENDER_TOKEN'] ) ? (string) wp_unslash( $_SERVER['HTTP_X_DBE_RENDER_TOKEN'] ) : '';
	if ( '' === $token || strlen( $token ) > 128 ) {
		return $user_id;
	}
	$key   = 'dbe_render_token_' . hash( 'sha256', $token );
	$grant = get_transient( $key );
	if ( ! is_array( $grant ) || empty( $grant['user'] ) ) {
		return $user_id;
	}
	delete_transient( $key ); // Single use.
	return (int) $grant['user'];
}

/**
 * Resolve the ability's page/url/query input to one same-site URL.
 *
 * @param array $input Ability input (page / url / query).
 * @return string|WP_Error The URL to fetch.
 */
function dbe_ability_render_url( $input ) {
	$page = trim( (string) ( $input['page'] ?? '' ) );
	$url  = trim( (string) ( $input['url'] ?? '' ) );

	if ( '' !== $page ) {
		if ( is_numeric( $page ) ) {
			$permalink = get_permalink( (int) $page );
			if ( ! $permalink ) {
				return new WP_Error( 'dbe_no_page', sprintf( 'No permalink for post ID %d.', (int) $page ) );
			}
			$url = $permalink;
		} else {
			// Canonical form up front: a non-canonical path 301s, and although the
			// fetcher follows same-site redirects with fresh tokens, one hop saved
			// is one loopback saved.
			$url = home_url( user_trailingslashit( '/' . ltrim( $page, '/' ) ) );
		}
	}
	if ( '' === $url ) {
		return new WP_Error( 'dbe_url_required', 'Pass page (post ID or path) or a same-site url.' );
	}

	$home = wp_parse_url( home_url() );
	$req  = wp_parse_url( $url );
	if ( ! is_array( $req ) || empty( $req['host'] ) ) {
		return new WP_Error( 'dbe_bad_url', 'The url could not be parsed.' );
	}
	if ( strtolower( $req['host'] ) !== strtolower( (string) ( $home['host'] ?? '' ) ) ) {
		return new WP_Error( 'dbe_foreign_host', sprintf( 'Only this site (%s) can be fetched — the authenticated loopback must not leak to other hosts.', (string) ( $home['host'] ?? '' ) ) );
	}

	$query = $input['query'] ?? array();
	if ( is_array( $query ) && array() !== $query ) {
		$pairs = array();
		foreach ( $query as $name => $value ) {
			$pairs[ (string) $name ] = (string) $value;
		}
		$url = add_query_arg( array_map( 'rawurlencode', $pairs ), $url );
	}

	return $url;
}

/**
 * Fetch one same-site URL as the current user via a single-use render token.
 *
 * Redirects are followed manually (at most two hops, same-site only), each
 * hop with a FRESH token: the token is single-use, so letting the HTTP layer
 * follow a canonical-slash 301 would replay a consumed token and silently
 * demote the second request to an anonymous render — the published release
 * or theme fallback instead of the dev branch.
 *
 * @param string $url     The (already validated same-site) URL.
 * @param array  $cookies Cookie name => value pairs for the request.
 * @return array|WP_Error { body, status_code, url }.
 */
function dbe_ability_fetch_rendered( $url, $cookies = array() ) {
	$jar = array();
	foreach ( $cookies as $name => $value ) {
		$jar[] = new WP_Http_Cookie(
			array(
				'name'  => (string) $name,
				'value' => (string) $value,
			)
		);
	}

	$home_host = strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) );
	for ( $hop = 0; $hop < 3; $hop++ ) {
		$token = wp_generate_password( 64, false, false );
		set_transient(
			'dbe_render_token_' . hash( 'sha256', $token ),
			array( 'user' => get_current_user_id() ),
			60
		);

		$args = array(
			'timeout'     => 30,
			'redirection' => 0,
			'headers'     => array( 'X-DBE-Render-Token' => $token ),
			// The loopback targets this very site; local certificates (Herd,
			// Valet, self-signed staging) would otherwise fail the fetch.
			'sslverify'   => false,
		);
		if ( array() !== $jar ) {
			$args['cookies'] = $jar;
		}

		$response = wp_remote_get( $url, $args );
		delete_transient( 'dbe_render_token_' . hash( 'sha256', $token ) );
		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'dbe_fetch_failed', 'The loopback fetch failed: ' . $response->get_error_message() );
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		if ( $status >= 300 && $status < 400 ) {
			$location = (string) wp_remote_retrieve_header( $response, 'location' );
			if ( '' === $location ) {
				return new WP_Error( 'dbe_fetch_failed', sprintf( 'The page redirected (HTTP %d) without a Location header.', $status ) );
			}
			$location = 0 === strpos( $location, '/' ) ? home_url( $location ) : $location;
			$host     = strtolower( (string) wp_parse_url( $location, PHP_URL_HOST ) );
			if ( $host !== $home_host ) {
				return new WP_Error( 'dbe_foreign_host', sprintf( 'The page redirected off-site to %s — the authenticated loopback must not follow it.', $location ) );
			}
			$url = $location;
			continue;
		}

		return array(
			'body'        => (string) wp_remote_retrieve_body( $response ),
			'status_code' => $status,
			'url'         => $url,
		);
	}

	return new WP_Error( 'dbe_fetch_failed', sprintf( 'Too many redirects — last target %s.', $url ) );
}

/*
 * ----------------------------------------------------------------------
 *  Rendered-HTML failure scan
 * ----------------------------------------------------------------------
 */

/**
 * Collect up to five pattern matches with their line numbers.
 *
 * @param string $haystack Text to scan.
 * @param string $pattern  PCRE pattern (no anchors).
 * @return array<int,array{line:int,text:string}>
 */
function dbe_ability_scan_matches( $haystack, $pattern ) {
	$matches = array();
	foreach ( explode( "\n", $haystack ) as $index => $row ) {
		if ( preg_match( $pattern, $row, $m ) ) {
			$matches[] = array(
				'line' => $index + 1,
				'text' => substr( trim( $m[0] ), 0, 160 ),
			);
			if ( count( $matches ) >= 5 ) {
				break;
			}
		}
	}
	return $matches;
}

/**
 * Scan rendered HTML for the dynamic-data failure classes. The scan mirror
 * of bin/check-dynamic-render.sh: PHP notices, leaked <template> elements,
 * unresolved square/curly bindings, expected/absent text and blank labels.
 *
 * @param string $html  The rendered page HTML.
 * @param array  $input Expectations (expect / absent / nonblank_labels).
 * @return array<int,array<string,mixed>> Failures; empty when the page is clean.
 */
function dbe_ability_scan_rendered_html( $html, $input ) {
	$failures = array();

	// Scripts, styles and comments legitimately contain braces and template
	// markup; bindings are only failures in real rendered content.
	$content = preg_replace( '/<script\b[^>]*>.*?<\/script>/is', '', $html );
	$content = preg_replace( '/<style\b[^>]*>.*?<\/style>/is', '', (string) $content );
	$content = preg_replace( '/<!--.*?-->/s', '', (string) $content );
	$content = (string) $content;

	/*
	 * Interactive (client-side URL-source) Collections legitimately ship
	 * their <template> and {{expr}} markup to the browser — the collection
	 * script renders them after fetching. Exempt those subtrees so only
	 * genuinely dead templates and bindings are reported.
	 */
	if ( false !== stripos( $content, 'data-b-interactive' ) && class_exists( 'DOMDocument' ) ) {
		$dom      = new DOMDocument();
		$previous = libxml_use_internal_errors( true );
		if ( $dom->loadHTML( '<?xml encoding="utf-8"?>' . $content ) ) {
			$xpath   = new DOMXPath( $dom );
			$removed = false;
			foreach ( $xpath->query( '//*[@data-b-interactive]' ) as $node ) {
				if ( $node->parentNode ) { // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- DOM API.
					$node->parentNode->removeChild( $node ); // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- DOM API.
					$removed = true;
				}
			}
			if ( $removed ) {
				$content = (string) $dom->saveHTML();
			}
		}
		libxml_clear_errors();
		libxml_use_internal_errors( $previous );
	}

	$checks = array(
		array( 'php_error', 'PHP warning or fatal error in the output.', '/Fatal error|Warning:/' ),
		array( 'leaked_template', 'Unrendered <template> element — a Collection whose source did not resolve to an array leaves its row template in the page.', '/<template[\s>]/' ),
		array( 'unresolved_square_binding', 'Unresolved [[...]] binding — the data variable did not resolve (not saved globally, renamed, or the query failed at runtime).', '/\[\[\[?[^\][]+\]\]\]?/' ),
		array( 'unresolved_curly_binding', 'Unresolved {{...}} expression — loop-item markup rendered outside a resolved Collection row.', '/\{\{\{?[^{}]+\}\}\}?/' ),
	);
	foreach ( $checks as $check ) {
		list( $id, $message, $pattern ) = $check;
		$matches                        = dbe_ability_scan_matches( $content, $pattern );
		if ( array() !== $matches ) {
			$failures[] = array(
				'check'   => $id,
				'message' => $message,
				'matches' => $matches,
			);
		}
	}

	foreach ( (array) ( $input['expect'] ?? array() ) as $expected ) {
		$expected = (string) $expected;
		if ( '' !== $expected && false === strpos( $html, $expected ) ) {
			$failures[] = array(
				'check'   => 'expected_text_missing',
				'message' => sprintf( 'Expected text not found: %s', $expected ),
			);
		}
	}
	foreach ( (array) ( $input['absent'] ?? array() ) as $forbidden ) {
		$forbidden = (string) $forbidden;
		if ( '' !== $forbidden && false !== strpos( $html, $forbidden ) ) {
			$failures[] = array(
				'check'   => 'forbidden_text_present',
				'message' => sprintf( 'Text that should be absent was found: %s', $forbidden ),
			);
		}
	}

	$labels = (array) ( $input['nonblank_labels'] ?? array() );
	if ( array() !== $labels && class_exists( 'DOMDocument' ) ) {
		$dom      = new DOMDocument();
		$previous = libxml_use_internal_errors( true );
		$dom->loadHTML( '<?xml encoding="utf-8"?>' . $html );
		libxml_clear_errors();
		libxml_use_internal_errors( $previous );
		$xpath = new DOMXPath( $dom );
		foreach ( $labels as $label ) {
			$label = (string) $label;
			if ( '' === $label ) {
				continue;
			}
			$visible = false;
			foreach ( $xpath->query( '//text()' ) as $node ) {
				if ( false === strpos( $node->nodeValue, $label ) ) { // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- DOM API.
					continue;
				}
				$text   = $node->parentNode->textContent; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- DOM API.
				$suffix = substr( $text, strpos( $text, $label ) + strlen( $label ) );
				if ( '' !== trim( $suffix ) ) {
					$visible = true;
					break;
				}
			}
			if ( ! $visible ) {
				$failures[] = array(
					'check'   => 'blank_label_value',
					'message' => sprintf( 'No visible value follows the label: %s (numeric 0, "0", null and "" all render blank — use a display alias for zeroes).', $label ),
				);
			}
		}
	}

	return $failures;
}

/**
 * Handle dbe/check-rendered-output.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_check_rendered_output( $input ) {
	$url = dbe_ability_render_url( $input );
	if ( is_wp_error( $url ) ) {
		return $url;
	}

	$fetched = dbe_ability_fetch_rendered( $url );
	if ( is_wp_error( $fetched ) ) {
		return $fetched;
	}

	$failures = dbe_ability_scan_rendered_html( $fetched['body'], $input );
	if ( 200 !== $fetched['status_code'] ) {
		array_unshift(
			$failures,
			array(
				'check'   => 'http_status',
				'message' => sprintf( 'The page returned HTTP %d, not 200.', $fetched['status_code'] ),
			)
		);
	}

	return array(
		'passed'      => array() === $failures,
		'url'         => (string) ( $fetched['url'] ?? $url ),
		'status_code' => $fetched['status_code'],
		'failures'    => $failures,
		'html_length' => strlen( $fetched['body'] ),
	);
}

/**
 * Handle dbe/check-render-scenarios.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_check_render_scenarios( $input ) {
	$scenarios = $input['scenarios'] ?? array();
	if ( ! is_array( $scenarios ) || array() === $scenarios ) {
		return new WP_Error( 'dbe_scenarios_required', 'Pass at least one scenario.' );
	}
	if ( count( $scenarios ) > 10 ) {
		return new WP_Error( 'dbe_too_many_scenarios', 'At most ten scenarios per call — split larger matrices.' );
	}

	$shared = array(
		'expect'          => (array) ( $input['expect'] ?? array() ),
		'absent'          => (array) ( $input['absent'] ?? array() ),
		'nonblank_labels' => (array) ( $input['nonblank_labels'] ?? array() ),
	);

	$rows       = array();
	$all_passed = true;
	foreach ( $scenarios as $scenario ) {
		$scenario = (array) $scenario;
		$label    = trim( (string) ( $scenario['label'] ?? '' ) );

		$url = dbe_ability_render_url(
			array(
				'page'  => $input['page'] ?? '',
				'url'   => $input['url'] ?? '',
				'query' => (array) ( $scenario['query'] ?? array() ),
			)
		);
		if ( is_wp_error( $url ) ) {
			return $url;
		}

		$fetched = dbe_ability_fetch_rendered( $url, (array) ( $scenario['cookies'] ?? array() ) );
		if ( is_wp_error( $fetched ) ) {
			$rows[]     = array(
				'label'    => $label,
				'url'      => $url,
				'passed'   => false,
				'failures' => array(
					array(
						'check'   => 'fetch_failed',
						'message' => $fetched->get_error_message(),
					),
				),
			);
			$all_passed = false;
			continue;
		}

		$expectations = array(
			'expect'          => array_merge( $shared['expect'], (array) ( $scenario['expect'] ?? array() ) ),
			'absent'          => array_merge( $shared['absent'], (array) ( $scenario['absent'] ?? array() ) ),
			'nonblank_labels' => array_merge( $shared['nonblank_labels'], (array) ( $scenario['nonblank_labels'] ?? array() ) ),
		);

		$failures = dbe_ability_scan_rendered_html( $fetched['body'], $expectations );
		if ( 200 !== $fetched['status_code'] ) {
			array_unshift(
				$failures,
				array(
					'check'   => 'http_status',
					'message' => sprintf( 'The page returned HTTP %d, not 200.', $fetched['status_code'] ),
				)
			);
		}

		$passed = array() === $failures;
		if ( ! $passed ) {
			$all_passed = false;
		}
		$rows[] = array(
			'label'       => $label,
			'url'         => (string) ( $fetched['url'] ?? $url ),
			'status_code' => $fetched['status_code'],
			'passed'      => $passed,
			'failures'    => $failures,
		);
	}

	return array(
		'passed'    => $all_passed,
		'scenarios' => $rows,
	);
}

/*
 * ----------------------------------------------------------------------
 *  Dynamic-data resolution (Builderius' ?builderius_data_request channel)
 * ----------------------------------------------------------------------
 */

/**
 * Resolve dataVars entries through Builderius' own dynamic-data request
 * channel: an authenticated POST to a front-end URL with
 * ?builderius_data_request and a JSON payload of saved-format entries.
 * Builderius answers with { name: resolvedValue, … } after establishing the
 * URL's real WordPress query context — the same resolution the front end
 * performs, which no save-time validation can substitute for.
 *
 * @param string $url     Same-site context URL (already validated).
 * @param array  $entries Saved-format dataVars entries (a1/b1/c1/d1 keys).
 * @return array|WP_Error name => value map.
 */
function dbe_ability_data_request( $url, $entries ) {
	$token = wp_generate_password( 64, false, false );
	set_transient(
		'dbe_render_token_' . hash( 'sha256', $token ),
		array( 'user' => get_current_user_id() ),
		60
	);

	$url      = add_query_arg( 'builderius_data_request', '1', $url );
	$response = wp_remote_post(
		$url,
		array(
			'timeout'     => 60,
			'redirection' => 0,
			'headers'     => array(
				'Content-Type'       => 'application/json',
				'X-DBE-Render-Token' => $token,
			),
			'body'        => wp_json_encode( array( 'dataVars' => array_values( $entries ) ) ),
			'sslverify'   => false,
		)
	);
	delete_transient( 'dbe_render_token_' . hash( 'sha256', $token ) );
	if ( is_wp_error( $response ) ) {
		return new WP_Error( 'dbe_data_request_failed', 'The dynamic-data request failed: ' . $response->get_error_message() );
	}

	$body = (string) wp_remote_retrieve_body( $response );
	$data = json_decode( $body, true );
	if ( ! is_array( $data ) ) {
		// A PHP notice ahead of the JSON is a real-world failure mode; salvage
		// the object if one is present, and report the noise.
		$brace = strpos( $body, '{' );
		if ( false !== $brace ) {
			$data = json_decode( substr( $body, $brace ), true );
		}
		if ( ! is_array( $data ) ) {
			return new WP_Error(
				'dbe_data_request_failed',
				sprintf(
					'The dynamic-data channel returned no JSON (HTTP %d). A full page instead of data usually means the builderius-development capability check failed. Body starts: %s',
					(int) wp_remote_retrieve_response_code( $response ),
					substr( wp_strip_all_tags( $body ), 0, 200 )
				)
			);
		}
	}
	return $data;
}

/**
 * The GraphQL introspection result for the dynamic-data Root schema, cached
 * for an hour (keyed nowhere finer — activating a schema-extending plugin
 * warrants refresh: true).
 *
 * @param bool $refresh Bypass the cache.
 * @return array|WP_Error The introspection data (with the __schema key).
 */
function dbe_ability_schema_introspection( $refresh = false ) {
	$cache_key = 'dbe_ability_gql_schema';
	if ( ! $refresh ) {
		$cached = get_transient( $cache_key );
		if ( is_array( $cached ) && isset( $cached['__schema'] ) ) {
			return $cached;
		}
	}

	if ( class_exists( '\Builderius\GraphQL\Type\Introspection' ) ) {
		$query = \Builderius\GraphQL\Type\Introspection::getIntrospectionQuery();
	} else {
		// Minimal fallback: enough for schema browsing and client-schema
		// building (descriptions and deprecations omitted).
		$type_ref = 'kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } }';
		$query    = 'query IntrospectionQuery { __schema { queryType { name } types { kind name description'
			. ' fields(includeDeprecated: true) { name description args { name type { ' . $type_ref . ' } defaultValue } type { ' . $type_ref . ' } }'
			. ' inputFields { name type { ' . $type_ref . ' } defaultValue }'
			. ' interfaces { ' . $type_ref . ' }'
			. ' enumValues(includeDeprecated: true) { name description }'
			. ' possibleTypes { ' . $type_ref . ' } } } }';
	}

	$result = dbe_ability_data_request(
		home_url( '/' ),
		array(
			array(
				'a1' => 'graphQLQuery',
				'b1' => 'dbe_schema_introspection',
				'c1' => $query,
			),
		)
	);
	if ( is_wp_error( $result ) ) {
		return $result;
	}
	$data = $result['dbe_schema_introspection'] ?? null;
	if ( ! is_array( $data ) || ! isset( $data['__schema'] ) ) {
		return new WP_Error( 'dbe_introspection_failed', 'Introspection returned no __schema — the dynamic-data channel may be unavailable on this Builderius version.' );
	}

	set_transient( $cache_key, $data, HOUR_IN_SECONDS );
	return $data;
}

/**
 * Render an introspection type reference as a readable string ("[Post!]!").
 *
 * @param array $ref Introspection type reference.
 * @return string
 */
function dbe_ability_render_type_ref( $ref ) {
	if ( ! is_array( $ref ) ) {
		return '';
	}
	$kind = $ref['kind'] ?? '';
	if ( 'NON_NULL' === $kind ) {
		return dbe_ability_render_type_ref( $ref['ofType'] ?? array() ) . '!';
	}
	if ( 'LIST' === $kind ) {
		return '[' . dbe_ability_render_type_ref( $ref['ofType'] ?? array() ) . ']';
	}
	return (string) ( $ref['name'] ?? '' );
}

/**
 * Compact one introspection field row for agent output.
 *
 * @param array $field Introspection field.
 * @return array { name, args?, type, description? }
 */
function dbe_ability_compact_field( $field ) {
	$row  = array(
		'name' => (string) ( $field['name'] ?? '' ),
		'type' => dbe_ability_render_type_ref( $field['type'] ?? array() ),
	);
	$args = array();
	foreach ( (array) ( $field['args'] ?? array() ) as $arg ) {
		$args[] = ( $arg['name'] ?? '' ) . ': ' . dbe_ability_render_type_ref( $arg['type'] ?? array() );
	}
	if ( $args ) {
		$row['args'] = $args;
	}
	if ( ! empty( $field['description'] ) ) {
		$row['description'] = (string) $field['description'];
	}
	return $row;
}

/**
 * Validate a GraphQL document against the live schema using Builderius'
 * bundled graphql-php. Returns messages the syntax-only check cannot see
 * (unknown fields, bad argument types) — the errors that otherwise surface
 * as a silently blank variable at render.
 *
 * @param string $query GraphQL document.
 * @return array { valid: bool, errors: string[], checked: bool }
 */
function dbe_ability_validate_query_schema( $query ) {
	$out = array(
		'valid'   => true,
		'errors'  => array(),
		'checked' => false,
	);
	if ( ! class_exists( '\Builderius\GraphQL\Utils\BuildClientSchema' )
		|| ! class_exists( '\Builderius\GraphQL\Validator\DocumentValidator' )
		|| ! class_exists( '\Builderius\GraphQL\Language\Parser' ) ) {
		return $out;
	}
	$introspection = dbe_ability_schema_introspection();
	if ( is_wp_error( $introspection ) ) {
		return $out;
	}
	try {
		// Data variables interpolate other variables with [[dep]] / [[[dep]]]
		// before execution; neutralise them so validation sees plausible
		// literals instead of parse errors.
		$normalised = preg_replace( '/"\[\[\[?[^\]"]+\]\]\]?"/', '"1"', $query );
		$normalised = preg_replace( '/\[\[\[?[^\]]+\]\]\]?/', '1', (string) $normalised );

		// Builderius' bundled introspection query omits isRepeatable on
		// directives, which BuildClientSchema reads unconditionally.
		if ( isset( $introspection['__schema']['directives'] ) && is_array( $introspection['__schema']['directives'] ) ) {
			foreach ( $introspection['__schema']['directives'] as &$directive ) {
				if ( ! isset( $directive['isRepeatable'] ) ) {
					$directive['isRepeatable'] = false;
				}
			}
			unset( $directive );
		}

		$schema = \Builderius\GraphQL\Utils\BuildClientSchema::build( $introspection );
		$ast    = \Builderius\GraphQL\Language\Parser::parse( (string) $normalised );
		$errors = \Builderius\GraphQL\Validator\DocumentValidator::validate( $schema, $ast );

		$out['checked'] = true;
		foreach ( $errors as $error ) {
			$out['errors'][] = $error->getMessage();
		}
		$out['valid'] = array() === $out['errors'];
	} catch ( \Throwable $e ) {
		$out['errors'][] = 'Schema validation could not run: ' . $e->getMessage();
	}
	return $out;
}

/**
 * The saved variables a query depends on, transitively, via its [[dep]] /
 * [[[dep]]] interpolations — those entries must ride along in the resolution
 * request or the target resolves against missing values.
 *
 * @param array $entry     The target saved-format entry.
 * @param array $saved_map name => saved-format entry map of available variables.
 * @return array name => entry map of dependencies (target excluded).
 */
function dbe_ability_var_dependencies( $entry, $saved_map ) {
	$deps  = array();
	$queue = array( $entry );
	while ( $queue ) {
		$current = array_pop( $queue );
		$text    = (string) ( $current['c1'] ?? '' ) . ' ' . (string) ( $current['d1'] ?? '' );
		if ( preg_match_all( '/\[\[\[?\s*([a-z][a-z0-9_]*)/i', $text, $m ) ) {
			foreach ( $m[1] as $name ) {
				if ( isset( $saved_map[ $name ] ) && ! isset( $deps[ $name ] ) ) {
					$deps[ $name ] = $saved_map[ $name ];
					$queue[]       = $saved_map[ $name ];
				}
			}
		}
	}
	return $deps;
}

/**
 * Compact a resolved value for agent output: lists truncated to five rows,
 * long strings clipped, depth capped. Sets $truncated when anything was cut.
 *
 * @param mixed $value     The value.
 * @param bool  $truncated Set to true when compaction dropped content.
 * @param int   $depth     Current depth.
 * @return mixed The compacted value.
 */
function dbe_ability_compact_value( $value, &$truncated, $depth = 0 ) {
	if ( $depth >= 7 ) {
		$truncated = true;
		return '…';
	}
	if ( is_string( $value ) && strlen( $value ) > 300 ) {
		$truncated = true;
		return substr( $value, 0, 300 ) . '…';
	}
	if ( ! is_array( $value ) ) {
		return $value;
	}

	$is_list = array_keys( $value ) === range( 0, count( $value ) - 1 );
	$out     = array();
	$i       = 0;
	foreach ( $value as $k => $v ) {
		if ( $is_list && $i >= 5 ) {
			$truncated = true;
			$out[]     = sprintf( '… +%d more rows', count( $value ) - 5 );
			break;
		}
		$out[ $k ] = dbe_ability_compact_value( $v, $truncated, $depth + 1 );
		++$i;
	}
	return $out;
}

/**
 * Load the saved variables visible to a resolution: the global settings
 * set's, plus the entity's when a template reference is given.
 *
 * @param array $input Ability input (template / entity_type / settings_set).
 * @return array|WP_Error name => saved-format entry map.
 */
function dbe_ability_saved_var_map( $input ) {
	$map = array();

	$global = dbe_ability_load_scoped_setting( array( 'settings_set' => $input['settings_set'] ?? '' ), 'dataVars' );
	if ( is_wp_error( $global ) ) {
		return $global;
	}
	foreach ( $global['vars'] as $entry ) {
		if ( '' !== (string) ( $entry['b1'] ?? '' ) ) {
			$map[ (string) $entry['b1'] ] = $entry;
		}
	}

	if ( '' !== trim( (string) ( $input['template'] ?? '' ) ) ) {
		$entity = dbe_ability_load_scoped_setting( $input, 'dataVars' );
		if ( is_wp_error( $entity ) ) {
			return $entity;
		}
		foreach ( $entity['vars'] as $entry ) {
			if ( '' !== (string) ( $entry['b1'] ?? '' ) ) {
				$map[ (string) $entry['b1'] ] = $entry;
			}
		}
	}

	return $map;
}

/**
 * Handle dbe/get-dynamic-data-schema.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_get_dynamic_data_schema( $input ) {
	$introspection = dbe_ability_schema_introspection( ! empty( $input['refresh'] ) );
	if ( is_wp_error( $introspection ) ) {
		return $introspection;
	}
	$schema     = $introspection['__schema'];
	$root_name  = (string) ( $schema['queryType']['name'] ?? 'Root' );
	$types      = (array) ( $schema['types'] ?? array() );
	$type_index = array();
	foreach ( $types as $t ) {
		$name = (string) ( $t['name'] ?? '' );
		if ( '' !== $name && 0 !== strpos( $name, '__' ) ) {
			$type_index[ $name ] = $t;
		}
	}

	$out = array(
		'root_fields' => array(),
		'type'        => null,
		'matches'     => array(),
		'type_names'  => array_keys( $type_index ),
	);

	$search = strtolower( trim( (string) ( $input['search'] ?? '' ) ) );
	$expand = trim( (string) ( $input['type'] ?? '' ) );

	if ( '' !== $search ) {
		foreach ( $type_index as $type_name => $t ) {
			foreach ( (array) ( $t['fields'] ?? array() ) as $field ) {
				$field_name = (string) ( $field['name'] ?? '' );
				if ( false !== strpos( strtolower( $type_name ), $search ) || false !== strpos( strtolower( $field_name ), $search ) ) {
					$row              = dbe_ability_compact_field( $field );
					$row['on']        = $type_name;
					$out['matches'][] = $row;
					if ( count( $out['matches'] ) >= 120 ) {
						break 2;
					}
				}
			}
		}
		return $out;
	}

	if ( '' !== $expand ) {
		if ( ! isset( $type_index[ $expand ] ) ) {
			return new WP_Error( 'dbe_no_type', sprintf( 'No type "%s" in the schema. Check type_names from a plain call.', $expand ) );
		}
		$t      = $type_index[ $expand ];
		$fields = array_map( 'dbe_ability_compact_field', (array) ( $t['fields'] ?? array() ) );
		if ( ! $fields && ! empty( $t['inputFields'] ) ) {
			$fields = array_map( 'dbe_ability_compact_field', (array) $t['inputFields'] );
		}
		if ( ! $fields && ! empty( $t['enumValues'] ) ) {
			$fields = array_values( (array) $t['enumValues'] );
		}
		$out['type'] = array(
			'name'   => $expand,
			'kind'   => (string) ( $t['kind'] ?? '' ),
			'fields' => $fields,
		);
		return $out;
	}

	if ( isset( $type_index[ $root_name ] ) ) {
		$out['root_fields'] = array_map( 'dbe_ability_compact_field', (array) ( $type_index[ $root_name ]['fields'] ?? array() ) );
	}
	return $out;
}

/**
 * Resolve one target entry (plus dependencies) in a page context.
 *
 * @param array  $target Saved-format entry for the target variable.
 * @param string $name   The target's variable name.
 * @param array  $input  Ability input carrying scope and context args.
 * @return array|WP_Error { value, url, resolved }.
 */
function dbe_ability_resolve_entry( $target, $name, $input ) {
	$saved = dbe_ability_saved_var_map( $input );
	if ( is_wp_error( $saved ) ) {
		return $saved;
	}

	$context = array(
		'page'  => $input['page'] ?? '',
		'url'   => $input['url'] ?? '',
		'query' => $input['query'] ?? array(),
	);
	if ( '' === trim( (string) $context['page'] ) && '' === trim( (string) $context['url'] ) ) {
		$context['url'] = home_url( '/' );
	}
	$url = dbe_ability_render_url( $context );
	if ( is_wp_error( $url ) ) {
		return $url;
	}

	$entries          = dbe_ability_var_dependencies( $target, $saved );
	$entries[ $name ] = $target;

	$result = dbe_ability_data_request( $url, $entries );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	return array(
		'value'    => array_key_exists( $name, $result ) ? $result[ $name ] : null,
		'url'      => $url,
		'resolved' => array_keys( $result ),
	);
}

/**
 * Handle dbe/resolve-data-variable.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_resolve_data_variable( $input ) {
	$name  = trim( (string) ( $input['name'] ?? '' ) );
	$query = trim( (string) ( $input['graphql_query'] ?? '' ) );
	if ( ( '' === $name ) === ( '' === $query ) ) {
		return new WP_Error( 'dbe_target_required', 'Pass exactly one of name (a saved variable) or graphql_query (an ad-hoc probe).' );
	}

	if ( '' !== $name ) {
		$saved = dbe_ability_saved_var_map( $input );
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}
		if ( ! isset( $saved[ $name ] ) ) {
			return new WP_Error( 'dbe_no_variable', sprintf( 'No saved variable "%s" in this scope — check dbe/get-data-variables.', $name ) );
		}
		$target = $saved[ $name ];
	} else {
		$name   = 'dbe_probe';
		$target = array(
			'a1' => 'graphQLQuery',
			'b1' => $name,
			'c1' => $query,
		);
	}

	$validation = array(
		'valid'   => true,
		'errors'  => array(),
		'checked' => false,
	);
	if ( 'graphQLQuery' === (string) ( $target['a1'] ?? '' ) ) {
		$syntax = dbe_ability_validate_graphql_syntax( (string) ( $target['c1'] ?? '' ) );
		if ( is_wp_error( $syntax ) ) {
			return $syntax;
		}
		$validation = dbe_ability_validate_query_schema( (string) ( $target['c1'] ?? '' ) );
	}

	$resolved = dbe_ability_resolve_entry( $target, $name, $input );
	if ( is_wp_error( $resolved ) ) {
		return $resolved;
	}

	$value      = $resolved['value'];
	$value_json = wp_json_encode( $value );
	$truncated  = false;
	if ( empty( $input['full'] ) ) {
		$value = dbe_ability_compact_value( $value, $truncated );
	}

	return array(
		'validation' => $validation,
		'value'      => $value,
		'truncated'  => $truncated,
		'value_size' => false === $value_json ? 0 : strlen( $value_json ),
		'url'        => $resolved['url'],
		'resolved'   => $resolved['resolved'],
	);
}

/**
 * Handle dbe/inspect-binding-value.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_inspect_binding_value( $input ) {
	$binding = trim( (string) ( $input['binding'] ?? '' ) );
	if ( '' === $binding ) {
		return new WP_Error( 'dbe_binding_required', 'Pass the binding to inspect.' );
	}
	$warnings = array();
	$url      = null;

	// Literal JSON source?
	$first = substr( $binding, 0, 1 );
	$value = null;
	$path  = array();
	if ( ( '{' === $first || '[' === $first ) && ! preg_match( '/^\[\[/', $binding ) ) {
		$decoded = json_decode( $binding, true );
		if ( null === $decoded && 'null' !== $binding ) {
			return new WP_Error( 'dbe_bad_binding', 'The binding looks like literal JSON but does not parse — fix the JSON or pass a var.path binding.' );
		}
		$value = $decoded;
	} else {
		$stripped = $binding;
		if ( preg_match( '/^\[\[\[?\s*(.+?)\s*\]\]\]?$/s', $binding, $m ) ) {
			$stripped = $m[1];
		}
		if ( ! preg_match( '/^[a-z][a-z0-9_]*(\.[A-Za-z0-9_]+)*$/i', $stripped ) ) {
			return new WP_Error( 'dbe_bad_binding', 'Bindings are var.path.to.value (letters, digits, underscores, dots) or literal JSON.' );
		}
		$path     = explode( '.', $stripped );
		$var_name = array_shift( $path );

		$saved = dbe_ability_saved_var_map( $input );
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}
		if ( ! isset( $saved[ $var_name ] ) ) {
			return new WP_Error( 'dbe_no_variable', sprintf( 'No saved variable "%s" — a Collection bound to it would silently render an empty loop. Save it first (globals: %s).', $var_name, implode( ', ', array_keys( $saved ) ) ) );
		}

		$resolved = dbe_ability_resolve_entry( $saved[ $var_name ], $var_name, $input );
		if ( is_wp_error( $resolved ) ) {
			return $resolved;
		}
		$url   = $resolved['url'];
		$value = $resolved['value'];

		foreach ( $path as $segment ) {
			if ( is_array( $value ) && array_key_exists( $segment, $value ) ) {
				$value = $value[ $segment ];
				continue;
			}
			$done = array_slice( $path, 0, array_search( $segment, $path, true ) + 1 );
			return array(
				'resolved_type'   => 'missing',
				'collection_safe' => false,
				'count'           => null,
				'item_keys'       => array(),
				'preview'         => null,
				'warnings'        => array(
					sprintf( 'The path broke at "%s" (%s.%s) — the value up to there had keys: %s.', $segment, $var_name, implode( '.', $done ), is_array( $value ) ? implode( ', ', array_slice( array_keys( $value ), 0, 15 ) ) : gettype( $value ) ),
				),
				'url'             => $url,
			);
		}
	}

	$is_list = is_array( $value ) && ( array() === $value || array_keys( $value ) === range( 0, count( $value ) - 1 ) );
	if ( is_array( $value ) ) {
		$type = $is_list ? 'list' : 'object';
	} elseif ( null === $value ) {
		$type = 'null';
	} elseif ( is_bool( $value ) ) {
		$type = 'boolean';
	} elseif ( is_string( $value ) ) {
		$type = 'string';
	} else {
		$type = 'number';
	}

	$count = is_array( $value ) ? count( $value ) : null;
	$safe  = 'list' === $type && $count > 0;
	if ( 'list' === $type && 0 === $count ) {
		$warnings[] = 'The list is empty in this context — the Collection saves fine but renders zero rows here.';
	} elseif ( 'object' === $type ) {
		$warnings[] = 'This is a single object, not a list — a Collection bound to it renders exactly ONCE. Bind the list one level up, or wrap the object in an array.';
	} elseif ( in_array( $type, array( 'string', 'number', 'boolean', 'null' ), true ) ) {
		$warnings[] = 'A scalar/null Collection source leaves the raw <template> markup unrendered in the page. Bind a list instead.';
	}

	$item_keys = array();
	if ( $safe ) {
		$first_row = $value[0];
		if ( is_array( $first_row ) ) {
			$item_keys = array_slice( array_keys( $first_row ), 0, 25 );
			$mixed     = false;
			foreach ( $value as $row ) {
				if ( ! is_array( $row ) ) {
					$mixed = true;
					break;
				}
			}
			if ( $mixed ) {
				$warnings[] = 'Rows are a mix of objects and scalars — raw {{value}} bindings on mixed rows can fatal in Builderius\' Mustache cache. Bind scalar aliases instead.';
			}
		} else {
			$warnings[] = 'Rows are scalars, not objects — item expressions must use the whole row value, and mixed-type rows can fatal. Prefer rows shaped as objects.';
		}
	}

	$truncated = false;
	return array(
		'resolved_type'   => $type,
		'collection_safe' => $safe,
		'count'           => $count,
		'item_keys'       => $item_keys,
		'preview'         => dbe_ability_compact_value( $value, $truncated ),
		'warnings'        => $warnings,
		'url'             => $url,
	);
}

/*
 * ----------------------------------------------------------------------
 *  Matched styles (entity + global stylesheets, per module)
 * ----------------------------------------------------------------------
 */

/**
 * Split a stylesheet into flat rules with their at-rule context. A
 * deliberately small tokenizer: strings and comments are honoured, one level
 * of grouping at-rules (@media/@supports/@container/@layer) is tracked, and
 * other nesting is flattened by concatenating selectors.
 *
 * @param string $css    The stylesheet.
 * @param string $source Label for the rules' origin (entity|global).
 * @return array<int,array{selector:string,declarations:string,media:string,source:string}>
 */
function dbe_ability_css_rules( $css, $source ) {
	$css   = preg_replace( '/\/\*.*?\*\//s', '', (string) $css );
	$rules = array();
	$len   = strlen( $css );
	$i     = 0;
	$stack = array(); // Enclosing at-rule preludes.

	$buffer = '';
	while ( $i < $len ) {
		$c = $css[ $i ];
		if ( '"' === $c || "'" === $c ) {
			$j = $i + 1;
			while ( $j < $len && $css[ $j ] !== $c ) {
				$j += '\\' === $css[ $j ] ? 2 : 1;
			}
			$buffer .= substr( $css, $i, $j - $i + 1 );
			$i       = $j + 1;
			continue;
		}
		if ( '{' === $c ) {
			$prelude = trim( $buffer );
			$buffer  = '';
			if ( '@' === substr( $prelude, 0, 1 ) && preg_match( '/^@(media|supports|container|layer|scope)\b/i', $prelude ) ) {
				$stack[] = $prelude;
				++$i;
				continue;
			}
			// A style rule: capture its declaration block (honouring nested
			// braces from nested rules, which we do not descend into).
			$depth = 1;
			$j     = $i + 1;
			$start = $j;
			while ( $j < $len && $depth > 0 ) {
				$cc = $css[ $j ];
				if ( '"' === $cc || "'" === $cc ) {
					++$j;
					while ( $j < $len && $css[ $j ] !== $cc ) {
						$j += '\\' === $css[ $j ] ? 2 : 1;
					}
				} elseif ( '{' === $cc ) {
					++$depth;
				} elseif ( '}' === $cc ) {
					--$depth;
				}
				++$j;
			}
			$block = substr( $css, $start, $j - $start - 1 );
			// Keep only the top-level declarations (strip nested sub-rules).
			$declarations = preg_replace( '/[^{}]*\{[^{}]*\}/s', '', $block );
			$declarations = trim( preg_replace( '/\s+/', ' ', (string) $declarations ) );
			if ( '' !== $prelude && '' !== $declarations ) {
				$rules[] = array(
					'selector'     => preg_replace( '/\s+/', ' ', $prelude ),
					'declarations' => $declarations,
					'media'        => implode( ' ', $stack ),
					'source'       => $source,
				);
			}
			$i = $j;
			continue;
		}
		if ( '}' === $c ) {
			array_pop( $stack );
			$buffer = '';
			++$i;
			continue;
		}
		$buffer .= $c;
		++$i;
	}
	return $rules;
}

/**
 * Handle dbe/get-rendered-styles.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_get_rendered_styles( $input ) {
	$module_id = trim( (string) ( $input['module_id'] ?? '' ) );
	if ( '' === $module_id ) {
		return new WP_Error( 'dbe_module_id_required', 'Pass the module_id (find ids with dbe/get-tree-outline).' );
	}
	$loaded = dbe_ability_load_entity_css( (string) ( $input['template'] ?? '' ), $input['entity_type'] ?? 'template' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}
	$module = $loaded['config']['modules'][ $module_id ] ?? null;
	if ( ! $module ) {
		return new WP_Error( 'dbe_no_module', sprintf( 'No module "%s" in this entity — check dbe/get-tree-outline.', $module_id ) );
	}

	$module_tag = dbe_ability_setting( $module, 'tag' );
	$tag        = strtolower( (string) ( $module_tag ? $module_tag : 'div' ) );
	$html_id    = (string) dbe_ability_setting( $module, 'tagId' );
	$classes    = dbe_ability_setting( $module, 'tagClass' );
	$classes    = is_array( $classes ) ? array_values( array_filter( array_map( 'strval', $classes ) ) ) : array();

	$rules = dbe_ability_css_rules( $loaded['css'], 'entity' );
	if ( ! isset( $input['include_global'] ) || false !== $input['include_global'] ) {
		$set = dbe_ability_load_settings_set( '' );
		if ( ! is_wp_error( $set ) ) {
			$rules = array_merge( $rules, dbe_ability_css_rules( $set['css'], 'global' ) );
		}
	}

	// The needles that mean "this rule targets that module". Word-boundary
	// matching keeps .card from matching .cardigan.
	$needles = array( 'uni-node-' . $module_id => 'module id' );
	if ( '' !== $html_id ) {
		$needles[ '#' . $html_id ] = 'html id';
	}
	foreach ( $classes as $class ) {
		$needles[ '.' . $class ] = 'class .' . $class;
	}

	$matched = array();
	foreach ( $rules as $rule ) {
		$matched_by = array();
		foreach ( $needles as $needle => $label ) {
			if ( false !== strpos( $rule['selector'], $needle )
				&& preg_match( '/' . preg_quote( $needle, '/' ) . '(?![A-Za-z0-9_-])/', $rule['selector'] ) ) {
				$matched_by[] = $label;
			}
		}
		// A bare element selector for the module's tag (word-bounded, not
		// inside a class/id name).
		if ( preg_match( '/(?<![.#\w-])' . preg_quote( $tag, '/' ) . '(?![\w-])/', $rule['selector'] ) ) {
			$matched_by[] = 'tag ' . $tag;
		}
		if ( $matched_by ) {
			$rule['matched_by'] = $matched_by;
			$matched[]          = $rule;
		}
	}

	return array(
		'module' => array(
			'id'      => $module_id,
			'tag'     => $tag,
			'html_id' => $html_id,
			'classes' => $classes,
			'label'   => (string) ( $module['label'] ?? '' ),
		),
		'rules'  => $matched,
	);
}

/*
 * ----------------------------------------------------------------------
 *  Meta Box field resolution (field id/label → dynamic-data read recipe)
 * ----------------------------------------------------------------------
 */

/**
 * Builderius' helper-name slugification: every run of non-word characters
 * becomes one underscore, lowercased. "RC Number (CAC)" → "rc_number_cac_".
 *
 * @param string $text The label or option name.
 * @return string
 */
function dbe_ability_mb_helper_slug( $text ) {
	return strtolower( (string) preg_replace( '/\W+/', '_', (string) $text ) );
}

/**
 * Build one resolve-metabox-field match row.
 *
 * @param array  $field       Normalised Meta Box field array.
 * @param string $object_type Meta Box object type (post/user/term/setting/…).
 * @param string $type_key    Registry type key: post type slug, or the
 *                            settings page's option_name.
 * @param array  $pages       Settings pages keyed by option_name.
 * @return array The match row.
 */
function dbe_ability_mb_field_row( $field, $object_type, $type_key, $pages ) {
	$field_id = (string) ( $field['id'] ?? '' );
	$label    = (string) ( $field['name'] ?? '' );
	$type     = (string) ( $field['type'] ?? 'text' );
	$is_group = 'group' === $type;
	$clone    = ! empty( $field['clone'] );
	$multiple = ! empty( $field['multiple'] );
	$slug     = dbe_ability_mb_helper_slug( $label );

	$row = array(
		'field_id'    => $field_id,
		'label'       => $label,
		'type'        => $type,
		'object_type' => $object_type,
		'context'     => $type_key,
		'clone'       => $clone,
		'multiple'    => $multiple,
		'warnings'    => array(),
	);

	if ( $is_group ) {
		$row['children'] = array();
		foreach ( (array) ( $field['fields'] ?? array() ) as $child ) {
			$row['children'][] = array(
				'field_id' => (string) ( $child['id'] ?? '' ),
				'label'    => (string) ( $child['name'] ?? '' ),
				'type'     => (string) ( $child['type'] ?? 'text' ),
			);
		}
	}

	$accessor = $is_group ? 'metabox_group_value' : 'metabox_value';

	switch ( $object_type ) {
		case 'setting':
			$option_name           = $type_key;
			$page                  = $pages[ $option_name ] ?? null;
			$row['builder_helper'] = 'wp.' . dbe_ability_mb_helper_slug( $option_name ) . '__' . $slug;
			$row['graphql']        = sprintf( '%s(field_id: "%s", option_name: "%s")', $accessor, $field_id, $option_name );
			$row['graphql_where']  = 'At the Root of the query.';
			$row['storage']        = array(
				'option_name' => $option_name,
				'page_id'     => $page ? (string) ( $page['id'] ?? '' ) : null,
				'page_title'  => $page ? (string) ( $page['menu_title'] ?? ( $page['page_title'] ?? '' ) ) : null,
			);
			if ( $page && (string) ( $page['id'] ?? '' ) !== $option_name ) {
				$row['warnings'][] = sprintf( 'The admin page id ("%s") differs from the storage option_name ("%s") — GraphQL and rwmb_meta() both need the option_name.', (string) $page['id'], $option_name );
			}
			$row['php_read'] = sprintf( "rwmb_meta( '%s', array( 'object_type' => 'setting' ), '%s' )", $field_id, $option_name );
			break;

		case 'post':
			$row['builder_helper'] = 'wp.post.mb_field__' . $slug;
			$row['graphql']        = sprintf( '%s(field_id: "%s")', $accessor, $field_id );
			$row['graphql_where']  = 'On a post row (posts_query { posts { … } }) or on post { … } for the current post.';
			break;

		case 'user':
			$row['builder_helper'] = 'wp.user.mb_field__' . $slug;
			$row['graphql']        = sprintf( '%s(field_id: "%s")', $accessor, $field_id );
			$row['graphql_where']  = 'On a user row (users_query { users { … } }) or current_user { … }. If the typed accessor is absent on User in this schema, meta_value(key: "' . $field_id . '") is the verified fallback.';
			break;

		case 'term':
			$row['builder_helper'] = null;
			$row['graphql']        = null;
			$row['warnings'][]     = 'Builderius ships no term Meta Box helper provider, and term meta_value() returned false in verified render tests. Read term meta through a render-pure php_function_output wrapper instead.';
			break;

		default:
			$row['builder_helper'] = null;
			$row['graphql']        = sprintf( '%s(field_id: "%s")', $accessor, $field_id );
			$row['warnings'][]     = sprintf( 'No verified Builderius read path for object type "%s" — resolve with dbe/resolve-data-variable before binding.', $object_type );
	}

	if ( $is_group && ! empty( $row['children'] ) ) {
		$row['graphql_children'] = 'Read subfields by NAME inside the group value ({{child_field_id}} on the group row); key lookups inside groups returned empty in verified tests.';
	}
	if ( $clone || $multiple ) {
		$row['warnings'][] = 'This is a clone/multiple field — the value is an array (bind rows via a Collection; count()/join() render summaries). The builder auto-helper list covers only some clone/multiple types.';
	}
	if ( in_array( $type, array( 'checkbox_list', 'select_advanced', 'autocomplete' ), true ) ) {
		$row['warnings'][] = 'Multi-value field type: expect an array (verified: count() and join() render as expected).';
	}
	if ( 'date' === $type || 'datetime' === $type ) {
		$row['warnings'][] = 'Date fields store raw strings — DATE/numeric meta_query comparisons and expression_result date() conversion are the verified recipes.';
	}

	$row['warnings'] = array_values( $row['warnings'] );
	return $row;
}

/**
 * Handle dbe/resolve-metabox-field.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_resolve_metabox_field( $input ) {
	if ( ! function_exists( 'rwmb_get_registry' ) ) {
		return new WP_Error( 'dbe_no_metabox', 'Meta Box is not active on this site.' );
	}
	$ref = trim( (string) ( $input['field'] ?? '' ) );
	if ( '' === $ref ) {
		return new WP_Error( 'dbe_field_required', 'Pass the field id or a label fragment.' );
	}
	$filter = trim( (string) ( $input['object_type'] ?? '' ) );

	// Settings pages keyed by option_name, for storage context on setting rows.
	$pages = array();
	foreach ( (array) apply_filters( 'mb_settings_pages', array() ) as $page ) {
		$page        = (array) $page;
		$option_name = (string) ( $page['option_name'] ?? ( $page['id'] ?? '' ) );
		if ( '' !== $option_name ) {
			$pages[ $option_name ] = $page;
		}
	}

	$registry     = rwmb_get_registry( 'field' );
	$object_types = array( 'post', 'user', 'term', 'setting', 'network_setting', 'comment' );
	$exact        = array();
	$partial      = array();
	foreach ( $object_types as $object_type ) {
		if ( '' !== $filter && $filter !== $object_type ) {
			continue;
		}
		foreach ( (array) $registry->get_by_object_type( $object_type ) as $type_key => $fields ) {
			foreach ( (array) $fields as $field_id => $field ) {
				$field    = (array) $field;
				$field_id = (string) $field_id;
				$label    = (string) ( $field['name'] ?? '' );
				if ( $field_id === $ref ) {
					$exact[] = dbe_ability_mb_field_row( $field, $object_type, (string) $type_key, $pages );
				} elseif ( false !== stripos( $field_id, $ref ) || false !== stripos( $label, $ref ) ) {
					$partial[] = dbe_ability_mb_field_row( $field, $object_type, (string) $type_key, $pages );
				}
			}
		}
	}

	$matches = array_merge( $exact, $partial );
	if ( array() === $matches ) {
		return new WP_Error(
			'dbe_no_field',
			sprintf( 'No registered Meta Box field matches "%s"%s. Fields registered on demand (e.g. inside admin-only hooks) may be invisible here.', $ref, '' !== $filter ? " with object_type $filter" : '' )
		);
	}

	return array(
		'matches' => array_slice( $matches, 0, 20 ),
		'total'   => count( $matches ),
	);
}
