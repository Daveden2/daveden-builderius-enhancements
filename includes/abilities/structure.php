<?php
/**
 * Builderius module-structure and subtree-HTML abilities.
 *
 * Owns module vocabulary, identifiers, sanitisation, parsing, serialisation,
 * outlining and reconciliation. Component, workflow and verification domains
 * consume these structure services; entity loading, the component registry,
 * concurrency and commit creation remain shared in the parent module.
 *
 * @package Daveden_Builder_Enhancements
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// DOMDocument exposes fixed camelCase properties such as tagName and childNodes.
// phpcs:disable WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase

/**
 * Register module-structure and subtree-HTML abilities.
 *
 * @param array $template_arg        Shared entity reference schema.
 * @param array $entity_type_arg     Shared entity-type schema.
 * @param array $expected_commit_arg Shared optimistic-concurrency schema.
 * @param array $force_arg           Shared dirty-tab override schema.
 */
function dbe_register_structure_abilities( $template_arg, $entity_type_arg, $expected_commit_arg, $force_arg ) {
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

// phpcs:enable WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
