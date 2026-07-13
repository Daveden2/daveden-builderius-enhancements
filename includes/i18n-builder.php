<?php
/**
 * Translatable strings for the builder UI.
 *
 * Builder.js is printed inline (not enqueued), so wp_set_script_translations()
 * cannot reach it. Instead every user-facing string the script renders is
 * translated here and shipped on the config object as `i18n`; the script reads
 * them through its t()/fmt() helpers, keeping the English text as a fallback
 * so a missing key can never blank a control.
 *
 * Placeholders use sprintf syntax (%s, %1$s); fmt() in builder.js resolves
 * them. Counted strings ship as One/Many pairs chosen in JS. That covers the
 * common European plural shapes but not every language's; a fuller solution
 * would need a plural-rules engine in the script.
 *
 * NOT listed here: the native menu labels the script MATCHES against
 * ('Remove', 'Paste', 'Duplicate', 'Copy', 'Create Component', 'Save…').
 * Those must stay in English because they match Builderius' own untranslated
 * menu items, not text we render.
 *
 * @package Daveden_Builder_Enhancements
 */

defined( 'ABSPATH' ) || exit;

/**
 * Key => translated string, consumed by builder.js as CFG.i18n.
 *
 * @return array<string,string>
 */
function dbe_builder_strings() {
	return array(
		// Shared.
		'element'                 => __( 'element', 'daveden-builderius-enhancements' ),
		'close'                   => __( 'Close', 'daveden-builderius-enhancements' ),
		'cancel'                  => __( 'Cancel', 'daveden-builderius-enhancements' ),

		// Wrap / unwrap / move.
		'wrapNeedsSiblings'       => __( 'Wrap needs sibling elements', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements. */
		'wrappedInTemplateOne'    => __( 'Wrapped %s element in a template. Add a rendering condition or its contents won’t show on the page', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements. */
		'wrappedInTemplateMany'   => __( 'Wrapped %s elements in a template. Add a rendering condition or their contents won’t show on the page', 'daveden-builderius-enhancements' ),
		/* translators: 1: number of elements, 2: wrapper type (div, collection + template). */
		'wrappedOne'              => __( 'Wrapped %1$s element in %2$s', 'daveden-builderius-enhancements' ),
		/* translators: 1: number of elements, 2: wrapper type (div, collection + template). */
		'wrappedMany'             => __( 'Wrapped %1$s elements in %2$s', 'daveden-builderius-enhancements' ),
		'wrapTypeCollection'      => __( 'collection + template', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'movedUp'                 => __( 'Moved “%s” up', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'movedDown'               => __( 'Moved “%s” down', 'daveden-builderius-enhancements' ),
		'nothingToUnwrap'         => __( 'Nothing to unwrap: this element has no children', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements. */
		'unwrappedOne'            => __( 'Unwrapped %s element', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements. */
		'unwrappedMany'           => __( 'Unwrapped %s elements', 'daveden-builderius-enhancements' ),

		// Rename.
		'rename'                  => __( 'Rename', 'daveden-builderius-enhancements' ),
		'renameElement'           => __( 'Rename element', 'daveden-builderius-enhancements' ),
		'resetLabel'              => __( 'Reset label', 'daveden-builderius-enhancements' ),
		/* translators: %s: HTML tag name. */
		'labelResetTo'            => __( 'Label reset to <%s>', 'daveden-builderius-enhancements' ),

		// Auto-BEM.
		'autoBem'                 => __( 'Auto-BEM', 'daveden-builderius-enhancements' ),
		'blockName'               => __( 'Block name', 'daveden-builderius-enhancements' ),
		'elementsAndClassNames'   => __( 'Elements and class names', 'daveden-builderius-enhancements' ),
		'addClassToElement'       => __( 'Add a class to this element', 'daveden-builderius-enhancements' ),
		'className'               => __( 'Class name', 'daveden-builderius-enhancements' ),
		'notSupported'            => __( 'not supported', 'daveden-builderius-enhancements' ),
		/* translators: %s: existing class names, dot-prefixed. */
		'hasClasses'              => __( 'has %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of classes. */
		'addClassesOne'           => __( 'Add %s class', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of classes. */
		'addClassesMany'          => __( 'Add %s classes', 'daveden-builderius-enhancements' ),
		/* translators: %s: the rejected class name. */
		'invalidClassName'        => __( 'Invalid class name: “%s”', 'daveden-builderius-enhancements' ),
		'stop'                    => __( 'Stop', 'daveden-builderius-enhancements' ),
		'stopping'                => __( 'Stopping…', 'daveden-builderius-enhancements' ),
		/* translators: 1: current element number, 2: total elements, 3: class name being applied. */
		'applyingClasses'         => __( 'Applying classes… %1$s/%2$s (%3$s)', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of classes added. */
		'addedClassesOne'         => __( 'Added %s class', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of classes added. */
		'addedClassesMany'        => __( 'Added %s classes', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of classes that failed. */
		'addedFailedSuffix'       => __( ', %s failed', 'daveden-builderius-enhancements' ),
		'rememberToSave'          => __( ' (remember to save)', 'daveden-builderius-enhancements' ),

		// Remove several elements.
		/* translators: %s: number of elements removed. */
		'removedElementsOne'      => __( 'Removed %s element (Cmd+Z restores one at a time)', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements removed. */
		'removedElementsMany'     => __( 'Removed %s elements (Cmd+Z restores one at a time)', 'daveden-builderius-enhancements' ),

		// Undo / redo element adds & deletes.
		'nothingToUndo'           => __( 'Nothing to undo', 'daveden-builderius-enhancements' ),
		'nothingToRedo'           => __( 'Nothing to redo', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'cannotRestoreParentGone' => __( 'Cannot restore “%s”: its parent is gone', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'restored'                => __( 'Restored “%s”', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'removed'                 => __( 'Removed “%s”', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'cannotRemoveGone'        => __( 'Cannot undo: “%s” is no longer here', 'daveden-builderius-enhancements' ),
		'undoFailedRemove'        => __( 'Undo failed: could not remove the element', 'daveden-builderius-enhancements' ),
		'undoFailedPaste'         => __( 'Undo failed: could not reach Paste', 'daveden-builderius-enhancements' ),
		'undoFailedNotRestored'   => __( 'Undo failed: element not restored', 'daveden-builderius-enhancements' ),
		'undoFailedClipboard'     => __( 'Undo failed: clipboard blocked', 'daveden-builderius-enhancements' ),
		'undoFailedSelectParent'  => __( 'Undo failed: could not select the parent', 'daveden-builderius-enhancements' ),
		'undoFailedNoRows'        => __( 'Undo failed: no tree rows', 'daveden-builderius-enhancements' ),

		// Right-click menu.
		'expandChildren'          => __( 'Expand children', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of selected elements. */
		'removeNElements'         => __( 'Remove %s elements', 'daveden-builderius-enhancements' ),
		'unwrap'                  => __( 'Unwrap', 'daveden-builderius-enhancements' ),
		'moveUp'                  => __( 'Move up', 'daveden-builderius-enhancements' ),
		'moveDown'                => __( 'Move down', 'daveden-builderius-enhancements' ),
		'selectParent'            => __( 'Select parent', 'daveden-builderius-enhancements' ),
		'wrapIn'                  => __( 'Wrap in', 'daveden-builderius-enhancements' ),
		'wrapInEllipsis'          => __( 'Wrap in…', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of selected elements. */
		'wrapNIn'                 => __( 'Wrap %s in', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of selected elements. */
		'wrapNInEllipsis'         => __( 'Wrap %s in…', 'daveden-builderius-enhancements' ),
		/* translators: 1: "Wrap in" or "Wrap N in", 2: wrapper type label. */
		'wrapItemLabel'           => __( '%1$s %2$s', 'daveden-builderius-enhancements' ),
		'divLabel'                => __( 'Div', 'daveden-builderius-enhancements' ),
		'figureLabel'             => __( 'Figure', 'daveden-builderius-enhancements' ),
		'templateLabel'           => __( 'Template', 'daveden-builderius-enhancements' ),
		'collectionTemplateLabel' => __( 'Collection + template', 'daveden-builderius-enhancements' ),
		'onlySiblingsWrapped'     => __( 'Only sibling elements can be wrapped together', 'daveden-builderius-enhancements' ),
		'saveTo'                  => __( 'Save to…', 'daveden-builderius-enhancements' ),

		// Navigator header buttons.
		'collapseSubtrees'        => __( 'Collapse subtrees', 'daveden-builderius-enhancements' ),
		'collapseSubtreesTip'     => __( 'Collapse subtrees (keeps top-level elements open)', 'daveden-builderius-enhancements' ),
		'expandAll'               => __( 'Expand all', 'daveden-builderius-enhancements' ),
		'expandAllElements'       => __( 'Expand all elements', 'daveden-builderius-enhancements' ),
		'detachPanel'             => __( 'Detach panel', 'daveden-builderius-enhancements' ),
		'dockPanel'               => __( 'Dock panel', 'daveden-builderius-enhancements' ),
		'resizePanel'             => __( 'Resize panel', 'daveden-builderius-enhancements' ),
		'dragToMove'              => __( 'Drag to move', 'daveden-builderius-enhancements' ),

		// Icon tooltips.
		'tipDynamicConditions'    => __( 'Dynamic data conditions', 'daveden-builderius-enhancements' ),
		'tipToggleCssEditor'      => __( 'Toggle CSS code editor', 'daveden-builderius-enhancements' ),
		'tipBuilderiusMenu'       => __( 'Builderius menu', 'daveden-builderius-enhancements' ),
		'tipBreakpointSettings'   => __( 'Breakpoint settings', 'daveden-builderius-enhancements' ),
		'tipReloadPreview'        => __( 'Reload preview', 'daveden-builderius-enhancements' ),
		'tipSaveOptions'          => __( 'Save options', 'daveden-builderius-enhancements' ),
		'tipDeleteSelected'       => __( 'Delete selected element (click twice to confirm)', 'daveden-builderius-enhancements' ),
		'tipEditFavourites'       => __( 'Edit favourite elements', 'daveden-builderius-enhancements' ),
		'tipCollapseBottomPanel'  => __( 'Collapse bottom panel', 'daveden-builderius-enhancements' ),
		'tipAddBreakpoint'        => __( 'Add breakpoint', 'daveden-builderius-enhancements' ),
		'tipDeleteBreakpoint'     => __( 'Delete breakpoint', 'daveden-builderius-enhancements' ),
		'tipInsertDynamicData'    => __( 'Insert dynamic data', 'daveden-builderius-enhancements' ),
		'tipCanvasWidth'          => __( 'Canvas width in pixels', 'daveden-builderius-enhancements' ),
		'tipCanvasZoom'           => __( 'Canvas zoom, percent', 'daveden-builderius-enhancements' ),
		/* translators: 1: breakpoint label, 2: maximum width in pixels. */
		'bpMax'                   => __( '%1$s (max %2$spx)', 'daveden-builderius-enhancements' ),
		/* translators: %s: breakpoint label. */
		'bpBase'                  => __( '%s (base styles, full width)', 'daveden-builderius-enhancements' ),
		'breakpoint'              => __( 'Breakpoint', 'daveden-builderius-enhancements' ),
		'bpFallbackBase'          => __( 'Base styles (full width)', 'daveden-builderius-enhancements' ),
		'bpFallbackDesktop'       => __( 'Desktop (max 1279px)', 'daveden-builderius-enhancements' ),
		'bpFallbackTablet'        => __( 'Tablet (max 991px)', 'daveden-builderius-enhancements' ),
		'bpFallbackMobile'        => __( 'Mobile (max 478px)', 'daveden-builderius-enhancements' ),
		'collapseAll'             => __( 'Collapse all', 'daveden-builderius-enhancements' ),
		'collapseAllGroups'       => __( 'Collapse all groups', 'daveden-builderius-enhancements' ),
		'expandAllGroups'         => __( 'Expand all groups', 'daveden-builderius-enhancements' ),
		'closePanel'              => __( 'Close panel', 'daveden-builderius-enhancements' ),
		'showSidePanels'          => __( 'Show side panels', 'daveden-builderius-enhancements' ),
		'hideSidePanels'          => __( 'Hide side panels (full-width canvas)', 'daveden-builderius-enhancements' ),
		'previewNewTab'           => __( 'Preview page in a new tab', 'daveden-builderius-enhancements' ),

		// Styles panel.
		'contentTab'              => __( 'Content', 'daveden-builderius-enhancements' ),
		'stylesTab'               => __( 'Styles', 'daveden-builderius-enhancements' ),
		// CSS selector hint (css_hint_dialog). The body strings carry <code> markup.
		// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment -- %local% and %selector% are literal Builderius tokens shown to the user, not printf placeholders.
		'cssHintBanner'           => __( 'How %local%, %selector% & breakpoints work', 'daveden-builderius-enhancements' ),
		'cssHintOpen'             => __( 'Selector and breakpoint help', 'daveden-builderius-enhancements' ),
		'cssHintDismiss'          => __( 'Dismiss hint', 'daveden-builderius-enhancements' ),
		'cssHintClose'            => __( 'Close', 'daveden-builderius-enhancements' ),
		'cssHintTitle'            => __( 'Selector tokens & breakpoints', 'daveden-builderius-enhancements' ),
		'cssHintLocal'            => __( 'Targets this element only, through its automatic class. Use <code>%#local%</code> to target it by ID instead.', 'daveden-builderius-enhancements' ),
		'cssHintSelector'         => __( 'Targets every element that uses the current class.', 'daveden-builderius-enhancements' ),
		'cssHintBreakpointsTerm'  => __( 'Breakpoints', 'daveden-builderius-enhancements' ),
		'cssHintBreakpoints'      => __( 'Switch breakpoint in the top bar to write CSS for a specific screen size. Inside a rule you can also use the breakpoint variables <code>--desktop</code>, <code>--tablet</code> and <code>--mobile</code> as values.', 'daveden-builderius-enhancements' ),
		'switchingScope'          => __( 'Switching scope…', 'daveden-builderius-enhancements' ),
		'scopeBadgeTip'           => __( 'Scope controls where edits are SAVED. The editor shows the selector’s existing rules from both scopes, so a rule you see here may be stored in the other scope.', 'daveden-builderius-enhancements' ),
		'cssScope'                => __( 'CSS scope', 'daveden-builderius-enhancements' ),
		'scopeAllCss'             => __( 'All CSS', 'daveden-builderius-enhancements' ),
		'scopeAllCssTip'          => __( 'Show the full CSS for the active scope and jump to this selector', 'daveden-builderius-enhancements' ),
		'scopeGlobal'             => __( 'Global', 'daveden-builderius-enhancements' ),
		'scopeTemplate'           => __( 'Template', 'daveden-builderius-enhancements' ),
		'scopeComponent'          => __( 'Component', 'daveden-builderius-enhancements' ),
		'scopeLocal'              => __( 'Local', 'daveden-builderius-enhancements' ),
		/* translators: %s: scope name (Global, Template or Component). Precedes the class name. */
		'scopeEditing'            => __( 'Editing %s rules', 'daveden-builderius-enhancements' ),
		/* translators: %s: scope name. Precedes the class name. */
		'scopeNewRule'            => __( 'New %s rule', 'daveden-builderius-enhancements' ),
		/* translators: %s: scope name. Precedes the class name. */
		'scopeNoRules'            => __( 'No %s rules', 'daveden-builderius-enhancements' ),
		/* translators: %s: the other scope's name. Follows the class name. */
		'scopeAlsoIn'             => __( '· also in %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: the scope that stores the rules. Follows the class name in the warning. */
		'scopeRulesIn'            => __( '· rules in %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: active scope name (Global, Template or Component). Button that seeds an empty rule so the class becomes editable in the active scope. */
		'scopeAddHere'            => __( 'Add %s rules', 'daveden-builderius-enhancements' ),
		/* translators: %s: the scope that owns the rules. Editor-cover note explaining why editing is off. */
		'scopeCoverWhy'           => __( 'Editing here would change %s rules', 'daveden-builderius-enhancements' ),
		/* Status verb for the %local% one-off, which belongs to no class and no scope. */
		'scopeLocalEditing'       => __( 'Editing element styles', 'daveden-builderius-enhancements' ),
		/* translators: %s: scope name (Global, Template or Component). */
		'switchTo'                => __( 'Switch to %s', 'daveden-builderius-enhancements' ),

		// Theme & density buttons.
		/* translators: 1: current theme, 2: next theme. */
		'themeTip'                => __( 'Theme: %1$s (switch to %2$s)', 'daveden-builderius-enhancements' ),
		'themeLight'              => __( 'light', 'daveden-builderius-enhancements' ),
		'themeDark'               => __( 'dark', 'daveden-builderius-enhancements' ),
		'themeAuto'               => __( 'auto', 'daveden-builderius-enhancements' ),
		/* translators: %s: the theme just switched to (light / dark / auto). Announced to screen readers. */
		'themeAnnounce'           => __( 'Theme set to %s', 'daveden-builderius-enhancements' ),
		/* translators: 1: current density, 2: next density. */
		'densityTip'              => __( 'Density: %1$s (switch to %2$s)', 'daveden-builderius-enhancements' ),
		'densityComfortable'      => __( 'comfortable', 'daveden-builderius-enhancements' ),
		'densityCompact'          => __( 'compact', 'daveden-builderius-enhancements' ),
		/* translators: %s: the density just switched to (comfortable / compact). Announced to screen readers. */
		'densityAnnounce'         => __( 'Density set to %s', 'daveden-builderius-enhancements' ),
		'toolbarBreakpoints'      => __( 'Breakpoints', 'daveden-builderius-enhancements' ),
		'groupCanvasSize'         => __( 'Canvas size', 'daveden-builderius-enhancements' ),
		'toolbarFooterTools'      => __( 'Editor tools', 'daveden-builderius-enhancements' ),
		/* translators: %s: the tool name (e.g. Custom CSS). Marks a locked/Pro tool for screen readers. */
		'footerLocked'            => __( '%s (locked)', 'daveden-builderius-enhancements' ),
		/* translators: %s: the name of the open tool (e.g. Dynamic Data). Names the editor panel region. */
		'footerPanelNamed'        => __( '%s panel', 'daveden-builderius-enhancements' ),
		'footerToolsPanel'        => __( 'Editor tools panel', 'daveden-builderius-enhancements' ),
		'footerScopeTabs'         => __( 'Scope', 'daveden-builderius-enhancements' ),
		'builderiusMenu'          => __( 'Builderius menu', 'daveden-builderius-enhancements' ),
		'comboboxFilter'          => __( 'Filter options', 'daveden-builderius-enhancements' ),
		'comboboxListbox'         => __( 'Options', 'daveden-builderius-enhancements' ),
		/* translators: %s: the currently selected value. Names the select trigger for screen readers. */
		'comboboxTrigger'         => __( 'Selection: %s', 'daveden-builderius-enhancements' ),
		'terminalTablist'         => __( 'AI chat sessions', 'daveden-builderius-enhancements' ),
		'terminalNewTab'          => __( 'New chat session', 'daveden-builderius-enhancements' ),
		'terminalAgentMenu'       => __( 'Choose an agent', 'daveden-builderius-enhancements' ),

		// Navigator search.
		'filterElements'          => __( 'Filter elements…', 'daveden-builderius-enhancements' ),
		'filterElementsAria'      => __( 'Filter elements by label or tag', 'daveden-builderius-enhancements' ),

		// Navigator keyboard tree.
		'elementsTree'            => __( 'Elements', 'daveden-builderius-enhancements' ),
		'scTreeMove'              => __( 'Move between elements (selection follows)', 'daveden-builderius-enhancements' ),
		'scTreeExpand'            => __( 'Open a branch, then step into its first child', 'daveden-builderius-enhancements' ),
		'scTreeCollapse'          => __( 'Close a branch, then step out to the parent', 'daveden-builderius-enhancements' ),
		'scTreeFirstLast'         => __( 'First / last element', 'daveden-builderius-enhancements' ),

		// Screen-reader landmarks (chrome_landmarks).
		'regionTopBar'            => __( 'Top toolbar', 'daveden-builderius-enhancements' ),
		'regionInserter'          => __( 'Element library', 'daveden-builderius-enhancements' ),
		'regionSettings'          => __( 'Element settings', 'daveden-builderius-enhancements' ),
		'regionCanvas'            => __( 'Canvas', 'daveden-builderius-enhancements' ),
		'regionNavigator'         => __( 'Navigator', 'daveden-builderius-enhancements' ),
		'regionFooter'            => __( 'Footer bar', 'daveden-builderius-enhancements' ),

		// Save cue.
		'unsaved'                 => __( 'Unsaved', 'daveden-builderius-enhancements' ),

		// Save shortcut.
		'scSave'                  => __( 'Save the template', 'daveden-builderius-enhancements' ),

		// Class-chip menu.
		/* translators: %s: CSS class name */
		'chipMenuFor'             => __( 'Actions for %s', 'daveden-builderius-enhancements' ),

		// Keyboard shortcuts overlay.
		'keyboardShortcuts'       => __( 'Keyboard shortcuts', 'daveden-builderius-enhancements' ),
		'scGroupGeneral'          => __( 'General', 'daveden-builderius-enhancements' ),
		'scGroupNavigator'        => __( 'Navigator', 'daveden-builderius-enhancements' ),
		'scGroupContextMenu'      => __( 'Context menu', 'daveden-builderius-enhancements' ),
		'scOpenOverlay'           => __( 'Open this shortcuts overlay', 'daveden-builderius-enhancements' ),
		'scEscape'                => __( 'Close menus and dialogs; clear the multi-selection', 'daveden-builderius-enhancements' ),
		'scDelete'                => __( 'Remove the selected element (Builderius)', 'daveden-builderius-enhancements' ),
		'scCopyPaste'             => __( 'Copy / paste the selected element (Builderius)', 'daveden-builderius-enhancements' ),
		'scUndo'                  => __( 'Restore the last deleted element', 'daveden-builderius-enhancements' ),
		'scRedo'                  => __( 'Redo the delete', 'daveden-builderius-enhancements' ),
		'scMultiToggle'           => __( 'Add or remove a row from the multi-selection', 'daveden-builderius-enhancements' ),
		'scRange'                 => __( 'Select a range of rows', 'daveden-builderius-enhancements' ),
		'scCtxOpen'               => __( 'Open the context menu on the focused row', 'daveden-builderius-enhancements' ),
		'scMove'                  => __( 'Move between items (wraps)', 'daveden-builderius-enhancements' ),
		'scFirstLast'             => __( 'First / last item', 'daveden-builderius-enhancements' ),
		'scActivate'              => __( 'Activate an item or open its submenu', 'daveden-builderius-enhancements' ),
		'scSubmenu'               => __( 'Open / close a submenu', 'daveden-builderius-enhancements' ),

		// Preview resize.
		'resizePreview'           => __( 'Resize preview canvas', 'daveden-builderius-enhancements' ),
		'resizePanels'            => __( 'Resize panels', 'daveden-builderius-enhancements' ),

		// Favourites & component properties.
		'rearrangeFavourites'     => __( 'Rearrange favourites', 'daveden-builderius-enhancements' ),
		'rearrangeProperties'     => __( 'Rearrange properties', 'daveden-builderius-enhancements' ),
		'rearrange'               => __( 'Rearrange', 'daveden-builderius-enhancements' ),
		/* translators: %s: favourite element name. */
		'favArrowHint'            => __( '%s (press up or down arrow to move, Escape to finish)', 'daveden-builderius-enhancements' ),
		'favModeOn'               => __( 'Rearrange mode on: drag the icons, or focus one and use the arrow keys', 'daveden-builderius-enhancements' ),
		'propModeOn'              => __( 'Rearrange mode on: drag a property, or focus one and use the arrow keys', 'daveden-builderius-enhancements' ),
		'modeOffSaved'            => __( 'Rearrange mode off: order saved', 'daveden-builderius-enhancements' ),
		/* translators: 1: item name, 2: new position, 3: total items. */
		'movedToPosition'         => __( 'Moved %1$s to position %2$s of %3$s', 'daveden-builderius-enhancements' ),
		'propSaveFailed'          => __( 'Order changed on screen, but it could not be saved to the component', 'daveden-builderius-enhancements' ),
		'property'                => __( 'Property', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements moved. */
		'movedTogether'           => __( 'Moved %s elements together', 'daveden-builderius-enhancements' ),
		/* translators: 1: number of elements moved, 2: number that failed. */
		'movedSomeFailedOne'      => __( 'Moved %1$s element (%2$s could not follow)', 'daveden-builderius-enhancements' ),
		/* translators: 1: number of elements moved, 2: number that failed. */
		'movedSomeFailedMany'     => __( 'Moved %1$s elements (%2$s could not follow)', 'daveden-builderius-enhancements' ),

		// Class-chip menu.
		/* translators: %s: class name. */
		'copyName'                => __( 'Copy %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: class name without the leading dot. */
		'copyNoDot'               => __( 'Copy %s (no dot)', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of classes. */
		'copyAllClasses'          => __( 'Copy all classes (%s)', 'daveden-builderius-enhancements' ),
		/* translators: %s: class name. */
		'removeFromElement'       => __( 'Remove %s from element', 'daveden-builderius-enhancements' ),
		/* translators: %s: the copied text. */
		'copied'                  => __( 'Copied %s', 'daveden-builderius-enhancements' ),
		'copyFailed'              => __( 'Copy failed: clipboard unavailable', 'daveden-builderius-enhancements' ),
		/* translators: %s: class name. */
		'removedName'             => __( 'Removed %s', 'daveden-builderius-enhancements' ),

		// Element keyboard shortcuts + quick element picker.
		'cut'                     => __( 'Cut', 'daveden-builderius-enhancements' ),
		'addBefore'               => __( 'Add element before', 'daveden-builderius-enhancements' ),
		'addAfter'                => __( 'Add element after', 'daveden-builderius-enhancements' ),
		'pickBeforeTitle'         => __( 'Add element before', 'daveden-builderius-enhancements' ),
		'pickAfterTitle'          => __( 'Add element after', 'daveden-builderius-enhancements' ),
		'pickFilter'              => __( 'Filter elements…', 'daveden-builderius-enhancements' ),
		'pickNoMatch'             => __( 'No matching element', 'daveden-builderius-enhancements' ),
		'duplicated'              => __( 'Duplicated element', 'daveden-builderius-enhancements' ),
		'cutDone'                 => __( 'Cut element', 'daveden-builderius-enhancements' ),
		/* translators: %s: element/tag name just inserted. */
		'addedElement'            => __( 'Added %s', 'daveden-builderius-enhancements' ),
		'noElementSelected'       => __( 'Select an element first', 'daveden-builderius-enhancements' ),
		// Shortcuts overlay — Elements group.
		'scGroupElements'         => __( 'Selected element', 'daveden-builderius-enhancements' ),
		'scDuplicate'             => __( 'Duplicate', 'daveden-builderius-enhancements' ),
		'scCut'                   => __( 'Cut', 'daveden-builderius-enhancements' ),
		'scAddBefore'             => __( 'Add an element before', 'daveden-builderius-enhancements' ),
		'scAddAfter'              => __( 'Add an element after', 'daveden-builderius-enhancements' ),
		'scRename'                => __( 'Rename', 'daveden-builderius-enhancements' ),
		'scCopyPasteDelete'       => __( 'Copy / paste / delete the element (Builderius)', 'daveden-builderius-enhancements' ),
		// Shortcuts overlay — Move to area group.
		'scGroupAreas'            => __( 'Move to area', 'daveden-builderius-enhancements' ),
		'scGotoNavigator'         => __( 'Navigator', 'daveden-builderius-enhancements' ),
		'scGotoSettings'          => __( 'Settings panel', 'daveden-builderius-enhancements' ),
		'scGotoCanvas'            => __( 'Canvas / preview', 'daveden-builderius-enhancements' ),
		'scGotoInserter'          => __( 'Insert elements', 'daveden-builderius-enhancements' ),

		// Command palette.
		'commandPalette'          => __( 'Command palette', 'daveden-builderius-enhancements' ),
		'searchCommands'          => __( 'Search commands…', 'daveden-builderius-enhancements' ),
		'paletteNoEl'             => __( 'No element selected — element commands are hidden', 'daveden-builderius-enhancements' ),
		'paletteAddClass'         => __( 'Add classes', 'daveden-builderius-enhancements' ),
		'paletteAddAttr'          => __( 'Add attributes', 'daveden-builderius-enhancements' ),
		'paletteAddEmmet'         => __( 'Add elements (Emmet)', 'daveden-builderius-enhancements' ),
		'paletteDuplicate'        => __( 'Duplicate', 'daveden-builderius-enhancements' ),
		'paletteCopy'             => __( 'Copy', 'daveden-builderius-enhancements' ),
		'paletteCut'              => __( 'Cut', 'daveden-builderius-enhancements' ),
		'paletteDelete'           => __( 'Delete', 'daveden-builderius-enhancements' ),
		'paletteWrapDiv'          => __( 'Wrap in div', 'daveden-builderius-enhancements' ),
		'paletteWrapFigure'       => __( 'Wrap in figure', 'daveden-builderius-enhancements' ),
		'paletteWrapTemplate'     => __( 'Wrap in template', 'daveden-builderius-enhancements' ),
		'paletteWrapCollection'   => __( 'Wrap in collection', 'daveden-builderius-enhancements' ),
		// Command-palette group dividers.
		'paletteGroupAdd'         => __( 'Add to element', 'daveden-builderius-enhancements' ),
		'paletteGroupStructure'   => __( 'Structure', 'daveden-builderius-enhancements' ),
		'paletteGroupElement'     => __( 'Element', 'daveden-builderius-enhancements' ),
		'paletteGroupGoto'        => __( 'Go to', 'daveden-builderius-enhancements' ),
		// Shortcut hint for the native delete (kept short for the right-aligned label).
		'accelDelete'             => __( 'Del', 'daveden-builderius-enhancements' ),
		'goToNavigator'           => __( 'Go to Navigator', 'daveden-builderius-enhancements' ),
		'goToSettings'            => __( 'Go to settings', 'daveden-builderius-enhancements' ),
		'goToCanvas'              => __( 'Go to canvas', 'daveden-builderius-enhancements' ),
		'openInserterCmd'         => __( 'Open Inserter', 'daveden-builderius-enhancements' ),
		'copiedElement'           => __( 'Copied element', 'daveden-builderius-enhancements' ),
		'deletedElement'          => __( 'Deleted element', 'daveden-builderius-enhancements' ),
		'phClass'                 => __( 'class1 class2  (or .a.b)', 'daveden-builderius-enhancements' ),
		'phAttr'                  => __( 'name=value; name2=value2', 'daveden-builderius-enhancements' ),
		/* translators: %s: attribute name. */
		'addedAttribute'          => __( 'Added attribute %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of attributes added. */
		'addedAttributesMany'     => __( 'Added %s attributes', 'daveden-builderius-enhancements' ),
		'attrNoPanel'             => __( 'Open the element settings to add an attribute', 'daveden-builderius-enhancements' ),
		/* translators: %s: the text that could not be parsed. */
		'emmetInvalid'            => __( 'Could not parse: %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements added. */
		'emmetAddedOne'           => __( 'Added %s element', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements added. */
		'emmetAddedMany'          => __( 'Added %s elements', 'daveden-builderius-enhancements' ),
		// Shortcuts overlay — command palette.
		'scGroupPalette'          => __( 'Command palette', 'daveden-builderius-enhancements' ),
		'scOpenPalette'           => __( 'Open the command palette (add classes / attributes / elements)', 'daveden-builderius-enhancements' ),
	);
}
