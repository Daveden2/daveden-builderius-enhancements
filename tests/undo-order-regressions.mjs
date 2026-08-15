/**
 * Behaviour and source contracts for preserving element order through DBE
 * undo/redo restores.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const editing = readFileSync(join(root, 'assets/builder/js/chunks/editing.js'), 'utf8');

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist.`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') {
            depth += 1;
        } else if (source[index] === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(start, index + 1);
            }
        }
    }
    assert.fail(`${name} must have a complete function body.`);
}

const context = { dbeHistoryRestoredIds: {} };
const helpers = [
    'dbeHistoryPlacement',
    'dbeHistoryLiveId',
    'dbeRestoreTargetIndex'
].map((name) => extractFunction(editing, name)).join('\n');
runInNewContext(`${helpers}; placement = dbeHistoryPlacement; target = dbeRestoreTargetIndex;`, context);

const placement = JSON.parse(JSON.stringify(context.placement(
    {
        first: { parent: 'parent' },
        second: { parent: 'parent' },
        third: { parent: 'parent' }
    },
    { parent: ['first', 'second', 'third'] },
    'second'
)));
assert.deepEqual(
    placement,
    { parentId: 'parent', index: 1, beforeId: 'first', afterId: 'third' },
    'History capture must retain the original slot and both sibling anchors.'
);

assert.equal(
    context.target(
        { index: 1, beforeId: 'first', afterId: 'third' },
        ['first', 'third', 'restored-second'],
        { first: {}, third: {}, 'restored-second': {} },
        'restored-second'
    ),
    1,
    'A restored item must be inserted before its surviving next sibling.'
);

context.dbeHistoryRestoredIds.oldThird = 'restored-third';
assert.equal(
    context.target(
        { index: 1, beforeId: 'oldFirst', afterId: 'oldThird' },
        ['restored-third', 'restored-second'],
        { 'restored-third': {}, 'restored-second': {} },
        'restored-second'
    ),
    0,
    'A later batch restore must resolve the regenerated id of its next sibling.'
);

context.dbeHistoryRestoredIds.oldFirst = 'restored-first';
assert.equal(
    context.target(
        { index: 1, beforeId: 'oldFirst', afterId: '' },
        ['restored-first', 'restored-second'],
        { 'restored-first': {}, 'restored-second': {} },
        'restored-second'
    ),
    1,
    'A previous-sibling anchor must place the restored item immediately after it.'
);

context.dbeHistoryRestoredIds.oldFirst = 'newFirst';
context.dbeHistoryRestoredIds.newFirst = 'newestFirst';
assert.equal(
    context.target(
        { index: 1, beforeId: 'oldFirst', afterId: '' },
        ['newestFirst', 'restored-second'],
        { newestFirst: {}, 'restored-second': {} },
        'restored-second'
    ),
    1,
    'Anchor resolution must follow repeated old-to-new id regeneration.'
);

assert.equal(
    context.target(
        { index: 8, beforeId: 'missing-before', afterId: 'missing-after' },
        ['only-restored'],
        { 'only-restored': {} },
        'only-restored'
    ),
    0,
    'When no anchor exists yet, the original slot must clamp safely to the current list.'
);

assert.match(
    editing,
    /const placement = dbeHistoryPlacement\(snapMods, snap\.indexes \|\| \{\}, p\.id\)[\s\S]+beforeId: placement\.beforeId[\s\S]+afterId: placement\.afterId/,
    'Deleted elements must record ordered placement from the Builderius history snapshot.'
);
assert.match(
    editing,
    /if \(newId\) \{ dbePositionRestoredModule\(newId, rec\); \}[\s\S]+cb\(newId \|\| null/,
    'A pasted restore must be repositioned before its undo/redo operation completes.'
);
assert.match(
    editing,
    /const placement = dbeHistoryPlacement\(mods, store\(\)\.storeGet\('indexes'\) \|\| \{\}, rec\.id\)[\s\S]+index: placement\.index[\s\S]+beforeId: placement\.beforeId[\s\S]+afterId: placement\.afterId/,
    'Redo records must retain the live position captured immediately before removal.'
);
assert.match(
    editing,
    /function destroyEditing\(\)[\s\S]+undoStack = \[\][\s\S]+redoStack = \[\][\s\S]+dbeHistoryRestoredIds = \{\}/,
    'Editing teardown must clear regenerated-id history with the undo stacks.'
);

console.log('Undo/redo order regressions passed.');
