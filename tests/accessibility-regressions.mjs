/**
 * Focused source-level regressions for Builderius chrome accessibility.
 *
 * These assertions complement live browser and assistive-technology tests.
 * They deliberately cover the small, critical retrofit contracts most likely
 * to disappear during a Builderius selector or DBE refactor.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

const builder = read('assets/builder/js/builder.js');
const a11y = read('assets/builder/js/chunks/a11y.js');
const composites = read('assets/builder/js/chunks/a11y-composites.js');
const workspace = read('assets/builder/js/chunks/workspace.js');
const editing = read('assets/builder/js/chunks/editing.js');
const styles = read('assets/builder/js/chunks/styles.js');
const integrations = read('assets/builder/js/chunks/integrations.js');
const commands = read('assets/builder/js/chunks/commands.js');
const shortcuts = read('assets/builder/js/chunks/shortcuts.js');
const coreRuntime = read('assets/builder/js/core-runtime.js');
const topbar = read('assets/builder/css/03-topbar-layout.css');
const controls = read('assets/builder/css/12-controls.css');
const palette = read('assets/builder/css/82-command-palette.css');
const saveCue = read('assets/builder/css/72-save-cue.css');
const tokens = read('assets/builder/css/00-tokens.css');
const tabs = read('assets/builder/css/11-tabs.css');
const focus = read('assets/builder/css/13-focus.css');
const treeRows = read('assets/builder/css/14-tree-rows.css');
const previewResize = read('assets/builder/css/74-preview-resize.css');
const panelResize = read('assets/builder/css/75-panel-resize.css');
const compactPanes = read('assets/builder/css/83-compact-panes.css');
const saveMenu = read('assets/builder/css/35-save-menu.css');
const inserterKeyboard = read('assets/builder/css/78-inserter-keyboard.css');
const navigatorKeyboard = read('assets/builder/css/79-navigator-keyboard.css');
const contextMenu = read('assets/builder/css/30-context-menu.css');
const autoBem = read('assets/builder/css/33-auto-bem.css');
const strings = read('includes/i18n-builder.php');
const outputBuilder = read('includes/output-builder.php');
const features = read('includes/features.php');
const adminBar = read('includes/admin-bar.php');
const contextParentFactory = commands.slice(commands.indexOf('function makeParent'), commands.indexOf('function makeCtxItem'));

assert.match(
    a11y,
    /iframe\.setAttribute\('title', iframeTitle\)/,
    'The canvas iframe must retain an accessible title.'
);
assert.match(
    workspace,
    /resizePreviewLeft[\s\S]+resizePreviewRight/,
    'The two canvas resize handles must have distinct accessible names.'
);
assert.match(
    workspace,
    /resizePanelLeft[\s\S]+resizePanelRight/,
    'The two panel resize handles must have distinct accessible names.'
);
assert.match(
    composites,
    /navigatorViewTab[\s\S]+Show %s in Navigator/,
    'Navigator view tabs must be distinguishable from similarly named controls.'
);
assert.match(
    workspace,
    /set\('aria-valuetext',[\s\S]+pixelsWide/,
    'Canvas resize handles must expose a human-readable width.'
);
assert.match(
    workspace,
    /setAttribute\('aria-valuetext',[\s\S]+pixelsWide/,
    'Panel resize handles must expose a human-readable width.'
);
assert.match(
    commands,
    /setAttribute\('aria-keyshortcuts', dbePaletteAriaShortcut\(\)\)/,
    'The command-palette button must expose its configured shortcut.'
);
assert.match(
    editing,
    /save\.setAttribute\('aria-keyshortcuts'/,
    'The Save button must expose Cmd/Ctrl+S when the shortcut is enabled.'
);
assert.match(
    commands,
    /var AREA = \{ KeyO: 'navigator', KeyE: 'settings', KeyP: 'canvas', KeyL: 'inserter', KeyB: 'footer' \}[\s\S]{0,350}input, textarea/,
    'Area-jump shortcuts must run before editable targets suppress element commands.'
);
assert.match(
    workspace,
    /else if \(which === 'footer'\)[\s\S]+dbeQuery\('footerBar'\)[\s\S]+button\[tabindex="0"\]/,
    'The direct-focus routes must include the Footer toolbar.'
);
assert.match(
    workspace,
    /function dbeFocusArea\(which, compactReady\)[\s\S]+dbeCompactLeftMode\(\) !== which[\s\S]+dbeEnsureCompactLeftMode\(which\)[\s\S]+dbeFocusArea\(which, true\)/,
    'Wide region shortcuts must switch the shared left panel before moving focus.'
);
assert.match(
    workspace,
    /function dbeEnsureCompactLeftMode\(pane\)[\s\S]+button\.click\(\)/,
    'The shared left-panel mode switch must use the native button activation path.'
);
assert.match(
    a11y,
    /function ensureChromeLandmarks\(\)[\s\S]+host\.areaAriaShortcut\(shortcutKey\)[\s\S]+regionNavigator[\s\S]+regionFooter/,
    'Named builder regions must expose their direct-focus shortcuts programmatically.'
);
assert.match(
    a11y,
    /host\.controllers\.register\('a11y\/chrome',[\s\S]+init: function \(context\)[\s\S]+refresh: function \(reason\)[\s\S]+destroy: function \(\)[\s\S]+destroyChrome\(\)/,
    'Builder landmarks must participate in the shared init, refresh and destroy lifecycle.'
);
assert.match(
    a11y,
    /function destroyChrome\(\)[\s\S]+record\.node\.removeAttribute\(name\)[\s\S]+record\.node\.setAttribute\(name, value\)/,
    'Destroying the chrome controller must restore the native landmark and iframe attributes.'
);
assert.match(
    builder,
    /function bindTooltips\(\)[\s\S]+addEventListener\('mouseover', dbeTooltipMouseover\)[\s\S]+function unbindTooltips\(\)[\s\S]+removeEventListener\('mouseover', dbeTooltipMouseover\)/,
    'The chrome controller must own reversible tooltip event listeners.'
);
assert.match(
    a11y,
    /function observeChrome\(\)[\s\S]+a11y-chrome-main[\s\S]+a11y-chrome-top[\s\S]+a11y-chrome-footer/,
    'The chrome controller must declare its own shared observation roots.'
);
assert.match(
    composites,
    /dbeControllers\.register\('a11y\/composites',[\s\S]+init: function \(context\)[\s\S]+refresh: function \(reason\)[\s\S]+destroy: function \(\)[\s\S]+destroyA11yComposites\(\)/,
    'Breakpoint and footer composites must participate in the shared controller lifecycle.'
);
assert.match(
    builder,
    /function dbeDestroyOwnedGroups\(owner\)[\s\S]+removeEventListener\('keydown', binding\.handler\)[\s\S]+dbeRestoreOwnedAttributes\(owner\)/,
    'Destroying an owned composite must remove its keyboard listener and restore native attributes.'
);
assert.match(
    builder,
    /function dbeBindOwnedEvent\(owner, node, key, type, handler, options\)[\s\S]+function dbeDestroyOwnedActivity\(owner\)[\s\S]+removeEventListener\(binding\.type, binding\.handler, binding\.options\)/,
    'Composite controllers must own and remove their non-roving event listeners.'
);
assert.match(
    builder,
    /function dbeSetOwnedFrame\(owner, callback\)[\s\S]+function dbeDestroyOwnedActivity\(owner\)[\s\S]+cancelAnimationFrame\(frame\.id\)/,
    'Composite controllers must own and cancel delayed animation-frame focus work.'
);
assert.match(
    composites,
    /ensureTopbarToolbars\(\)[\s\S]+owner: 'a11y\/composites'[\s\S]+ensureFooterToolbar\(\)[\s\S]+owner: 'a11y\/composites'/,
    'The breakpoint radio group and footer toolbar must declare composite-controller ownership.'
);
assert.match(
    composites,
    /function ensureInserterKeyboard\(\)[\s\S]+dbeBindOwnedEvent\('a11y\/composites', container, 'inserter-keys'[\s\S]+function ensureFavouritesKeyboard\(\)[\s\S]+owner: 'a11y\/composites'/,
    'Inserter grids and the favourites toolbar must declare composite-controller ownership.'
);
assert.match(
    composites,
    /function ensurePanelTabs\(\)[\s\S]+dbeBindOwnedEvent\('a11y\/composites', strip, 'panel-tabs-keys'[\s\S]+e\.key === 'Enter'[\s\S]+e\.key === ' '[\s\S]+clickSeq\(focused\)[\s\S]+dbeSetOwnedTimeout\('a11y\/composites'/,
    'Panel tablists must own arrow movement, Enter/Space activation and delayed-refocus work.'
);
assert.match(
    composites,
    /canvasDocumentTabs[\s\S]+role', 'tablist'[\s\S]+aria-selected[\s\S]+canvasStops\.length !== 1[\s\S]+!canvasFocused && canvasActive[\s\S]+canvas-tabs-keys[\s\S]+e\.key === 'Delete'[\s\S]+uniIframeTabButton__closeIcon[\s\S]+openCanvasDocument/,
    'Persistent canvas tabs must expose APG semantics, roving keys, keyboard close and a named document opener.'
);
assert.match(
    composites,
    /function bindSelectCombobox\(\)[\s\S]+select-search-keys[\s\S]+select-search-input[\s\S]+select-trigger-keys[\s\S]+multi-select-keys[\s\S]+fake-select-focusout/,
    'Combobox variants must register every delegated listener through the composite controller.'
);
assert.match(
    composites,
    /function dbeAccRefocus\(name\)[\s\S]+dbeSetOwnedFrame\('a11y\/composites'[\s\S]+function ensureSettingsAccordions\(\)[\s\S]+settings-accordion-keys/,
    'Settings accordions must own their remount refocus and keyboard listener.'
);
assert.match(
    composites,
    /function ensureBuilderiusMenu\(\)[\s\S]+dbeRememberOwnedAttributes\('a11y\/composites', trigger[\s\S]+dbeRememberOwnedAttributes\('a11y\/composites', list[\s\S]+builderius-menu-keys/,
    'The Builderius menu trigger, tree and delegated keyboard handling must belong to the composite controller.'
);
assert.match(
    composites,
    /function destroyA11yComposites\(\)[\s\S]+dbeObserveChrome\('a11y-composites-top', null\)[\s\S]+dbeUnobserveFooter\('a11y-composites-footer'\)[\s\S]+dbeDestroyOwnedGroups\('a11y\/composites'\)/,
    'The composite controller must release its top-bar/footer observations and owned DOM state.'
);
assert.match(
    composites,
    /function dbeObserveA11yComposites\(\)[\s\S]+a11y-composites-main[\s\S]+a11y-composites-portals/,
    'The composite controller must own its main-panel and portal observation roots.'
);
assert.doesNotMatch(
    composites,
    /dbeUnavailableBound|dbeInserterBound|dbePanelTabsBound|dbeAccBound|dbeMenuKeyBound/,
    'Composite listeners must not rely on irreversible element flags.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('topbar_toolbar'\)\) \{ try \{ ensureTopbarToolbars\(\)/,
    'The shared refresh pass must not bypass the composite controller for the top bar.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('footer_toolbar'\)\) \{ try \{ ensureFooterToolbar\(\)/,
    'The shared refresh pass must not bypass the composite controller for the footer.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('inserter_keyboard'\)\) \{[\s\S]{0,180}try \{ ensureInserterKeyboard\(\)/,
    'The shared refresh pass must not bypass the composite controller for the Inserter.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('panel_tabs'\)\) \{ try \{ ensurePanelTabs\(\)/,
    'The shared refresh pass must not bypass the composite controller for panel tabs.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('select_combobox'\)\) \{ try \{ ensureSelectComboboxes\(\)/,
    'The shared refresh pass must not bypass the composite controller for comboboxes.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('settings_accordions'\)\) \{ try \{ ensureSettingsAccordions\(\)/,
    'The shared refresh pass must not bypass the composite controller for settings accordions.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('builderius_menu'\)\) \{ try \{ ensureBuilderiusMenu\(\)/,
    'The shared refresh pass must not bypass the composite controller for the Builderius menu.'
);
assert.doesNotMatch(
    builder,
    /document\.addEventListener\('keydown', dbeMenuKeydown, true\)/,
    'The Builderius menu must not leave an irreversible boot-time document listener.'
);
assert.match(
    integrations,
    /dbeControllers\.register\(DBE_TERMINAL_OWNER,[\s\S]+init: function \(context\)[\s\S]+refresh: function \(reason\)[\s\S]+destroy: function \(\)[\s\S]+destroyTerminalIntegration\(\)/,
    'Sense AI terminal accessibility must participate in the shared controller lifecycle.'
);
assert.match(
    integrations,
    /function ensureTerminalTabs\(\)[\s\S]+dbeRememberOwnedAttributes\(DBE_TERMINAL_OWNER, panel[\s\S]+dbeRememberOwnedAttributes\(DBE_TERMINAL_OWNER, t[\s\S]+owner: DBE_TERMINAL_OWNER/,
    'Terminal tabs, their panel and roving group must declare terminal-controller ownership.'
);
assert.match(
    integrations,
    /function dbeBindAgentPickerKeys\(\)[\s\S]+dbeBindOwnedEvent\(DBE_TERMINAL_OWNER, document, 'terminal-agent-picker-keys'[\s\S]+dbeSetOwnedTimeout\(DBE_TERMINAL_OWNER, focusItem/,
    'The terminal agent picker must own its delegated keyboard listener and delayed focus retries.'
);
assert.match(
    integrations,
    /function dbeBindTerminalEscape\(frame\)[\s\S]+dbeBindOwnedEvent\(DBE_TERMINAL_OWNER, doc, 'terminal-escape-keys'[\s\S]+dbeBindOwnedEvent\(DBE_TERMINAL_OWNER, frame, 'terminal-frame-load'/,
    'Terminal iframes must own both the inner-document escape bridge and frame load listener.'
);
assert.match(
    integrations,
    /function destroyTerminalIntegration\(\)[\s\S]+dbeUnobserveFooter\('integrations-terminal-footer'\)[\s\S]+dbeObserveChrome\('integrations-terminal-panel', null\)[\s\S]+dbeDestroyOwnedActivity\(DBE_TERMINAL_OWNER\)[\s\S]+dbeDestroyOwnedGroups\(DBE_TERMINAL_OWNER\)[\s\S]+removeChild\(dbeTerminalEscapeHintNode\)/,
    'Destroying the terminal controller must release observation roots, listeners, timers, ARIA and its hidden hint.'
);
assert.doesNotMatch(
    integrations,
    /dbeAgentKeysBound|dbeTerminalEscapeKeyBound|dbeTerminalEscapeLoadBound|terminalBoot|dbeFooterBarNode/,
    'Terminal accessibility must not rely on irreversible flags or an unmanaged boot retry.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('ai_terminal_tabs'\)\) \{ try \{ ensureTerminalTabs\(\)/,
    'The shared refresh pass must not bypass the terminal integration controller.'
);
assert.match(
    workspace,
    /dbeControllers\.register\(DBE_WORKSPACE_OWNER,[\s\S]+init: function \(context\)[\s\S]+refresh: function \(reason\)[\s\S]+destroy: function \(\)[\s\S]+destroyWorkspace\(\)/,
    'Workspace features must participate in the shared controller lifecycle.'
);
assert.match(
    workspace,
    /function dbeRefreshWorkspace\(\)[\s\S]+ensureCanvasModeControl\(\)[\s\S]+ensurePreviewHandles\(\)[\s\S]+ensureCompactPanes\(\)[\s\S]+dbeSyncPanelsHidden\(\)[\s\S]+ensurePanelHandles\(\)[\s\S]+ensureNavDetach\(\)/,
    'The workspace controller must refresh the complete responsive and sizing surface.'
);
assert.match(
    workspace,
    /function dbeRestoreWorkspaceState\(\)[\s\S]+dbePreviewClearOverride\(\)[\s\S]+dbeObserveChrome\('workspace-main', null\)[\s\S]+dbeDestroyOwnedActivity\(DBE_WORKSPACE_OWNER\)[\s\S]+dbeDestroyOwnedGroups\(DBE_WORKSPACE_OWNER\)[\s\S]+\.dbe-preview-handle[\s\S]+dbe-compact-panes[\s\S]+--dbe-nav-h/,
    'Workspace teardown must release observations, activity, generated controls, classes and sizing variables.'
);
assert.match(
    workspace,
    /function dbeCompactMedia\(\)[\s\S]+dbeBindOwnedEvent\(DBE_WORKSPACE_OWNER, dbeCompactMql, 'compact-media-change'[\s\S]+function bindNavHeaderDrag\(\)[\s\S]+navigator-drag-start[\s\S]+navigator-drag-cancel/,
    'Compact media and detached-Navigator document listeners must be controller-owned.'
);
assert.doesNotMatch(
    workspace,
    /dbeCanvasModeKeyBound|dbePersistedPanelsBound|dbeNavHeaderBound/,
    'Workspace listeners must not rely on irreversible flags.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('preview_resize'\)\) \{ try \{ ensurePreviewHandles\(\)|if \(on\('compact_panes'\)\) \{ try \{ ensureCompactPanes\(\)|if \(on\('panel_resize'\)\) \{ try \{ ensurePanelHandles\(\)|if \(on\('panel_detach'\)\) \{ try \{ ensureNavDetach\(\)/,
    'The shared refresh pass must not bypass the workspace controller.'
);
assert.match(
    commands,
    /dbeControllers\.register\(DBE_COMMANDS_OWNER,[\s\S]+init: function \(context\)[\s\S]+refresh: function \(reason\)[\s\S]+destroy: function \(\)[\s\S]+destroyCommands\(\)/,
    'Command interfaces must participate in the shared controller lifecycle.'
);
assert.match(
    commands,
    /function dbeRefreshCommands\(\)[\s\S]+dbeObserveCommands\(\)[\s\S]+ensurePaletteButton\(\)[\s\S]+ensureKeyboardIframeBridge\(\)[\s\S]+decorateClassChips\(\)/,
    'The commands controller must refresh its top-bar, iframe and class-chip surfaces.'
);
assert.match(
    builder,
    /function dbeOwnedHooksApi\(\)[\s\S]+dbeOwnedHookApi = window\.Builderius\.API\.hooks[\s\S]+function dbeBindOwnedHook\(owner, hook, namespace, callback\)[\s\S]+api\.addAction\(hook, namespace, callback\)[\s\S]+function dbeDestroyOwnedHooks\(owner\)[\s\S]+api\.removeAction\(item\.hook, item\.namespace\)/,
    'Controller-owned Builderius subscriptions must retain their startup API and unsubscribe during teardown.'
);
assert.match(
    commands,
    /input\.setAttribute\('aria-label', dbeT\('searchCommandsLabel', 'Search commands'\)\)/,
    'The command search field must use concise spoken copy independently of its visual placeholder.'
);
assert.match(
    shortcuts,
    /function openShortcutsDialog\(\)[\s\S]+event\.key === 'Escape'[\s\S]+dlg\.close\(\)[\s\S]+dbeShortcutFocusReturn[\s\S]+target\.focus\(\)/,
    'Shortcut help must close explicitly on Escape and return focus to its invoker.'
);
assert.match(
    strings,
    /'searchCommandsLabel'\s*=>\s*__\( 'Search commands'/,
    'Command search must provide a dedicated translatable accessible label.'
);
assert.match(
    commands,
    /function dbeBindKeyboardFrameDocument\(frame\)[\s\S]+dbeBindOwnedEvent\(DBE_COMMANDS_OWNER, doc, 'palette-key'[\s\S]+canvas-text-editing-key[\s\S]+canvas-navigation-key[\s\S]+reveal-selection-click/,
    'The preview bridge must own every inner-document keyboard and selection listener.'
);
assert.match(
    commands,
    /function dbeBindKeyboardFrameDocument\(frame\)[\s\S]+frame\.isConnected[\s\S]+doc\.documentElement[\s\S]+!root \|\| root\.nodeType !== 1[\s\S]+record\.observer\.observe\(root[\s\S]+record\.observer = null/,
    'Persistent canvas-tab swaps must not observe a detached or unhydrated preview document.'
);
assert.match(
    commands,
    /function dbeReleaseCommandFrameDocuments\(keepDoc\)[\s\S]+dbeUnbindOwnedEvent\(DBE_COMMANDS_OWNER, record\.doc[\s\S]+record\.observer\.disconnect\(\)[\s\S]+function ensureKeyboardIframeBridge\(\)[\s\S]+canvas-frame-load/,
    'Reloaded preview documents must release listeners and observers before the new bridge binds.'
);
assert.match(
    commands,
    /function setupMenuKeyboard\(container\)[\s\S]+dbeBindOwnedEvent\(DBE_COMMANDS_OWNER, dialog, 'context-menu-keys'/,
    'Native context-menu keyboard handling must be removable with the commands controller.'
);
assert.match(
    commands,
    /function nativeCtxLabel\(li\)[\s\S]+uniContextMenu__shortcut[\s\S]+function collectNativeItems\(container, regex\)[\s\S]+regex\.test\(nativeCtxLabel\(li\)\)/,
    'Builderius 1.3.6 shortcut spans must not become part of native context-menu command names.'
);
assert.match(
    commands,
    /nativeContextItem\(container, \/\^Cut\$\/\)[\s\S]+collectNativeItems\(container, \/\^\(Copy\|Paste\|Cut\)\$\/\)[\s\S]+collectNativeItems\(container, \/\^Rename\$\/\)[\s\S]+collectNativeItems\(container, \/\^Auto-BEM\$\/\)[\s\S]+collectNativeItems\(container, \/\^Wrap in\$\/\)[\s\S]+collectNativeItems\(container, \/\^Expand children\$\/\)/,
    'The enhanced menu must adopt Builderius 1.3.6 actions instead of adding duplicate Cut, rename, wrapping or expansion commands.'
);
assert.match(
    contextParentFactory,
    /li\.addEventListener\('mousedown',[\s\S]+aria-expanded[\s\S]+openFlyout\(\)/,
    'DBE context-menu branches must follow Builderius 1.3.6 and open on click.'
);
assert.doesNotMatch(
    contextParentFactory,
    /mouseenter|mouseleave/,
    'DBE context-menu branches must not mix hover-open behaviour with Builderius click-open branches.'
);
assert.match(
    contextMenu,
    /uniMiniModal--wrapIn\.dbe-wrap-in-anchored[\s\S]+position:\s*fixed\s*!important[\s\S]+translate:\s*none\s*!important[\s\S]+max-inline-size:\s*calc\(100vw - 16px\)[\s\S]+max-block-size:\s*calc\(100vh - 16px\)/,
    'The native Wrap in dialog must use a viewport-capped fixed layer that can be recalculated after browser zoom.'
);
assert.doesNotMatch(
    contextMenu + commands,
    /\.dbe-wrap-in-anchor\s*\{|--dbe-wrap-in-anchor|function dbeSetNativeWrapAnchor/,
    'Wrap in must not retain a temporary pixel anchor that becomes stale after browser zoom.'
);
assert.match(
    contextMenu,
    /dbe-ctx-item--class[\s\S]+dbe-chip-menu \.uniContextMenu__item[\s\S]+max-inline-size:\s*min\(460px, calc\(100vw - 32px\)\)[\s\S]+white-space:\s*normal[\s\S]+overflow-wrap:\s*anywhere/,
    'Class-bearing context menus must wrap unusually long class names within the viewport instead of clipping them.'
);
assert.match(
    commands + styles,
    /opts\.className[\s\S]+dbe-ctx-item--class/,
    'Class-style actions must opt into the long-name-safe context-menu treatment.'
);
assert.match(
    palette,
    /\.dbe-palette__label,[\s\S]+\.dbe-palette__reason[\s\S]+overflow-wrap:\s*anywhere/,
    'Command-palette class actions and disabled reasons must preserve long names.'
);
assert.match(
    autoBem,
    /dialog\.dbe-bem\s*\{[\s\S]+position:\s*fixed;[\s\S]+inset:\s*0;[\s\S]+margin:\s*auto;[\s\S]+inline-size:\s*min\(860px, calc\(100vw - 32px\)\)[\s\S]+grid-template-columns:\s*auto auto minmax\(0, 1fr\) minmax\(340px, \.9fr\)/,
    'The fallback Auto-BEM task must stay centred and reserve enough width to show generated class names.'
);
assert.match(
    contextMenu,
    /dialog\.uniMiniModal\.uniMiniModal--autoBem\s*\{[\s\S]+position:\s*fixed\s*!important;[\s\S]+inset:\s*0\s*!important;[\s\S]+margin:\s*auto\s*!important;[\s\S]+inline-size:\s*min\(860px, calc\(100vw - 32px\)\)[\s\S]+uniAutoBemModal__row[\s\S]+grid-template-columns:\s*minmax\(0, 1fr\) minmax\(340px, \.9fr\)[\s\S]+uniAutoBemModal__rowClassInput/,
    'Builderius 1.3.6 native Auto-BEM must stay centred and replace its 130px class-name column with a readable responsive width.'
);
assert.match(
    commands,
    /function dbePositionNativeWrapDialog\(dialog, targetId\)[\s\S]+uniRightPanel[\s\S]+panel\.getBoundingClientRect\(\)[\s\S]+row\.getBoundingClientRect\(\)[\s\S]+window\.innerWidth[\s\S]+window\.innerHeight[\s\S]+anchorLeft - dialogRect\.width - gap[\s\S]+anchorRight \+ gap[\s\S]+style\.setProperty\('left',[\s\S]+'important'\)[\s\S]+style\.setProperty\('top',[\s\S]+'important'\)[\s\S]+function scheduleWrapDialogPosition\(\)[\s\S]+wrap-dialog-resize[\s\S]+wrap-dialog-visual-resize/,
    'Wrap in must recalculate from live Navigator geometry and clamp both axes whenever browser or visual viewport zoom changes.'
);
assert.match(
    commands,
    /function dbeDecorateNativeWrapDialog\(dialog, targetId\)[\s\S]+aria-label[\s\S]+dbe-wrap-in-figure[\s\S]+wrap\('figure', \[targetId\]\)[\s\S]+function dbeEnhanceNativeWrapItem/,
    'The native Wrap in modal must include DBE Figure wrapping and an accessible close name.'
);
assert.match(
    commands,
    /dbeDecorateNativeWrapDialog\(dialog, targetId\)[\s\S]+dialog\.setAttribute\('aria-label', dbeT\('wrapIn'[\s\S]+ev\.key === 'Escape'[\s\S]+returnWrapDialogFocus\(\)[\s\S]+ev\.key !== 'Tab'[\s\S]+ev\.shiftKey[\s\S]+focusables\[next\]\.focus\(\)[\s\S]+wrap-dialog-cancel[\s\S]+wrap-dialog-close-return[\s\S]+wrap-dialog-choice-return-[\s\S]+uni-tree-node-[\s\S]+first\.focus\(\)/,
    'The Wrap in modal must be named, contain Tab focus, start on the first choice and return focus to its Navigator row.'
);
assert.doesNotMatch(
    commands,
    /wrapFigureLi/,
    'Figure wrapping must not remain as a separate top-level command when the native Wrap in modal is available.'
);
assert.match(
    contextMenu,
    /uniMiniModal--wrapIn[\s\S]+uniIconButton\s*\{[\s\S]+inline-size:\s*28px\s*!important;[\s\S]+block-size:\s*28px\s*!important;[\s\S]+focus-visible/,
    'The native Wrap in close button must expose a visible 28px target and keyboard focus treatment.'
);
assert.match(
    contextMenu,
    /uniWrapInModal__option:hover[\s\S]+dbe-hover-wash[\s\S]+uniWrapInModal__option:focus-visible[\s\S]+color-mix\(in srgb, var\(--dbe-focus\) 10%, transparent\)[\s\S]+outline:\s*2px solid var\(--dbe-focus\)[\s\S]+outline-offset:\s*-2px/,
    'Wrap in choices must have subtle hover and focus colours plus one inset focus ring.'
);
const wrapChoiceFocus = contextMenu.match(/\.uniMiniModal--wrapIn \.uniWrapInModal__option:focus-visible\s*\{([^}]*)\}/)?.[1] || '';
assert.doesNotMatch(
    wrapChoiceFocus,
    /border-color/,
    'Wrap in choices must not add a second focus-coloured border around the inset ring.'
);
assert.match(
    focus,
    /outline:\s*2px solid var\(--dbe-focus\) !important;[\s\S]+outline-offset:\s*-2px !important;/,
    'The shared builder focus treatment must use one inset ring instead of a separated outer outline.'
);
assert.match(
    commands,
    /function dbeNavigatorContextMenuKeydown\(e\)[\s\S]+e\.key !== 'ContextMenu'[\s\S]+e\.key === 'F10' && e\.shiftKey[\s\S]+row\.dispatchEvent\(new MouseEvent\('contextmenu'[\s\S]+dbeBindOwnedEvent\(DBE_COMMANDS_OWNER, document, 'navigator-context-menu-key'/,
    'Navigator rows must explicitly open their context menu from Shift+F10 and the Menu key.'
);
assert.match(
    commands,
    /function dbePreviewContextMenuKeydown\(e\)[\s\S]+e\.key !== 'ContextMenu'[\s\S]+e\.key === 'F10' && e\.shiftKey[\s\S]+dbeOpenPreviewContextMenu[\s\S]+dbeBindOwnedEvent\(DBE_COMMANDS_OWNER, doc, 'preview-context-menu-key'/,
    'Preview elements must open the shared context menu from Shift+F10 and the Menu key.'
);
assert.match(
    commands,
    /function dbePreviewContextMenuKeydown\(e\)[\s\S]+e\.key === 'F2'[\s\S]+on\('preview_rename'\)[\s\S]+dbePreviewContextBlocked\(e\.target\)[\s\S]+dbeOpenPreviewRename\(renameTarget\.id, renameTarget\.element\)/,
    'Preview F2 rename must ignore editing controls and use the rendered target.'
);
assert.match(
    commands,
    /function dbeOpenPreviewRename\(id, renderedTarget\)[\s\S]+aria-labelledby[\s\S]+form\.noValidate = true[\s\S]+previewRenameLabel[\s\S]+function restoreFocus\(\)[\s\S]+dbeRestorePreviewContextTarget\(focusState\)[\s\S]+aria-invalid[\s\S]+next\.length > 120[\s\S]+dlg\.addEventListener\('keydown'[\s\S]+e\.key === 'Escape'/,
    'Preview rename must clearly name its field, validate input, support Escape and restore canvas focus.'
);
assert.match(
    commands,
    /function dbePreviewContextBlocked\(target\)[\s\S]+input, textarea, select[\s\S]+contenteditable[\s\S]+function dbePreviewContextPointerDown\(e\)[\s\S]+dbeCanvasInteractive\(\)[\s\S]+function dbePreviewContextMenu\(e\)/,
    'Preview menus must preserve editable and interaction-mode context menus.'
);
assert.match(
    commands,
    /function dbeReleasePreviewContextState\(state, keepFocused\)[\s\S]+state\.element\.addEventListener\('blur'[\s\S]+function dbeRestorePreviewContextTarget\(state\)[\s\S]+target\.focus[\s\S]+stableChecks >= 2[\s\S]+function dbeDiscardPreviewContext\(restoreFocus\)[\s\S]+dialog\.uniBuilderContextMenu\[open\][\s\S]+dbeRestorePreviewContextTarget\(state\)/,
    'Closing a preview context menu must restore focus to its rendered target.'
);
assert.match(
    commands,
    /function dbePreviewContextCloseKeydown\(e\)[\s\S]+e\.key !== 'Escape'[\s\S]+dbeRestorePreviewContextTarget\(state\)[\s\S]+preview-context-close-key'[\s\S]+dbePreviewContextCloseKeydown/,
    'Preview focus restoration must survive the native dialog Escape handling.'
);
assert.match(
    commands,
    /preview-context-close'[\s\S]+dbeDiscardPreviewContext\(true\)[\s\S]+builderius\.contextMenu\.hide'[\s\S]+dbePreviewContextState[\s\S]+200/,
    'Preview focus restoration must follow dialog close and retain a bounded fallback.'
);
assert.match(
    commands,
    /function decorateClassChips\(\)[\s\S]+dbeRememberOwnedAttributes\(DBE_COMMANDS_OWNER, li, \['tabindex'\]\)/,
    'Class-chip focusability must restore the native tabindex on teardown.'
);
assert.match(
    commands,
    /function destroyCommands\(\)[\s\S]+dbeObserveChrome\('commands-top', null\)[\s\S]+dbeDestroyOwnedHooks\(DBE_COMMANDS_OWNER\)[\s\S]+dbeReleaseCommandFrameDocuments\(null\)[\s\S]+dbeDestroyOwnedActivity\(DBE_COMMANDS_OWNER\)[\s\S]+dialog\.dbe-palette[\s\S]+dbeKeyboardFrame = null/,
    'Command teardown must release observations, hooks, iframe activity and generated interfaces.'
);
assert.match(
    editing,
    /dbeControllers\.register\(DBE_EDITING_OWNER,[\s\S]+hookHistoryCapture\(\)[\s\S]+bindUndoKeys\(\)[\s\S]+hookImageDefaults\(\)[\s\S]+bindDblclickRename\(\)[\s\S]+destroyEditing\(\)/,
    'Editing hooks and global keys must participate in the shared controller lifecycle.'
);
assert.match(
    editing,
    /function hookHistoryCapture\(\)[\s\S]+dbeBindOwnedHook\(DBE_EDITING_OWNER, 'builderius\.Module\.deleted'[\s\S]+dbeBindOwnedHook\(DBE_EDITING_OWNER, 'builderius\.Module\.added'/,
    'History capture must use removable editing-owned hooks.'
);
assert.match(
    editing,
    /function hookImageDefaults\(\)[\s\S]+dbeBindOwnedHook\(DBE_EDITING_OWNER, 'builderius\.Module\.added'/,
    'Image defaults must use a removable editing-owned hook.'
);
assert.match(
    editing,
    /function bindUndoKeys\(\)[\s\S]+dbeBindOwnedEvent\(DBE_EDITING_OWNER, document, 'history-key'[\s\S]+function bindDblclickRename\(\)[\s\S]+dbeBindOwnedEvent\(DBE_EDITING_OWNER, document, 'double-click-rename'/,
    'Undo and double-click rename listeners must be removable with the editing controller.'
);
assert.match(
    editing,
    /function hookSaveStatus\(\)[\s\S]+dbeBindOwnedHook\([\s\S]+DBE_EDITING_OWNER[\s\S]+builderius\.storeAction\.afterSaveAllSettings[\s\S]+function bindSaveShortcut\(\)[\s\S]+dbeBindOwnedEvent\(DBE_EDITING_OWNER, document, 'save-shortcut'/,
    'Save completion and shortcut handling must use editing-owned hooks and listeners.'
);
assert.match(
    editing,
    /function dbeShowSavedState\(stamp\)[\s\S]+dbeSetOwnedTimeout\(DBE_EDITING_OWNER[\s\S]+function dbeBeginSave\(\)[\s\S]+dbeSetOwnedTimeout\(DBE_EDITING_OWNER/,
    'Saved and failed-state timers must be cancelled with the editing controller.'
);
assert.match(
    editing,
    /function dbeObserveEditing\(\)[\s\S]+editing-top[\s\S]+editing-main[\s\S]+function dbeRefreshEditing\(\)[\s\S]+dbeEnsureSaveShortcutMetadata\(\)[\s\S]+ensureSaveCue\(\)/,
    'Save metadata and status must refresh through editing-owned observation roots.'
);
assert.match(
    editing,
    /function dbeEnsureSaveShortcutMetadata\(\)[\s\S]+dbeRememberOwnedAttributes\(DBE_EDITING_OWNER, save, \['aria-keyshortcuts'\]\)[\s\S]+function destroyEditing\(\)[\s\S]+dbeRestoreOwnedAttributes\(DBE_EDITING_OWNER\)[\s\S]+\.dbe-save-cue/,
    'Editing teardown must restore native Save metadata and remove its generated status.'
);
assert.match(
    editing,
    /function dbeNavigatorLabel\(row\)[\s\S]+dbe-visually-hidden[\s\S]+raw\.indexOf\(' \.'\)[\s\S]+function dbeFinishCancelledRename\(st, restoreFocus\)[\s\S]+current !== st\.oldLabel[\s\S]+commitRename\(st\.id, st\.oldLabel[\s\S]+function closeRename\(commit, restoreFocus\)[\s\S]+dbeFinishCancelledRename\(st, restoreFocus\)[\s\S]+var oldLabel = dbeNavigatorLabel\(row\) \|\| mods\[id\]\.label[\s\S]+closeRename\(true, true\)[\s\S]+closeRename\(false, true\)/,
    'Inline rename must seed from the rendered 1.3.5 label, restore it on cancellation and return focus to its tree row.'
);
assert.match(
    editing,
    /function openEditHtmlDialog\(rootId\)[\s\S]+restoreFocusOnClose[\s\S]+dbeSetOwnedTimeout\(DBE_EDITING_OWNER, updatePreview[\s\S]+dbeEditingDialogFocusReturn\(focusReturn\)[\s\S]+function openImportHtmlDialog\(targetId\)[\s\S]+dbeSetOwnedTimeout\(DBE_EDITING_OWNER, refreshPreview[\s\S]+dbeEditingDialogFocusReturn\(focusReturn\)/,
    'HTML editing dialogs must own debounce work and restore focus when dismissed without applying.'
);
assert.match(
    editing,
    /function dbeBindEditingDialogEscape\(dlg, surface\)[\s\S]+\(surface \|\| dlg\)\.addEventListener\('keydown'[\s\S]+e\.key !== 'Escape'[\s\S]+dlg\.close\(\)[\s\S]+dbeBindEditingDialogEscape\(dlg, editor\.el\)/,
    'Editing dialogs must close explicitly on Escape before embedded editors can consume the key.'
);
assert.match(
    editing,
    /opts\.onEscape && typeof ed\.onKeyDown[\s\S]+browserEvent\.key !== 'Escape'[\s\S]+event\.preventDefault\(\)[\s\S]+opts\.onEscape\(\)[\s\S]+ed\.addCommand\(api\.KeyCode\.Escape, opts\.onEscape\)[\s\S]+ed\.addAction\([\s\S]+keybindings: \[api\.KeyCode\.Escape\][\s\S]+escapeKeyListener\.dispose\(\)[\s\S]+onEscape: function \(\) \{ dlg\.close\(\); \}/,
    'Monaco editing dialogs must handle Escape through the editor event and command APIs.'
);
assert.match(
    editing,
    /function destroyEditing\(\)[\s\S]+closeRename\(false, true\)[\s\S]+dbeRemovePriorHtmlDialog\(\)[\s\S]+dbeRemovePriorBemDialog\(\)[\s\S]+undoStack = \[\][\s\S]+dbeDestroyOwnedHooks\(DBE_EDITING_OWNER\)[\s\S]+dbeDestroyOwnedActivity\(DBE_EDITING_OWNER\)/,
    'Editing teardown must remove transient interfaces, history, hooks and owned activity.'
);
assert.match(
    commands,
    /function dbeStampSaveMenu\(menu\)[\s\S]+dbeRememberOwnedAttributes\(DBE_COMMANDS_OWNER, menu[\s\S]+dbeBindOwnedEvent\(DBE_COMMANDS_OWNER, dlg, 'save-menu-close'[\s\S]+function bindSaveMenuKeys\(\)[\s\S]+dbeBindOwnedEvent\(DBE_COMMANDS_OWNER, document, 'save-menu-keys'/,
    'The Save menu must give its generated semantics and document keys to the commands controller.'
);
assert.match(
    commands,
    /function dbeWatchSaveMenuOpen\(focusFirst\)[\s\S]+40, DBE_COMMANDS_OWNER[\s\S]+function revealActiveInTree\(\)[\s\S]+60, DBE_COMMANDS_OWNER/,
    'Save-menu mount polling and selection reveal must use cancellable commands-owned work.'
);
assert.match(
    commands,
    /function dbeRefreshCommands\(\)[\s\S]+ensureSaveMenuButton\(\)[\s\S]+revealActiveInTree\(\)[\s\S]+dbeSyncSelectionContext\(\)[\s\S]+function destroyCommands\(\)[\s\S]+\.dbe-save-menu-btn[\s\S]+\.dbe-canvas-selection-context/,
    'Save-menu and selection-reveal interfaces must refresh and tear down through commands.'
);
assert.doesNotMatch(
    builder,
    /function boot\(\)[\s\S]+if \(on\('save_shortcut'\)\) \{ bindSaveShortcut\(\)|function boot\(\)[\s\S]+if \(on\('save_state_cue'\)\) \{ hookSaveStatus\(\)|function boot\(\)[\s\S]+if \(on\('save_split_button'\)\) \{ bindSaveMenuKeys\(\)|function boot\(\)[\s\S]+if \(on\('reveal_selected'\)\) \{ bindRevealActive\(\)/,
    'Boot must not bypass editing and commands lifecycle ownership.'
);
assert.match(
    builder,
    /var NEED_STYLES = on\('css_code_default'\)[\s\S]+on\('hide_minimap'\)/,
    'The host must compute one toggle gate for the styles domain.'
);
assert.match(
    styles,
    /var NEED_STYLES = host\.needStyles[\s\S]+dbeControllers\.register\(DBE_STYLES_OWNER,[\s\S]+dbeRefreshStyles\(\)[\s\S]+destroyStyles\(\)/,
    'Style features must participate in one shared controller lifecycle.'
);
assert.match(
    styles,
    /function dbeObserveStyles\(\)[\s\S]+dbeObserveChrome\('styles-main'[\s\S]+function destroyStyles\(\)[\s\S]+dbeObserveChrome\('styles-main', null\)/,
    'The styles controller must own and release its main-panel observation.'
);
assert.match(
    styles,
    /function dbeRefreshStyles\(\)[\s\S]+ensureCssCodeDefault\(\)[\s\S]+ensureCodeModeTabs\(\)[\s\S]+ensureCssHint\(\)[\s\S]+dbeDisableMinimap\(\)[\s\S]+ensureScopeBar\(\)[\s\S]+ensureScopeIsolation\(\)[\s\S]+refreshOpenStyleInspector\(\)/,
    'Style interfaces must refresh through their controller rather than the global scheduler.'
);
assert.match(
    styles,
    /function dbeRestoreMinimap\(\)[\s\S]+dbeMinimapCreateListener\.dispose\(\)[\s\S]+item\.editor\.updateOptions\(\{ minimap: \{ enabled: item\.enabled \} \}\)[\s\S]+dbeMinimapDone = false/,
    'Minimap teardown must dispose the Monaco subscription and restore prior editor state.'
);
assert.match(
    styles,
    /function destroyStyles\(\)[\s\S]+dbeScopeFinish\(\)[\s\S]+dbeDestroyOwnedActivity\(DBE_STYLES_OWNER\)[\s\S]+dbeClearAllCssDecorations\(\)[\s\S]+dbe-css-hint-dialog[\s\S]+dbe-style-inspector[\s\S]+dbe-scope-covered[\s\S]+dbeRestoreMinimap\(\)/,
    'Style teardown must settle transitions, cancel work, remove generated UI and restore Monaco.'
);
assert.match(
    styles,
    /function dbeCloseStyleInspector\(panel\)[\s\S]+preferred && preferred\.isConnected[\s\S]+target\.focus\(\)/,
    'Style inspector dismissal must return focus to a stable invoking control.'
);
assert.match(
    styles,
    /function openCssHintDialog\(\)[\s\S]+dbeCssHintFocusReturn = document\.activeElement[\s\S]+aria-labelledby', 'dbe-css-hint-dialog-title'[\s\S]+title\.id = 'dbe-css-hint-dialog-title'[\s\S]+e\.key === 'Escape'[\s\S]+dlg\.close\(\)[\s\S]+dlg\.addEventListener\('close'[\s\S]+target\.focus\(\)/,
    'Style help must be named, close explicitly on Escape and return focus to its invoking control.'
);
assert.match(
    styles,
    /dbeSetOwnedFrame\(DBE_STYLES_OWNER, waitForContentTab\)[\s\S]+dbeSetOwnedTimeout\(DBE_STYLES_OWNER, done, 6000\)[\s\S]+dbeSetOwnedTimeout\(DBE_STYLES_OWNER, poll, 150\)[\s\S]+dbeSetOwnedTimeout\(DBE_STYLES_OWNER, function \(\) \{ clickSelectorUntilLoaded/,
    'Styles navigation and selector polling must use controller-owned delayed work.'
);
assert.doesNotMatch(
    commands,
    /dbeShortcutKeyBound|dbePaletteKeyBound|dbeChipDismissBound|dbeChipDecorated|dbeCanvasTextEditingKeyBound|dbeCanvasNavigationKeyBound|dbeRevealSelectionBound|dbeCanvasTextEditingObserver/,
    'Command and iframe listeners must not rely on irreversible flags.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('context_menu'\)\) \{ try \{ decorateClassChips\(\)|if \(on\('command_palette'\)\)[\s\S]{0,100}try \{ ensurePaletteButton\(\)|try \{ ensureKeyboardIframeBridge\(\)/,
    'The shared refresh pass must not bypass the commands controller.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('tooltips'\)\) \{ try \{ labelChromeIcons\(\)/,
    'The shared feature refresh pass must not bypass controller-owned chrome labels.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('chrome_landmarks'\)\) \{ try \{ ensureChromeLandmarks\(\)/,
    'The shared feature refresh pass must not bypass the chrome controller lifecycle.'
);
assert.match(
    strings,
    /'openInserterCmd'\s+=> __\( 'Open Element library'/,
    'The palette must use the visible Element library destination name.'
);
assert.match(
    strings,
    /'scGotoFooter'\s+=> __\( 'Footer bar'/,
    'The region-navigation copy must include the Footer bar.'
);
assert.match(
    editing,
    /dbeSaveInitialisingUntil[\s\S]+state = dbeSaveState \|\| \(dirty \? 'dirty' : 'clean'\)/,
    'The save cue must baseline Builderius hydration and retain an explicit clean state.'
);
assert.match(
    editing,
    /function dbeSaveableSnapshotSignature\(\)[\s\S]+history\[history\.length - 1\][\s\S]+JSON\.stringify\(item\.snapshot\)[\s\S]+snapshotSignature !== saveBaselineSnapshot/,
    'Dirty state must compare saveable snapshots instead of relying on capped history length.'
);
assert.doesNotMatch(
    editing,
    /dbeSaveSelectionTimer|dbeArmSelectionCleanBaseline/,
    'Dirty state must not return to a timing-based selection hold that can absorb real edits.'
);
assert.match(
    integrations,
    /function dbePresenceDirty\(\) \{[\s\S]{0,120}return dbeHasUnsavedChanges\(\)/,
    'Server presence must use the same corrected dirty-state contract as the visible save cue.'
);
assert.match(
    editing,
    /var dbePresenceDirtyChanged = host\.presenceDirtyChanged[\s\S]+dbePresenceDirtyChanged\(dirty\)/,
    'The visible save cue must publish its computed dirty transition to server presence.'
);
assert.match(
    builder,
    /function dbeSetOwnedInterval\(owner, callback, delay\)[\s\S]+function dbeDestroyOwnedActivity\(owner\)[\s\S]+clearInterval\(interval\.id\)/,
    'Controller-owned intervals must be cancelled with their lifecycle.'
);
assert.match(
    integrations,
    /dbePresenceServerLastDirty === true[\s\S]{0,180}dbePresenceServer\.interval \|\| 20000/,
    'Server presence must renew only a dirty record on the slow cadence.'
);
assert.match(
    integrations,
    /if \(!on\('save_state_cue'\)\)[\s\S]{0,240}dbePresenceServer\.transitionInterval \|\| 2500/,
    'The fast dirty-state scanner must only run when the visible save cue cannot publish transitions.'
);
assert.match(
    integrations,
    /records\[dbePresenceTabId\] = \{ t: Date\.now\(\), title: document\.title \}[\s\S]+delete records\[dbePresenceTabId\]/,
    'Local presence must add and remove only the current tab in its shared registry.'
);
assert.match(
    integrations,
    /dbeControllers\.register\(DBE_PRESENCE_OWNER,[\s\S]+dbePresenceInit\(\)[\s\S]+dbePresenceDestroy\(\)[\s\S]+on\('presence_heartbeat'\)/,
    'Presence resources must participate in the shared controller lifecycle.'
);
assert.match(
    integrations,
    /function dbePresenceDestroy\(\)[\s\S]+dbePresenceDirtyChanged = function \(\) \{\};[\s\S]+dbeDestroyOwnedActivity\(DBE_PRESENCE_OWNER\)[\s\S]+dbePresenceClearLocalBeat\(\)[\s\S]+dbePresenceSendServerBeat\(true, true\)/,
    'Presence teardown must release its publisher, intervals and per-tab records.'
);
assert.match(
    adminBar,
    /function freshestBeat\(value\)[\s\S]+value\.tabs[\s\S]+sort\(function \(a, b\)[\s\S]+var beat = freshestBeat\(stored\)/,
    'The admin-bar warning must accept legacy beats and choose the freshest v2 tab record.'
);
assert.match(
    adminBar,
    /get_node\( 'builderius' \)[\s\S]+add_node\([\s\S]+?'id'\s+=> 'builderius'[\s\S]+?'tabindex' => 0[\s\S]+?get_node\( 'builderius-applied-template' \)/,
    'The native Builderius admin-bar trigger must gain a Tab stop before DBE checks for the native edit link.'
);
assert.match(
    adminBar,
    /get_node\( 'builderius-applied-template' \)[\s\S]+?return;[\s\S]+?dbe_builderius_runtime_cache\(\)/,
    'The reflection-based edit link must remain a fallback after Builderius supplies its own item.'
);
assert.match(
    adminBar,
    /closest\('#wp-admin-bar-builderius-applied-template > a, #wp-admin-bar-dbe-open-template > a'\)/,
    'Duplicate-tab protection must follow both the native link and DBE’s downgrade fallback.'
);
assert.match(
    adminBar,
    /function enhanceBuilderiusMenu\(\)[\s\S]+function setMenuOpen\(open\)[\s\S]+classList\.toggle\('hover', open\)[\s\S]+aria-expanded[\s\S]+trigger\.addEventListener\('focus'[\s\S]+setMenuOpen\(true\)/,
    'Focusing the native Builderius trigger must expose its submenu and expanded state.'
);
assert.match(
    adminBar,
    /document\.readyState === 'loading'[\s\S]+DOMContentLoaded[\s\S]+enhanceBuilderiusMenu\(\)/,
    'Admin-bar keyboard wiring must wait until WordPress has rendered the toolbar after DBE’s footer hook.'
);
assert.match(
    adminBar,
    /dbe-adminbar-builderius-focus[\s\S]+--dbe-adminbar-accent: #72aee6[\s\S]+--dbe-adminbar-interaction-text: #f0f6fc[\s\S]+:focus-visible[\s\S]+box-shadow: inset 0 0 0 2px currentColor[\s\S]+\[role="menuitemradio"\]:focus-visible[\s\S]+box-shadow: inset 0 0 0 2px var\(--dbe-adminbar-accent\)[\s\S]+forced-colors: active[\s\S]+outline-offset: -2px/,
    'The native Builderius trigger and submenu items must expose consistent inset focus cues with a forced-colours fallback.'
);
assert.match(
    adminBar,
    /#wp-admin-bar-builderius-preview-mode > \.ab-item[\s\S]+padding-inline: 0[\s\S]+\[role="menuitemradio"\][\s\S]+padding-inline: 10px[\s\S]+width: 100%/,
    'Preview choices must fill the same menu width as the native edit link without moving their text.'
);
assert.match(
    adminBar,
    /\[role="menuitemradio"\]:not\(\[aria-disabled="true"\]\):hover,[\s\S]+a\[role="menuitem"\]:hover[\s\S]+background-color: var\(--dbe-adminbar-interaction\)[\s\S]+color: var\(--dbe-adminbar-interaction-text\)/,
    'Available preview choices and the native edit link must share one higher-contrast hover treatment while the disabled choice remains static.'
);
assert.match(
    adminBar,
    /previewGroup\.setAttribute\('role', 'group'\)[\s\S]+aria-labelledby[\s\S]+item\.setAttribute\('role', 'menuitemradio'\)[\s\S]+aria-checked[\s\S]+aria-disabled/,
    'The native preview-mode choices must form a labelled radio group with explicit selected and disabled state.'
);
assert.match(
    adminBar,
    /function menuItems\(\)[\s\S]+\[role="menuitemradio"\], a\[role="menuitem"\][\s\S]+function setRovingItem\(item\)[\s\S]+tabindex[\s\S]+function focusItem\(index\)[\s\S]+setRovingItem\(null\)/,
    'Every native preview choice and edit link must start outside the Tab order and participate in one roving menu sequence.'
);
assert.match(
    adminBar,
    /e\.key !== 'ArrowDown'[\s\S]+e\.key !== 'ArrowUp'[\s\S]+focusItem[\s\S]+e\.key === 'Escape'[\s\S]+trigger\.focus\(\)[\s\S]+e\.key === 'Home'[\s\S]+e\.key === 'End'[\s\S]+aria-disabled[\s\S]+current\.click\(\)/,
    'The native Builderius menu must support complete arrow navigation, guarded activation and Escape focus return.'
);
assert.match(
    adminBar,
    /addEventListener\('focusout'[\s\S]+relatedTarget[\s\S]+setMenuOpen\(false\)/,
    'The native Builderius menu must close after keyboard focus leaves it.'
);
assert.match(
    coreRuntime,
    /function createMutationRouter\(refresh\)[\s\S]+new MutationObserver\(refresh\)[\s\S]+observer\.observe\(observation\.node, observation\.options\)/,
    'Builder-chrome mutations must route through one shared observer with targeted roots.'
);
assert.match(
    builder,
    /var dbeChromeObserver = dbeRuntime\.createMutationRouter\(schedule\)[\s\S]+dbeChromeObserver\.observe\(key, node, options\)/,
    'Feature controllers must register chrome roots through the core observer router.'
);
assert.equal(
    ((builder + workspace + commands + coreRuntime).match(/new MutationObserver/g) || []).length,
    3,
    'Only the shared chrome router, preview-document bridge and temporary preview-width guard may construct observers.'
);
assert.equal(
    (coreRuntime.match(/new MutationObserver\(refresh\)/g) || []).length,
    1,
    'Only the shared chrome mutation router may observe directly into the coalesced schedule.'
);
assert.match(saveCue, /\.dbe-save-cue\.is-clean/, 'The clean save state must be visible.');
assert.match(strings, /'saveClean'\s+=> __\( 'All changes saved'/, 'Clean save copy must remain truthful.');
assert.match(strings, /'saveCleanShort'\s+=> __\( 'Saved'/, 'The responsive clean-state copy must remain concise.');
assert.match(
    editing,
    /dbe-save-cue__full[\s\S]+dbe-save-cue__short[\s\S]+aria-hidden', 'true'/,
    'The save cue must retain full live-region copy alongside its concise visual label.'
);
assert.match(
    topbar,
    /@media \(max-width: 1599px\)/,
    'The fluid top-bar layout must cover the measured DBE/native-control collision range.'
);
assert.match(
    palette,
    /\.dbe-palette__input:focus-visible\s*\{[\s\S]*outline:\s*2px solid var\(--dbe-focus\)/,
    'Palette search must retain a visible focus indicator.'
);
const paletteSelectedRule = palette.match(
    /\.dbe-palette__item\[aria-selected="true"\]\s*\{([^}]*)\}/
);
assert.ok(paletteSelectedRule, 'Palette options must expose a selected-state rule.');
assert.match(
    paletteSelectedRule[1],
    /background:\s*var\(--dbe-accent-tint\)/,
    'Pointer-selected palette options must retain the light blue tint.'
);
assert.doesNotMatch(
    paletteSelectedRule[1],
    /outline:/,
    'Pointer-selected palette options must not show the keyboard focus outline.'
);
assert.match(
    palette,
    /\.dbe-palette__item\[aria-selected="true"\]\[data-dbe-active-via="keyboard"\]\s*\{[\s\S]*outline:\s*2px solid var\(--dbe-focus\)/,
    'Keyboard-selected palette options must retain a visible focus outline.'
);
assert.match(
    palette,
    /\.dbe-palette__search-row\s*\{[\s\S]*margin:\s*12px 12px 0[\s\S]*border-radius:\s*var\(--dbe-r-sm\)/,
    'The palette search row must be inset from the dialog edge.'
);
assert.match(
    palette,
    /\.dbe-palette__list\s*\{[\s\S]*padding:\s*12px/,
    'The palette command list must keep a 12px outer inset.'
);
assert.match(
    commands,
    /mouseenter[\s\S]{0,120}setActiveButton\(btn, 'pointer'\)[\s\S]+setActiveButton\(vis2\[next\], 'keyboard'\)/,
    'Palette options must distinguish pointer and keyboard active states.'
);
assert.match(
    commands,
    /if \(e\.key === 'Escape'\) \{[\s\S]{0,180}else \{ dlg\.close\(\); \}/,
    'Palette Escape must close explicitly instead of relying only on browser dialog defaults.'
);
assert.doesNotMatch(
    palette,
    /\.dbe-palette__input:focus-visible\s*\{\s*outline:\s*none/,
    'Palette search must not remove focus without a replacement.'
);
assert.match(
    controls,
    /canvasControl input\[name="width"\][\s\S]+min-block-size:\s*24px/,
    'The canvas width and zoom controls must meet the 24px target minimum.'
);
assert.match(
    controls,
    /saveBtn\.comboBtn \.actions[\s\S]+min-inline-size:\s*24px[\s\S]+min-block-size:\s*24px/,
    'The native Save disclosure target must meet the 24px target minimum.'
);
assert.match(
    commands,
    /dbe-save-menu-btn[\s\S]+aria-haspopup[\s\S]+aria-expanded[\s\S]+ArrowDown[\s\S]+dbeOpenSaveMenu/,
    'The replacement Save disclosure must retain the APG menu-button contract.'
);
assert.match(
    commands,
    /function dbeStampSaveMenu\(menu\)[\s\S]+role', 'menuitem'[\s\S]+tabindex', '-1'[\s\S]+aria-disabled/,
    'Save menu items must remain focusable, named menu items with truthful unavailable states.'
);
assert.match(
    saveMenu,
    /\.dbe-save-menu-btn[\s\S]+inline-size:\s*28px[\s\S]+min-inline-size:\s*28px/,
    'The replacement Save disclosure must exceed the WCAG 2.2 target-size minimum.'
);
assert.match(
    compactPanes,
    /\.dbe-save-menu-btn[\s\S]+display:\s*flex !important[\s\S]+:has\(> \.dbe-save-menu-btn\) \.saveBtn/,
    'Compact mode must preserve both halves of the Save split button.'
);
const saveFeature = features.slice(
    features.indexOf("'save_split_button'     => array("),
    features.indexOf("'css_block_guard'", features.indexOf("'save_split_button'     => array("))
);
assert.doesNotMatch(
    saveFeature,
    /'experimental'\s*=>\s*true/,
    'The live-verified Save menu retrofit should remain a default accessibility feature.'
);
assert.doesNotMatch(
    commands,
    /dbeRevealTimer|setInterval\(function \(\) \{[\s\S]{0,300}revealActiveInTree/,
    'Selection reveal must not return to permanent interval polling.'
);
assert.match(
    commands,
    /dbeBindOwnedEvent\(DBE_COMMANDS_OWNER, doc, 'reveal-selection-click', 'click'[\s\S]+schedule\('canvas-selection'\)/,
    'Canvas selection changes must schedule the controller-owned event-driven reveal path.'
);
assert.match(
    composites,
    /function ensureFavouritesKeyboard\(\)[\s\S]+Favourite elements[\s\S]+orientation: 'vertical'/,
    'Favourite elements must remain a single vertical keyboard toolbar.'
);
assert.match(
    composites,
    /data-dbe-favourite-name[\s\S]+insertFavourite[\s\S]+Insert %s/,
    'Favourite controls must expose an action-led accessible name without changing tree rows.'
);
assert.ok(
    composites.includes('function dbeTreeDisplayLabel(raw, tag)')
        && composites.includes("var idx = raw.indexOf(' .');")
        && composites.includes('var nativeTag = label.match(/^<([a-z][a-z0-9-]*)>$/i);')
        && composites.includes("return '<' + tag + '>' + (!labelIsTag && label ? ' ' + label : '');"),
    'Tag badges must recognise Builderius 1.3.6 native tag labels and remove class suffixes.'
);
const treeDisplayLabelSource = composites.match(/function dbeTreeDisplayLabel\(raw, tag\) \{[\s\S]*?\n        \}/)?.[0];
assert.ok(treeDisplayLabelSource, 'The Navigator display-label helper must remain testable.');
const treeDisplayLabelContext = {};
runInNewContext(`${treeDisplayLabelSource}; result = dbeTreeDisplayLabel;`, treeDisplayLabelContext);
assert.equal(treeDisplayLabelContext.result('<strong> .hero-title', 'strong'), '<strong>');
assert.equal(treeDisplayLabelContext.result('strong .hero-title', 'strong'), '<strong>');
assert.equal(
    treeDisplayLabelContext.result('Documentation homepage .page-content.dbe-docs', 'main'),
    '<main> Documentation homepage'
);
assert.match(
    composites,
    /dbeTreeBadgeRecords\.push\(\{ node: span, html: span\.innerHTML, title: span\.getAttribute\('title'\) \}\)[\s\S]+span\.setAttribute\('title', displayLabel\)[\s\S]+spokenLabel\.textContent = displayLabel[\s\S]+record\.title === null[\s\S]+removeAttribute\('title'\)/,
    'Decorated rows must share one class-free visible, tooltip and accessible label and restore native content on teardown.'
);
assert.match(
    composites,
    /function navSyncAria\(\)[\s\S]+aria-level[\s\S]+aria-posinset[\s\S]+aria-setsize[\s\S]+function ensureNavKeyboard\(\)[\s\S]+navigator-keys/,
    'The composites chunk must own the APG Navigator tree structure and keyboard binding.'
);
assert.match(
    composites,
    /function navPreserveDisclosureFocus\(e\)[\s\S]+chev\.parentElement !== row[\s\S]+branch\.contains\(activeRow\)[\s\S]+e\.preventDefault\(\)[\s\S]+navigator-disclosure-focus[\s\S]+mousedown/,
    'Navigator disclosures must preserve visible row focus unless a collapse would hide the focused descendant.'
);
assert.match(
    navigatorKeyboard,
    /\.uniRightPanel \.uniModTree__item:focus-visible\s*\{[\s\S]*outline:\s*2px solid var\(--dbe-focus\) !important/,
    'Keyboard-focused Navigator rows must retain their visible focus ring.'
);
assert.match(
    navigatorKeyboard,
    /\.uniRightPanel \.uniModTree__item:focus:not\(:focus-visible\)\s*\{[\s\S]*outline:\s*2px solid var\(--dbe-focus\)/,
    'Navigator focus must remain visible in browsers that fall back to :focus.'
);
assert.doesNotMatch(
    composites,
    /data-dbe-focus-via|navSetPointerFocus|navClearPointerFocus/,
    'Navigator focus must not be hidden behind a pointer-modality marker.'
);
assert.match(
    composites,
    /function bindMultiDrag\(\)[\s\S]+multi-drag-start[\s\S]+multi-drag-drop[\s\S]+multi-drag-end[\s\S]+function bindMultiSelect\(\)[\s\S]+'multi-select-' \+ t[\s\S]+multi-select-escape/,
    'Dormant multi-selection listeners must be reversible through composite-controller ownership.'
);
assert.match(
    composites,
    /function applyFavouritesOrder\(\)[\s\S]+function bindFavDrag\(list\)[\s\S]+function dbeResetFavouritesReorder\(\)[\s\S]+function ensureFavouritesReorder\(\)/,
    'Favourites ordering, interaction and teardown must remain in one composite boundary.'
);
assert.match(
    composites,
    /function ensureNativeFavouritesReorder\(list, button\)[\s\S]+aria-pressed[\s\S]+native-favourites-reorder-keys[\s\S]+ArrowUp[\s\S]+ArrowDown[\s\S]+moveNativeFavourite/,
    'Builderius native favourites editing must gain names, state and arrow-key reordering.'
);
assert.match(
    composites,
    /function moveNativeFavourite\(list, li, offset\)[\s\S]+storeSet\('pinnedModules', updated\)[\s\S]+storeSet\('pinnedModulesUpdate', updated\)[\s\S]+movedToPosition/,
    'Keyboard favourite moves must use Builderius persistence and announce the new position.'
);
assert.match(
    composites,
    /function favKey\(li\)[\s\S]+tooltipId__favModule_\(\?!remove_\)[\s\S]+function favSavedOrder\(\)[\s\S]+replace\(\/\^remove_\//,
    'Favourite identity must ignore the native remove-control tooltip and migrate legacy saved keys.'
);
assert.match(
    composites,
    /function applyFavouritesOrder\(\)[\s\S]+if \(nativeFavButton\(\)\) \{ return; \}/,
    'DBE local favourite persistence must step aside when the native editor exists.'
);
assert.match(
    editing,
    /dbe-cond-desc-[\s\S]+Has display conditions[\s\S]+aria-describedby/,
    'Navigator condition state must be exposed as a description rather than renaming the row.'
);
assert.match(
    composites,
    /function dbeSyncInserterAvailability\([\s\S]+lockedForPro[\s\S]+aria-disabled[\s\S]+tabindex', '-1'[\s\S]+inserterComingSoon[\s\S]+stopImmediatePropagation/,
    'Unavailable Inserter elements must be named truthfully, excluded from roving navigation and protected from activation.'
);
assert.match(
    strings,
    /'inserterComingSoon'\s+=> __\( '%s \(coming soon\)'/,
    'Unavailable Inserter copy must keep the visible element name before its availability state.'
);
assert.match(
    inserterKeyboard,
    /data-dbe-unavailable[\s\S]+\.proBadge[\s\S]+border:[\s\S]+@media \(forced-colors: active\)[\s\S]+GrayText/,
    'Unavailable Inserter badges must retain a non-colour state cue in forced-colour modes.'
);
assert.match(
    composites,
    /classList\.contains\('locked'\)[\s\S]+aria-disabled[\s\S]+tabindex', '-1'[\s\S]+footerComingSoon/,
    'Unavailable footer tools must be identified and excluded from the roving sequence.'
);
assert.match(
    strings,
    /'footerComingSoon'\s+=> __\( '%s \(coming soon\)'/,
    'Unavailable-tool copy must describe availability rather than an unexplained lock.'
);
assert.match(
    outputBuilder,
    /matchMedia\('\(max-width: 720px\)'\)[\s\S]+dbeCompactPane = 'canvas'/,
    'Compact sessions must receive a pre-paint canvas view before Builderius mounts.'
);
assert.match(
    workspace,
    /function dbeEnsureCompactSwitcher\(\)[\s\S]+select\.setAttribute\('aria-label', dbeT\('compactView', 'Builder view'\)\)[\s\S]+\['inserter', 'settings', 'canvas', 'navigator'\]/,
    'Compact mode must expose all four builder destinations through a named native select.'
);
assert.match(
    workspace,
    /function ensureCompactPanes\(\)[\s\S]+switcher\.contains\(document\.activeElement\)[\s\S]+switcher\.remove\(\)[\s\S]+frame\.focus\(\)/,
    'Leaving compact mode must remove its switcher and rescue focus from the disappearing control.'
);
assert.match(
    workspace,
    /function dbeSetCompactAccessibility\(\)[\s\S]+dbeSetPanelHiddenState\(wrappers\.left, !leftShown\)[\s\S]+dbeSetPanelHiddenState\(wrappers\.right, !navigatorShown\)[\s\S]+dbeSetPanelHiddenState\(iframe, !canvasShown\)/,
    'Compact mode must remove every hidden workspace destination from the accessibility tree.'
);
assert.match(
    workspace,
    /compactViewChanged[\s\S]+dbeSetOwnedTimeout\(DBE_WORKSPACE_OWNER, function \(\) \{ dbeFocusArea\(pane, true\); \}/,
    'Compact view changes must be announced and move focus to the chosen destination.'
);
assert.match(
    commands,
    /if \(!dbeCompactActive\(\)\)[\s\S]+hideSidePanels[\s\S]+goToNavigator/,
    'Wide-view panel visibility commands must not masquerade as compact-view controls.'
);
assert.match(
    workspace,
    /function dbeSidePanelsButton\(\)[\s\S]+:is\(\.uniPanelButton, \.uniPanelIconButton\)[\s\S]+M14\.4551/,
    'The full-width canvas control must support both Builderius button classes.'
);
assert.match(
    workspace,
    /function dbeSetNativeFullScreen\(hidden\)[\s\S]+storeGet\('forceFullScreen'\)[\s\S]+storeSet\('forceFullScreen', hidden\)[\s\S]+persisted-panels[\s\S]+dbeSavePanelVisibility\([\s\S]+nativeSynced \|\| \(!nextHidden && !nativeHidden\)/,
    'The full-width control must reconcile persisted visibility with Builderius native full-screen state.'
);
const nativeFullScreenSource = workspace.slice(
    workspace.indexOf('function dbeSetNativeFullScreen'),
    workspace.indexOf('function dbeSyncPanelToggle')
).trim();
let nativeFullScreenState = false;
const nativeFullScreenWrites = [];
const nativeFullScreenContext = {
    store: () => ({
        storeGet: () => nativeFullScreenState,
        storeSet: (name, value) => {
            nativeFullScreenWrites.push([name, value]);
            nativeFullScreenState = value;
        }
    })
};
runInNewContext(`${nativeFullScreenSource}; result = dbeSetNativeFullScreen;`, nativeFullScreenContext);
assert.equal(nativeFullScreenContext.result(true), true);
assert.equal(nativeFullScreenState, true);
assert.equal(JSON.stringify(nativeFullScreenWrites), JSON.stringify([['forceFullScreen', true]]));
assert.equal(nativeFullScreenContext.result(true), true);
assert.equal(nativeFullScreenWrites.length, 1, 'An unchanged native full-screen state must not be rewritten.');
nativeFullScreenContext.store = () => null;
assert.equal(nativeFullScreenContext.result(false), false, 'A missing store bridge must leave the native click available.');
assert.match(
    workspace,
    /function dbeSetPanelVisibility\(side, hidden\)[\s\S]+!hidden && dbePanelsAreHidden\(\)[\s\S]+dbeSetNativeFullScreen\(false\)[\s\S]+function dbeToggleSidePanels\(done\)[\s\S]+dbeSetNativeFullScreen\(wantHidden\)[\s\S]+button\.click\(\)/,
    'Partial-panel and command-palette routes must leave native full screen coherently.'
);
assert.match(
    builder,
    /uniTopPanel__rightCol :is\(\.uniPanelButton, \.uniPanelIconButton\)[\s\S]+M14\.4551[\s\S]+hideSidePanels/,
    'The 1.3.6 full-width canvas icon must retain its accessible name and tooltip.'
);
assert.match(compactPanes, /@media \(max-width: 720px\)/, 'Compact workspace layout must activate at its documented breakpoint.');
assert.match(
    compactPanes,
    /data-dbe-compact-pane="inserter"[\s\S]+data-dbe-compact-pane="settings"[\s\S]+data-dbe-compact-pane="navigator"/,
    'Compact CSS must provide explicit Element library, Element settings and Navigator views.'
);
assert.doesNotMatch(
    compactPanes,
    /max-width:\s*359px/,
    'The command palette must remain visibly voice-addressable at 320 CSS pixels.'
);
assert.match(
    tabs,
    /\.uniScopeControl\s*\{[\s\S]+display:\s*flex !important[\s\S]+inline-size:\s*100% !important[\s\S]+\.uniScopeControl button\s*\{[\s\S]+flex:\s*1 1 0 !important/,
    'Global and Template scope tabs must divide the full code-mode sidebar width.'
);

[tokens, tabs, focus, treeRows, saveCue, previewResize, panelResize, compactPanes].forEach((css) => {
    assert.match(css, /@media \(forced-colors: active\)/, 'Accessibility CSS must retain a forced-colours treatment.');
});
assert.match(tokens, /--dbe-focus:\s*Highlight/, 'The focus token must resolve to a system colour in forced-colour mode.');

console.log('Accessibility source regressions passed.');
