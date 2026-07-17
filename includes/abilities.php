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
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ---------------------------------------------------------------------- *
 *  Registration
 * ---------------------------------------------------------------------- */

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
 * Register the get/apply subtree HTML abilities.
 */
function dbe_register_abilities() {
	$template_arg = array(
		'type'        => 'string',
		'description' => __( 'Template post ID or slug (post type builderius_template).', 'daveden-builderius-enhancements' ),
	);

	wp_register_ability(
		'dbe/get-subtree-html',
		array(
			'label'               => __( 'Get subtree as HTML', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Serialises a Builderius template module subtree (from its saved state, the branch\'s active commit) to readable HTML. Every element carries a data-dbe-id marker; keep the marker when editing and that element\'s label, conditions and other settings survive an apply. Modules HTML cannot express (Components, SvgCode, code blocks) appear as <dbe-keep data-dbe-id="…"> placeholders — leave them in place (or move them) to preserve those elements. Omit module_id to serialise the whole template.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'  => $template_arg,
					'module_id' => array(
						'type'        => 'string',
						'description' => __( 'Module ID to serialise from. Omit for the whole template.', 'daveden-builderius-enhancements' ),
					),
				),
				'required'             => array( 'template' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'html'         => array( 'type' => 'string' ),
					'template_id'  => array( 'type' => 'integer' ),
					'branch_id'    => array( 'type' => 'integer' ),
					'commit_name'  => array( 'type' => 'string' ),
					'module_id'    => array( 'type' => 'string' ),
					'non_editable' => array(
						'type'        => 'array',
						'description' => __( 'Modules serialised as <dbe-keep> placeholders.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_get_subtree_html',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	wp_register_ability(
		'dbe/apply-subtree-html',
		array(
			'label'               => __( 'Apply edited subtree HTML', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Sanitises edited HTML and reconciles it back onto a template module subtree, then saves by creating a new commit through Builderius\' own mutation. Elements whose data-dbe-id matches the original subtree keep their module (labels, conditions and non-HTML settings survive; tag/id/class/attributes/leading text update); unmarked elements are created; original modules whose marker is gone are removed. <dbe-keep data-dbe-id="…"> preserves a non-editable module and its subtree; <dbe-component name="slug" prop="value"> inserts a component instance. The HTML must have exactly one root element: the subtree root (its identity is forced to module_id). Script tags, event handlers, dangerous URLs, unknown elements and inline <svg> are stripped and reported. data-dbe-label="…" names an element in the Navigator. Pass dry_run to preview the result (with the ids new elements would get) without saving. An open builder session will not see a saved change until reloaded.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'  => $template_arg,
					'module_id' => array(
						'type'        => 'string',
						'description' => __( 'The subtree root module ID being replaced.', 'daveden-builderius-enhancements' ),
					),
					'html'      => array(
						'type'        => 'string',
						'description' => __( 'The edited markup, one root element.', 'daveden-builderius-enhancements' ),
					),
					'dry_run'     => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview only: return the resulting markup (including the ids new elements would receive) and the kept/added/removed counts WITHOUT saving. Use this to check an edit before committing.', 'daveden-builderius-enhancements' ),
					),
					'autopublish' => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Also autopublish the commit (the builder Save button does not). Leave false on a site that has never published a release — Builderius\' publish cascade expects deliverable assets that only exist after a first real publish.', 'daveden-builderius-enhancements' ),
					),
				),
				'required'             => array( 'template', 'module_id', 'html' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'commit_name' => array(
						'type'        => 'string',
						'description' => __( 'The new commit name (absent on a dry run).', 'daveden-builderius-enhancements' ),
					),
					'dry_run'     => array( 'type' => 'boolean' ),
					'html'        => array(
						'type'        => 'string',
						'description' => __( 'The resulting subtree markup (dry run only).', 'daveden-builderius-enhancements' ),
					),
					'kept'        => array( 'type' => 'integer' ),
					'added'       => array( 'type' => 'integer' ),
					'removed'     => array( 'type' => 'integer' ),
					'stripped'    => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
					'unknown_markers' => array(
						'type'        => 'array',
						'description' => __( 'data-dbe-id markers that matched nothing in the subtree — probably typos. Each was treated as a new element, so the element it was meant to keep is removed and recreated with a fresh id. Check these before relying on the edit.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'string' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_apply_subtree_html',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	wp_register_ability(
		'dbe/get-tree-outline',
		array(
			'label'               => __( 'Get template tree outline', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Returns a compact outline of a template\'s module tree — one line per element with its id, tag and classes, Navigator label, module type and depth — so you can find the id of the element you want to edit by its label or tag instead of reading the whole HTML. Also returns the same data as a structured nodes array. Omit module_id for the whole template, or pass one to outline a single subtree.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'  => $template_arg,
					'module_id' => array(
						'type'        => 'string',
						'description' => __( 'Module ID to outline from. Omit for the whole template.', 'daveden-builderius-enhancements' ),
					),
				),
				'required'             => array( 'template' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'outline'     => array(
						'type'        => 'string',
						'description' => __( 'Indented text outline, one line per element.', 'daveden-builderius-enhancements' ),
					),
					'nodes'       => array(
						'type'        => 'array',
						'description' => __( 'Structured rows: id, type, tag, classes, label, component, depth.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
					'template_id' => array( 'type' => 'integer' ),
					'branch_id'   => array( 'type' => 'integer' ),
					'commit_name' => array( 'type' => 'string' ),
					'module_id'   => array( 'type' => 'string' ),
				),
			),
			'execute_callback'    => 'dbe_ability_get_tree_outline',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	wp_register_ability(
		'dbe/status',
		array(
			'label'               => __( 'Get save/publish status', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Reports the save vs publish state of Builderius templates. Saving (the builder Save button, createCommit, dbe/apply-subtree-html) only writes to the development branch; the front end renders NOTHING until a release is published — a site with no published release shows the theme fallback, which looks like a blank page. For each template this returns its active (saved) commit and whether that work is in the currently published release (unpublished_changes). Site-wide it returns the current published release, if any. Omit template to report on every template.', 'daveden-builderius-enhancements' ),
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
					'published_release' => array(
						'type'        => array( 'object', 'null' ),
						'description' => __( 'The currently published release (id, version, date), or null if the site has never published — in which case the front end renders no Builderius output at all.', 'daveden-builderius-enhancements' ),
					),
					'templates'         => array(
						'type'        => 'array',
						'description' => __( 'Per template: id, slug, title, branch_id, saved commit name/date, whether it is included in the published release, and unpublished_changes.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'object' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_status',
			'permission_callback' => 'dbe_ability_read_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	wp_register_ability(
		'dbe/publish',
		array(
			'label'               => __( 'Publish a release', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Creates and publishes a Builderius release from the templates\' saved (active) commits — the missing publish half of the save → publish → verify loop. This is the same createRelease mutation as the builder\'s Publish action: it bundles the active commit of every listed template (plus all global settings sets and any components they use) and makes the result live on the front end, replacing the previously published release. Check dbe/status first; run with dry_run to see what would be released. Save any pending work first — this publishes saved commits, not unsaved builder edits.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'templates'   => array(
						'type'        => 'array',
						'items'       => array( 'type' => 'string' ),
						'description' => __( 'Template post IDs or slugs to include. Omit to include every template that has saved work.', 'daveden-builderius-enhancements' ),
					),
					'version'     => array(
						'type'        => 'string',
						'description' => __( 'Release version label. Omit to auto-increment the latest release\'s patch number (1.0.0 when the site has never published).', 'daveden-builderius-enhancements' ),
					),
					'description' => array(
						'type'        => 'string',
						'description' => __( 'Release description shown in the builder\'s release list.', 'daveden-builderius-enhancements' ),
					),
					'dry_run'     => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview only: return the version and entities that WOULD be released without publishing.', 'daveden-builderius-enhancements' ),
					),
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

	$settings_set_arg = array(
		'type'        => 'string',
		'description' => __( 'Global settings set post ID or slug. Omit when the site has one (the usual case).', 'daveden-builderius-enhancements' ),
	);

	wp_register_ability(
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

	wp_register_ability(
		'dbe/patch-global-css',
		array(
			'label'               => __( 'Patch global CSS (named block)', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Adds, replaces or deletes ONE named block in the global stylesheet — a region fenced by /* @block: name */ … /* @endblock */ — and saves the result as a new commit. Every byte outside the named block is preserved verbatim, so unlike update_global_css this can never wipe the framework. A block that does not exist yet is appended at the end of the stylesheet. Typical use: a "fonts" block holding @font-face rules plus a :root override of --heading-font-family / --body-font-family. Saving does not publish; run dbe/publish for the change to reach the front end.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'block'        => array(
						'type'        => 'string',
						'pattern'     => '^[A-Za-z0-9_-]+$',
						'description' => __( 'The block name.', 'daveden-builderius-enhancements' ),
					),
					'css'          => array(
						'type'        => 'string',
						'description' => __( 'The block\'s new body (omit when deleting).', 'daveden-builderius-enhancements' ),
					),
					'delete'       => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Remove the block entirely.', 'daveden-builderius-enhancements' ),
					),
					'dry_run'      => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview: return the action and resulting stylesheet length without saving.', 'daveden-builderius-enhancements' ),
					),
					'settings_set' => $settings_set_arg,
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
				),
			),
			'execute_callback'    => 'dbe_ability_patch_global_css',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	wp_register_ability(
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

	wp_register_ability(
		'dbe/restore-global-css-from-commit',
		array(
			'label'               => __( 'Restore global CSS from a commit', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Recovery for a clobbered global stylesheet: reads the `css` setting from an earlier commit of the global settings set (find one with dbe/list-commits — a healthy framework is tens of KB) and saves it as a NEW commit, so the rollback is itself in history. Nothing else from the old commit is restored. Saving does not publish; run dbe/publish for the recovered CSS to reach the front end.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'commit'       => array(
						'type'        => 'string',
						'description' => __( 'The source commit name (from dbe/list-commits).', 'daveden-builderius-enhancements' ),
					),
					'dry_run'      => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview: return the source stylesheet\'s length and first lines without saving.', 'daveden-builderius-enhancements' ),
					),
					'settings_set' => $settings_set_arg,
				),
				'required'             => array( 'commit' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'commit_name' => array(
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
				),
			),
			'execute_callback'    => 'dbe_ability_restore_global_css',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);
}

/**
 * Both abilities turn markup into raw-rendered module settings, so they take
 * the same gate as the builder dialogs (feature toggle incl. the Pro check +
 * unfiltered_html) plus Builderius' own development capability, which the
 * createCommit endpoint checks anyway.
 */
function dbe_ability_permission() {
	return dbe_enabled( 'edit_as_html' )
		&& current_user_can( 'unfiltered_html' )
		&& current_user_can( 'builderius-development' );
}

/**
 * Read-only abilities (dbe/status) never touch raw markup, so they skip the
 * unfiltered_html requirement but still need the builder development
 * capability — they report on unpublished development state.
 */
function dbe_ability_read_permission() {
	return dbe_enabled( 'edit_as_html' )
		&& current_user_can( 'builderius-development' );
}

/* ---------------------------------------------------------------------- *
 *  Saved-state access (template → branch → active commit → config)
 * ---------------------------------------------------------------------- */

/**
 * Resolve a template reference to its saved content config.
 *
 * @param string $template Post ID or slug.
 * @return array|WP_Error { config, template_post, branch, commit }.
 */
function dbe_ability_load_config( $template ) {
	$template = trim( (string) $template );
	if ( is_numeric( $template ) ) {
		$post = get_post( (int) $template );
	} else {
		// Not get_page_by_path(): a template post's post_parent points at the
		// post it applies to, which that function misreads as a hierarchy.
		$found = get_posts(
			array(
				'post_type'   => 'builderius_template',
				'name'        => $template,
				'post_status' => get_post_stati(),
				'numberposts' => 1,
			)
		);
		$post  = $found ? $found[0] : null;
	}
	if ( ! $post || 'builderius_template' !== $post->post_type ) {
		return new WP_Error( 'dbe_no_template', sprintf( 'No builderius_template found for "%s".', $template ) );
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
		'template_post' => $post,
		'branch'        => $resolved['branch'],
		'commit'        => $resolved['commit'],
	);
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

/* ---------------------------------------------------------------------- *
 *  Global CSS named blocks (comment markers @block: name / @endblock)
 * ---------------------------------------------------------------------- */

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
	$blocks = array();
	if ( ! preg_match_all( '~/\*\s*@block:\s*([A-Za-z0-9_-]+)\s*\*/~', $css, $starts, PREG_OFFSET_CAPTURE | PREG_SET_ORDER ) ) {
		return $blocks;
	}
	foreach ( $starts as $m ) {
		$name       = $m[1][0];
		$start      = $m[0][1];
		$body_start = $start + strlen( $m[0][0] );
		if ( ! preg_match( '~/\*\s*@endblock\s*\*/~', $css, $end_m, PREG_OFFSET_CAPTURE, $body_start ) ) {
			return new WP_Error( 'dbe_block_unterminated', sprintf( 'Block "%s" has no /* @endblock */ marker.', $name ) );
		}
		$blocks[] = array(
			'name'       => $name,
			'start'      => $start,
			'body_start' => $body_start,
			'body_end'   => $end_m[0][1],
			'end'        => $end_m[0][1] + strlen( $end_m[0][0] ),
		);
	}
	return $blocks;
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
			$end += 1;
		}
		return array(
			'css'    => substr( $css, 0, $target['start'] ) . substr( $css, $end ),
			'action' => 'deleted',
		);
	}

	$body = trim( (string) $body );
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
 * @param string $description Commit description.
 * @return string|WP_Error The new commit name.
 */
function dbe_ability_save_global_css( $loaded, $css, $description ) {
	$config = $loaded['config'];
	$config['template']['settings'][ $loaded['css_index'] ]['value'] = $css;
	$json = wp_json_encode( $config, JSON_UNESCAPED_UNICODE );
	if ( false === $json ) {
		return new WP_Error( 'dbe_encode_failed', 'Could not encode the content config.' );
	}
	$mutation = sprintf(
		'mutation { createCommit(input: { branch_id: %d serialized_content_config: "%s" description: "%s" }, autopublish: false) { commit { name } } }',
		(int) $loaded['branch']->ID,
		addcslashes( $json, '\\"' ),
		addcslashes( $description, '\\"' )
	);
	$data = dbe_ability_graphql( 'dbeGlobalCss', $mutation );
	if ( is_wp_error( $data ) ) {
		return $data;
	}
	$name = $data['createCommit']['commit']['name'] ?? '';
	if ( '' === $name ) {
		return new WP_Error( 'dbe_commit_failed', 'createCommit returned no commit name.' );
	}
	return $name;
}

/* ---------------------------------------------------------------------- *
 *  Component registry (slug -> label + declared property names)
 * ---------------------------------------------------------------------- */

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
	$registry = array();
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
								$props[ $def['name'] ] = $def;
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

/* ---------------------------------------------------------------------- *
 *  Shared vocabulary — keep in sync with builder.js
 * ---------------------------------------------------------------------- */

/**
 * Module types the server-side converter can express as plain HTML.
 * Components serialise as a <dbe-component name="…"> element (see the
 * registry above). SvgCode is deliberately absent (see the file header) —
 * it is preserved via <dbe-keep> instead.
 */
function dbe_ability_expressible() {
	return array(
		'HtmlElement'   => true,
		'Collection'    => true,
		'SubCollection' => true,
		'Template'      => true,
		'Component'     => true,
	);
}

/**
 * Mirror of DBE_HTML_VOID in builder.js.
 */
function dbe_ability_void_tags() {
	return array_fill_keys(
		array( 'img', 'input', 'br', 'hr', 'area', 'base', 'col', 'embed', 'link', 'meta', 'param', 'source', 'track', 'wbr' ),
		true
	);
}

/**
 * Mirror of DBE_HTML_KNOWN_TAGS in builder.js.
 */
function dbe_ability_known_tags() {
	static $tags = null;
	if ( null === $tags ) {
		$tags = array_fill_keys(
			explode( ' ', 'a abbr address area article aside audio b bdi bdo blockquote br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr i img input ins kbd label legend li main mark menu meter nav ol optgroup option output p picture pre progress q rp rt ruby s samp search section select small source span strong sub summary sup table tbody td template textarea tfoot th thead time tr track u ul var video wbr' ),
			true
		);
	}
	return $tags;
}

/**
 * Mirror of dbeDangerousUrl() in builder.js: schemes that can execute or
 * smuggle script once the value is rendered raw.
 */
function dbe_ability_dangerous_url( $value ) {
	$v = strtolower( preg_replace( '/[\x00-\x20]+/', '', (string) $value ) );
	if ( preg_match( '/^(?:javascript|vbscript):/', $v ) ) {
		return true;
	}
	if ( str_starts_with( $v, 'data:' ) ) {
		return ! preg_match( '/^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)[;,]/', $v );
	}
	return false;
}

/**
 * Mirror of dbeAttrBlocked() in builder.js. Returns a short reason string
 * when the attribute must not be stored, null when it is fine.
 */
function dbe_ability_attr_blocked( $name, $value ) {
	$n         = strtolower( (string) $name );
	$url_attrs = array( 'href' => 1, 'src' => 1, 'action' => 1, 'formaction' => 1, 'poster' => 1, 'xlink:href' => 1 );
	if ( '' === $n || in_array( $n, array( 'data-dbe-id', 'data-dbe-module', 'data-dbe-label' ), true ) ) {
		return '' === $n ? 'attribute' : $n;
	}
	if ( str_starts_with( $n, 'on' ) ) {
		return $n;
	}
	if ( isset( $url_attrs[ $n ] ) && dbe_ability_dangerous_url( $value ) ) {
		return $n . '="' . substr( (string) $value, 0, 12 ) . '…"';
	}
	return null;
}

/**
 * Random module id in Builderius' shape ('u' + 9 hex), like dbeMakeId().
 */
function dbe_ability_make_id() {
	$id = 'u';
	for ( $i = 0; $i < 9; $i++ ) {
		$id .= dechex( wp_rand( 0, 15 ) );
	}
	return $id;
}

/**
 * Read a named setting value off a config module.
 */
function dbe_ability_setting( $module, $name ) {
	foreach ( (array) ( $module['settings'] ?? array() ) as $s ) {
		if ( isset( $s['name'] ) && $s['name'] === $name ) {
			return $s['value'] ?? null;
		}
	}
	return null;
}

/* ---------------------------------------------------------------------- *
 *  Serialiser (config → HTML) — port of dbeSerializeSubtree()
 * ---------------------------------------------------------------------- */

function dbe_ability_escape_attr( $v ) {
	return str_replace( array( '&', '"' ), array( '&amp;', '&quot;' ), (string) $v );
}

/**
 * Serialise one module subtree. Non-expressible modules become <dbe-keep>
 * placeholders and are recorded in $non_editable.
 */
function dbe_ability_serialize( $config, $id, $depth, &$non_editable ) {
	$mods = $config['modules'];
	$idx  = $config['indexes'];
	$m    = $mods[ $id ] ?? null;
	if ( ! $m ) {
		return '';
	}
	$pad         = str_repeat( '  ', $depth );
	$expressible = dbe_ability_expressible();

	// A Component instance serialises as a self-describing custom element
	// carrying its slug and any property overrides. Lowercase custom-element
	// name (not Astro PascalCase) because HTML parsers lowercase tag names,
	// so <SiteHeader> would not survive the round trip. It is a LEAF here:
	// the component's internals live in its own definition, not the instance.
	if ( 'Component' === $m['name'] ) {
		$slug = (string) dbe_ability_setting( $m, 'componentName' );
		$open = '<dbe-component name="' . dbe_ability_escape_attr( $slug ) . '"';
		foreach ( (array) ( dbe_ability_setting( $m, 'componentProperties' ) ?: array() ) as $p ) {
			if ( empty( $p['name'] ) ) {
				continue;
			}
			$open .= ' ' . $p['name'] . '="' . dbe_ability_escape_attr( $p['value'] ?? '' ) . '"';
		}
		$open .= ' data-dbe-id="' . $id . '"></dbe-component>';
		return $pad . $open;
	}

	if ( empty( $expressible[ $m['name'] ] ) ) {
		$non_editable[] = array(
			'id'    => $id,
			'type'  => $m['name'],
			'label' => $m['label'] ?? '',
		);
		return $pad . '<dbe-keep data-dbe-id="' . $id . '"><!-- '
			. dbe_ability_escape_attr( $m['name'] . ': ' . ( $m['label'] ?? '' ) )
			. ' — preserved as-is, leave this element in place --></dbe-keep>';
	}

	$tag  = 'Template' === $m['name']
		? 'template'
		: strtolower( (string) ( dbe_ability_setting( $m, 'tag' ) ?: 'div' ) );
	$open = '<' . $tag;

	$tag_id = dbe_ability_setting( $m, 'tagId' );
	if ( $tag_id ) {
		$open .= ' id="' . dbe_ability_escape_attr( $tag_id ) . '"';
	}
	$classes = dbe_ability_setting( $m, 'tagClass' );
	if ( is_array( $classes ) && $classes ) {
		$open .= ' class="' . dbe_ability_escape_attr( implode( ' ', $classes ) ) . '"';
	}
	foreach ( (array) ( dbe_ability_setting( $m, 'htmlAttribute' ) ?: array() ) as $a ) {
		if ( empty( $a['name'] ) || 'data-dbe-id' === $a['name'] ) {
			continue;
		}
		$open .= ( ! isset( $a['value'] ) || '' === $a['value'] )
			? ' ' . $a['name'] . '=""'
			: ' ' . $a['name'] . '="' . dbe_ability_escape_attr( $a['value'] ) . '"';
	}
	$open .= ' data-dbe-id="' . $id . '">';

	$voids = dbe_ability_void_tags();
	if ( isset( $voids[ $tag ] ) ) {
		return $pad . $open;
	}

	$content = dbe_ability_setting( $m, 'content' );
	$text    = null === $content ? '' : (string) $content;
	$kids    = (array) ( $idx[ $id ] ?? array() );

	if ( ! $kids ) {
		if ( strlen( $text ) <= 70 && false === strpos( $text, "\n" ) ) {
			return $pad . $open . $text . '</' . $tag . '>';
		}
		return $pad . $open . "\n" . $pad . '  ' . $text . "\n" . $pad . '</' . $tag . '>';
	}

	$lines = array( $pad . $open );
	if ( '' !== $text ) {
		$lines[] = $pad . '  ' . $text;
	}
	foreach ( $kids as $k ) {
		$lines[] = dbe_ability_serialize( $config, $k, $depth + 1, $non_editable );
	}
	$lines[] = $pad . '</' . $tag . '>';
	return implode( "\n", $lines );
}

/* ---------------------------------------------------------------------- *
 *  Outline (config → scannable id/label/tag map)
 * ---------------------------------------------------------------------- */

/**
 * Walk a subtree, appending one row to $nodes and one line to $lines per
 * module. The row carries everything an agent needs to target an element by
 * label or tag: id, module type, tag, classes, label, component slug, depth.
 * The line is the same, indented, for cheap human scanning.
 */
function dbe_ability_outline( $config, $id, $depth, &$nodes, &$lines ) {
	$mods = $config['modules'];
	$idx  = $config['indexes'];
	$m    = $mods[ $id ] ?? null;
	if ( ! $m ) {
		return;
	}
	$type      = $m['name'];
	$label     = (string) ( $m['label'] ?? '' );
	$tag       = null;
	$classes   = array();
	$component = null;

	if ( 'Component' === $type ) {
		$component = (string) dbe_ability_setting( $m, 'componentName' );
		$token     = '<dbe-component name="' . $component . '">';
	} elseif ( 'SvgCode' === $type ) {
		$tag   = 'svg';
		$token = '<svg>';
	} else {
		$tag = 'Template' === $type
			? 'template'
			: strtolower( (string) ( dbe_ability_setting( $m, 'tag' ) ?: 'div' ) );
		$c   = dbe_ability_setting( $m, 'tagClass' );
		if ( is_array( $c ) ) {
			$classes = array_values( $c );
		}
		$token = '<' . $tag . ( $classes ? '.' . implode( '.', $classes ) : '' ) . '>';
	}
	// Name the type in the line when it is not a plain element (the token
	// already reveals components and svg).
	if ( ! in_array( $type, array( 'HtmlElement', 'Component', 'SvgCode' ), true ) ) {
		$token .= ' [' . $type . ']';
	}

	$nodes[] = array(
		'id'        => $id,
		'type'      => $type,
		'tag'       => $tag,
		'classes'   => $classes,
		'label'     => $label,
		'component' => $component,
		'depth'     => $depth,
	);
	$lines[] = str_repeat( '  ', $depth ) . $token . ' #' . $id
		. ( '' !== $label ? ' » ' . $label : '' );

	foreach ( (array) ( $idx[ $id ] ?? array() ) as $k ) {
		dbe_ability_outline( $config, $k, $depth + 1, $nodes, $lines );
	}
}

/* ---------------------------------------------------------------------- *
 *  Parser + sanitiser (HTML → node trees) — port of dbeParseHtmlFragment()
 * ---------------------------------------------------------------------- */

/**
 * Parse and sanitise markup into plain node trees. Returns
 * { roots: array, stripped: string[], unknown_markers: string[] }. $orig_ids
 * is the id set the data-dbe-id / dbe-keep markers may claim; a marker that
 * resolves to none of those is collected in unknown_markers so the caller can
 * warn that keeping it was intended but the original will instead be removed
 * and a fresh element created.
 */
function dbe_ability_parse_fragment( $html, $orig_ids ) {
	$doc = new DOMDocument();
	libxml_use_internal_errors( true );
	$doc->loadHTML(
		'<?xml encoding="UTF-8"><!DOCTYPE html><html><body>' . $html . '</body></html>',
		LIBXML_NOERROR | LIBXML_NOWARNING
	);
	libxml_clear_errors();
	$body = $doc->getElementsByTagName( 'body' )->item( 0 );

	$stripped   = array();
	$claimed    = array();
	$unknown    = array();
	$strip_tags = array_fill_keys(
		array( 'script', 'style', 'link', 'meta', 'iframe', 'object', 'embed', 'noscript', 'base', 'math' ),
		true
	);
	$known    = dbe_ability_known_tags();
	$registry = dbe_ability_component_registry();

	$convert = function ( $el ) use ( &$convert, &$stripped, &$claimed, &$unknown, $orig_ids, $strip_tags, $known, $registry ) {
		$tag = strtolower( $el->tagName );

		// A keep-placeholder preserves a non-editable module and its whole
		// subtree; its own children (the human-hint comment) are ignored.
		if ( 'dbe-keep' === $tag ) {
			$marker = $el->getAttribute( 'data-dbe-id' );
			if ( $marker && isset( $orig_ids[ $marker ] ) && empty( $claimed[ $marker ] ) ) {
				$claimed[ $marker ] = true;
				return array( 'keep' => $marker );
			}
			$stripped[] = '<dbe-keep> (unknown or duplicate marker)';
			return null;
		}

		// A component instance: <dbe-component name="slug" prop="value" …>.
		// `name` selects the component; every other attribute (bar the dbe
		// markers) is a property override validated against what the
		// component declares. It is a leaf — any children are ignored.
		if ( 'dbe-component' === $tag ) {
			$slug = trim( (string) $el->getAttribute( 'name' ) );
			if ( '' === $slug || ! isset( $registry[ $slug ] ) ) {
				$known_slugs = implode( ', ', array_keys( $registry ) );
				$stripped[]  = '<dbe-component name="' . $slug . '"> (unknown component; available: ' . ( $known_slugs ?: 'none' ) . ')';
				return null;
			}
			$node = array(
				'existingId'    => null,
				'module'        => 'Component',
				'componentName' => $slug,
				'props'         => array(),
				'label'         => '',
				'children'      => array(),
			);
			$declared = $registry[ $slug ]['props'];
			foreach ( iterator_to_array( $el->attributes ) as $a ) {
				$n = strtolower( $a->name );
				if ( 'name' === $n ) {
					continue;
				}
				if ( 'data-dbe-id' === $n ) {
					if ( isset( $orig_ids[ $a->value ] ) && empty( $claimed[ $a->value ] ) ) {
						$claimed[ $a->value ] = true;
						$node['existingId']   = $a->value;
					} elseif ( '' !== trim( (string) $a->value ) ) {
						$unknown[ $a->value ] = true;
					}
					continue;
				}
				if ( 'data-dbe-label' === $n ) {
					$node['label'] = trim( preg_replace( '/\s+/', ' ', (string) $a->value ) );
					continue;
				}
				// A prop the component does not declare cannot resolve, so it
				// is dropped with a note rather than stored as dead data.
				if ( $declared && ! isset( $declared[ $n ] ) ) {
					$stripped[] = $n . ' (not a property of ' . $slug . ')';
					continue;
				}
				$node['props'][] = array(
					'name'  => $n,
					'value' => $a->value,
				);
			}
			return $node;
		}
		// PHP's HTML parser lowercases attribute names, which corrupts SVG
		// (viewBox → viewbox), so inline SVG has no safe server-side path.
		if ( 'svg' === $tag ) {
			$stripped[] = '<svg> (not supported server-side — use the builder dialog, or <dbe-keep> for an existing SvgCode element)';
			return null;
		}
		if ( isset( $strip_tags[ $tag ] ) || empty( $known[ $tag ] ) ) {
			$stripped[] = '<' . $tag . '>';
			return null;
		}

		$node = array(
			'existingId' => null,
			'module'     => 'template' === $tag ? 'Template' : 'HtmlElement',
			'tag'        => $tag,
			'tagId'      => '',
			'classes'    => array(),
			'attrs'      => array(),
			'content'    => '',
			'children'   => array(),
			'label'      => '',
		);

		foreach ( iterator_to_array( $el->attributes ) as $a ) {
			$n = strtolower( $a->name );
			$v = $a->value;
			if ( 'data-dbe-id' === $n ) {
				if ( isset( $orig_ids[ $v ] ) && empty( $claimed[ $v ] ) ) {
					$claimed[ $v ]      = true;
					$node['existingId'] = $v;
				} elseif ( '' !== trim( (string) $v ) ) {
					$unknown[ $v ] = true;
				}
				continue;
			}
			if ( 'data-dbe-label' === $n ) {
				$node['label'] = trim( preg_replace( '/\s+/', ' ', (string) $v ) );
				continue;
			}
			if ( 'data-dbe-module' === $n ) {
				$mv = strtolower( (string) $v );
				if ( 'collection' === $mv ) {
					$node['module'] = 'Collection';
				} elseif ( 'subcollection' === $mv ) {
					$node['module'] = 'SubCollection';
				}
				continue;
			}
			if ( 'id' === $n ) {
				$node['tagId'] = $v;
				continue;
			}
			if ( 'class' === $n ) {
				$node['classes'] = array_values( array_filter( preg_split( '/\s+/', $v ) ) );
				continue;
			}
			// A data binding implies a Collection; the attribute stays stored.
			if ( 'data-b-context' === $n && 'HtmlElement' === $node['module'] ) {
				$node['module'] = 'Collection';
			}
			$blocked = dbe_ability_attr_blocked( $n, $v );
			if ( $blocked ) {
				$stripped[] = $blocked;
				continue;
			}
			$node['attrs'][] = array(
				'name'  => $n,
				'value' => $v,
			);
		}

		$seen_element = false;
		foreach ( iterator_to_array( $el->childNodes ) as $ch ) {
			if ( XML_TEXT_NODE === $ch->nodeType ) {
				$t = trim( preg_replace( '/\s+/', ' ', $ch->textContent ) );
				if ( '' === $t ) {
					continue;
				}
				if ( ! $seen_element ) {
					$node['content'] .= ( '' !== $node['content'] ? ' ' : '' ) . $t;
				} else {
					// Text after an element has no home in the content-first
					// model — synthesise a span so nothing silently drops.
					$node['children'][] = array(
						'existingId' => null,
						'module'     => 'HtmlElement',
						'tag'        => 'span',
						'tagId'      => '',
						'classes'    => array(),
						'attrs'      => array(),
						'content'    => $t,
						'children'   => array(),
						'label'      => '',
					);
				}
				continue;
			}
			if ( XML_ELEMENT_NODE === $ch->nodeType ) {
				$c = $convert( $ch );
				if ( null !== $c ) {
					$node['children'][] = $c;
					$seen_element       = true;
				}
			}
		}
		return $node;
	};

	$roots = array();
	if ( $body ) {
		foreach ( iterator_to_array( $body->childNodes ) as $ch ) {
			if ( XML_ELEMENT_NODE === $ch->nodeType ) {
				$r = $convert( $ch );
				if ( null !== $r ) {
					$roots[] = $r;
				}
			}
		}
	}

	return array(
		'roots'           => $roots,
		'stripped'        => $stripped,
		'unknown_markers' => array_keys( $unknown ),
	);
}

/**
 * Settings for a parsed node — port of dbeNodeSettings(). A Template has no
 * tag setting and neither Templates nor Collections take content.
 */
function dbe_ability_node_settings( $node, $module_name ) {
	// A Component instance is identified by its slug, with optional property
	// overrides; it carries none of the tag/class/content settings below.
	if ( 'Component' === $module_name ) {
		$s = array(
			array(
				'name'  => 'componentName',
				'value' => $node['componentName'],
			),
		);
		if ( ! empty( $node['props'] ) ) {
			$s[] = array(
				'name'  => 'componentProperties',
				'value' => array_values( $node['props'] ),
			);
		}
		return $s;
	}
	$s = array();
	if ( 'Template' !== $module_name ) {
		$s[] = array(
			'name'  => 'tag',
			'value' => $node['tag'],
		);
	}
	if ( '' !== $node['tagId'] ) {
		$s[] = array(
			'name'  => 'tagId',
			'value' => $node['tagId'],
		);
	}
	if ( $node['classes'] ) {
		$s[] = array(
			'name'  => 'tagClass',
			'value' => array_values( $node['classes'] ),
		);
	}
	if ( $node['attrs'] ) {
		$s[] = array(
			'name'  => 'htmlAttribute',
			'value' => array_values( $node['attrs'] ),
		);
	}
	if ( '' !== $node['content'] && 'HtmlElement' === $module_name ) {
		$s[] = array(
			'name'  => 'content',
			'value' => $node['content'],
		);
	}
	return $s;
}

/* ---------------------------------------------------------------------- *
 *  Reconciler (node tree → new config) — config-level dbeApplyHtmlTree()
 * ---------------------------------------------------------------------- */

/**
 * Rebuild the config with $tree replacing the subtree rooted at $root_id.
 * Returns { config, kept, added, removed }.
 */
function dbe_ability_reconcile( $config, $root_id, $tree ) {
	$mods = $config['modules'];
	$idx  = $config['indexes'];

	// Every id in the original subtree, depth-first.
	$orig = array();
	$walk = function ( $id ) use ( &$walk, &$orig, $idx ) {
		$orig[] = $id;
		foreach ( (array) ( $idx[ $id ] ?? array() ) as $k ) {
			$walk( $k );
		}
	};
	$walk( $root_id );

	// The root's identity is never negotiable.
	$tree['existingId'] = $root_id;

	$new_mods = $mods;
	$new_idx  = $idx;
	foreach ( $orig as $id ) {
		unset( $new_mods[ $id ], $new_idx[ $id ] );
	}
	// The root id survives, so its slot in the parent's index list stands.

	$counts = array(
		'kept'  => 0,
		'added' => 0,
	);

	// Copy a kept placeholder's module and entire subtree verbatim.
	$copy_keep = function ( $id, $parent_id ) use ( &$copy_keep, &$new_mods, &$new_idx, $mods, $idx ) {
		$m           = $mods[ $id ];
		$m['parent'] = $parent_id;
		$new_mods[ $id ] = $m;
		$kids = (array) ( $idx[ $id ] ?? array() );
		if ( $kids ) {
			$new_idx[ $id ] = $kids;
			foreach ( $kids as $k ) {
				$copy_keep( $k, $id );
			}
		}
	};

	$place = function ( $node, $parent_id ) use ( &$place, &$new_mods, &$new_idx, &$counts, $copy_keep, $mods ) {
		if ( isset( $node['keep'] ) ) {
			$copy_keep( $node['keep'], $parent_id );
			$counts['kept']++;
			return $node['keep'];
		}
		if ( $node['existingId'] && isset( $mods[ $node['existingId'] ] ) ) {
			$id = $node['existingId'];
			$m  = $mods[ $id ];
			// The saved module's TYPE always wins over whatever the markup
			// guessed; replace only the expressible settings (component
			// identity + props included, so a kept instance can be re-pointed
			// or have its props edited).
			$html_settings = array( 'tag', 'tagId', 'tagClass', 'htmlAttribute', 'content', 'contentSvg', 'componentName', 'componentProperties' );
			$keep_settings = array_values(
				array_filter(
					(array) ( $m['settings'] ?? array() ),
					function ( $s ) use ( $html_settings ) {
						return ! in_array( $s['name'] ?? '', $html_settings, true );
					}
				)
			);
			$m['settings'] = array_merge( $keep_settings, dbe_ability_node_settings( $node, $m['name'] ) );
			if ( '' !== $node['label'] ) {
				$m['label'] = $node['label'];
			}
			$m['parent'] = $parent_id;
			$counts['kept']++;
		} else {
			$id          = dbe_ability_make_id();
			$module_name = $node['module'];
			// Default label: the tag for an element, the component's own label
			// for a new instance, else the module type.
			if ( '' !== $node['label'] ) {
				$label = $node['label'];
			} elseif ( 'HtmlElement' === $module_name ) {
				$label = ucfirst( $node['tag'] );
			} elseif ( 'Component' === $module_name ) {
				$registry = dbe_ability_component_registry();
				$label    = $registry[ $node['componentName'] ]['label'] ?? $module_name;
			} else {
				$label = $module_name;
			}
			$m = array(
				'id'       => $id,
				'name'     => $module_name,
				'label'    => $label,
				'settings' => dbe_ability_node_settings( $node, $module_name ),
				'parent'   => $parent_id,
			);
			$counts['added']++;
		}
		$new_mods[ $id ] = $m;

		$kid_ids = array();
		foreach ( $node['children'] as $child ) {
			$kid_ids[] = $place( $child, $id );
		}
		if ( $kid_ids ) {
			$new_idx[ $id ] = $kid_ids;
		}
		return $id;
	};

	// The subtree root keeps its original parent.
	$root_parent = $mods[ $root_id ]['parent'] ?? '';
	$place( $tree, $root_parent );

	$removed = 0;
	foreach ( $orig as $id ) {
		if ( ! isset( $new_mods[ $id ] ) ) {
			$removed++;
		}
	}

	$config['modules'] = $new_mods;
	$config['indexes'] = $new_idx;

	return array(
		'config'  => $config,
		'kept'    => $counts['kept'],
		'added'   => $counts['added'],
		'removed' => $removed,
	);
}

/* ---------------------------------------------------------------------- *
 *  Save — Builderius' own createCommit mutation, via internal REST
 * ---------------------------------------------------------------------- */

/**
 * Dispatch a GraphQL mutation through Builderius' own REST endpoint, the
 * same channel the builder UI uses, so permissions, events and cache
 * flushes all apply.
 *
 * @param string $name     Operation name reported to the endpoint.
 * @param string $mutation The GraphQL document.
 * @return array|WP_Error The mutation's `data` array.
 */
function dbe_ability_graphql( $name, $mutation ) {
	/* Builderius Pro's builderius_get_current_user hook caches the current
	   user in its runtime cache the first time anything applies the filter.
	   Under OAuth-authenticated REST (the MCP adapter) that first application
	   can happen BEFORE authentication resolves the user, poisoning the cache
	   with user 0 and failing the mutation's capability check. The ability's
	   own permission callback has already vouched for the real user, so pin
	   the filter to them for the duration of the internal dispatch. */
	$pin_user = static function () {
		return wp_get_current_user();
	};
	add_filter( 'builderius_get_current_user', $pin_user, PHP_INT_MAX );

	$request = new WP_REST_Request( 'POST', '/wp/v2/builderius' );
	$request->set_header( 'Content-Type', 'application/json' );
	$request->set_body(
		wp_json_encode(
			array(
				'queries' => array(
					array(
						'name'  => $name,
						'query' => $mutation,
					),
				),
			)
		)
	);
	$response = rest_do_request( $request );
	remove_filter( 'builderius_get_current_user', $pin_user, PHP_INT_MAX );

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
 * @return string|WP_Error The new commit name.
 */
function dbe_ability_create_commit( $branch_id, $config, $autopublish = false ) {
	$json = wp_json_encode( $config, JSON_UNESCAPED_UNICODE );
	if ( false === $json ) {
		return new WP_Error( 'dbe_encode_failed', 'Could not encode the content config.' );
	}
	$mutation = sprintf(
		'mutation { createCommit(input: { branch_id: %d serialized_content_config: "%s" description: "%s" }, autopublish: %s) { commit { name autopublished } } }',
		(int) $branch_id,
		addcslashes( $json, '\\"' ),
		'Applied via dbe/apply-subtree-html',
		$autopublish ? 'true' : 'false'
	);
	$data = dbe_ability_graphql( 'dbeApplySubtreeHtml', $mutation );
	if ( is_wp_error( $data ) ) {
		return $data;
	}
	$name = $data['createCommit']['commit']['name'] ?? '';
	if ( '' === $name ) {
		return new WP_Error( 'dbe_commit_failed', 'createCommit returned no commit name.' );
	}
	return $name;
}

/* ---------------------------------------------------------------------- *
 *  Execute callbacks
 * ---------------------------------------------------------------------- */

/**
 * dbe/get-subtree-html.
 */
function dbe_ability_get_subtree_html( $input ) {
	$loaded = dbe_ability_load_config( $input['template'] ?? '' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}
	$config    = $loaded['config'];
	$module_id = trim( (string) ( $input['module_id'] ?? '' ) );

	$non_editable = array();
	if ( '' !== $module_id ) {
		if ( ! isset( $config['modules'][ $module_id ] ) ) {
			return new WP_Error( 'dbe_no_module', sprintf( 'No module "%s" in the template.', $module_id ) );
		}
		$html = dbe_ability_serialize( $config, $module_id, 0, $non_editable );
	} else {
		$parts = array();
		foreach ( (array) ( $config['indexes']['root'] ?? array() ) as $root ) {
			$parts[] = dbe_ability_serialize( $config, $root, 0, $non_editable );
		}
		$html = implode( "\n", $parts );
	}

	return array(
		'html'         => $html,
		'template_id'  => $loaded['template_post']->ID,
		'branch_id'    => $loaded['branch']->ID,
		'commit_name'  => $loaded['commit']->post_name,
		'module_id'    => $module_id,
		'non_editable' => $non_editable,
	);
}

/**
 * dbe/get-tree-outline.
 */
function dbe_ability_get_tree_outline( $input ) {
	$loaded = dbe_ability_load_config( $input['template'] ?? '' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}
	$config    = $loaded['config'];
	$module_id = trim( (string) ( $input['module_id'] ?? '' ) );

	$nodes = array();
	$lines = array();
	if ( '' !== $module_id ) {
		if ( ! isset( $config['modules'][ $module_id ] ) ) {
			return new WP_Error( 'dbe_no_module', sprintf( 'No module "%s" in the template.', $module_id ) );
		}
		dbe_ability_outline( $config, $module_id, 0, $nodes, $lines );
	} else {
		foreach ( (array) ( $config['indexes']['root'] ?? array() ) as $root ) {
			dbe_ability_outline( $config, $root, 0, $nodes, $lines );
		}
	}

	return array(
		'outline'     => implode( "\n", $lines ),
		'nodes'       => $nodes,
		'template_id' => $loaded['template_post']->ID,
		'branch_id'   => $loaded['branch']->ID,
		'commit_name' => $loaded['commit']->post_name,
		'module_id'   => $module_id,
	);
}

/**
 * dbe/apply-subtree-html.
 */
function dbe_ability_apply_subtree_html( $input ) {
	$loaded = dbe_ability_load_config( $input['template'] ?? '' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}
	$config    = $loaded['config'];
	$module_id = trim( (string) ( $input['module_id'] ?? '' ) );
	$html      = (string) ( $input['html'] ?? '' );

	if ( ! isset( $config['modules'][ $module_id ] ) ) {
		return new WP_Error( 'dbe_no_module', sprintf( 'No module "%s" in the template.', $module_id ) );
	}
	$expressible = dbe_ability_expressible();
	$root_type   = $config['modules'][ $module_id ]['name'];
	if ( empty( $expressible[ $root_type ] ) ) {
		return new WP_Error(
			'dbe_root_not_editable',
			sprintf( 'The subtree root is a %s, which HTML cannot express — pick an element inside or around it.', $root_type )
		);
	}

	// The markers may only claim ids from the ORIGINAL subtree, so a payload
	// can never capture or rewrite another part of the template.
	$orig_ids = array();
	$walk     = function ( $id ) use ( &$walk, &$orig_ids, $config ) {
		$orig_ids[ $id ] = true;
		foreach ( (array) ( $config['indexes'][ $id ] ?? array() ) as $k ) {
			$walk( $k );
		}
	};
	$walk( $module_id );

	$parsed = dbe_ability_parse_fragment( $html, $orig_ids );
	if ( 1 !== count( $parsed['roots'] ) ) {
		// Name what was removed when the count is off because of stripping,
		// so a payload that collapsed to nothing does not read as an empty edit.
		$why = $parsed['stripped']
			? ' Stripped: ' . implode( ', ', array_unique( $parsed['stripped'] ) ) . '.'
			: '';
		return new WP_Error(
			'dbe_one_root',
			sprintf( 'The HTML must have exactly one root element (found %d after sanitising).%s', count( $parsed['roots'] ), $why )
		);
	}
	$tree = $parsed['roots'][0];
	if ( isset( $tree['keep'] ) ) {
		return new WP_Error( 'dbe_root_keep', 'The root element cannot be a <dbe-keep> placeholder.' );
	}

	$result = dbe_ability_reconcile( $config, $module_id, $tree );

	// Dry run: report what WOULD happen and the resulting markup (with the
	// ids new elements would get) without writing a commit. Lets an agent
	// check an edit before mutating, and see the created elements' ids.
	if ( ! empty( $input['dry_run'] ) ) {
		$throwaway = array();
		return array(
			'dry_run'         => true,
			'html'            => dbe_ability_serialize( $result['config'], $module_id, 0, $throwaway ),
			'kept'            => $result['kept'],
			'added'           => $result['added'],
			'removed'         => $result['removed'],
			'stripped'        => array_values( array_unique( $parsed['stripped'] ) ),
			'unknown_markers' => $parsed['unknown_markers'],
		);
	}

	$commit_name = dbe_ability_create_commit(
		$loaded['branch']->ID,
		$result['config'],
		! empty( $input['autopublish'] )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	return array(
		'commit_name'     => $commit_name,
		'kept'            => $result['kept'],
		'added'           => $result['added'],
		'removed'         => $result['removed'],
		'stripped'        => array_values( array_unique( $parsed['stripped'] ) ),
		'unknown_markers' => $parsed['unknown_markers'],
	);
}

/* ---------------------------------------------------------------------- *
 *  Save/publish state + publishing
 * ---------------------------------------------------------------------- */

/**
 * The currently published release post, or null. The front end renders
 * exclusively from this (BuilderiusDeliverableReleaseProvider): no release,
 * no Builderius output at all.
 *
 * @return WP_Post|null
 */
function dbe_ability_published_release() {
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
 * Every template that has saved work (a branch with at least one commit),
 * resolved through dbe_ability_load_config so branch/commit selection is
 * identical to the editing abilities'.
 *
 * @param array|null $refs Template IDs/slugs to restrict to, or null for all.
 * @return array{loaded:array,errors:array} loaded rows from
 *         dbe_ability_load_config keyed by template ID.
 */
function dbe_ability_load_templates( $refs = null ) {
	if ( null === $refs ) {
		$refs = get_posts(
			array(
				'post_type'   => 'builderius_template',
				'post_status' => get_post_stati(),
				'numberposts' => -1,
				'fields'      => 'ids',
			)
		);
	}
	$loaded = array();
	$errors = array();
	foreach ( $refs as $ref ) {
		$row = dbe_ability_load_config( (string) $ref );
		if ( is_wp_error( $row ) ) {
			$errors[] = array(
				'template' => (string) $ref,
				'error'    => $row->get_error_message(),
			);
			continue;
		}
		$loaded[ $row['template_post']->ID ] = $row;
	}
	return array(
		'loaded' => $loaded,
		'errors' => $errors,
	);
}

/**
 * dbe/status.
 */
function dbe_ability_status( $input ) {
	$refs    = ( isset( $input['template'] ) && '' !== trim( (string) $input['template'] ) )
		? array( $input['template'] )
		: null;
	$release = dbe_ability_published_release();

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

	$result = dbe_ability_load_templates( $refs );
	$rows   = array();
	foreach ( $result['loaded'] as $tid => $row ) {
		$slug   = $row['template_post']->post_name;
		$commit = $row['commit'];
		$dsm    = $dsm_by_name[ $slug ] ?? null;
		$saved_config     = (string) get_post_meta( $commit->ID, 'content_config', true );
		$released_config  = $dsm ? (string) get_post_meta( $dsm->ID, 'content_config', true ) : '';
		$rows[] = array(
			'template_id'         => $tid,
			'slug'                => $slug,
			'title'               => $row['template_post']->post_title,
			'branch_id'           => $row['branch']->ID,
			'saved_commit'        => $commit->post_name,
			'saved_at'            => $commit->post_date,
			'in_published_release' => (bool) $dsm,
			'unpublished_changes' => ! $dsm || md5( $saved_config ) !== md5( $released_config ),
		);
	}

	return array(
		'published_release' => $release ? array(
			'id'      => $release->ID,
			'version' => $release->post_title,
			'date'    => $release->post_date,
		) : null,
		'templates'         => $rows,
		'errors'            => $result['errors'],
	);
}

/**
 * dbe/publish.
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

	$description = isset( $input['description'] ) ? (string) $input['description'] : 'Published via dbe/publish';
	$mutation    = sprintf(
		'mutation { createRelease(input: { version: "%s" tags: [] description: "%s" serialized_entities_data: "%s" publish: true }) { release { id version status } } }',
		addcslashes( $version, '\\"' ),
		addcslashes( $description, '\\"' ),
		addcslashes( wp_json_encode( $ids ), '\\"' )
	);
	$data = dbe_ability_graphql( 'dbePublish', $mutation );
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

/* ---------------------------------------------------------------------- *
 *  Global CSS execute callbacks
 * ---------------------------------------------------------------------- */

/**
 * dbe/get-global-css.
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
 * dbe/patch-global-css.
 */
function dbe_ability_patch_global_css( $input ) {
	$block = trim( (string) ( $input['block'] ?? '' ) );
	if ( ! preg_match( '/^[A-Za-z0-9_-]+$/', $block ) ) {
		return new WP_Error( 'dbe_bad_block_name', 'Block names are letters, digits, hyphens and underscores.' );
	}
	$delete = ! empty( $input['delete'] );
	if ( ! $delete && ( ! isset( $input['css'] ) || '' === trim( (string) $input['css'] ) ) ) {
		return new WP_Error( 'dbe_no_css', 'Pass the block\'s css, or delete: true to remove it.' );
	}

	$loaded = dbe_ability_load_settings_set( $input['settings_set'] ?? '' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}

	$patched = dbe_ability_css_patch( $loaded['css'], $block, (string) ( $input['css'] ?? '' ), $delete );
	if ( is_wp_error( $patched ) ) {
		return $patched;
	}

	if ( ! empty( $input['dry_run'] ) ) {
		return array(
			'dry_run'    => true,
			'action'     => $patched['action'],
			'block'      => $block,
			'css_length' => strlen( $patched['css'] ),
		);
	}

	$commit_name = dbe_ability_save_global_css(
		$loaded,
		$patched['css'],
		sprintf( '%s CSS block "%s" via dbe/patch-global-css', ucfirst( $patched['action'] ), $block )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	return array(
		'dry_run'     => false,
		'action'      => $patched['action'],
		'block'       => $block,
		'commit_name' => $commit_name,
		'css_length'  => strlen( $patched['css'] ),
	);
}

/**
 * dbe/list-commits.
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
 * dbe/restore-global-css-from-commit.
 */
function dbe_ability_restore_global_css( $input ) {
	$loaded = dbe_ability_load_settings_set( $input['settings_set'] ?? '' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
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
			'restored_from' => $name,
			'css_length'    => strlen( $css ),
			'preview'       => implode( "\n", array_slice( explode( "\n", $css ), 0, 12 ) ),
		);
	}

	$commit_name = dbe_ability_save_global_css(
		$loaded,
		$css,
		sprintf( 'Restore global CSS from commit %s via dbe/restore-global-css-from-commit', $name )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	return array(
		'dry_run'       => false,
		'commit_name'   => $commit_name,
		'restored_from' => $name,
		'css_length'    => strlen( $css ),
	);
}
