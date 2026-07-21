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
const outputBuilder = read('includes/output-builder.php');

assert.match(
    outputBuilder,
    /'builderius'\s*=> array\([\s\S]{0,180}'version'\s*=> function_exists\( 'builderius_get_version' \) \? builderius_get_version\(\) : ''/,
    'Builder config must carry the authoritative parent-plugin version.'
);
assert.match(
    builder,
    /var DBE_BUILDERIUS_ADAPTERS = \{[\s\S]+?'1\.3': \{[\s\S]+?testedVersion: '1\.3\.5-beta'/,
    'The audited Builderius 1.3 family must have an explicit tested version.'
);
assert.equal(
    (builder.match(/__builderiusStoreFns/g) || []).length,
    1,
    'The private Builderius store global must be named only inside the adapter.'
);
assert.match(
    builder,
    /var dbeBuilderiusStore = window\[dbeBuilderiusAdapter\.storeGlobal\][\s\S]+function store\(\) \{[\s\S]+return dbeBuilderiusStore;/,
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
    assert.match(builder, new RegExp(`\\b${name}:`), `The adapter must define the ${name} contract.`);
});

assert.match(
    builder,
    /dataset\.dbeBuilderiusTestedVersion = dbeBuilderiusAdapter\.testedVersion[\s\S]+dataset\.dbeBuilderiusCompatible = String\(dbeBuilderiusCompatible\)[\s\S]+dataset\.dbeBuilderiusTested = String\(dbeBuilderiusTested\)[\s\S]+dataset\.dbeBuilderiusStore = dbeBuilderiusStore \? 'captured' : 'missing'/,
    'Persistent runtime diagnostics must expose compatibility, exact tested-version and store-capture state.'
);
assert.match(
    builder,
    /function ensureChromeLandmarks\(\)[\s\S]+dbeQuery\('topPanel'\)[\s\S]+dbeQuery\('navigatorPanel'\)[\s\S]+dbeQuery\('footerPanel'\)/,
    'Shared landmark roots must resolve through the adapter.'
);
assert.match(
    builder,
    /function boot\(\) \{[\s\S]{0,180}dbeQuery\('navigatorPanel'\)[\s\S]+dbeQuery\('mainPanel'\)[\s\S]+dbeQuery\('topPanel'\)/,
    'The shared runtime observer roots must resolve through the adapter.'
);
assert.match(
    builder,
    /Builderius ' \+ dbeBuilderiusVersion[\s\S]+Re-audit the adapter contract/,
    'An untested parent version must produce an explicit compatibility warning.'
);

console.log('Builderius adapter source regressions passed.');
