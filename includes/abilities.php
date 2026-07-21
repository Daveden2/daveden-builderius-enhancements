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

	dbe_register_ability(
		'dbe/get-subtree-html',
		array(
			'label'               => __( 'Get subtree as HTML', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Serialises a Builderius template module subtree (from its saved state, the branch\'s active commit) to readable HTML. Every element carries a data-dbe-id marker; keep the marker when editing and that element\'s label, conditions and other settings survive an apply. Modules HTML cannot express (Components, SvgCode, code blocks) appear as <dbe-keep data-dbe-id="…"> placeholders — leave them in place (or move them) to preserve those elements. Omit module_id to serialise the whole template.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'    => $template_arg,
					'entity_type' => $entity_type_arg,
					'module_id'   => array(
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
					'entity_type'  => array( 'type' => 'string' ),
					'entity_id'    => array( 'type' => 'integer' ),
					'entity_slug'  => array( 'type' => 'string' ),
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

	dbe_register_ability(
		'dbe/apply-subtree-html',
		array(
			'label'               => __( 'Apply edited subtree HTML', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Sanitises edited HTML and reconciles it back onto a template module subtree, then saves by creating a new commit through Builderius\' own mutation. Elements whose data-dbe-id matches the original subtree keep their module (labels, conditions and non-HTML settings survive; tag/id/class/attributes/leading text update); unmarked elements are created; original modules whose marker is gone are removed. <dbe-keep data-dbe-id="…"> preserves a non-editable module and its subtree; <dbe-component name="slug" prop="value"> inserts a component instance. The HTML must have exactly one root element: the subtree root (its identity is forced to module_id). Script tags, event handlers, dangerous URLs, unknown elements and inline <svg> are stripped and reported. data-dbe-label="…" names an element in the Navigator. Pass dry_run to preview the result (with the ids new elements would get) without saving. An open builder session will not see a saved change until reloaded.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'        => $template_arg,
					'entity_type'     => $entity_type_arg,
					'module_id'       => array(
						'type'        => 'string',
						'description' => __( 'The subtree root module ID being replaced.', 'daveden-builderius-enhancements' ),
					),
					'html'            => array(
						'type'        => 'string',
						'description' => __( 'The edited markup, one root element.', 'daveden-builderius-enhancements' ),
					),
					'dry_run'         => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Preview only: return the resulting markup (including the ids new elements would receive) and the kept/added/removed counts WITHOUT saving. Use this to check an edit before committing.', 'daveden-builderius-enhancements' ),
					),
					'autopublish'     => array(
						'type'        => 'boolean',
						'default'     => false,
						'description' => __( 'Also autopublish the commit (the builder Save button does not). Leave false on a site that has never published a release — Builderius\' publish cascade expects deliverable assets that only exist after a first real publish.', 'daveden-builderius-enhancements' ),
					),
					'expected_commit' => $expected_commit_arg,
					'force'           => $force_arg,
				),
				'required'             => array( 'template', 'module_id', 'html' ),
				'additionalProperties' => false,
			),
			'output_schema'       => array(
				'type'       => 'object',
				'properties' => array(
					'commit_name'      => array(
						'type'        => 'string',
						'description' => __( 'The new commit name (absent on a dry run).', 'daveden-builderius-enhancements' ),
					),
					'base_commit'      => array(
						'type'        => 'string',
						'description' => __( 'The active commit used for this result. Pass it as expected_commit when saving.', 'daveden-builderius-enhancements' ),
					),
					'dry_run'          => array( 'type' => 'boolean' ),
					'html'             => array(
						'type'        => 'string',
						'description' => __( 'The resulting subtree markup (dry run only).', 'daveden-builderius-enhancements' ),
					),
					'entity_type'      => array( 'type' => 'string' ),
					'entity_id'        => array( 'type' => 'integer' ),
					'entity_slug'      => array( 'type' => 'string' ),
					'kept'             => array( 'type' => 'integer' ),
					'added'            => array( 'type' => 'integer' ),
					'removed'          => array( 'type' => 'integer' ),
					'stripped'         => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
					'unknown_markers'  => array(
						'type'        => 'array',
						'description' => __( 'data-dbe-id markers that matched nothing in the subtree — probably typos. Each was treated as a new element, so the element it was meant to keep is removed and recreated with a fresh id. Check these before relying on the edit.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'string' ),
					),
					'binding_warnings' => array(
						'type'        => 'array',
						'description' => __( 'Data-binding problems that would render a silent empty loop: a Collection source that does not resolve to an array, {{ }} instead of a square-bracket global binding in data-b-context, a non-global variable, a [[ ]] data-source, or a missing <template> child. Fix these before trusting the result.', 'daveden-builderius-enhancements' ),
						'items'       => array( 'type' => 'string' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_apply_subtree_html',
			'permission_callback' => 'dbe_ability_permission',
			'meta'                => array( 'mcp' => array( 'public' => true ) ),
		)
	);

	dbe_register_ability(
		'dbe/get-tree-outline',
		array(
			'label'               => __( 'Get template tree outline', 'daveden-builderius-enhancements' ),
			'description'         => __( 'Returns a compact outline of a template\'s module tree — one line per element with its id, tag and classes, Navigator label, module type and depth — so you can find the id of the element you want to edit by its label or tag instead of reading the whole HTML. Also returns the same data as a structured nodes array. Omit module_id for the whole template, or pass one to outline a single subtree.', 'daveden-builderius-enhancements' ),
			'category'            => 'builderius-content',
			'input_schema'        => array(
				'type'                 => 'object',
				'properties'           => array(
					'template'    => $template_arg,
					'entity_type' => $entity_type_arg,
					'module_id'   => array(
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
					'entity_type' => array( 'type' => 'string' ),
					'entity_id'   => array( 'type' => 'integer' ),
					'entity_slug' => array( 'type' => 'string' ),
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
 *  Shared vocabulary — keep in sync with builder.js
 * ----------------------------------------------------------------------
 */

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
 *
 * @param mixed $value Candidate URL value.
 * @return bool Whether the URL can execute or carry script.
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
 * Whether a Collection source string looks like Builderius' client-side JSON
 * URL source. Mirrors the front-end collection URL check closely enough for
 * warnings; it deliberately accepts http(s) hostnames/IPs only.
 *
 * @param mixed $value Candidate source URL.
 * @return bool Whether it looks like a fetchable Collection source URL.
 */
function dbe_ability_collection_source_url( $value ) {
	$v = trim( (string) $value );
	if ( '' === $v || dbe_ability_dangerous_url( $v ) ) {
		return false;
	}

	return 1 === preg_match( '/^(?:https?:\/\/)?(?:((?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,})|(?:(?:\d{1,3}\.){3}\d{1,3}))(?::\d+)?(?:\/[-a-z\d%_.~+]*)*(?:\?[;&a-z\d%_.~+=-]*)?(?:\#[-a-z\d_]*)?$/i', $v );
}

/**
 * Mirror of dbeAttrBlocked() in builder.js. Returns a short reason string
 * when the attribute must not be stored, null when it is fine.
 *
 * @param mixed $name  Attribute name.
 * @param mixed $value Attribute value.
 * @return string|null Rejection reason, or null when permitted.
 */
function dbe_ability_attr_blocked( $name, $value ) {
	$n         = strtolower( (string) $name );
	$url_attrs = array(
		'href'       => 1,
		'src'        => 1,
		'action'     => 1,
		'formaction' => 1,
		'poster'     => 1,
		'xlink:href' => 1,
	);
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
 * Encode plain text for Builderius' raw-rendered content setting.
 *
 * DOMDocument has already decoded character references by the time textContent
 * is read. Encoding here keeps encoded markup as visible text instead of
 * turning it into active markup when Builderius renders the setting raw.
 *
 * @param mixed $text Plain text from a parsed DOM text node.
 * @return string Text safe to store in a raw HTML setting.
 */
function dbe_ability_escape_raw_text( $text ) {
	return htmlspecialchars( (string) $text, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8' );
}

/**
 * Random module id in Builderius' shape ('u' + 9 hex), like dbeMakeId().
 *
 * @param array $existing Existing modules keyed by ID.
 * @return string A module ID not present in $existing.
 */
function dbe_ability_make_id( $existing = array() ) {
	do {
		$id = 'u';
		for ( $i = 0; $i < 9; $i++ ) {
			$id .= dechex( wp_rand( 0, 15 ) );
		}
	} while ( isset( $existing[ $id ] ) );
	return $id;
}

/**
 * Read a named setting value off a config module.
 *
 * @param array  $module Builderius module config.
 * @param string $name   Setting name.
 * @return mixed Setting value, or null when absent.
 */
function dbe_ability_setting( $module, $name ) {
	foreach ( (array) ( $module['settings'] ?? array() ) as $s ) {
		if ( isset( $s['name'] ) && $s['name'] === $name ) {
			return $s['value'] ?? null;
		}
	}
	return null;
}

/*
 * ----------------------------------------------------------------------
 *  Serialiser (config → HTML) — port of dbeSerializeSubtree()
 * ----------------------------------------------------------------------
 */

/**
 * Escape a value for a generated HTML attribute.
 *
 * @param mixed $v Attribute value.
 * @return string Escaped value.
 */
function dbe_ability_escape_attr( $v ) {
	return str_replace( array( '&', '"' ), array( '&amp;', '&quot;' ), (string) $v );
}

/**
 * The data-dbe-label attribute for a module whose Navigator label is CUSTOM
 * (differs from what the parser would assign a fresh element), '' otherwise.
 * Emitting it makes custom names visible in serialised HTML and lets a
 * round-trip rename them inline; omitting defaults keeps the markup quiet.
 *
 * @param array  $module        Builderius module config.
 * @param string $default_label The label the parser would derive.
 * @return string '' or ' data-dbe-label="…"'.
 */
function dbe_ability_serialize_label( $module, $default_label ) {
	$label = trim( (string) ( $module['label'] ?? '' ) );
	if ( '' === $label || $label === $default_label ) {
		return '';
	}
	return ' data-dbe-label="' . dbe_ability_escape_attr( $label ) . '"';
}

/**
 * Serialise one module subtree. Non-expressible modules become <dbe-keep>
 * placeholders and are recorded in $non_editable.
 *
 * @param array  $config       Builderius content config.
 * @param string $id           Root module ID.
 * @param int    $depth        Current nesting depth.
 * @param array  $non_editable Collected non-editable module details.
 * @return string Serialised subtree HTML.
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
		foreach ( (array) dbe_ability_setting( $m, 'componentProperties' ) as $p ) {
			if ( empty( $p['name'] ) ) {
				continue;
			}
			$open .= ' ' . $p['name'] . '="' . dbe_ability_escape_attr( $p['value'] ?? '' ) . '"';
		}
		$registry = dbe_ability_component_registry();
		$open    .= dbe_ability_serialize_label( $m, (string) ( $registry[ $slug ]['label'] ?? 'Component' ) );
		$open    .= ' data-dbe-id="' . $id . '"></dbe-component>';
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

	$module_tag = dbe_ability_setting( $m, 'tag' );
	$tag        = 'Template' === $m['name']
		? 'template'
		: strtolower( (string) ( $module_tag ? $module_tag : 'div' ) );
	$open       = '<' . $tag;

	$tag_id = dbe_ability_setting( $m, 'tagId' );
	if ( $tag_id ) {
		$open .= ' id="' . dbe_ability_escape_attr( $tag_id ) . '"';
	}
	$classes = dbe_ability_setting( $m, 'tagClass' );
	if ( is_array( $classes ) && $classes ) {
		$open .= ' class="' . dbe_ability_escape_attr( implode( ' ', $classes ) ) . '"';
	}
	$binding_attr = false;
	foreach ( (array) dbe_ability_setting( $m, 'htmlAttribute' ) as $a ) {
		if ( empty( $a['name'] ) || 'data-dbe-id' === $a['name'] ) {
			continue;
		}
		if ( in_array( strtolower( $a['name'] ), array( 'data-b-context', 'data-source' ), true ) ) {
			$binding_attr = true;
		}
		$open .= ( ! isset( $a['value'] ) || '' === $a['value'] )
			? ' ' . $a['name'] . '=""'
			: ' ' . $a['name'] . '="' . dbe_ability_escape_attr( $a['value'] ) . '"';
	}
	// A Collection/SubCollection whose binding is not stored as a data-b-context/
	// data-source attribute would re-parse as a plain HtmlElement and fail the
	// marker type check, so declare the type explicitly.
	if ( ! $binding_attr && in_array( $m['name'], array( 'Collection', 'SubCollection' ), true ) ) {
		$open .= ' data-dbe-module="' . strtolower( $m['name'] ) . '"';
	}
	$open .= dbe_ability_serialize_label( $m, 'HtmlElement' === $m['name'] ? ucfirst( $tag ) : (string) $m['name'] );
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

/*
 * ----------------------------------------------------------------------
 *  Outline (config → scannable id/label/tag map)
 * ----------------------------------------------------------------------
 */

/**
 * Walk a subtree, appending one row to $nodes and one line to $lines per
 * module. The row carries everything an agent needs to target an element by
 * label or tag: id, module type, tag, classes, label, component slug, depth.
 * The line is the same, indented, for cheap human scanning.
 *
 * @param array  $config Builderius content config.
 * @param string $id     Root module ID.
 * @param int    $depth  Current nesting depth.
 * @param array  $nodes  Collected structured outline rows.
 * @param array  $lines  Collected human-readable outline lines.
 * @return void
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
		$module_tag = dbe_ability_setting( $m, 'tag' );
		$tag        = 'Template' === $type
			? 'template'
			: strtolower( (string) ( $module_tag ? $module_tag : 'div' ) );
		$c          = dbe_ability_setting( $m, 'tagClass' );
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

/*
 * ----------------------------------------------------------------------
 *  Parser + sanitiser (HTML → node trees) — port of dbeParseHtmlFragment()
 * ----------------------------------------------------------------------
 */

/**
 * Maximum submitted HTML bytes, parsed elements and nesting depth.
 *
 * These bounds keep an authorised but malformed request from exhausting the
 * PHP worker or triggering libxml's silent depth truncation.
 */
function dbe_ability_html_limits() {
	return array(
		'bytes' => 262144,
		'nodes' => 5000,
		'depth' => 100,
	);
}

/**
 * Parse and sanitise markup into plain node trees. Returns
 * { roots: array, stripped: string[], unknown_markers: string[],
 * invalid_markers: string[] }. $orig_ids maps each claimable ID to its saved
 * module type. Unknown markers are treated as new elements; known markers on
 * an incompatible representation are rejected by the caller.
 *
 * @param string               $html     Submitted HTML fragment.
 * @param array<string,string> $orig_ids Original module types keyed by ID.
 * @return array|WP_Error Parsed result or a bounded-parser error.
 */
function dbe_ability_parse_fragment( $html, $orig_ids ) {
	$limits = dbe_ability_html_limits();
	if ( strlen( $html ) > $limits['bytes'] ) {
		return new WP_Error(
			'dbe_html_too_large',
			sprintf( 'The HTML is too large (%d bytes; maximum %d).', strlen( $html ), $limits['bytes'] )
		);
	}

	$doc             = new DOMDocument();
	$previous_errors = libxml_use_internal_errors( true );
	libxml_clear_errors();
	try {
		$loaded       = $doc->loadHTML(
			'<?xml encoding="UTF-8"><!DOCTYPE html><html><body>' . $html . '</body></html>',
			LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING
		);
		$parse_errors = libxml_get_errors();
	} finally {
		libxml_clear_errors();
		libxml_use_internal_errors( $previous_errors );
	}
	if ( ! $loaded ) {
		return new WP_Error( 'dbe_html_parse_failed', 'Could not parse the HTML.' );
	}
	foreach ( $parse_errors as $parse_error ) {
		if ( false !== stripos( $parse_error->message, 'excessive depth' ) ) {
			return new WP_Error(
				'dbe_html_too_deep',
				sprintf( 'The HTML nesting exceeds the maximum depth of %d.', $limits['depth'] )
			);
		}
	}
	$node_count = max( 0, $doc->getElementsByTagName( '*' )->length - 2 );
	if ( $node_count > $limits['nodes'] ) {
		return new WP_Error(
			'dbe_html_too_many_nodes',
			sprintf( 'The HTML contains too many elements (%d; maximum %d).', $node_count, $limits['nodes'] )
		);
	}
	$body = $doc->getElementsByTagName( 'body' )->item( 0 );

	$stripped    = array();
	$claimed     = array();
	$unknown     = array();
	$invalid     = array();
	$too_deep    = false;
	$strip_tags  = array_fill_keys(
		array( 'script', 'style', 'link', 'meta', 'iframe', 'object', 'embed', 'noscript', 'base', 'math' ),
		true
	);
	$known       = dbe_ability_known_tags();
	$registry    = dbe_ability_component_registry();
	$expressible = dbe_ability_expressible();

	$claim = function ( $marker, $module, $representation ) use ( &$claimed, &$unknown, &$invalid, $orig_ids, $expressible ) {
		$marker = trim( (string) $marker );
		if ( '' === $marker ) {
			return false;
		}
		if ( ! isset( $orig_ids[ $marker ] ) || isset( $claimed[ $marker ] ) ) {
			$unknown[ $marker ] = true;
			return false;
		}
		$expected = (string) $orig_ids[ $marker ];
		$valid    = 'keep' === $representation
			? empty( $expressible[ $expected ] )
			: $expected === $module;
		if ( ! $valid ) {
			$invalid[] = sprintf( '%s is %s but was submitted as %s', $marker, $expected, $module );
			return false;
		}
		$claimed[ $marker ] = true;
		return true;
	};

	$convert = function ( $el, $depth = 1 ) use ( &$convert, &$stripped, &$invalid, &$claimed, &$too_deep, $strip_tags, $known, $registry, $orig_ids, $claim, $limits ) {
		if ( $depth > $limits['depth'] ) {
			$too_deep = true;
			return null;
		}
		$tag = strtolower( $el->tagName );

		// A keep-placeholder preserves a non-editable module and its whole
		// subtree; its own children (the human-hint comment) are ignored.
		if ( 'dbe-keep' === $tag ) {
			$marker = $el->getAttribute( 'data-dbe-id' );
			if ( $claim( $marker, 'non-expressible module', 'keep' ) ) {
				return array( 'keep' => $marker );
			}
			$stripped[] = '<dbe-keep> (invalid, unknown or duplicate marker)';
			return null;
		}

		// A component instance: <dbe-component name="slug" prop="value" …>.
		// `name` selects the component; every other attribute (bar the dbe
		// markers) is a property override validated against what the
		// component declares. It is a leaf — any children are ignored.
		if ( 'dbe-component' === $tag ) {
			$slug = trim( (string) $el->getAttribute( 'name' ) );
			if ( '' === $slug || ! isset( $registry[ $slug ] ) ) {
				$marker = trim( (string) $el->getAttribute( 'data-dbe-id' ) );
				if ( '' !== $marker && isset( $orig_ids[ $marker ] ) && ! isset( $claimed[ $marker ] ) ) {
					$invalid[] = sprintf( '%s uses unknown component %s', $marker, '' !== $slug ? $slug : '(blank)' );
				}
				$known_slugs = implode( ', ', array_keys( $registry ) );
				$stripped[]  = '<dbe-component name="' . $slug . '"> (unknown component; available: ' . ( '' !== $known_slugs ? $known_slugs : 'none' ) . ')';
				return null;
			}
			$node     = array(
				'existingId'    => null,
				'module'        => 'Component',
				'componentName' => $slug,
				'props'         => array(),
				'label'         => '',
				'children'      => array(),
			);
			$declared = $registry[ $slug ]['props'];
			$marker   = '';
			foreach ( iterator_to_array( $el->attributes ) as $a ) {
				$n = strtolower( $a->name );
				if ( 'name' === $n ) {
					continue;
				}
				if ( 'data-dbe-id' === $n ) {
					$marker = (string) $a->value;
					continue;
				}
				if ( 'data-dbe-label' === $n ) {
					$node['label'] = trim( preg_replace( '/\s+/', ' ', (string) $a->value ) );
					continue;
				}
				// A prop the component does not declare cannot resolve, so it
				// is dropped with a note rather than stored as dead data.
				if ( ! isset( $declared[ $n ] ) ) {
					$stripped[] = $n . ' (not a property of ' . $slug . ')';
					continue;
				}
				$node['props'][] = array(
					'name'  => $declared[ $n ]['name'],
					'value' => $a->value,
				);
			}
			if ( $claim( $marker, 'Component', 'component' ) ) {
				$node['existingId'] = $marker;
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

		$node   = array(
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
		$marker = '';

		foreach ( iterator_to_array( $el->attributes ) as $a ) {
			$n = strtolower( $a->name );
			$v = $a->value;
			if ( 'data-dbe-id' === $n ) {
				$marker = (string) $v;
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
			// A data binding or URL source implies a Collection; the attribute stays stored.
			if ( in_array( $n, array( 'data-b-context', 'data-source-url' ), true ) && 'HtmlElement' === $node['module'] ) {
				$node['module'] = 'Collection';
			}
			// A loop-item-relative source implies a nested SubCollection.
			if ( 'data-source' === $n && 'HtmlElement' === $node['module'] ) {
				$node['module'] = 'SubCollection';
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
		if ( $claim( $marker, $node['module'], 'element' ) ) {
			$node['existingId'] = $marker;
		}

		$seen_element = false;
		foreach ( iterator_to_array( $el->childNodes ) as $ch ) {
			if ( XML_TEXT_NODE === $ch->nodeType ) {
				$t = trim( preg_replace( '/\s+/', ' ', $ch->textContent ) );
				if ( '' === $t ) {
					continue;
				}
				$t = dbe_ability_escape_raw_text( $t );
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
				$c = $convert( $ch, $depth + 1 );
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
				$r = $convert( $ch, 1 );
				if ( null !== $r ) {
					$roots[] = $r;
				}
			}
		}
	}
	if ( $too_deep ) {
		return new WP_Error(
			'dbe_html_too_deep',
			sprintf( 'The HTML nesting exceeds the maximum depth of %d.', $limits['depth'] )
		);
	}

	return array(
		'roots'           => $roots,
		'stripped'        => $stripped,
		'unknown_markers' => array_keys( $unknown ),
		'invalid_markers' => $invalid,
	);
}

/**
 * Settings for a parsed node — port of dbeNodeSettings(). A Template has no
 * tag setting and neither Templates nor Collections take content.
 *
 * @param array  $node        Parsed node.
 * @param string $module_name Builderius module type.
 * @return array Builderius settings for the node.
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
	if ( 'Collection' === $module_name ) {
		foreach ( $node['attrs'] as $a ) {
			if ( 'data-b-interactive' === ( $a['name'] ?? '' ) ) {
				$s[] = array(
					'name'  => 'interactiveMode',
					'value' => true,
				);
				break;
			}
		}
	}
	if ( '' !== $node['content'] && 'HtmlElement' === $module_name ) {
		$s[] = array(
			'name'  => 'content',
			'value' => $node['content'],
		);
	}
	return $s;
}

/**
 * Validate the data bindings of a parsed subtree against the two-syntax
 * trap that renders a silent empty placeholder row instead of an error:
 * a Collection source must resolve to an array: a literal JSON array/object,
 * a URL-like JSON source, data-source-url, or a GLOBAL data variable in
 * double square brackets ([[var.path]]) or triple square brackets
 * ([[[var.path]]]) — the {{ }} form and entity-scoped variables silently
 * resolve to nothing —
 * while a nested SubCollection's data-source is loop-item-relative and
 * uses {{ }}. Also checks the repeated part is a <template> child.
 *
 * @param array $tree A parsed node (dbe_ability_parse_fragment root).
 * @return string[] Human-readable warnings; empty when the wiring is sound.
 */
function dbe_ability_binding_warnings( $tree ) {
	$warnings = array();

	// Global data variable names, for the "is it global?" check. A load
	// failure just skips that check rather than failing the apply.
	$global_vars = array();
	$gs          = dbe_ability_load_settings_set();
	if ( ! is_wp_error( $gs ) ) {
		foreach ( (array) ( $gs['config']['template']['settings'] ?? array() ) as $s ) {
			if ( 'dataVars' === ( $s['name'] ?? '' ) ) {
				foreach ( (array) $s['value'] as $v ) {
					if ( '' !== (string) ( $v['b1'] ?? '' ) ) {
						$global_vars[ (string) $v['b1'] ] = true;
					}
				}
			}
		}
	}

	$attr = function ( $node, $name ) {
		foreach ( (array) $node['attrs'] as $a ) {
			if ( $a['name'] === $name ) {
				return (string) $a['value'];
			}
		}
		return null;
	};

	$walk = function ( $node ) use ( &$walk, &$warnings, $attr, $global_vars, $gs ) {
		$module = $node['module'] ?? '';

		if ( 'Collection' === $module ) {
			$context         = $attr( $node, 'data-b-context' );
			$context_trimmed = null === $context ? '' : trim( $context );
			$source_url      = $attr( $node, 'data-source-url' );
			$source_trimmed  = null === $source_url ? '' : trim( $source_url );
			$interactive     = trim( (string) $attr( $node, 'data-b-interactive' ) );
			$content_binding = trim( (string) $attr( $node, 'data-b-bind--data-content' ) );
			$where           = sprintf( '<%s> Collection', $node['tag'] );
			if ( '' !== $source_trimmed && ! dbe_ability_collection_source_url( $source_trimmed ) ) {
				$warnings[] = $where . ' has a data-source-url that does not look like a fetchable http(s) JSON URL — the remote loop will render empty.';
			}
			if ( '' !== $source_trimmed && ( '' === $context_trimmed || '' === $interactive || '' === $content_binding ) ) {
				$warnings[] = $where . ' uses data-source-url, but Builderius needs the interactive Collection wiring to fetch it. Put the URL in data-b-context and add matching data-b-interactive plus data-b-bind--data-content.';
			}
			if ( ( null === $context || '' === $context_trimmed ) && '' === $source_trimmed ) {
				$warnings[] = $where . ' has no data-b-context binding — it will render nothing.';
			} elseif ( preg_match( '/^\{\{\s*(.+?)\s*\}\}$/s', $context_trimmed, $m ) ) {
				$warnings[] = sprintf(
					'%s uses {{ }} in data-b-context, which does NOT resolve a loop (it renders one empty placeholder row with no error). Use [[%s]] or [[[%s]]] with a SAVED GLOBAL data variable.',
					$where,
					$m[1],
					$m[1]
				);
			} elseif (
				preg_match( '/^\[\[\[\s*([A-Za-z0-9_]+)(.*?)\s*\]\]\]$/s', $context_trimmed, $m )
				|| preg_match( '/^\[\[\s*([A-Za-z0-9_]+)(.*?)\s*\]\]$/s', $context_trimmed, $m )
			) {
				if ( $global_vars && ! isset( $global_vars[ $m[1] ] ) && ! is_wp_error( $gs ) ) {
					$warnings[] = sprintf(
						'%s binds %s, but "%s" is not a SAVED GLOBAL data variable — entity-scoped or unsaved variables silently render an empty placeholder row. Save/move the variable to global scope first (globals: %s).',
						$where,
						$context_trimmed,
						$m[1],
						implode( ', ', array_keys( $global_vars ) )
					);
				}
			} else {
				$decoded = json_decode( $context_trimmed, true );
				if ( '' !== $context_trimmed && ! is_array( $decoded ) && ! dbe_ability_collection_source_url( $context_trimmed ) ) {
					$warnings[] = $where . ' has a data-b-context that is neither a source that resolves to an array ([[[global_var.path]]] / [[global_var.path]], literal JSON, or URL-like JSON source) nor paired with data-source-url — the loop will not resolve.';
				}
			}
		}

		if ( 'SubCollection' === $module ) {
			$source = $attr( $node, 'data-source' );
			$where  = sprintf( '<%s> SubCollection', $node['tag'] );
			if ( null === $source || '' === trim( $source ) ) {
				$warnings[] = $where . ' has no data-source binding — it will render nothing.';
			} elseif ( preg_match( '/^\[\[/', trim( $source ) ) ) {
				$warnings[] = $where . ' uses [[ ]] in data-source, but a SubCollection is loop-item-relative and uses the {{ }} form (e.g. data-source="{{posts_query.posts}}").';
			} elseif ( ! preg_match( '/^\{\{.+\}\}$/s', trim( $source ) ) ) {
				$warnings[] = $where . ' has a data-source that is not a {{ }} loop-item reference — the nested loop will not resolve.';
			}
		}

		if ( 'Collection' === $module || 'SubCollection' === $module ) {
			$has_template = false;
			foreach ( (array) $node['children'] as $c ) {
				if ( 'Template' === ( $c['module'] ?? '' ) ) {
					$has_template = true;
				}
			}
			if ( ! $has_template ) {
				$warnings[] = sprintf(
					'<%s> %s has no <template> child — the repeated part of a loop must be wrapped in <template>.',
					$node['tag'],
					$module
				);
			}
		}

		foreach ( (array) $node['children'] as $c ) {
			$walk( $c );
		}
	};
	$walk( $tree );

	return $warnings;
}

/*
 * ----------------------------------------------------------------------
 *  Reconciler (node tree → new config) — config-level dbeApplyHtmlTree()
 * ----------------------------------------------------------------------
 */

/**
 * Rebuild the config with $tree replacing the subtree rooted at $root_id.
 * Returns { config, kept, added, removed }.
 *
 * @param array  $config  Builderius content config.
 * @param string $root_id Existing subtree root ID.
 * @param array  $tree    Parsed replacement tree.
 * @return array Reconciled config and change counts.
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
		$m               = $mods[ $id ];
		$m['parent']     = $parent_id;
		$new_mods[ $id ] = $m;
		$kids            = (array) ( $idx[ $id ] ?? array() );
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
			++$counts['kept'];
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
			++$counts['kept'];
		} else {
			$id          = dbe_ability_make_id( $new_mods );
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
			++$counts['added'];
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
			++$removed;
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
 *  Execute callbacks
 * ----------------------------------------------------------------------
 */

/**
 * Handle dbe/get-subtree-html.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_get_subtree_html( $input ) {
	$loaded = dbe_ability_load_entity_config( $input['template'] ?? '', $input['entity_type'] ?? 'template' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}
	$config    = $loaded['config'];
	$module_id = trim( (string) ( $input['module_id'] ?? '' ) );

	$non_editable = array();
	if ( '' !== $module_id ) {
		if ( ! isset( $config['modules'][ $module_id ] ) ) {
			return new WP_Error( 'dbe_no_module', sprintf( 'No module "%s" in the %s.', $module_id, $loaded['entity_type'] ) );
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
		'entity_type'  => $loaded['entity_type'],
		'entity_id'    => $loaded['entity_post']->ID,
		'entity_slug'  => $loaded['entity_post']->post_name,
		'branch_id'    => $loaded['branch']->ID,
		'commit_name'  => $loaded['commit']->post_name,
		'module_id'    => $module_id,
		'non_editable' => $non_editable,
	);
}

/**
 * Handle dbe/get-tree-outline.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_get_tree_outline( $input ) {
	$loaded = dbe_ability_load_entity_config( $input['template'] ?? '', $input['entity_type'] ?? 'template' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}
	$config    = $loaded['config'];
	$module_id = trim( (string) ( $input['module_id'] ?? '' ) );

	$nodes = array();
	$lines = array();
	if ( '' !== $module_id ) {
		if ( ! isset( $config['modules'][ $module_id ] ) ) {
			return new WP_Error( 'dbe_no_module', sprintf( 'No module "%s" in the %s.', $module_id, $loaded['entity_type'] ) );
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
		'entity_type' => $loaded['entity_type'],
		'entity_id'   => $loaded['entity_post']->ID,
		'entity_slug' => $loaded['entity_post']->post_name,
		'branch_id'   => $loaded['branch']->ID,
		'commit_name' => $loaded['commit']->post_name,
		'module_id'   => $module_id,
	);
}

/**
 * Handle dbe/apply-subtree-html.
 *
 * @param array $input Ability input.
 * @return array|WP_Error Ability result.
 */
function dbe_ability_apply_subtree_html( $input ) {
	$loaded = dbe_ability_load_entity_config( $input['template'] ?? '', $input['entity_type'] ?? 'template' );
	if ( is_wp_error( $loaded ) ) {
		return $loaded;
	}
	$preflight = dbe_ability_preflight( $loaded, $input, $loaded['entity_post']->post_name );
	if ( is_wp_error( $preflight ) ) {
		return $preflight;
	}
	$config    = $loaded['config'];
	$module_id = trim( (string) ( $input['module_id'] ?? '' ) );
	$html      = (string) ( $input['html'] ?? '' );

	if ( ! isset( $config['modules'][ $module_id ] ) ) {
		return new WP_Error( 'dbe_no_module', sprintf( 'No module "%s" in the %s.', $module_id, $loaded['entity_type'] ) );
	}
	$expressible = dbe_ability_expressible();
	$root_type   = $config['modules'][ $module_id ]['name'];
	if ( empty( $expressible[ $root_type ] ) ) {
		return new WP_Error(
			'dbe_root_not_editable',
			sprintf( 'The subtree root is a %s, which HTML cannot express — pick an element inside or around it.', $root_type )
		);
	}

	// Markers may only claim IDs from the original subtree and must use the
	// representation that belongs to each saved module type.
	$orig_ids = array();
	$walk     = function ( $id ) use ( &$walk, &$orig_ids, $config ) {
		$orig_ids[ $id ] = (string) ( $config['modules'][ $id ]['name'] ?? '' );
		foreach ( (array) ( $config['indexes'][ $id ] ?? array() ) as $k ) {
			$walk( $k );
		}
	};
	$walk( $module_id );

	$parsed = dbe_ability_parse_fragment( $html, $orig_ids );
	if ( is_wp_error( $parsed ) ) {
		return $parsed;
	}
	if ( ! empty( $parsed['invalid_markers'] ) ) {
		return new WP_Error(
			'dbe_marker_type_mismatch',
			'Marked elements must keep their original Builderius module type: ' . implode( '; ', $parsed['invalid_markers'] ) . '.'
		);
	}
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
	if ( ( $tree['module'] ?? '' ) !== $root_type ) {
		return new WP_Error(
			'dbe_root_type_mismatch',
			sprintf( 'The subtree root is a %s and must be submitted using its %s representation.', $root_type, $root_type )
		);
	}

	$result = dbe_ability_reconcile( $config, $module_id, $tree );

	$binding_warnings = dbe_ability_binding_warnings( $tree );

	// Dry run: report what WOULD happen and the resulting markup (with the
	// ids new elements would get) without writing a commit. Lets an agent
	// check an edit before mutating, and see the created elements' ids.
	if ( ! empty( $input['dry_run'] ) ) {
		$throwaway = array();
		return array(
			'dry_run'          => true,
			'base_commit'      => $loaded['commit']->post_name,
			'entity_type'      => $loaded['entity_type'],
			'entity_id'        => $loaded['entity_post']->ID,
			'entity_slug'      => $loaded['entity_post']->post_name,
			'html'             => dbe_ability_serialize( $result['config'], $module_id, 0, $throwaway ),
			'kept'             => $result['kept'],
			'added'            => $result['added'],
			'removed'          => $result['removed'],
			'stripped'         => array_values( array_unique( $parsed['stripped'] ) ),
			'unknown_markers'  => $parsed['unknown_markers'],
			'binding_warnings' => $binding_warnings,
		);
	}

	$commit_name = dbe_ability_create_commit(
		$loaded['branch']->ID,
		$result['config'],
		! empty( $input['autopublish'] ),
		'Applied via dbe/apply-subtree-html',
		(string) ( $input['expected_commit'] ?? '' )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	$out = array(
		'commit_name'      => $commit_name,
		'base_commit'      => $loaded['commit']->post_name,
		'entity_type'      => $loaded['entity_type'],
		'entity_id'        => $loaded['entity_post']->ID,
		'entity_slug'      => $loaded['entity_post']->post_name,
		'kept'             => $result['kept'],
		'added'            => $result['added'],
		'removed'          => $result['removed'],
		'stripped'         => array_values( array_unique( $parsed['stripped'] ) ),
		'unknown_markers'  => $parsed['unknown_markers'],
		'binding_warnings' => $binding_warnings,
	);

	return $out;
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
