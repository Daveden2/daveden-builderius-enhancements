/**
 * Source-level contract for the versioned Builderius runtime adapter.
 *
 * Live browser checks prove the current parent version; these assertions make
 * selector/store drift and unversioned compatibility edits fail in CI.
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
const workspace = read('assets/builder/js/chunks/workspace.js');
const commands = read('assets/builder/js/chunks/commands.js');
const coreRuntime = read('assets/builder/js/core-runtime.js');
const outputBuilder = read('includes/output-builder.php');

assert.match(
    outputBuilder,
    /'builderius'\s*=> array\([\s\S]{0,180}'version'\s*=> function_exists\( 'builderius_get_version' \) \? builderius_get_version\(\) : ''/,
    'Builder config must carry the authoritative parent-plugin version.'
);
assert.match(
    coreRuntime,
    /var DBE_BUILDERIUS_ADAPTERS = \{[\s\S]+?'1\.3': \{[\s\S]+?testedVersion: '1\.3\.5-beta'/,
    'The audited Builderius 1.3 family must have an explicit tested version.'
);
assert.equal(
    (coreRuntime.match(/__builderiusStoreFns/g) || []).length,
    1,
    'The private Builderius store global must be named only inside the adapter.'
);
assert.match(
    coreRuntime,
    /var storeReference = window\[definition\.storeGlobal\][\s\S]+function store\(\) \{[\s\S]+return storeReference;/,
    'The private store must be captured through the selected adapter before Builderius removes its globals.'
);

[
    'mainPanel',
    'topPanel',
    'leftPanel',
    'leftPanelOuter',
    'navigatorPanel',
    'navigatorRows',
    'navigatorTree',
    'canvasPanel',
    'previewFrame',
    'footerPanel',
    'footerBar',
    'saveButton'
].forEach((name) => {
    assert.match(coreRuntime, new RegExp(`\\b${name}:`), `The adapter must define the ${name} contract.`);
});

assert.match(
    coreRuntime,
    /dataset\.dbeBuilderiusTestedVersion = definition\.testedVersion[\s\S]+dataset\.dbeBuilderiusCompatible = String\(compatible\)[\s\S]+dataset\.dbeBuilderiusTested = String\(tested\)[\s\S]+dataset\.dbeBuilderiusStore = storeReference \? 'captured' : 'missing'/,
    'Persistent runtime diagnostics must expose compatibility, exact tested-version and store-capture state.'
);
assert.match(
    a11y,
    /function ensureChromeLandmarks\(\)[\s\S]+host\.query\('topPanel'\)[\s\S]+host\.query\('navigatorPanel'\)[\s\S]+host\.query\('footerPanel'\)/,
    'Shared landmark roots must resolve through the adapter.'
);
assert.match(
    composites,
    /function dbeObserveA11yComposites\(\)[\s\S]+dbeQuery\('topPanel'\)[\s\S]+dbeQuery\('mainPanel'\)/,
    'Controller-owned composite observer roots must resolve through the adapter host.'
);
assert.match(
    workspace,
    /function dbeObserveWorkspace\(\)[\s\S]+dbeQuery\('mainPanel'\)[\s\S]+dbeQuery\('topPanel'\)/,
    'Controller-owned workspace observer roots must resolve through the adapter.'
);
assert.match(
    builder,
    /function dbeObserveEditing\(\)[\s\S]+dbeQuery\('topPanel'\)[\s\S]+dbeQuery\('mainPanel'\)/,
    'Controller-owned editing observer roots must resolve through the adapter.'
);
assert.match(
    commands,
    /function dbeObserveCommands\(\)[\s\S]+dbeQuery\('topPanel'\)[\s\S]+dbeQuery\('mainPanel'\)/,
    'Controller-owned command observer roots must resolve through the adapter host.'
);
assert.match(
    coreRuntime,
    /Builderius ' \+ version[\s\S]+Re-audit the adapter contract/,
    'An untested parent version must produce an explicit compatibility warning.'
);

console.log('Builderius adapter source regressions passed.');
