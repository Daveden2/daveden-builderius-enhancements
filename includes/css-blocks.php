<?php
/**
 * Strict parser for DBE's named CSS block markers.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

/**
 * Parse non-overlapping named CSS blocks.
 *
 * A marker-like comment must be exactly `/* @block: name *\/` or
 * `/* @endblock *\/`. Duplicate names, nesting, orphan ends and unterminated
 * starts are rejected so every caller sees the same unambiguous regions.
 *
 * @param string $css Complete stylesheet.
 * @return array|WP_Error List of block offsets.
 */
function dbe_css_blocks_parse( $css ) {
	$tokens = array();
	if ( preg_match_all( '~/\*.*?\*/~s', (string) $css, $comments, PREG_OFFSET_CAPTURE ) ) {
		foreach ( $comments[0] as $comment ) {
			$text = $comment[0];
			// Only a comment that OPENS with @block/@endblock is a marker.
			// Prose comments that merely mention the word ("see @block naming
			// convention") must not brick every CSS ability on the stylesheet.
			if ( ! preg_match( '~^/\*\s*@(block|endblock)\b~i', $text ) ) {
				continue;
			}
			if ( ! preg_match( '~^/\*\s*@(block:\s*([A-Za-z0-9_-]+)|endblock)\s*\*/$~i', $text, $marker ) ) {
				return new WP_Error( 'dbe_block_malformed', 'A named CSS block marker is malformed.' );
			}
			$tokens[] = array(
				'kind'   => 'endblock' === strtolower( $marker[1] ) ? 'end' : 'start',
				'name'   => $marker[2] ?? '',
				'start'  => (int) $comment[1],
				'length' => strlen( $text ),
			);
		}
	}

	$blocks = array();
	$names  = array();
	$open   = null;
	foreach ( $tokens as $token ) {
		if ( 'start' === $token['kind'] ) {
			if ( null !== $open ) {
				return new WP_Error( 'dbe_block_nested', sprintf( 'Block "%s" contains another block start.', $open['name'] ) );
			}
			if ( isset( $names[ $token['name'] ] ) ) {
				return new WP_Error( 'dbe_block_duplicate', sprintf( 'Block name "%s" is duplicated.', $token['name'] ) );
			}
			$names[ $token['name'] ] = true;
			$open                    = array(
				'name'       => $token['name'],
				'start'      => $token['start'],
				'body_start' => $token['start'] + $token['length'],
			);
			continue;
		}
		if ( null === $open ) {
			return new WP_Error( 'dbe_block_orphan_end', 'A CSS block has an /* @endblock */ marker without a matching start.' );
		}
		$open['body_end'] = $token['start'];
		$open['end']      = $token['start'] + $token['length'];
		$blocks[]         = $open;
		$open             = null;
	}
	if ( null !== $open ) {
		return new WP_Error( 'dbe_block_unterminated', sprintf( 'Block "%s" has no /* @endblock */ marker.', $open['name'] ) );
	}
	return $blocks;
}

/**
 * Whether a submitted block body contains reserved marker text.
 *
 * @param string $body Submitted block body.
 * @return bool
 */
function dbe_css_block_body_has_marker( $body ) {
	// Marker-shaped comment openings only; a body may legitimately mention
	// the word @block in prose (e.g. "see the @block naming convention").
	return (bool) preg_match( '~/\*\s*@(block|endblock)\b~i', (string) $body );
}
