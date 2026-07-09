<?php
/**
 * Canvas overlay contrast fix — output for the INNER PREVIEW iframe.
 *
 * The hover/selection overlay in the canvas is a <builder-overlay-handles>
 * custom element whose open shadow DOM hard-codes its colours. Two problems:
 * (1) label chips fail WCAG AA (white 12px text on mid-tone accents, 2.1–2.7:1);
 * (2) the state colours are incoherent — a selected regular element jumps to an
 * off-palette indigo (#415CEB) while a selected component keeps its hover green
 * (#07CC91), making component selection invisible. The script injects a
 * corrective style per overlay shadow root (hue = kind, strength = state).
 *
 * Loads only in the inner preview document (`?builderius_inner_preview`),
 * which is a separate iframe — parent-document CSS never reaches it.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

/**
 * Print the overlay-fix script into the inner preview document.
 */
function dbe_print_preview_overlay_fix() {
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only mode detection.
	if ( ! isset( $_GET['builderius_inner_preview'] ) ) {
		return;
	}
	if ( ! is_user_logged_in() || ! current_user_can( 'edit_posts' ) || ! dbe_enabled( 'overlay_contrast' ) ) {
		return;
	}

	$path = DBE_DIR . 'assets/builder/js/preview-overlay.js';
	if ( ! is_readable( $path ) ) {
		return;
	}

	echo "\n" . '<script id="dbe-canvas-overlay-label-fix">' . "\n" . file_get_contents( $path ) . "\n" . '</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped, WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Trusted inline JS from a bundled plugin file, not a remote URL.
}
add_action( 'wp_footer', 'dbe_print_preview_overlay_fix', 999 );
