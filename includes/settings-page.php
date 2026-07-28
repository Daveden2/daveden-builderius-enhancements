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
			__( 'Builder Enhancements', 'daveden-builderius-enhancements' ),
			'manage_options',
			'daveden-builderius-enhancements',
			'dbe_render_settings_page'
		);
	} else {
		$hook = add_menu_page(
			__( 'Daveden Builder Enhancements', 'daveden-builderius-enhancements' ),
			__( 'Builder Enhancements', 'daveden-builderius-enhancements' ),
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
	$options      = dbe_get_options();
	$field_id     = 'dbe-f-' . $id;
	$desc_id      = $field_id . '-desc';
	$note_id      = $field_id . '-pronote';
	$more_id      = $field_id . '-more';
	$requires_pro = ! empty( $feature['requires_pro'] );
	$experimental = ! empty( $feature['experimental'] );
	$pro_locked   = $requires_pro && ! dbe_builderius_pro_active();
	$summary      = isset( $feature['summary'] ) ? $feature['summary'] : '';
	// One concise line under the title; the full description sits behind the
	// info disclosure (visible without JavaScript — settings.js collapses it
	// and reveals the button, the same progressive enhancement as the tabs).
	$has_more = '' !== $summary && ! empty( $feature['description'] );
	// The locked note is part of the field's accessible description.
	$describedby = $pro_locked ? $desc_id . ' ' . $note_id : $desc_id;
	?>
	<div
		class="dbe-field<?php echo $pro_locked ? ' dbe-field--pro-locked' : ''; ?>"
		data-default="<?php echo empty( $feature['experimental'] ) ? '1' : '0'; ?>"
		data-experimental="<?php echo $experimental ? '1' : '0'; ?>"
		data-unavailable="<?php echo $pro_locked ? '1' : '0'; ?>"
	>
		<div class="dbe-field__text">
			<span class="dbe-field__titlerow">
				<label class="dbe-field__title" for="<?php echo esc_attr( $field_id ); ?>"><?php echo esc_html( $feature['title'] ); ?></label>
				<?php if ( $requires_pro ) : ?>
					<span class="dbe-badge dbe-badge--pro"><?php esc_html_e( 'Pro', 'daveden-builderius-enhancements' ); ?><span class="screen-reader-text"><?php esc_html_e( ', requires Builderius Pro', 'daveden-builderius-enhancements' ); ?></span></span>
				<?php endif; ?>
				<?php if ( $experimental ) : ?>
					<span class="dbe-badge dbe-badge--experimental"><?php esc_html_e( 'Experimental', 'daveden-builderius-enhancements' ); ?><span class="screen-reader-text"><?php esc_html_e( ', experimental feature, off by default', 'daveden-builderius-enhancements' ); ?></span></span>
				<?php endif; ?>
				<?php if ( $has_more ) : ?>
					<button type="button" class="dbe-info-btn" aria-expanded="true" aria-controls="<?php echo esc_attr( $more_id ); ?>" hidden>
						<span aria-hidden="true">i</span>
						<span class="screen-reader-text">
							<?php
							printf(
								/* translators: %s: feature title. */
								esc_html__( 'More about %s', 'daveden-builderius-enhancements' ),
								esc_html( $feature['title'] )
							);
							?>
						</span>
					</button>
				<?php endif; ?>
			</span>
			<p class="dbe-field__desc" id="<?php echo esc_attr( $desc_id ); ?>"><?php echo esc_html( '' !== $summary ? $summary : $feature['description'] ); ?></p>
			<?php if ( $has_more ) : ?>
				<div class="dbe-field__more" id="<?php echo esc_attr( $more_id ); ?>">
					<p><?php echo esc_html( $feature['description'] ); ?></p>
				</div>
			<?php endif; ?>
			<?php if ( $pro_locked ) : ?>
				<p class="dbe-field__pro-note" id="<?php echo esc_attr( $note_id ); ?>">
					<?php esc_html_e( 'Builderius Pro isn’t active, so this feature is unavailable. Your saved preference is preserved.', 'daveden-builderius-enhancements' ); ?>
				</p>
			<?php endif; ?>
			<?php dbe_render_enum_subfields( $id, $pro_locked || empty( $options[ $id ] ) ); ?>
		</div>
		<input
			type="checkbox"
			class="dbe-switch"
			id="<?php echo esc_attr( $field_id ); ?>"
			name="<?php echo esc_attr( DBE_OPTION . '[' . $id . ']' ); ?>"
			value="1"
			aria-describedby="<?php echo esc_attr( $describedby ); ?>"
			<?php checked( ! $pro_locked && ! empty( $options[ $id ] ) ); ?>
			<?php disabled( $pro_locked ); ?>
		>
	</div>
	<?php
}

/**
 * Enum selects that belong to a parent feature (default theme / density).
 *
 * @param string $parent_id Parent feature id.
 * @param bool   $disabled  Whether the parent feature is Pro-locked or simply
 *                          switched off. Either way the select is greyed and
 *                          drops out of the POST, and dbe_sanitise_options()
 *                          preserves the saved value for any absent select.
 */
function dbe_render_enum_subfields( $parent_id, $disabled = false ) {
	foreach ( dbe_enum_settings() as $id => $setting ) {
		if ( $setting['parent'] !== $parent_id ) {
			continue;
		}
		$field_id = 'dbe-e-' . $id;
		$current  = dbe_setting( $id );
		?>
		<p class="dbe-field__sub" data-parent="<?php echo esc_attr( $parent_id ); ?>">
			<label for="<?php echo esc_attr( $field_id ); ?>"><?php echo esc_html( $setting['title'] ); ?></label>
			<select id="<?php echo esc_attr( $field_id ); ?>" name="<?php echo esc_attr( DBE_OPTION . '[' . $id . ']' ); ?>" data-default="<?php echo esc_attr( $setting['default'] ); ?>" <?php disabled( $disabled ); ?>>
				<?php foreach ( $setting['choices'] as $value => $label ) : ?>
					<option value="<?php echo esc_attr( $value ); ?>" <?php selected( $current, $value ); ?>><?php echo esc_html( $label ); ?></option>
				<?php endforeach; ?>
			</select>
		</p>
		<?php
	}
}

/**
 * A "turn this whole group on or off" switch.
 *
 * Deliberately carries no `name`: it is a control over the other switches, never
 * a saved setting, so it must not reach dbe_sanitise_options(). settings.js owns
 * its state, setting `indeterminate` when the group is part on and part off, so
 * a screen reader announces the group as mixed rather than guessing.
 *
 * Pro-locked switches are excluded by settings.js (they are disabled), so a
 * group that is entirely Pro-locked gets no control at all.
 *
 * The visible label is kept short so it never wraps beside a long section title;
 * the group it governs is appended for assistive tech only, so the accessible
 * name stays specific ("All features in Appearance") while the screen shows
 * just "All features".
 *
 * @param string $scope    'tab' or 'group'.
 * @param string $key      Tab slug, or the section's title id.
 * @param string $visible  Short visible label, e.g. "All".
 * @param string $context  The group it covers, e.g. "Power tools".
 * @param int    $trial    How many features in the group are experimental.
 */
function dbe_render_bulk_switch( $scope, $key, $visible, $context, $trial = 0 ) {
	$id = 'dbe-bulk-' . $scope . '-' . $key;
	?>
	<?php // Hidden until settings.js takes ownership, so it is never a dead control. ?>
	<div class="dbe-bulk dbe-bulk--<?php echo esc_attr( $scope ); ?>" hidden>
		<label class="dbe-bulk__label" for="<?php echo esc_attr( $id ); ?>">
			<?php echo esc_html( $visible ); ?>
			<span class="screen-reader-text">
				<?php
				printf(
					/* translators: %s: settings tab or section name, e.g. "Power tools". */
					esc_html__( 'in %s', 'daveden-builderius-enhancements' ),
					esc_html( $context )
				);
				?>
			</span>
		</label>
		<input
			type="checkbox"
			class="dbe-switch dbe-switch--bulk"
			id="<?php echo esc_attr( $id ); ?>"
			data-bulk="<?php echo esc_attr( $scope ); ?>"
			<?php if ( $trial > 0 ) : ?>
				aria-describedby="<?php echo esc_attr( $id . '-note' ); ?>"
			<?php endif; ?>
		>
		<?php if ( $trial > 0 ) : ?>
			<p class="dbe-bulk__note" id="<?php echo esc_attr( $id . '-note' ); ?>">
				<?php
				printf(
					/* translators: %d: number of experimental features in the group. */
					esc_html( _n( 'Includes %d experimental feature, which is off by default.', 'Includes %d experimental features, which are off by default.', $trial, 'daveden-builderius-enhancements' ) ),
					(int) $trial
				);
				?>
			</p>
		<?php endif; ?>
	</div>
	<?php
}

/**
 * How many features in a list are flagged experimental.
 *
 * @param array $features Registry entries keyed by feature id.
 * @return int
 */
function dbe_count_experimental( $features ) {
	$count = 0;
	foreach ( $features as $feature ) {
		if ( ! empty( $feature['experimental'] ) ) {
			++$count;
		}
	}
	return $count;
}

/**
 * Render the feature toggles for one tab, grouped by the settings-page
 * sections declared in dbe_feature_sections().
 *
 * @param string $tab_slug Current tab slug.
 * @param array  $features Feature registry from dbe_features().
 */
function dbe_render_feature_tab( $tab_slug, $features ) {
	$sections = dbe_feature_sections();
	$rendered = array();

	if ( ! empty( $sections[ $tab_slug ] ) ) {
		foreach ( $sections[ $tab_slug ] as $index => $section ) {
			$section_features = array();
			foreach ( $section['features'] as $id ) {
				if ( isset( $features[ $id ] ) && $features[ $id ]['tab'] === $tab_slug ) {
					$section_features[ $id ] = $features[ $id ];
				}
			}
			if ( empty( $section_features ) ) {
				continue;
			}

			$title_id = 'dbe-section-' . $tab_slug . '-' . $index;
			?>
			<section class="dbe-feature-group" aria-labelledby="<?php echo esc_attr( $title_id ); ?>">
				<div class="dbe-feature-group__head">
					<div class="dbe-feature-group__headtext">
						<h3 class="dbe-feature-group__title" id="<?php echo esc_attr( $title_id ); ?>"><?php echo esc_html( $section['title'] ); ?></h3>
						<?php if ( '' !== $section['description'] ) : ?>
							<p class="dbe-feature-group__desc"><?php echo esc_html( $section['description'] ); ?></p>
						<?php endif; ?>
					</div>
					<?php
					dbe_render_bulk_switch(
						'group',
						$tab_slug . '-' . $index,
						__( 'All', 'daveden-builderius-enhancements' ),
						$section['title'],
						dbe_count_experimental( $section_features )
					);
					?>
				</div>
				<?php
				foreach ( $section_features as $id => $feature ) {
					$rendered[ $id ] = true;
					dbe_render_toggle( $id, $feature );
				}
				?>
			</section>
			<?php
		}
	}

	$remaining = array();
	foreach ( $features as $id => $feature ) {
		if ( $feature['tab'] === $tab_slug && empty( $rendered[ $id ] ) ) {
			$remaining[ $id ] = $feature;
		}
	}

	if ( empty( $remaining ) ) {
		return;
	}
	?>
	<section class="dbe-feature-group" aria-labelledby="<?php echo esc_attr( 'dbe-section-' . $tab_slug . '-other' ); ?>">
		<div class="dbe-feature-group__head">
			<div class="dbe-feature-group__headtext">
				<h3 class="dbe-feature-group__title" id="<?php echo esc_attr( 'dbe-section-' . $tab_slug . '-other' ); ?>"><?php esc_html_e( 'Other enhancements', 'daveden-builderius-enhancements' ); ?></h3>
			</div>
			<?php
			dbe_render_bulk_switch(
				'group',
				$tab_slug . '-other',
				__( 'All', 'daveden-builderius-enhancements' ),
				__( 'Other enhancements', 'daveden-builderius-enhancements' ),
				dbe_count_experimental( $remaining )
			);
			?>
		</div>
		<?php
		foreach ( $remaining as $id => $feature ) {
			dbe_render_toggle( $id, $feature );
		}
		?>
	</section>
	<?php
}

/**
 * One agent-ability toggle row. Reuses the .dbe-field markup so search,
 * filtering and reset-to-defaults treat abilities like any other toggle.
 *
 * @param string $ability_id Ability id, e.g. "dbe/extract-release".
 * @param array  $ability    Registry entry from dbe_abilities().
 */
function dbe_render_ability_toggle( $ability_id, $ability ) {
	$options    = dbe_get_options();
	$key        = dbe_ability_option_key( $ability_id );
	$field_id   = 'dbe-a-' . $key;
	$desc_id    = $field_id . '-desc';
	$note_id    = $field_id . '-warning';
	$danger     = ! empty( $ability['danger'] );
	$caution    = ! empty( $ability['caution'] );
	$risk_label = isset( $ability['risk_label'] ) ? (string) $ability['risk_label'] : __( 'Destructive', 'daveden-builderius-enhancements' );
	$risk_note  = isset( $ability['risk_note'] ) ? (string) $ability['risk_note'] : __( 'Off by default. Turn it on only while you need it, approve each run when the agent asks for confirmation, and switch it off again afterwards.', 'daveden-builderius-enhancements' );
	$access     = isset( $ability['group'] ) ? $ability['group'] : 'read';
	$groups     = dbe_ability_groups();
	$label      = isset( $groups[ $access ]['label'] ) ? $groups[ $access ]['label'] : __( 'Read', 'daveden-builderius-enhancements' );
	?>
	<div
		class="dbe-field dbe-field--ability dbe-field--ability-<?php echo esc_attr( $access ); ?><?php echo $danger ? ' dbe-field--danger' : ''; ?>"
		data-default="<?php echo $danger ? '0' : '1'; ?>"
		data-experimental="0"
		data-unavailable="0"
		data-ability-access="<?php echo esc_attr( $access ); ?>"
	>
		<div class="dbe-field__text">
			<span class="dbe-field__titlerow">
				<?php if ( $danger ) : ?>
					<span class="dbe-danger-icon" aria-hidden="true">&#9888;</span>
				<?php endif; ?>
				<label class="dbe-field__title" for="<?php echo esc_attr( $field_id ); ?>"><?php echo esc_html( $ability['title'] ); ?></label>
				<span class="dbe-ability-access dbe-ability-access--<?php echo esc_attr( $access ); ?>"><?php echo esc_html( $label ); ?></span>
				<code class="dbe-ability-id"><?php echo esc_html( $ability_id ); ?></code>
				<?php if ( $danger ) : ?>
					<span class="dbe-badge dbe-badge--danger"><?php echo esc_html( $risk_label ); ?><span class="screen-reader-text"><?php esc_html_e( ', high-risk ability, off by default', 'daveden-builderius-enhancements' ); ?></span></span>
				<?php elseif ( $caution ) : ?>
					<span class="dbe-badge dbe-badge--caution"><?php esc_html_e( 'Caution', 'daveden-builderius-enhancements' ); ?></span>
				<?php endif; ?>
			</span>
			<p class="dbe-field__desc" id="<?php echo esc_attr( $desc_id ); ?>"><?php echo esc_html( $ability['summary'] ); ?></p>
			<?php if ( $danger ) : ?>
				<p class="dbe-field__danger-note" id="<?php echo esc_attr( $note_id ); ?>">
					<?php echo esc_html( $risk_note ); ?>
				</p>
			<?php endif; ?>
		</div>
		<input
			type="checkbox"
			class="dbe-switch"
			id="<?php echo esc_attr( $field_id ); ?>"
			name="<?php echo esc_attr( DBE_OPTION . '[' . $key . ']' ); ?>"
			value="1"
			aria-describedby="<?php echo esc_attr( $danger ? $desc_id . ' ' . $note_id : $desc_id ); ?>"
			<?php checked( ! empty( $options[ $key ] ) ); ?>
		>
	</div>
	<?php
}

/**
 * The Agent abilities panel: the master switch, then every ability grouped
 * by Read, Write or Execute access. Individual toggles stay editable with
 * the master off
 * (choices are kept for when it is turned back on); a disabled ability is
 * never registered, so it does not exist for a connected agent at all.
 */
function dbe_render_abilities_panel() {
	$options   = dbe_get_options();
	$abilities = dbe_abilities();
	?>
	<p class="dbe-panel__intro">
		<?php esc_html_e( 'These switches control the dbe/* WordPress abilities available to connected AI agents. Read abilities inspect saved state, Write abilities change development state, and Execute abilities restore, delete, publish or rebuild it. A disabled ability is not registered, so agents cannot see or run it. Changes apply from the next request.', 'daveden-builderius-enhancements' ); ?>
	</p>
	<?php if ( ! function_exists( 'wp_register_ability' ) ) : ?>
		<p class="dbe-panel__note">
			<?php esc_html_e( 'The WordPress Abilities API is not currently available on this site, so no ability is active regardless of these switches. Your choices are saved and take effect when a plugin that provides the API (such as Novamira) is active.', 'daveden-builderius-enhancements' ); ?>
		</p>
	<?php endif; ?>
	<?php // dbe-field--master keeps this row out of the tab's "N of M on" count: it governs the abilities below rather than being one of them. ?>
	<div class="dbe-field dbe-field--master" data-default="0" data-experimental="0" data-unavailable="0">
		<div class="dbe-field__text">
			<span class="dbe-field__titlerow">
				<label class="dbe-field__title" for="dbe-a-master"><?php esc_html_e( 'Enable agent abilities', 'daveden-builderius-enhancements' ); ?></label>
			</span>
			<p class="dbe-field__desc" id="dbe-a-master-desc">
				<?php esc_html_e( 'Master switch for every ability below. Editing abilities additionally require the Builderius development capability, and abilities that accept raw markup require the unfiltered_html capability.', 'daveden-builderius-enhancements' ); ?>
			</p>
		</div>
		<input
			type="checkbox"
			class="dbe-switch"
			id="dbe-a-master"
			name="<?php echo esc_attr( DBE_OPTION . '[abilities_enabled]' ); ?>"
			value="1"
			aria-describedby="dbe-a-master-desc"
			<?php checked( ! empty( $options['abilities_enabled'] ) ); ?>
		>
	</div>
	<?php foreach ( dbe_ability_groups() as $group_slug => $group ) : ?>
		<?php $group_id = 'dbe-ability-group-' . $group_slug; ?>
		<section class="dbe-feature-group dbe-ability-group dbe-ability-group--<?php echo esc_attr( $group_slug ); ?>" aria-labelledby="<?php echo esc_attr( $group_id ); ?>">
			<h3 class="dbe-ability-group__title" id="<?php echo esc_attr( $group_id ); ?>">
				<span class="dbe-ability-access dbe-ability-access--<?php echo esc_attr( $group_slug ); ?>"><?php echo esc_html( $group['label'] ); ?></span>
			</h3>
			<p class="dbe-ability-group__desc"><?php echo esc_html( $group['description'] ); ?></p>
		<?php
		foreach ( $abilities as $ability_id => $ability ) {
			if ( $ability['group'] === $group_slug ) {
				dbe_render_ability_toggle( $ability_id, $ability );
			}
		}
		?>
		</section>
	<?php endforeach; ?>
	<?php
}

/**
 * The Dashboard panel: what the plugin is, version, repository link and a
 * per-tab summary of enabled features. No form fields.
 */
function dbe_render_dashboard_panel() {
	$features = dbe_available_features();
	/* translators: %s: number of settings enabled by a preset. */
	$preset_many = __( 'Preset ready: %s settings enabled. Review the changes, then save.', 'daveden-builderius-enhancements' );
	?>
	<div class="dbe-dashboard">
		<p><?php esc_html_e( 'Daveden Builder Enhancements adds independent appearance, accessibility, editing and workflow tools to Builderius.', 'daveden-builderius-enhancements' ); ?></p>
		<p>
			<?php if ( dbe_release_feature_available( 'agent_abilities' ) ) : ?>
				<?php esc_html_e( 'Appearance and accessibility features affect only the editing interface. Editing tools and agent features can change saved templates, components and CSS; turning them off or deactivating the plugin does not undo changes already saved.', 'daveden-builderius-enhancements' ); ?>
			<?php else : ?>
				<?php esc_html_e( 'Appearance and accessibility features affect only the editing interface. Editing tools can change saved templates, components and CSS; turning them off or deactivating the plugin does not undo changes already saved.', 'daveden-builderius-enhancements' ); ?>
			<?php endif; ?>
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
		<section class="dbe-presets" aria-labelledby="dbe-presets-title">
			<h3 id="dbe-presets-title"><?php esc_html_e( 'Quick-start presets', 'daveden-builderius-enhancements' ); ?></h3>
			<p class="dbe-presets__intro"><?php esc_html_e( 'Enable a coherent set of features in one step. Presets add to your current choices; review the changes, then save when you are ready.', 'daveden-builderius-enhancements' ); ?></p>
			<div class="dbe-presets__grid">
				<?php foreach ( dbe_feature_presets() as $preset_id => $preset ) : ?>
					<?php $description_id = 'dbe-preset-' . $preset_id . '-description'; ?>
					<article class="dbe-preset<?php echo 'power' === $preset_id ? ' dbe-preset--experimental' : ''; ?>">
						<div class="dbe-preset__heading">
							<h4><?php echo esc_html( $preset['title'] ); ?></h4>
							<?php if ( 'power' === $preset_id ) : ?>
								<span class="dbe-badge dbe-badge--experimental"><?php esc_html_e( 'Includes experimental', 'daveden-builderius-enhancements' ); ?></span>
							<?php endif; ?>
						</div>
						<p id="<?php echo esc_attr( $description_id ); ?>"><?php echo esc_html( $preset['description'] ); ?></p>
						<button
							type="button"
							class="button dbe-apply-preset"
							data-features="<?php echo esc_attr( implode( ',', $preset['features'] ) ); ?>"
							aria-describedby="<?php echo esc_attr( $description_id ); ?>"
						>
							<?php
							printf(
								/* translators: %s: feature preset name. */
								esc_html__( 'Enable %s', 'daveden-builderius-enhancements' ),
								esc_html( $preset['title'] )
							);
							?>
						</button>
					</article>
				<?php endforeach; ?>
			</div>
			<p
				class="dbe-preset-status"
				role="status"
				aria-live="polite"
				data-none="<?php esc_attr_e( 'Every available setting in this preset is already enabled.', 'daveden-builderius-enhancements' ); ?>"
				data-one="<?php esc_attr_e( 'Preset ready: 1 setting enabled. Review the changes, then save.', 'daveden-builderius-enhancements' ); ?>"
				data-many="<?php echo esc_attr( $preset_many ); ?>"
			></p>
		</section>
		<?php
		/*
		 * Click-to-load rather than an auto-loading iframe: nothing is requested
		 * from YouTube until the button is pressed, so opening this settings
		 * screen makes no third-party request, and a blocked or unreachable
		 * YouTube leaves a working link instead of a blank 560x315 hole.
		 */
		?>
		<figure class="dbe-dashboard__video">
			<button
				type="button"
				class="dbe-video-facade"
				data-embed="https://www.youtube-nocookie.com/embed/PnwovfnCQsQ?autoplay=1"
				data-embed-title="<?php esc_attr_e( 'Introduction to Daveden Builder Enhancements (YouTube video)', 'daveden-builderius-enhancements' ); ?>"
			>
				<span class="dbe-video-facade__icon" aria-hidden="true"></span>
				<span class="dbe-video-facade__text"><?php esc_html_e( 'Play the introduction video', 'daveden-builderius-enhancements' ); ?></span>
				<span class="dbe-video-facade__meta"><?php esc_html_e( 'Loads from YouTube when you press play', 'daveden-builderius-enhancements' ); ?></span>
			</button>
			<figcaption>
				<?php esc_html_e( 'Introduction to the plugin on the Daveden YouTube channel.', 'daveden-builderius-enhancements' ); ?>
				<a href="https://www.youtube.com/watch?v=PnwovfnCQsQ" target="_blank" rel="noopener"><?php esc_html_e( 'Watch it on YouTube instead', 'daveden-builderius-enhancements' ); ?></a>
			</figcaption>
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
				if ( 'abilities' === $tab_slug ) {
					foreach ( array_keys( dbe_abilities() ) as $ability_id ) {
						++$total;
						if ( dbe_ability_enabled( $ability_id ) ) {
							++$enabled;
						}
					}
				} else {
					foreach ( $features as $id => $feature ) {
						if ( $feature['tab'] === $tab_slug ) {
							++$total;
							if ( dbe_enabled( $id ) ) {
								++$enabled;
							}
						}
					}
				}
				?>
				<li>
					<?php
					/*
					 * A real in-page link, not a button: without JavaScript every
					 * panel is visible and this jumps to the right one, and with it
					 * the same click switches tabs instead.
					 */
					?>
					<a class="dbe-dashboard__jump" href="#dbe-panel-<?php echo esc_attr( $tab_slug ); ?>" data-goto-tab="<?php echo esc_attr( $tab_slug ); ?>">
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
					</a>
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
	$features = dbe_available_features();
	/* translators: %s: number of matching features. */
	$result_many = __( '%s features shown', 'daveden-builderius-enhancements' );
	?>
	<div class="wrap dbe-settings">
		<h1><?php esc_html_e( 'Daveden Builder Enhancements', 'daveden-builderius-enhancements' ); ?></h1>
		<p class="dbe-intro"><?php esc_html_e( 'Choose which enhancements are available in Builderius. Interface settings apply the next time the builder loads; editing tools change saved content only when you use them.', 'daveden-builderius-enhancements' ); ?></p>

		<?php settings_errors(); ?>

		<form method="post" action="options.php">
			<?php settings_fields( 'daveden_builder_enhancements' ); ?>

			<div class="dbe-settings-layout">
			<div class="dbe-tabbar" hidden>
				<?php $first = true; ?>
				<?php foreach ( $tabs as $slug => $label ) : ?>
					<button type="button" class="dbe-tab<?php echo $first ? ' is-active' : ''; ?>" data-tab="<?php echo esc_attr( $slug ); ?>">
						<span class="dbe-tab__label"><?php echo esc_html( $label ); ?></span>
						<?php if ( 'dashboard' !== $slug ) : ?>
							<span class="dbe-tab__count" data-tabcount-for="<?php echo esc_attr( $slug ); ?>" aria-hidden="true"></span>
						<?php endif; ?>
					</button>
					<?php $first = false; ?>
				<?php endforeach; ?>
			</div>

			<div class="dbe-settings-main">
			<div
				class="dbe-settings-tools"
				data-result-one="<?php esc_attr_e( '1 feature shown', 'daveden-builderius-enhancements' ); ?>"
				data-result-many="<?php echo esc_attr( $result_many ); ?>"
				hidden
			>
				<label class="dbe-settings-tools__search">
					<span><?php esc_html_e( 'Find a feature', 'daveden-builderius-enhancements' ); ?></span>
					<input type="search" class="dbe-feature-search" placeholder="<?php esc_attr_e( 'Search all features', 'daveden-builderius-enhancements' ); ?>">
				</label>
				<label class="dbe-settings-tools__filter">
					<span><?php esc_html_e( 'Show', 'daveden-builderius-enhancements' ); ?></span>
					<select class="dbe-feature-filter">
						<option value="all"><?php esc_html_e( 'All features', 'daveden-builderius-enhancements' ); ?></option>
						<option value="enabled"><?php esc_html_e( 'Enabled', 'daveden-builderius-enhancements' ); ?></option>
						<option value="disabled"><?php esc_html_e( 'Disabled', 'daveden-builderius-enhancements' ); ?></option>
						<option value="experimental"><?php esc_html_e( 'Experimental', 'daveden-builderius-enhancements' ); ?></option>
						<option value="unavailable"><?php esc_html_e( 'Unavailable', 'daveden-builderius-enhancements' ); ?></option>
					</select>
				</label>
				<button type="button" class="button dbe-clear-filters" hidden><?php esc_html_e( 'Clear filters', 'daveden-builderius-enhancements' ); ?></button>
				<span class="dbe-filter-status" role="status" aria-live="polite"></span>
			</div>

			<?php foreach ( $tabs as $slug => $label ) : ?>
				<?php
				$tab_features = array();
				foreach ( $features as $feature_id => $feature ) {
					if ( $feature['tab'] === $slug ) {
						$tab_features[ $feature_id ] = $feature;
					}
				}
				?>
				<?php // The id is set here, not only by settings.js, so the dashboard's in-page links resolve without JavaScript. ?>
				<section class="dbe-panel" id="dbe-panel-<?php echo esc_attr( $slug ); ?>" data-tab="<?php echo esc_attr( $slug ); ?>" aria-label="<?php echo esc_attr( $label ); ?>">
					<div class="dbe-panel__head">
						<div class="dbe-panel__headtext">
							<h2 class="dbe-panel__title"><?php echo esc_html( $label ); ?></h2>
							<?php if ( ! empty( $tab_features ) ) : ?>
								<p class="dbe-panel__count" data-count-for="<?php echo esc_attr( $slug ); ?>"></p>
							<?php endif; ?>
						</div>
						<?php
						if ( ! empty( $tab_features ) ) {
							dbe_render_bulk_switch(
								'tab',
								$slug,
								__( 'All features', 'daveden-builderius-enhancements' ),
								$label,
								dbe_count_experimental( $tab_features )
							);
						}
						?>
					</div>
					<?php
					if ( 'dashboard' === $slug ) {
						dbe_render_dashboard_panel();
					} elseif ( 'abilities' === $slug ) {
						dbe_render_abilities_panel();
					} else {
						dbe_render_feature_tab( $slug, $features );
					}
					?>
				</section>
			<?php endforeach; ?>

			<div class="dbe-no-results" hidden>
				<p><?php esc_html_e( 'No features match those filters.', 'daveden-builderius-enhancements' ); ?></p>
				<button type="button" class="button dbe-no-results-clear"><?php esc_html_e( 'Clear filters', 'daveden-builderius-enhancements' ); ?></button>
			</div>

			<div class="dbe-danger-zone" hidden>
				<button
					type="button"
					class="button dbe-reset-defaults"
					data-confirm="<?php esc_attr_e( 'Reset every feature on every tab to its default? Nothing is saved until you choose Save changes.', 'daveden-builderius-enhancements' ); ?>"
				><?php esc_html_e( 'Reset all tabs to defaults', 'daveden-builderius-enhancements' ); ?></button>
				<p class="dbe-danger-zone__note"><?php esc_html_e( 'Restores every feature across all tabs to how it ships, experimental features off. Your choices are only replaced once you save.', 'daveden-builderius-enhancements' ); ?></p>
			</div>

			</div><!-- .dbe-settings-main -->
			</div><!-- .dbe-settings-layout -->

			<div
				class="dbe-savebar"
				data-clean="<?php esc_attr_e( 'No unsaved changes', 'daveden-builderius-enhancements' ); ?>"
				data-dirty="<?php esc_attr_e( 'You have unsaved changes', 'daveden-builderius-enhancements' ); ?>"
				data-reset="<?php esc_attr_e( 'Defaults restored. Save to keep them.', 'daveden-builderius-enhancements' ); ?>"
				data-preset="<?php esc_attr_e( 'Preset ready. Review the changes, then save.', 'daveden-builderius-enhancements' ); ?>"
			>
				<span class="dbe-save-status" role="status" aria-live="polite"></span>
				<?php submit_button( __( 'Save changes', 'daveden-builderius-enhancements' ), 'primary', 'submit', false ); ?>
			</div>
		</form>
	</div>
	<?php
}
