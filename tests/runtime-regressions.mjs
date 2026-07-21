/**
 * Source-level contracts for the segmented Builderius core runtime.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

const coreRuntime = read('assets/builder/js/core-runtime.js');
const a11y = read('assets/builder/js/chunks/a11y.js');
const composites = read('assets/builder/js/chunks/a11y-composites.js');
const workspace = read('assets/builder/js/chunks/workspace.js');
const builder = read('assets/builder/js/builder.js');
const outputBuilder = read('includes/output-builder.php');

assert.match(
    outputBuilder,
    /dbe-builder-runtime-js[\s\S]+dbe-builder-a11y-js[\s\S]+dbe-builder-a11y-composites-js[\s\S]+dbe-builder-workspace-js[\s\S]+dbe-builder-enhancements-js/,
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
    builder,
    /function dbeRefreshEditing\(\)[\s\S]+ensureConditionHelpers\(\)[\s\S]+ensurePropertiesReorder\(\)[\s\S]+ensureBlankAttrRow\(\)[\s\S]+function destroyEditing\(\)[\s\S]+dbeResetEditingHelpers\(\)/,
    'Condition, property and attribute helpers must refresh and tear down through the editing controller.'
);
assert.match(
    builder,
    /function dbeRefreshCommands\(\)[\s\S]+ensureCollapseButton\(\)[\s\S]+ensureTreeSearch\(\)[\s\S]+ensureRowActions\(\)[\s\S]+function destroyCommands\(\)[\s\S]+dbe-tree-search[\s\S]+dbe-row-actions/,
    'Navigator command surfaces must refresh and tear down through the commands controller.'
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
assert.ok(gzipSync(coreRuntime).length < 35 * 1024, 'The core runtime must remain within the 35 KB compressed bootstrap budget.');
assert.ok(gzipSync(a11y).length < 8 * 1024, 'The first accessibility chunk must remain within an 8 KB compressed budget.');
assert.ok(gzipSync(composites).length < 35 * 1024, 'The composites chunk must remain within a 35 KB compressed budget.');
assert.ok(gzipSync(workspace).length < 25 * 1024, 'The workspace chunk must remain within a 25 KB compressed budget.');

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
    builderius: { version: '1.3.5-beta' },
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
