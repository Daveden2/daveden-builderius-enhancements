/**
 * Behaviour and source contracts for the HTML editor enhancements.
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
    for (let i = bodyStart; i < source.length; i++) {
        if (source[i] === '{') {
            depth++;
        } else if (source[i] === '}') {
            depth--;
            if (depth === 0) {
                return source.slice(start, i + 1);
            }
        }
    }
    assert.fail(`${name} must have a complete function body.`);
}

const autoCloseSource = extractFunction(editing, 'dbeHtmlAutoCloseTag');
const context = {
    DBE_HTML_VOID: {
        img: 1, input: 1, br: 1, hr: 1, area: 1, base: 1, col: 1, embed: 1,
        link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1
    }
};
runInNewContext(`${autoCloseSource}; result = dbeHtmlAutoCloseTag;`, context);
const autoCloseTag = context.result;

const closeAtEnd = (value) => autoCloseTag(value, value.length, value.length);

assert.equal(closeAtEnd('<section'), 'section', 'A normal opening tag must auto-close.');
assert.equal(closeAtEnd('<section class="hero"'), 'section', 'A tag with attributes must auto-close.');
assert.equal(closeAtEnd('<dbe-card'), 'dbe-card', 'A custom element must auto-close.');
assert.equal(closeAtEnd('<SECTION'), 'SECTION', 'The closing tag must preserve the typed tag name.');
assert.equal(closeAtEnd('<p>Earlier</p><article'), 'article', 'Earlier complete markup must not mask the active tag.');
assert.equal(closeAtEnd('<section data-label="A > B"'), 'section', 'A quoted angle bracket must not end the tag.');
assert.equal(closeAtEnd('<section data-label="A < B"'), 'section', 'A quoted opening bracket must not replace the active tag.');

assert.equal(closeAtEnd('<img'), '', 'Void elements must not receive closing tags.');
assert.equal(closeAtEnd('</section'), '', 'Closing tags must not receive another closing tag.');
assert.equal(closeAtEnd('<section /'), '', 'Self-closing tags must not receive closing tags.');
assert.equal(closeAtEnd('<!DOCTYPE html'), '', 'Declarations must not receive closing tags.');
assert.equal(closeAtEnd('<section data-label="unfinished'), '', 'Typing an angle bracket inside an attribute must be left alone.');
assert.equal(
    autoCloseTag('<section</section>', 8, 8),
    '',
    'An existing adjacent closing tag must not be duplicated.'
);
assert.equal(
    autoCloseTag('<section', 1, 4),
    '',
    'A non-collapsed selection must not be replaced by auto-closing.'
);

const analyseSource = extractFunction(editing, 'dbeHtmlAnalyse');
const analysisContext = {
    DBE_HTML_VOID: context.DBE_HTML_VOID,
    DBE_HTML_OPTIONAL_END: {
        li: 1, dt: 1, dd: 1, p: 1, rt: 1, rp: 1, option: 1, optgroup: 1,
        colgroup: 1, thead: 1, tbody: 1, tfoot: 1, tr: 1, td: 1, th: 1
    },
    dbeT: (key, fallback) => fallback,
    dbeFmt: (value, ...replacements) => replacements.reduce(
        (result, replacement, index) => result
            .replace(`%${index + 1}$s`, replacement)
            .replace('%s', replacement),
        value
    )
};
runInNewContext(`${analyseSource}; result = dbeHtmlAnalyse;`, analysisContext);
const analyse = analysisContext.result;

assert.equal(analyse('<section><p>Text</p></section>').error, null, 'Balanced markup must pass structural analysis.');
assert.equal(analyse('<ul><li>One<li>Two</ul>').error, null, 'Optional HTML end tags must not be treated as structural errors.');
assert.match(analyse('<section><div>Text</section>').error.message, /Expected <\/div>/, 'A mismatched close must identify the expected tag.');
assert.match(analyse('<section>').error.message, /Missing closing tag <\/section>/, 'An unclosed element must be reported.');
assert.match(analyse('</section>').error.message, /Unexpected closing tag/, 'An orphan closing tag must be reported.');
assert.match(analyse('<!-- unfinished').error.message, /Unclosed HTML comment/, 'An unclosed comment must be reported.');

assert.match(
    editing,
    /quickSuggestions:\s*\{\s*other:\s*true,\s*comments:\s*false,\s*strings:\s*true\s*\}[\s\S]+suggestOnTriggerCharacters:\s*true[\s\S]+tabCompletion:\s*'on'/,
    'Monaco must expose HTML tag and attribute suggestions while typing.'
);
assert.match(
    editing,
    /registerCompletionItemProvider\('html'[\s\S]+dbeHtmlCompletionContext\(model, position\)[\s\S]+dbeHtmlClassItems\(model\.getValue\(\)\)[\s\S]+dbeHtmlCompletionItems\(api, model, position, context, classCompletionItems\)/,
    'Monaco must provide context-aware Builderius HTML completions.'
);
assert.match(
    editing,
    /previewDocument\.styleSheets[\s\S]+previewDocument\.adoptedStyleSheets[\s\S]+collectFromRules\(sheet\.cssRules\)/,
    'Class suggestions must inspect ordinary and adopted preview stylesheets.'
);
assert.match(
    editing,
    /htmlCompletionComponentName[\s\S]+component\.props[\s\S]+true\[_-\]\?false[\s\S]+prop\.options \|\| prop\.choices/,
    'Component completions must include declared properties, boolean values and select-like options.'
);
assert.ok(
    editing.includes('data-b-context=\\\'[{"${1:field}":"${2:value}"}]\\\'') &&
        editing.includes("dbeT('htmlCompletionWpData'") &&
        editing.includes("dbeT('htmlCompletionPropData'") &&
        editing.includes("dbeT('htmlCompletionCollectionData'"),
    'Completions must cover static Collection JSON and Builderius dynamic-data expressions.'
);
assert.match(
    editing,
    /dbeHtmlAnalyse\(editor\.getValue\(\)\)[\s\S]+authoring\.setIssue\(analysis\.error\)[\s\S]+apply\.disabled = true/,
    'Edit as HTML must expose structural diagnostics and block invalid markup.'
);
assert.match(
    editing,
    /htmlRenameTag[\s\S]+analysis\.pairs\[tokenIndex\][\s\S]+editor\.replaceRanges/,
    'Paired tag rename must update the opening and closing names together.'
);
assert.match(
    editing,
    /htmlCollectionJson[\s\S]+dbeFindRepeats\(parsed\.roots\)[\s\S]+dbeCollapseRepeats\(parsed\.roots, true\)[\s\S]+htmlCollectionNeedsParent[\s\S]+releaseChangedMarkers/,
    'A selected repeated pattern must become a replacement Collection with static JSON without changing the edited root type.'
);
assert.match(
    editing,
    /htmlCreateComponent[\s\S]+root\.existingId[\s\S]+driveContextMenuItem\(componentTargetId, 'Create Component'/,
    'A selected existing subtree must hand off to Builderius native component creation after Apply.'
);
assert.match(
    editing,
    /autoCloseChangeListener = ed\.onDidChangeModelContent[\s\S]+changes\[0\]\.text !== '>'[\s\S]+dbeSetOwnedTimeout\(DBE_EDITING_OWNER[\s\S]+withoutTypedBracket[\s\S]+ed\.executeEdits\('dbe-html-auto-close'[\s\S]+ed\.setPosition\(model\.getPositionAt\(cursorOffset\)\)/,
    'Monaco must insert both tags and leave the caret between them.'
);
assert.match(
    editing,
    /ta\.setRangeText\('><\/' \+ tag \+ '>'[\s\S]+ta\.setSelectionRange\(start \+ 1, start \+ 1\)[\s\S]+new Event\('input', \{ bubbles: true \}\)/,
    'The textarea fallback must mirror auto-closing and notify the live preview.'
);

console.log('HTML editor regressions passed.');
