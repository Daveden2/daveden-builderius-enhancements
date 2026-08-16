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
		'element'                       => __( 'element', 'daveden-builderius-enhancements' ),
		'close'                         => __( 'Close', 'daveden-builderius-enhancements' ),
		'cancel'                        => __( 'Cancel', 'daveden-builderius-enhancements' ),

		// Wrap / unwrap / move.
		'wrapNeedsSiblings'             => __( 'Wrap needs sibling elements', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements. */
		'wrappedInTemplateOne'          => __( 'Wrapped %s element in a template. Add a rendering condition or its contents won’t show on the page', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements. */
		'wrappedInTemplateMany'         => __( 'Wrapped %s elements in a template. Add a rendering condition or their contents won’t show on the page', 'daveden-builderius-enhancements' ),
		/* translators: 1: number of elements, 2: wrapper type (div, collection + template). */
		'wrappedOne'                    => __( 'Wrapped %1$s element in %2$s', 'daveden-builderius-enhancements' ),
		/* translators: 1: number of elements, 2: wrapper type (div, collection + template). */
		'wrappedMany'                   => __( 'Wrapped %1$s elements in %2$s', 'daveden-builderius-enhancements' ),
		'wrapTypeCollection'            => __( 'collection + template', 'daveden-builderius-enhancements' ),
		/* translators: %s: target label. */
		'movedUp'                       => __( 'Moved “%s” up', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'movedDown'                     => __( 'Moved “%s” down', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'movedIn'                       => __( 'Moved “%s” in one level', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'movedOut'                      => __( 'Moved “%s” out one level', 'daveden-builderius-enhancements' ),
		'cannotMoveUp'                  => __( 'Already first among its siblings', 'daveden-builderius-enhancements' ),
		'cannotMoveDown'                => __( 'Already last among its siblings', 'daveden-builderius-enhancements' ),
		'cannotMoveIn'                  => __( 'Needs a previous sibling that can contain elements', 'daveden-builderius-enhancements' ),
		'cannotMoveOut'                 => __( 'Already at the outermost available level', 'daveden-builderius-enhancements' ),
		'singleElementOnly'             => __( 'Available when one element is selected', 'daveden-builderius-enhancements' ),
		'currentTag'                    => __( 'Current tag', 'daveden-builderius-enhancements' ),
		'nothingToUnwrap'               => __( 'Nothing to unwrap: this element has no children', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements. */
		'unwrappedOne'                  => __( 'Unwrapped %s element', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements. */
		'unwrappedMany'                 => __( 'Unwrapped %s elements', 'daveden-builderius-enhancements' ),

		// Rename.
		'rename'                        => __( 'Rename', 'daveden-builderius-enhancements' ),
		'renameElement'                 => __( 'Rename element', 'daveden-builderius-enhancements' ),
		'resetLabel'                    => __( 'Reset label', 'daveden-builderius-enhancements' ),
		/* translators: %s: HTML tag name. */
		'labelResetTo'                  => __( 'Label reset to <%s>', 'daveden-builderius-enhancements' ),

		// Auto-BEM.
		'autoBem'                       => __( 'Auto-BEM', 'daveden-builderius-enhancements' ),
		'blockName'                     => __( 'Block name', 'daveden-builderius-enhancements' ),
		'elementsAndClassNames'         => __( 'Elements and class names', 'daveden-builderius-enhancements' ),
		'addClassToElement'             => __( 'Add a class to this element', 'daveden-builderius-enhancements' ),
		'className'                     => __( 'Class name', 'daveden-builderius-enhancements' ),
		'notSupported'                  => __( 'not supported', 'daveden-builderius-enhancements' ),
		/* translators: %s: existing class names, dot-prefixed. */
		'hasClasses'                    => __( 'has %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of classes. */
		'addClassesOne'                 => __( 'Add %s class', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of classes. */
		'addClassesMany'                => __( 'Add %s classes', 'daveden-builderius-enhancements' ),
		/* translators: %s: the rejected class name. */
		'invalidClassName'              => __( 'Invalid class name: “%s”', 'daveden-builderius-enhancements' ),
		'stop'                          => __( 'Stop', 'daveden-builderius-enhancements' ),
		'stopping'                      => __( 'Stopping…', 'daveden-builderius-enhancements' ),
		/* translators: 1: current element number, 2: total elements, 3: class name being applied. */
		'applyingClasses'               => __( 'Applying classes… %1$s/%2$s (%3$s)', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of classes added. */
		'addedClassesOne'               => __( 'Added %s class', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of classes added. */
		'addedClassesMany'              => __( 'Added %s classes', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of classes that failed. */
		'addedFailedSuffix'             => __( ', %s failed', 'daveden-builderius-enhancements' ),
		'rememberToSave'                => __( ' (remember to save)', 'daveden-builderius-enhancements' ),

		// Remove several elements.
		/* translators: %s: number of elements removed. */
		'removedElementsOne'            => __( 'Deleted %s element (Cmd+Z restores one at a time)', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements removed. */
		'removedElementsMany'           => __( 'Deleted %s elements (Cmd+Z restores one at a time)', 'daveden-builderius-enhancements' ),

		// Undo / redo element adds & deletes.
		'nothingToUndo'                 => __( 'Nothing to undo. DBE undo covers element adds, deletes, moves and DBE property changes.', 'daveden-builderius-enhancements' ),
		'nothingToRedo'                 => __( 'Nothing to redo', 'daveden-builderius-enhancements' ),
		'undoAction'                    => __( 'Undo', 'daveden-builderius-enhancements' ),
		'redoAction'                    => __( 'Redo', 'daveden-builderius-enhancements' ),
		'classChanges'                  => __( 'class changes', 'daveden-builderius-enhancements' ),
		'attributeChanges'              => __( 'attribute changes', 'daveden-builderius-enhancements' ),
		'tagChange'                     => __( 'tag change', 'daveden-builderius-enhancements' ),
		/* translators: 1: type of property change, 2: element label. */
		'undidPropertyChange'           => __( 'Undid %1$s for “%2$s”', 'daveden-builderius-enhancements' ),
		/* translators: 1: type of property change, 2: element label. */
		'redidPropertyChange'           => __( 'Redid %1$s for “%2$s”', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'cannotUpdateGone'              => __( 'Cannot update “%s”: it is no longer here', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'cannotRestoreParentGone'       => __( 'Cannot restore “%s”: its parent is gone', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'restored'                      => __( 'Restored “%s”', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'removed'                       => __( 'Removed “%s”', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'cannotRemoveGone'              => __( 'Cannot undo: “%s” is no longer here', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'cannotMoveGone'                => __( 'Cannot move “%s”: it is no longer here', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'cannotMoveParentGone'          => __( 'Cannot move “%s”: its destination parent is gone', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'movedBack'                     => __( 'Moved “%s” back', 'daveden-builderius-enhancements' ),
		'undoFailedRemove'              => __( 'Undo failed: could not remove the element', 'daveden-builderius-enhancements' ),
		'undoFailedPaste'               => __( 'Undo failed: could not reach Paste', 'daveden-builderius-enhancements' ),
		'undoFailedNotRestored'         => __( 'Undo failed: element not restored', 'daveden-builderius-enhancements' ),
		'undoFailedClipboard'           => __( 'Undo failed: clipboard blocked', 'daveden-builderius-enhancements' ),
		'undoFailedSelectParent'        => __( 'Undo failed: could not select the parent', 'daveden-builderius-enhancements' ),
		'undoFailedNoRows'              => __( 'Undo failed: no tree rows', 'daveden-builderius-enhancements' ),

		// Paste where you click.
		'pasteAtTop'                    => __( 'Paste at top level', 'daveden-builderius-enhancements' ),
		'navigatorAreaMenu'             => __( 'Navigator actions', 'daveden-builderius-enhancements' ),
		/* translators: %s: target label. */
		'elementActionsFor'             => __( 'Actions for %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of selected elements. */
		'selectedElementsActions'       => __( 'Actions for %s selected elements', 'daveden-builderius-enhancements' ),
		'pasteNothing'                  => __( 'Nothing to paste: copy an element first', 'daveden-builderius-enhancements' ),
		'pasteSelectFailed'             => __( 'Paste failed: could not select the element', 'daveden-builderius-enhancements' ),
		'pasteMenuFailed'               => __( 'Paste failed: could not reach Paste', 'daveden-builderius-enhancements' ),
		'pasteNoRows'                   => __( 'Paste at top level needs at least one element in the tree', 'daveden-builderius-enhancements' ),

		// Right-click menu.
		'expandChildren'                => __( 'Expand children', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of selected elements. */
		'deleteNElements'               => __( 'Delete %s elements', 'daveden-builderius-enhancements' ),
		'unwrap'                        => __( 'Unwrap', 'daveden-builderius-enhancements' ),
		'moveUp'                        => __( 'Move up', 'daveden-builderius-enhancements' ),
		'moveDown'                      => __( 'Move down', 'daveden-builderius-enhancements' ),
		'moveIn'                        => __( 'Move in one level', 'daveden-builderius-enhancements' ),
		'moveOut'                       => __( 'Move out one level', 'daveden-builderius-enhancements' ),
		'selectParent'                  => __( 'Select parent', 'daveden-builderius-enhancements' ),
		'wrapIn'                        => __( 'Wrap in', 'daveden-builderius-enhancements' ),
		'wrapInEllipsis'                => __( 'Wrap in…', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of selected elements. */
		'wrapNIn'                       => __( 'Wrap %s in', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of selected elements. */
		'wrapNInEllipsis'               => __( 'Wrap %s in…', 'daveden-builderius-enhancements' ),
		/* translators: 1: "Wrap in" or "Wrap N in", 2: wrapper type label. */
		'wrapItemLabel'                 => __( '%1$s %2$s', 'daveden-builderius-enhancements' ),
		'divLabel'                      => __( 'Div', 'daveden-builderius-enhancements' ),
		'figureLabel'                   => __( 'Figure', 'daveden-builderius-enhancements' ),
		'templateLabel'                 => __( 'Template', 'daveden-builderius-enhancements' ),
		'collectionTemplateLabel'       => __( 'Collection + template', 'daveden-builderius-enhancements' ),
		'onlySiblingsWrapped'           => __( 'Only sibling elements can be wrapped together', 'daveden-builderius-enhancements' ),
		'saveTo'                        => __( 'Save to…', 'daveden-builderius-enhancements' ),
		'insertActions'                 => __( 'Insert…', 'daveden-builderius-enhancements' ),
		'moveNavigate'                  => __( 'Move and navigate…', 'daveden-builderius-enhancements' ),
		'moreElementTools'              => __( 'More element tools…', 'daveden-builderius-enhancements' ),

		// Navigator header buttons.
		'collapseSubtrees'              => __( 'Collapse subtrees', 'daveden-builderius-enhancements' ),
		'collapseSubtreesTip'           => __( 'Collapse subtrees (keeps top-level elements open)', 'daveden-builderius-enhancements' ),
		'expandAll'                     => __( 'Expand all', 'daveden-builderius-enhancements' ),
		'expandAllElements'             => __( 'Expand all elements', 'daveden-builderius-enhancements' ),
		'detachPanel'                   => __( 'Detach panel', 'daveden-builderius-enhancements' ),
		'dockPanel'                     => __( 'Dock panel', 'daveden-builderius-enhancements' ),
		'resizePanel'                   => __( 'Resize panel', 'daveden-builderius-enhancements' ),
		'dragToMove'                    => __( 'Drag to move', 'daveden-builderius-enhancements' ),

		// Icon tooltips.
		'tipDynamicConditions'          => __( 'Dynamic data conditions', 'daveden-builderius-enhancements' ),
		'tipToggleCssEditor'            => __( 'Enable CSS code editor', 'daveden-builderius-enhancements' ),
		'tipBuilderiusMenu'             => __( 'Builderius menu', 'daveden-builderius-enhancements' ),
		'tipBreakpointSettings'         => __( 'Breakpoint settings', 'daveden-builderius-enhancements' ),
		'tipReloadPreview'              => __( 'Reload preview', 'daveden-builderius-enhancements' ),
		'tipSaveOptions'                => __( 'Save options', 'daveden-builderius-enhancements' ),
		'tipDeleteSelected'             => __( 'Delete selected element (click twice to confirm)', 'daveden-builderius-enhancements' ),
		'tipEditFavourites'             => __( 'Edit favourite elements', 'daveden-builderius-enhancements' ),
		/* translators: %s: favourite element name. */
		'tipRemoveFavourite'            => __( 'Remove %s from favourites', 'daveden-builderius-enhancements' ),
		'tipRemoveFavouriteFallback'    => __( 'Remove from favourites', 'daveden-builderius-enhancements' ),
		'tipCollapseBottomPanel'        => __( 'Collapse bottom panel', 'daveden-builderius-enhancements' ),
		'tipAddBreakpoint'              => __( 'Add breakpoint', 'daveden-builderius-enhancements' ),
		'tipDeleteBreakpoint'           => __( 'Delete breakpoint', 'daveden-builderius-enhancements' ),
		'tipInsertDynamicData'          => __( 'Insert dynamic data', 'daveden-builderius-enhancements' ),
		'tipCanvasWidth'                => __( 'Canvas width in pixels', 'daveden-builderius-enhancements' ),
		'tipCanvasZoom'                 => __( 'Canvas zoom, percent', 'daveden-builderius-enhancements' ),
		/* translators: %s: target label. */
		'tipItemActions'                => __( 'Actions for %s', 'daveden-builderius-enhancements' ),
		'tipItemActionsFallback'        => __( 'Item actions', 'daveden-builderius-enhancements' ),
		/* translators: 1: breakpoint label, 2: maximum width in pixels. */
		'bpMax'                         => __( '%1$s (max %2$spx)', 'daveden-builderius-enhancements' ),
		/* translators: %s: breakpoint label. */
		'bpBase'                        => __( '%s (base styles, full width)', 'daveden-builderius-enhancements' ),
		'breakpoint'                    => __( 'Breakpoint', 'daveden-builderius-enhancements' ),
		'bpFallbackBase'                => __( 'Base styles (full width)', 'daveden-builderius-enhancements' ),
		'bpFallbackDesktop'             => __( 'Desktop (max 1279px)', 'daveden-builderius-enhancements' ),
		'bpFallbackTablet'              => __( 'Tablet (max 991px)', 'daveden-builderius-enhancements' ),
		'bpFallbackMobile'              => __( 'Mobile (max 478px)', 'daveden-builderius-enhancements' ),
		'collapseAll'                   => __( 'Collapse all', 'daveden-builderius-enhancements' ),
		'collapseAllGroups'             => __( 'Collapse all groups', 'daveden-builderius-enhancements' ),
		'expandAllGroups'               => __( 'Expand all groups', 'daveden-builderius-enhancements' ),
		'closePanel'                    => __( 'Close panel', 'daveden-builderius-enhancements' ),
		'showSidePanels'                => __( 'Show side panels', 'daveden-builderius-enhancements' ),
		'hideSidePanels'                => __( 'Hide side panels (full-width canvas)', 'daveden-builderius-enhancements' ),
		'showSettingsPanel'             => __( 'Show settings panel', 'daveden-builderius-enhancements' ),
		'hideSettingsPanel'             => __( 'Hide settings panel', 'daveden-builderius-enhancements' ),
		'showNavigatorPanel'            => __( 'Show Navigator panel', 'daveden-builderius-enhancements' ),
		'hideNavigatorPanel'            => __( 'Hide Navigator panel', 'daveden-builderius-enhancements' ),
		'sidePanelsShown'               => __( 'Side panels shown', 'daveden-builderius-enhancements' ),
		'sidePanelsHidden'              => __( 'Side panels hidden', 'daveden-builderius-enhancements' ),
		'previewNewTab'                 => __( 'Preview page in a new tab', 'daveden-builderius-enhancements' ),

		// Styles panel.
		'contentTab'                    => __( 'Content', 'daveden-builderius-enhancements' ),
		'stylesTab'                     => __( 'Styles', 'daveden-builderius-enhancements' ),
		// CSS selector hint (css_hint_dialog). Tokens are separate DOM code nodes.
		/* translators: %local% and %selector% are literal Builderius CSS scope tokens. */
		'cssHintBanner'                 => __( 'How %local%, %selector% & breakpoints work', 'daveden-builderius-enhancements' ),
		'cssHintOpen'                   => __( 'Selector and breakpoint help', 'daveden-builderius-enhancements' ),
		'cssHintDismiss'                => __( 'Dismiss hint', 'daveden-builderius-enhancements' ),
		'cssHintClose'                  => __( 'Close', 'daveden-builderius-enhancements' ),
		'cssHintTitle'                  => __( 'Selector tokens & breakpoints', 'daveden-builderius-enhancements' ),
		'cssHintLocalLead'              => __( 'Targets this element only, through its automatic class. Use ', 'daveden-builderius-enhancements' ),
		'cssHintLocalTail'              => __( ' to target it by ID instead.', 'daveden-builderius-enhancements' ),
		'cssHintSelector'               => __( 'Targets every element that uses the current class.', 'daveden-builderius-enhancements' ),
		'cssHintBreakpointsTerm'        => __( 'Breakpoints', 'daveden-builderius-enhancements' ),
		'cssHintBreakpointsLead'        => __( 'Switch breakpoint in the top bar to write CSS for a specific screen size. Inside a rule you can also use ', 'daveden-builderius-enhancements' ),
		'cssHintBreakpointsTail'        => __( ' as breakpoint-variable values.', 'daveden-builderius-enhancements' ),
		'or'                            => __( 'or', 'daveden-builderius-enhancements' ),
		'switchingScope'                => __( 'Switching scope…', 'daveden-builderius-enhancements' ),
		'scopeBadgeTip'                 => __( 'Choose where edits are saved. If these rules live in the other scope, the editor is protected until you switch scope or add rules here.', 'daveden-builderius-enhancements' ),
		'cssScope'                      => __( 'CSS scope', 'daveden-builderius-enhancements' ),
		'scopeAllCss'                   => __( 'All CSS', 'daveden-builderius-enhancements' ),
		'scopeAllCssTip'                => __( 'Show the full CSS for the active scope and jump to this selector', 'daveden-builderius-enhancements' ),
		'scopeGlobal'                   => __( 'Global', 'daveden-builderius-enhancements' ),
		'scopeTemplate'                 => __( 'Template', 'daveden-builderius-enhancements' ),
		'scopeComponent'                => __( 'Component', 'daveden-builderius-enhancements' ),
		'scopeLocal'                    => __( 'Local', 'daveden-builderius-enhancements' ),
		/* translators: %s: scope name (Global, Template or Component). Precedes the class name. */
		'scopeEditing'                  => __( 'Editing %s rules', 'daveden-builderius-enhancements' ),
		/* translators: %s: scope name. Precedes the class name. */
		'scopeNewRule'                  => __( 'New %s rule', 'daveden-builderius-enhancements' ),
		/* translators: %s: scope name. Precedes the class name. */
		'scopeNoRules'                  => __( 'No %s rules', 'daveden-builderius-enhancements' ),
		/* translators: %s: the other scope's name. Follows the class name. */
		'scopeAlsoIn'                   => __( '· also in %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: the scope that stores the rules. Follows the class name in the warning. */
		'scopeRulesIn'                  => __( '· rules in %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: active scope name (Global, Template or Component). Button that seeds an empty rule so the class becomes editable in the active scope. */
		'scopeAddHere'                  => __( 'Add %s rules', 'daveden-builderius-enhancements' ),
		/* translators: %s: the scope that owns the rules. Editor-cover note explaining why editing is off. */
		'scopeCoverWhy'                 => __( 'Editing here would change %s rules', 'daveden-builderius-enhancements' ),
		/* Status verb for the %local% one-off, which belongs to no class and no scope. */
		'scopeLocalEditing'             => __( 'Editing element styles', 'daveden-builderius-enhancements' ),
		/* translators: %s: scope name (Global, Template or Component). */
		'switchTo'                      => __( 'Switch to %s', 'daveden-builderius-enhancements' ),

		// Theme & density buttons.
		/* translators: 1: current theme, 2: next theme. */
		'themeTip'                      => __( 'Theme: %1$s (switch to %2$s)', 'daveden-builderius-enhancements' ),
		'themeLight'                    => __( 'light', 'daveden-builderius-enhancements' ),
		'themeDark'                     => __( 'dark', 'daveden-builderius-enhancements' ),
		'themeAuto'                     => __( 'auto', 'daveden-builderius-enhancements' ),
		/* translators: %s: the theme just switched to (light / dark / auto). Announced to screen readers. */
		'themeAnnounce'                 => __( 'Theme set to %s', 'daveden-builderius-enhancements' ),
		/* translators: 1: current density, 2: next density. */
		'densityTip'                    => __( 'Density: %1$s (switch to %2$s)', 'daveden-builderius-enhancements' ),
		'densityComfortable'            => __( 'comfortable', 'daveden-builderius-enhancements' ),
		'densityCompact'                => __( 'compact', 'daveden-builderius-enhancements' ),
		/* translators: %s: the density just switched to (comfortable / compact). Announced to screen readers. */
		'densityAnnounce'               => __( 'Density set to %s', 'daveden-builderius-enhancements' ),
		'toolbarBreakpoints'            => __( 'Breakpoints', 'daveden-builderius-enhancements' ),
		'groupCanvasSize'               => __( 'Canvas size', 'daveden-builderius-enhancements' ),
		'toolbarFooterTools'            => __( 'Editor tools', 'daveden-builderius-enhancements' ),
		/* translators: %s: the unavailable tool name (e.g. Custom CSS). */
		'footerComingSoon'              => __( '%s (coming soon)', 'daveden-builderius-enhancements' ),
		/* translators: %s: a short description of an unavailable tool. */
		'footerComingSoonTip'           => __( 'Coming soon: %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: the name of the open tool (e.g. Dynamic Data). Names the editor panel region. */
		'footerPanelNamed'              => __( '%s panel', 'daveden-builderius-enhancements' ),
		'footerToolsPanel'              => __( 'Editor tools panel', 'daveden-builderius-enhancements' ),
		'footerScopeTabs'               => __( 'Scope', 'daveden-builderius-enhancements' ),
		'builderiusMenu'                => __( 'Builderius menu', 'daveden-builderius-enhancements' ),
		'comboboxFilter'                => __( 'Filter options', 'daveden-builderius-enhancements' ),
		'comboboxListbox'               => __( 'Options', 'daveden-builderius-enhancements' ),
		/* translators: %s: the unavailable Inserter element name (e.g. Lottie). */
		'inserterComingSoon'            => __( '%s (coming soon)', 'daveden-builderius-enhancements' ),
		/* translators: %s: the currently selected value. Names the select trigger for screen readers. */
		'comboboxTrigger'               => __( 'Selection: %s', 'daveden-builderius-enhancements' ),
		'terminalTablist'               => __( 'AI chat sessions', 'daveden-builderius-enhancements' ),
		'terminalNewTab'                => __( 'New chat session', 'daveden-builderius-enhancements' ),
		'terminalAgentMenu'             => __( 'Choose an agent', 'daveden-builderius-enhancements' ),
		'terminalEscapeHint'            => __( 'Press Control and the grave accent key to move focus out of the terminal', 'daveden-builderius-enhancements' ),

		// Navigator search.
		'filterElements'                => __( 'Filter elements…', 'daveden-builderius-enhancements' ),
		'filterElementsAria'            => __( 'Filter elements by label or tag', 'daveden-builderius-enhancements' ),
		/* translators: %s: Navigator view name, such as Elements or CSS vars. */
		'navigatorViewTab'              => __( 'Show %s in Navigator', 'daveden-builderius-enhancements' ),
		'canvasDocumentTabs'            => __( 'Open templates and components', 'daveden-builderius-enhancements' ),
		'openCanvasDocument'            => __( 'Open a template or component', 'daveden-builderius-enhancements' ),

		// Navigator keyboard tree.
		'elementsTree'                  => __( 'Elements', 'daveden-builderius-enhancements' ),
		'scTreeMove'                    => __( 'Move to the previous or next element and select it', 'daveden-builderius-enhancements' ),
		'scTreeExpand'                  => __( 'Open a branch, then step into its first child', 'daveden-builderius-enhancements' ),
		'scTreeCollapse'                => __( 'Close a branch, then step out to the parent', 'daveden-builderius-enhancements' ),
		'scTreeFirstLast'               => __( 'First / last element', 'daveden-builderius-enhancements' ),
		'scReorder'                     => __( 'Move the element among its siblings', 'daveden-builderius-enhancements' ),
		'scMoveIn'                      => __( 'Move the element into its previous sibling', 'daveden-builderius-enhancements' ),
		'scMoveOut'                     => __( 'Move the element out one level', 'daveden-builderius-enhancements' ),

		// Screen-reader landmarks (chrome_landmarks).
		'regionTopBar'                  => __( 'Top toolbar', 'daveden-builderius-enhancements' ),
		'regionInserter'                => __( 'Element library', 'daveden-builderius-enhancements' ),
		'regionSettings'                => __( 'Element settings', 'daveden-builderius-enhancements' ),
		'regionCanvas'                  => __( 'Canvas', 'daveden-builderius-enhancements' ),
		'canvasPreview'                 => __( 'Canvas preview', 'daveden-builderius-enhancements' ),
		'regionNavigator'               => __( 'Navigator', 'daveden-builderius-enhancements' ),
		'regionFooter'                  => __( 'Footer bar', 'daveden-builderius-enhancements' ),
		'compactView'                   => __( 'Builder view', 'daveden-builderius-enhancements' ),
		/* translators: %s: compact builder view name, such as Canvas or Navigator. */
		'compactViewChanged'            => __( '%s view shown', 'daveden-builderius-enhancements' ),
		'compactSelectElement'          => __( 'Select an element before opening Element settings', 'daveden-builderius-enhancements' ),

		// Save cue.
		'saveClean'                     => __( 'All changes saved', 'daveden-builderius-enhancements' ),
		'saveCleanShort'                => __( 'Saved', 'daveden-builderius-enhancements' ),
		'unsaved'                       => __( 'Unsaved changes', 'daveden-builderius-enhancements' ),
		'unsavedShort'                  => __( 'Unsaved', 'daveden-builderius-enhancements' ),
		'saving'                        => __( 'Saving…', 'daveden-builderius-enhancements' ),
		'saved'                         => __( 'Changes saved', 'daveden-builderius-enhancements' ),
		'saveFailed'                    => __( 'Save failed. Your changes are still unsaved. Try again.', 'daveden-builderius-enhancements' ),
		'saveFailedShort'               => __( 'Save failed', 'daveden-builderius-enhancements' ),

		// Save shortcut.
		'scSave'                        => __( 'Save the template', 'daveden-builderius-enhancements' ),

		// Class-chip menu.
		/* translators: %s: target label. */
		'chipMenuFor'                   => __( 'Actions for %s', 'daveden-builderius-enhancements' ),

		// Keyboard shortcuts overlay.
		'keyboardShortcuts'             => __( 'Keyboard shortcuts', 'daveden-builderius-enhancements' ),
		'scGroupGeneral'                => __( 'General', 'daveden-builderius-enhancements' ),
		'scGroupNavigator'              => __( 'Navigator', 'daveden-builderius-enhancements' ),
		'scGroupCanvas'                 => __( 'Canvas', 'daveden-builderius-enhancements' ),
		'scGroupSenseAi'                => __( 'Sense AI', 'daveden-builderius-enhancements' ),
		'scGroupContextMenu'            => __( 'Context menu', 'daveden-builderius-enhancements' ),
		'scOpenOverlay'                 => __( 'Open keyboard shortcuts', 'daveden-builderius-enhancements' ),
		'scEscape'                      => __( 'Close menus and dialogs; clear the multi-selection', 'daveden-builderius-enhancements' ),
		'scEscapeClose'                 => __( 'Close menus and dialogs', 'daveden-builderius-enhancements' ),
		'scDelete'                      => __( 'Remove the selected element (Builderius)', 'daveden-builderius-enhancements' ),
		'scCopyPaste'                   => __( 'Copy / paste the selected element (Builderius)', 'daveden-builderius-enhancements' ),
		'scUndo'                        => __( 'Undo the last element change', 'daveden-builderius-enhancements' ),
		'scRedo'                        => __( 'Redo the element change', 'daveden-builderius-enhancements' ),
		'scMultiToggle'                 => __( 'Add or remove a row from the multi-selection', 'daveden-builderius-enhancements' ),
		'scRange'                       => __( 'Select a range of rows', 'daveden-builderius-enhancements' ),
		'scCtxOpen'                     => __( 'Open the context menu on the focused row', 'daveden-builderius-enhancements' ),
		'scFinishCanvasText'            => __( 'Finish editing text in the canvas', 'daveden-builderius-enhancements' ),
		'scCanvasMove'                  => __( 'Move between visible elements', 'daveden-builderius-enhancements' ),
		'scCanvasChild'                 => __( 'Open a branch, then select its first child', 'daveden-builderius-enhancements' ),
		'scCanvasParent'                => __( 'Close a branch, then select its parent', 'daveden-builderius-enhancements' ),
		'scCanvasFirstLast'             => __( 'First / last visible element', 'daveden-builderius-enhancements' ),
		'scEnterInteractive'            => __( 'Edit selected text; otherwise interact with the page', 'daveden-builderius-enhancements' ),
		'scExitInteractive'             => __( 'Return to selecting elements', 'daveden-builderius-enhancements' ),
		'scExitTerminal'                => __( 'Move focus out of the terminal', 'daveden-builderius-enhancements' ),
		'scMove'                        => __( 'Move between items (wraps)', 'daveden-builderius-enhancements' ),
		'scFirstLast'                   => __( 'First / last item', 'daveden-builderius-enhancements' ),
		'scActivate'                    => __( 'Activate an item or open its submenu', 'daveden-builderius-enhancements' ),
		'scSubmenu'                     => __( 'Open / close a submenu', 'daveden-builderius-enhancements' ),

		// Preview resize.
		'resizePreviewLeft'             => __( 'Resize canvas from left edge', 'daveden-builderius-enhancements' ),
		'resizePreviewRight'            => __( 'Resize canvas from right edge', 'daveden-builderius-enhancements' ),
		'resizePanelLeft'               => __( 'Resize left panel', 'daveden-builderius-enhancements' ),
		'resizePanelRight'              => __( 'Resize right panel', 'daveden-builderius-enhancements' ),
		/* translators: %s: width in pixels. */
		'pixelsWide'                    => __( '%s pixels wide', 'daveden-builderius-enhancements' ),

		// Favourites & component properties.
		'rearrangeFavourites'           => __( 'Rearrange favourites', 'daveden-builderius-enhancements' ),
		'favouriteElements'             => __( 'Favourite elements', 'daveden-builderius-enhancements' ),
		/* translators: %s: favourite element name. */
		'insertFavourite'               => __( 'Insert %s', 'daveden-builderius-enhancements' ),
		'rearrangeProperties'           => __( 'Rearrange properties', 'daveden-builderius-enhancements' ),
		'rearrange'                     => __( 'Rearrange', 'daveden-builderius-enhancements' ),
		/* translators: %s: favourite element name. */
		'favArrowHint'                  => __( '%s (press up or down arrow to move, Escape to finish)', 'daveden-builderius-enhancements' ),
		'favModeOn'                     => __( 'Rearrange mode on: drag the icons, or focus one and use the arrow keys', 'daveden-builderius-enhancements' ),
		'propModeOn'                    => __( 'Rearrange mode on: drag a property, or focus one and use the arrow keys', 'daveden-builderius-enhancements' ),
		'modeOffSaved'                  => __( 'Rearrange mode off: order saved', 'daveden-builderius-enhancements' ),
		/* translators: 1: item name, 2: new position, 3: total items. */
		'movedToPosition'               => __( 'Moved %1$s to position %2$s of %3$s', 'daveden-builderius-enhancements' ),
		'propSaveFailed'                => __( 'Order changed on screen, but it could not be saved to the component', 'daveden-builderius-enhancements' ),
		'property'                      => __( 'Property', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements moved. */
		'movedTogether'                 => __( 'Moved %s elements together', 'daveden-builderius-enhancements' ),
		/* translators: 1: number of elements moved, 2: number that failed. */
		'movedSomeFailedOne'            => __( 'Moved %1$s element (%2$s could not follow)', 'daveden-builderius-enhancements' ),
		/* translators: 1: number of elements moved, 2: number that failed. */
		'movedSomeFailedMany'           => __( 'Moved %1$s elements (%2$s could not follow)', 'daveden-builderius-enhancements' ),

		// Class-chip menu.
		/* translators: %s: class name. */
		'copyName'                      => __( 'Copy %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: class name without the leading dot. */
		'copyNoDot'                     => __( 'Copy %s (no dot)', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of classes. */
		'copyAllClasses'                => __( 'Copy all classes (%s)', 'daveden-builderius-enhancements' ),
		/* translators: %s: class name. */
		'removeFromElement'             => __( 'Remove %s from element', 'daveden-builderius-enhancements' ),
		/* translators: %s: the copied text. */
		'copied'                        => __( 'Copied %s', 'daveden-builderius-enhancements' ),
		'copyFailed'                    => __( 'Copy failed: clipboard unavailable', 'daveden-builderius-enhancements' ),
		/* translators: %s: class name. */
		'removedName'                   => __( 'Removed %s', 'daveden-builderius-enhancements' ),

		// Element keyboard shortcuts + quick element picker.
		'cut'                           => __( 'Cut', 'daveden-builderius-enhancements' ),
		'addBefore'                     => __( 'Add element before', 'daveden-builderius-enhancements' ),
		'addAfter'                      => __( 'Add element after', 'daveden-builderius-enhancements' ),
		'pickBeforeTitle'               => __( 'Add element before', 'daveden-builderius-enhancements' ),
		'pickAfterTitle'                => __( 'Add element after', 'daveden-builderius-enhancements' ),
		'pickFilter'                    => __( 'Filter elements…', 'daveden-builderius-enhancements' ),
		'pickNoMatch'                   => __( 'No matching element', 'daveden-builderius-enhancements' ),
		'duplicated'                    => __( 'Duplicated element', 'daveden-builderius-enhancements' ),
		'cutDone'                       => __( 'Cut element', 'daveden-builderius-enhancements' ),
		/* translators: %s: element/tag name just inserted. */
		'addedElement'                  => __( 'Added %s', 'daveden-builderius-enhancements' ),
		'noElementSelected'             => __( 'Select an element first', 'daveden-builderius-enhancements' ),
		// Display-condition helpers.
		'condRemove'                    => __( 'Remove condition', 'daveden-builderius-enhancements' ),
		'condOperator'                  => __( 'Comparison', 'daveden-builderius-enhancements' ),
		'condValue'                     => __( 'Value', 'daveden-builderius-enhancements' ),
		'condFreeInput'                 => __( 'Type a custom value', 'daveden-builderius-enhancements' ),
		'condPickValues'                => __( 'Values', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of display conditions. */
		'condIconCount'                 => __( 'Dynamic data conditions (%s set)', 'daveden-builderius-enhancements' ),
		'condTreeSuffix'                => __( 'Has display conditions', 'daveden-builderius-enhancements' ),
		// Navigator row quick actions.
		/* translators: %s: element label. */
		'rowActionDuplicate'            => __( 'Duplicate “%s”', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'rowActionDelete'               => __( 'Delete “%s”', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'rowActionDeleteConfirm'        => __( 'Confirm delete “%s”', 'daveden-builderius-enhancements' ),
		'rowActionDeleteArmed'          => __( 'Press again to confirm', 'daveden-builderius-enhancements' ),
		// Shortcuts overlay — Elements group.
		'scGroupElements'               => __( 'Selected element', 'daveden-builderius-enhancements' ),
		'scDuplicate'                   => __( 'Duplicate', 'daveden-builderius-enhancements' ),
		'scCut'                         => __( 'Cut', 'daveden-builderius-enhancements' ),
		'scAddBefore'                   => __( 'Add an element before', 'daveden-builderius-enhancements' ),
		'scAddAfter'                    => __( 'Add an element after', 'daveden-builderius-enhancements' ),
		'scRename'                      => __( 'Rename', 'daveden-builderius-enhancements' ),
		'scCopyPasteDelete'             => __( 'Copy / paste / delete the element (Builderius)', 'daveden-builderius-enhancements' ),
		// Shortcuts overlay — Move to area group.
		'scGroupAreas'                  => __( 'Move focus to', 'daveden-builderius-enhancements' ),
		'scGotoNavigator'               => __( 'Navigator', 'daveden-builderius-enhancements' ),
		'scGotoSettings'                => __( 'Element settings', 'daveden-builderius-enhancements' ),
		'scGotoCanvas'                  => __( 'Canvas', 'daveden-builderius-enhancements' ),
		'scGotoInserter'                => __( 'Element library', 'daveden-builderius-enhancements' ),
		'scGotoFooter'                  => __( 'Footer bar', 'daveden-builderius-enhancements' ),

		// Command palette.
		'commandPalette'                => __( 'Command palette', 'daveden-builderius-enhancements' ),
		/* translators: %s: the palette's keyboard shortcut, e.g. Ctrl+K. */
		'paletteTip'                    => __( 'Command palette (%s)', 'daveden-builderius-enhancements' ),
		'searchCommandsLabel'           => __( 'Search commands', 'daveden-builderius-enhancements' ),
		'searchCommands'                => __( 'Search commands…', 'daveden-builderius-enhancements' ),
		'paletteNoEl'                   => __( 'No element selected — element commands are hidden', 'daveden-builderius-enhancements' ),
		'paletteAddClass'               => __( 'Add classes', 'daveden-builderius-enhancements' ),
		'paletteAddAttr'                => __( 'Add attributes', 'daveden-builderius-enhancements' ),
		'paletteAddEmmet'               => __( 'Add elements (Emmet)', 'daveden-builderius-enhancements' ),
		'paletteDuplicate'              => __( 'Duplicate', 'daveden-builderius-enhancements' ),
		'paletteCopy'                   => __( 'Copy', 'daveden-builderius-enhancements' ),
		'paletteCut'                    => __( 'Cut', 'daveden-builderius-enhancements' ),
		'paletteDelete'                 => __( 'Delete', 'daveden-builderius-enhancements' ),
		'paletteWrapDiv'                => __( 'Wrap in div', 'daveden-builderius-enhancements' ),
		'paletteWrapFigure'             => __( 'Wrap in figure', 'daveden-builderius-enhancements' ),
		'paletteWrapTemplate'           => __( 'Wrap in template', 'daveden-builderius-enhancements' ),
		'paletteWrapCollection'         => __( 'Wrap in collection', 'daveden-builderius-enhancements' ),
		// Command-palette group dividers.
		'paletteGroupAdd'               => __( 'Add to element', 'daveden-builderius-enhancements' ),
		'paletteGroupStructure'         => __( 'Structure', 'daveden-builderius-enhancements' ),
		'paletteGroupElement'           => __( 'Element', 'daveden-builderius-enhancements' ),
		'paletteGroupWorkspace'         => __( 'Workspace', 'daveden-builderius-enhancements' ),
		'paletteGroupAdmin'             => __( 'WordPress and Builderius', 'daveden-builderius-enhancements' ),
		'paletteGroupGoto'              => __( 'Go to', 'daveden-builderius-enhancements' ),
		'commandUnavailable'            => __( 'That command is not available here', 'daveden-builderius-enhancements' ),
		'paletteNoMatch'                => __( 'No matching commands', 'daveden-builderius-enhancements' ),
		'paletteEnterClass'             => __( 'Enter at least one class', 'daveden-builderius-enhancements' ),
		'paletteEnterAttribute'         => __( 'Enter an attribute name', 'daveden-builderius-enhancements' ),
		'paletteEnterElement'           => __( 'Enter an element abbreviation', 'daveden-builderius-enhancements' ),
		'paletteEnterName'              => __( 'Enter a new name', 'daveden-builderius-enhancements' ),
		'paletteEnterTag'               => __( 'Enter a new HTML tag', 'daveden-builderius-enhancements' ),
		'paletteEnterValue'             => __( 'Enter a value', 'daveden-builderius-enhancements' ),
		'paletteGroupStyles'            => __( 'Styles', 'daveden-builderius-enhancements' ),
		'openWpDashboard'               => __( 'Open WordPress dashboard', 'daveden-builderius-enhancements' ),
		'openBuilderiusReleases'        => __( 'Open Builderius releases', 'daveden-builderius-enhancements' ),
		'openBuilderiusSettings'        => __( 'Open Builderius settings', 'daveden-builderius-enhancements' ),
		// Shortcut hint for the native delete (kept short for the right-aligned label).
		'accelDelete'                   => __( 'Del', 'daveden-builderius-enhancements' ),
		'goToNavigator'                 => __( 'Go to Navigator', 'daveden-builderius-enhancements' ),
		'goToSettings'                  => __( 'Go to Element settings', 'daveden-builderius-enhancements' ),
		'goToCanvas'                    => __( 'Go to canvas', 'daveden-builderius-enhancements' ),
		'goToFooter'                    => __( 'Go to footer bar', 'daveden-builderius-enhancements' ),
		'enterInteractiveCanvas'        => __( 'Interact with page', 'daveden-builderius-enhancements' ),
		'exitInteractiveCanvas'         => __( 'Select elements', 'daveden-builderius-enhancements' ),
		'canvasInteractiveOn'           => __( 'Interacting with page. Press Escape to select elements.', 'daveden-builderius-enhancements' ),
		'canvasSelectionOn'             => __( 'Selecting elements.', 'daveden-builderius-enhancements' ),
		'canvasTextEditing'             => __( 'Editing text', 'daveden-builderius-enhancements' ),
		'canvasTextEditingAnnounce'     => __( 'Editing text. Press Escape to finish.', 'daveden-builderius-enhancements' ),
		'canvasFinishHint'              => __( 'Esc to finish', 'daveden-builderius-enhancements' ),
		'canvasTextFinished'            => __( 'Finished editing text', 'daveden-builderius-enhancements' ),
		/* translators: 1: Navigator label, 2: rendered HTML tag. */
		'previewContextTarget'          => __( '%1$s · <%2$s>', 'daveden-builderius-enhancements' ),
		'previewContextFailed'          => __( 'Could not open the element menu', 'daveden-builderius-enhancements' ),
		'previewContextSelectFailed'    => __( 'Could not select the preview element', 'daveden-builderius-enhancements' ),
		'previewRenameTitle'            => __( 'Rename Navigator name', 'daveden-builderius-enhancements' ),
		'previewRenameHint'             => __( 'Changes the name shown in the Navigator. This does not change the element’s visible text or HTML tag.', 'daveden-builderius-enhancements' ),
		'previewRenameLabel'            => __( 'Navigator name', 'daveden-builderius-enhancements' ),
		'previewRenameSave'             => __( 'Save name', 'daveden-builderius-enhancements' ),
		'previewRenameEmpty'            => __( 'Enter a Navigator name.', 'daveden-builderius-enhancements' ),
		'previewRenameTooLong'          => __( 'Use 120 characters or fewer.', 'daveden-builderius-enhancements' ),
		/* translators: %s: the new Navigator name. */
		'previewRenameSuccess'          => __( 'Renamed element to %s', 'daveden-builderius-enhancements' ),
		'previewRenameFailed'           => __( 'Could not rename the preview element', 'daveden-builderius-enhancements' ),
		'editText'                      => __( 'Edit text', 'daveden-builderius-enhancements' ),
		'cannotEditText'                => __( 'Select an element with editable text', 'daveden-builderius-enhancements' ),
		/* translators: %s: selected element label. */
		'canvasSelected'                => __( 'Selected %s', 'daveden-builderius-enhancements' ),
		'selectionContext'              => __( 'Selected', 'daveden-builderius-enhancements' ),
		/* translators: %s: selected element hierarchy, for example Hero > Content > Heading. */
		'selectionContextLabel'         => __( 'Selected element: %s', 'daveden-builderius-enhancements' ),
		'treeNoMatches'                 => __( 'No matching elements', 'daveden-builderius-enhancements' ),
		/* translators: 1: number of matching elements, 2: total number of elements. */
		'treeMatchesOne'                => __( '%1$s of %2$s element matches', 'daveden-builderius-enhancements' ),
		/* translators: 1: number of matching elements, 2: total number of elements. */
		'treeMatchesMany'               => __( '%1$s of %2$s elements match', 'daveden-builderius-enhancements' ),
		'openInserterCmd'               => __( 'Open Element library', 'daveden-builderius-enhancements' ),
		'copiedElement'                 => __( 'Copied element', 'daveden-builderius-enhancements' ),
		'deletedElement'                => __( 'Deleted element', 'daveden-builderius-enhancements' ),
		'phClass'                       => __( 'class1 class2  (or .a.b)', 'daveden-builderius-enhancements' ),
		'phAttr'                        => __( 'name=value; name2=value2', 'daveden-builderius-enhancements' ),
		/* translators: %s: attribute name. */
		'addedAttribute'                => __( 'Added attribute %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of attributes added. */
		'addedAttributesMany'           => __( 'Added %s attributes', 'daveden-builderius-enhancements' ),
		'attrNoPanel'                   => __( 'Open the element settings to add an attribute', 'daveden-builderius-enhancements' ),
		/* translators: %s: the text that could not be parsed. */
		'emmetInvalid'                  => __( 'Could not parse: %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements added. */
		'emmetAddedOne'                 => __( 'Added %s element', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements added. */
		'emmetAddedMany'                => __( 'Added %s elements', 'daveden-builderius-enhancements' ),
		// Shortcuts overlay — command palette.
		'scGroupPalette'                => __( 'Command palette', 'daveden-builderius-enhancements' ),
		'scOpenPalette'                 => __( 'Open the command palette (add classes / attributes / elements)', 'daveden-builderius-enhancements' ),
		// Edit as HTML.
		'editAsHtml'                    => __( 'Edit as HTML', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'editAsHtmlTitle'               => __( 'Edit as HTML — %s', 'daveden-builderius-enhancements' ),
		'editAsHtmlHint'                => __( 'Keep an element’s data-dbe-id to preserve its settings. Components use <dbe-component>; unsupported modules use <dbe-keep>. Review what will be updated, added, removed or sanitised before applying.', 'daveden-builderius-enhancements' ),
		'editAsHtmlEditor'              => __( 'HTML markup', 'daveden-builderius-enhancements' ),
		'existingBuilderiusClass'       => __( 'Existing Builderius class', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements using a class. */
		'htmlClassUsedCount'            => __( 'used on %s element(s)', 'daveden-builderius-enhancements' ),
		'htmlClassCurrentMarkup'        => __( 'present in this markup', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of authored CSS rules for a class. */
		'htmlClassRuleCount'            => __( '%s authored rule(s)', 'daveden-builderius-enhancements' ),
		'htmlCompletionComponent'       => __( 'Builderius component instance', 'daveden-builderius-enhancements' ),
		'htmlCompletionComponentHelp'   => __( 'Choose a registered component slug and add its declared properties as attributes.', 'daveden-builderius-enhancements' ),
		'htmlCompletionKeep'            => __( 'Preserved unsupported Builderius module', 'daveden-builderius-enhancements' ),
		'htmlCompletionKeepHelp'        => __( 'Keeps an existing unsupported module unchanged during the HTML round trip.', 'daveden-builderius-enhancements' ),
		'htmlCompletionWpData'          => __( 'Builderius wp data variable', 'daveden-builderius-enhancements' ),
		'htmlCompletionPropData'        => __( 'Builderius component property', 'daveden-builderius-enhancements' ),
		'htmlCompletionCollectionData'  => __( 'Collection item field', 'daveden-builderius-enhancements' ),
		'htmlCompletionLabel'           => __( 'Builderius Navigator label', 'daveden-builderius-enhancements' ),
		'htmlCompletionContext'         => __( 'Collection data source (static JSON)', 'daveden-builderius-enhancements' ),
		'htmlCompletionModule'          => __( 'Builderius module type', 'daveden-builderius-enhancements' ),
		'htmlCompletionComponentName'   => __( 'Registered component slug', 'daveden-builderius-enhancements' ),
		/* translators: %s: component property type. */
		'htmlCompletionComponentProp'   => __( 'Component property — %s', 'daveden-builderius-enhancements' ),
		'htmlTools'                     => __( 'HTML authoring tools', 'daveden-builderius-enhancements' ),
		'htmlFormat'                    => __( 'Format', 'daveden-builderius-enhancements' ),
		'htmlFormatted'                 => __( 'HTML formatted', 'daveden-builderius-enhancements' ),
		'htmlRenameTag'                 => __( 'Rename tag…', 'daveden-builderius-enhancements' ),
		'htmlRenameNeedsPair'           => __( 'Place the caret in a paired opening or closing tag', 'daveden-builderius-enhancements' ),
		'htmlRenameReserved'            => __( 'Builderius component and keep tags cannot be renamed', 'daveden-builderius-enhancements' ),
		'htmlRenamePrompt'              => __( 'Rename the matching tags to:', 'daveden-builderius-enhancements' ),
		'htmlRenameInvalid'             => __( 'Enter a non-void HTML tag name', 'daveden-builderius-enhancements' ),
		/* translators: %s: renamed HTML tag. */
		'htmlRenamedTag'                => __( 'Renamed both tags to <%s>', 'daveden-builderius-enhancements' ),
		'htmlCollectionJson'            => __( 'Collection + JSON', 'daveden-builderius-enhancements' ),
		'htmlCollectionSelect'          => __( 'Select one container with repeated items first', 'daveden-builderius-enhancements' ),
		'htmlCollectionNoRepeat'        => __( 'The selection does not contain a structurally repeated group', 'daveden-builderius-enhancements' ),
		'htmlCollectionNeedsParent'     => __( 'Open Edit as HTML on the parent, then select this repeated container so it can be replaced by a Collection', 'daveden-builderius-enhancements' ),
		'htmlCollectionDone'            => __( 'Converted the repeated markup to a Collection with static JSON', 'daveden-builderius-enhancements' ),
		'htmlCreateComponent'           => __( 'Create component after Apply', 'daveden-builderius-enhancements' ),
		'htmlComponentCancelled'        => __( 'Component extraction cancelled', 'daveden-builderius-enhancements' ),
		'htmlComponentSelect'           => __( 'Select one existing element subtree first', 'daveden-builderius-enhancements' ),
		'htmlComponentNeedsMarker'      => __( 'The selection must be one existing element carrying its data-dbe-id', 'daveden-builderius-enhancements' ),
		'htmlComponentQueued'           => __( 'After Apply, Builderius will open its Create Component dialog for this element', 'daveden-builderius-enhancements' ),
		'htmlComponentTargetGone'       => __( 'The selected element no longer exists, so component creation was not opened.', 'daveden-builderius-enhancements' ),
		'htmlComponentOpenFailed'       => __( 'Builderius could not open Create Component for the selected element.', 'daveden-builderius-enhancements' ),
		'htmlJumpIssue'                 => __( 'Go to issue', 'daveden-builderius-enhancements' ),
		'editAsHtmlOnlyElements'        => __( 'This element can’t be edited as HTML — try one inside or around it', 'daveden-builderius-enhancements' ),
		'applyHtml'                     => __( 'Apply HTML', 'daveden-builderius-enhancements' ),
		'reviewChanges'                 => __( 'Review changes', 'daveden-builderius-enhancements' ),
		'applyChanges'                  => __( 'Apply changes', 'daveden-builderius-enhancements' ),
		'editHtmlReviewReady'           => __( 'Review complete.', 'daveden-builderius-enhancements' ),
		'htmlErrOneRoot'                => __( 'The HTML must have exactly one root element', 'daveden-builderius-enhancements' ),
		'htmlErrRootKeep'               => __( 'The root element can’t be a preserved (<dbe-keep>) placeholder', 'daveden-builderius-enhancements' ),
		'htmlErrParse'                  => __( 'Could not parse the HTML', 'daveden-builderius-enhancements' ),
		'htmlErrUnclosedComment'        => __( 'Unclosed HTML comment', 'daveden-builderius-enhancements' ),
		'htmlErrUnclosedOpening'        => __( 'Opening tag is missing its closing bracket', 'daveden-builderius-enhancements' ),
		/* translators: %s: unexpected closing HTML tag. */
		'htmlErrUnexpectedClose'        => __( 'Unexpected closing tag </%s>', 'daveden-builderius-enhancements' ),
		/* translators: 1: expected closing tag, 2: encountered closing tag. */
		'htmlErrMismatchedClose'        => __( 'Expected </%1$s> before </%2$s>', 'daveden-builderius-enhancements' ),
		/* translators: %s: unclosed HTML tag. */
		'htmlErrUnclosedTag'            => __( 'Missing closing tag </%s>', 'daveden-builderius-enhancements' ),
		/* translators: 1: submitted bytes, 2: maximum bytes. */
		'htmlErrTooLarge'               => __( 'The HTML is too large (%1$s bytes; maximum %2$s).', 'daveden-builderius-enhancements' ),
		/* translators: 1: submitted elements, 2: maximum elements. */
		'htmlErrTooManyNodes'           => __( 'The HTML contains too many elements (%1$s; maximum %2$s).', 'daveden-builderius-enhancements' ),
		/* translators: %s: maximum nesting depth. */
		'htmlErrTooDeep'                => __( 'The HTML nesting exceeds the maximum depth of %s.', 'daveden-builderius-enhancements' ),
		/* translators: 1: module ID, 2: saved module type, 3: submitted module type. */
		'htmlErrMarkerType'             => __( 'Marked element %1$s is a %2$s but was submitted as %3$s.', 'daveden-builderius-enhancements' ),
		/* translators: 1: module ID, 2: submitted component slug. */
		'htmlErrUnknownMarkedComponent' => __( 'Marked element %1$s uses the unknown component “%2$s”. Choose an available component or restore the original name.', 'daveden-builderius-enhancements' ),
		'blankValue'                    => __( 'blank', 'daveden-builderius-enhancements' ),
		/* translators: 1: saved root module type, 2: submitted root module type. */
		'htmlErrRootType'               => __( 'The subtree root is a %1$s and cannot be submitted as %2$s.', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of root elements found. */
		'editHtmlRootCount'             => __( 'The HTML must have exactly one root element (found %s).', 'daveden-builderius-enhancements' ),
		/* translators: 1: elements updated, 2: elements added, 3: elements removed. */
		'editHtmlWillApply'             => __( 'Will apply: %1$s updated, %2$s added, %3$s removed', 'daveden-builderius-enhancements' ),
		/* translators: %s: comma-separated list of unrecognised data-dbe-id markers. */
		'editHtmlUnknownMarker'         => __( 'Unrecognised marker(s): %s. A new element will be created and the original removed.', 'daveden-builderius-enhancements' ),
		/* translators: 1: elements updated, 2: elements added, 3: elements removed. */
		'htmlApplied'                   => __( 'HTML applied: %1$s updated, %2$s added, %3$s removed', 'daveden-builderius-enhancements' ),
		'editHtmlUndoWarning'           => __( 'Applying these changes can’t be undone. Cancel keeps the current element unchanged.', 'daveden-builderius-enhancements' ),
		'editHtmlNotUndoable'           => __( 'Edit as HTML can’t be undone. Edit the element again to correct it.', 'daveden-builderius-enhancements' ),
		'importHtmlUndoWarning'         => __( 'This import can’t be undone as one action. Delete the new elements to remove them.', 'daveden-builderius-enhancements' ),
		'importHtmlNotUndoable'         => __( 'Import HTML can’t be undone as one action. Delete the imported elements to remove them.', 'daveden-builderius-enhancements' ),
		/* translators: %s: comma-separated list of stripped tags/attributes. */
		'htmlStripped'                  => __( '(stripped: %s)', 'daveden-builderius-enhancements' ),
		// Import HTML.
		'importHtml'                    => __( 'Import HTML', 'daveden-builderius-enhancements' ),
		'importHtmlEllipsis'            => __( 'Import HTML…', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'importHtmlTitleInto'           => __( 'Import HTML into %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: element label. */
		'importHtmlTitleAfter'          => __( 'Import HTML after %s', 'daveden-builderius-enhancements' ),
		'importHtmlHint'                => __( 'Paste HTML below; the preview shows the elements it will create. Scripts, event handlers and unknown tags are stripped, and several top-level elements are fine. Add data-dbe-label="…" to any element to name it in the Navigator, or insert a component with <dbe-component name="slug">.', 'daveden-builderius-enhancements' ),
		'importHtmlEditor'              => __( 'HTML to import', 'daveden-builderius-enhancements' ),
		'importHtmlPreview'             => __( 'Preview', 'daveden-builderius-enhancements' ),
		'importHtmlEmpty'               => __( 'Nothing to preview yet.', 'daveden-builderius-enhancements' ),
		'importHtmlOnlyElements'        => __( 'HTML can only be imported into a plain element', 'daveden-builderius-enhancements' ),
		'importHtmlTargetGone'          => __( 'The target element no longer exists', 'daveden-builderius-enhancements' ),
		'insertHtml'                    => __( 'Insert', 'daveden-builderius-enhancements' ),
		'htmlErrNoElements'             => __( 'No usable elements found in that HTML', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements to be created. */
		'importCountOne'                => __( '%s element will be created.', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements to be created. */
		'importCountMany'               => __( '%s elements will be created.', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of repeated groups detected. */
		'importCollapseOne'             => __( 'Collapse %s repeated group into a collection', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of repeated groups detected. */
		'importCollapseMany'            => __( 'Collapse %s repeated groups into collections', 'daveden-builderius-enhancements' ),
		'importCollapseBindNote'        => __( 'New collections still need their data binding.', 'daveden-builderius-enhancements' ),
		'importWireData'                => __( 'Extract the repeated content into each collection’s data source (JSON)', 'daveden-builderius-enhancements' ),
		'importCollapseWiredNote'       => __( 'Each collection stores its items as JSON in its data-b-context attribute.', 'daveden-builderius-enhancements' ),
		'importCollapseOpaqueNote'      => __( 'SVGs or components that differ between copies keep the first copy’s version.', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of data items on a collection. */
		'previewItemsOne'               => __( '(%s item)', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of data items on a collection. */
		'previewItemsMany'              => __( '(%s items)', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements imported. */
		'htmlImportedOne'               => __( 'Imported %s element', 'daveden-builderius-enhancements' ),
		/* translators: %s: number of elements imported. */
		'htmlImportedMany'              => __( 'Imported %s elements', 'daveden-builderius-enhancements' ),
		// Change tag.
		'changeTag'                     => __( 'Change tag…', 'daveden-builderius-enhancements' ),
		/* translators: %s: the new HTML tag. */
		'tagChangedTo'                  => __( 'Tag changed to <%s>', 'daveden-builderius-enhancements' ),
		'paletteChangeTag'              => __( 'Change tag', 'daveden-builderius-enhancements' ),
		/* translators: %s: the element's current HTML tag. */
		'phTag'                         => __( 'section, h2, figure…  (now <%s>)', 'daveden-builderius-enhancements' ),
		/* translators: %s: what the user typed. */
		'tagInvalid'                    => __( 'Not a usable HTML tag: %s', 'daveden-builderius-enhancements' ),
		/* translators: %s: the element's current HTML tag. */
		'tagAlready'                    => __( 'Already <%s>', 'daveden-builderius-enhancements' ),
	);
}
