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
const builder = read('assets/builder/js/builder.js');
const outputBuilder = read('includes/output-builder.php');

assert.match(
    outputBuilder,
    /dbe-builder-runtime-js[\s\S]+dbe-builder-enhancements-js/,
    'The core runtime must load synchronously before the feature runtime.'
);
assert.match(
    builder,
    /var dbeRuntimeFactory = window\.dbeBuilderRuntime[\s\S]+dbeRuntimeFactory\.create\(window\.dbeBuilderEnhancements \|\| \{\}\)/,
    'The feature runtime must capture the core factory and configured context.'
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
