<?php
/**
 * Novamira skill source.
 *
 * Ships the plugin's agent-facing skills — playbooks for working on
 * Builderius sites through MCP tooling — as a skill source for Novamira's
 * lookup registry (the `novamira_skill_lookup_sources` filter). Each
 * `skills/*.md` file is one skill: YAML frontmatter (`name`, `description`)
 * plus a markdown body, parsed by Novamira's own parser so behaviour matches
 * its built-in and user skills exactly. Agents reach them through Novamira's
 * catalog and the `novamira/skill-get` ability.
 *
 * The filter only ever runs when Novamira applies it, so registering it
 * unconditionally is free on sites without Novamira; the loader (and the
 * file reads) never run there. Priority 20 slots after Novamira's built-ins
 * (10) and before user CPT skills (50) — note the lookup returns the FIRST
 * source holding a slug, so a user skill with the same slug is shadowed by
 * ours; pick distinct names when authoring site-local skills.
 *
 * @package Daveden_Builder_Enhancements
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_filter( 'novamira_skill_lookup_sources', 'dbe_register_skill_source' );

/**
 * Register the plugin's skill source with Novamira's lookup registry.
 *
 * @param array $sources Registered sources keyed by id.
 * @return array
 */
function dbe_register_skill_source( $sources ) {
	// The skills are playbooks for the dbe/* abilities; with the abilities
	// master switch off they would only advertise tools that do not exist,
	// so the whole source stays unregistered.
	if ( ! dbe_abilities_enabled() ) {
		return $sources;
	}
	$sources['dbe'] = array(
		'id'       => 'dbe',
		'priority' => 20,
		'label'    => 'DBE',
		'loader'   => 'dbe_skill_source_load',
	);
	return $sources;
}

/**
 * Load every bundled skills/*.md file, in Novamira's record shape.
 *
 * Memoised per request — the registry calls its loaders from several spots
 * (catalog inject, prompt registration, admin list).
 *
 * @return array[] { slug, name, description, content, enable_prompt, enable_agentic }.
 */
function dbe_skill_source_load() {
	static $cached = null;
	if ( is_array( $cached ) ) {
		return $cached;
	}
	$cached = array();

	// The loader is only ever invoked by Novamira, so its parser is loaded;
	// the guard covers a hypothetical caller invoking this directly.
	if ( ! function_exists( 'Novamira\Skills\Parser\parse' ) ) {
		return $cached;
	}

	$files = glob( DBE_DIR . 'skills/*.md' );
	if ( ! is_array( $files ) ) {
		return $cached;
	}
	sort( $files );
	foreach ( $files as $path ) {
		$slug = sanitize_title( basename( $path, '.md' ) );
		if ( '' === $slug ) {
			continue;
		}
		$raw = file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- bundled plugin file, not a remote URL.
		if ( false === $raw ) {
			continue;
		}
		$parsed = Novamira\Skills\Parser\parse( $raw );
		if ( null !== $parsed['parse_error'] || '' === trim( $parsed['body'] ) ) {
			continue;
		}
		$cached[] = array(
			'slug'           => $slug,
			'name'           => '' !== $parsed['name'] ? $parsed['name'] : $slug,
			'description'    => $parsed['description'],
			'content'        => $parsed['body'],
			'enable_prompt'  => $parsed['enable_prompt'],
			'enable_agentic' => $parsed['enable_agentic'],
		);
	}

	return $cached;
}
