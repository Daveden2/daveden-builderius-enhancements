/**
 * Source-level contracts for the segmented Builderius core runtime.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

const coreRuntime = read('assets/builder/js/core-runtime.js');
const a11y = read('assets/builder/js/chunks/a11y.js');
const composites = read('assets/builder/js/chunks/a11y-composites.js');
const workspace = read('assets/builder/js/chunks/workspace.js');
const editing = read('assets/builder/js/chunks/editing.js');
const styles = read('assets/builder/js/chunks/styles.js');
const integrations = read('assets/builder/js/chunks/integrations.js');
const commands = read('assets/builder/js/chunks/commands.js');
const builder = read('assets/builder/js/builder.js');
const cssCache = read('includes/builder-css-cache.php');
const outputBuilder = read('includes/output-builder.php');
const features = read('includes/features.php');
const uninstall = read('uninstall.php');
const updateInfoFallback = read('includes/update-info-fallback.php');
const settingsPage = read('includes/settings-page.php');
const readme = read('readme.txt');

const capabilityWindow = {};
const capabilityContext = {
    window: capabilityWindow,
    document: { documentElement: { dataset: {} } },
    console
};
runInNewContext(coreRuntime, capabilityContext);
const serverConfig = {
    features: { import_html: false, edit_as_html: true },
    builderius: { version: '' }
};
const hardenedRuntime = capabilityWindow.dbeBuilderRuntime.create(serverConfig);
serverConfig.features.import_html = true;
serverConfig.features.edit_as_html = false;
assert.equal(
    hardenedRuntime.on('import_html'),
    false,
    'A disabled server-authored feature must not be enabled by mutating the public config after boot.'
);
assert.equal(
    hardenedRuntime.on('edit_as_html'),
    true,
    'An enabled server-authored feature must retain its boot-time value after public config mutation.'
);

assert.match(
    outputBuilder,
    /require_once DBE_DIR \. 'includes\/builder-css-cache\.php'[\s\S]+dbe_builder_css_bundle\(\)[\s\S]+data-dbe-css-delivery="external"[\s\S]+data-dbe-css-delivery="inline"/,
    'Builder CSS must prefer a direct external bundle and retain an explicit inline fallback.'
);
assert.match(
    cssCache,
    /function dbe_builder_css_cache_signature\( \$files \)[\s\S]+DBE_VERSION[\s\S]+filemtime\( \$path \)[\s\S]+filesize\( \$path \)[\s\S]+hash\( 'sha256'/,
    'The CSS bundle key must cover the plugin version and ordered source-file signature without rereading file bodies.'
);
assert.match(
    cssCache,
    /wp_upload_dir\( null, false, \$refresh \)[\s\S]+dbe-builder-css[\s\S]+builder-' \. \$hash \. '\.css'/,
    'Generated CSS must use a site-specific uploads directory and a content-addressed file name.'
);
assert.match(
    cssCache,
    /function_exists\( 'wp_tempnam' \)[\s\S]+require_once ABSPATH \. 'wp-admin\/includes\/file\.php';[\s\S]+wp_tempnam\( \$filename, \$directory \)[\s\S]+file_put_contents\( \$temporary, \$css, LOCK_EX \)[\s\S]+rename\( \$temporary, \$path \)/,
    'A cache miss must load the WordPress file API before publishing through a locked temporary file and atomic rename.'
);
assert.match(
    cssCache,
    /count\( \$matches \) <= 8[\s\S]+\^builder-\[a-f0-9\]\{64\}[\s\S]+wp_delete_file\( \$path \)/,
    'Cache pruning must retain a bounded set and delete only strict plugin-owned bundle names.'
);
assert.match(
    uninstall,
    /dbe-builder-css[\s\S]+\^builder-\[a-f0-9\]\{64\}[\s\S]+wp_delete_file\( \$cache_file \)/,
    'Uninstall must remove content-addressed CSS bundles from every site cache.'
);
assert.match(
    uninstall,
    /\$wpdb->query\(\s*\$wpdb->prepare\(/,
    'The bulk uninstall query must be visibly prepared at its query sink.'
);
assert.match(
    updateInfoFallback,
    /require_once DBE_DIR \. 'vendor\/plugin-update-checker\/vendor\/PucReadmeParser\.php';/,
    'The bundled readme parser include must use a fixed plugin-relative path.'
);
assert.match(
    settingsPage,
    /<label class="dbe-settings-tools__search" for="dbe-feature-search">[\s\S]+<input id="dbe-feature-search" type="search"/,
    'The feature search label must have an explicit association with its input.'
);
assert.match(
    readme,
    /^License: GPL-2\.0-or-later$/m,
    'The directory readme must use the SPDX identifier declared by the plugin package.'
);

assert.match(
    outputBuilder,
    /dbe-builder-runtime-js[\s\S]+dbe-builder-a11y-js[\s\S]+dbe-builder-a11y-composites-js[\s\S]+dbe-builder-workspace-js[\s\S]+dbe-builder-editing-js[\s\S]+dbe-builder-styles-js[\s\S]+dbe-builder-integrations-js[\s\S]+dbe-builder-commands-js[\s\S]+dbe-builder-enhancements-js/,
    'The core runtime and feature chunks must load synchronously before the feature host.'
);
assert.match(
    outputBuilder,
    /filemtime\( \$a11y_path \)[\s\S]+assets\/builder\/js\/chunks\/a11y\.js/,
    'The accessibility chunk must use the same filemtime cache-busting contract as the host.'
);
assert.match(
    outputBuilder,
    /filemtime\( \$a11y_composites_path \)[\s\S]+assets\/builder\/js\/chunks\/a11y-composites\.js/,
    'The composites chunk must use the same filemtime cache-busting contract as the host.'
);
assert.match(
    outputBuilder,
    /filemtime\( \$workspace_path \)[\s\S]+assets\/builder\/js\/chunks\/workspace\.js/,
    'The workspace chunk must use the same filemtime cache-busting contract as the host.'
);
assert.match(
    outputBuilder,
    /filemtime\( \$editing_path \)[\s\S]+assets\/builder\/js\/chunks\/editing\.js/,
    'The editing chunk must use the same filemtime cache-busting contract as the host.'
);
assert.match(
    outputBuilder,
    /filemtime\( \$styles_path \)[\s\S]+assets\/builder\/js\/chunks\/styles\.js/,
    'The styles chunk must use the same filemtime cache-busting contract as the host.'
);
assert.match(
    outputBuilder,
    /filemtime\( \$integrations_path \)[\s\S]+assets\/builder\/js\/chunks\/integrations\.js/,
    'The integrations chunk must use the same filemtime cache-busting contract as the host.'
);
assert.match(
    outputBuilder,
    /filemtime\( \$commands_path \)[\s\S]+assets\/builder\/js\/chunks\/commands\.js/,
    'The commands chunk must use the same filemtime cache-busting contract as the host.'
);
assert.match(
    builder,
    /var dbeRuntimeFactory = window\.dbeBuilderRuntime[\s\S]+dbeRuntimeFactory\.create\(window\.dbeBuilderEnhancements \|\| \{\}\)/,
    'The feature runtime must capture the core factory and configured context.'
);
assert.match(
    a11y,
    /chunks\.a11y = function \(host\)[\s\S]+host\.setAttributeRecorder\(rememberAttributes\)[\s\S]+host\.controllers\.register\('a11y\/chrome'/,
    'The accessibility chunk must register through an explicit host contract.'
);
assert.match(
    builder,
    /var dbeA11yChunk = window\.dbeBuilderChunks[\s\S]+dbeA11yChunk\(Object\.freeze\([\s\S]+setAttributeRecorder/,
    'The feature host must provide the accessibility chunk a frozen, narrow service surface.'
);
assert.match(
    builder,
    /dataset\.dbeChunkError = 'a11y:missing'[\s\S]+Accessibility chunk failed to load/,
    'A missing accessibility chunk must fail soft with a persistent diagnostic.'
);
assert.match(
    composites,
    /chunks\.a11yComposites = function \(host\)[\s\S]+host\.setEnsureGroup\(dbeEnsureGroup\)[\s\S]+dbeControllers\.register\('a11y\/composites'/,
    'The composites chunk must register through an explicit host contract and share its APG group primitive.'
);
assert.match(
    builder,
    /var dbeCompositesChunk = window\.dbeBuilderChunks[\s\S]+dbeCompositesChunk\(Object\.freeze\([\s\S]+builderius: Object\.freeze[\s\S]+multiSelection: Object\.freeze[\s\S]+navigator: Object\.freeze[\s\S]+setNavigatorApi[\s\S]+setEnsureGroup/,
    'The feature host must provide the composites chunk grouped frozen services and receive its shared Navigator API.'
);
assert.doesNotMatch(
    builder,
    /decorateTree:|restoreTreeDecorations:|bindMultiSelect:|bindMultiDrag:|ensureNavKeyboard:|ensureFavouritesReorder:|applyFavouritesOrder:|resetFavouritesReorder:/,
    'The host contract must not retain feature-level composites callbacks.'
);
assert.match(
    composites,
    /host\.setNavigatorApi\(Object\.freeze\([\s\S]+rowById: navRowById[\s\S]+visibleRows: navVisibleRows[\s\S]+toggleExpand: navToggleExpand/,
    'The composites chunk must export its shared Navigator interactions without duplicating their implementation.'
);
assert.match(
    builder,
    /dataset\.dbeChunkError = 'a11y\/composites:missing'[\s\S]+Accessibility composites chunk failed to load/,
    'A missing composites chunk must fail soft with a persistent diagnostic.'
);
assert.match(
    workspace,
    /chunks\.workspace = function \(host\)[\s\S]+host\.setWorkspaceApi\(Object\.freeze\([\s\S]+dbeControllers\.register\(DBE_WORKSPACE_OWNER/,
    'The workspace chunk must register through an explicit host contract and export only its shared actions.'
);
assert.match(
    builder,
    /var dbeWorkspaceChunk = window\.dbeBuilderChunks[\s\S]+dbeWorkspaceChunk\(Object\.freeze\([\s\S]+builderius: Object\.freeze[\s\S]+canvas: Object\.freeze[\s\S]+setWorkspaceApi/,
    'The feature host must provide grouped workspace services and receive its narrow shared API.'
);
assert.doesNotMatch(
    builder,
    /function dbeRefreshWorkspace\(|function ensurePreviewHandles\(|function ensureCompactPanes\(|function ensurePanelHandles\(|function ensureNavDetach\(/,
    'The feature host must not duplicate workspace implementations behind its shared API.'
);
assert.match(
    workspace,
    /host\.setWorkspaceApi\(Object\.freeze\([\s\S]+focusArea: dbeFocusArea[\s\S]+compactActive: dbeCompactActive[\s\S]+panelWrappers: dbePanelWrappers[\s\S]+panelSideHidden: dbePanelSideHidden[\s\S]+toggleSidePanels: dbeToggleSidePanels[\s\S]+setPanelVisibility: dbeSetPanelVisibility/,
    'Commands must receive only the workspace actions they consume.'
);
assert.match(
    builder,
    /dataset\.dbeChunkError = 'workspace:missing'[\s\S]+Workspace chunk failed to load/,
    'A missing workspace chunk must fail soft with a persistent diagnostic.'
);
assert.match(
    editing,
    /chunks\.editing = function \(host\)[\s\S]+dbeControllers\.register\(DBE_EDITING_OWNER[\s\S]+host\.setEditingApi\(Object\.freeze\(/,
    'The editing chunk must register through an explicit host contract and export its shared actions.'
);
assert.match(
    builder,
    /var dbeEditingChunk = window\.dbeBuilderChunks[\s\S]+dbeEditingChunk\(Object\.freeze\([\s\S]+builderius: Object\.freeze[\s\S]+commands: Object\.freeze[\s\S]+setEditingApi/,
    'The feature host must provide grouped editing services and receive its narrow shared API.'
);
assert.doesNotMatch(
    builder,
    /function dbeRefreshEditing\(|function openEditHtmlDialog\(|function hookHistoryCapture\(|function ensureSaveCue\(/,
    'The feature host must not duplicate editing implementations behind its shared API.'
);
assert.match(
    builder,
    /dataset\.dbeChunkError = 'editing:missing'[\s\S]+Editing chunk failed to load/,
    'A missing editing chunk must fail soft with a persistent diagnostic.'
);
assert.match(
    styles,
    /chunks\.styles = function \(host\)[\s\S]+dbeControllers\.register\(DBE_STYLES_OWNER[\s\S]+host\.setStylesApi\(Object\.freeze\(/,
    'The styles chunk must register through an explicit host contract and export its shared actions.'
);
assert.match(
    builder,
    /var dbeStylesChunk = window\.dbeBuilderChunks[\s\S]+dbeStylesChunk\(Object\.freeze\([\s\S]+builderius: Object\.freeze[\s\S]+editing: Object\.freeze[\s\S]+commands: Object\.freeze[\s\S]+setStylesApi/,
    'The feature host must provide grouped styles services and receive its narrow shared API.'
);
assert.doesNotMatch(
    builder,
    /function dbeRefreshStyles\(|function openStyleInspector\(|function openCssHintDialog\(|function dbeDisableMinimap\(/,
    'The feature host must not duplicate styles implementations behind its shared API.'
);
assert.match(
    builder,
    /dataset\.dbeChunkError = 'styles:missing'[\s\S]+Styles chunk failed to load/,
    'A missing styles chunk must fail soft with a persistent diagnostic.'
);
assert.match(
    integrations,
    /chunks\.integrations = function \(host\)[\s\S]+function registerTerminalIntegration\(\)[\s\S]+function registerPresenceIntegration\(\)[\s\S]+host\.setIntegrationsApi\(Object\.freeze\(/,
    'The integrations chunk must expose separate registrars so the host can preserve controller order.'
);
assert.match(
    builder,
    /var dbeIntegrationsChunk = window\.dbeBuilderChunks[\s\S]+dbeIntegrationsChunk\(Object\.freeze\([\s\S]+observeFooter:[\s\S]+editing: Object\.freeze[\s\S]+setIntegrationsApi[\s\S]+dbeRegisterTerminalIntegration\(\)[\s\S]+dbeRegisterPresenceIntegration\(\)/,
    'The feature host must provide integrations shared services and invoke both lifecycle registrars.'
);
assert.doesNotMatch(
    builder,
    /function ensureTerminalTabs\(|function dbePresenceInit\(|function dbePresenceSendServerBeat\(/,
    'The feature host must not duplicate terminal or presence implementations.'
);
assert.match(
    builder,
    /dataset\.dbeChunkError = 'integrations:missing'[\s\S]+Integrations chunk failed to load/,
    'A missing integrations chunk must fail soft with a persistent diagnostic.'
);
assert.match(
    commands,
    /chunks\.commands = function \(host\)[\s\S]+dbeControllers\.register\(DBE_COMMANDS_OWNER[\s\S]+host\.setCommandsApi\(Object\.freeze\(/,
    'The commands chunk must register through an explicit host contract and export only shared actions.'
);
assert.match(
    builder,
    /var dbeCommandsChunk = window\.dbeBuilderChunks[\s\S]+dbeCommandsChunk\(Object\.freeze\([\s\S]+multiSelection: Object\.freeze[\s\S]+navigator: Object\.freeze[\s\S]+editing: Object\.freeze[\s\S]+styles: Object\.freeze[\s\S]+workspace: Object\.freeze[\s\S]+setCommandsApi/,
    'The feature host must provide grouped frozen command services and receive its narrow shared API.'
);
assert.doesNotMatch(
    builder,
    /function dbeRefreshCommands\(|function openCommandPalette\(|function onContextMenuShow\(|function ensureTreeSearch\(|function ensureRowActions\(/,
    'The feature host must not duplicate commands implementations behind its shared API.'
);
assert.match(
    commands,
    /host\.setCommandsApi\(Object\.freeze\([\s\S]+driveContextMenuItem:[\s\S]+makeContextItem:[\s\S]+canvasInteractive:[\s\S]+syncSelectionContext:/,
    'The commands chunk must export its small cross-domain service surface explicitly.'
);
assert.match(
    builder,
    /dataset\.dbeChunkError = 'commands:missing'[\s\S]+Commands chunk failed to load/,
    'A missing commands chunk must fail soft with a persistent diagnostic.'
);
assert.match(
    builder,
    /Core runtime failed to load; enhancements were not started/,
    'A missing prerequisite must fail closed with a diagnostic instead of partially wiring features.'
);
assert.match(
    coreRuntime,
    /function createTranslations\(config\)[\s\S]+translate: translate[\s\S]+format: format[\s\S]+plural: plural/,
    'Translations and formatting must live in the shared runtime context.'
);
assert.match(
    coreRuntime,
    /function createScheduler\(refresh\)[\s\S]+requestAnimationFrame[\s\S]+schedule\.cancel/,
    'The shared scheduler must coalesce refreshes and expose lifecycle cancellation.'
);
assert.match(
    builder,
    /var dbeScheduleRefresh = dbeRuntime\.createScheduler\([\s\S]+function schedule\(reason\) \{[\s\S]+dbeScheduleRefresh\(\)/,
    'The feature refresh pass must run through the shared scheduler.'
);
const sharedRefresh = builder.slice(
    builder.indexOf('var dbeScheduleRefresh = dbeRuntime.createScheduler'),
    builder.indexOf('function schedule(reason)')
);
assert.match(
    sharedRefresh,
    /dbeControllers\.refresh\(refreshReason\)/,
    'The shared refresh pass must delegate feature work to lifecycle controllers.'
);
assert.doesNotMatch(
    sharedRefresh,
    /ensure|decorateTree|applyTreeFilter|applyFavouritesOrder/,
    'The shared refresh pass must not retain feature-specific work.'
);
const boot = builder.slice(builder.indexOf('function boot()'), builder.indexOf('dbeRuntime.whenReady(boot)'));
assert.doesNotMatch(
    boot,
    /dbeObserveChrome\(|main-panel|top-panel|needNavigatorObservation|needMainObservation/,
    'Boot must not retain legacy feature observation roots outside controllers.'
);
assert.match(
    composites,
    /function dbeRefreshA11yComposites\(\)[\s\S]+decorateTree\(\)[\s\S]+ensureNavKeyboard\(\)[\s\S]+ensureFavouritesReorder\(\)[\s\S]+function destroyA11yComposites\(\)[\s\S]+dbeResetFavouritesReorder\(\)[\s\S]+dbeRestoreTreeDecorations\(\)/,
    'Tree semantics and favourites must refresh and tear down through the composite controller.'
);
assert.match(
    workspace,
    /function dbeRefreshWorkspace\(\)[\s\S]+ensureThemeButton\(\)[\s\S]+ensureDensityButton\(\)[\s\S]+function dbeRestoreWorkspaceState\(\)[\s\S]+dbe-theme-btn[\s\S]+dbe-density-btn/,
    'Theme and density controls must refresh and tear down through the workspace controller.'
);
assert.match(
    editing,
    /function dbeRefreshEditing\(\)[\s\S]+ensureConditionHelpers\(\)[\s\S]+ensurePropertiesReorder\(\)[\s\S]+ensureBlankAttrRow\(\)[\s\S]+function destroyEditing\(\)[\s\S]+dbeResetEditingHelpers\(\)/,
    'Condition, property and attribute helpers must refresh and tear down through the editing controller.'
);
assert.match(
    styles,
    /function dbeRefreshStyles\(\)[\s\S]+ensureCssCodeDefault\(\)[\s\S]+ensureScopeBar\(\)[\s\S]+refreshOpenStyleInspector\(\)[\s\S]+function destroyStyles\(\)[\s\S]+dbeRestoreMinimap\(\)/,
    'CSS editing interfaces must refresh and tear down through the styles controller.'
);
assert.match(
    commands,
    /function dbeRefreshCommands\(\)[\s\S]+ensureCollapseButton\(\)[\s\S]+ensureTreeSearch\(\)[\s\S]+ensureRowActions\(\)[\s\S]+function destroyCommands\(\)[\s\S]+dbe-tree-search[\s\S]+dbe-row-actions/,
    'Navigator command surfaces must refresh and tear down through the commands controller.'
);
assert.match(
    commands,
    /function onItemMenuShow\(\)[\s\S]+data-menu-id\^="module_actions_"[\s\S]+dbeSelectorMenuTarget[\s\S]+function dbeAnchorItemMenu\(menu, btn\)[\s\S]+anchor-name[\s\S]+getBoundingClientRect/,
    'Selector context menus must use the actual opening row as their progressive anchor.'
);
assert.match(
    commands,
    /function dbeRememberContextTarget\(e\)[\s\S]+closest\('\.uniSelectorsCss__item'\)[\s\S]+builderius\.contextMenu\.show'[\s\S]+onItemMenuShow/,
    'The commands controller must remember selector context-menu targets before the native menu opens.'
);
assert.match(
    commands,
    /function dbePreviewContextTarget\(target\)[\s\S]+\^uni-node-\([\s\S]+getClientRects\(\)\.length[\s\S]+function dbePreviewContextTargetAtPoint\(doc, x, y, fallback\)[\s\S]+elementsFromPoint[\s\S]+function dbeOpenPreviewContextMenu\(target, innerX, innerY\)[\s\S]+clickSeq\(row\)[\s\S]+new MouseEvent\('contextmenu'/,
    'Preview context menus must resolve the nearest visible module, select its Navigator row, and reuse the native menu channel.'
);
assert.match(
    commands,
    /function dbePreviewContextPointerDown\(e\)[\s\S]+e\.button !== 2[\s\S]+dbePreviewContextTargetAtPoint[\s\S]+function dbePreviewContextMenu\(e\)[\s\S]+dbeSetOwnedTimeout\(DBE_COMMANDS_OWNER[\s\S]+dbeOpenPreviewContextMenu/,
    'Preview context menus must retain the pre-repaint pointer target and defer the outer menu until Builderius settles.'
);
assert.match(
    commands,
    /function dbePreviewBuilderPoint\(frame, innerX, innerY\)[\s\S]+rect\.width \/ frame\.clientWidth[\s\S]+window\.innerWidth[\s\S]+window\.innerHeight/,
    'Preview pointer coordinates must be translated and clamped in builder viewport space.'
);
assert.match(
    commands,
    /var previewRenamePath = !!previewHeading && on\('preview_rename'\)[\s\S]+dbeDiscardPreviewContext\(false\)[\s\S]+dbeOpenPreviewRename\(id, renderedTarget\)[\s\S]+function dbeOpenPreviewRename\(id, renderedTarget\)[\s\S]+commitRename\(id, next\)[\s\S]+current\.label === next/,
    'Preview Rename must replace the Navigator-inline route, use the native rename channel, and verify the updated module label.'
);
const contextMenuFeature = features.slice(
    features.indexOf("'context_menu'          =>"),
    features.indexOf("'wrap_in'               =>")
);
assert.match(
    contextMenuFeature,
    /'shared_css'\s*=> array\( '04-menu-anchor\.css', '30-context-menu\.css' \)/,
    'The context-menu feature must load the shared progressive anchor rules.'
);
const previewContextMenuFeature = features.slice(
    features.indexOf("'preview_context_menu'  =>"),
    features.indexOf("'preview_rename'        =>")
);
assert.match(
    previewContextMenuFeature,
    /'experimental'\s*=> true/,
    'The 2.1 preview context menu must remain opt-in while its exploration gate is open.'
);
const previewRenameFeature = features.slice(
    features.indexOf("'preview_rename'        =>"),
    features.indexOf("'context_menu'          =>")
);
assert.match(
    previewRenameFeature,
    /'86-preview-rename\.css'[\s\S]+'experimental'\s*=> true/,
    'The 2.1 preview rename dialog must ship its interface styles and remain opt-in.'
);
assert.match(
    coreRuntime,
    /function createMutationRouter\(refresh\)[\s\S]+observe: observe[\s\S]+disconnect: disconnect/,
    'The shared observer router must expose registration and lifecycle cleanup.'
);
assert.match(
    coreRuntime,
    /function mergedObservations\(\)[\s\S]+item\.node === observation\.node[\s\S]+mergeOptions\(existing\.options, observation\.options\)/,
    'Overlapping controller roots must merge into one node observation.'
);
assert.match(
    coreRuntime,
    /function createControllerRegistry\(context\)[\s\S]+register: register[\s\S]+init: init[\s\S]+refresh: refresh[\s\S]+destroy: destroy/,
    'The core runtime must expose the shared controller lifecycle registry.'
);
assert.match(
    coreRuntime,
    /Controller ' \+ item\.id \+ ' failed during ' \+ phase[\s\S]+controllers\.forEach\(function \(item\)[\s\S]+invoke\(item, 'refresh'/,
    'A controller failure must be diagnosed and isolated from the remaining controllers.'
);
assert.match(
    coreRuntime,
    /window\.addEventListener\('pagehide', destroy, \{ once: true \}\)/,
    'Initialised controllers must be destroyed when the builder page is left.'
);
assert.match(
    coreRuntime,
    /function whenReady\(callback\)[\s\S]+DOMContentLoaded[\s\S]+callback\(\)/,
    'The core runtime must own DOM-ready lifecycle entry.'
);
assert.match(builder, /dbeRuntime\.whenReady\(boot\)/, 'The feature runtime must enter through the shared lifecycle helper.');
assert.doesNotMatch(builder, /DBE_BUILDERIUS_ADAPTERS|__builderiusStoreFns/, 'Builderius compatibility knowledge must stay out of feature code.');
// Execute the lifecycle primitives against a small DOM/runtime double so the
// registry contract is behavioural, not only a source-shape assertion.
const lifecycleEvents = {};
const scheduledFrames = [];
const runtimeErrors = [];
const runtimeRoot = { dataset: {} };
const observerInstances = [];
class RuntimeMutationObserver {
    constructor(callback) {
        this.callback = callback;
        this.calls = [];
        observerInstances.push(this);
    }
    disconnect() { this.calls = []; }
    observe(node, options) { this.calls.push({ node, options }); }
}
const runtimeWindow = {
    __builderiusStoreFns: { storeGet: () => null },
    MutationObserver: RuntimeMutationObserver,
    addEventListener: (name, callback) => { lifecycleEvents[name] = callback; },
    console: { error: (...args) => runtimeErrors.push(args), warn: () => {} }
};
const runtimeDocument = {
    readyState: 'complete',
    documentElement: runtimeRoot,
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
};
runInNewContext(coreRuntime, {
    window: runtimeWindow,
    document: runtimeDocument,
    console: runtimeWindow.console,
    MutationObserver: runtimeWindow.MutationObserver,
    requestAnimationFrame: (callback) => {
        scheduledFrames.push(callback);
        return scheduledFrames.length;
    },
    cancelAnimationFrame: () => {}
});

const liveRuntime = runtimeWindow.dbeBuilderRuntime.create({
    builderius: { version: '1.3.6-beta' },
    features: { chrome_landmarks: true }
});
let scheduledRefreshes = 0;
const liveSchedule = liveRuntime.createScheduler(() => { scheduledRefreshes += 1; });
liveSchedule();
liveSchedule();
assert.equal(scheduledFrames.length, 1, 'Repeated scheduler calls must share one animation frame.');
scheduledFrames.shift()();
assert.equal(scheduledRefreshes, 1, 'The coalesced scheduler must refresh exactly once.');

const sharedObserverNode = {};
const mutationRouter = liveRuntime.createMutationRouter(() => {});
mutationRouter.observe('controller-a', sharedObserverNode, {
    childList: true,
    attributes: true,
    attributeFilter: ['class']
});
mutationRouter.observe('controller-b', sharedObserverNode, {
    subtree: true,
    attributes: true,
    attributeFilter: ['style']
});
const mergedObserver = observerInstances[0];
assert.equal(mergedObserver.calls.length, 1, 'One DOM node must be observed once after requirements merge.');
assert.equal(mergedObserver.calls[0].options.childList, true, 'Merged roots must retain child-list observation.');
assert.equal(mergedObserver.calls[0].options.subtree, true, 'Merged roots must retain subtree observation.');
assert.deepEqual(
    Array.from(mergedObserver.calls[0].options.attributeFilter).sort(),
    ['class', 'style'],
    'Merged roots must union compatible attribute filters.'
);
assert.equal(runtimeRoot.dataset.dbeObserverRoots, '1', 'Runtime diagnostics must report physical observer roots.');
mutationRouter.observe('controller-a', null);
assert.equal(mergedObserver.calls.length, 1, 'Removing one owner must retain the shared physical root.');
assert.deepEqual(Array.from(mergedObserver.calls[0].options.attributeFilter), ['style'], 'The remaining owner must retain its own options.');
mutationRouter.observe('controller-b', null);
assert.equal(mergedObserver.calls.length, 0, 'Removing the final owner must release the physical root.');
assert.equal(runtimeRoot.dataset.dbeObserverRoots, '0', 'Released observer roots must update diagnostics.');

const controllerCalls = [];
const registry = liveRuntime.createControllerRegistry(liveRuntime);
registry.register('good', {
    init: (context) => controllerCalls.push(context === liveRuntime ? 'good:init' : 'good:wrong-context'),
    refresh: (reason) => controllerCalls.push(`good:${reason}`),
    destroy: () => controllerCalls.push('good:destroy')
}, true);
registry.register('failing', {
    init: () => controllerCalls.push('failing:init'),
    refresh: () => { throw new Error('expected test failure'); },
    destroy: () => controllerCalls.push('failing:destroy')
}, true);
registry.register('after', {
    init: () => controllerCalls.push('after:init'),
    refresh: (reason) => controllerCalls.push(`after:${reason}`),
    destroy: () => controllerCalls.push('after:destroy')
}, true);
registry.register('disabled', {
    init: () => controllerCalls.push('disabled:init'),
    refresh: () => controllerCalls.push('disabled:refresh'),
    destroy: () => controllerCalls.push('disabled:destroy')
}, false);
registry.init();
registry.refresh('mutation');
assert.deepEqual(
    controllerCalls.slice(0, 5),
    ['good:init', 'failing:init', 'after:init', 'good:mutation', 'after:mutation'],
    'Enabled controllers must initialise in order and a failed refresh must not block the next controller.'
);
assert.equal(runtimeRoot.dataset.dbeControllerCount, '3', 'Only initialised controllers must be counted.');
assert.equal(runtimeRoot.dataset.dbeControllerError, 'failing:refresh', 'The failing controller and phase must be diagnosable.');
assert.equal(runtimeErrors.length, 1, 'A controller failure must produce one diagnostic error.');
assert.equal(typeof lifecycleEvents.pagehide, 'function', 'The registry must bind automatic page teardown.');
lifecycleEvents.pagehide();
assert.deepEqual(
    controllerCalls.slice(-3),
    ['after:destroy', 'failing:destroy', 'good:destroy'],
    'Controllers must destroy in reverse registration order.'
);
assert.equal(runtimeRoot.dataset.dbeControllerCount, '0', 'Destroyed controllers must leave an empty active count.');
assert.ok(!controllerCalls.some((entry) => entry.startsWith('disabled:')), 'Disabled controllers must never enter the lifecycle.');

console.log('Core runtime source regressions passed.');
