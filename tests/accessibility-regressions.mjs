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

assert.match(
    builder,
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
    builder,
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
    builder,
    /function ensureChromeLandmarks\(\)[\s\S]+dbeAreaAriaShortcut\(shortcutKey\)[\s\S]+regionNavigator[\s\S]+regionFooter/,
    'Named builder regions must expose their direct-focus shortcuts programmatically.'
);
assert.match(
    builder,
    /dbeControllers\.register\('a11y\/chrome',[\s\S]+init: function \(context\)[\s\S]+refresh: function \(reason\)[\s\S]+destroy: function \(\)[\s\S]+destroyA11yChrome\(\)/,
    'Builder landmarks must participate in the shared init, refresh and destroy lifecycle.'
);
assert.match(
    builder,
    /function destroyA11yChrome\(\)[\s\S]+record\.node\.removeAttribute\(name\)[\s\S]+record\.node\.setAttribute\(name, value\)/,
    'Destroying the chrome controller must restore the native landmark and iframe attributes.'
);
assert.match(
    builder,
    /function bindTooltips\(\)[\s\S]+addEventListener\('mouseover', dbeTooltipMouseover\)[\s\S]+function unbindTooltips\(\)[\s\S]+removeEventListener\('mouseover', dbeTooltipMouseover\)/,
    'The chrome controller must own reversible tooltip event listeners.'
);
assert.match(
    builder,
    /function dbeObserveA11yChrome\(\)[\s\S]+a11y-chrome-main[\s\S]+a11y-chrome-top[\s\S]+a11y-chrome-footer/,
    'The chrome controller must declare its own shared observation roots.'
);
assert.match(
    builder,
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
    builder,
    /ensureTopbarToolbars\(\)[\s\S]+owner: 'a11y\/composites'[\s\S]+ensureFooterToolbar\(\)[\s\S]+owner: 'a11y\/composites'/,
    'The breakpoint radio group and footer toolbar must declare composite-controller ownership.'
);
assert.match(
    builder,
    /function ensureInserterKeyboard\(\)[\s\S]+dbeBindOwnedEvent\('a11y\/composites', container, 'inserter-keys'[\s\S]+function ensureFavouritesKeyboard\(\)[\s\S]+owner: 'a11y\/composites'/,
    'Inserter grids and the favourites toolbar must declare composite-controller ownership.'
);
assert.match(
    builder,
    /function ensurePanelTabs\(\)[\s\S]+dbeBindOwnedEvent\('a11y\/composites', strip, 'panel-tabs-keys'[\s\S]+dbeSetOwnedTimeout\('a11y\/composites'/,
    'Panel tablists must own their keyboard, click and delayed-refocus work.'
);
assert.match(
    builder,
    /function bindSelectCombobox\(\)[\s\S]+select-search-keys[\s\S]+select-search-input[\s\S]+select-trigger-keys[\s\S]+multi-select-keys[\s\S]+fake-select-focusout/,
    'Combobox variants must register every delegated listener through the composite controller.'
);
assert.match(
    builder,
    /function dbeAccRefocus\(name\)[\s\S]+dbeSetOwnedFrame\('a11y\/composites'[\s\S]+function ensureSettingsAccordions\(\)[\s\S]+settings-accordion-keys/,
    'Settings accordions must own their remount refocus and keyboard listener.'
);
assert.match(
    builder,
    /function ensureBuilderiusMenu\(\)[\s\S]+dbeRememberOwnedAttributes\('a11y\/composites', trigger[\s\S]+dbeRememberOwnedAttributes\('a11y\/composites', list[\s\S]+builderius-menu-keys/,
    'The Builderius menu trigger, tree and delegated keyboard handling must belong to the composite controller.'
);
assert.match(
    builder,
    /function destroyA11yComposites\(\)[\s\S]+dbeObserveChrome\('a11y-composites-top', null\)[\s\S]+dbeUnobserveFooter\('a11y-composites-footer'\)[\s\S]+dbeDestroyOwnedGroups\('a11y\/composites'\)/,
    'The composite controller must release its top-bar/footer observations and owned DOM state.'
);
assert.match(
    builder,
    /function dbeObserveA11yComposites\(\)[\s\S]+a11y-composites-main[\s\S]+a11y-composites-portals/,
    'The composite controller must own its main-panel and portal observation roots.'
);
assert.doesNotMatch(
    builder,
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
    /function prDirty\(\) \{[\s\S]{0,120}return dbeHasUnsavedChanges\(\)/,
    'Server presence must use the same corrected dirty-state contract as the visible save cue.'
);
assert.match(
    builder,
    /var dbePresenceDirtyChanged = function \(\) \{\};[\s\S]+dbePresenceDirtyChanged\(dirty\)/,
    'The visible save cue must publish its computed dirty transition to server presence.'
);
assert.match(
    builder,
    /setInterval\(function \(\) \{ sendBeat\(true\); \}, pr\.interval \|\| 20000\)/,
    'Server presence keep-alive must use the slow server cadence.'
);
assert.match(
    builder,
    /if \(!on\('save_state_cue'\)\)[\s\S]{0,160}pr\.transitionInterval \|\| 2500/,
    'The fast dirty-state scanner must only run when the visible save cue cannot publish transitions.'
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
    /doc\.addEventListener\('click', function \(\) \{ setTimeout\(schedule, 0\); \}\)/,
    'Canvas selection changes must schedule the event-driven reveal path.'
);
assert.match(
    builder,
    /function ensureFavouritesKeyboard\(\)[\s\S]+Favourite elements[\s\S]+orientation: 'vertical'/,
    'Favourite elements must remain a single vertical keyboard toolbar.'
);
assert.match(
    builder,
    /data-dbe-favourite-name[\s\S]+insertFavourite[\s\S]+Insert %s/,
    'Favourite controls must expose an action-led accessible name without changing tree rows.'
);
assert.match(
    builder,
    /function dbeSyncInserterAvailability\([\s\S]+lockedForPro[\s\S]+inserterComingSoon[\s\S]+aria-disabled[\s\S]+tabindex', '-1'[\s\S]+stopImmediatePropagation/,
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
    builder,
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
