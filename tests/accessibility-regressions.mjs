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
const topbar = read('assets/builder/css/03-topbar-layout.css');
const controls = read('assets/builder/css/12-controls.css');
const palette = read('assets/builder/css/82-command-palette.css');
const saveCue = read('assets/builder/css/72-save-cue.css');
const tokens = read('assets/builder/css/00-tokens.css');
const tabs = read('assets/builder/css/11-tabs.css');
const focus = read('assets/builder/css/13-focus.css');
const treeRows = read('assets/builder/css/14-tree-rows.css');
const previewResize = read('assets/builder/css/74-preview-resize.css');
const panelResize = read('assets/builder/css/75-panel-resize.css');
const compactPanes = read('assets/builder/css/83-compact-panes.css');
const strings = read('includes/i18n-builder.php');
const outputBuilder = read('includes/output-builder.php');

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
assert.match(strings, /'saveCleanShort'\s+=> __\( 'Saved'/, 'The responsive clean-state copy must remain concise.');
assert.match(
    builder,
    /dbe-save-cue__full[\s\S]+dbe-save-cue__short[\s\S]+aria-hidden', 'true'/,
    'The save cue must retain full live-region copy alongside its concise visual label.'
);
assert.match(
    topbar,
    /@media \(max-width: 1599px\)/,
    'The fluid top-bar layout must cover the measured DBE/native-control collision range.'
);
assert.match(
    palette,
    /\.dbe-palette__input:focus-visible\s*\{[\s\S]*outline:\s*2px solid var\(--dbe-focus\)/,
    'Palette search must retain a visible focus indicator.'
);
assert.match(
    builder,
    /if \(e\.key === 'Escape'\) \{[\s\S]{0,180}else \{ dlg\.close\(\); \}/,
    'Palette Escape must close explicitly instead of relying only on browser dialog defaults.'
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
assert.match(
    builder,
    /function ensureFavouritesKeyboard\(\)[\s\S]+Favourite elements[\s\S]+orientation: 'vertical'/,
    'Favourite elements must remain a single vertical keyboard toolbar.'
);
assert.match(
    builder,
    /data-dbe-favourite-name[\s\S]+insertFavourite[\s\S]+Insert %s/,
    'Favourite controls must expose an action-led accessible name without changing tree rows.'
);
assert.match(
    builder,
    /classList\.contains\('locked'\)[\s\S]+aria-disabled[\s\S]+tabindex', '-1'[\s\S]+footerComingSoon/,
    'Unavailable footer tools must be identified and excluded from the roving sequence.'
);
assert.match(
    strings,
    /'footerComingSoon'\s+=> __\( '%s \(coming soon\)'/,
    'Unavailable-tool copy must describe availability rather than an unexplained lock.'
);
assert.match(
    outputBuilder,
    /matchMedia\('\(max-width: 720px\)'\)[\s\S]+dbeCompactPane = 'canvas'/,
    'Compact sessions must receive a pre-paint canvas view before Builderius mounts.'
);
assert.match(
    builder,
    /function dbeEnsureCompactSwitcher\(\)[\s\S]+select\.setAttribute\('aria-label', dbeT\('compactView', 'Builder view'\)\)[\s\S]+\['inserter', 'settings', 'canvas', 'navigator'\]/,
    'Compact mode must expose all four builder destinations through a named native select.'
);
assert.match(
    builder,
    /function dbeSetCompactAccessibility\(\)[\s\S]+dbeSetPanelHiddenState\(wrappers\.left, !leftShown\)[\s\S]+dbeSetPanelHiddenState\(wrappers\.right, !navigatorShown\)[\s\S]+dbeSetPanelHiddenState\(iframe, !canvasShown\)/,
    'Compact mode must remove every hidden workspace destination from the accessibility tree.'
);
assert.match(
    builder,
    /compactViewChanged[\s\S]+setTimeout\(function \(\) \{ dbeFocusArea\(pane, true\); \}/,
    'Compact view changes must be announced and move focus to the chosen destination.'
);
assert.match(
    builder,
    /if \(!dbeCompactActive\(\)\)[\s\S]+hideSidePanels[\s\S]+goToNavigator/,
    'Wide-view panel visibility commands must not masquerade as compact-view controls.'
);
assert.match(compactPanes, /@media \(max-width: 720px\)/, 'Compact workspace layout must activate at its documented breakpoint.');
assert.match(
    compactPanes,
    /data-dbe-compact-pane="inserter"[\s\S]+data-dbe-compact-pane="settings"[\s\S]+data-dbe-compact-pane="navigator"/,
    'Compact CSS must provide explicit Element library, Element settings and Navigator views.'
);
assert.doesNotMatch(
    compactPanes,
    /max-width:\s*359px/,
    'The command palette must remain visibly voice-addressable at 320 CSS pixels.'
);

[tokens, tabs, focus, treeRows, saveCue, previewResize, panelResize, compactPanes].forEach((css) => {
    assert.match(css, /@media \(forced-colors: active\)/, 'Accessibility CSS must retain a forced-colours treatment.');
});
assert.match(tokens, /--dbe-focus:\s*Highlight/, 'The focus token must resolve to a system colour in forced-colour mode.');

console.log('Accessibility source regressions passed.');
