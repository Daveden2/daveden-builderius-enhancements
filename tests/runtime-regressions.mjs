/**
 * Source-level contracts for the segmented Builderius core runtime.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

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
    /var dbeScheduleRefresh = dbeRuntime\.createScheduler\([\s\S]+function schedule\(\) \{[\s\S]+dbeScheduleRefresh\(\)/,
    'The feature refresh pass must run through the shared scheduler.'
);
assert.match(
    coreRuntime,
    /function createMutationRouter\(refresh\)[\s\S]+observe: observe[\s\S]+disconnect: disconnect/,
    'The shared observer router must expose registration and lifecycle cleanup.'
);
assert.match(
    coreRuntime,
    /function whenReady\(callback\)[\s\S]+DOMContentLoaded[\s\S]+callback\(\)/,
    'The core runtime must own DOM-ready lifecycle entry.'
);
assert.match(builder, /dbeRuntime\.whenReady\(boot\)/, 'The feature runtime must enter through the shared lifecycle helper.');
assert.doesNotMatch(builder, /DBE_BUILDERIUS_ADAPTERS|__builderiusStoreFns/, 'Builderius compatibility knowledge must stay out of feature code.');
assert.ok(gzipSync(coreRuntime).length < 35 * 1024, 'The core runtime must remain within the 35 KB compressed bootstrap budget.');

console.log('Core runtime source regressions passed.');
