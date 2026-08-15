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
const editing = read('assets/builder/js/chunks/editing.js');
const styles = read('assets/builder/js/chunks/styles.js');
const commands = read('assets/builder/js/chunks/commands.js');
const shortcuts = read('assets/builder/js/chunks/shortcuts.js');
const coreRuntime = read('assets/builder/js/core-runtime.js');
const outputBuilder = read('includes/output-builder.php');

assert.match(
    outputBuilder,
    /'builderius'\s*=> array\([\s\S]{0,180}'version'\s*=> \$builderius_version/,
    'Builder config must carry the authoritative parent-plugin version.'
);
assert.match(
    outputBuilder,
    /'native'\s*=> array\([\s\S]{0,180}'elementShortcuts'\s*=>[\s\S]{0,180}version_compare\( \$builderius_version, '1\.3\.6-beta', '>=' \)/,
    'Builder config must expose the native 1.3.6 element-shortcut boundary.'
);
assert.match(
    outputBuilder,
    /'shortcutPanel'\s*=>[\s\S]{0,120}version_compare\( \$builderius_version, '1\.3\.6-beta', '>=' \)/,
    'Builder config must expose the native 1.3.6 shortcut-panel boundary.'
);
assert.match(
    coreRuntime,
    /const DBE_BUILDERIUS_ADAPTERS = \{[\s\S]+?'1\.3': \{[\s\S]+?testedVersion: '1\.3\.6-beta'/,
    'The audited Builderius 1.3 family must have an explicit tested version.'
);
assert.equal(
    (coreRuntime.match(/__builderiusStoreFns/g) || []).length,
    1,
    'The private Builderius store global must be named only inside the adapter.'
);
assert.match(
    coreRuntime,
    /function captureStore\(reference\)[\s\S]+typeof reference\.storeGet !== 'function'[\s\S]+typeof reference\.storeSet !== 'function'[\s\S]+function store\(\) \{[\s\S]+captureStore\(window\[definition\.bridgeGlobal\] \|\| window\[definition\.storeGlobal\]\)[\s\S]+return storeReference;/,
    'The private store must be validated and captured through the selected adapter.'
);
assert.match(
    outputBuilder,
    /dbe-builder-store-bridge[\s\S]+var createElement = w\.React && w\.React\.createElement[\s\S]+hooks\.addFilter\('builderius\.FooterPanelExtraButtons', 'dbe-store-bridge'[\s\S]+w\.dbeBuilderiusStoreFns = props && props\.storeFns[\s\S]+createElement\(component, props\)[\s\S]+builderius\.api\.started/,
    'Builderius Free must capture storeFns from an early head listener while rendering the existing footer extension unchanged.'
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
    editing,
    /function dbeObserveEditing\(\)[\s\S]+dbeQuery\('topPanel'\)[\s\S]+dbeQuery\('mainPanel'\)/,
    'Controller-owned editing observer roots must resolve through the adapter.'
);
assert.match(
    styles,
    /function dbeObserveStyles\(\)[\s\S]+dbeQuery\('mainPanel'\)/,
    'The controller-owned styles observer root must resolve through the adapter.'
);
assert.match(
    commands,
    /function dbeObserveCommands\(\)[\s\S]+dbeQuery\('topPanel'\)[\s\S]+dbeQuery\('mainPanel'\)/,
    'Controller-owned command observer roots must resolve through the adapter host.'
);
assert.match(
    commands,
    /nativeElementShortcuts[\s\S]+!nativeElementShortcuts && e\.key === 'F2'[\s\S]+!nativeElementShortcuts && code === 'KeyD'[\s\S]+!nativeElementShortcuts && code === 'KeyX'/,
    'DBE must leave native rename, duplicate and cut shortcuts to Builderius 1.3.6+.'
);
assert.match(
    shortcuts,
    /nativeShortcutPanel[\s\S]+function dbeNativeShortcutGroups\(\)[\s\S]+!pair\[2\][\s\S]+function ensureNativeShortcuts\(\)[\s\S]+\.uniTabShortcuts[\s\S]+dbe-native-shortcuts-group[\s\S]+function openShortcutsDialog\(\)[\s\S]+dbeOpenNativeShortcuts\(\)/,
    'DBE must extend the native 1.3.6 shortcut panel instead of opening a duplicate reference.'
);
assert.match(
    coreRuntime,
    /Builderius ' \+ version[\s\S]+Re-audit the adapter contract/,
    'An untested parent version must produce an explicit compatibility warning.'
);

console.log('Builderius adapter source regressions passed.');
