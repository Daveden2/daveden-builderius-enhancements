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

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

const builder = read('assets/builder/js/builder.js');
const a11y = read('assets/builder/js/chunks/a11y.js');
const composites = read('assets/builder/js/chunks/a11y-composites.js');
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
const strings = read('includes/i18n-builder.php');
const outputBuilder = read('includes/output-builder.php');
const features = read('includes/features.php');
const adminBar = read('includes/admin-bar.php');

assert.match(
    a11y,
    /iframe\.setAttribute\('title', iframeTitle\)/,
    'The canvas iframe must retain an accessible title.'
);
assert.match(
    builder,
    /resizePreviewLeft[\s\S]+resizePreviewRight/,
    'The two canvas resize handles must have distinct accessible names.'
);
assert.match(
    builder,
    /resizePanelLeft[\s\S]+resizePanelRight/,
    'The two panel resize handles must have distinct accessible names.'
);
assert.match(
    composites,
    /navigatorViewTab[\s\S]+Show %s in Navigator/,
    'Navigator view tabs must be distinguishable from similarly named controls.'
);
assert.match(
    builder,
    /set\('aria-valuetext',[\s\S]+pixelsWide/,
    'Canvas resize handles must expose a human-readable width.'
);
assert.match(
    builder,
    /setAttribute\('aria-valuetext',[\s\S]+pixelsWide/,
    'Panel resize handles must expose a human-readable width.'
);
assert.match(
    builder,
    /setAttribute\('aria-keyshortcuts', dbePaletteAriaShortcut\(\)\)/,
    'The command-palette button must expose its configured shortcut.'
);
assert.match(
    builder,
    /save\.setAttribute\('aria-keyshortcuts'/,
    'The Save button must expose Cmd/Ctrl+S when the shortcut is enabled.'
);
assert.match(
    builder,
    /var AREA = \{ KeyO: 'navigator', KeyE: 'settings', KeyP: 'canvas', KeyL: 'inserter', KeyB: 'footer' \}[\s\S]{0,350}input, textarea/,
    'Area-jump shortcuts must run before editable targets suppress element commands.'
);
assert.match(
    builder,
    /else if \(which === 'footer'\)[\s\S]+dbeQuery\('footerBar'\)[\s\S]+button\[tabindex="0"\]/,
    'The direct-focus routes must include the Footer toolbar.'
);
assert.match(
    builder,
    /function dbeFocusArea\(which, compactReady\)[\s\S]+dbeCompactLeftMode\(\) !== which[\s\S]+dbeEnsureCompactLeftMode\(which\)[\s\S]+dbeFocusArea\(which, true\)/,
    'Wide region shortcuts must switch the shared left panel before moving focus.'
);
assert.match(
    builder,
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
    builder,
    /dbeControllers\.register\(DBE_TERMINAL_OWNER,[\s\S]+init: function \(context\)[\s\S]+refresh: function \(reason\)[\s\S]+destroy: function \(\)[\s\S]+destroyTerminalIntegration\(\)/,
    'Sense AI terminal accessibility must participate in the shared controller lifecycle.'
);
assert.match(
    builder,
    /function ensureTerminalTabs\(\)[\s\S]+dbeRememberOwnedAttributes\(DBE_TERMINAL_OWNER, panel[\s\S]+dbeRememberOwnedAttributes\(DBE_TERMINAL_OWNER, t[\s\S]+owner: DBE_TERMINAL_OWNER/,
    'Terminal tabs, their panel and roving group must declare terminal-controller ownership.'
);
assert.match(
    builder,
    /function dbeBindAgentPickerKeys\(\)[\s\S]+dbeBindOwnedEvent\(DBE_TERMINAL_OWNER, document, 'terminal-agent-picker-keys'[\s\S]+dbeSetOwnedTimeout\(DBE_TERMINAL_OWNER, focusItem/,
    'The terminal agent picker must own its delegated keyboard listener and delayed focus retries.'
);
assert.match(
    builder,
    /function dbeBindTerminalEscape\(frame\)[\s\S]+dbeBindOwnedEvent\(DBE_TERMINAL_OWNER, doc, 'terminal-escape-keys'[\s\S]+dbeBindOwnedEvent\(DBE_TERMINAL_OWNER, frame, 'terminal-frame-load'/,
    'Terminal iframes must own both the inner-document escape bridge and frame load listener.'
);
assert.match(
    builder,
    /function destroyTerminalIntegration\(\)[\s\S]+dbeUnobserveFooter\('integrations-terminal-footer'\)[\s\S]+dbeObserveChrome\('integrations-terminal-panel', null\)[\s\S]+dbeDestroyOwnedActivity\(DBE_TERMINAL_OWNER\)[\s\S]+dbeDestroyOwnedGroups\(DBE_TERMINAL_OWNER\)[\s\S]+removeChild\(dbeTerminalEscapeHintNode\)/,
    'Destroying the terminal controller must release observation roots, listeners, timers, ARIA and its hidden hint.'
);
assert.doesNotMatch(
    builder,
    /dbeAgentKeysBound|dbeTerminalEscapeKeyBound|dbeTerminalEscapeLoadBound|terminalBoot|dbeFooterBarNode/,
    'Terminal accessibility must not rely on irreversible flags or an unmanaged boot retry.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('ai_terminal_tabs'\)\) \{ try \{ ensureTerminalTabs\(\)/,
    'The shared refresh pass must not bypass the terminal integration controller.'
);
assert.match(
    builder,
    /dbeControllers\.register\(DBE_WORKSPACE_OWNER,[\s\S]+init: function \(context\)[\s\S]+refresh: function \(reason\)[\s\S]+destroy: function \(\)[\s\S]+destroyWorkspace\(\)/,
    'Workspace features must participate in the shared controller lifecycle.'
);
assert.match(
    builder,
    /function dbeRefreshWorkspace\(\)[\s\S]+ensureCanvasModeControl\(\)[\s\S]+ensurePreviewHandles\(\)[\s\S]+ensureCompactPanes\(\)[\s\S]+dbeSyncPanelsHidden\(\)[\s\S]+ensurePanelHandles\(\)[\s\S]+ensureNavDetach\(\)/,
    'The workspace controller must refresh the complete responsive and sizing surface.'
);
assert.match(
    builder,
    /function dbeRestoreWorkspaceState\(\)[\s\S]+dbePreviewClearOverride\(\)[\s\S]+dbeObserveChrome\('workspace-main', null\)[\s\S]+dbeDestroyOwnedActivity\(DBE_WORKSPACE_OWNER\)[\s\S]+dbeDestroyOwnedGroups\(DBE_WORKSPACE_OWNER\)[\s\S]+\.dbe-preview-handle[\s\S]+dbe-compact-panes[\s\S]+--dbe-nav-h/,
    'Workspace teardown must release observations, activity, generated controls, classes and sizing variables.'
);
assert.match(
    builder,
    /function dbeCompactMedia\(\)[\s\S]+dbeBindOwnedEvent\(DBE_WORKSPACE_OWNER, dbeCompactMql, 'compact-media-change'[\s\S]+function bindNavHeaderDrag\(\)[\s\S]+navigator-drag-start[\s\S]+navigator-drag-cancel/,
    'Compact media and detached-Navigator document listeners must be controller-owned.'
);
assert.doesNotMatch(
    builder,
    /dbeCanvasModeKeyBound|dbePersistedPanelsBound|dbeNavHeaderBound/,
    'Workspace listeners must not rely on irreversible flags.'
);
assert.doesNotMatch(
    builder,
    /if \(on\('preview_resize'\)\) \{ try \{ ensurePreviewHandles\(\)|if \(on\('compact_panes'\)\) \{ try \{ ensureCompactPanes\(\)|if \(on\('panel_resize'\)\) \{ try \{ ensurePanelHandles\(\)|if \(on\('panel_detach'\)\) \{ try \{ ensureNavDetach\(\)/,
    'The shared refresh pass must not bypass the workspace controller.'
);
assert.match(
    builder,
    /dbeControllers\.register\(DBE_COMMANDS_OWNER,[\s\S]+init: function \(context\)[\s\S]+refresh: function \(reason\)[\s\S]+destroy: function \(\)[\s\S]+destroyCommands\(\)/,
    'Command interfaces must participate in the shared controller lifecycle.'
);
assert.match(
    builder,
    /function dbeRefreshCommands\(\)[\s\S]+dbeObserveCommands\(\)[\s\S]+ensurePaletteButton\(\)[\s\S]+ensureKeyboardIframeBridge\(\)[\s\S]+decorateClassChips\(\)/,
    'The commands controller must refresh its top-bar, iframe and class-chip surfaces.'
);
assert.match(
    builder,
    /function dbeOwnedHooksApi\(\)[\s\S]+dbeOwnedHookApi = window\.Builderius\.API\.hooks[\s\S]+function dbeBindOwnedHook\(owner, hook, namespace, callback\)[\s\S]+api\.addAction\(hook, namespace, callback\)[\s\S]+function dbeDestroyOwnedHooks\(owner\)[\s\S]+api\.removeAction\(item\.hook, item\.namespace\)/,
    'Controller-owned Builderius subscriptions must retain their startup API and unsubscribe during teardown.'
);
assert.match(
    builder,
    /input\.setAttribute\('aria-label', dbeT\('searchCommandsLabel', 'Search commands'\)\)/,
    'The command search field must use concise spoken copy independently of its visual placeholder.'
);
assert.match(
    strings,
    /'searchCommandsLabel'\s*=>\s*__\( 'Search commands'/,
    'Command search must provide a dedicated translatable accessible label.'
);
assert.match(
    builder,
    /function dbeBindKeyboardFrameDocument\(frame\)[\s\S]+dbeBindOwnedEvent\(DBE_COMMANDS_OWNER, doc, 'palette-key'[\s\S]+canvas-text-editing-key[\s\S]+canvas-navigation-key[\s\S]+reveal-selection-click/,
    'The preview bridge must own every inner-document keyboard and selection listener.'
);
assert.match(
    builder,
    /function dbeReleaseCommandFrameDocuments\(keepDoc\)[\s\S]+dbeUnbindOwnedEvent\(DBE_COMMANDS_OWNER, record\.doc[\s\S]+record\.observer\.disconnect\(\)[\s\S]+function ensureKeyboardIframeBridge\(\)[\s\S]+canvas-frame-load/,
    'Reloaded preview documents must release listeners and observers before the new bridge binds.'
);
assert.match(
    builder,
    /function setupMenuKeyboard\(container\)[\s\S]+dbeBindOwnedEvent\(DBE_COMMANDS_OWNER, dialog, 'context-menu-keys'/,
    'Native context-menu keyboard handling must be removable with the commands controller.'
);
assert.match(
    builder,
    /function dbeNavigatorContextMenuKeydown\(e\)[\s\S]+e\.key !== 'ContextMenu'[\s\S]+e\.key === 'F10' && e\.shiftKey[\s\S]+row\.dispatchEvent\(new MouseEvent\('contextmenu'[\s\S]+dbeBindOwnedEvent\(DBE_COMMANDS_OWNER, document, 'navigator-context-menu-key'/,
    'Navigator rows must explicitly open their context menu from Shift+F10 and the Menu key.'
);
assert.match(
    builder,
    /function decorateClassChips\(\)[\s\S]+dbeRememberOwnedAttributes\(DBE_COMMANDS_OWNER, li, \['tabindex'\]\)/,
    'Class-chip focusability must restore the native tabindex on teardown.'
);
assert.match(
    builder,
    /function destroyCommands\(\)[\s\S]+dbeObserveChrome\('commands-top', null\)[\s\S]+dbeDestroyOwnedHooks\(DBE_COMMANDS_OWNER\)[\s\S]+dbeReleaseCommandFrameDocuments\(null\)[\s\S]+dbeDestroyOwnedActivity\(DBE_COMMANDS_OWNER\)[\s\S]+dialog\.dbe-palette[\s\S]+dbeKeyboardFrame = null/,
    'Command teardown must release observations, hooks, iframe activity and generated interfaces.'
);
assert.match(
    builder,
    /dbeControllers\.register\(DBE_EDITING_OWNER,[\s\S]+hookHistoryCapture\(\)[\s\S]+bindUndoKeys\(\)[\s\S]+hookImageDefaults\(\)[\s\S]+bindDblclickRename\(\)[\s\S]+destroyEditing\(\)/,
    'Editing hooks and global keys must participate in the shared controller lifecycle.'
);
assert.match(
    builder,
    /function hookHistoryCapture\(\)[\s\S]+dbeBindOwnedHook\(DBE_EDITING_OWNER, 'builderius\.Module\.deleted'[\s\S]+dbeBindOwnedHook\(DBE_EDITING_OWNER, 'builderius\.Module\.added'/,
    'History capture must use removable editing-owned hooks.'
);
assert.match(
    builder,
    /function hookImageDefaults\(\)[\s\S]+dbeBindOwnedHook\(DBE_EDITING_OWNER, 'builderius\.Module\.added'/,
    'Image defaults must use a removable editing-owned hook.'
);
assert.match(
    builder,
    /function bindUndoKeys\(\)[\s\S]+dbeBindOwnedEvent\(DBE_EDITING_OWNER, document, 'history-key'[\s\S]+function bindDblclickRename\(\)[\s\S]+dbeBindOwnedEvent\(DBE_EDITING_OWNER, document, 'double-click-rename'/,
    'Undo and double-click rename listeners must be removable with the editing controller.'
);
assert.match(
    builder,
    /function hookSaveStatus\(\)[\s\S]+dbeBindOwnedHook\([\s\S]+DBE_EDITING_OWNER[\s\S]+builderius\.storeAction\.afterSaveAllSettings[\s\S]+function bindSaveShortcut\(\)[\s\S]+dbeBindOwnedEvent\(DBE_EDITING_OWNER, document, 'save-shortcut'/,
    'Save completion and shortcut handling must use editing-owned hooks and listeners.'
);
assert.match(
    builder,
    /function dbeShowSavedState\(stamp\)[\s\S]+dbeSetOwnedTimeout\(DBE_EDITING_OWNER[\s\S]+function dbeBeginSave\(\)[\s\S]+dbeSetOwnedTimeout\(DBE_EDITING_OWNER/,
    'Saved and failed-state timers must be cancelled with the editing controller.'
);
assert.match(
    builder,
    /function dbeObserveEditing\(\)[\s\S]+editing-top[\s\S]+editing-main[\s\S]+function dbeRefreshEditing\(\)[\s\S]+dbeEnsureSaveShortcutMetadata\(\)[\s\S]+ensureSaveCue\(\)/,
    'Save metadata and status must refresh through editing-owned observation roots.'
);
assert.match(
    builder,
    /function dbeEnsureSaveShortcutMetadata\(\)[\s\S]+dbeRememberOwnedAttributes\(DBE_EDITING_OWNER, save, \['aria-keyshortcuts'\]\)[\s\S]+function destroyEditing\(\)[\s\S]+dbeRestoreOwnedAttributes\(DBE_EDITING_OWNER\)[\s\S]+\.dbe-save-cue/,
    'Editing teardown must restore native Save metadata and remove its generated status.'
);
assert.match(
    builder,
    /function closeRename\(commit, restoreFocus\)[\s\S]+dbeRestoreRenameFocus\(st\.id, st\.focusReturn\)[\s\S]+closeRename\(true, true\)[\s\S]+closeRename\(false, true\)/,
    'Committing or cancelling inline rename from the keyboard must return focus to its tree row.'
);
assert.match(
    builder,
    /function openEditHtmlDialog\(rootId\)[\s\S]+restoreFocusOnClose[\s\S]+dbeSetOwnedTimeout\(DBE_EDITING_OWNER, updatePreview[\s\S]+dbeEditingDialogFocusReturn\(focusReturn\)[\s\S]+function openImportHtmlDialog\(targetId\)[\s\S]+dbeSetOwnedTimeout\(DBE_EDITING_OWNER, refreshPreview[\s\S]+dbeEditingDialogFocusReturn\(focusReturn\)/,
    'HTML editing dialogs must own debounce work and restore focus when dismissed without applying.'
);
assert.match(
    builder,
    /function dbeBindEditingDialogEscape\(dlg, surface\)[\s\S]+\(surface \|\| dlg\)\.addEventListener\('keydown'[\s\S]+e\.key !== 'Escape'[\s\S]+dlg\.close\(\)[\s\S]+dbeBindEditingDialogEscape\(dlg, editor\.el\)/,
    'Editing dialogs must close explicitly on Escape before embedded editors can consume the key.'
);
assert.match(
    builder,
    /opts\.onEscape && typeof ed\.onKeyDown[\s\S]+browserEvent\.key !== 'Escape'[\s\S]+event\.preventDefault\(\)[\s\S]+opts\.onEscape\(\)[\s\S]+ed\.addCommand\(api\.KeyCode\.Escape, opts\.onEscape\)[\s\S]+ed\.addAction\([\s\S]+keybindings: \[api\.KeyCode\.Escape\][\s\S]+escapeKeyListener\.dispose\(\)[\s\S]+onEscape: function \(\) \{ dlg\.close\(\); \}/,
    'Monaco editing dialogs must handle Escape through the editor event and command APIs.'
);
assert.match(
    builder,
    /function destroyEditing\(\)[\s\S]+closeRename\(false, true\)[\s\S]+dbeRemovePriorHtmlDialog\(\)[\s\S]+dbeRemovePriorBemDialog\(\)[\s\S]+undoStack = \[\][\s\S]+dbeDestroyOwnedHooks\(DBE_EDITING_OWNER\)[\s\S]+dbeDestroyOwnedActivity\(DBE_EDITING_OWNER\)/,
    'Editing teardown must remove transient interfaces, history, hooks and owned activity.'
);
assert.match(
    builder,
    /function dbeStampSaveMenu\(menu\)[\s\S]+dbeRememberOwnedAttributes\(DBE_COMMANDS_OWNER, menu[\s\S]+dbeBindOwnedEvent\(DBE_COMMANDS_OWNER, dlg, 'save-menu-close'[\s\S]+function bindSaveMenuKeys\(\)[\s\S]+dbeBindOwnedEvent\(DBE_COMMANDS_OWNER, document, 'save-menu-keys'/,
    'The Save menu must give its generated semantics and document keys to the commands controller.'
);
assert.match(
    builder,
    /function dbeWatchSaveMenuOpen\(focusFirst\)[\s\S]+40, DBE_COMMANDS_OWNER[\s\S]+function revealActiveInTree\(\)[\s\S]+60, DBE_COMMANDS_OWNER/,
    'Save-menu mount polling and selection reveal must use cancellable commands-owned work.'
);
assert.match(
    builder,
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
    /var NEED_STYLES = on\('css_code_default'\)[\s\S]+on\('hide_minimap'\)[\s\S]+dbeControllers\.register\(DBE_STYLES_OWNER,[\s\S]+dbeRefreshStyles\(\)[\s\S]+destroyStyles\(\)/,
    'Style features must participate in one shared controller lifecycle.'
);
assert.match(
    builder,
    /function dbeObserveStyles\(\)[\s\S]+dbeObserveChrome\('styles-main'[\s\S]+function destroyStyles\(\)[\s\S]+dbeObserveChrome\('styles-main', null\)/,
    'The styles controller must own and release its main-panel observation.'
);
assert.match(
    builder,
    /function dbeRefreshStyles\(\)[\s\S]+ensureCssCodeDefault\(\)[\s\S]+ensureCodeModeTabs\(\)[\s\S]+ensureCssHint\(\)[\s\S]+dbeDisableMinimap\(\)[\s\S]+ensureScopeBar\(\)[\s\S]+ensureScopeIsolation\(\)[\s\S]+refreshOpenStyleInspector\(\)/,
    'Style interfaces must refresh through their controller rather than the global scheduler.'
);
assert.match(
    builder,
    /function dbeRestoreMinimap\(\)[\s\S]+dbeMinimapCreateListener\.dispose\(\)[\s\S]+item\.editor\.updateOptions\(\{ minimap: \{ enabled: item\.enabled \} \}\)[\s\S]+dbeMinimapDone = false/,
    'Minimap teardown must dispose the Monaco subscription and restore prior editor state.'
);
assert.match(
    builder,
    /function destroyStyles\(\)[\s\S]+dbeScopeFinish\(\)[\s\S]+dbeDestroyOwnedActivity\(DBE_STYLES_OWNER\)[\s\S]+dbeClearAllCssDecorations\(\)[\s\S]+dbe-css-hint-dialog[\s\S]+dbe-style-inspector[\s\S]+dbe-scope-covered[\s\S]+dbeRestoreMinimap\(\)/,
    'Style teardown must settle transitions, cancel work, remove generated UI and restore Monaco.'
);
assert.match(
    builder,
    /function dbeCloseStyleInspector\(panel\)[\s\S]+preferred && preferred\.isConnected[\s\S]+target\.focus\(\)/,
    'Style inspector dismissal must return focus to a stable invoking control.'
);
assert.match(
    builder,
    /function openCssHintDialog\(\)[\s\S]+dbeCssHintFocusReturn = document\.activeElement[\s\S]+aria-labelledby', 'dbe-css-hint-dialog-title'[\s\S]+title\.id = 'dbe-css-hint-dialog-title'[\s\S]+e\.key === 'Escape'[\s\S]+dlg\.close\(\)[\s\S]+dlg\.addEventListener\('close'[\s\S]+target\.focus\(\)/,
    'Style help must be named, close explicitly on Escape and return focus to its invoking control.'
);
assert.match(
    builder,
    /dbeSetOwnedFrame\(DBE_STYLES_OWNER, waitForContentTab\)[\s\S]+dbeSetOwnedTimeout\(DBE_STYLES_OWNER, done, 6000\)[\s\S]+dbeSetOwnedTimeout\(DBE_STYLES_OWNER, poll, 150\)[\s\S]+dbeSetOwnedTimeout\(DBE_STYLES_OWNER, function \(\) \{ clickSelectorUntilLoaded/,
    'Styles navigation and selector polling must use controller-owned delayed work.'
);
assert.doesNotMatch(
    builder,
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
    builder,
    /dbeSaveInitialisingUntil[\s\S]+state = dbeSaveState \|\| \(dirty \? 'dirty' : 'clean'\)/,
    'The save cue must baseline Builderius hydration and retain an explicit clean state.'
);
assert.match(
    builder,
    /function dbeSaveableSnapshotSignature\(\)[\s\S]+history\[history\.length - 1\][\s\S]+JSON\.stringify\(item\.snapshot\)[\s\S]+snapshotSignature !== saveBaselineSnapshot/,
    'Dirty state must compare saveable snapshots instead of relying on capped history length.'
);
assert.doesNotMatch(
    builder,
    /dbeSaveSelectionTimer|dbeArmSelectionCleanBaseline/,
    'Dirty state must not return to a timing-based selection hold that can absorb real edits.'
);
assert.match(
    builder,
    /function dbePresenceDirty\(\) \{[\s\S]{0,120}return dbeHasUnsavedChanges\(\)/,
    'Server presence must use the same corrected dirty-state contract as the visible save cue.'
);
assert.match(
    builder,
    /var dbePresenceDirtyChanged = function \(\) \{\};[\s\S]+dbePresenceDirtyChanged\(dirty\)/,
    'The visible save cue must publish its computed dirty transition to server presence.'
);
assert.match(
    builder,
    /function dbeSetOwnedInterval\(owner, callback, delay\)[\s\S]+function dbeDestroyOwnedActivity\(owner\)[\s\S]+clearInterval\(interval\.id\)/,
    'Controller-owned intervals must be cancelled with their lifecycle.'
);
assert.match(
    builder,
    /dbePresenceServerLastDirty === true[\s\S]{0,180}dbePresenceServer\.interval \|\| 20000/,
    'Server presence must renew only a dirty record on the slow cadence.'
);
assert.match(
    builder,
    /if \(!on\('save_state_cue'\)\)[\s\S]{0,240}dbePresenceServer\.transitionInterval \|\| 2500/,
    'The fast dirty-state scanner must only run when the visible save cue cannot publish transitions.'
);
assert.match(
    builder,
    /records\[dbePresenceTabId\] = \{ t: Date\.now\(\), title: document\.title \}[\s\S]+delete records\[dbePresenceTabId\]/,
    'Local presence must add and remove only the current tab in its shared registry.'
);
assert.match(
    builder,
    /dbeControllers\.register\(DBE_PRESENCE_OWNER,[\s\S]+dbePresenceInit\(\)[\s\S]+dbePresenceDestroy\(\)[\s\S]+on\('presence_heartbeat'\)/,
    'Presence resources must participate in the shared controller lifecycle.'
);
assert.match(
    builder,
    /function dbePresenceDestroy\(\)[\s\S]+dbePresenceDirtyChanged = function \(\) \{\};[\s\S]+dbeDestroyOwnedActivity\(DBE_PRESENCE_OWNER\)[\s\S]+dbePresenceClearLocalBeat\(\)[\s\S]+dbePresenceSendServerBeat\(true, true\)/,
    'Presence teardown must release its publisher, intervals and per-tab records.'
);
assert.match(
    adminBar,
    /function freshestBeat\(value\)[\s\S]+value\.tabs[\s\S]+sort\(function \(a, b\)[\s\S]+var beat = freshestBeat\(stored\)/,
    'The admin-bar warning must accept legacy beats and choose the freshest v2 tab record.'
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
    ((builder + coreRuntime).match(/new MutationObserver/g) || []).length,
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
    builder,
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
assert.match(
    builder,
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
    builder,
    /dbe-save-menu-btn[\s\S]+aria-haspopup[\s\S]+aria-expanded[\s\S]+ArrowDown[\s\S]+dbeOpenSaveMenu/,
    'The replacement Save disclosure must retain the APG menu-button contract.'
);
assert.match(
    builder,
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
    builder,
    /dbeRevealTimer|setInterval\(function \(\) \{[\s\S]{0,300}revealActiveInTree/,
    'Selection reveal must not return to permanent interval polling.'
);
assert.match(
    builder,
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
assert.match(
    composites,
    /badge\.setAttribute\('aria-hidden', 'true'\)[\s\S]+spokenLabel\.textContent = raw/,
    'Visual tag badges must preserve the native Navigator row name verbatim.'
);
assert.match(
    composites,
    /function navSyncAria\(\)[\s\S]+aria-level[\s\S]+aria-posinset[\s\S]+aria-setsize[\s\S]+function ensureNavKeyboard\(\)[\s\S]+navigator-keys/,
    'The composites chunk must own the APG Navigator tree structure and keyboard binding.'
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
    builder,
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
    builder,
    /function dbeEnsureCompactSwitcher\(\)[\s\S]+select\.setAttribute\('aria-label', dbeT\('compactView', 'Builder view'\)\)[\s\S]+\['inserter', 'settings', 'canvas', 'navigator'\]/,
    'Compact mode must expose all four builder destinations through a named native select.'
);
assert.match(
    builder,
    /function ensureCompactPanes\(\)[\s\S]+switcher\.contains\(document\.activeElement\)[\s\S]+switcher\.remove\(\)[\s\S]+frame\.focus\(\)/,
    'Leaving compact mode must remove its switcher and rescue focus from the disappearing control.'
);
assert.match(
    builder,
    /function dbeSetCompactAccessibility\(\)[\s\S]+dbeSetPanelHiddenState\(wrappers\.left, !leftShown\)[\s\S]+dbeSetPanelHiddenState\(wrappers\.right, !navigatorShown\)[\s\S]+dbeSetPanelHiddenState\(iframe, !canvasShown\)/,
    'Compact mode must remove every hidden workspace destination from the accessibility tree.'
);
assert.match(
    builder,
    /compactViewChanged[\s\S]+dbeSetOwnedTimeout\(DBE_WORKSPACE_OWNER, function \(\) \{ dbeFocusArea\(pane, true\); \}/,
    'Compact view changes must be announced and move focus to the chosen destination.'
);
assert.match(
    builder,
    /\(!on\('compact_panes'\) \|\| !dbeCompactActive\(\)\)[\s\S]+hideSidePanels[\s\S]+goToNavigator/,
    'Wide-view panel visibility commands must not masquerade as compact-view controls.'
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

[tokens, tabs, focus, treeRows, saveCue, previewResize, panelResize, compactPanes].forEach((css) => {
    assert.match(css, /@media \(forced-colors: active\)/, 'Accessibility CSS must retain a forced-colours treatment.');
});
assert.match(tokens, /--dbe-focus:\s*Highlight/, 'The focus token must resolve to a system colour in forced-colour mode.');

console.log('Accessibility source regressions passed.');
