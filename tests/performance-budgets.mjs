/**
 * Deterministic CI budgets for the segmented Builderius runtime.
 *
 * Browser traces remain the final proof for real interaction performance.
 * These checks guard the stable proxies CI can reproduce without Builderius:
 * compressed transfer size, worst-case controller mounts, mutation-burst
 * coalescing and initial script parse/evaluation tasks.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Script, runInNewContext } from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

const assetBudgets = new Map([
    ['assets/builder/js/core-runtime.js', 35 * 1024],
    ['assets/builder/js/chunks/a11y.js', 8 * 1024],
    ['assets/builder/js/chunks/a11y-composites.js', 35 * 1024],
    ['assets/builder/js/chunks/workspace.js', 25 * 1024],
    // Structural HTML analysis, Builderius-aware completions and authoring
    // transforms intentionally live beside the existing edit/import parser.
    ['assets/builder/js/chunks/editing.js', 70 * 1024],
    ['assets/builder/js/chunks/styles.js', 35 * 1024],
    ['assets/builder/js/chunks/integrations.js', 15 * 1024],
    ['assets/builder/js/chunks/shortcuts.js', 8 * 1024],
    ['assets/builder/js/chunks/commands.js', 54 * 1024],
    ['assets/builder/js/builder.js', 20 * 1024]
]);
const chunkPaths = [...assetBudgets.keys()].filter((path) => path.includes('/chunks/'));
const sources = new Map([...assetBudgets.keys()].map((path) => [path, read(path)]));

const gzipResults = [];
for (const [path, budget] of assetBudgets) {
    const bytes = gzipSync(sources.get(path)).length;
    gzipResults.push({ path, bytes, budget });
    assert.ok(bytes <= budget, `${path} is ${bytes} gzip bytes; its CI budget is ${budget}.`);
}

// Each registered controller can perform one initial mount when every toggle
// is active. Count production registrations so adding a controller is an
// explicit budget decision rather than silent extra boot work.
const maxControllerMounts = 8;
const controllerRegistrationPattern = /(?:host\.controllers|dbeControllers)\.register\(/g;
const controllerRegistrations = chunkPaths.reduce((total, path) => {
    return total + (sources.get(path).match(controllerRegistrationPattern) || []).length;
}, 0);
assert.ok(
    controllerRegistrations <= maxControllerMounts,
    `The runtime registers ${controllerRegistrations} controllers; the initial-mount budget is ${maxControllerMounts}.`
);

// Exercise the production scheduler/router/registry rather than a re-created
// model. The doubles supply only browser primitives the core runtime consumes.
const scheduledFrames = [];
const observerInstances = [];
class BudgetMutationObserver {
    constructor(callback) {
        this.callback = callback;
        this.calls = [];
        observerInstances.push(this);
    }
    disconnect() { this.calls = []; }
    observe(node, options) { this.calls.push({ node, options }); }
}
const runtimeRoot = { dataset: {} };
const runtimeWindow = {
    __builderiusStoreFns: { storeGet: () => null },
    MutationObserver: BudgetMutationObserver,
    addEventListener: () => {},
    console: { error: () => {}, warn: () => {} }
};
const runtimeDocument = {
    readyState: 'complete',
    documentElement: runtimeRoot,
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
};
runInNewContext(sources.get('assets/builder/js/core-runtime.js'), {
    window: runtimeWindow,
    document: runtimeDocument,
    console: runtimeWindow.console,
    MutationObserver: BudgetMutationObserver,
    requestAnimationFrame: (callback) => {
        scheduledFrames.push(callback);
        return scheduledFrames.length;
    },
    cancelAnimationFrame: () => {}
});

const runtime = runtimeWindow.dbeBuilderRuntime.create({
    builderius: { version: '1.3.6-beta' },
    features: {}
});
let mountCalls = 0;
const registry = runtime.createControllerRegistry(runtime);
for (let index = 0; index < controllerRegistrations; index += 1) {
    registry.register(`budget-controller-${index}`, { init: () => { mountCalls += 1; } }, true);
}
registry.init();
registry.init();
assert.equal(mountCalls, controllerRegistrations, 'Every enabled controller must mount exactly once.');
assert.ok(mountCalls <= maxControllerMounts, 'Initial controller mount work exceeded its CI budget.');

const observerBurstSize = 50;
const maxRefreshesPerObserverBurst = 1;
let observerRefreshes = 0;
const scheduledObserverRefresh = runtime.createScheduler(() => { observerRefreshes += 1; });
const mutationRouter = runtime.createMutationRouter(scheduledObserverRefresh);
mutationRouter.observe('performance-budget-root', {}, { childList: true });
const routedObserver = observerInstances.at(-1);
for (let index = 0; index < observerBurstSize; index += 1) {
    routedObserver.callback([]);
}
assert.equal(scheduledFrames.length, 1, 'A mutation burst must queue one animation frame.');
scheduledFrames.shift()();
assert.ok(
    observerRefreshes <= maxRefreshesPerObserverBurst,
    `A ${observerBurstSize}-callback mutation burst caused ${observerRefreshes} refreshes; the budget is ${maxRefreshesPerObserverBurst}.`
);

// A browser long task starts at 50 ms. Repeated Node VM medians are a stable
// CI proxy for the synchronous parse and top-level evaluation work of each
// initial script; browser interaction traces remain a separate manual gate.
const longTaskMs = 50;
const timingSamples = 9;
const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const taskResults = [];
for (const [path, source] of sources) {
    const samples = [];
    for (let sample = 0; sample < timingSamples; sample += 1) {
        const started = performance.now();
        const script = new Script(source, { filename: path });
        const quietConsole = { error: () => {}, warn: () => {} };
        script.runInNewContext({ window: { console: quietConsole }, console: quietConsole });
        samples.push(performance.now() - started);
    }
    const duration = median(samples.slice(1));
    taskResults.push({ path, duration });
    assert.ok(duration < longTaskMs, `${path} has a ${duration.toFixed(2)} ms median initial task; the budget is below ${longTaskMs} ms.`);
}

console.log('Performance budgets passed.');
gzipResults.forEach(({ path, bytes, budget }) => console.log(`gzip ${path}: ${bytes}/${budget} bytes`));
console.log(`controller mounts: ${mountCalls}/${maxControllerMounts}`);
console.log(`observer burst refreshes: ${observerRefreshes}/${maxRefreshesPerObserverBurst} (${observerBurstSize} callbacks)`);
taskResults.forEach(({ path, duration }) => console.log(`initial task ${path}: ${duration.toFixed(2)}/${longTaskMs} ms median`));
