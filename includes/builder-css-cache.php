<?php
/**
 * Content-addressed cache for the enabled Builderius chrome CSS.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

/**
 * Build the cache signature without rereading every stylesheet body.
 *
 * File name, modification time and byte size make source edits invalidate the
 * bundle during development; DBE_VERSION makes plugin updates invalidate it
 * even when packaged files retain their timestamps.
 *
 * @param string[] $files Ordered CSS file names relative to assets/builder/css/.
 * @return string Lowercase SHA-256 hash.
 */
function dbe_builder_css_cache_signature( $files ) {
	$parts = array( DBE_VERSION );

	foreach ( $files as $file ) {
		$path    = DBE_DIR . 'assets/builder/css/' . $file;
		$mtime   = is_file( $path ) ? filemtime( $path ) : false;
		$size    = is_file( $path ) ? filesize( $path ) : false;
		$parts[] = implode(
			':',
			array(
				$file,
				false === $mtime ? 'missing' : (string) $mtime,
				false === $size ? 'missing' : (string) $size,
			)
		);
	}

	return hash( 'sha256', implode( "\n", $parts ) );
}

/**
 * Return the site-specific uploads location used only for generated DBE CSS.
 *
 * @param bool $refresh Whether to refresh WordPress's uploads-directory cache.
 * @return array{directory:string,url:string}|false Cache context or false when uploads are unavailable.
 */
function dbe_builder_css_cache_context( $refresh = false ) {
	$uploads = wp_upload_dir( null, false, $refresh );
	if ( ! empty( $uploads['error'] ) || empty( $uploads['basedir'] ) || empty( $uploads['baseurl'] ) ) {
		return false;
	}

	return array(
		'directory' => trailingslashit( $uploads['basedir'] ) . 'dbe-builder-css',
		'url'       => trailingslashit( set_url_scheme( $uploads['baseurl'] ) ) . 'dbe-builder-css',
	);
}

/**
 * Retain the current bundle and the seven most recently used alternatives.
 *
 * Pruning runs only after a cache miss creates a bundle, never on normal
 * builder requests. Every deletion is restricted to the plugin-owned cache
 * directory and a strict content-addressed file name.
 *
 * @param string $directory Cache directory.
 * @param string $current   Current bundle path, which must never be removed.
 */
function dbe_prune_builder_css_cache( $directory, $current ) {
	$matches = glob( trailingslashit( $directory ) . 'builder-*.css' );
	if ( ! is_array( $matches ) || count( $matches ) <= 8 ) {
		return;
	}

	$files = array_values(
		array_filter(
			$matches,
			static function ( $path ) {
				return 1 === preg_match( '/^builder-[a-f0-9]{64}\.css$/', basename( $path ) );
			}
		)
	);

	usort(
		$files,
		static function ( $left, $right ) {
			return (int) filemtime( $right ) <=> (int) filemtime( $left );
		}
	);

	$kept = array( $current => true );
	foreach ( $files as $path ) {
		if ( isset( $kept[ $path ] ) ) {
			continue;
		}
		if ( count( $kept ) < 8 ) {
			$kept[ $path ] = true;
			continue;
		}
		wp_delete_file( $path );
	}
}

/**
 * Resolve or create the external CSS bundle for the current toggle set.
 *
 * @return array{path:string,url:string,hash:string,bytes:int}|false Bundle details, or false to use the inline fallback.
 */
function dbe_builder_css_bundle() {
	$files   = dbe_builder_css_files();
	$context = dbe_builder_css_cache_context();
	if ( empty( $files ) || false === $context ) {
		return false;
	}

	$hash      = dbe_builder_css_cache_signature( $files );
	$filename  = 'builder-' . $hash . '.css';
	$directory = $context['directory'];
	$path      = trailingslashit( $directory ) . $filename;
	$url       = trailingslashit( $context['url'] ) . $filename;

	if ( is_readable( $path ) && filesize( $path ) > 0 ) {
		return array(
			'path'  => $path,
			'url'   => $url,
			'hash'  => $hash,
			'bytes' => (int) filesize( $path ),
		);
	}

	if ( ! is_dir( $directory ) && ! wp_mkdir_p( $directory ) ) {
		return false;
	}

	$css = dbe_builder_css( $files );
	if ( '' === trim( $css ) ) {
		return false;
	}

	$temporary = wp_tempnam( $filename, $directory );
	if ( ! $temporary ) {
		return false;
	}

	// Trusted bundled CSS is written to a plugin-owned uploads cache.
	$written = file_put_contents( $temporary, $css, LOCK_EX ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
	if ( false === $written || strlen( $css ) !== $written ) {
		wp_delete_file( $temporary );
		return false;
	}

	$permissions = defined( 'FS_CHMOD_FILE' ) ? FS_CHMOD_FILE : 0644;
	// Suppress only the race-safe filesystem operations; failure falls back inline.
	@chmod( $temporary, $permissions ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged,WordPress.WP.AlternativeFunctions.file_system_operations_chmod
	if ( ! @rename( $temporary, $path ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged,WordPress.WP.AlternativeFunctions.rename_rename
		if ( ! is_readable( $path ) || filesize( $path ) < 1 ) {
			wp_delete_file( $temporary );
			return false;
		}
		wp_delete_file( $temporary );
	}

	dbe_prune_builder_css_cache( $directory, $path );

	return array(
		'path'  => $path,
		'url'   => $url,
		'hash'  => $hash,
		'bytes' => $written,
	);
}
