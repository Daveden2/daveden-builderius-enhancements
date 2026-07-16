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
			'description'         => __( 'Sanitises edited HTML and reconciles it back onto a template module subtree, then saves by creating a new autopublished commit through Builderius\' own mutation. Elements whose data-dbe-id matches the original subtree keep their module (labels, conditions and non-HTML settings survive; tag/id/class/attributes/leading text update); unmarked elements are created; original modules whose marker is gone are removed. <dbe-keep data-dbe-id="…"> preserves a non-editable module and its subtree. The HTML must have exactly one root element: the subtree root (its identity is forced to module_id). Script tags, event handlers, dangerous URLs, unknown elements and inline <svg> are stripped and reported. data-dbe-label="…" names an element in the Navigator. An open builder session will not see the change until reloaded.', 'daveden-builderius-enhancements' ),
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
					'commit_name' => array( 'type' => 'string' ),
					'kept'        => array( 'type' => 'integer' ),
					'added'       => array( 'type' => 'integer' ),
					'removed'     => array( 'type' => 'integer' ),
					'stripped'    => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
				),
			),
			'execute_callback'    => 'dbe_ability_apply_subtree_html',
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
		return new WP_Error( 'dbe_no_branch', 'The template has no branch (never opened in the builder?).' );
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
		return new WP_Error( 'dbe_no_commit', 'The template branch has no commits.' );
	}

	$config = json_decode( (string) get_post_meta( $commit->ID, 'content_config', true ), true );
	if ( ! is_array( $config ) || empty( $config['modules'] ) || ! isset( $config['indexes'] ) ) {
		return new WP_Error( 'dbe_bad_config', 'The active commit has no readable content config.' );
	}

	return array(
		'config'        => $config,
		'template_post' => $post,
		'branch'        => $branch,
		'commit'        => $commit,
	);
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
 *  Parser + sanitiser (HTML → node trees) — port of dbeParseHtmlFragment()
 * ---------------------------------------------------------------------- */

/**
 * Parse and sanitise markup into plain node trees. Returns
 * { roots: array, stripped: string[] }. $orig_ids is the id set the
 * data-dbe-id / dbe-keep markers may claim.
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
	$strip_tags = array_fill_keys(
		array( 'script', 'style', 'link', 'meta', 'iframe', 'object', 'embed', 'noscript', 'base', 'math' ),
		true
	);
	$known    = dbe_ability_known_tags();
	$registry = dbe_ability_component_registry();

	$convert = function ( $el ) use ( &$convert, &$stripped, &$claimed, $orig_ids, $strip_tags, $known, $registry ) {
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
		'roots'    => $roots,
		'stripped' => $stripped,
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
 * Create an autopublished commit holding $config on $branch_id. Runs the
 * exact mutation the builder's Save button sends, through the internal REST
 * dispatcher, so permissions, events and cache flushes all apply.
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
						'name'  => 'dbeApplySubtreeHtml',
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
		return new WP_Error( 'dbe_commit_failed', 'createCommit request failed: ' . $err->get_error_message() );
	}
	$data   = $response->get_data();
	$result = is_array( $data ) ? reset( $data ) : null;
	if ( ! empty( $result['errors'] ) ) {
		// The executor flattens GraphQL errors to plain message strings.
		return new WP_Error( 'dbe_commit_failed', 'createCommit rejected: ' . implode( ' | ', array_map( 'strval', $result['errors'] ) ) );
	}
	$name = $result['data']['createCommit']['commit']['name'] ?? '';
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
		return new WP_Error(
			'dbe_one_root',
			sprintf( 'The HTML must have exactly one root element (found %d after sanitising).', count( $parsed['roots'] ) )
		);
	}
	$tree = $parsed['roots'][0];
	if ( isset( $tree['keep'] ) ) {
		return new WP_Error( 'dbe_root_keep', 'The root element cannot be a <dbe-keep> placeholder.' );
	}

	$result = dbe_ability_reconcile( $config, $module_id, $tree );

	$commit_name = dbe_ability_create_commit(
		$loaded['branch']->ID,
		$result['config'],
		! empty( $input['autopublish'] )
	);
	if ( is_wp_error( $commit_name ) ) {
		return $commit_name;
	}

	return array(
		'commit_name' => $commit_name,
		'kept'        => $result['kept'],
		'added'       => $result['added'],
		'removed'     => $result['removed'],
		'stripped'    => $parsed['stripped'],
	);
}
