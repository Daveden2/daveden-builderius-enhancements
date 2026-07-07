<?php
/**
 * Settings screen: a submenu of the Builderius admin menu (top-level fallback
 * when Builderius is inactive), toggle switches grouped into
 * client-side-filtered tabs (the Admin & Site Enhancements pattern), saved
 * through the Settings API as one options array.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register the option with the Settings API.
 */
function dbe_register_settings() {
	register_setting(
		'daveden_builder_enhancements',
		DBE_OPTION,
		array(
			'type'              => 'array',
			'sanitize_callback' => 'dbe_sanitise_options',
			'default'           => array(),
		)
	);
}
add_action( 'admin_init', 'dbe_register_settings' );

/**
 * Menu entry: a submenu of the Builderius top-level menu when Builderius is
 * active, falling back to a top-level menu of our own when it is not.
 *
 * Builderius registers its parent menu (slug "builderius") on admin_menu at
 * the default priority from within init, so hooking at priority 11 makes the
 * existence check reliable. The page slug is unchanged in both modes, so the
 * URL stays admin.php?page=daveden-builderius-enhancements.
 *
 * @return string The registered page hook (also stored for the asset gate).
 */
function dbe_register_menu() {
	if ( isset( $GLOBALS['admin_page_hooks']['builderius'] ) ) {
		$hook = add_submenu_page(
			'builderius',
			__( 'Daveden Builder Enhancements', 'daveden-builderius-enhancements' ),
			__( 'Builder Enhance', 'daveden-builderius-enhancements' ),
			'manage_options',
			'daveden-builderius-enhancements',
			'dbe_render_settings_page'
		);
	} else {
		$hook = add_menu_page(
			__( 'Daveden Builder Enhancements', 'daveden-builderius-enhancements' ),
			__( 'Builder Enhance', 'daveden-builderius-enhancements' ),
			'manage_options',
			'daveden-builderius-enhancements',
			'dbe_render_settings_page',
			'dashicons-admin-customizer',
			59
		);
	}
	$GLOBALS['dbe_settings_hook'] = $hook;
	return $hook;
}
add_action( 'admin_menu', 'dbe_register_menu', 11 );

/**
 * Admin assets, only on our screen.
 *
 * @param string $hook Current admin page hook.
 */
function dbe_admin_assets( $hook ) {
	if ( empty( $GLOBALS['dbe_settings_hook'] ) || $GLOBALS['dbe_settings_hook'] !== $hook ) {
		return;
	}
	wp_enqueue_style(
		'dbe-settings',
		DBE_URL . 'assets/admin/settings.css',
		array(),
		filemtime( DBE_DIR . 'assets/admin/settings.css' )
	);
	wp_enqueue_script(
		'dbe-settings',
		DBE_URL . 'assets/admin/settings.js',
		array(),
		filemtime( DBE_DIR . 'assets/admin/settings.js' ),
		true
	);
}
add_action( 'admin_enqueue_scripts', 'dbe_admin_assets' );

/**
 * One toggle row: title + description on the left, switch on the right,
 * optional enum sub-setting underneath.
 *
 * @param string $id      Feature id.
 * @param array  $feature Registry entry.
 */
function dbe_render_toggle( $id, $feature ) {
	$options  = dbe_get_options();
	$field_id = 'dbe-f-' . $id;
	$desc_id  = $field_id . '-desc';
	?>
	<div class="dbe-field">
		<div class="dbe-field__text">
			<label class="dbe-field__title" for="<?php echo esc_attr( $field_id ); ?>"><?php echo esc_html( $feature['title'] ); ?></label>
			<p class="dbe-field__desc" id="<?php echo esc_attr( $desc_id ); ?>"><?php echo esc_html( $feature['description'] ); ?></p>
			<?php dbe_render_enum_subfields( $id ); ?>
		</div>
		<input
			type="checkbox"
			class="dbe-switch"
			id="<?php echo esc_attr( $field_id ); ?>"
			name="<?php echo esc_attr( DBE_OPTION . '[' . $id . ']' ); ?>"
			value="1"
			aria-describedby="<?php echo esc_attr( $desc_id ); ?>"
			<?php checked( ! empty( $options[ $id ] ) ); ?>
		>
	</div>
	<?php
}

/**
 * Enum selects that belong to a parent feature (default theme / density).
 *
 * @param string $parent_id Parent feature id.
 */
function dbe_render_enum_subfields( $parent_id ) {
	foreach ( dbe_enum_settings() as $id => $setting ) {
		if ( $setting['parent'] !== $parent_id ) {
			continue;
		}
		$field_id = 'dbe-e-' . $id;
		$current  = dbe_setting( $id );
		?>
		<p class="dbe-field__sub">
			<label for="<?php echo esc_attr( $field_id ); ?>"><?php echo esc_html( $setting['title'] ); ?></label>
			<select id="<?php echo esc_attr( $field_id ); ?>" name="<?php echo esc_attr( DBE_OPTION . '[' . $id . ']' ); ?>">
				<?php foreach ( $setting['choices'] as $value => $label ) : ?>
					<option value="<?php echo esc_attr( $value ); ?>" <?php selected( $current, $value ); ?>><?php echo esc_html( $label ); ?></option>
				<?php endforeach; ?>
			</select>
		</p>
		<?php
	}
}

/**
 * The Dashboard panel: what the plugin is, version, repository link and a
 * per-tab summary of enabled features. No form fields.
 */
function dbe_render_dashboard_panel() {
	$features = dbe_features();
	?>
	<div class="dbe-dashboard">
		<p>
			<?php
			printf(
				/* translators: %s: link to the author's YouTube channel. */
				esc_html__( 'Daveden Builder Enhancements is a set of quality-of-life tweaks for the Builderius builder by %s: changes the community would like to see in the builder itself, each behind its own toggle.', 'daveden-builderius-enhancements' ),
				'<a href="https://youtube.com/@daveden2" target="_blank" rel="noopener">Daveden</a>'
			);
			?>
		</p>
		<p>
			<?php esc_html_e( 'Everything here changes only the builder interface: nothing changes on the front end of the site, and switching a toggle off (or deactivating the plugin) leaves your templates exactly as they were. Each tweak is intended to be temporary; as native equivalents land in core Builderius, the corresponding toggles will be retired.', 'daveden-builderius-enhancements' ); ?>
		</p>
		<p class="dbe-dashboard__meta">
			<?php
			printf(
				/* translators: %s: plugin version number. */
				esc_html__( 'Version %s', 'daveden-builderius-enhancements' ),
				esc_html( DBE_VERSION )
			);
			?>
			&middot;
			<a href="https://github.com/Daveden2/daveden-builderius-enhancements" target="_blank" rel="noopener">
				<?php esc_html_e( 'GitHub repository', 'daveden-builderius-enhancements' ); ?>
			</a>
			&middot;
			<a href="https://youtube.com/@daveden2" target="_blank" rel="noopener">
				<?php esc_html_e( 'Daveden on YouTube', 'daveden-builderius-enhancements' ); ?>
			</a>
		</p>
		<figure class="dbe-dashboard__video">
			<iframe
				src="https://www.youtube-nocookie.com/embed/PnwovfnCQsQ"
				title="<?php esc_attr_e( 'Introduction to Daveden Builder Enhancements (YouTube video)', 'daveden-builderius-enhancements' ); ?>"
				loading="lazy"
				allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
				referrerpolicy="strict-origin-when-cross-origin"
				allowfullscreen
			></iframe>
			<figcaption><?php esc_html_e( 'Introduction to the plugin on the Daveden YouTube channel.', 'daveden-builderius-enhancements' ); ?></figcaption>
		</figure>
		<h3><?php esc_html_e( 'Enabled features', 'daveden-builderius-enhancements' ); ?></h3>
		<ul class="dbe-dashboard__summary">
			<?php foreach ( dbe_tabs() as $tab_slug => $tab_label ) : ?>
				<?php
				if ( 'dashboard' === $tab_slug ) {
					continue;
				}
				$total   = 0;
				$enabled = 0;
				foreach ( $features as $id => $feature ) {
					if ( $feature['tab'] === $tab_slug ) {
						$total++;
						if ( dbe_enabled( $id ) ) {
							$enabled++;
						}
					}
				}
				?>
				<li>
					<span class="dbe-dashboard__tab"><?php echo esc_html( $tab_label ); ?></span>
					<span class="dbe-dashboard__count">
						<?php
						printf(
							/* translators: 1: enabled feature count, 2: total feature count. */
							esc_html__( '%1$d of %2$d enabled', 'daveden-builderius-enhancements' ),
							(int) $enabled,
							(int) $total
						);
						?>
					</span>
				</li>
			<?php endforeach; ?>
		</ul>
	</div>
	<?php
}

/**
 * The settings screen. Tab buttons filter the sections client-side; without
 * JavaScript every section stays visible under its own heading.
 */
function dbe_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$tabs     = dbe_tabs();
	$features = dbe_features();
	?>
	<div class="wrap dbe-settings">
		<h1><?php esc_html_e( 'Daveden Builder Enhancements', 'daveden-builderius-enhancements' ); ?></h1>
		<p class="dbe-intro"><?php esc_html_e( 'Enhancements for the Builderius builder UI. Each feature can be switched off independently; changes apply the next time the builder loads.', 'daveden-builderius-enhancements' ); ?></p>

		<?php settings_errors(); ?>

		<div class="dbe-tabbar" hidden>
			<?php $first = true; ?>
			<?php foreach ( $tabs as $slug => $label ) : ?>
				<button type="button" class="dbe-tab<?php echo $first ? ' is-active' : ''; ?>" data-tab="<?php echo esc_attr( $slug ); ?>">
					<?php echo esc_html( $label ); ?>
				</button>
				<?php $first = false; ?>
			<?php endforeach; ?>
		</div>

		<form method="post" action="options.php">
			<?php settings_fields( 'daveden_builder_enhancements' ); ?>

			<?php foreach ( $tabs as $slug => $label ) : ?>
				<section class="dbe-panel" data-tab="<?php echo esc_attr( $slug ); ?>" aria-label="<?php echo esc_attr( $label ); ?>">
					<h2 class="dbe-panel__title"><?php echo esc_html( $label ); ?></h2>
					<?php
					if ( 'dashboard' === $slug ) {
						dbe_render_dashboard_panel();
					} else {
						foreach ( $features as $id => $feature ) {
							if ( $feature['tab'] === $slug ) {
								dbe_render_toggle( $id, $feature );
							}
						}
					}
					?>
				</section>
			<?php endforeach; ?>

			<?php submit_button( __( 'Save changes', 'daveden-builderius-enhancements' ) ); ?>
		</form>
	</div>
	<?php
}
