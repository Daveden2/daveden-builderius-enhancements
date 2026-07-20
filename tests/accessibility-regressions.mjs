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
const controls = read('assets/builder/css/12-controls.css');
const palette = read('assets/builder/css/82-command-palette.css');
const saveCue = read('assets/builder/css/72-save-cue.css');
const strings = read('includes/i18n-builder.php');

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
    /dbeSaveInitialisingUntil[\s\S]+state = dbeSaveState \|\| \(dirty \? 'dirty' : 'clean'\)/,
    'The save cue must baseline Builderius hydration and retain an explicit clean state.'
);
assert.match(saveCue, /\.dbe-save-cue\.is-clean/, 'The clean save state must be visible.');
assert.match(strings, /'saveClean'\s+=> __\( 'All changes saved'/, 'Clean save copy must remain truthful.');
assert.match(
    palette,
    /\.dbe-palette__input:focus-visible\s*\{[\s\S]*outline:\s*2px solid var\(--dbe-focus\)/,
    'Palette search must retain a visible focus indicator.'
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

console.log('Accessibility source regressions passed.');
