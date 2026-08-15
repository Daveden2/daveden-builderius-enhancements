(function () {
    'use strict';

    /* Editing-domain controllers register after builder.js supplies the shared
       lifecycle, Builderius adapter and late-bound command services. */
    var chunks = window.dbeBuilderChunks || {};

    chunks.editing = function (host) {
        var on = host.on;
        var dbeT = host.translate;
        var dbeFmt = host.format;
        var dbeTn = host.plural;
        var dbeQuery = host.query;
        var dbeSelector = host.selector;
        var store = host.builderius.store;
        var modules = host.builderius.modules;
        var activeId = host.builderius.activeId;
        var clickSeq = host.click;
        var waitFor = host.waitFor;
        var schedule = host.schedule;
        var dbeControllers = host.controllers;
        var dbeObserveChrome = host.observe;
        var dbeRememberOwnedAttributes = host.rememberOwnedAttributes;
        var dbeRestoreOwnedAttributes = host.restoreOwnedAttributes;
        var dbeBindOwnedEvent = host.bindOwnedEvent;
        var dbeBindOwnedHook = host.bindOwnedHook;
        var dbeDestroyOwnedHooks = host.destroyOwnedHooks;
        var dbeSetOwnedTimeout = host.setOwnedTimeout;
        var dbeClearOwnedTimeout = host.clearOwnedTimeout;
        var dbeSetOwnedFrame = host.setOwnedFrame;
        var dbeDestroyOwnedActivity = host.destroyOwnedActivity;
        var dbeIsMac = host.platform.isMac;
        var clearMultiSel = host.multiSelection.clear;
        var navRowById = host.navigator.rowById;
        var navSelect = host.navigator.select;
        var contextTarget = host.context.getTarget;
        var driveContextMenuItem = host.commands.driveContextMenuItem;
        var expandSubtree = host.commands.expandNavigatorSubtree;
        var dbePresenceDirtyChanged = host.presenceDirtyChanged;

    /* (d) Wrap the target element(s) in a new parent of the given type, through
       the builder's OWN add + move store actions — the same channel duplicate
       and the native inserter use (addModule/addIndex fire builderius.Module.added,
       so the tree repaints AND the change survives Save; a raw storeSet('modules')
       would do neither).

       The wrapper is inserted at the FIRST selected element's slot and the
       selection is MOVED into it (ids preserved), so it lands EXACTLY where the
       elements were — not appended at the parent's end like the old forged-paste
       channel did. Builderius has no native wrap/group action, and addIndex only
       force-appends when the parent is a VOID element (img/input/br/… — see the
       native `gn` list), never for the container parents we wrap into, so the
       index is always honoured. */
    function wrap(type, idsOpt) {
        if (dbeUndoBusy) { return; }
        var sf = store();
        var mods = sf.storeGet('modules');
        if (!mods) { return; }
        var ids = (idsOpt && idsOpt.length ? idsOpt : [contextTarget() || sf.storeGet('activeModule')])
            .filter(function (id) { return !!mods[id]; });
        if (!ids.length) { return; }

        // Only siblings can share one new parent; the menu disables Wrap for a
        // mixed selection, this is the backstop.
        var parentId = mods[ids[0]].parent || '';
        if (ids.some(function (id) { return (mods[id].parent || '') !== parentId; })) {
            undoToast(dbeT('wrapNeedsSiblings', 'Wrap needs sibling elements'));
            return;
        }

        // Sibling order + insertion slot come from the live index array (the
        // module-map key order goes stale after moves; the index array does not).
        var idx = sf.storeGet('indexes') || {};
        var siblings = idx[parentId || 'root'] ? [].concat(idx[parentId || 'root']) : [];
        var order = siblings.filter(function (id) { return ids.indexOf(id) !== -1; });
        if (!order.length) { order = ids.slice(); }
        var firstAt = siblings.indexOf(order[0]);
        if (firstAt < 0) { firstAt = siblings.length; }

        var makeId = dbeMakeId;
        var newId = makeId();
        var attachId = newId; // where the selected elements are moved into

        // Build the wrapper action-side. Settings mirror the native insert
        // defaults (verified against 1.3.6-beta). A Collection only renders its
        // children through a Template child (the native inserter always makes
        // the pair), so build Collection > Template and move the selection into
        // the Template.
        if (type === 'div') {
            storeAddModule(sf, { id: newId, name: 'HtmlElement', label: 'Div',
                settings: [{ name: 'tag', value: 'div' }] }, parentId, firstAt);
        } else if (type === 'figure') {
            storeAddModule(sf, { id: newId, name: 'HtmlElement', label: 'Figure',
                settings: [{ name: 'tag', value: 'figure' }] }, parentId, firstAt);
        } else if (type === 'template') {
            storeAddModule(sf, { id: newId, name: 'Template', label: 'Template', settings: [] }, parentId, firstAt);
        } else if (type === 'collection') {
            storeAddModule(sf, { id: newId, name: 'Collection', label: 'Collection',
                settings: [{ name: 'interactiveMode', value: false }, { name: 'tag', value: 'div' }] }, parentId, firstAt);
            var innerId = makeId();
            storeAddModule(sf, { id: innerId, name: 'Template', label: 'Template', settings: [] }, newId, 0);
            attachId = innerId;
        } else {
            return;
        }

        // Move each selected element into the wrapper, preserving Navigator order
        // (storeMoveModule reads the live index each call, so the shrinking old
        // parent stays correct as siblings are pulled out one by one).
        order.forEach(function (id, i) { storeMoveModule(sf, id, attachId, i); });

        clearMultiSel();
        if (type === 'template') {
            // A condition-less Template renders its children inside an inert
            // <template>, so they leave the page until a rendering condition is
            // set — say so, and land the user on the Template to make that next.
            undoToast(dbeFmt(dbeTn(order.length,
                'wrappedInTemplateOne', 'Wrapped %s element in a template. Add a rendering condition or its contents won’t show on the page',
                'wrappedInTemplateMany', 'Wrapped %s elements in a template. Add a rendering condition or their contents won’t show on the page'), order.length));
        } else {
            var typeLabel = type === 'collection' ? dbeT('wrapTypeCollection', 'collection + template') : type;
            undoToast(dbeFmt(dbeTn(order.length,
                'wrappedOne', 'Wrapped %1$s element in %2$s',
                'wrappedMany', 'Wrapped %1$s elements in %2$s'), order.length, typeLabel));
        }

        // Land on the new wrapper so the next step (condition, settings) is one click away.
        waitFor(function () {
            return document.querySelector('.uniRightPanel .uni-tree-node-' + newId) || null;
        }, function (row) { if (row) { clickSeq(row); } });
    }

    /* Add a module through the builder's OWN add action (mirrors the sense
       bridge's handleAddModule and the native inserter). storeSet(name, payload)
       dispatches the reducer named `name`, so "addModule"/"addIndex" fire their
       lifecycle hooks — the repaint-and-persist path, not a raw slice write.
       addIndex always runs; a numeric index then re-slots the id in the parent's
       index array. */
    function storeAddModule(sf, module, parentId, index) {
        module.label = module.label || module.name;
        module.parent = parentId || '';
        sf.storeSet('addModule', { module: module });
        sf.storeSet('addIndex', { module: module });
        if (typeof index === 'number') {
            var key = parentId || 'root';
            var idx = sf.storeGet('indexes') || {};
            var arr = idx[key] ? [].concat(idx[key]) : [];
            var at = arr.indexOf(module.id);
            if (at !== -1 && at !== index) {
                arr.splice(at, 1);
                arr.splice(index, 0, module.id);
                var next = Object.assign({}, idx);
                next[key] = arr;
                sf.storeSet('indexes', next);
            }
        }
    }

    /* Move a module via the builder's move action (mirrors handleMoveModule):
       reads the live index each call so a shrinking old-parent stays correct. */
    function storeMoveModule(sf, moduleId, newParentId, newIndex) {
        var mods = sf.storeGet('modules') || {};
        if (!mods[moduleId]) { return; }
        var idx = sf.storeGet('indexes') || {};
        var oldParent = mods[moduleId].parent || 'root';
        var newParent = (typeof newParentId === 'string') ? (newParentId || 'root') : oldParent;
        var oldIndex = (idx[oldParent] ? [].concat(idx[oldParent]) : []).indexOf(moduleId);
        sf.storeSet('moveModule', {
            oldParent: oldParent, sourceId: moduleId, oldIndex: oldIndex,
            newIndex: (typeof newIndex === 'number') ? newIndex : 0, newParent: newParent
        });
    }

    /* Random module id in Builderius' shape ('u' + 9 hex). Lifted from wrap()'s
       closure so element-insertion helpers (picker, Emmet palette) can share it. */
    function dbeMakeId(existing) {
        var used = existing || modules() || {};
        var id;
        do {
            id = 'u' + Array.from({ length: 9 }, function () {
                return Math.floor(Math.random() * 16).toString(16);
            }).join('');
        } while (used[id]);
        return id;
    }

    /* Attributes whose value becomes a navigable or fetchable URL. Kept as one
       shared set so every markup-entry channel gates the same names. */
    var DBE_URL_ATTRS = { href: 1, src: 1, action: 1, formaction: 1, poster: 1, 'xlink:href': 1 };

    /* Decode character references without placing caller-controlled markup in
       the live document. Attribute character references do not terminate the
       synthetic quoted value, so even input containing &quot; stays inert. */
    function dbeDecodeEntities(value) {
        var raw = String(value == null ? '' : value);
        if (raw.indexOf('&') === -1) { return raw; }
        try {
            var escaped = raw.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            var parsed = new DOMParser().parseFromString('<i data-dbe-value="' + escaped + '"></i>', 'text/html');
            var holder = parsed.body && parsed.body.firstElementChild;
            return holder ? holder.getAttribute('data-dbe-value') || '' : raw;
        } catch (e) {
            return raw;
        }
    }

    /* Builderius renders the content setting raw. Text entering that setting
       must therefore be encoded at the storage boundary, after DOM parsing has
       decoded any character references in the source. */
    function dbeEscapeRawText(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /* Whether a URL value uses a scheme that can execute or smuggle script.
       Builderius renders htmlAttribute / contentSvg raw, so a stored
       javascript:/vbscript: URL — or a data: URL carrying a markup document
       (text/html, xhtml, or an SVG, all of which can hold script) — would run
       for anyone viewing the page. Raster image data URLs are legitimate (the
       plugin seeds one as an image placeholder) and stay allowed. The value is
       is entity-decoded here because not every caller is DOM-parsed (notably
       the command palette's Emmet and attribute inputs). In-scheme whitespace
       and control characters are stripped the way a browser does before it
       acts on the URL, so "java\tscript:" cannot slip past. */
    function dbeDangerousUrl(value) {
        // eslint-disable-next-line no-control-regex -- deliberate: browsers ignore control chars mid-scheme, so "java\tscript:" must not slip past.
        var v = dbeDecodeEntities(value).replace(/[\u0000-\u0020]+/g, '').toLowerCase();
        if (/^(?:javascript|vbscript):/.test(v)) { return true; }
        if (v.indexOf('data:') === 0) {
            // Allow only raster image data URLs; block markup/script-bearing
            // ones, including image/svg+xml (an SVG document can carry script).
            return !/^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)[;,]/.test(v);
        }
        return false;
    }

    /* Shared attribute gate for every markup-entry channel (the Import/Edit
       HTML dialogs and the Emmet palette). Builderius renders htmlAttribute
       values raw (twig |raw), so sanitisation has to happen here, at entry.
       Returns a short reason string when the attribute must not be stored,
       null when it is fine. The dbe markers are blocked as stored attributes
       everywhere — the dialogs consume them as identity before this gate. */
    function dbeAttrBlocked(name, value) {
        var n = String(name || '').trim().toLowerCase();
        if (!/^[a-z_:][-a-z0-9_:.]*$/.test(n)) { return n || 'attribute'; }
        if (!n || n === 'data-dbe-id' || n === 'data-dbe-module' || n === 'data-dbe-label') { return n || 'attribute'; }
        if (n.indexOf('on') === 0) { return n; }
        if (DBE_URL_ATTRS[n] && dbeDangerousUrl(value)) { return n + '="' + String(value).slice(0, 12) + '…"'; }
        return null;
    }

    /* Build an HtmlElement module object for a tag, with optional
       classes/id/text/attrs. Mirrors the native insert shape used by wrap() —
       the tag lives in a `tag` setting, classes in a `tagClass` array setting. */
    function dbeElementModule(tag, opts) {
        opts = opts || {};
        var settings = [{ name: 'tag', value: tag }];
        // Verified live: addModule renders text from a `content` setting, classes
        // from `tagClass`, and the id/attributes from an `htmlAttribute` list — so a
        // fully-formed element (Emmet included) inserts in one call, no native
        // class/attr driving.
        if (opts.text != null && opts.text !== '') { settings.push({ name: 'content', value: dbeEscapeRawText(opts.text) }); }
        if (opts.classes && opts.classes.length) { settings.push({ name: 'tagClass', value: opts.classes.slice() }); }
        var attrList = [];
        if (opts.id) { attrList.push({ name: 'id', value: opts.id }); }
        (opts.attrs || []).forEach(function (a) {
            if (!a || !a.name) { return; }
            var name = String(a.name).trim().toLowerCase();
            var value = dbeDecodeEntities(a.value);
            if (dbeAttrBlocked(name, value)) { return; } // same gate as the HTML dialogs
            attrList.push({ name: name, value: value });
        });
        if (attrList.length) { settings.push({ name: 'htmlAttribute', value: attrList }); }
        var label = tag.charAt(0).toUpperCase() + tag.slice(1);
        return { id: dbeMakeId(), name: 'HtmlElement', label: label, settings: settings };
    }

    /* Minimal Emmet parser (command_palette): tag, .class, #id, [attr=value],
       > child, + sibling, * multiply, {text}. No grouping (), climb-up ^ or
       numbering $. Attribute values may be bare, "double" or 'single' quoted
       ([href=/contact/ target=_blank], [aria-label="Main menu"]); a bare name
       ([hidden]) stores an empty value, which renders as the bare attribute.
       Returns an array of root nodes {tag,id,classes,attrs,text,count,children};
       throws (a plain value) on a parse error. */
    function dbeEmmetParse(str) {
        var s = (str || '').trim();
        var i = 0;
        function parseElement() {
            var node = { tag: '', subTag: null, id: '', classes: [], attrs: [], text: null, count: 1, children: [] };
            // name:name — the colon suffix is the rendered tag for the
            // collection reserved words (collection:ul); semantic checks
            // (reserved word only, known non-void tag) happen after parsing.
            var tm = /^([A-Za-z][A-Za-z0-9]*)(?::([A-Za-z][A-Za-z0-9]*))?/.exec(s.slice(i));
            if (tm && tm[0]) {
                node.tag = tm[1];
                if (tm[2] != null) { node.subTag = tm[2]; }
                i += tm[0].length;
            }
            while (i < s.length) {
                var c = s[i];
                if (c === '#') {
                    i++; var im = /^[A-Za-z0-9_-]+/.exec(s.slice(i)); if (!im) { throw 0; }
                    node.id = im[0]; i += im[0].length;
                } else if (c === '.') {
                    i++; var cm = /^[A-Za-z0-9_-]+/.exec(s.slice(i)); if (!cm) { throw 0; }
                    node.classes.push(cm[0]); i += cm[0].length;
                } else if (c === '[') {
                    var abEnd = s.indexOf(']', i); if (abEnd < 0) { throw 0; }
                    var inner = s.slice(i + 1, abEnd);
                    var re = /([A-Za-z_:][-A-Za-z0-9_:.]*)(?:=("([^"]*)"|'([^']*)'|[^\s\]]+))?/g;
                    var am;
                    while ((am = re.exec(inner))) {
                        var av = am[3] != null ? am[3] : (am[4] != null ? am[4] : (am[2] != null ? am[2] : ''));
                        node.attrs.push({ name: am[1], value: av });
                    }
                    i = abEnd + 1;
                } else if (c === '{') {
                    var end = s.indexOf('}', i); if (end < 0) { throw 0; }
                    node.text = s.slice(i + 1, end); i = end + 1;
                } else { break; }
            }
            if (!node.tag && !node.classes.length && !node.id && node.text == null && !node.attrs.length) { throw 0; }
            if (s[i] === '*') {
                i++; var nm = /^[0-9]+/.exec(s.slice(i)); if (!nm) { throw 0; }
                node.count = Math.max(1, Math.min(50, parseInt(nm[0], 10))); i += nm[0].length;
            }
            return node;
        }
        var roots = [];
        var cur = parseElement();
        roots.push(cur);
        var level = roots; // the array `cur` currently lives in (its sibling list)
        while (i < s.length) {
            var op = s[i];
            if (op === '>') { i++; level = cur.children; var ch = parseElement(); level.push(ch); cur = ch; }
            else if (op === '+') { i++; var sib = parseElement(); level.push(sib); cur = sib; }
            else { throw 0; }
        }
        return roots;
    }

    /* Reserved Emmet words: `collection`, `subcollection` and `template`
       build the dynamic modules instead of elements. Shaping mirrors the
       HTML import: classes/id/attrs apply; {text} has no rendering channel
       on any of them, so it drops. A Collection gets the native insert
       defaults (interactive off; div tag unless `collection:ul` names the
       rendered tag) — bind it afterwards, or pass [data-b-context=…]
       inline. */
    var DBE_EMMET_WORDS = { collection: 'Collection', subcollection: 'SubCollection', template: 'Template' };

    function dbeEmmetNodeToModule(node) {
        var word = DBE_EMMET_WORDS[(node.tag || '').toLowerCase()];
        if (word) {
            var settings = [];
            if (word !== 'Template') {
                settings.push({ name: 'interactiveMode', value: false });
                settings.push({ name: 'tag', value: (node.subTag && dbeCleanTagInput(node.subTag)) || 'div' });
            }
            if (node.id) { settings.push({ name: 'tagId', value: node.id }); }
            if (node.classes.length) { settings.push({ name: 'tagClass', value: node.classes.slice() }); }
            var attrList = [];
            (node.attrs || []).forEach(function (a) {
                if (!a || !a.name) { return; }
                var name = String(a.name).trim().toLowerCase();
                var value = dbeDecodeEntities(a.value);
                if (dbeAttrBlocked(name, value)) { return; } // same gate as elements
                attrList.push({ name: name, value: value });
            });
            if (attrList.length) { settings.push({ name: 'htmlAttribute', value: attrList }); }
            return { id: dbeMakeId(), name: word, label: word, settings: settings };
        }
        var tag = node.tag || ((node.text != null && !node.classes.length && !node.id) ? 'span' : 'div');
        return dbeElementModule(tag, { classes: node.classes, id: node.id, text: node.text, attrs: node.attrs });
    }

    /* Validate a parsed Emmet tree BEFORE anything inserts. The only rule left
       is the :tag suffix: it belongs to the collection words and must name a
       known non-void tag. There is deliberately NO collection-children rule —
       a Builderius Collection repeats its <template> child and renders any
       other (static) children once, so static elements alongside the template
       are valid (see the note on the removed dbeValidateParsedRoots). targetId
       is kept in the signature for callers and future rules. */
    function dbeEmmetStructureError(targetId, roots) {
        var err = null;
        (function walk(list) {
            list.forEach(function (n) {
                if (err) { return; }
                var w = DBE_EMMET_WORDS[(n.tag || '').toLowerCase()];
                // collection:ul is valid; div:foo and collection:script are not.
                if (n.subTag != null
                    && (!(w === 'Collection' || w === 'SubCollection') || !dbeCleanTagInput(n.subTag))) {
                    err = dbeFmt(dbeT('tagInvalid', 'Not a usable HTML tag: %s'), n.tag + ':' + n.subTag);
                    return;
                }
                walk(n.children);
            });
        })(roots);
        return err;
    }

    /* Insert a parsed Emmet tree relative to targetId: as its last children when it
       can hold children, else as siblings after it. DFS with running per-level
       indices; * multiplies a node into consecutive siblings. Returns the count. */
    function dbeEmmetInsert(targetId, roots) {
        var sf = store();
        var mods = sf.storeGet('modules') || {};
        if (!mods[targetId]) { return 0; }
        var VOID = /^(img|input|br|hr|area|base|col|embed|link|meta|param|source|track|wbr)$/i;
        var tag = ((mods[targetId].settings || []).filter(function (x) { return x.name === 'tag'; })[0] || {}).value || '';
        var parentId, startIndex;
        var indexes = sf.storeGet('indexes') || {};
        if (!VOID.test(tag)) {
            parentId = targetId;
            startIndex = (indexes[targetId] || []).length;
        } else {
            parentId = mods[targetId].parent || '';
            var sibs = [].concat(indexes[parentId || 'root'] || []);
            startIndex = sibs.indexOf(targetId) + 1;
        }
        var count = 0;
        (function buildInto(nodeList, pId, startIdx) {
            var idx = startIdx;
            nodeList.forEach(function (node) {
                for (var rep = 0; rep < (node.count || 1); rep++) {
                    var mod = dbeEmmetNodeToModule(node);
                    storeAddModule(sf, mod, pId, idx);
                    idx += 1; count += 1;
                    if (node.children && node.children.length) { buildInto(node.children, mod.id, 0); }
                }
            });
        })(roots, parentId, startIndex);
        return count;
    }

    /* Insert `module` as a sibling of targetId: dir < 0 = before, dir > 0 = after.
       Uses the same live-index slot maths as wrap(), through the persist+repaint
       add channel. Returns the new id (or null if the target is gone). */
    function dbeInsertSibling(targetId, dir, module) {
        var sf = store();
        var mods = sf.storeGet('modules') || {};
        if (!mods[targetId]) { return null; }
        var parent = mods[targetId].parent || '';
        var idx = sf.storeGet('indexes') || {};
        var sibs = idx[parent || 'root'] ? [].concat(idx[parent || 'root']) : [];
        var at = sibs.indexOf(targetId);
        if (at < 0) { at = sibs.length ? sibs.length - 1 : 0; }
        storeAddModule(sf, module, parent, dir > 0 ? at + 1 : at);
        return module.id;
    }

    /* The native Section ships with an inner content wrapper —
       section > div.container[data-container="true"] — so its children are
       constrained to the layout container rather than the full-bleed section.
       Our quick-add mirrors that: a picked Section inserts the section at the
       sibling slot, then drops the container div inside it, so it is immediately
       usable like the native inserter's Section. Returns the section's id. */
    function dbeInsertSection(targetId, dir) {
        var sf = store();
        var newId = dbeInsertSibling(targetId, dir, dbeElementModule('section'));
        if (!newId) { return null; }
        storeAddModule(sf, {
            id: dbeMakeId(), name: 'HtmlElement', label: 'Container',
            settings: [
                { name: 'tag', value: 'div' },
                { name: 'tagClass', value: ['container'] },
                { name: 'htmlAttribute', value: [{ name: 'data-container', value: 'true' }] }
            ]
        }, newId, 0);
        return newId;
    }

    /* Update an existing element's settings in place. Verified live: dispatching
       `addModule` with an EXISTING id upserts the module (settings replaced, no
       duplicate module or index entry) and repaints — so class/attribute edits on
       an existing element need no native-control driving. `mutate` receives the
       (cloned) settings array to modify. `historyLabel` opts user-initiated
       property edits into settings-level Undo; housekeeping upserts omit it.
       `replacementLabel` lets an undo restore a follow-the-tag label in the
       same atomic upsert as its settings. Returns false if the id is gone. */
    function dbeUpdateModuleSettings(id, mutate, historyLabel, replacementLabel) {
        var sf = store();
        var mods = sf.storeGet('modules') || {};
        if (!mods[id]) { return false; }
        var updated = JSON.parse(JSON.stringify(mods[id]));
        var previousSettings = JSON.parse(JSON.stringify(updated.settings || []));
        updated.settings = updated.settings || [];
        mutate(updated.settings);
        if (typeof replacementLabel === 'string') { updated.label = replacementLabel; }
        // Builderius uses addModule as an upsert channel and fires its
        // Module.added hook even when this id already exists. Keep that hook out
        // of DBE's structural history: treating a class, attribute or tag update
        // as a newly added element would make Cmd/Ctrl+Z remove the whole module.
        var wasBusy = dbeUndoBusy;
        dbeUndoBusy = true;
        try { sf.storeSet('addModule', { module: updated }); }
        finally { dbeUndoBusy = wasBusy; }
        if (historyLabel && !wasBusy && on('undo_delete')) {
            dbeHistoryPush({
                op: 'settings',
                id: id,
                label: mods[id].label || mods[id].name || dbeT('element', 'element'),
                change: historyLabel,
                moduleLabel: mods[id].label || '',
                settings: previousSettings
            });
        }
        // The canvas repaints from `modules`, but the settings panel for the
        // selected element is hydrated on SELECTION and does not re-read this write
        // — so an edit to the active element would not show in the panel (its class
        // chips / attribute rows) until a save + reload. Re-hydrate by bouncing the
        // selection off another row and back (a raw activeModule set does not
        // trigger the hydration; only the selection click handler does).
        if (activeId() === id) { dbeReselectToRehydrate(id); }
        return true;
    }

    function dbeReselectToRehydrate(id) {
        var backRow = document.querySelector('.uniRightPanel .uni-tree-node-' + id);
        if (!backRow) { return; }
        var mods = modules() || {};
        var other = (mods[id] && mods[id].parent) || '';
        var otherRow = other && document.querySelector('.uniRightPanel .uni-tree-node-' + other);
        if (!otherRow) {
            otherRow = [].slice.call(document.querySelectorAll('.uniRightPanel .uniModTree__list button.uniModTree__item'))
                .filter(function (r) { return r !== backRow; })[0];
        }
        if (!otherRow) { return; }
        // Remember the active settings tab (the class chips live on Styles) so the
        // bounce lands the user back where they were, not on Content.
        var tabLabel = (([].slice.call(document.querySelectorAll('.uniLeftPanel .uniPanelTabs__tab'))
            .filter(function (t) { return t.classList.contains('active'); })[0] || {}).textContent || '').trim();
        clickSeq(otherRow);
        waitFor(function () { return (activeId() && activeId() !== id) ? true : null; }, function () {
            var again = document.querySelector('.uniRightPanel .uni-tree-node-' + id);
            if (again) { clickSeq(again); }
            if (!tabLabel) { return; }
            waitFor(function () { return activeId() === id ? true : null; }, function () {
                var tab = [].slice.call(document.querySelectorAll('.uniLeftPanel .uniPanelTabs__tab'))
                    .filter(function (t) { return (t.textContent || '').trim() === tabLabel; })[0];
                if (tab && !tab.classList.contains('active')) { clickSeq(tab); }
            });
        });
    }

    // Append class name(s) to an element's tagClass setting (deduped).
    function dbeAddClasses(id, classes) {
        return dbeUpdateModuleSettings(id, function (settings) {
            var tc = settings.filter(function (s) { return s.name === 'tagClass'; })[0];
            if (!tc) { tc = { name: 'tagClass', value: [] }; settings.push(tc); }
            if (!Array.isArray(tc.value)) { tc.value = []; }
            classes.forEach(function (c) { if (tc.value.indexOf(c) === -1) { tc.value.push(c); } });
        }, dbeT('classChanges', 'class changes'));
    }

    /* (im) Image defaults (image_defaults). A fresh Image element is an
       HtmlElement seeded with only tag=img — no src, no alt — so it renders as
       an invisible empty <img> the user has to hunt for on the canvas, and it
       ships without an alt attribute at all. Builderius' media picker fills
       both when an image is chosen (alt from the attachment's alt text), but
       it only ADDS alt when that text is non-empty — and it never strips an
       existing alt — so seeding the element at insert time closes both gaps:
       src = an inline data: SVG placeholder (something to see and click),
       alt = "" (present from birth; empty reads as decorative until real text
       is written, and survives picking an image whose alt text is blank).
       Applied through the addModule upsert (the repaint-and-persist channel);
       dbeUndoBusy is held across the upsert so the settings write is not
       captured as a second undo step, and restores/undo re-adds (which run
       under dbeUndoBusy) are left untouched.
       Verified live (Builderius 1.3.x): the settings panel normalises an
       empty-valued attribute row to {name:'alt'} with NO value key when it
       re-commits — that entry still renders on the front end as a bare `alt`
       (formatHtmlAttributes emits the name alone for null/empty values),
       which is HTML-equivalent to alt="". The builder canvas alone omits it.
       The media picker replaces src outright and fills alt from the
       attachment's alt text; it never strips an existing alt, so the seeded
       one survives picking an image whose alt text is blank. */
    var DBE_IMG_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
        // width/height give the img an intrinsic size (a viewBox alone can
        // collapse to 0x0 in a flex/grid slot), so the placeholder is visible
        // and clickable before any sizing CSS exists.
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">' +
        '<rect width="1200" height="800" fill="#d7dbe2"/>' +
        '<circle cx="912" cy="228" r="84" fill="#a8b0bd"/>' +
        '<path d="M0 800 336 396l228 276 168-132 468 260z" fill="#a8b0bd"/>' +
        '<path d="M0 800l264-228 252 228z" fill="#8b94a4"/>' +
        '</svg>'
    );
    function dbeApplyImageDefaults(id) {
        var m = (modules() || {})[id];
        if (!m || m.name !== 'HtmlElement') { return; }
        var tag = ((m.settings || []).filter(function (s) { return s.name === 'tag'; })[0] || {}).value;
        if (tag !== 'img') { return; }
        // An attribute entry can exist WITHOUT a value key (the builder's own
        // attribute rows commit {name:'alt'} until something is typed), and a
        // value-less entry renders nothing — so only a present value counts,
        // and a value-less entry is filled in place rather than duplicated.
        var attrs = ((m.settings || []).filter(function (s) { return s.name === 'htmlAttribute'; })[0] || {}).value || [];
        var hasSrc = attrs.some(function (a) { return a && a.name === 'src' && a.value; });
        var hasAlt = attrs.some(function (a) { return a && a.name === 'alt' && a.value != null; });
        if (hasSrc && hasAlt) { return; }
        var wasBusy = dbeUndoBusy;
        dbeUndoBusy = true;
        try {
            dbeUpdateModuleSettings(id, function (settings) {
                var attr = settings.filter(function (s) { return s.name === 'htmlAttribute'; })[0];
                if (!attr) { attr = { name: 'htmlAttribute', value: [] }; settings.push(attr); }
                if (!Array.isArray(attr.value)) { attr.value = []; }
                if (!hasSrc) { attr.value.push({ name: 'src', value: DBE_IMG_PLACEHOLDER }); }
                if (!hasAlt) {
                    var alt = attr.value.filter(function (a) { return a && a.name === 'alt'; })[0];
                    if (alt) { alt.value = ''; } else { attr.value.push({ name: 'alt', value: '' }); }
                }
            });
        } finally { dbeUndoBusy = wasBusy; }
    }
    function hookImageDefaults() {
        dbeBindOwnedHook(DBE_EDITING_OWNER, 'builderius.Module.added', 'dbeImageDefaults', function (p) {
            if (dbeUndoBusy || !p || !p.id) { return; }
            // Defer out of the dispatch so the add settles first. The upsert
            // re-fires this hook, but the second pass is a no-op.
            dbeSetOwnedTimeout(DBE_EDITING_OWNER, function () {
                try { dbeApplyImageDefaults(p.id); } catch (e) {}
            }, 0);
        });
    }

    /* (d1) Structural moves all use Builderius' own move action (the repaint-and-
       persist channel). The shared helper records the previous location for DBE's
       undo stack, keeps the moved row selected/focused, and announces the result. */
    function dbeMoveLocation(id) {
        var sf = store();
        var mods = sf.storeGet('modules') || {};
        var mod = mods[id];
        if (!mod) { return null; }
        var parentId = mod.parent || '';
        var idx = sf.storeGet('indexes') || {};
        var siblings = [].concat(idx[parentId || 'root'] || []);
        return {
            sf: sf,
            mods: mods,
            mod: mod,
            parentId: parentId,
            siblings: siblings,
            index: siblings.indexOf(id)
        };
    }

    function dbeModuleCanContainChildren(mod) {
        if (!mod) { return false; }
        if (mod.name === 'Template' || mod.name === 'Collection' || mod.name === 'SubCollection') { return true; }
        if (mod.name !== 'HtmlElement') { return false; }
        var tag = String(dbeSettingVal(mod, 'tag') || 'div').toLowerCase();
        return !DBE_HTML_VOID[tag];
    }

    function dbeFocusMovedRow(id) {
        waitFor(function () { return navRowById(id); }, function (row) {
            if (row) { navSelect(row); }
        }, 20);
    }

    function dbeMoveModule(id, newParentId, newIndex, messageKey, messageDefault) {
        if (dbeUndoBusy) { return; }
        var from = dbeMoveLocation(id);
        if (!from || from.index < 0) { return false; }
        var parentId = newParentId || '';
        if (from.parentId === parentId && from.index === newIndex) { return false; }
        storeMoveModule(from.sf, id, parentId, newIndex);
        if (on('undo_delete')) {
            dbeHistoryPush({
                op: 'move',
                id: id,
                label: from.mod.label || from.mod.name || dbeT('element', 'element'),
                parentId: from.parentId,
                index: from.index
            });
        }
        dbeFocusMovedRow(id);
        undoToast(dbeFmt(dbeT(messageKey, messageDefault), from.mod.label || from.mod.name || dbeT('element', 'element')), 'undo');
        return true;
    }

    function moveSibling(id, dir) {
        var loc = dbeMoveLocation(id);
        if (!loc || loc.index < 0) { return false; }
        var next = loc.index + dir;
        if (next < 0 || next >= loc.siblings.length) { return false; }
        return dbeMoveModule(id, loc.parentId, next,
            dir < 0 ? 'movedUp' : 'movedDown',
            dir < 0 ? 'Moved “%s” up' : 'Moved “%s” down');
    }

    function dbeIndentTarget(id) {
        var loc = dbeMoveLocation(id);
        if (!loc || loc.index <= 0) { return null; }
        var targetId = loc.siblings[loc.index - 1];
        return dbeModuleCanContainChildren(loc.mods[targetId]) ? targetId : null;
    }

    function indentElement(id) {
        var targetId = dbeIndentTarget(id);
        if (!targetId) { return false; }
        var indexes = store().storeGet('indexes') || {};
        return dbeMoveModule(id, targetId, [].concat(indexes[targetId] || []).length,
            'movedIn', 'Moved “%s” in one level');
    }

    function dbeCanOutdent(id) {
        var loc = dbeMoveLocation(id);
        return !!(loc && loc.parentId && loc.mods[loc.parentId]);
    }

    function outdentElement(id) {
        var loc = dbeMoveLocation(id);
        if (!loc || !loc.parentId) { return false; }
        var parent = loc.mods[loc.parentId];
        if (!parent) { return false; }
        var grandParentId = parent.parent || '';
        var indexes = loc.sf.storeGet('indexes') || {};
        var parentSiblings = [].concat(indexes[grandParentId || 'root'] || []);
        var parentIndex = parentSiblings.indexOf(loc.parentId);
        if (parentIndex < 0) { return false; }
        return dbeMoveModule(id, grandParentId, parentIndex + 1,
            'movedOut', 'Moved “%s” out one level');
    }

    /* (d1b) Select the target's parent. The reliable channel is a click on the
       parent's tree row — a raw storeSet('activeModule') is not trusted to
       repaint the panels (see the rename channel note). */
    function selectParentOf(id) {
        var mods = modules() || {};
        var p = mods[id] && mods[id].parent;
        if (!p) { return; }
        var row = document.querySelector('.uniRightPanel .uni-tree-node-' + p);
        if (row) { clickSeq(row); }
        else { try { store().storeSet('activeModule', p); } catch (e) {} }
    }

    /* (d1c) Unwrap — the inverse of wrap(): move every child up into the target's
       own parent at the target's slot (order preserved), then remove the now-empty
       wrapper through the native menu channel so the removal stays individually
       undoable. Index math mirrors wrap()'s move-into; the move reducer's newIndex
       semantics are version-sensitive, so confirm against a live save. */
    function unwrap(id) {
        if (dbeUndoBusy) { return; }
        var sf = store();
        var mods = sf.storeGet('modules') || {};
        if (!mods[id]) { return; }
        var parent = mods[id].parent || '';
        var idx = sf.storeGet('indexes') || {};
        var parentSibs = idx[parent || 'root'] ? [].concat(idx[parent || 'root']) : [];
        var wrapperAt = parentSibs.indexOf(id);
        if (wrapperAt < 0) { wrapperAt = parentSibs.length; }
        var kids = idx[id] ? [].concat(idx[id]) : [];
        if (!kids.length) { undoToast(dbeT('nothingToUnwrap', 'Nothing to unwrap: this element has no children')); return; }
        kids.forEach(function (kid, i) { storeMoveModule(sf, kid, parent, wrapperAt + i); });
        // The wrapper is empty now — remove it via the native channel (undoable),
        // giving the moves a beat to commit and the user's menu time to close.
        setTimeout(function () { driveContextMenuItem(id, 'Remove', function () {}); }, 200);
        undoToast(dbeFmt(dbeTn(kids.length, 'unwrappedOne', 'Unwrapped %s element', 'unwrappedMany', 'Unwrapped %s elements'), kids.length));
    }

    /* (d2) Rename the element from the tree context menu. Builderius HAS a
       native rename channel — the settings-panel header title (.uniPanelHeader__title
       .text) is a contenteditable bound to the selected module's label — but it
       has no affordance and sits in the opposite panel from the tree. This adds
       an inline edit field on the row itself and commits by driving that native
       contenteditable (the real React channel: store updates, tree repaints,
       works for components too — no raw storeSet, so none of the wrap() repaint
       limitation). Renaming selects the element as a side effect, which is the
       convention in comparable builders. */
    var renameState = null;

    /* A tree re-render can detach the rename input WITHOUT firing blur, which
       would leave renameState pointing at a dead input forever — and every
       keyboard feature that defers to an open rename (undo/redo, Escape, F2,
       the palette) would stay gagged until the next rename. Guards read the
       state through this so a dead input heals to "no rename open". */
    function renameActive() {
        if (renameState && !document.contains(renameState.input)) { renameState = null; }
        return renameState;
    }

    /* The builder's own default label is the element's HTML tag (set on insert).
       An EMPTY label is a broken state — with label === '' the settings-panel
       header title unmounts entirely, taking the native rename channel with it
       (verified 5 Jul 2026) — so "reset" writes the tag back, never ''. Returns
       '' when there is no tag to fall back to (components, collections). */
    function defaultLabelFor(id) {
        var mods = modules();
        var mod = mods && mods[id];
        if (!mod) { return ''; }
        var tag = (mod.settings || []).filter(function (s) { return s.name === 'tag'; })[0];
        return tag && typeof tag.value === 'string' ? tag.value : '';
    }

    function dbeRestoreRenameFocus(id, preferred) {
        var target = preferred && preferred.isConnected
            ? preferred : document.querySelector('.uniRightPanel .uni-tree-node-' + id);
        if (target) { try { target.focus(); } catch (e) {} }
    }

    function closeRename(commit, restoreFocus) {
        var st = renameState;
        if (!st) { return; }
        renameState = null;
        var next = (st.input.value || '').trim();
        st.input.remove();
        st.wrapper.classList.remove('dbe-renaming');
        if (st.li) { st.li.setAttribute('draggable', st.prevDraggable); }
        if (!commit) {
            if (restoreFocus) { dbeRestoreRenameFocus(st.id, st.focusReturn); }
            return;
        }
        if (!next) { next = defaultLabelFor(st.id); } // emptied field = reset to default
        if (next && next !== st.oldLabel) { commitRename(st.id, next, restoreFocus ? st.focusReturn : null); }
        else if (restoreFocus) { dbeRestoreRenameFocus(st.id, st.focusReturn); }
    }

    function commitRename(id, label, focusReturn) {
        var row = document.querySelector('.uniRightPanel .uni-tree-node-' + id);
        if (activeId() !== id) {
            if (!row) { return; }
            clickSeq(row); // real selection — hydrates the settings panel
        }
        waitFor(function () {
            if (activeId() !== id) { return null; }
            return document.querySelector('.uniLeftPanel .uniPanelHeader__title .text[contenteditable="true"]');
        }, function (ed) {
            if (!ed) { return; }
            ed.focus();
            // execCommand routes through the browser's editing pipeline, so the
            // builder's React handler receives a real input event — writing
            // textContent directly does not register.
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, label);
            ed.blur();
            if (focusReturn) { dbeRestoreRenameFocus(id, focusReturn); }
        });
    }

    function startRename(id) {
        closeRename(false);
        var mods = modules();
        var row = id && document.querySelector('.uniRightPanel .uni-tree-node-' + id);
        if (!row || !mods || !mods[id]) { return; }
        var wrapper = row.closest('.uniModTree__itemContentWrapper') || row.parentElement;
        var li = row.closest('li.uniModTree__itemDrag');
        var oldLabel = mods[id].label || '';

        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'dbe-rename-input';
        input.value = oldLabel;
        input.setAttribute('aria-label', dbeT('renameElement', 'Rename element'));

        renameState = {
            id: id, input: input, wrapper: wrapper, li: li, oldLabel: oldLabel,
            focusReturn: row,
            prevDraggable: li ? (li.getAttribute('draggable') || 'true') : 'true'
        };

        // Keystrokes must not reach the builder's shortcuts (Delete removes the
        // module!), and pointer events must not select the row or start a drag.
        input.addEventListener('keydown', function (ev) {
            ev.stopPropagation();
            if (ev.key === 'Enter') { ev.preventDefault(); closeRename(true, true); }
            else if (ev.key === 'Escape') { ev.preventDefault(); closeRename(false, true); }
        });
        ['keyup', 'keypress', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick']
            .forEach(function (t) { input.addEventListener(t, function (ev) { ev.stopPropagation(); }); });
        input.addEventListener('blur', function () { closeRename(true); });

        if (li) { li.setAttribute('draggable', 'false'); }
        wrapper.classList.add('dbe-renaming');
        wrapper.appendChild(input);
        input.focus();
        input.select();
    }

    /* (d2c) Auto-BEM / bulk class naming. Right-click an element -> "Auto-BEM…"
       opens a dialog listing the element and its subtree with suggested
       class names in the `{block}__{descriptor}` BEM convention, editable per
       row. Applying drives the NATIVE class picker per element (select the tree
       row, open .uniSystemSelectClasses, type, Enter) — the only outside-in
       channel that repaints AND persists; classes land in the module's
       `tagClass` setting and on the canvas element immediately (verified
       5 Jul 2026). Sequential, waitFor-bounded, abortable; a failed row is
       skipped, never wedges the queue. Nothing touches the server until the
       user hits the native Save. */
    var dbeBemBusy = false;

    function slugify(s) {
        return (s || '').toLowerCase().trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /* Semantic descriptor per tag for elements whose label is just the default
       (= the tag). Labelled elements use their slugified label instead. */
    var BEM_TAG_DESCRIPTORS = {
        h1: 'title', h2: 'title', h3: 'title', h4: 'title', h5: 'title', h6: 'title',
        p: 'text', span: 'text', img: 'image', picture: 'image', a: 'link',
        button: 'button', ul: 'list', ol: 'list', li: 'item', nav: 'nav',
        figure: 'figure', figcaption: 'caption', blockquote: 'quote',
        form: 'form', input: 'input', label: 'label', svg: 'icon',
        video: 'video', audio: 'audio', time: 'time', table: 'table',
        header: 'header', footer: 'footer', aside: 'aside'
    };

    function moduleClasses(mod) {
        var s = (mod && mod.settings || []).filter(function (x) { return x.name === 'tagClass'; })[0];
        return s && Array.isArray(s.value) ? s.value : [];
    }

    /* An element can take a class through the picker when it renders a real box
       and holds a tagClass: HtmlElement, the Collection / SubCollection loop
       wrappers (they render a real div/select/etc. and already hold classes like
       .pick, .property-grid), and the Composite family — but NOT an inert
       <template> node or a Component instance. Decided from the MODULE, not a
       canvas node, so an element the canvas has not painted (the empty container
       a freshly-added Section ships with, or one hidden by a rendering condition)
       is still classable — that was the "can't tick the section's container" bug. */
    function bemClassable(mod) {
        if (!mod || mod.name === 'Component' || mod.name === 'Template' || mod.name === 'RecursiveTemplate') {
            return false;
        }
        return mod.name === 'HtmlElement' || mod.name === 'Collection' ||
            mod.name === 'SubCollection' || /Composite/.test(mod.name);
    }

    /* The element's tag from its own `tag` setting first (present even when the
       canvas has not painted the element), falling back to the live canvas node. */
    function bemModuleTag(mod, canvasTag) {
        var t = (mod && mod.settings || []).filter(function (s) { return s.name === 'tag'; })[0];
        if (t && typeof t.value === 'string' && t.value) { return t.value.toLowerCase(); }
        return canvasTag || null;
    }

    /* parent id → [child ids] in module-map key order (= sibling order), one
       O(n) pass. The per-node Object.keys scan it replaces made every subtree
       walk quadratic — felt on Auto-BEM over a page root and on the undo
       capture of every delete. */
    function dbeChildIndex(mods) {
        var byParent = {};
        Object.keys(mods).forEach(function (k) {
            var p = mods[k].parent || '';
            (byParent[p] || (byParent[p] = [])).push(k);
        });
        return byParent;
    }

    /* The subtree in tree order (module-map key order = sibling order). */
    function bemCollectRows(rootId) {
        var mods = modules() || {};
        var iframe = dbeQuery('previewFrame');
        var idoc = iframe && iframe.contentDocument;
        var kids = dbeChildIndex(mods);
        var rows = [];
        (function walk(id, depth) {
            var mod = mods[id];
            if (!mod) { return; }
            var canvasEl = idoc && idoc.querySelector('.uni-node-' + id);
            var tag = bemModuleTag(mod, canvasEl ? canvasEl.tagName.toLowerCase() : null);
            rows.push({
                id: id, depth: depth, mod: mod, tag: tag,
                classes: moduleClasses(mod),
                supported: bemClassable(mod) && !!tag && tag !== 'template'
            });
            (kids[id] || []).forEach(function (k) { walk(k, depth + 1); });
        })(rootId, 0);
        return rows;
    }

    function bemDescriptor(row) {
        var label = (row.mod.label || '').trim();
        if (label && row.tag && label.toLowerCase() !== row.tag) { return slugify(label); }
        return BEM_TAG_DESCRIPTORS[row.tag] || row.tag || slugify(row.mod.name) || 'item';
    }

    /* One suggestion per row: the root is the block itself, descendants get
       {block}__{descriptor} (BEM element syntax), duplicates numbered -2/-3 in
       tree order. Matches the double-underscore BEM this site is built in
       (hero__title, section-head__group, property-card__price, …). */
    function bemSuggest(block, rows) {
        var used = {};
        return rows.map(function (row, i) {
            if (!row.supported) { return ''; }
            var name = i === 0 ? block : block + '__' + bemDescriptor(row);
            var base = name, n = 2;
            while (used[name]) { name = base + '-' + n; n += 1; }
            used[name] = true;
            return name;
        });
    }

    var BEM_CLASS_RE = /^-?[A-Za-z_][A-Za-z0-9_-]*$/;

    function dbeRemovePriorBemDialog() {
        var old = document.querySelector('dialog.dbe-bem');
        if (!old) { return; }
        if (old.open) { try { old.close(); } catch (e) {} }
        if (old.isConnected) { old.remove(); }
    }

    function openAutoBemDialog(rootId) {
        if (dbeBemBusy) { return; }
        var rows = bemCollectRows(rootId);
        if (!rows.length || !rows[0].supported) { return; }

        dbeRemovePriorBemDialog();
        var focusReturn = document.activeElement;
        var restoreFocusOnClose = true;
        var dlg = document.createElement('dialog');
        dlg.className = 'dbe-bem';
        dlg.setAttribute('aria-label', dbeT('autoBem', 'Auto-BEM'));

        var head = document.createElement('div');
        head.className = 'dbe-bem__head';
        var title = document.createElement('h2');
        title.className = 'dbe-bem__title';
        title.textContent = dbeT('autoBem', 'Auto-BEM');
        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'dbe-bem__close';
        close.setAttribute('aria-label', dbeT('close', 'Close'));
        close.textContent = '✕';
        close.addEventListener('click', function () { dlg.close(); });
        head.appendChild(title);
        head.appendChild(close);
        dlg.appendChild(head);

        // Block name — seeds every suggestion; rows the user edits stop following.
        var blockRow = document.createElement('div');
        blockRow.className = 'dbe-bem__block';
        var blockLabel = document.createElement('label');
        blockLabel.setAttribute('for', 'dbe-bem-block');
        blockLabel.textContent = dbeT('blockName', 'Block name');
        var blockInput = document.createElement('input');
        blockInput.type = 'text';
        blockInput.id = 'dbe-bem-block';
        blockInput.value = bemDescriptor(rows[0]);
        blockRow.appendChild(blockLabel);
        blockRow.appendChild(blockInput);
        dlg.appendChild(blockRow);

        var list = document.createElement('div');
        list.className = 'dbe-bem__list';
        list.setAttribute('role', 'group');
        list.setAttribute('aria-label', dbeT('elementsAndClassNames', 'Elements and class names'));
        dlg.appendChild(list);

        var applyBtn; // forward ref for the count refresh

        var suggestions = bemSuggest(blockInput.value, rows);
        var rowUi = rows.map(function (row, i) {
            var item = document.createElement('div');
            item.className = 'dbe-bem__row' + (row.supported ? '' : ' is-unsupported');
            item.style.setProperty('--dbe-bem-depth', String(row.depth));

            var check = document.createElement('input');
            check.type = 'checkbox';
            check.className = 'dbe-bem__check';
            // Pre-classed elements default to unchecked — they are usually
            // already named; unsupported rows cannot be checked at all.
            check.checked = row.supported && !row.classes.length;
            check.disabled = !row.supported;
            check.setAttribute('aria-label', dbeT('addClassToElement', 'Add a class to this element'));

            var tagBadge = document.createElement('span');
            tagBadge.className = 'dbe-bem__tag';
            tagBadge.textContent = row.tag ? '<' + row.tag + '>' : row.mod.name;

            var name = document.createElement('span');
            name.className = 'dbe-bem__label';
            var lbl = (row.mod.label || '').trim();
            name.textContent = (lbl && lbl.toLowerCase() !== row.tag) ? lbl : '';

            var field = document.createElement('input');
            field.type = 'text';
            field.className = 'dbe-bem__field';
            field.value = suggestions[i];
            field.disabled = !row.supported;
            field.setAttribute('aria-label', dbeT('className', 'Class name'));
            field.addEventListener('input', function () { field.dataset.dbeEdited = '1'; });

            var hint = document.createElement('span');
            hint.className = 'dbe-bem__hint';
            if (!row.supported) { hint.textContent = dbeT('notSupported', 'not supported'); }
            else if (row.classes.length) { hint.textContent = dbeFmt(dbeT('hasClasses', 'has %s'), '.' + row.classes.join(' .')); }

            check.addEventListener('change', refreshApplyCount);

            item.appendChild(check);
            item.appendChild(tagBadge);
            item.appendChild(name);
            item.appendChild(field);
            item.appendChild(hint);
            list.appendChild(item);
            return { row: row, check: check, field: field };
        });

        blockInput.addEventListener('input', function () {
            var next = bemSuggest(slugify(blockInput.value) || 'block', rows);
            rowUi.forEach(function (ui, i) {
                if (!ui.row.supported || ui.field.dataset.dbeEdited) { return; }
                ui.field.value = next[i];
            });
        });

        function pendingRows() {
            return rowUi.filter(function (ui) {
                return ui.check.checked && ui.row.supported && (ui.field.value || '').trim();
            });
        }
        function refreshApplyCount() {
            var n = pendingRows().length;
            applyBtn.textContent = dbeFmt(dbeTn(n, 'addClassesOne', 'Add %s class', 'addClassesMany', 'Add %s classes'), n);
            applyBtn.disabled = !n;
        }

        var foot = document.createElement('div');
        foot.className = 'dbe-bem__foot';
        var cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'dbe-bem__cancel';
        cancel.textContent = dbeT('cancel', 'Cancel');
        cancel.addEventListener('click', function () { dlg.close(); });
        applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'dbe-bem__apply';
        applyBtn.addEventListener('click', function () {
            var jobs = pendingRows().map(function (ui) {
                return { id: ui.row.id, className: (ui.field.value || '').trim() };
            });
            var bad = jobs.filter(function (j) { return !BEM_CLASS_RE.test(j.className); });
            if (bad.length) {
                undoToast(dbeFmt(dbeT('invalidClassName', 'Invalid class name: “%s”'), bad[0].className));
                return;
            }
            // The dialog is showModal(): everything outside it is inert, so it
            // MUST close before the queue can click tree rows and the picker.
            restoreFocusOnClose = false;
            dlg.close();
            applyBemQueue(jobs);
        });
        foot.appendChild(cancel);
        foot.appendChild(applyBtn);
        dlg.appendChild(foot);
        refreshApplyCount();

        // Isolate the dialog from the builder's global handlers. Keys must not
        // reach it (Delete removes the selected element!); Escape keeps its native
        // close behaviour. Pointer events must not either: Builderius has a
        // document-level click handler that preventDefault()s clicks landing
        // outside its React root (our dialog is appended to <body>), which
        // reverted the row checkboxes' native toggle — they looked un-checkable.
        // Stopping propagation at the dialog leaves the inner controls' own
        // target-phase handlers (Apply/Cancel, the checkboxes) working while the
        // builder never sees the event.
        dbeBindEditingDialogEscape(dlg);
        dlg.addEventListener('keydown', function (e) { e.stopPropagation(); });
        ['pointerdown', 'mousedown', 'click'].forEach(function (t) {
            dlg.addEventListener(t, function (e) { e.stopPropagation(); });
        });
        dlg.addEventListener('close', function () {
            dlg.remove();
            if (restoreFocusOnClose) { dbeEditingDialogFocusReturn(focusReturn); }
        });
        document.body.appendChild(dlg);
        dlg.showModal();
        blockInput.focus();
        blockInput.select();
    }

    /* Full-viewport progress cover while the queue drives the builder — it
       blocks stray clicks that would derail the selection dance, shows a live
       counter, and offers Stop (finishes the current element, keeps what has
       already been applied). A plain fixed div, never a dialog: a showModal
       cover would make the builder inert for our own driving too. */
    function bemProgressCover() {
        var cover = document.createElement('div');
        cover.className = 'dbe-bem-progress';
        var card = document.createElement('div');
        card.className = 'dbe-bem-progress__card';
        var label = document.createElement('p');
        label.className = 'dbe-bem-progress__label';
        label.setAttribute('role', 'status');
        var stop = document.createElement('button');
        stop.type = 'button';
        stop.className = 'dbe-bem-progress__stop';
        stop.textContent = dbeT('stop', 'Stop');
        var aborted = false;
        stop.addEventListener('click', function () {
            aborted = true;
            stop.disabled = true;
            stop.textContent = dbeT('stopping', 'Stopping…');
        });
        card.appendChild(label);
        card.appendChild(stop);
        cover.appendChild(card);
        document.body.appendChild(cover);
        return {
            update: function (text) { label.textContent = text; },
            aborted: function () { return aborted; },
            close: function () { cover.remove(); }
        };
    }

    /* Close any open class-picker dropdown so the next element starts from a
       clean picker (an open dropdown from the previous element is the classic
       cause of a consecutive-row race). */
    function bemClosePicker() {
        var input = document.querySelector('.uniLeftPanel .uniSystemSelectClasses__search');
        if (input) {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
            input.blur();
        }
    }

    /* Apply one class through the native picker. done(ok). */
    function bemApplyOne(id, className, done) {
        // Already there? (e.g. re-run after a partial apply)
        var pre = modules();
        if (pre && pre[id] && moduleClasses(pre[id]).indexOf(className) !== -1) { done(true); return; }
        bemClosePicker(); // clear any dropdown left open by the previous element

        var attempts = 0;
        (function selectRow() {
            var row = document.querySelector('.uniRightPanel .uni-tree-node-' + id);
            if (row) { clickSeq(row); }
            waitFor(function () { return activeId() === id || null; }, function (ok) {
                if (!ok) {
                    if (++attempts < 3) { selectRow(); return; }
                    done(false); return;
                }
                // The picker lives in the Styles view; activate its tab if needed
                // (works for both the native strip and our code-mode replica).
                var lp = document.querySelector('.uniLeftPanel');
                var styles = lp && [].slice.call(lp.querySelectorAll('.uniPanelTabs__tab'))
                    .filter(function (t) { return /Styles/i.test(t.textContent || ''); })[0];
                if (styles && !styles.classList.contains('active')) { clickSeq(styles); }
                waitFor(function () {
                    return document.querySelector('.uniLeftPanel .uniSystemSelectClasses');
                }, function (picker) {
                    if (!picker) { done(false); return; }
                    // The picker opens differently depending on state: a fresh
                    // element with nothing picked shows the fake input; once ANY
                    // class has been picked this session the selected-selector
                    // persists across elements, so the picker shows a chip and
                    // opens via .uniSystemSelectClasses__selectedValueInner
                    // (verified 5 Jul 2026 — the chip's caret button does NOT
                    // open it). The add still lands on the active module either
                    // way; the landing check confirms it hit the right element.
                    var opener = picker.querySelector('.uniSystemSelectClasses__fakeInput') ||
                        picker.querySelector('.uniSystemSelectClasses__selectedValueInner') ||
                        picker.querySelector('.uniSystemSelectClasses__valueWrapper');
                    if (opener) { clickSeq(opener); }
                    waitFor(function () {
                        return document.querySelector('.uniLeftPanel .uniSystemSelectClasses__search');
                    }, function (input) {
                        if (!input) { done(false); return; }
                        // React-controlled input: go through the native value
                        // setter so the change event React sees is genuine.
                        var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                        setter.call(input, className);
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        setTimeout(function () {
                            ['keydown', 'keypress', 'keyup'].forEach(function (t) {
                                input.dispatchEvent(new KeyboardEvent(t, {
                                    key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                                    bubbles: true, cancelable: true
                                }));
                            });
                            waitFor(function () {
                                var mods = modules();
                                return (mods && mods[id] && moduleClasses(mods[id]).indexOf(className) !== -1) || null;
                            }, function (landed) { bemClosePicker(); done(!!landed); }, 40);
                        }, 80);
                    }, 60); // generous: the cold first element mounts the picker slowly
                }, 80);
            }, 20);
        })();
    }

    function applyBemQueue(jobs) {
        if (dbeBemBusy || !jobs.length) { return; }
        dbeBemBusy = true;
        var progress = bemProgressCover();
        var total = jobs.length;
        var added = 0;
        var retry = [];   // stragglers to re-attempt once the panel is warm

        function runPass(list, isRetry, whenDone) {
            var i = 0;
            (function next() {
                if (i >= list.length || progress.aborted()) { whenDone(); return; }
                var job = list[i];
                progress.update(dbeFmt(dbeT('applyingClasses', 'Applying classes… %1$s/%2$s (%3$s)'), added + 1, total, '.' + job.className));
                bemApplyOne(job.id, job.className, function (ok) {
                    if (ok) { added += 1; } else if (!isRetry) { retry.push(job); }
                    i += 1;
                    setTimeout(next, 200);
                });
            })();
        }

        function finish() {
            var failed = total - added;
            progress.close();
            dbeBemBusy = false;
            undoToast(dbeFmt(dbeTn(added, 'addedClassesOne', 'Added %s class', 'addedClassesMany', 'Added %s classes'), added) +
                (failed ? dbeFmt(dbeT('addedFailedSuffix', ', %s failed'), failed) : '') +
                (added ? dbeT('rememberToSave', ' (remember to save)') : ''));
            schedule();
        }

        // A short lead-in lets the just-closed dialog settle and the Styles
        // panel warm to code mode before the first element (the first apply
        // otherwise races that transition). Failed elements get one retry pass,
        // by which point the panel is warm.
        setTimeout(function () {
            runPass(jobs, false, function () {
                if (retry.length && !progress.aborted()) {
                    setTimeout(function () { runPass(retry, true, finish); }, 250);
                } else { finish(); }
            });
        }, 350);
    }

    /* (d3) Undo/redo — Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z — for element adds,
       deletes and DBE structural moves. Builderius records history but consumes none of it, and a raw
       storeSet neither repaints nor persists, so we reverse each change through
       the builder's own controllers, which repaint tree + canvas natively:
       - a DELETE is reversed by re-adding the subtree: native Copy writes
         {modules, indexes, template, version, source:"builderiusCopiedElements"}
         to the clipboard, which we forge from the deleted subtree, then drive
         native Paste (inserts as the LAST CHILD of the selected module, or root);
       - an ADD is reversed by removing the element: drive native Remove.
       Records are symmetric: `op` is what reverses the user's action ('restore' a
       removed subtree, or 'remove' an added element), and running one pushes the
       inverse onto the other stack, so redo is just the mirror. Module.added and
       Module.deleted feed the two directions; our OWN paste/remove during an
       undo/redo are skipped via dbeUndoBusy so they do not re-enter the stacks.
       Structural moves carry their previous parent and index, so their inverse is
       immediate and preserves identity. Restored elements get a new id (paste
       regenerates them), then move back between their recorded sibling anchors;
       an old-to-new id map keeps those anchors useful when several deleted
       siblings are restored in either direction. A re-add whose parent was
       itself restored can still fail. Property edits are not covered. The user's
       clipboard is saved/restored around the forgery where the browser allows
       reading it. */
    var undoStack = [];
    var redoStack = [];
    var dbeUndoBusy = false;
    var dbeHistoryRestoredIds = {};
    var toastTimer = null;
    var toastDuration = 2600;

    function dbeHistoryActionAvailable(action) {
        var stack = action === 'redo' ? redoStack : undoStack;
        var rec = stack[stack.length - 1];
        return on('undo_delete') && !!rec && rec.op !== 'barrier';
    }

    function dbeHideToast(t) {
        dbeClearOwnedTimeout(DBE_EDITING_OWNER, toastTimer);
        toastTimer = null;
        t.classList.remove('is-visible');
        t.setAttribute('aria-hidden', 'true');
        var action = t.querySelector('.dbe-undo-toast__action');
        if (action) { action.tabIndex = -1; }
    }

    function dbeScheduleToast(t) {
        dbeClearOwnedTimeout(DBE_EDITING_OWNER, toastTimer);
        toastTimer = dbeSetOwnedTimeout(DBE_EDITING_OWNER, function () { dbeHideToast(t); }, toastDuration);
    }

    function undoToast(msg, action) {
        var t = document.querySelector('.dbe-undo-toast');
        if (!t) {
            t = document.createElement('div');
            t.className = 'dbe-undo-toast';
            t.addEventListener('mouseenter', function () { dbeClearOwnedTimeout(DBE_EDITING_OWNER, toastTimer); });
            t.addEventListener('mouseleave', function () { dbeScheduleToast(t); });
            t.addEventListener('focusin', function () { dbeClearOwnedTimeout(DBE_EDITING_OWNER, toastTimer); });
            t.addEventListener('focusout', function () {
                dbeSetOwnedTimeout(DBE_EDITING_OWNER, function () {
                    if (!t.contains(document.activeElement)) { dbeScheduleToast(t); }
                }, 0);
            });
            document.body.appendChild(t);
        }
        t.innerHTML = '';
        t.removeAttribute('aria-hidden');
        var message = document.createElement('span');
        message.className = 'dbe-undo-toast__message';
        message.setAttribute('role', 'status'); // polite live region for SRs
        message.textContent = msg;
        t.appendChild(message);

        var hasAction = (action === 'undo' || action === 'redo') && dbeHistoryActionAvailable(action);
        if (hasAction) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'dbe-undo-toast__action';
            button.textContent = action === 'redo' ? dbeT('redoAction', 'Redo') : dbeT('undoAction', 'Undo');
            button.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                button.disabled = true;
                button.blur();
                dbeHideToast(t);
                if (action === 'redo') { performRedo(); } else { performUndo(); }
            });
            t.appendChild(button);
        }
        t.classList.toggle('has-action', hasAction);
        t.classList.add('is-visible');
        toastDuration = hasAction ? 8000 : 2600;
        dbeScheduleToast(t);
    }

    // Collect the subtree rooted at id from a modules map, reparenting the root
    // to '' (the shape native Paste expects in the forged clipboard).
    function dbeCollectSubtree(mods, id) {
        var subtree = {};
        var kids = dbeChildIndex(mods);
        (function collect(x) {
            subtree[x] = JSON.parse(JSON.stringify(mods[x]));
            (kids[x] || []).forEach(collect);
        })(id);
        subtree[id].parent = '';
        return subtree;
    }

    /* Record both the numeric slot and its neighbouring siblings. The anchors
       matter for a batch delete: if C is restored before A and B, clamping C's
       old index to the current list length would lose its relationship to B.
       Once B returns, its `afterId: C` anchor places it correctly before C. */
    function dbeHistoryPlacement(mods, indexes, id) {
        var mod = mods && mods[id];
        var parentId = (mod && mod.parent) || '';
        var siblings = [].concat((indexes && indexes[parentId || 'root']) || []);
        var index = siblings.indexOf(id);
        return {
            parentId: parentId,
            index: index,
            beforeId: index > 0 ? siblings[index - 1] : '',
            afterId: index >= 0 && index + 1 < siblings.length ? siblings[index + 1] : ''
        };
    }

    /* Paste regenerates ids. Follow the short old→new chain so a later sibling
       can still find an anchor that was itself restored during an earlier Undo
       or Redo step. */
    function dbeHistoryLiveId(id, mods) {
        var current = id;
        var limit = 20;
        while (current && limit-- > 0) {
            if (mods[current]) { return current; }
            var next = dbeHistoryRestoredIds[current];
            if (!next || next === current) { return ''; }
            current = next;
        }
        return '';
    }

    function dbeRestoreTargetIndex(rec, siblings, mods, newId) {
        var afterId = dbeHistoryLiveId(rec.afterId, mods);
        var afterAt = afterId && afterId !== newId ? siblings.indexOf(afterId) : -1;
        if (afterAt >= 0) { return afterAt; }
        var beforeId = dbeHistoryLiveId(rec.beforeId, mods);
        var beforeAt = beforeId && beforeId !== newId ? siblings.indexOf(beforeId) : -1;
        if (beforeAt >= 0) { return beforeAt + 1; }
        if (typeof rec.index === 'number' && rec.index >= 0) {
            return Math.min(rec.index, Math.max(0, siblings.length - 1));
        }
        return -1;
    }

    function dbePositionRestoredModule(newId, rec) {
        dbeHistoryRestoredIds[rec.id] = newId;
        var location = dbeMoveLocation(newId);
        if (!location || location.index < 0) { return; }
        var target = dbeRestoreTargetIndex(rec, location.siblings, location.mods, newId);
        if (target >= 0 && target !== location.index) {
            storeMoveModule(location.sf, newId, rec.parentId, target);
        }
    }

    // Push a user action onto the undo stack; a fresh action invalidates redo.
    function dbeHistoryPush(rec) {
        undoStack.push(rec);
        if (undoStack.length > 10) { undoStack.shift(); }
        redoStack = [];
    }

    /* Seal off the plugin's step-undo after a compound reconcile (Edit as HTML,
       Import HTML). Those run as one many-step operation the simple add/delete
       stack can't represent, so a Cmd+Z straight after would otherwise revert
       an unrelated EARLIER action. A sticky barrier record sits on top instead:
       Cmd+Z onto it explains the change isn't step-undoable and reverts nothing,
       and it re-pushes itself so the earlier history stays parked behind it (not
       destroyed) rather than being crossed. New actions still stack above it and
       undo normally. Only meaningful while undo_delete owns Cmd+Z; a no-op
       otherwise, and to be retired once Builderius ships native history. */
    function dbeHistoryBarrier(msg) {
        if (!on('undo_delete')) { return; }
        dbeHistoryPush({ op: 'barrier', msg: msg });
    }

    function hookHistoryCapture() {
        // DELETE: the element is already gone from the live store, so rebuild
        // its subtree from the most recent history snapshot that still holds it.
        dbeBindOwnedHook(DBE_EDITING_OWNER, 'builderius.Module.deleted', 'dbeUndoCaptureDel', function (p) {
            if (dbeUndoBusy || !p || !p.id) { return; }
            var hist;
            try { hist = store().storeGet('history') || []; } catch (e) { return; }
            var snap = null;
            for (var i = hist.length - 1; i >= 0; i--) {
                var candidate = hist[i].snapshot;
                var sm = candidate && candidate.modules;
                if (sm && sm[p.id]) { snap = candidate; break; }
            }
            if (!snap) { return; }
            var snapMods = snap.modules;
            var placement = dbeHistoryPlacement(snapMods, snap.indexes || {}, p.id);
            dbeHistoryPush({
                op: 'restore',
                id: p.id,
                label: snapMods[p.id].label || snapMods[p.id].name || dbeT('element', 'element'),
                parentId: placement.parentId,
                index: placement.index,
                beforeId: placement.beforeId,
                afterId: placement.afterId,
                subtree: dbeCollectSubtree(snapMods, p.id)
            });
        });
        // ADD: undo removes it, hence op:'remove'. The subtree needed to re-add
        // it on redo is snapshotted from the live store at undo time.
        dbeBindOwnedHook(DBE_EDITING_OWNER, 'builderius.Module.added', 'dbeUndoCaptureAdd', function (p) {
            if (dbeUndoBusy || !p || !p.id) { return; }
            var m = (modules() || {})[p.id];
            dbeHistoryPush({
                op: 'remove',
                id: p.id,
                label: (m && (m.label || m.name)) || dbeT('element', 'element'),
                parentId: (m && m.parent) || ''
            });
        });
    }

    /* ============================ Edit as HTML ============================
       (edit_as_html, Pro). Right-click an element -> "Edit as HTML" opens the
       element and its subtree as readable, pretty-printed HTML in a dialog;
       Apply parses the edited markup, sanitises it and reconciles it back
       onto the module tree.

       Identity: every serialised element carries a data-dbe-id marker. On
       re-parse, a node whose marker matches a module in the ORIGINAL subtree
       KEEPS that module — its id, label, conditions and every setting the
       HTML doesn't express survive; only tag / id / class / attributes /
       leading text are updated. Unmarked nodes become new HtmlElements;
       original modules whose marker is gone are removed. A duplicated marker
       counts only once (first in document order) — the copy becomes new.

       Channels: kept nodes update via the addModule upsert; new nodes via
       storeAddModule; ordering/reparenting via storeMoveModule; removals via
       the native menu Remove (the only delete that repaints AND persists),
       driven sequentially on the top-most removed nodes only (children go
       with their parent). Retained nodes are moved FIRST so deleting an old
       parent cannot take a retained descendant with it. dbeUndoBusy is held across the whole apply so
       the individual add/delete steps record nothing; instead the apply drops
       one sticky barrier (dbeHistoryBarrier) so a Cmd+Z straight after reports
       the change isn't step-undoable and can't revert an earlier action. Whole-
       operation undo is deferred to Builderius' upcoming native history.

       Model limits (v1, by design): a subtree is editable when every module
       in it is a type the dialogs express (see DBE_HTML_MODULES: HtmlElement,
       Collection, SubCollection, Template, SvgCode, Component). A subtree
       containing anything else — HtmlCode or a composite — disables the menu
       item with a tip. `content` (the module's raw leading text, which may carry [[tokens]]
       or inline HTML) serialises raw; on re-parse only leading TEXT becomes
       content again, so inline elements typed inside text become real child
       elements, and text between elements becomes a span — same rendering,
       more structure. */

    var DBE_HTML_VOID = {
        img: 1, input: 1, br: 1, hr: 1, area: 1, base: 1, col: 1, embed: 1,
        link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1
    };
    var DBE_HTML_KNOWN_TAGS = ('a abbr address area article aside audio b bdi bdo blockquote br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr i img input ins kbd label legend li main mark menu meter nav ol optgroup option output p picture pre progress q rp rt ruby s samp search section select small source span strong sub summary sup table tbody td template textarea tfoot th thead time tr track u ul var video wbr')
        .split(' ').reduce(function (m, t) { m[t] = 1; return m; }, {});

    /* Return the tag to close when `>` is typed at a collapsed caret. Keep
       this independent of Monaco so the textarea fallback behaves identically.
       The quote scan prevents an angle bracket typed inside an attribute value
       from being mistaken for the end of the opening tag. */
    function dbeHtmlAutoCloseTag(value, start, end) {
        if (typeof value !== 'string' || start !== end || start < 1) { return ''; }
        var before = value.slice(0, start);
        var after = value.slice(end);
        var openAt = -1;
        var scanningQuote = '';
        for (var scanAt = 0; scanAt < before.length; scanAt++) {
            var scanChar = before.charAt(scanAt);
            if (openAt < 0) {
                if (scanChar === '<') { openAt = scanAt; }
            } else if (scanningQuote) {
                if (scanChar === scanningQuote) { scanningQuote = ''; }
            } else if (scanChar === '"' || scanChar === "'") {
                scanningQuote = scanChar;
            } else if (scanChar === '>') {
                openAt = -1;
            } else if (scanChar === '<') {
                openAt = scanAt;
            }
        }
        if (openAt < 0) { return ''; }

        var inside = before.slice(openAt + 1);
        if (!inside || /^[\s]*[!/?]/.test(inside) || /\/\s*$/.test(inside)) { return ''; }

        var quote = '';
        for (var i = 0; i < inside.length; i++) {
            var ch = inside.charAt(i);
            if (!quote && (ch === '"' || ch === "'")) {
                quote = ch;
            } else if (quote === ch) {
                quote = '';
            }
        }
        if (quote) { return ''; }

        var match = inside.match(/^\s*([A-Za-z][A-Za-z0-9:-]*)(?:\s|$)/);
        if (!match || DBE_HTML_VOID[match[1].toLowerCase()]) { return ''; }

        var nextClosing = after.match(/^\s*<\/\s*([A-Za-z][A-Za-z0-9:-]*)\s*>/);
        if (nextClosing && nextClosing[1].toLowerCase() === match[1].toLowerCase()) { return ''; }
        return match[1];
    }

    /* Class completions combine classes already assigned to Builderius modules
       with selectors from the preview's global/entity stylesheets. Each item
       retains its provenance and a few authored rules for Monaco's detail
       panel instead of presenting an unexplained flat name list. */
    function dbeHtmlClassItems(editorValue) {
        var items = {};
        function item(name) {
            if (!items[name]) { items[name] = { name: name, modules: 0, markup: false, rules: [] }; }
            return items[name];
        }
        var currentModules = modules() || {};
        Object.keys(currentModules).forEach(function (id) {
            moduleClasses(currentModules[id]).forEach(function (name) {
                if (typeof name === 'string' && name) { item(name).modules += 1; }
            });
        });
        String(editorValue || '').replace(/\bclass(?:Name)?\s*=\s*["']([^"']*)["']/gi, function (all, value) {
            value.trim().split(/\s+/).forEach(function (name) {
                if (name) { item(name).markup = true; }
            });
            return all;
        });

        var frame = dbeQuery('previewFrame');
        var previewDocument = frame && frame.contentDocument;
        function collectFromRules(rules) {
            for (var i = 0; rules && i < rules.length; i++) {
                var rule = rules[i];
                if (rule.selectorText) {
                    var matches = rule.selectorText.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g);
                    for (var match of matches) {
                        var found = item(match[1]);
                        var summary = rule.selectorText + ' { ' + String(rule.style && rule.style.cssText || '') + ' }';
                        if (found.rules.length < 3 && found.rules.indexOf(summary) === -1) { found.rules.push(summary); }
                    }
                }
                if (rule.cssRules) {
                    try { collectFromRules(rule.cssRules); } catch (e) {}
                }
            }
        }
        if (previewDocument) {
            var sheets = [].slice.call(previewDocument.styleSheets || [])
                .concat([].slice.call(previewDocument.adoptedStyleSheets || []));
            sheets.filter(function (sheet, index) { return sheets.indexOf(sheet) === index; }).forEach(function (sheet) {
                try { collectFromRules(sheet.cssRules); } catch (e) {}
            });
        }
        return Object.keys(items).filter(function (name) {
            return name.indexOf('uni-') !== 0;
        }).sort().map(function (name) { return items[name]; });
    }

    function dbeHtmlCompletionContext(model, position) {
        var value = model.getValue();
        var offset = model.getOffsetAt(position);
        var before = value.slice(0, offset);
        var dynamic = before.match(/(\[\[|\{\{)([A-Za-z0-9_.-]*)$/);
        if (dynamic) {
            return { type: 'dynamic', partial: dynamic[0], start: offset - dynamic[0].length };
        }
        var openAt = before.lastIndexOf('<');
        if (openAt < 0 || before.lastIndexOf('>') > openAt) { return null; }
        var inside = before.slice(openAt + 1);
        if (/^\s*[!/?]/.test(inside)) { return null; }
        var tagMatch = inside.match(/^\s*([A-Za-z][A-Za-z0-9:-]*)?/);
        var tag = tagMatch && tagMatch[1] ? tagMatch[1].toLowerCase() : '';
        if (!/\s/.test(inside) && inside.indexOf('=') === -1) {
            return { type: 'tag', tag: tag, partial: tag, start: offset - tag.length };
        }
        var valueMatch = inside.match(/([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(["'])([^"']*)$/);
        if (valueMatch) {
            var valuePartial = valueMatch[3].split(/\s+/).pop() || '';
            return {
                type: valueMatch[1].toLowerCase() === 'class' ? 'class' : 'value',
                tag: tag,
                attribute: valueMatch[1].toLowerCase(),
                partial: valuePartial,
                start: offset - valuePartial.length,
                inside: inside
            };
        }
        var attrMatch = inside.match(/(?:^|\s)([A-Za-z_:][A-Za-z0-9_.:-]*)?$/);
        if (!attrMatch) { return null; }
        var partial = attrMatch[1] || '';
        return { type: 'attribute', tag: tag, partial: partial, start: offset - partial.length, inside: inside };
    }

    function dbeHtmlCompletionRange(model, position, context) {
        var start = model.getPositionAt(context.start);
        return {
            startLineNumber: start.lineNumber,
            startColumn: start.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
        };
    }

    /* A small structural lexer catches errors DOMParser silently repairs,
       while retaining exact source offsets for diagnostics and paired-tag
       editing. Optional-end-tag elements are not reported as unclosed. */
    var DBE_HTML_OPTIONAL_END = {
        li: 1, dt: 1, dd: 1, p: 1, rt: 1, rp: 1, option: 1, optgroup: 1,
        colgroup: 1, thead: 1, tbody: 1, tfoot: 1, tr: 1, td: 1, th: 1
    };
    function dbeHtmlAnalyse(value) {
        var tokens = [];
        var at = 0;
        while ((at = value.indexOf('<', at)) !== -1) {
            if (value.slice(at, at + 4) === '<!--') {
                var commentEnd = value.indexOf('-->', at + 4);
                if (commentEnd === -1) {
                    return { tokens: tokens, pairs: {}, error: {
                        offset: at, length: 4,
                        message: dbeT('htmlErrUnclosedComment', 'Unclosed HTML comment')
                    } };
                }
                at = commentEnd + 3;
                continue;
            }
            var lead = value.slice(at + 1).match(/^\s*(\/)?\s*([A-Za-z][A-Za-z0-9:-]*)/);
            if (!lead) { at += 1; continue; }
            var quote = '';
            var end = at + 1;
            for (; end < value.length; end++) {
                var ch = value.charAt(end);
                if (quote) {
                    if (ch === quote) { quote = ''; }
                } else if (ch === '"' || ch === "'") {
                    quote = ch;
                } else if (ch === '>') {
                    break;
                }
            }
            if (end >= value.length) {
                return { tokens: tokens, pairs: {}, error: {
                    offset: at, length: Math.max(1, value.length - at),
                    message: dbeT('htmlErrUnclosedOpening', 'Opening tag is missing its closing bracket')
                } };
            }
            var raw = value.slice(at, end + 1);
            var nameOffset = raw.indexOf(lead[2]);
            tokens.push({
                start: at, end: end + 1, nameStart: at + nameOffset,
                nameEnd: at + nameOffset + lead[2].length,
                name: lead[2].toLowerCase(), rawName: lead[2],
                closing: !!lead[1], selfClosing: /\/\s*>$/.test(raw)
            });
            at = end + 1;
        }

        var pairs = {};
        var stack = [];
        tokens.forEach(function (token, index) {
            if (!token.closing && !token.selfClosing && !DBE_HTML_VOID[token.name]) {
                if (stack.length && DBE_HTML_OPTIONAL_END[token.name] && stack[stack.length - 1].token.name === token.name) {
                    stack.pop();
                }
                stack.push({ token: token, index: index });
                return;
            }
            if (!token.closing) { return; }
            var matchAt = -1;
            for (var s = stack.length - 1; s >= 0; s--) {
                if (stack[s].token.name === token.name) { matchAt = s; break; }
            }
            if (matchAt === -1) {
                token.error = dbeFmt(dbeT('htmlErrUnexpectedClose', 'Unexpected closing tag </%s>'), token.rawName);
                return;
            }
            for (var between = stack.length - 1; between > matchAt; between--) {
                if (!DBE_HTML_OPTIONAL_END[stack[between].token.name]) {
                    token.error = dbeFmt(
                        dbeT('htmlErrMismatchedClose', 'Expected </%1$s> before </%2$s>'),
                        stack[between].token.rawName,
                        token.rawName
                    );
                    return;
                }
            }
            while (stack.length - 1 > matchAt) { stack.pop(); }
            var opening = stack.pop();
            pairs[index] = opening.index;
            pairs[opening.index] = index;
        });
        var bad = tokens.filter(function (token) { return !!token.error; })[0];
        if (bad) {
            return { tokens: tokens, pairs: pairs, error: {
                offset: bad.nameStart, length: bad.nameEnd - bad.nameStart, message: bad.error
            } };
        }
        for (var u = stack.length - 1; u >= 0; u--) {
            if (!DBE_HTML_OPTIONAL_END[stack[u].token.name]) {
                return { tokens: tokens, pairs: pairs, error: {
                    offset: stack[u].token.nameStart,
                    length: stack[u].token.nameEnd - stack[u].token.nameStart,
                    message: dbeFmt(dbeT('htmlErrUnclosedTag', 'Missing closing tag </%s>'), stack[u].token.rawName)
                } };
            }
        }
        return { tokens: tokens, pairs: pairs, error: null };
    }

    function dbeFormatHtml(value) {
        var template = document.createElement('template');
        template.innerHTML = String(value || '').trim();
        var lines = [];
        function attrs(el) {
            return [].slice.call(el.attributes || []).map(function (a) {
                return a.value === '' ? ' ' + a.name : ' ' + a.name + '="' + dbeHtmlEscapeAttr(a.value) + '"';
            }).join('');
        }
        function write(node, depth) {
            var pad = new Array(depth + 1).join('  ');
            if (node.nodeType === 3) {
                if (node.textContent.trim()) { lines.push(pad + node.textContent.trim()); }
                return;
            }
            if (node.nodeType === 8) { lines.push(pad + '<!--' + node.data + '-->'); return; }
            if (node.nodeType !== 1) { return; }
            var tag = node.localName || node.tagName.toLowerCase();
            var open = '<' + tag + attrs(node) + '>';
            if (DBE_HTML_VOID[tag]) { lines.push(pad + open); return; }
            var contentNodes = tag === 'template' && node.content
                ? [].slice.call(node.content.childNodes)
                : [].slice.call(node.childNodes);
            var elements = contentNodes.filter(function (child) { return child.nodeType === 1; });
            var text = contentNodes.filter(function (child) { return child.nodeType === 3; })
                .map(function (child) { return child.textContent; }).join('');
            if (!elements.length || text.trim()) {
                lines.push(pad + open + node.innerHTML + '</' + tag + '>');
                return;
            }
            lines.push(pad + open);
            contentNodes.forEach(function (child) { write(child, depth + 1); });
            lines.push(pad + '</' + tag + '>');
        }
        [].slice.call(template.content.childNodes).forEach(function (node) { write(node, 0); });
        return lines.join('\n');
    }

    function dbeSettingVal(mod, name) {
        var s = ((mod && mod.settings) || []).filter(function (x) { return x.name === name; })[0];
        return s ? s.value : undefined;
    }

    /* The module types the HTML dialogs can express. Collections and
       Templates joined once verified live: a Collection's data binding is an
       ordinary data-b-context attribute and its tag/classes are ordinary
       settings, and a Template is purely a type boundary that serialises as
       a real <template> element — everything HTML can't say (interactiveMode,
       rendering conditions) rides along on the kept-marker upsert. SvgCode
       is a LEAF: it serialises as its raw contentSvg markup and an <svg> in
       pasted markup becomes one. A Component is also a LEAF: it serialises as
       a <dbe-component name="slug"> custom element carrying its property
       overrides (see dbeComponentRegistry). Still excluded: HtmlCode and the
       composites. */
    var DBE_HTML_MODULES = { HtmlElement: 1, Collection: 1, SubCollection: 1, Template: 1, SvgCode: 1, Component: 1 };

    /* Map every registered component to its label and declared property names
       for the <dbe-component> syntax. Labels + slugs come from componentsList
       ({name: slug, title: label}); the declared props live on each
       component's own config in componentsData[slug].settings, entry
       `componentTmplProperties` ([{type,name,label,placeholder}]) — the same
       shape the server ability reads from template.settings. Serialising a
       component needs none of this (the slug + overrides are on the instance);
       the registry is for validating pasted props and defaulting new-instance
       labels. Kept as the client twin of dbe_ability_component_registry(). */
    function dbeComponentRegistry() {
        var reg = {};
        var list = store().storeGet('componentsList') || [];
        var data = store().storeGet('componentsData') || {};
        list.forEach(function (c) {
            if (!c || !c.name) { return; }
            var props = {};
            var cfg = data[c.name];
            ((cfg && cfg.settings) || []).forEach(function (s) {
                if (s.name === 'componentTmplProperties' && Array.isArray(s.value)) {
                    s.value.forEach(function (def) {
                        if (def && def.name) { props[String(def.name).toLowerCase()] = def; }
                    });
                }
            });
            reg[c.name] = { label: c.title || c.name, props: props };
        });
        return reg;
    }

    function dbeHtmlCompletionItems(api, model, position, context, classItems) {
        var kinds = api.languages.CompletionItemKind || {};
        var rules = api.languages.CompletionItemInsertTextRule || {};
        var range = dbeHtmlCompletionRange(model, position, context);
        var suggestions = [];
        function add(label, insertText, detail, kind, documentation, snippet) {
            var entry = {
                label: label,
                insertText: insertText,
                detail: detail,
                kind: kind || kinds.Property || 9,
                range: range
            };
            if (documentation) { entry.documentation = documentation; }
            if (snippet && rules.InsertAsSnippet != null) { entry.insertTextRules = rules.InsertAsSnippet; }
            suggestions.push(entry);
        }
        if (context.type === 'class') {
            (classItems || []).forEach(function (entry) {
                var sources = [];
                if (entry.modules) {
                    sources.push(dbeFmt(dbeT('htmlClassUsedCount', 'used on %s element(s)'), entry.modules));
                }
                if (entry.markup) { sources.push(dbeT('htmlClassCurrentMarkup', 'present in this markup')); }
                if (entry.rules.length) {
                    sources.push(dbeFmt(dbeT('htmlClassRuleCount', '%s authored rule(s)'), entry.rules.length));
                }
                add(
                    entry.name,
                    entry.name,
                    dbeT('existingBuilderiusClass', 'Existing Builderius class') +
                        (sources.length ? ' — ' + sources.join(', ') : ''),
                    kinds.Value || 12,
                    entry.rules.join('\n\n')
                );
            });
            return suggestions;
        }
        if (context.type === 'tag') {
            add(
                'dbe-component',
                'dbe-component name="${1:component_slug}" data-dbe-label="${2:Navigator label}"></dbe-component>',
                dbeT('htmlCompletionComponent', 'Builderius component instance'),
                kinds.Class || 6,
                dbeT('htmlCompletionComponentHelp', 'Choose a registered component slug and add its declared properties as attributes.'),
                true
            );
            add(
                'dbe-keep',
                'dbe-keep data-dbe-id="${1:module_id}"></dbe-keep>',
                dbeT('htmlCompletionKeep', 'Preserved unsupported Builderius module'),
                kinds.Class || 6,
                dbeT('htmlCompletionKeepHelp', 'Keeps an existing unsupported module unchanged during the HTML round trip.'),
                true
            );
            return suggestions;
        }
        if (context.type === 'dynamic') {
            add('[[wp.…]]', '[[wp.${1:path}]]', dbeT('htmlCompletionWpData', 'Builderius wp data variable'), kinds.Variable || 5, '', true);
            add('[[props.…]]', '[[props.${1:property}]]', dbeT('htmlCompletionPropData', 'Builderius component property'), kinds.Variable || 5, '', true);
            add('{{field}}', '{{${1:field}}}', dbeT('htmlCompletionCollectionData', 'Collection item field'), kinds.Variable || 5, '', true);
            return suggestions;
        }

        var registry = dbeComponentRegistry();
        var componentMatch = (context.inside || '').match(/\bname\s*=\s*["']([^"']+)["']/i);
        var component = componentMatch && registry[componentMatch[1]];
        if (context.type === 'attribute') {
            [
                ['data-dbe-label', 'data-dbe-label="${1:Navigator label}"', dbeT('htmlCompletionLabel', 'Builderius Navigator label')],
                ['data-b-context', 'data-b-context=\'[{"${1:field}":"${2:value}"}]\'', dbeT('htmlCompletionContext', 'Collection data source (static JSON)')],
                ['data-dbe-module', 'data-dbe-module="${1|collection,subcollection,template|}"', dbeT('htmlCompletionModule', 'Builderius module type')]
            ].forEach(function (def) { add(def[0], def[1], def[2], kinds.Property || 9, '', true); });
            if (context.tag === 'dbe-component') {
                add('name', 'name="${1:component_slug}"', dbeT('htmlCompletionComponentName', 'Registered component slug'), kinds.Property || 9, '', true);
                if (component) {
                    Object.keys(component.props).forEach(function (name) {
                        var def = component.props[name];
                        add(name, name + '="${1:' + (def.placeholder || def.label || name) + '}"',
                            dbeFmt(dbeT('htmlCompletionComponentProp', 'Component property — %s'), def.type || 'text'),
                            kinds.Property || 9, '', true);
                    });
                }
            }
            return suggestions;
        }
        if (context.type !== 'value') { return suggestions; }
        if (context.tag === 'dbe-component' && context.attribute === 'name') {
            Object.keys(registry).sort().forEach(function (slug) {
                add(slug, slug, registry[slug].label, kinds.Reference || 18);
            });
            return suggestions;
        }
        if (context.attribute === 'data-dbe-module') {
            ['collection', 'subcollection', 'template'].forEach(function (name) {
                add(name, name, dbeT('htmlCompletionModule', 'Builderius module type'), kinds.EnumMember || 20);
            });
            return suggestions;
        }
        if (component && component.props[context.attribute]) {
            var prop = component.props[context.attribute];
            if (/bool|true[_-]?false|checkbox|switch/i.test(prop.type || '')) {
                ['true', 'false'].forEach(function (value) {
                    add(value, value, dbeFmt(dbeT('htmlCompletionComponentProp', 'Component property — %s'), prop.type), kinds.Value || 12);
                });
            }
            var options = prop.options || prop.choices || prop.values || [];
            if (!Array.isArray(options) && typeof options === 'object') { options = Object.keys(options); }
            options.forEach(function (option) {
                var value = typeof option === 'object' ? (option.value || option.name || option.label) : option;
                if (value != null) { add(String(value), String(value), prop.label || context.attribute, kinds.Value || 12); }
            });
        }
        return suggestions;
    }

    /* Editable = the ROOT is a type the dialogs express. Descendants need not
       be: a non-expressible module inside the subtree (an HtmlCode block, a
       saved/composite module) serialises as a <dbe-keep> placeholder that
       round-trips it verbatim, so only the root has to be something the markup
       can actually stand in for. Matches the server ability, which rejects a
       non-expressible ROOT but keeps non-expressible descendants. */
    function dbeHtmlEditable(rootId) {
        var m = (modules() || {})[rootId];
        return !!(m && DBE_HTML_MODULES[m.name]);
    }

    function dbeHtmlEscapeAttr(v) {
        return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    /* The data-dbe-label attribute for a module whose Navigator label is
       CUSTOM (differs from the default the parser would assign a fresh
       element), '' otherwise. Emitting it surfaces custom names in the
       serialised HTML so a round-trip can rename them inline; suppressing
       the defaults keeps the markup clean. Mirror of the server helper. */
    function dbeSerializeLabel(m, defaultLabel) {
        var label = String((m && m.label) || '').replace(/\s+/g, ' ').trim();
        if (label === '' || label === defaultLabel) { return ''; }
        return ' data-dbe-label="' + dbeHtmlEscapeAttr(label) + '"';
    }

    function dbeSerializeSubtree(rootId) {
        var mods = modules() || {};
        var idx = store().storeGet('indexes') || {};
        function ser(id, depth) {
            var m = mods[id];
            if (!m) { return ''; }
            var pad = new Array(depth + 1).join('  ');
            // A module the dialogs can't express (HtmlCode, a saved/composite
            // module) serialises as a <dbe-keep> placeholder. On apply the
            // marker preserves it and its whole subtree verbatim, so the user
            // edits around it. Same shape as the server ability.
            if (!DBE_HTML_MODULES[m.name]) {
                return pad + '<dbe-keep data-dbe-id="' + id + '"><!-- '
                    + dbeHtmlEscapeAttr(m.name + ': ' + (m.label || ''))
                    + ' — preserved as-is, leave this element in place --></dbe-keep>';
            }
            // An SvgCode module serialises as its raw markup; the identity
            // marker rides on the <svg> tag itself (the markup IS the
            // contentSvg setting — there is no separate tag to carry it).
            if (m.name === 'SvgCode') {
                var svg = String(dbeSettingVal(m, 'contentSvg') || '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
                svg = svg.replace(/<svg\b/i, '<svg data-dbe-id="' + id + '"');
                return svg.split('\n').map(function (l) { return pad + l; }).join('\n');
            }
            // A Component instance serialises as a lowercase custom element
            // carrying its slug and property overrides. It is a LEAF (its
            // internals live in the component definition, not the instance).
            // Lowercase, not Astro <SiteHeader> PascalCase — HTML parsers
            // lowercase tag names, so the capitalisation would not round-trip.
            if (m.name === 'Component') {
                var slug = String(dbeSettingVal(m, 'componentName') || '');
                var copen = '<dbe-component name="' + dbeHtmlEscapeAttr(slug) + '"';
                (dbeSettingVal(m, 'componentProperties') || []).forEach(function (p) {
                    if (!p || !p.name) { return; }
                    copen += ' ' + p.name + '="' + dbeHtmlEscapeAttr(p.value == null ? '' : p.value) + '"';
                });
                var creg = dbeComponentRegistry();
                var componentLabel = String(m.label || '').replace(/\s+/g, ' ').trim();
                if (!componentLabel) {
                    componentLabel = String((creg[slug] && creg[slug].label) || 'Component')
                        .replace(/\s+/g, ' ').trim();
                }
                copen += ' data-dbe-label="' + dbeHtmlEscapeAttr(componentLabel) + '"';
                copen += ' data-dbe-id="' + id + '"></dbe-component>';
                return pad + copen;
            }
            // A Template module has no tag setting: it IS the <template>
            // boundary. Collections carry a normal tag setting (ul, div…).
            var tag = m.name === 'Template'
                ? 'template'
                : String(dbeSettingVal(m, 'tag') || 'div').toLowerCase();
            var open = '<' + tag;
            var tagId = dbeSettingVal(m, 'tagId');
            if (tagId) { open += ' id="' + dbeHtmlEscapeAttr(tagId) + '"'; }
            var classes = dbeSettingVal(m, 'tagClass');
            if (Array.isArray(classes) && classes.length) { open += ' class="' + dbeHtmlEscapeAttr(classes.join(' ')) + '"'; }
            var bindingAttr = false;
            (dbeSettingVal(m, 'htmlAttribute') || []).forEach(function (a) {
                if (!a || !a.name || a.name === 'data-dbe-id') { return; }
                var an = String(a.name).toLowerCase();
                if (an === 'data-b-context' || an === 'data-source') { bindingAttr = true; }
                // A value-less entry (the panel's empty-attribute shape) round-trips as name="".
                open += (a.value == null || a.value === '')
                    ? ' ' + a.name + '=""'
                    : ' ' + a.name + '="' + dbeHtmlEscapeAttr(a.value) + '"';
            });
            // A Collection/SubCollection whose binding is not stored as a
            // data-b-context/data-source attribute would re-parse as a plain
            // HtmlElement and fail the marker type check, so declare the type.
            if (!bindingAttr && (m.name === 'Collection' || m.name === 'SubCollection')) {
                open += ' data-dbe-module="' + m.name.toLowerCase() + '"';
            }
            open += dbeSerializeLabel(m, m.name === 'HtmlElement' ? (tag.charAt(0).toUpperCase() + tag.slice(1)) : m.name);
            open += ' data-dbe-id="' + id + '">';
            if (DBE_HTML_VOID[tag]) { return pad + open; }
            var content = dbeSettingVal(m, 'content');
            var text = content == null ? '' : String(content);
            var kids = idx[id] || [];
            if (!kids.length) {
                if (text.length <= 70 && text.indexOf('\n') === -1) { return pad + open + text + '</' + tag + '>'; }
                return pad + open + '\n' + pad + '  ' + text + '\n' + pad + '</' + tag + '>';
            }
            var lines = [pad + open];
            if (text !== '') { lines.push(pad + '  ' + text); }
            kids.forEach(function (k) { lines.push(ser(k, depth + 1)); });
            lines.push(pad + '</' + tag + '>');
            return lines.join('\n');
        }
        return ser(rootId, 0);
    }

    /* Parse + sanitise markup into plain trees of
       {existingId, tag, tagId, classes, attrs, content, children}. Returns
       {roots, stripped} — a fragment may have several sibling roots (the
       Import flow); the Edit flow enforces exactly one on top. Strips (and
       reports) anything unsafe or unknown. origIds = the id set the
       data-dbe-id markers may claim — pass {} to treat every element as new
       (markers pointing anywhere else are always ignored, so a dialog can
       never capture another part of the page). */
    var DBE_HTML_LIMITS = { bytes: 262144, nodes: 5000, depth: 100 };

    function dbeParseHtmlFragment(html, origIds) {
        var byteLength = new Blob([String(html)]).size;
        if (byteLength > DBE_HTML_LIMITS.bytes) {
            throw dbeFmt(dbeT('htmlErrTooLarge', 'The HTML is too large (%1$s bytes; maximum %2$s).'),
                byteLength, DBE_HTML_LIMITS.bytes);
        }
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var allNodes = doc.body.querySelectorAll('*').length;
        if (allNodes > DBE_HTML_LIMITS.nodes) {
            throw dbeFmt(dbeT('htmlErrTooManyNodes', 'The HTML contains too many elements (%1$s; maximum %2$s).'),
                allNodes, DBE_HTML_LIMITS.nodes);
        }
        var depthStack = [].slice.call(doc.body.children).map(function (el) { return { el: el, depth: 1 }; });
        while (depthStack.length) {
            var depthItem = depthStack.pop();
            if (depthItem.depth > DBE_HTML_LIMITS.depth) {
                throw dbeFmt(dbeT('htmlErrTooDeep', 'The HTML nesting exceeds the maximum depth of %s.'), DBE_HTML_LIMITS.depth);
            }
            var depthHost = (depthItem.el.tagName.toLowerCase() === 'template' && depthItem.el.content) ? depthItem.el.content : depthItem.el;
            [].slice.call(depthHost.children).forEach(function (child) {
                depthStack.push({ el: child, depth: depthItem.depth + 1 });
            });
        }
        var stripped = [];
        var claimed = {};
        // data-dbe-id markers that matched nothing in origIds — probably typos.
        // Each becomes a new element (and the id it meant to keep is removed),
        // so the Edit dialog warns about them. Callers with no origIds (Import,
        // where every element is new by design) simply ignore this.
        var unknownMarkers = {};
        var registry = dbeComponentRegistry();
        var STRIP_TAGS = { script: 1, style: 1, link: 1, meta: 1, iframe: 1, object: 1, embed: 1, noscript: 1, base: 1, math: 1 };
        function claim(marker, moduleName, representation) {
            marker = String(marker || '').trim();
            if (!marker) { return false; }
            if (!origIds[marker] || claimed[marker]) {
                unknownMarkers[marker] = true;
                return false;
            }
            var expected = origIds[marker];
            var valid = representation === 'keep' ? !DBE_HTML_MODULES[expected] : expected === moduleName;
            if (!valid) {
                throw dbeFmt(
                    dbeT('htmlErrMarkerType', 'Marked element %1$s is a %2$s but was submitted as %3$s.'),
                    marker, expected, moduleName);
            }
            claimed[marker] = true;
            return true;
        }
        /* An <svg> becomes an SvgCode module carrying its raw markup — the
           module renders `contentSvg` raw (twig |raw), so the same entry
           gate applies INSIDE the subtree before it is stored: script
           elements, on* handlers and javascript: URLs are cut out. A
           data-dbe-id on the <svg> itself keeps its module like any other
           element (the serialiser plants it there); markers deeper inside
           are just removed — the inner markup is one opaque setting. */
        function convertSvg(el) {
            var node = { existingId: null, module: 'SvgCode', tag: 'svg', tagId: '', classes: [], attrs: [], content: '', children: [], svg: '', label: '' };
            var marker = el.getAttribute('data-dbe-id');
            if (claim(marker, 'SvgCode', 'svg')) { node.existingId = marker; }
            // The Navigator label lives on the <svg> itself; read it before the
            // attribute scrub below removes the marker from the stored markup.
            var svgLabel = el.getAttribute('data-dbe-label');
            if (svgLabel) { node.label = String(svgLabel).replace(/\s+/g, ' ').trim(); }
            // The whole SVG is stored as one opaque raw string, so it gets the
            // same gate as element attributes plus SVG-specific element vectors.
            // One walk over the subtree: drop script-bearing / markup-smuggling
            // elements, then scrub dangerous attributes on whatever remains.
            // Element names are checked by lower-cased localName (the HTML
            // parser keeps SVG locals like foreignObject camel-cased, so a CSS
            // type selector is unreliable across namespaces).
            var SVG_DROP = { script: 1, foreignobject: 1, style: 1, handler: 1, listener: 1 };
            var SVG_ANIM = { animate: 1, set: 1, animatetransform: 1, animatemotion: 1 };
            var ariaNoted = false;
            [el].concat([].slice.call(el.querySelectorAll('*'))).forEach(function (d) {
                if (d !== el && !el.contains(d)) { return; } // removed with an ancestor already
                var ln = (d.localName || d.tagName || '').toLowerCase();
                if (d !== el && SVG_DROP[ln]) { stripped.push('<' + ln + '>'); d.parentNode.removeChild(d); return; }
                // <use> pulling in an external document is an injection vector;
                // a local #id reference is fine.
                if (ln === 'use') {
                    var uref = (d.getAttribute('href') || d.getAttribute('xlink:href') || '').trim();
                    if (uref && uref.charAt(0) !== '#') { stripped.push('<use external>'); d.parentNode.removeChild(d); return; }
                }
                // An animation that retargets href to a dangerous URL is the
                // SVG equivalent of an inline handler — SMIL sets it at runtime.
                if (SVG_ANIM[ln]) {
                    var target = (d.getAttribute('attributeName') || '').toLowerCase();
                    if (target === 'href' || target === 'xlink:href') {
                        var vals = [d.getAttribute('to'), d.getAttribute('from'), d.getAttribute('by')]
                            .concat((d.getAttribute('values') || '').split(';'));
                        if (vals.some(function (x) { return x && dbeDangerousUrl(x); })) {
                            stripped.push('<' + ln + '>'); d.parentNode.removeChild(d); return;
                        }
                    }
                }
                [].slice.call(d.attributes).forEach(function (a) {
                    var n = a.name.toLowerCase();
                    if (n === 'data-dbe-id' || n === 'data-dbe-module' || n === 'data-dbe-label') { d.removeAttribute(a.name); return; }
                    if (n.indexOf('on') === 0) { stripped.push(n); d.removeAttribute(a.name); return; }
                    // Builderius' save-time SVG validator (svgOrDynamic) only
                    // accepts markup identical to its sanitised form, and the
                    // sanitiser's attribute allowlist has no aria-* and no
                    // focusable. Stored anyway (some save paths skip the
                    // validator), such an SVG silently EMPTIES the template's
                    // deliverable HTML at commit/publish time — a blank page.
                    // Strip them here and say so; hide a decorative icon from
                    // assistive tech via a wrapper instead (e.g. a span with
                    // aria-hidden="true"), which Builderius does allow.
                    if (n === 'focusable' || n.indexOf('aria-') === 0) {
                        if (!ariaNoted) {
                            ariaNoted = true;
                            stripped.push('aria-*/focusable inside <svg> (Builderius disallows them — wrap the <svg> in an aria-hidden span instead)');
                        }
                        d.removeAttribute(a.name);
                        return;
                    }
                    if (DBE_URL_ATTRS[n] && dbeDangerousUrl(a.value)) {
                        stripped.push(n + '="' + String(a.value).slice(0, 12) + '…"');
                        d.removeAttribute(a.name);
                    }
                });
            });
            // Dedent: the serialiser indents the whole block to its tree
            // depth, and outerHTML keeps that inner whitespace — strip the
            // common indent so repeated edit round-trips don't stack it up.
            var svgLines = el.outerHTML.split('\n');
            if (svgLines.length > 1) {
                var indents = svgLines.slice(1).filter(function (l) { return l.trim(); })
                    .map(function (l) { return /^\s*/.exec(l)[0].length; });
                var minIndent = indents.length ? Math.min.apply(null, indents) : 0;
                node.svg = [svgLines[0]].concat(svgLines.slice(1).map(function (l) {
                    return l.slice(minIndent);
                })).join('\n');
            } else {
                node.svg = svgLines[0];
            }
            return node;
        }
        function convert(el) {
            var tag = el.tagName.toLowerCase();
            if (tag === 'svg') { return convertSvg(el); }
            // A keep-placeholder preserves a non-expressible module and its
            // whole subtree; its own children (the human-hint comment) are
            // ignored. The marker must point into the original subtree.
            if (tag === 'dbe-keep') {
                var kMarker = el.getAttribute('data-dbe-id');
                if (claim(kMarker, 'non-expressible module', 'keep')) { return { keep: kMarker }; }
                stripped.push('<dbe-keep> (invalid, unknown or duplicate marker)');
                return null;
            }
            // A component instance: <dbe-component name="slug" prop="value" …>.
            // `name` selects the component; every other attribute (bar the dbe
            // markers) is a property override validated against what the
            // component declares. It is a leaf — any children are ignored.
            if (tag === 'dbe-component') {
                var cslug = String(el.getAttribute('name') || '').trim();
                if (!cslug || !registry[cslug]) {
                    var invalidComponentMarker = String(el.getAttribute('data-dbe-id') || '').trim();
                    if (invalidComponentMarker && origIds[invalidComponentMarker] && !claimed[invalidComponentMarker]) {
                        throw dbeFmt(
                            dbeT('htmlErrUnknownMarkedComponent', 'Marked element %1$s uses the unknown component “%2$s”. Choose an available component or restore the original name.'),
                            invalidComponentMarker, cslug || dbeT('blankValue', 'blank'));
                    }
                    var avail = Object.keys(registry).join(', ');
                    stripped.push('<dbe-component name="' + cslug + '"> (' + (avail ? 'unknown component; available: ' + avail : 'no components registered') + ')');
                    return null;
                }
                var cnode = { existingId: null, module: 'Component', componentName: cslug, props: [], children: [], label: '' };
                var declared = registry[cslug].props;
                var cMarker = '';
                [].slice.call(el.attributes).forEach(function (a) {
                    var an = a.name.toLowerCase();
                    if (an === 'name') { return; }
                    if (an === 'data-dbe-id') {
                        cMarker = a.value;
                        return;
                    }
                    if (an === 'data-dbe-label') { cnode.label = String(a.value).replace(/\s+/g, ' ').trim(); return; }
                    // A prop the component does not declare cannot resolve, so
                    // it is dropped with a note rather than stored as dead data.
                    if (!declared[an]) {
                        stripped.push(an + ' (not a property of ' + cslug + ')');
                        return;
                    }
                    cnode.props.push({ name: declared[an].name, value: a.value });
                });
                if (claim(cMarker, 'Component', 'component')) { cnode.existingId = cMarker; }
                return cnode;
            }
            if (STRIP_TAGS[tag]) { stripped.push('<' + tag + '>'); return null; }
            if (!DBE_HTML_KNOWN_TAGS[tag]) { stripped.push('<' + tag + '>'); return null; }
            var node = { existingId: null, module: 'HtmlElement', tag: tag, tagId: '', classes: [], attrs: [], content: '', children: [], label: '' };
            if (tag === 'template') { node.module = 'Template'; }
            var nodeMarker = '';
            [].slice.call(el.attributes).forEach(function (a) {
                var n = a.name.toLowerCase();
                var v = a.value;
                if (n === 'data-dbe-id') {
                    nodeMarker = v;
                    return;
                }
                // Navigator label for the element. Consumed, never stored — sets
                // a new element's label, or renames a kept one. A blank value
                // falls through to the default (tag-derived) label.
                if (n === 'data-dbe-label') { node.label = String(v).replace(/\s+/g, ' ').trim(); return; }
                // Explicit module marker for NEW nodes (kept nodes take their
                // type from the live module regardless). Consumed, never stored.
                if (n === 'data-dbe-module') {
                    var mv = String(v).toLowerCase();
                    if (mv === 'collection') { node.module = 'Collection'; }
                    else if (mv === 'subcollection') { node.module = 'SubCollection'; }
                    return;
                }
                if (n === 'id') { node.tagId = v; return; }
                if (n === 'class') { node.classes = v.split(/\s+/).filter(Boolean); return; }
                // A data binding implies a Collection: data-b-context is how a
                // Collection stores what it loops over, and it stays a stored
                // attribute (verified live on the gallery Collection).
                if (n === 'data-b-context' && node.module === 'HtmlElement') { node.module = 'Collection'; }
                if (n === 'data-source' && node.module === 'HtmlElement') { node.module = 'SubCollection'; }
                // The one shared gate (dbeAttrBlocked): on* handlers and
                // javascript:/vbscript:/script-bearing data: URLs. Markers and
                // id/class/data-b-context are handled above, so they never
                // reach it here.
                var blocked = dbeAttrBlocked(n, v);
                if (blocked) { stripped.push(blocked); return; }
                node.attrs.push({ name: n, value: v });
            });
            if (claim(nodeMarker, node.module, 'element')) { node.existingId = nodeMarker; }
            var seenElement = false;
            // DOMParser parks a <template> element's children in its .content
            // fragment, not .childNodes — read from wherever they actually are.
            var kidsHost = (tag === 'template' && el.content) ? el.content : el;
            [].slice.call(kidsHost.childNodes).forEach(function (ch) {
                if (ch.nodeType === 3) {
                    var t = dbeEscapeRawText(ch.textContent.replace(/\s+/g, ' ').trim());
                    if (!t) { return; }
                    if (!seenElement) { node.content += (node.content ? ' ' : '') + t; }
                    else {
                        // Text after an element has no home in the content-first
                        // model — synthesise a span so nothing silently drops.
                        node.children.push({ existingId: null, tag: 'span', tagId: '', classes: [], attrs: [], content: t, children: [] });
                    }
                    return;
                }
                if (ch.nodeType === 1) {
                    var c = convert(ch);
                    if (c) { node.children.push(c); seenElement = true; }
                }
            });
            return node;
        }
        var roots = [].slice.call(doc.body.children).map(convert).filter(Boolean);
        return { roots: roots, stripped: stripped, unknownMarkers: Object.keys(unknownMarkers) };
    }

    /* The Edit-as-HTML shape: one root, or a structural error. */
    function dbeParseHtmlTree(html, origIds, rootId) {
        var parsed = dbeParseHtmlFragment(html, origIds);
        if (parsed.roots.length !== 1) {
            throw dbeT('htmlErrOneRoot', 'The HTML must have exactly one root element');
        }
        // The root carries the subtree's identity, so it can't be a preserved
        // placeholder — there would be nothing to edit.
        if (parsed.roots[0].keep) {
            throw dbeT('htmlErrRootKeep', 'The root element can’t be a preserved (<dbe-keep>) placeholder');
        }
        if (rootId && parsed.roots[0].module !== origIds[rootId]) {
            throw dbeFmt(
                dbeT('htmlErrRootType', 'The subtree root is a %1$s and cannot be submitted as %2$s.'),
                origIds[rootId], parsed.roots[0].module);
        }
        return { tree: parsed.roots[0], stripped: parsed.stripped, unknownMarkers: parsed.unknownMarkers };
    }

    /* Settings for a parsed node, shaped by its module type: a Template has
       no tag setting (the <template> boundary IS its identity) and neither
       Templates nor Collections take content — leading text inside them has
       no rendering channel, so it is dropped rather than stored dead. */
    function dbeNodeSettings(node) {
        var moduleName = node.module || 'HtmlElement';
        // An SvgCode module IS its markup — one opaque setting, nothing else
        // (the module excludes tagClass/tagId/htmlAttribute; id and class
        // live inside the markup string).
        if (moduleName === 'SvgCode') { return [{ name: 'contentSvg', value: node.svg || '' }]; }
        // A Component is identified by its slug, with optional prop overrides;
        // it carries none of the tag/class/content settings below.
        if (moduleName === 'Component') {
            var cs = [{ name: 'componentName', value: node.componentName }];
            if (node.props && node.props.length) { cs.push({ name: 'componentProperties', value: node.props.slice() }); }
            return cs;
        }
        var s = [];
        if (moduleName !== 'Template') { s.push({ name: 'tag', value: node.tag }); }
        if (node.tagId) { s.push({ name: 'tagId', value: node.tagId }); }
        if (node.classes.length) { s.push({ name: 'tagClass', value: node.classes.slice() }); }
        if (node.attrs.length) { s.push({ name: 'htmlAttribute', value: node.attrs.slice() }); }
        if (node.content && moduleName === 'HtmlElement') { s.push({ name: 'content', value: node.content }); }
        return s;
    }

    /* No structural rule is imposed on a parsed Collection's children: a
       Builderius Collection repeats its <template> child and renders any other
       (static) children once around it, so static elements alongside the
       template are valid (core's DataContentModules… render listener keys the
       repetition off the <template> child and leaves the rest static). An
       earlier "a collection may only contain <template> elements" rule was
       wrong and rejected legitimate static content, so it is gone. */

    /* Reconcile the parsed tree onto the live subtree. done(counts). */
    function dbeApplyHtmlTree(rootId, tree, done) {
        var sf = store();
        var mods = sf.storeGet('modules') || {};
        var idx = sf.storeGet('indexes') || {};
        tree.existingId = rootId; // the root's identity is never negotiable

        var kept = {};
        (function mark(n) {
            // A keep placeholder preserves its module AND its entire live
            // subtree, none of which appears in the parsed tree — so mark the
            // whole store subtree kept, or the descendants would fall into the
            // delete set and be removed out from under the preserved module.
            if (n.keep) {
                (function keepAll(id) { kept[id] = true; (idx[id] || []).forEach(keepAll); })(n.keep);
                return;
            }
            if (n.existingId) { kept[n.existingId] = true; }
            (n.children || []).forEach(mark);
        })(tree);

        var origIdsInOrder = [];
        (function collect(id) {
            origIdsInOrder.push(id);
            (idx[id] || []).forEach(collect);
        })(rootId);
        var deleted = {};
        origIdsInOrder.forEach(function (id) { if (!kept[id]) { deleted[id] = true; } });
        // Only the top-most removed nodes need driving — children go with them.
        var topDeleted = origIdsInOrder.filter(function (id) {
            return deleted[id] && !deleted[(mods[id] && mods[id].parent) || ''];
        });

        var counts = { kept: 0, added: 0, removed: Object.keys(deleted).length };
        var wasBusy = dbeUndoBusy;
        dbeUndoBusy = true;

        function build() {
            var sf2 = store();
            function place(node, parentId, index) {
                var id;
                if (node.keep) {
                    // Preserve the module and its subtree untouched; only its
                    // position among siblings may have changed. No settings
                    // rewrite, no recursion — the store subtree stays as-is.
                    if (parentId !== null) { storeMoveModule(sf2, node.keep, parentId, index); }
                    counts.kept += 1;
                    return;
                }
                if (node.existingId) {
                    var live = sf2.storeGet('modules') || {};
                    var m = live[node.existingId] && JSON.parse(JSON.stringify(live[node.existingId]));
                    if (m) {
                        // The live module's TYPE always wins over whatever the
                        // markup guessed, and shapes which settings we write
                        // (a kept Template never gets a tag setting back).
                        node.module = m.name;
                        // Replace only the HTML-expressible settings; everything
                        // else (conditions, interactiveMode…) rides along.
                        var keep = (m.settings || []).filter(function (x) {
                            return ['tag', 'tagId', 'tagClass', 'htmlAttribute', 'content', 'contentSvg', 'componentName', 'componentProperties'].indexOf(x.name) === -1;
                        });
                        m.settings = keep.concat(dbeNodeSettings(node));
                        // A data-dbe-label on a kept element renames it; without
                        // one the live label rides along untouched.
                        if (node.label) { m.label = node.label; }
                        sf2.storeSet('addModule', { module: m }); // existing id = upsert
                        counts.kept += 1;
                    }
                    id = node.existingId;
                    if (parentId !== null) { storeMoveModule(sf2, id, parentId, index); }
                } else {
                    var moduleName = node.module || 'HtmlElement';
                    var newLabel = node.label;
                    if (!newLabel) {
                        if (moduleName === 'HtmlElement') {
                            newLabel = node.tag.charAt(0).toUpperCase() + node.tag.slice(1);
                        } else if (moduleName === 'Component') {
                            var creg = dbeComponentRegistry();
                            newLabel = (creg[node.componentName] && creg[node.componentName].label) || moduleName;
                        } else {
                            newLabel = moduleName;
                        }
                    }
                    var mod = {
                        id: dbeMakeId(sf2.storeGet('modules') || {}), name: moduleName,
                        label: newLabel,
                        settings: dbeNodeSettings(node)
                    };
                    storeAddModule(sf2, mod, parentId, index);
                    counts.added += 1;
                    id = mod.id;
                }
                (node.children || []).forEach(function (c, i) { place(c, id, i); });
            }
            place(tree, null, 0); // null parent = the root stays where it is

            // Only after retained descendants have reached their new parents is
            // it safe to remove obsolete ancestors through the native menu.
            (function removeNext(i) {
                if (i >= topDeleted.length) {
                    dbeUndoBusy = wasBusy;
                    if (activeId() === rootId) { dbeReselectToRehydrate(rootId); }
                    done(counts);
                    return;
                }
                driveContextMenuItem(topDeleted[i], 'Remove', function () {
                    setTimeout(function () { removeNext(i + 1); }, 150);
                });
            })(0);
        }

        build();
    }

    var dbeHtmlBusy = false;

    /* The code field for the HTML dialogs: a Monaco editor with HTML syntax
       highlighting when the builder's bundle exposes it (window.Builderius.
       API.monaco — there is no window.monaco), else the plain textarea the
       dialogs shipped with. Returns a uniform handle so the callers never
       branch: { el, getValue, setValue, focus, onChange, layout, dispose }.
       Monaco needs a laid-out, sized container, so layout() is called once the
       dialog has shown; the light theme comes free from 60-theme.css inverting
       .monaco-editor, exactly as for the CSS editor. */
    function dbeMakeCodeEditor(opts) {
        opts = opts || {};
        var api = window.Builderius && window.Builderius.API && window.Builderius.API.monaco;
        if (api && api.editor && typeof api.editor.create === 'function') {
            var host = document.createElement('div');
            host.className = 'dbe-html__editor dbe-html__editor--monaco';
            var ed = null;
            try {
                ed = api.editor.create(host, {
                    value: opts.value || '',
                    language: 'html',
                    theme: 'vs-dark', // 60-theme.css inverts .monaco-editor for the light theme
                    automaticLayout: true,
                    minimap: { enabled: false },
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    fontSize: 13,
                    tabSize: 2,
                    scrollBeyondLastLine: false,
                    fixedOverflowWidgets: true,
                    quickSuggestions: { other: true, comments: false, strings: true },
                    suggestOnTriggerCharacters: true,
                    tabCompletion: 'on',
                    ariaLabel: opts.ariaLabel || ''
                });
            } catch (e) { ed = null; }
            if (ed) {
                var escapeKeyListener = null;
                var escapeAction = null;
                var autoCloseChangeListener = null;
                var autoCloseTimer = null;
                var classCompletionProvider = null;
                var classCompletionItems = null;
                if (opts.onEscape && typeof ed.onKeyDown === 'function') {
                    escapeKeyListener = ed.onKeyDown(function (event) {
                        var browserEvent = event && event.browserEvent;
                        if (!browserEvent || browserEvent.key !== 'Escape') { return; }
                        event.preventDefault();
                        event.stopPropagation();
                        opts.onEscape();
                    });
                }
                if (opts.onEscape && api.KeyCode && typeof ed.addCommand === 'function') {
                    ed.addCommand(api.KeyCode.Escape, opts.onEscape);
                }
                if (opts.onEscape && api.KeyCode && typeof ed.addAction === 'function') {
                    escapeAction = ed.addAction({
                        id: 'dbe-close-editing-dialog',
                        label: dbeT('close', 'Close'),
                        keybindings: [api.KeyCode.Escape],
                        run: opts.onEscape
                    });
                }
                if (typeof ed.onDidChangeModelContent === 'function') {
                    autoCloseChangeListener = ed.onDidChangeModelContent(function (event) {
                        var changes = event && event.changes;
                        if (!changes || changes.length !== 1 || changes[0].text !== '>' || changes[0].rangeLength) { return; }
                        var cursorOffset = changes[0].rangeOffset + 1;
                        dbeClearOwnedTimeout(DBE_EDITING_OWNER, autoCloseTimer);
                        autoCloseTimer = dbeSetOwnedTimeout(DBE_EDITING_OWNER, function () {
                            autoCloseTimer = null;
                            var model = ed.getModel();
                            var selection = ed.getSelection();
                            if (!model || !selection ||
                                (typeof selection.isEmpty === 'function' && !selection.isEmpty())) { return; }
                            var liveCursorOffset = model.getOffsetAt({
                                lineNumber: selection.startLineNumber,
                                column: selection.startColumn
                            });
                            if (liveCursorOffset !== cursorOffset) { return; }
                            var value = model.getValue();
                            var tagStart = cursorOffset - 1;
                            if (value.charAt(tagStart) !== '>') { return; }
                            var withoutTypedBracket = value.slice(0, tagStart) + value.slice(cursorOffset);
                            var tag = dbeHtmlAutoCloseTag(withoutTypedBracket, tagStart, tagStart);
                            if (!tag) { return; }
                            ed.executeEdits('dbe-html-auto-close', [{
                                range: {
                                    startLineNumber: selection.startLineNumber,
                                    startColumn: selection.startColumn,
                                    endLineNumber: selection.endLineNumber,
                                    endColumn: selection.endColumn
                                },
                                text: '</' + tag + '>',
                                forceMoveMarkers: true
                            }]);
                            ed.setPosition(model.getPositionAt(cursorOffset));
                        }, 0);
                    });
                }
                if (api.languages && typeof api.languages.registerCompletionItemProvider === 'function') {
                    classCompletionProvider = api.languages.registerCompletionItemProvider('html', {
                        triggerCharacters: ['<', '"', "'", ' ', '-', '=', '[', '{'],
                        provideCompletionItems: function (model, position) {
                            if (model !== ed.getModel()) { return { suggestions: [] }; }
                            var context = dbeHtmlCompletionContext(model, position);
                            if (!context) { return { suggestions: [] }; }
                            if (context.type === 'class' && !classCompletionItems) {
                                classCompletionItems = dbeHtmlClassItems(model.getValue());
                            }
                            return {
                                suggestions: dbeHtmlCompletionItems(api, model, position, context, classCompletionItems)
                            };
                        }
                    });
                }
                /* Recede the data-dbe-id markers. They must stay on every
                   element for identity, but they are machine ids, not content
                   — dimming them lets the real markup (tags, classes, text)
                   read clearly. Monaco finds the ranges; a debounced
                   re-decorate keeps them dim as the text changes. */
                var markerDecos = [];
                var decoTimer = null;
                function decorateMarkers() {
                    try {
                        var model = ed.getModel();
                        if (!model) { return; }
                        var matches = model.findMatches(' ?data-dbe-id="[^"]*"', false, true, false, null, false);
                        markerDecos = ed.deltaDecorations(markerDecos, matches.map(function (mm) {
                            return { range: mm.range, options: { inlineClassName: 'dbe-html-marker-dim' } };
                        }));
                    } catch (e) {}
                }
                decorateMarkers();
                ed.onDidChangeModelContent(function () {
                    classCompletionItems = null;
                    dbeClearOwnedTimeout(DBE_EDITING_OWNER, decoTimer);
                    decoTimer = dbeSetOwnedTimeout(DBE_EDITING_OWNER, decorateMarkers, 120);
                });
                function selectionOffsets() {
                    var model = ed.getModel();
                    var selection = ed.getSelection();
                    if (!model || !selection) { return { start: 0, end: 0 }; }
                    return {
                        start: model.getOffsetAt({
                            lineNumber: selection.startLineNumber,
                            column: selection.startColumn
                        }),
                        end: model.getOffsetAt({
                            lineNumber: selection.endLineNumber,
                            column: selection.endColumn
                        })
                    };
                }
                function selectOffsets(start, end) {
                    try {
                        var model = ed.getModel();
                        var a = model.getPositionAt(start);
                        var b = model.getPositionAt(end == null ? start : end);
                        ed.setSelection({
                            startLineNumber: a.lineNumber,
                            startColumn: a.column,
                            endLineNumber: b.lineNumber,
                            endColumn: b.column
                        });
                        ed.revealLineInCenter(a.lineNumber);
                        ed.focus();
                    } catch (e) {}
                }
                function replaceOffsets(edits, selectStart, selectEnd) {
                    var model = ed.getModel();
                    if (!model) { return; }
                    ed.executeEdits('dbe-html-authoring', edits.map(function (edit) {
                        var a = model.getPositionAt(edit.start);
                        var b = model.getPositionAt(edit.end);
                        return {
                            range: {
                                startLineNumber: a.lineNumber,
                                startColumn: a.column,
                                endLineNumber: b.lineNumber,
                                endColumn: b.column
                            },
                            text: edit.text,
                            forceMoveMarkers: true
                        };
                    }));
                    if (typeof selectStart === 'number') { selectOffsets(selectStart, selectEnd); }
                }
                function setDiagnostic(issue) {
                    var model = ed.getModel();
                    if (!model || !api.editor || typeof api.editor.setModelMarkers !== 'function') { return; }
                    var markers = [];
                    if (issue) {
                        var start = model.getPositionAt(issue.offset);
                        var end = model.getPositionAt(issue.offset + Math.max(1, issue.length || 1));
                        markers.push({
                            severity: api.MarkerSeverity ? api.MarkerSeverity.Error : 8,
                            message: issue.message,
                            startLineNumber: start.lineNumber,
                            startColumn: start.column,
                            endLineNumber: end.lineNumber,
                            endColumn: end.column
                        });
                    }
                    api.editor.setModelMarkers(model, 'dbe-html', markers);
                }
                return {
                    el: host,
                    isMonaco: true,
                    getValue: function () { return ed.getValue(); },
                    // Guard the write so an unchanged re-set can't move the caret.
                    setValue: function (v) { if (ed.getValue() !== v) { ed.setValue(v); decorateMarkers(); } },
                    focus: function () { try { ed.focus(); } catch (e) {} },
                    cursorStart: function () { try { ed.setPosition({ lineNumber: 1, column: 1 }); } catch (e) {} },
                    getSelection: selectionOffsets,
                    selectedText: function () {
                        var range = selectionOffsets();
                        return ed.getValue().slice(range.start, range.end);
                    },
                    replaceSelection: function (text, selectInserted) {
                        var range = selectionOffsets();
                        replaceOffsets([{ start: range.start, end: range.end, text: text }],
                            selectInserted ? range.start : range.start + text.length,
                            selectInserted ? range.start + text.length : undefined);
                    },
                    replaceRanges: replaceOffsets,
                    selectRange: selectOffsets,
                    setDiagnostic: setDiagnostic,
                    onChange: function (cb) { ed.onDidChangeModelContent(cb); },
                    layout: function () { try { ed.layout(); } catch (e) {} },
                    dispose: function () {
                        dbeClearOwnedTimeout(DBE_EDITING_OWNER, decoTimer);
                        dbeClearOwnedTimeout(DBE_EDITING_OWNER, autoCloseTimer);
                        if (escapeKeyListener) { try { escapeKeyListener.dispose(); } catch (e) {} }
                        if (escapeAction) { try { escapeAction.dispose(); } catch (e) {} }
                        if (autoCloseChangeListener) { try { autoCloseChangeListener.dispose(); } catch (e) {} }
                        if (classCompletionProvider) { try { classCompletionProvider.dispose(); } catch (e) {} }
                        setDiagnostic(null);
                        try { ed.dispose(); } catch (e) {}
                    }
                };
            }
            host.remove();
        }
        // Fallback: the original plain textarea.
        var ta = document.createElement('textarea');
        ta.className = 'dbe-html__editor';
        ta.spellcheck = false;
        if (opts.ariaLabel) { ta.setAttribute('aria-label', opts.ariaLabel); }
        ta.value = opts.value || '';
        function autoCloseTextareaTag(event) {
            if (event.key !== '>' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) { return; }
            var start = ta.selectionStart;
            var end = ta.selectionEnd;
            var tag = dbeHtmlAutoCloseTag(ta.value, start, end);
            if (!tag) { return; }
            event.preventDefault();
            ta.setRangeText('></' + tag + '>', start, end, 'end');
            ta.setSelectionRange(start + 1, start + 1);
            ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
        ta.addEventListener('keydown', autoCloseTextareaTag);
        function textareaSelection() {
            return { start: ta.selectionStart || 0, end: ta.selectionEnd || 0 };
        }
        function textareaSelect(start, end) {
            try {
                ta.setSelectionRange(start, end == null ? start : end);
                ta.focus();
            } catch (e) {}
        }
        function textareaReplaceRanges(edits, selectStart, selectEnd) {
            edits.slice().sort(function (a, b) { return b.start - a.start; }).forEach(function (edit) {
                ta.setRangeText(edit.text, edit.start, edit.end, 'preserve');
            });
            if (typeof selectStart === 'number') { textareaSelect(selectStart, selectEnd); }
            ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return {
            el: ta,
            isMonaco: false,
            getValue: function () { return ta.value; },
            setValue: function (v) { ta.value = v; },
            focus: function () { ta.focus(); },
            cursorStart: function () { try { ta.setSelectionRange(0, 0); } catch (e) {} },
            getSelection: textareaSelection,
            selectedText: function () {
                var range = textareaSelection();
                return ta.value.slice(range.start, range.end);
            },
            replaceSelection: function (text, selectInserted) {
                var range = textareaSelection();
                textareaReplaceRanges([{ start: range.start, end: range.end, text: text }],
                    selectInserted ? range.start : range.start + text.length,
                    selectInserted ? range.start + text.length : undefined);
            },
            replaceRanges: textareaReplaceRanges,
            selectRange: textareaSelect,
            setDiagnostic: function (issue) {
                ta.setAttribute('aria-invalid', issue ? 'true' : 'false');
                ta.title = issue ? issue.message : '';
            },
            onChange: function (cb) { ta.addEventListener('input', cb); },
            layout: function () {},
            dispose: function () { ta.removeEventListener('keydown', autoCloseTextareaTag); }
        };
    }

    function dbeHtmlUndoWarning(id, text) {
        var warning = document.createElement('p');
        warning.id = id;
        warning.className = 'dbe-html__undo-warning';
        warning.textContent = text;
        return warning;
    }

    function dbeParsedNodeHtml(node, depth) {
        var pad = new Array((depth || 0) + 1).join('  ');
        if (node.keep) {
            return pad + '<dbe-keep data-dbe-id="' + dbeHtmlEscapeAttr(node.keep) + '"></dbe-keep>';
        }
        if ((node.module || 'HtmlElement') === 'Component') {
            var component = pad + '<dbe-component name="' + dbeHtmlEscapeAttr(node.componentName) + '"';
            (node.props || []).forEach(function (prop) {
                component += ' ' + prop.name + '="' + dbeHtmlEscapeAttr(prop.value) + '"';
            });
            if (node.label) { component += ' data-dbe-label="' + dbeHtmlEscapeAttr(node.label) + '"'; }
            if (node.existingId) { component += ' data-dbe-id="' + dbeHtmlEscapeAttr(node.existingId) + '"'; }
            return component + '></dbe-component>';
        }
        if (node.svg) { return pad + node.svg; }
        var tag = node.tag || 'div';
        var open = '<' + tag;
        if (node.tagId) { open += ' id="' + dbeHtmlEscapeAttr(node.tagId) + '"'; }
        if (node.classes && node.classes.length) {
            open += ' class="' + dbeHtmlEscapeAttr(node.classes.join(' ')) + '"';
        }
        (node.attrs || []).forEach(function (attr) {
            open += ' ' + attr.name + (attr.value == null || attr.value === ''
                ? ''
                : '="' + dbeHtmlEscapeAttr(attr.value) + '"');
        });
        if ((node.module || 'HtmlElement') !== 'HtmlElement' &&
            !(node.attrs || []).some(function (attr) { return attr.name === 'data-dbe-module'; })) {
            open += ' data-dbe-module="' + String(node.module).toLowerCase() + '"';
        }
        if (node.label) { open += ' data-dbe-label="' + dbeHtmlEscapeAttr(node.label) + '"'; }
        if (node.existingId) { open += ' data-dbe-id="' + dbeHtmlEscapeAttr(node.existingId) + '"'; }
        open += '>';
        if (DBE_HTML_VOID[tag]) { return pad + open; }
        if (!(node.children || []).length) { return pad + open + (node.content || '') + '</' + tag + '>'; }
        var lines = [pad + open];
        if (node.content) { lines.push(pad + '  ' + node.content); }
        (node.children || []).forEach(function (child) { lines.push(dbeParsedNodeHtml(child, (depth || 0) + 1)); });
        lines.push(pad + '</' + tag + '>');
        return lines.join('\n');
    }

    function dbeHtmlAuthoringToolbar(editor, opts) {
        opts = opts || {};
        var bar = document.createElement('div');
        bar.className = 'dbe-html__tools';
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', dbeT('htmlTools', 'HTML authoring tools'));
        var issue = null;
        var componentTarget = null;
        function announce(message, warn) {
            if (opts.announce) { opts.announce(message, warn); }
        }
        function tool(label, handler) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'dbe-html__tool';
            button.textContent = label;
            button.addEventListener('click', handler);
            bar.appendChild(button);
            return button;
        }
        tool(dbeT('htmlFormat', 'Format'), function () {
            var range = editor.getSelection();
            var selected = range.end > range.start;
            var source = selected ? editor.selectedText() : editor.getValue();
            var analysis = dbeHtmlAnalyse(source);
            if (analysis.error) { announce(analysis.error.message, true); return; }
            var formatted;
            try {
                formatted = dbeFormatHtml(source);
            } catch (error) {
                announce(dbeT('htmlErrParse', 'Could not parse the HTML'), true);
                return;
            }
            if (selected) { editor.replaceSelection(formatted, true); }
            else { editor.setValue(formatted); editor.cursorStart(); }
            announce(dbeT('htmlFormatted', 'HTML formatted'));
        });
        tool(dbeT('htmlRenameTag', 'Rename tag…'), function () {
            var value = editor.getValue();
            var analysis = dbeHtmlAnalyse(value);
            if (analysis.error) { announce(analysis.error.message, true); return; }
            var caret = editor.getSelection().start;
            var tokenIndex = -1;
            analysis.tokens.forEach(function (token, index) {
                if (caret >= token.start && caret <= token.end) { tokenIndex = index; }
            });
            var pairIndex = tokenIndex === -1 ? null : analysis.pairs[tokenIndex];
            if (pairIndex == null) {
                announce(dbeT('htmlRenameNeedsPair', 'Place the caret in a paired opening or closing tag'), true);
                return;
            }
            var token = analysis.tokens[tokenIndex];
            if (token.name === 'dbe-component' || token.name === 'dbe-keep') {
                announce(dbeT('htmlRenameReserved', 'Builderius component and keep tags cannot be renamed'), true);
                return;
            }
            var entered = window.prompt(dbeT('htmlRenamePrompt', 'Rename the matching tags to:'), token.rawName);
            if (entered == null) { return; }
            var name = dbeCleanTagInput(entered);
            if (!name || DBE_HTML_VOID[name]) {
                announce(dbeT('htmlRenameInvalid', 'Enter a non-void HTML tag name'), true);
                return;
            }
            var pair = analysis.tokens[pairIndex];
            editor.replaceRanges([
                { start: token.nameStart, end: token.nameEnd, text: name },
                { start: pair.nameStart, end: pair.nameEnd, text: name }
            ], token.nameStart, token.nameStart + name.length);
            announce(dbeFmt(dbeT('htmlRenamedTag', 'Renamed both tags to <%s>'), name));
        });
        if (opts.collection !== false) {
            tool(dbeT('htmlCollectionJson', 'Collection + JSON'), function () {
                var selected = editor.selectedText();
                if (!selected.trim()) {
                    announce(dbeT('htmlCollectionSelect', 'Select one container with repeated items first'), true);
                    return;
                }
                var parsed;
                try {
                    parsed = dbeParseHtmlFragment(selected, opts.origIds || {});
                } catch (error) {
                    announce(typeof error === 'string' ? error : dbeT('htmlErrParse', 'Could not parse the HTML'), true);
                    return;
                }
                if (parsed.roots.length !== 1 || !dbeFindRepeats(parsed.roots).length) {
                    announce(dbeT('htmlCollectionNoRepeat', 'The selection does not contain a structurally repeated group'), true);
                    return;
                }
                var collapsed = dbeCollapseRepeats(parsed.roots, true);
                var collapsedRoot = collapsed.roots[0];
                if (collapsedRoot.existingId === opts.rootId &&
                    (opts.origIds || {})[collapsedRoot.existingId] !== collapsedRoot.module) {
                    announce(dbeT('htmlCollectionNeedsParent',
                        'Open Edit as HTML on the parent, then select this repeated container so it can be replaced by a Collection'), true);
                    return;
                }
                (function releaseChangedMarkers(node) {
                    if (node.existingId && (opts.origIds || {})[node.existingId] !== (node.module || 'HtmlElement')) {
                        node.existingId = null;
                    }
                    (node.children || []).forEach(releaseChangedMarkers);
                })(collapsedRoot);
                editor.replaceSelection(collapsed.roots.map(function (root) {
                    return dbeParsedNodeHtml(root, 0);
                }).join('\n'), true);
                announce(dbeT('htmlCollectionDone', 'Converted the repeated markup to a Collection with static JSON'));
            });
        }
        var componentButton = null;
        if (opts.component) {
            componentButton = tool(dbeT('htmlCreateComponent', 'Create component after Apply'), function () {
                if (componentTarget) {
                    componentTarget = null;
                    componentButton.setAttribute('aria-pressed', 'false');
                    announce(dbeT('htmlComponentCancelled', 'Component extraction cancelled'));
                    if (opts.setComponentTarget) { opts.setComponentTarget(null); }
                    return;
                }
                var selected = editor.selectedText();
                if (!selected.trim()) {
                    announce(dbeT('htmlComponentSelect', 'Select one existing element subtree first'), true);
                    return;
                }
                var parsed;
                try {
                    parsed = dbeParseHtmlFragment(selected, opts.origIds || {});
                } catch (error) {
                    announce(typeof error === 'string' ? error : dbeT('htmlErrParse', 'Could not parse the HTML'), true);
                    return;
                }
                var root = parsed.roots.length === 1 ? parsed.roots[0] : null;
                if (!root || !root.existingId || !(opts.origIds || {})[root.existingId]) {
                    announce(dbeT('htmlComponentNeedsMarker', 'The selection must be one existing element carrying its data-dbe-id'), true);
                    return;
                }
                componentTarget = root.existingId;
                componentButton.setAttribute('aria-pressed', 'true');
                if (opts.setComponentTarget) { opts.setComponentTarget(componentTarget); }
                announce(dbeT('htmlComponentQueued', 'After Apply, Builderius will open its Create Component dialog for this element'));
            });
            componentButton.setAttribute('aria-pressed', 'false');
        }
        var jump = tool(dbeT('htmlJumpIssue', 'Go to issue'), function () {
            if (issue) { editor.selectRange(issue.offset, issue.offset + Math.max(1, issue.length || 1)); }
        });
        jump.hidden = true;
        return {
            el: bar,
            setIssue: function (nextIssue) {
                issue = nextIssue || null;
                jump.hidden = !issue;
                editor.setDiagnostic(issue);
            }
        };
    }

    function dbeEditingDialogFocusReturn(preferred) {
        var target = preferred && preferred.isConnected ? preferred : null;
        if (!target) {
            target = document.querySelector('.uniRightPanel .uniModTree__item[tabindex="0"]')
                || document.querySelector('.dbe-palette-btn');
        }
        if (target) { try { target.focus(); } catch (e) {} }
    }

    function dbeBindEditingDialogEscape(dlg, surface) {
        // Monaco consumes Escape at its editor surface, before the browser can
        // perform native <dialog> cancellation. Capture only Escape here; all
        // other keys must still reach the editor and form controls normally.
        (surface || dlg).addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') { return; }
            e.preventDefault();
            e.stopPropagation();
            dlg.close();
        }, true);
    }

    function dbeRemovePriorHtmlDialog() {
        var old = document.querySelector('dialog.dbe-html');
        if (!old) { return; }
        if (old.open) { try { old.close(); } catch (e) {} }
        if (old.isConnected) { old.remove(); }
    }

    function openEditHtmlDialog(rootId) {
        if (dbeHtmlBusy) { return; }
        var mods = modules() || {};
        if (!mods[rootId]) { return; }

        // The original subtree's ids — fixed while the dialog is open. A marker
        // matching one of these keeps that module; anything else is new.
        var origIds = {};
        (function collect(id) {
            origIds[id] = mods[id] ? mods[id].name : '';
            ((store().storeGet('indexes') || {})[id] || []).forEach(collect);
        })(rootId);

        dbeRemovePriorHtmlDialog();
        var focusReturn = document.activeElement;
        var restoreFocusOnClose = true;
        var dlg = document.createElement('dialog');
        dlg.className = 'dbe-html';
        dlg.setAttribute('aria-label', dbeT('editAsHtml', 'Edit as HTML'));

        var head = document.createElement('div');
        head.className = 'dbe-html__head';
        var title = document.createElement('h2');
        title.className = 'dbe-html__title';
        title.textContent = dbeFmt(dbeT('editAsHtmlTitle', 'Edit as HTML — %s'), mods[rootId].label || mods[rootId].name);
        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'dbe-html__close';
        close.setAttribute('aria-label', dbeT('close', 'Close'));
        close.textContent = '✕';
        close.addEventListener('click', function () { dlg.close(); });
        head.appendChild(title);
        head.appendChild(close);
        dlg.appendChild(head);

        var hint = document.createElement('p');
        hint.className = 'dbe-html__hint';
        var hintText = document.createElement('span');
        hintText.textContent = dbeT('editAsHtmlHint',
            'Keep an element’s data-dbe-id to preserve its settings. Components use <dbe-component>; unsupported modules use <dbe-keep>. Review what will be updated, added, removed or sanitised before applying.');
        hint.appendChild(hintText);
        dlg.appendChild(hint);

        var editor = dbeMakeCodeEditor({
            value: dbeSerializeSubtree(rootId),
            ariaLabel: dbeT('editAsHtmlEditor', 'HTML markup'),
            onEscape: function () { dlg.close(); }
        });
        var status = document.createElement('p');
        status.className = 'dbe-html__status';
        status.setAttribute('role', 'status');
        var componentTargetId = null;
        var authoring = dbeHtmlAuthoringToolbar(editor, {
            origIds: origIds,
            rootId: rootId,
            component: true,
            setComponentTarget: function (id) { componentTargetId = id; },
            announce: function (message, warn) {
                status.textContent = message;
                status.classList.toggle('dbe-html__status--warn', !!warn);
            }
        });
        dlg.appendChild(authoring.el);
        dlg.appendChild(editor.el);
        dlg.appendChild(status);

        var undoWarning = dbeHtmlUndoWarning('dbe-edit-html-undo-warning',
            dbeT('editHtmlUndoWarning', 'Applying these changes can’t be undone. Cancel keeps the current element unchanged.'));
        dlg.setAttribute('aria-describedby', undoWarning.id);
        dlg.appendChild(undoWarning);

        var foot = document.createElement('div');
        foot.className = 'dbe-html__foot';
        var cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'dbe-html__cancel';
        cancel.textContent = dbeT('cancel', 'Cancel');
        cancel.addEventListener('click', function () { dlg.close(); });
        var apply = document.createElement('button');
        apply.type = 'button';
        apply.className = 'dbe-html__apply';
        apply.textContent = dbeT('reviewChanges', 'Review changes');
        var reviewedHtml = null;
        apply.addEventListener('click', function () {
            var parsed;
            var currentHtml = editor.getValue();
            var analysis = dbeHtmlAnalyse(currentHtml);
            authoring.setIssue(analysis.error);
            if (analysis.error) {
                status.textContent = analysis.error.message;
                status.classList.add('dbe-html__status--warn');
                return;
            }
            try {
                parsed = dbeParseHtmlTree(currentHtml, origIds, rootId);
            } catch (msg) {
                status.textContent = typeof msg === 'string' ? msg : dbeT('htmlErrParse', 'Could not parse the HTML');
                return;
            }
            if (reviewedHtml !== currentHtml) {
                reviewedHtml = currentHtml;
                apply.textContent = dbeT('applyChanges', 'Apply changes');
                updatePreview();
                status.textContent = dbeT('editHtmlReviewReady', 'Review complete.') + ' ' + status.textContent;
                apply.focus();
                return;
            }
            // The dialog is showModal(): it must close before the apply queue
            // can drive tree rows and the native Remove menu.
            restoreFocusOnClose = false;
            dlg.close();
            dbeHtmlBusy = true;
            expandSubtree(rootId); // removal drives need reachable rows
            setTimeout(function () {
                dbeApplyHtmlTree(rootId, parsed.tree, function (counts) {
                    dbeHtmlBusy = false;
                    // Seal step-undo behind a barrier: the reconcile is one
                    // compound op, so a Cmd+Z now must not revert an earlier action.
                    dbeHistoryBarrier(dbeT('editHtmlNotUndoable', 'Edit as HTML can’t be undone. Edit the element again to correct it.'));
                    var msg = dbeFmt(dbeT('htmlApplied', 'HTML applied: %1$s updated, %2$s added, %3$s removed'),
                        counts.kept, counts.added, counts.removed);
                    if (parsed.stripped.length) {
                        var uniq = parsed.stripped.filter(function (v, i, a) { return a.indexOf(v) === i; });
                        msg += ' ' + dbeFmt(dbeT('htmlStripped', '(stripped: %s)'), uniq.join(', '));
                    }
                    if (parsed.unknownMarkers && parsed.unknownMarkers.length) {
                        msg += ' ' + dbeFmt(dbeT('editHtmlUnknownMarker',
                            'Unrecognised marker(s): %s. A new element will be created and the original removed.'),
                            parsed.unknownMarkers.join(', '));
                    }
                    undoToast(msg);
                    if (componentTargetId) {
                        dbeSetOwnedTimeout(DBE_EDITING_OWNER, function () {
                            if (!(modules() || {})[componentTargetId]) {
                                undoToast(dbeT('htmlComponentTargetGone', 'The selected element no longer exists, so component creation was not opened.'));
                                return;
                            }
                            driveContextMenuItem(componentTargetId, 'Create Component', function (ok) {
                                if (!ok) {
                                    undoToast(dbeT('htmlComponentOpenFailed', 'Builderius could not open Create Component for the selected element.'));
                                }
                            });
                        }, 250);
                    }
                });
            }, 120);
        });
        foot.appendChild(cancel);
        foot.appendChild(apply);
        dlg.appendChild(foot);

        /* Live outcome preview: on every edit, parse the markup against the
           original ids and report what Apply would do — the client twin of the
           ability's dry run. Invalid markup (unparseable, or not exactly one
           root) disables Apply with the reason, so the edit is never applied
           blind. Debounced so a Monaco/textarea keystroke storm stays cheap. */
        function updatePreview() {
            var parsed;
            var analysis = dbeHtmlAnalyse(editor.getValue());
            authoring.setIssue(analysis.error);
            if (analysis.error) {
                status.textContent = analysis.error.message;
                status.classList.add('dbe-html__status--warn');
                apply.disabled = true;
                return;
            }
            try {
                parsed = dbeParseHtmlTree(editor.getValue(), origIds, rootId);
            } catch (e) {
                status.textContent = typeof e === 'string' ? e : dbeT('htmlErrParse', 'Could not parse the HTML');
                status.classList.add('dbe-html__status--warn');
                apply.disabled = true;
                return;
            }
            apply.disabled = false;
            var c = dbePreviewCounts(parsed.tree, origIds, rootId);
            var msg = dbeFmt(dbeT('editHtmlWillApply', 'Will apply: %1$s updated, %2$s added, %3$s removed'),
                c.updated, c.added, c.removed);
            if (parsed.stripped.length) {
                var uniq = parsed.stripped.filter(function (v, i, a) { return a.indexOf(v) === i; });
                msg += ' ' + dbeFmt(dbeT('htmlStripped', '(stripped: %s)'), uniq.join(', '));
            }
            // A marker that matches nothing here is almost always a typo: the
            // element it meant to keep will instead be removed and recreated.
            // Flag it (warn colour) but leave Apply enabled — a genuinely new
            // element carrying a stray marker is still a valid, if unusual, edit.
            if (parsed.unknownMarkers.length) {
                msg += ' ' + dbeFmt(dbeT('editHtmlUnknownMarker',
                    'Unrecognised marker(s): %s. A new element will be created and the original removed.'),
                    parsed.unknownMarkers.join(', '));
                status.classList.add('dbe-html__status--warn');
            } else {
                status.classList.remove('dbe-html__status--warn');
            }
            status.textContent = msg;
        }
        var previewTimer = null;
        editor.onChange(function () {
            dbeClearOwnedTimeout(DBE_EDITING_OWNER, previewTimer);
            reviewedHtml = null;
            apply.textContent = dbeT('reviewChanges', 'Review changes');
            previewTimer = dbeSetOwnedTimeout(DBE_EDITING_OWNER, updatePreview, 150);
        });

        // Same isolation as the Auto-BEM dialog: keys and pointer events must
        // not reach the builder's global handlers (Delete removes the selected
        // element; an outside click handler reverts native control toggles).
        dbeBindEditingDialogEscape(dlg, editor.el);
        dlg.addEventListener('keydown', function (e) { e.stopPropagation(); });
        ['pointerdown', 'mousedown', 'click'].forEach(function (t) {
            dlg.addEventListener(t, function (e) { e.stopPropagation(); });
        });
        dlg.addEventListener('close', function () {
            dbeClearOwnedTimeout(DBE_EDITING_OWNER, previewTimer);
            editor.dispose();
            dlg.remove();
            if (restoreFocusOnClose) { dbeEditingDialogFocusReturn(focusReturn); }
        });
        document.body.appendChild(dlg);
        dlg.showModal();
        editor.layout(); // Monaco was created in the pre-show (0-size) dialog
        editor.focus();
        editor.cursorStart();
        updatePreview(); // seed the status line before the first edit
    }

    /* ============================ Import HTML ============================
       (import_html, Pro). "Import HTML…" on an element's right-click menu:
       paste markup into a dialog, watch a live preview of the elements it
       will create, then insert them — into the target as its last children,
       or, when the target is a void element (img, hr…), after it as
       siblings (the same slot rule as the Emmet palette). Parsing and
       sanitisation are Edit-as-HTML's (dbeParseHtmlFragment with an empty
       marker set, so every pasted element becomes a NEW module — stray
       data-dbe-id markers in pasted markup are ignored). Multiple sibling
       roots are fine here. The insert runs under dbeUndoBusy: one import is
       one action, and per-module undo records would only let Cmd+Z pick it
       apart node by node from the wrong end. */

    function dbeInsertParsedNode(sf, node, parentId, index) {
        var moduleName = node.module || 'HtmlElement';
        var label = node.label;
        if (!label) {
            if (moduleName === 'HtmlElement') {
                label = node.tag.charAt(0).toUpperCase() + node.tag.slice(1);
            } else if (moduleName === 'Component') {
                var registry = dbeComponentRegistry();
                label = (registry[node.componentName] && registry[node.componentName].label) || moduleName;
            } else {
                label = moduleName;
            }
        }
        var mod = {
            id: dbeMakeId(), name: moduleName,
            label: label,
            settings: dbeNodeSettings(node)
        };
        storeAddModule(sf, mod, parentId, index);
        var count = 1;
        node.children.forEach(function (c, i) { count += dbeInsertParsedNode(sf, c, mod.id, i).count; });
        return { id: mod.id, count: count };
    }

    /* Where pasted roots land relative to targetId: inside (last children)
       for a normal element, after it (siblings) for a void one. */
    function dbeImportSlot(targetId) {
        var sf = store();
        var mods = sf.storeGet('modules') || {};
        if (!mods[targetId]) { return null; }
        var tag = String(dbeSettingVal(mods[targetId], 'tag') || '').toLowerCase();
        var indexes = sf.storeGet('indexes') || {};
        if (!DBE_HTML_VOID[tag]) {
            return { parentId: targetId, index: (indexes[targetId] || []).length, into: true };
        }
        var parentId = mods[targetId].parent || '';
        var sibs = [].concat(indexes[parentId || 'root'] || []);
        return { parentId: parentId, index: sibs.indexOf(targetId) + 1, into: false };
    }

    /* ---- Repetition detection (import_html) ----
       Real-world pasted markup usually carries N rendered copies of what
       should be ONE template: a ul of lookalike lis, a grid of identical
       cards, a tbody of matching rows. Spot those and offer to collapse
       each group into a Collection whose Template holds the first copy.

       Similarity = a recursive structural signature (tag + sorted classes +
       the children's signatures); text and attribute VALUES are ignored, so
       "the same card with different words" matches. Guards against false
       positives: a plain container needs at least TWO matching items, and
       unless it is a ul/ol the item itself must have structure (classes or
       children) — three bare <p>s are prose, not a list. A container
       already marked as a Collection (data-b-context / data-dbe-module)
       qualifies from ONE plain item: the binding already declares the
       intent, and wrapping the static children in a <template> is exactly
       what makes that markup valid. */
    function dbeNodeSignature(n) {
        return n.tag + '[' + n.classes.slice().sort().join('.') + '](' +
            n.children.map(dbeNodeSignature).join(',') + ')';
    }
    function dbeRepeatCandidate(n) {
        var moduleName = n.module || 'HtmlElement';
        var declared = moduleName === 'Collection' || moduleName === 'SubCollection';
        if (!declared && moduleName !== 'HtmlElement') { return false; }
        var kids = n.children;
        if (kids.length < (declared ? 1 : 2)) { return false; }
        if (!kids.every(function (c) { return (c.module || 'HtmlElement') === 'HtmlElement'; })) { return false; }
        var sig = dbeNodeSignature(kids[0]);
        if (!kids.every(function (c) { return dbeNodeSignature(c) === sig; })) { return false; }
        if (!declared && n.tag !== 'ul' && n.tag !== 'ol'
            && !kids[0].classes.length && !kids[0].children.length) { return false; }
        return true;
    }
    function dbeFindRepeats(roots) {
        var found = [];
        function walk(n) {
            if (dbeRepeatCandidate(n)) { found.push(n); }
            n.children.forEach(walk);
        }
        roots.forEach(walk);
        return found;
    }
    /* ---- Repeat wiring (import_html) ----
       A field name for a lifted value, derived from what a human called the
       thing: the BEM leaf of the node's first class (hiw__step-title →
       title), else the tag, plus the attribute name for attribute fields.
       Uniqued with a numeric suffix — mustache keys must not collide. */
    function dbeFieldSlug(node, attrName, used) {
        var base = '';
        if (node.classes && node.classes.length) {
            base = node.classes[0];
            var bem = base.lastIndexOf('__');
            if (bem !== -1) { base = base.slice(bem + 2); }
            base = base.split('--')[0];
        }
        if (!base) { base = node.tag || 'field'; }
        if (attrName) { base += '_' + attrName; }
        base = base.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
        var name = base;
        var n = 2;
        while (used[name]) { name = base + '_' + n; n += 1; }
        used[name] = true;
        return name;
    }
    /* Lift the values that VARY between the N copies of a repeat group into
       an array of items — one object per copy, in document order — and
       replace them in the first copy (the one the Template keeps) with
       {{field}} placeholders. Values identical in every copy stay static in
       the markup; they are presentation, not data. Positional twin-walks are
       safe because dbeFindRepeats only groups copies with identical
       structural signatures. Attributes match by NAME (the signature ignores
       them, so order and presence can differ; an attribute missing from a
       copy lifts as ''). SVG markup and component instances are opaque — a
       copy-to-copy difference there cannot become a mustache field, so the
       first copy's version stands and `stats.opaque` counts it for the
       dialog's honesty note. */
    function dbeExtractRepeatData(copies, stats) {
        var used = {};
        var items = copies.map(function () { return {}; });
        function differs(vals) {
            for (var i = 1; i < vals.length; i += 1) {
                if (vals[i] !== vals[0]) { return true; }
            }
            return false;
        }
        function attrVal(n, name) {
            var attrs = n.attrs || [];
            for (var i = 0; i < attrs.length; i += 1) {
                if (attrs[i].name === name) { return attrs[i].value == null ? '' : attrs[i].value; }
            }
            return '';
        }
        function walk(nodes) {
            var first = nodes[0];
            if ((first.module || 'HtmlElement') === 'Component') {
                if (differs(nodes.map(function (n) { return JSON.stringify(n.props || []); }))) { stats.opaque += 1; }
                return;
            }
            if (first.svg != null && first.svg !== '') {
                if (differs(nodes.map(function (n) { return n.svg || ''; }))) { stats.opaque += 1; }
                return;
            }
            var contents = nodes.map(function (n) { return n.content || ''; });
            if (differs(contents)) {
                var f = dbeFieldSlug(first, '', used);
                items.forEach(function (it, i) { it[f] = contents[i]; });
                first.content = '{{' + f + '}}';
            }
            (first.attrs || []).forEach(function (a) {
                var vals = nodes.map(function (n) { return attrVal(n, a.name); });
                if (differs(vals)) {
                    var fa = dbeFieldSlug(first, a.name, used);
                    items.forEach(function (it, i) { it[fa] = vals[i]; });
                    a.value = '{{' + fa + '}}';
                }
            });
            first.children.forEach(function (c, ci) {
                walk(nodes.map(function (n) { return n.children[ci]; }));
            });
        }
        walk(copies);
        return items;
    }
    /* A collapsed COPY of the parsed roots: each candidate container becomes
       a Collection holding one Template that wraps its first item. Without
       wiring the other copies drop and nested candidates inside the kept
       item still collapse. With `wire` on, the copies' varying content is
       lifted first (dbeExtractRepeatData) and stored as literal JSON in the
       collection's data-b-context — the attribute a Builderius Collection
       loops its <template> over — so nothing is lost and the section renders
       all N items from data. A wired group's subtree is left alone after the
       lift: inner repeats are already captured positionally as fields, and
       collapsing them again would re-drop content the items now carry. A
       container that already declares a data-b-context keeps it — the
       binding is the author's. */
    function dbeCollapseRepeats(roots, wire) {
        var clone = JSON.parse(JSON.stringify(roots));
        var stats = { opaque: 0 };
        function collapse(n) {
            if ((n.module || 'HtmlElement') === 'HtmlElement') { n.module = 'Collection'; }
            n.content = '';
            n.children = [{
                existingId: null, module: 'Template', tag: 'template',
                tagId: '', classes: [], attrs: [], content: '',
                children: [n.children[0]]
            }];
        }
        function walk(n) {
            if (n.keep || !n.children) { return; }
            if (dbeRepeatCandidate(n)) {
                var hasCtx = (n.attrs || []).some(function (a) { return a.name === 'data-b-context'; });
                if (wire && !hasCtx && n.children.length > 1) {
                    n.attrs.push({
                        name: 'data-b-context',
                        value: JSON.stringify(dbeExtractRepeatData(n.children, stats))
                    });
                    collapse(n);
                    return;
                }
                collapse(n);
            }
            n.children.forEach(walk);
        }
        clone.forEach(walk);
        return { roots: clone, opaque: stats.opaque };
    }

    function dbePreviewLines(roots) {
        var lines = [];
        function walk(n, d) {
            var pad = new Array(d + 1).join('  ');
            // A component leaf reads by its slug and any prop overrides, not a tag.
            if ((n.module || 'HtmlElement') === 'Component') {
                var cl = pad + '<' + n.componentName + '> [Component]';
                if (n.label) { cl += ' » ' + n.label; }
                (n.props || []).forEach(function (p) { cl += ' ' + p.name + '="' + p.value + '"'; });
                lines.push(cl);
                return;
            }
            var line = pad + '<' + n.tag + '>';
            if ((n.module || 'HtmlElement') !== 'HtmlElement') { line += ' [' + n.module + ']'; }
            if (n.label) { line += ' » ' + n.label; }
            if (n.classes.length) { line += ' .' + n.classes.join(' .'); }
            // A wired collection reads by its item count, not the JSON blob.
            var ctx = (n.attrs || []).filter(function (a) { return a.name === 'data-b-context'; })[0];
            if (ctx) {
                var count = 0;
                try {
                    var arr = JSON.parse(ctx.value);
                    count = Array.isArray(arr) ? arr.length : 0;
                } catch (e) { /* hand-written binding — no count to show */ }
                if (count) {
                    line += ' ' + dbeFmt(dbeTn(count,
                        'previewItemsOne', '(%s item)',
                        'previewItemsMany', '(%s items)'), count);
                }
            }
            if (n.content) {
                var t = n.content.length > 34 ? n.content.slice(0, 34) + '…' : n.content;
                line += ' “' + t + '”';
            }
            lines.push(line);
            n.children.forEach(function (c) { walk(c, d + 1); });
        }
        roots.forEach(function (r) { walk(r, 0); });
        return lines;
    }

    /* What an Edit-as-HTML apply WOULD do to the subtree rooted at rootId,
       computed from the parsed tree without touching the store — the client
       twin of the ability's dry run. A node keeping a marker from the original
       subtree is an update; one without is an addition; an original id absent
       from the markup is a removal. The root's identity is forced to rootId,
       exactly as dbeApplyHtmlTree does. */
    function dbePreviewCounts(root, origIds, rootId) {
        var idx = store().storeGet('indexes') || {};
        if (root && !root.keep) { root.existingId = rootId; }
        // Two tallies: `updated` matches what the apply reports (one per
        // kept element or keep placeholder, NOT per preserved descendant),
        // while `preserved` records every id staying — keep descendants
        // included — so the removed count doesn't over-count them.
        var preserved = {};
        var updated = 0;
        var added = 0;
        (function walk(n) {
            if (!n) { return; }
            if (n.keep) {
                (function keepAll(id) { preserved[id] = true; (idx[id] || []).forEach(keepAll); })(n.keep);
                updated += 1;
                return;
            }
            if (n.existingId && origIds[n.existingId]) { preserved[n.existingId] = true; updated += 1; }
            else { added += 1; }
            (n.children || []).forEach(walk);
        })(root);
        var removed = 0;
        Object.keys(origIds).forEach(function (id) { if (!preserved[id]) { removed += 1; } });
        return { updated: updated, added: added, removed: removed };
    }

    function openImportHtmlDialog(targetId) {
        if (dbeHtmlBusy) { return; }
        var mods = modules() || {};
        if (!mods[targetId]) { return; }

        dbeRemovePriorHtmlDialog();
        var focusReturn = document.activeElement;
        var restoreFocusOnClose = true;
        var dlg = document.createElement('dialog');
        dlg.className = 'dbe-html dbe-html--import';
        dlg.setAttribute('aria-label', dbeT('importHtml', 'Import HTML'));

        var head = document.createElement('div');
        head.className = 'dbe-html__head';
        var title = document.createElement('h2');
        title.className = 'dbe-html__title';
        var slot = dbeImportSlot(targetId);
        title.textContent = dbeFmt(
            slot && slot.into
                ? dbeT('importHtmlTitleInto', 'Import HTML into %s')
                : dbeT('importHtmlTitleAfter', 'Import HTML after %s'),
            mods[targetId].label || mods[targetId].name);
        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'dbe-html__close';
        close.setAttribute('aria-label', dbeT('close', 'Close'));
        close.textContent = '✕';
        close.addEventListener('click', function () { dlg.close(); });
        head.appendChild(title);
        head.appendChild(close);
        dlg.appendChild(head);

        var hint = document.createElement('p');
        hint.className = 'dbe-html__hint';
        hint.textContent = dbeT('importHtmlHint',
            'Paste HTML below; the preview shows the elements it will create. Scripts, event handlers and unknown tags are stripped, and several top-level elements are fine. Add data-dbe-label="…" to any element to name it in the Navigator, or insert a component with <dbe-component name="slug">.');
        dlg.appendChild(hint);

        var editor = dbeMakeCodeEditor({
            ariaLabel: dbeT('importHtmlEditor', 'HTML to import'),
            onEscape: function () { dlg.close(); }
        });
        var status = document.createElement('p');
        status.className = 'dbe-html__status';
        status.setAttribute('role', 'status');
        var authoring = dbeHtmlAuthoringToolbar(editor, {
            collection: false,
            component: false,
            announce: function (message, warn) {
                status.textContent = message;
                status.classList.toggle('dbe-html__status--warn', !!warn);
            }
        });
        dlg.appendChild(authoring.el);
        dlg.appendChild(editor.el);

        // Repetition offer — shown only when the parsed markup contains
        // groups of structurally identical siblings (see dbeFindRepeats).
        var optionRow = document.createElement('label');
        optionRow.className = 'dbe-html__option';
        optionRow.style.display = 'none';
        var collapseCheck = document.createElement('input');
        collapseCheck.type = 'checkbox';
        var optionText = document.createElement('span');
        optionRow.appendChild(collapseCheck);
        optionRow.appendChild(optionText);
        dlg.appendChild(optionRow);

        // Sub-offer of the collapse: lift the copies' varying content into
        // each collection's data-b-context as literal JSON, instead of
        // dropping copies 2..N. Only meaningful once collapse is on.
        var wireRow = document.createElement('label');
        wireRow.className = 'dbe-html__option dbe-html__option--sub';
        wireRow.style.display = 'none';
        var wireCheck = document.createElement('input');
        wireCheck.type = 'checkbox';
        var wireText = document.createElement('span');
        wireText.textContent = dbeT('importWireData',
            'Extract the repeated content into each collection’s data source (JSON)');
        wireRow.appendChild(wireCheck);
        wireRow.appendChild(wireText);
        dlg.appendChild(wireRow);

        var previewLabel = document.createElement('p');
        previewLabel.className = 'dbe-html__preview-label';
        previewLabel.textContent = dbeT('importHtmlPreview', 'Preview');
        dlg.appendChild(previewLabel);
        var preview = document.createElement('pre');
        preview.className = 'dbe-html__preview';
        preview.setAttribute('aria-label', dbeT('importHtmlPreview', 'Preview'));
        dlg.appendChild(preview);

        dlg.appendChild(status);

        var undoWarning = dbeHtmlUndoWarning('dbe-import-html-undo-warning',
            dbeT('importHtmlUndoWarning', 'This import can’t be undone as one action. Delete the new elements to remove them.'));
        dlg.setAttribute('aria-describedby', undoWarning.id);
        dlg.appendChild(undoWarning);

        var foot = document.createElement('div');
        foot.className = 'dbe-html__foot';
        var cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'dbe-html__cancel';
        cancel.textContent = dbeT('cancel', 'Cancel');
        cancel.addEventListener('click', function () { dlg.close(); });
        var insert = document.createElement('button');
        insert.type = 'button';
        insert.className = 'dbe-html__apply';
        insert.textContent = dbeT('insertHtml', 'Insert');
        insert.disabled = true;
        foot.appendChild(cancel);
        foot.appendChild(insert);
        dlg.appendChild(foot);

        var parsed = null;
        var previewTimer = null;
        function refreshPreview() {
            var html = editor.getValue();
            parsed = null;
            insert.disabled = true;
            status.textContent = '';
            if (!html.trim()) {
                authoring.setIssue(null);
                preview.textContent = dbeT('importHtmlEmpty', 'Nothing to preview yet.');
                return;
            }
            var analysis = dbeHtmlAnalyse(html);
            authoring.setIssue(analysis.error);
            if (analysis.error) {
                preview.textContent = '';
                optionRow.style.display = 'none';
                wireRow.style.display = 'none';
                status.textContent = analysis.error.message;
                status.classList.add('dbe-html__status--warn');
                return;
            }
            var p;
            try {
                p = dbeParseHtmlFragment(html, {});
            } catch (error) {
                preview.textContent = '';
                optionRow.style.display = 'none';
                wireRow.style.display = 'none';
                status.textContent = typeof error === 'string' ? error : dbeT('htmlErrParse', 'Could not parse the HTML');
                status.classList.add('dbe-html__status--warn');
                return;
            }
            if (!p.roots.length) {
                preview.textContent = '';
                optionRow.style.display = 'none';
                status.textContent = dbeT('htmlErrNoElements', 'No usable elements found in that HTML');
                return;
            }
            var repeats = dbeFindRepeats(p.roots).length;
            optionRow.style.display = repeats ? '' : 'none';
            if (repeats) {
                optionText.textContent = dbeFmt(dbeTn(repeats,
                    'importCollapseOne', 'Collapse %s repeated group into a collection',
                    'importCollapseMany', 'Collapse %s repeated groups into collections'), repeats);
            }
            var collapsing = !!(repeats && collapseCheck.checked);
            wireRow.style.display = collapsing ? '' : 'none';
            var collapsed = collapsing ? dbeCollapseRepeats(p.roots, wireCheck.checked) : null;
            var roots = collapsing ? collapsed.roots : p.roots;
            parsed = { roots: roots, stripped: p.stripped };
            preview.textContent = dbePreviewLines(roots).join('\n');
            var total = dbePreviewLines(roots).length;
            var note = dbeFmt(dbeTn(total,
                'importCountOne', '%s element will be created.',
                'importCountMany', '%s elements will be created.'), total);
            if (p.stripped.length) {
                var uniq = p.stripped.filter(function (v, i, a) { return a.indexOf(v) === i; });
                note += ' ' + dbeFmt(dbeT('htmlStripped', '(stripped: %s)'), uniq.join(', '));
            }
            if (collapsing && wireCheck.checked) {
                note += ' ' + dbeT('importCollapseWiredNote', 'Each collection stores its items as JSON in its data-b-context attribute.');
                if (collapsed.opaque) {
                    note += ' ' + dbeT('importCollapseOpaqueNote', 'SVGs or components that differ between copies keep the first copy’s version.');
                }
            } else if (collapsing) {
                note += ' ' + dbeT('importCollapseBindNote', 'New collections still need their data binding.');
            }
            status.textContent = note;
            status.classList.remove('dbe-html__status--warn');
            insert.disabled = false;
        }
        editor.onChange(function () {
            dbeClearOwnedTimeout(DBE_EDITING_OWNER, previewTimer);
            previewTimer = dbeSetOwnedTimeout(DBE_EDITING_OWNER, refreshPreview, 250);
        });
        collapseCheck.addEventListener('change', refreshPreview);
        wireCheck.addEventListener('change', refreshPreview);

        insert.addEventListener('click', function () {
            if (!parsed || !parsed.roots.length) { return; }
            var liveSlot = dbeImportSlot(targetId); // re-read: the tree may have moved on
            if (!liveSlot) { status.textContent = dbeT('importHtmlTargetGone', 'The target element no longer exists'); return; }
            var roots = parsed.roots;
            // A Collection target accepts static elements as well as templates
            // (the <template> child is the repeatable, the rest render once), so
            // no root-type restriction is applied here.
            restoreFocusOnClose = false;
            dlg.close();
            var wasBusy = dbeUndoBusy;
            dbeUndoBusy = true;
            var count = 0;
            var firstId = null;
            try {
                var sf = store();
                roots.forEach(function (r, i) {
                    var res = dbeInsertParsedNode(sf, r, liveSlot.parentId, liveSlot.index + i);
                    count += res.count;
                    if (firstId === null) { firstId = res.id; }
                });
            } finally { dbeUndoBusy = wasBusy; }
            // Seal step-undo behind a barrier (same reasoning as Edit as HTML):
            // the import lands several elements as one op the add/delete stack
            // can't unwind cleanly, so Cmd+Z must not revert an earlier action.
            dbeHistoryBarrier(dbeT('importHtmlNotUndoable', 'Import HTML can’t be undone as one action. Delete the imported elements to remove them.'));
            undoToast(dbeFmt(dbeTn(count,
                'htmlImportedOne', 'Imported %s element',
                'htmlImportedMany', 'Imported %s elements'), count));
            // Land the selection on the first imported root, like wrap() does.
            if (firstId) {
                waitFor(function () {
                    return document.querySelector('.uniRightPanel .uni-tree-node-' + firstId) || null;
                }, function (row) { if (row) { clickSeq(row); } });
            }
        });

        dbeBindEditingDialogEscape(dlg, editor.el);
        dlg.addEventListener('keydown', function (e) { e.stopPropagation(); });
        ['pointerdown', 'mousedown', 'click'].forEach(function (t) {
            dlg.addEventListener(t, function (e) { e.stopPropagation(); });
        });
        dlg.addEventListener('close', function () {
            dbeClearOwnedTimeout(DBE_EDITING_OWNER, previewTimer);
            editor.dispose();
            dlg.remove();
            if (restoreFocusOnClose) { dbeEditingDialogFocusReturn(focusReturn); }
        });
        document.body.appendChild(dlg);
        dlg.showModal();
        editor.layout(); // Monaco was created in the pre-show (0-size) dialog
        refreshPreview();
        editor.focus();
    }

    /* ============================ Change tag ============================
       (tag_change, Pro). "Change tag…" flyout on an element's right-click
       menu: swaps the `tag` setting through the addModule upsert (repaint +
       persist), and when the label was just the old tag it follows the new
       one through the native rename channel. Void tags are excluded both as
       source and target — an img's attributes make no sense on a div and
       vice versa; the settings panel's own tag select handles those.
       Collections and SubCollections carry the same real `tag` setting, so
       they are taggable too; a Template has no tag at all. The command
       palette's "Change tag" takes a TYPED tag instead of the curated
       flyout list — anything on the known-tag list (the one the HTML
       dialogs accept, so script/style/iframe are already off it) goes. */
    var DBE_TAG_MODULES = { HtmlElement: 1, Collection: 1, SubCollection: 1 };
    var DBE_TAG_CHOICES = [
        'div', 'span', 'section', 'article', 'aside', 'header', 'footer',
        'nav', 'main', 'figure', 'figcaption', 'p',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'a', 'button'
    ];

    /* The current tag when `id` can change tag (a taggable module type with
       a non-void tag), else ''. */
    function dbeChangeTagEligible(id) {
        var m = (modules() || {})[id];
        var tag = m && DBE_TAG_MODULES[m.name]
            ? String(dbeSettingVal(m, 'tag') || '').toLowerCase() : '';
        return (tag && !DBE_HTML_VOID[tag]) ? tag : '';
    }

    /* Normalise a typed tag ("H2", "<h2>") and validate it: known tag,
       non-void. Returns the clean tag, or null when it must be refused. */
    function dbeCleanTagInput(v) {
        var t = String(v || '').trim().toLowerCase().replace(/^</, '').replace(/>$/, '').trim();
        if (!/^[a-z][a-z0-9]*$/.test(t)) { return null; }
        return (DBE_HTML_KNOWN_TAGS[t] && !DBE_HTML_VOID[t]) ? t : null;
    }

    function dbeChangeTag(id, newTag) {
        var mods = modules() || {};
        var m = mods[id];
        if (!m) { return; }
        var oldTag = String(dbeSettingVal(m, 'tag') || '').toLowerCase();
        if (!oldTag || oldTag === newTag) { return; }
        var labelWasDefault = (m.label || '').toLowerCase() === oldTag;
        dbeUpdateModuleSettings(id, function (settings) {
            var t = settings.filter(function (s) { return s.name === 'tag'; })[0];
            if (t) { t.value = newTag; } else { settings.push({ name: 'tag', value: newTag }); }
        }, dbeT('tagChange', 'tag change'), labelWasDefault ? newTag : undefined);
        // Follow-the-tag labels update in the same module upsert; a custom label
        // is the user's and stays. Keeping it atomic also makes rapid Undo safe.
        undoToast(dbeFmt(dbeT('tagChangedTo', 'Tag changed to <%s>'), newTag), 'undo');
    }


    /* Re-add rec.subtree under rec.parentId via forged clipboard + native Paste.
       cb(newId) on success, cb(null, message) on failure. */
    function dbeRestoreOp(rec, cb) {
        var beforeIds = Object.keys(modules() || {});
        // Forged clipboard payload matching what native Copy writes. The version
        // block matched 1.3.5-beta when verified; paste keys off `source`.
        var payload = JSON.stringify({
            modules: rec.subtree,
            indexes: { root: [rec.id] },
            template: { settings: [], technology: 'html' },
            version: { 'builderius': '1.3.6-beta', 'builderius-pro': '1.3.6-beta' },
            source: 'builderiusCopiedElements'
        });
        var paste = function (menuRowId) {
            var prevClip = null;
            navigator.clipboard.readText()
                .then(function (t) { prevClip = t; })
                .catch(function () {})
                .then(function () { return navigator.clipboard.writeText(payload); })
                .then(function () {
                    driveContextMenuItem(menuRowId, 'Paste', function (ok) {
                        if (!ok) { cb(null, dbeT('undoFailedPaste', 'Undo failed: could not reach Paste')); return; }
                        waitFor(function () {
                            var mods = modules() || {};
                            return Object.keys(mods).find(function (id) {
                                return beforeIds.indexOf(id) === -1 && (mods[id].parent || '') === rec.parentId;
                            }) || null;
                        }, function (newId) {
                            if (prevClip !== null) { navigator.clipboard.writeText(prevClip).catch(function () {}); }
                            if (newId) { dbePositionRestoredModule(newId, rec); }
                            cb(newId || null, newId ? null : dbeT('undoFailedNotRestored', 'Undo failed: element not restored'));
                        });
                    });
                })
                .catch(function () { cb(null, dbeT('undoFailedClipboard', 'Undo failed: clipboard blocked')); });
        };
        if (rec.parentId) {
            // Real selection: paste inserts into the ACTIVE module. The tree is
            // often mid-re-render straight after a delete and a single click can
            // be lost with the replaced row nodes, so re-query and re-click on a
            // short cadence until the selection sticks.
            var attempts = 0;
            (function selectParent() {
                var row = document.querySelector('.uniRightPanel .uni-tree-node-' + rec.parentId);
                if (row) { clickSeq(row); }
                waitFor(function () { return activeId() === rec.parentId || null; }, function (ok) {
                    if (ok) { paste(rec.parentId); }
                    else if (++attempts < 4) { selectParent(); }
                    else { cb(null, dbeT('undoFailedSelectParent', 'Undo failed: could not select the parent')); }
                }, 20); // 4 tries x ~500ms instead of one 1.5s wait
            })();
        } else {
            // Root-level restore: clear the selection so paste falls back to root.
            try { store().storeSet('activeModule', ''); } catch (e) {}
            var anyRow = document.querySelector('.uniRightPanel .uniModTree__item');
            var m = anyRow && anyRow.className.toString().match(/uni-tree-node-(\w+)/);
            if (!m) { cb(null, dbeT('undoFailedNoRows', 'Undo failed: no tree rows')); return; }
            paste(m[1]);
        }
    }

    /* Pop a record off `from`, run its op (restore a removed subtree, or remove
       an added element), and push the inverse op onto `to`. Undo and redo are the
       same routine run over opposite stacks. */
    function dbeRunHistory(from, to, emptyKey, emptyDef, successAction) {
        if (dbeUndoBusy) { return; }
        var rec = from.pop();
        if (!rec) { undoToast(dbeT(emptyKey, emptyDef)); return; }
        // A compound-reconcile barrier: report that the change isn't
        // step-undoable, revert nothing, and put the barrier straight back so
        // the parked earlier history is never crossed. Redo never produces one.
        if (rec.op === 'barrier') {
            from.push(rec);
            undoToast(rec.msg || dbeT('editHtmlNotUndoable', 'This change can’t be undone step by step'));
            return;
        }
        if (rec.op === 'settings') {
            var settingsMods = modules() || {};
            var settingsMod = settingsMods[rec.id];
            if (!settingsMod) {
                from.push(rec);
                undoToast(dbeFmt(dbeT('cannotUpdateGone', 'Cannot update “%s”: it is no longer here'), rec.label));
                return;
            }
            var settingsInverse = {
                op: 'settings', id: rec.id, label: rec.label, change: rec.change,
                moduleLabel: settingsMod.label || '',
                settings: JSON.parse(JSON.stringify(settingsMod.settings || []))
            };
            dbeUndoBusy = true;
            try {
                dbeUpdateModuleSettings(rec.id, function (settings) {
                    var restored = JSON.parse(JSON.stringify(rec.settings || []));
                    settings.length = 0;
                    restored.forEach(function (setting) { settings.push(setting); });
                }, null, rec.moduleLabel);
            } finally { dbeUndoBusy = false; }
            to.push(settingsInverse);
            if (to.length > 10) { to.shift(); }
            undoToast(dbeFmt(successAction === 'redo'
                ? dbeT('undidPropertyChange', 'Undid %1$s for “%2$s”')
                : dbeT('redidPropertyChange', 'Redid %1$s for “%2$s”'), rec.change, rec.label), successAction);
        } else if (rec.op === 'move') {
            var current = dbeMoveLocation(rec.id);
            if (!current || current.index < 0) {
                from.push(rec);
                undoToast(dbeFmt(dbeT('cannotMoveGone', 'Cannot move “%s”: it is no longer here'), rec.label));
                return;
            }
            if (rec.parentId && !current.mods[rec.parentId]) {
                from.push(rec);
                undoToast(dbeFmt(dbeT('cannotMoveParentGone', 'Cannot move “%s”: its destination parent is gone'), rec.label));
                return;
            }
            var inverse = {
                op: 'move', id: rec.id, label: rec.label,
                parentId: current.parentId, index: current.index
            };
            dbeUndoBusy = true;
            storeMoveModule(current.sf, rec.id, rec.parentId, rec.index);
            dbeUndoBusy = false;
            to.push(inverse);
            if (to.length > 10) { to.shift(); }
            dbeFocusMovedRow(rec.id);
            undoToast(dbeFmt(dbeT('movedBack', 'Moved “%s” back'), rec.label), successAction);
        } else if (rec.op === 'restore') {
            if (rec.parentId && !document.querySelector('.uniRightPanel .uni-tree-node-' + rec.parentId)) {
                from.push(rec);
                undoToast(dbeFmt(dbeT('cannotRestoreParentGone', 'Cannot restore “%s”: its parent is gone'), rec.label));
                return;
            }
            dbeUndoBusy = true;
            dbeRestoreOp(rec, function (newId, msg) {
                dbeUndoBusy = false;
                if (!newId) { from.push(rec); undoToast(msg || dbeT('undoFailedNotRestored', 'Undo failed: element not restored')); return; }
                to.push({ op: 'remove', id: newId, label: rec.label, parentId: rec.parentId, subtree: rec.subtree });
                undoToast(dbeFmt(dbeT('restored', 'Restored “%s”'), rec.label), successAction);
            });
        } else { // 'remove'
            var mods = modules() || {};
            if (!mods[rec.id] || !document.querySelector('.uniRightPanel .uni-tree-node-' + rec.id)) {
                undoToast(dbeFmt(dbeT('cannotRemoveGone', 'Cannot undo: “%s” is no longer here'), rec.label));
                return;
            }
            // Snapshot the live subtree first so the inverse can re-add it.
            var subtree = dbeCollectSubtree(mods, rec.id);
            var placement = dbeHistoryPlacement(mods, store().storeGet('indexes') || {}, rec.id);
            var parentId = placement.parentId;
            dbeUndoBusy = true;
            driveContextMenuItem(rec.id, 'Remove', function (ok) {
                setTimeout(function () {
                    dbeUndoBusy = false;
                    if (!ok) { from.push(rec); undoToast(dbeT('undoFailedRemove', 'Undo failed: could not remove the element')); return; }
                    to.push({
                        op: 'restore', id: rec.id, label: rec.label, parentId: parentId,
                        index: placement.index, beforeId: placement.beforeId, afterId: placement.afterId,
                        subtree: subtree
                    });
                    undoToast(dbeFmt(dbeT('removed', 'Removed “%s”'), rec.label), successAction);
                }, 300);
            });
        }
    }

    function performUndo() { dbeRunHistory(undoStack, redoStack, 'nothingToUndo', 'Nothing to undo. DBE undo covers element adds, deletes, moves and DBE property changes.', 'redo'); }
    function performRedo() { dbeRunHistory(redoStack, undoStack, 'nothingToRedo', 'Nothing to redo', 'undo'); }


    function bindUndoKeys() {
        dbeBindOwnedEvent(DBE_EDITING_OWNER, document, 'history-key', 'keydown', function (e) {
            if (!(e.metaKey || e.ctrlKey) || (e.key || '').toLowerCase() !== 'z') { return; }
            // Leave text-editing undo alone: inputs, contenteditables (settings
            // header rename), Monaco code editors, and our inline rename field.
            var t = e.target;
            if (renameActive()) { return; }
            if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], .monaco-editor')) { return; }
            e.preventDefault();
            e.stopPropagation();
            if (e.shiftKey) { performRedo(); } else { performUndo(); }
        }, true);
    }

    /* (k) Save-state cue. Builderius records a history snapshot per module
       operation and exposes shouldSaveData for settings-only edits. A successful
       save replaces history with one freshly timestamped snapshot; the public
       afterSaveAllSettings hook runs after success AND failure. Together those
       signals let the cue report clean -> unsaved -> saving -> saved without
       declaring success merely because Save was clicked. */
    var saveBaseline = null;
    var saveBaselineSnapshot = null;
    var saveSettingsBaseline = null;
    var dbeSaveInitialisingUntil = 0;
    var dbeSaveState = '';
    var dbeSavePending = null;
    var dbeSaveTimer = null;
    var dbeSaveIgnoreDirtyUntil = 0;
    var dbeSaveLastStamp = 0;
    var dbeSaveSnapshotItem = null;
    var dbeSaveSnapshotSignature = null;

    function historyLen() {
        try { return (store().storeGet('history') || []).length; } catch (e) { return null; }
    }
    function dbeSaveStamp() {
        try {
            var h = store().storeGet('history') || [];
            return h.length === 1 && h[0] && Number(h[0].timestamp) ? Number(h[0].timestamp) : 0;
        } catch (e) { return 0; }
    }
    function dbeShouldSave() {
        try { return store().storeGet('shouldSaveData') === true; } catch (e) { return false; }
    }
    /* Builderius caps history at five entries, so length can no longer prove an
       edit once the cap is reached. Compare the newest saveable snapshot
       (modules, indexes, entity and global) with the clean baseline instead.
       Selection-only history entries serialise identically; a content/settings
       edit changes the signature. Cache by history-item identity so the large
       snapshot is serialised only when Builderius actually appends an entry. */
    function dbeSaveableSnapshotSignature() {
        try {
            var history = store().storeGet('history') || [];
            var item = history.length ? history[history.length - 1] : null;
            if (!item || !item.snapshot) { return null; }
            if (item === dbeSaveSnapshotItem) { return dbeSaveSnapshotSignature; }
            dbeSaveSnapshotItem = item;
            dbeSaveSnapshotSignature = JSON.stringify(item.snapshot);
            return dbeSaveSnapshotSignature;
        } catch (e) { return null; }
    }
    function dbeHasUnsavedChanges(len, shouldSave, snapshotSignature) {
        if (typeof len !== 'number') { len = historyLen(); }
        if (typeof shouldSave !== 'boolean') { shouldSave = dbeShouldSave(); }
        if (typeof snapshotSignature !== 'string') { snapshotSignature = dbeSaveableSnapshotSignature(); }
        if (len === null) { return shouldSave; }
        if (saveBaseline === null || (Date.now() < dbeSaveInitialisingUntil && !dbeSavePending)) { return false; }
        if (snapshotSignature !== null && saveBaselineSnapshot !== null) {
            return snapshotSignature !== saveBaselineSnapshot;
        }
        var settingsDirty = saveSettingsBaseline === false && shouldSave;
        return len > saveBaseline || (Date.now() > dbeSaveIgnoreDirtyUntil && settingsDirty);
    }
    function dbeRenderSaveCue() {
        var cue = document.querySelector('.dbe-save-cue');
        if (!cue) { return; }
        var len = historyLen();
        if (len === null) { return; }
        var shouldSave = dbeShouldSave();
        var snapshotSignature = dbeSaveableSnapshotSignature();
        if (saveBaseline === null) {
            saveBaseline = len;
            saveBaselineSnapshot = snapshotSignature;
            saveSettingsBaseline = shouldSave;
            dbeSaveInitialisingUntil = Date.now() + 2000;
        }
        // Builderius hydrates history and shouldSaveData after the chrome has
        // already mounted. Treat that short bootstrap window as the clean
        // baseline instead of announcing a page-load mutation as user work.
        if (Date.now() < dbeSaveInitialisingUntil && !dbeSavePending) {
            saveBaseline = Math.max(saveBaseline, len);
            if (snapshotSignature !== null) { saveBaselineSnapshot = snapshotSignature; }
            saveSettingsBaseline = shouldSave;
        }
        // A true flag present during hydration is not useful as a baseline.
        // Once Builderius clears it, normal false -> true settings edits are
        // detectable for the rest of the session.
        if (saveSettingsBaseline === true && !shouldSave) { saveSettingsBaseline = false; }
        var dirty = dbeHasUnsavedChanges(len, shouldSave, snapshotSignature);
        dbePresenceDirtyChanged(dirty);
        if (dbeSaveState === 'saved' && dirty) { dbeSaveState = ''; }
        var state = dbeSaveState || (dirty ? 'dirty' : 'clean');
        var text = state === 'saving' ? dbeT('saving', 'Saving…')
            : state === 'saved' ? dbeT('saved', 'Changes saved')
                : state === 'error' ? dbeT('saveFailed', 'Save failed. Your changes are still unsaved. Try again.')
                    : state === 'dirty' ? dbeT('unsaved', 'Unsaved changes')
                        : dbeT('saveClean', 'All changes saved');
        var shortText = state === 'saving' ? dbeT('saving', 'Saving…')
            : state === 'error' ? dbeT('saveFailedShort', 'Save failed')
                : state === 'dirty' ? dbeT('unsavedShort', 'Unsaved')
                    : dbeT('saveCleanShort', 'Saved');
        var full = cue.querySelector('.dbe-save-cue__full');
        var short = cue.querySelector('.dbe-save-cue__short');
        if (!full || !short) {
            cue.textContent = '';
            full = document.createElement('span');
            full.className = 'dbe-save-cue__full';
            short = document.createElement('span');
            short.className = 'dbe-save-cue__short';
            short.setAttribute('aria-hidden', 'true');
            cue.appendChild(full);
            cue.appendChild(short);
        }
        if (full.textContent !== text) { full.textContent = text; }
        if (short.textContent !== shortText) { short.textContent = shortText; }
        ['clean', 'dirty', 'saving', 'saved', 'error'].forEach(function (name) {
            cue.classList.toggle('is-' + name, state === name);
        });
    }
    function dbeShowSavedState(stamp) {
        dbeSaveLastStamp = stamp;
        saveBaseline = historyLen();
        saveBaselineSnapshot = dbeSaveableSnapshotSignature();
        saveSettingsBaseline = false;
        dbeSaveIgnoreDirtyUntil = Date.now() + 500;
        dbeSaveState = 'saved';
        dbeClearOwnedTimeout(DBE_EDITING_OWNER, dbeSaveTimer);
        dbeSaveTimer = dbeSetOwnedTimeout(DBE_EDITING_OWNER, function () {
            dbeSaveTimer = null;
            if (dbeSaveState === 'saved') { dbeSaveState = ''; dbeRenderSaveCue(); }
        }, 2000);
        dbeRenderSaveCue();
    }
    function dbeFinishSave() {
        var stamp = dbeSaveStamp();
        if (!dbeSavePending) {
            // Save options can commit without clicking the main Save button.
            // They cannot show the pre-request state, but a fresh snapshot can
            // still confirm Saved without guessing from a menu label.
            if (stamp && stamp !== dbeSaveLastStamp) { dbeShowSavedState(stamp); }
            return;
        }
        var pending = dbeSavePending;
        dbeSavePending = null;
        dbeClearOwnedTimeout(DBE_EDITING_OWNER, dbeSaveTimer);
        dbeSaveTimer = null;
        var confirmed = stamp >= pending.started && stamp !== pending.beforeStamp;
        if (confirmed) { dbeShowSavedState(stamp); }
        else { dbeSaveState = 'error'; dbeRenderSaveCue(); }
    }
    function dbeBeginSave() {
        dbeClearOwnedTimeout(DBE_EDITING_OWNER, dbeSaveTimer);
        dbeSavePending = { started: Date.now(), beforeStamp: dbeSaveStamp() };
        dbeSaveState = 'saving';
        dbeRenderSaveCue();
        // Session-expiry failures can stop before saveAllSettings runs, so its
        // finally hook never fires. Do not leave the cue saying Saving forever.
        dbeSaveTimer = dbeSetOwnedTimeout(DBE_EDITING_OWNER, function () {
            dbeSaveTimer = null;
            if (!dbeSavePending) { return; }
            dbeSavePending = null;
            dbeSaveState = 'error';
            dbeRenderSaveCue();
        }, 30000);
    }
    function hookSaveStatus() {
        dbeSaveLastStamp = dbeSaveStamp();
        dbeBindOwnedHook(
            DBE_EDITING_OWNER,
            'builderius.storeAction.afterSaveAllSettings',
            'dbeSaveStatus',
            dbeFinishSave
        );
    }
    function dbeSaveButtonClick(e) {
        if (!(e.target.closest && e.target.closest(dbeSelector('saveButton')))) { return; }
        // The caret strip inside the button opens the Save menu without
        // saving — opening it must not rebaseline the Unsaved cue.
        if (e.target.closest('.saveBtn .actions')) { return; }
        dbeBeginSave();
    }
    function dbeEnsureSaveShortcutMetadata() {
        var save = dbeQuery('saveButton');
        if (!save || !on('save_shortcut')) { return; }
        dbeRememberOwnedAttributes(DBE_EDITING_OWNER, save, ['aria-keyshortcuts']);
        var shortcut = dbeIsMac ? 'Meta+S' : 'Control+S';
        if (save.getAttribute('aria-keyshortcuts') !== shortcut) {
            save.setAttribute('aria-keyshortcuts', shortcut);
        }
    }
    function ensureSaveCue() {
        // .saveBtn, not bare .uniPanelButtonPrimary: the breakpoints modal mounts
        // its own (disabled) primary Save earlier in document order, and the bare
        // class would anchor the cue to — and rebaseline on — that dead button.
        var save = dbeQuery('saveButton');
        if (!save) { return; }
        var cue = document.querySelector('.dbe-save-cue');
        if (!cue) {
            cue = document.createElement('span');
            cue.className = 'dbe-save-cue';
            cue.setAttribute('role', 'status');
            cue.setAttribute('aria-atomic', 'true');
            save.parentNode.insertBefore(cue, save);
        }
        dbeRenderSaveCue();
    }

    /* (k2) Cmd/Ctrl+S saves the template (save_shortcut). The browser's
       save-page dialog is useless inside the builder, and every editor trains
       this muscle memory. Capture-phase, so it wins before Monaco or the
       builder see the key; deliberately NOT gated on inputs/contenteditable —
       saving from the middle of typing is exactly what the WordPress block
       editor does. Acts (and suppresses the browser dialog) only when the
       native Save button is actually present; the programmatic click also
       bubbles through the save cue's delegated listener, so keyboard and
       pointer saves report the same Saving/Saved state. */
    function bindSaveShortcut() {
        dbeBindOwnedEvent(DBE_EDITING_OWNER, document, 'save-shortcut', 'keydown', function (e) {
            if (e.repeat || (e.key || '').toLowerCase() !== 's') { return; }
            var mod = dbeIsMac ? (e.metaKey && !e.ctrlKey) : e.ctrlKey;
            if (!mod || e.shiftKey || e.altKey) { return; }
            // .saveBtn, not bare .uniPanelButtonPrimary: the breakpoints modal
            // mounts its own (disabled) primary Save earlier in document order,
            // and querySelector on the bare class lands on that dead button.
            var save = dbeQuery('saveButton');
            if (!save || save.disabled) { return; } // nothing to drive — leave the browser default alone
            e.preventDefault();
            e.stopPropagation();
            clickSeq(save);
        }, true);
    }

    /* ---- HTML attribute helpers (attr_helpers) -----------------------------
       Two conveniences on the Advanced panel's HTML-attributes control:
       (1) when the list opens empty, seed one blank row so the user can type
           straight away — and drop it again if it is left blank, so an empty
           attribute never reaches a save; (2) a native <datalist> of common
           attribute names on each name field. Both are DOM sugar over the
           native control — the store is written through Builderius's own
           add / remove buttons, with one exception: when the panel unmounts
           before the blank row could be removed via its button, the leftover
           blank entry is stripped through the addModule upsert channel
           (dbeRemoveBlankAttrs), the same channel the palette's attribute
           command uses. Never a raw slice write. */
    var dbeAttrSeededRow = null; // the blank row we added, awaiting use or cleanup
    var dbeAttrSeededFor = null; // activeModule id we last seeded for (double-seed guard)
    var dbeAttrSeedOwned = false; // true only while our native Add click remains unsettled

    // A row is `_item` in display mode, `_itemEdit` while it holds live name/value
    // inputs (a freshly-added or edited row is always `_itemEdit`).
    var ATTR_ROW_SEL = '.uniSettingHtmlAttribute_item, .uniSettingHtmlAttribute_itemEdit';
    function attrList() { return document.querySelector('ul.uniSettingHtmlAttribute_list'); }
    function attrRows(list) { return [].slice.call(list.querySelectorAll(ATTR_ROW_SEL)); }
    function attrNameInput(row) {
        return row.querySelector('.uniSettingHtmlAttribute_itemName input') || row.querySelector('input');
    }
    function attrRowBlank(row) {
        var inputs = [].slice.call(row.querySelectorAll('input'));
        return inputs.length > 0 && inputs.every(function (i) { return !(i.value || '').trim(); });
    }
    function attrRemoveRow(row) {
        var btn = row.querySelector('.uniSettingHtmlAttribute_itemActions button') || row.querySelector('button');
        if (btn) { clickSeq(btn); }
    }

    /* Fallback cleanup for the seeded row when its DOM is already gone (panel
       unmounted before focusout fired): the native Add click has written the
       blank {name:'', value:''} into the module's settings, and with no row
       left there is no remove button to drive — so strip blank entries through
       the settings upsert channel instead. No-ops (one read, no dispatch) when
       the blank never reached the store. */
    function dbeRemoveBlankAttrs(id) {
        var mods = modules() || {};
        var mod = mods[id];
        if (!mod) { return; }
        var ha = (mod.settings || []).filter(function (s) { return s.name === 'htmlAttribute'; })[0];
        if (!ha || !Array.isArray(ha.value)) { return; }
        if (!ha.value.some(function (a) { return !(a && (a.name || '').trim()); })) { return; }
        dbeUpdateModuleSettings(id, function (settings) {
            var h = settings.filter(function (s) { return s.name === 'htmlAttribute'; })[0];
            if (h && Array.isArray(h.value)) {
                h.value = h.value.filter(function (a) { return a && (a.name || '').trim(); });
            }
        });
    }

    function ensureAttrDatalist() {
        if (document.getElementById('dbe-attr-names')) { return; }
        var dl = document.createElement('datalist');
        dl.id = 'dbe-attr-names';
        ['id', 'role', 'title', 'tabindex', 'aria-label', 'aria-labelledby', 'aria-describedby',
         'aria-hidden', 'aria-live', 'data-', 'lang', 'dir', 'hidden'].forEach(function (n) {
            var o = document.createElement('option');
            o.value = n;
            dl.appendChild(o);
        });
        document.body.appendChild(dl);
    }

    function bindAttrQuickPick(list) {
        ensureAttrDatalist();
        attrRows(list).forEach(function (row) {
            var nameInput = attrNameInput(row);
            // React may drop an unmanaged attribute on re-render — re-apply each tick.
            if (nameInput) {
                dbeRememberOwnedAttributes(DBE_EDITING_OWNER, nameInput, ['list', 'aria-label']);
                if (nameInput.getAttribute('list') !== 'dbe-attr-names') { nameInput.setAttribute('list', 'dbe-attr-names'); }
                // The inputs carry only a "name"/"value" placeholder, which is not
                // an accessible name — give each a real label for screen readers.
                if (!nameInput.getAttribute('aria-label')) { nameInput.setAttribute('aria-label', dbeT('attrNameLabel', 'Attribute name')); }
            }
            [].slice.call(row.querySelectorAll('input')).forEach(function (inp) {
                if (inp !== nameInput && !inp.getAttribute('aria-label')) {
                    dbeRememberOwnedAttributes(DBE_EDITING_OWNER, inp, ['aria-label']);
                    inp.setAttribute('aria-label', dbeT('attrValueLabel', 'Attribute value'));
                }
            });
        });
    }

    function bindAttrAutoClean() {
        // When focus leaves the seeded row while it is still blank, drop it — the
        // row the user never filled in never reaches the store's save.
        dbeBindOwnedEvent(DBE_EDITING_OWNER, document, 'attribute-seed-clean', 'focusout', function () {
            if (!dbeAttrSeededRow) { return; }
            dbeSetOwnedTimeout(DBE_EDITING_OWNER, function () {
                var r = dbeAttrSeededRow;
                if (!r) { return; }
                if (!document.body.contains(r)) {
                    // Row gone with the panel — clean the store copy instead.
                    dbeAttrSeededRow = null;
                    if (dbeAttrSeedOwned && dbeAttrSeededFor) { try { dbeRemoveBlankAttrs(dbeAttrSeededFor); } catch (e) {} }
                    dbeAttrSeedOwned = false;
                    return;
                }
                if (r.contains(document.activeElement)) { return; } // still editing it
                r.classList.remove('dbe-attr-seeded');
                if (attrRowBlank(r)) { attrRemoveRow(r); }
                dbeAttrSeededRow = null; // its fate is settled either way
                dbeAttrSeedOwned = false;
            }, 60);
        }, true);
    }

    function ensureBlankAttrRow() {
        bindAttrAutoClean();
        var list = attrList();
        if (!list) { return; } // Advanced panel not open / no attributes control here
        bindAttrQuickPick(list);
        var mid = activeId();
        if (dbeAttrSeededFor === mid) { return; } // already handled this element
        var rows = attrRows(list);
        if (rows.length > 0) { dbeAttrSeededFor = mid; return; } // user already has rows
        var addBtn = (list.parentNode && list.parentNode.querySelector('button.uniSettingHtmlAttribute_addNewBtn')) ||
            document.querySelector('button.uniSettingHtmlAttribute_addNewBtn');
        if (!addBtn) { return; }
        dbeAttrSeededFor = mid;
        dbeAttrSeedOwned = true;
        clickSeq(addBtn);
        waitFor(function () {
            var l = attrList();
            return (l && l.querySelector(ATTR_ROW_SEL)) || null;
        }, function (r) {
            if (!dbeEditingControllerActive || !r) { return; }
            dbeAttrSeededRow = r;
            r.classList.add('dbe-attr-seeded');
            var l = attrList();
            if (l) { bindAttrQuickPick(l); }
            var ni = attrNameInput(r);
            if (ni) { try { ni.focus(); } catch (e) {} }
        });
    }

    /* ---- Display-condition helpers (condition_helpers) ----------------------
       Three things for the settings panel's conditions mode (.uniElementConditions):
       1. A11y names: the per-card remove button, the operator <select>, the
          value inputs and the free-input toggles all ship nameless (icon- or
          placeholder-only) — stamp real labels each tick.
       2. Blank-card seeding, the attr_helpers pattern: when the view opens on
          an element with no conditions, add the first card ready to choose.
          CAUTION: the native "New condition" click writes a placeholder rule
          ({type:true}) into the module's visibilityCondition SETTING at once
          (verified) — so a seeded card that is still typeless when focus
          settles elsewhere is removed again through its own X, which cleanly
          nulls the setting. (If the view unmounts in the same instant the X
          is gone; that residue is identical to a user clicking New condition
          and saving, which native allows anyway.)
       3. Cues where conditions exist: a dot + count on the conditions-mode
          header button, and a dot + screen-reader suffix on the Navigator
          rows of elements that carry conditions. The row spans are re-added
          each tick after React re-renders (the tag-badge precedent); (nk)'s
          role stamping never descends into row buttons, so they are safe. */
    var dbeCondSeededFor = null;   // element id the blank card was seeded for
    var dbeCondSeededCard = null;  // the seeded card node, until settled
    var dbeCondViewWas = false;    // view presence last tick (seed on opening edge)
    var dbeCondSeedEngaged = false; // the user interacted with the seeded card
    var dbeCondSeedOwned = false;  // true only for the placeholder DBE added

    function condVisValue(id) {
        var m = (modules() || {})[id];
        var st = m && m.settings;
        if (!st) { return null; }
        for (var i = 0; i < st.length; i++) {
            if (st[i].name === 'visibilityCondition') { return st[i].value || null; }
        }
        return null;
    }
    // Count the chosen leaf rules. Anything except the untouched {type: true}
    // placeholder counts — a leaf's other fields vary by condition type
    // (Dynamic data has no `name` at all), but every chosen type replaces the
    // placeholder's `true` with its own type string.
    function condCountValue(v) {
        var n = 0;
        (function walk(node) {
            if (!node) { return; }
            if (node.type === 'group') { (node.rules || []).forEach(walk); return; }
            if (node.type !== true) { n++; }
        })(v);
        return n;
    }
    function condCount(id) { return condCountValue(condVisValue(id)); }
    // True while the element's whole conditions value is the single untouched
    // placeholder a fresh "New condition" click writes — EXACTLY {type: true}.
    // Never key this off a missing `name`: some condition types (Dynamic data)
    // legitimately have none, and a looser test removed a just-chosen card.
    function condBlankOnly(id) {
        var v = condVisValue(id);
        if (!v) { return false; }
        var leaves = [];
        (function walk(node) {
            if (!node) { return; }
            if (node.type === 'group') { (node.rules || []).forEach(walk); return; }
            leaves.push(node);
        })(v);
        return leaves.length === 1 && leaves[0].type === true;
    }

    function condA11y(view) {
        [].slice.call(view.querySelectorAll('.uniElementConditions_itemActions .uniIconButton')).forEach(function (b) {
            if (!b.getAttribute('aria-label')) {
                dbeRememberOwnedAttributes(DBE_EDITING_OWNER, b, ['aria-label']);
                b.setAttribute('aria-label', dbeT('condRemove', 'Remove condition'));
            }
        });
        [].slice.call(view.querySelectorAll('.uniElementConditions_itemEdit, .uniElementConditions_item')).forEach(function (item) {
            // First <select> in a card is the comparison operator; any later
            // one picks the value.
            [].slice.call(item.querySelectorAll('.uniElementConditions_itemFields select')).forEach(function (s, i) {
                var want = i === 0 ? dbeT('condOperator', 'Comparison') : dbeT('condValue', 'Value');
                if (s.getAttribute('aria-label') !== want) {
                    dbeRememberOwnedAttributes(DBE_EDITING_OWNER, s, ['aria-label']);
                    s.setAttribute('aria-label', want);
                }
            });
        });
        [].slice.call(view.querySelectorAll('.uniElementConditions_itemFields input:not([type="hidden"])')).forEach(function (inp) {
            if (inp.getAttribute('aria-label')) { return; }
            if (inp.classList.contains('uniSystemSelect__search') || inp.classList.contains('uniSystemSelect__hiddenField')) { return; }
            dbeRememberOwnedAttributes(DBE_EDITING_OWNER, inp, ['aria-label']);
            inp.setAttribute('aria-label', inp.placeholder || dbeT('condValue', 'Value'));
        });
        [].slice.call(view.querySelectorAll('.uniSystemSelect__freeInputBtn, .builderiusSelectFreeInputToggle')).forEach(function (b) {
            if (!b.getAttribute('aria-label')) {
                dbeRememberOwnedAttributes(DBE_EDITING_OWNER, b, ['aria-label']);
                b.setAttribute('aria-label', dbeT('condFreeInput', 'Type a custom value'));
            }
        });
    }

    // React replaces the card node on re-render; while the seed is still the
    // single typeless rule, the current edit card IS the seed — re-point.
    function condSeedResolve() {
        if (dbeCondSeededCard && dbeCondSeededCard.isConnected) { return dbeCondSeededCard; }
        dbeCondSeededCard = (dbeCondSeededFor && condBlankOnly(dbeCondSeededFor))
            ? document.querySelector('.uniElementConditions_itemEdit')
            : null;
        return dbeCondSeededCard;
    }

    /* Fallback cleanup when the seeded card's DOM is already gone (the element
       was switched before focusout's timer ran, so there is no X to drive):
       strip the placeholder through the settings upsert channel — the same
       one attr_helpers uses for its orphaned blank rows. No-op unless the
       element's whole conditions value is still the single typeless leaf. */
    function dbeRemoveBlankCondition(id) {
        if (!condBlankOnly(id)) { return; }
        dbeUpdateModuleSettings(id, function (settings) {
            for (var i = settings.length - 1; i >= 0; i--) {
                if (settings[i].name === 'visibilityCondition') { settings.splice(i, 1); }
            }
        });
    }

    // Settle a seeded card once focus is elsewhere: still untouched → remove
    // it via its own X (returns the store to "no conditions"); engaged with in
    // ANY way → it is the user's card now, keep it. The engagement flag is the
    // primary signal — the store test alone races the async commit of a chosen
    // type (observed with Dynamic data: the focusout timer fired before the
    // type write landed, and the cleaner removed a card the user had just
    // configured).
    function condSeedClean() {
        var id = dbeCondSeededFor;
        if (dbeCondSeedEngaged) {
            var kept = condSeedResolve();
            if (kept) { kept.classList.remove('dbe-cond-seeded'); }
            dbeCondSeededCard = null;
            dbeCondSeedOwned = false;
            return;
        }
        var card = condSeedResolve();
        if (!card) {
            if (id && condBlankOnly(id)) { try { dbeRemoveBlankCondition(id); } catch (e) {} }
            dbeCondSeededCard = null;
            dbeCondSeedOwned = false;
            return;
        }
        if (card.contains(document.activeElement)) { return; }
        if (id && condBlankOnly(id)) {
            var x = card.querySelector('.uniElementConditions_itemActions .uniIconButton');
            if (x) { clickSeq(x); }
        }
        card.classList.remove('dbe-cond-seeded');
        dbeCondSeededCard = null;
        dbeCondSeedOwned = false;
    }
    function bindCondAutoClean() {
        dbeBindOwnedEvent(DBE_EDITING_OWNER, document, 'condition-seed-clean', 'focusout', function () {
            if (!dbeCondSeededCard) { return; }
            dbeSetOwnedTimeout(DBE_EDITING_OWNER, condSeedClean, 60);
        }, true);
        // Any pointer or key interaction inside the seeded card disarms the
        // auto-clean — including clicks in the type select's dropdown, which
        // the uniSystemSelect renders inside the card.
        var engage = function (e) {
            if (!dbeCondSeededCard || dbeCondSeedEngaged) { return; }
            var card = condSeedResolve();
            if (card && e.target && card.contains(e.target)) { dbeCondSeedEngaged = true; }
        };
        dbeBindOwnedEvent(DBE_EDITING_OWNER, document, 'condition-seed-pointer', 'pointerdown', engage, true);
        dbeBindOwnedEvent(DBE_EDITING_OWNER, document, 'condition-seed-key', 'keydown', engage, true);
    }

    function condSeedBlank(view) {
        var id = activeId();
        if (!id || dbeCondSeededFor === id) { return; }
        if (view.querySelector('.uniElementConditions_itemEdit, .uniElementConditions_item')) { dbeCondSeededFor = id; return; }
        if (condVisValue(id)) { dbeCondSeededFor = id; return; }
        var add = view.querySelector('.uniElementConditions_addNewBtn');
        if (!add) { return; }
        dbeCondSeededFor = id;
        dbeCondSeedEngaged = false;
        dbeCondSeedOwned = true;
        clickSeq(add);
        waitFor(function () {
            return view.querySelector('.uniElementConditions_itemEdit') || null;
        }, function (card) {
            if (!dbeEditingControllerActive || !card) { return; }
            dbeCondSeededCard = card;
            card.classList.add('dbe-cond-seeded');
            // Ready to choose: focus the condition-type combobox — but only
            // when the user is already working in the settings panel (they
            // just opened the mode from its header icon). Never steal focus
            // from the Navigator or the canvas.
            var left = document.querySelector('.uniLeftPanelOuter') || document.querySelector('.uniLeftPanel');
            if (left && left.contains(document.activeElement)) {
                var typeSel = card.querySelector('.uniSystemSelect');
                if (typeSel) { try { typeSel.focus(); } catch (e) {} }
            }
        });
    }

    function condCues() {
        var mods = modules() || {};
        var withCond = {};
        for (var k in mods) {
            var st = mods[k].settings, v = null;
            if (st) {
                for (var i = 0; i < st.length; i++) {
                    if (st[i].name === 'visibilityCondition') { v = st[i].value || null; break; }
                }
            }
            if (v && condCountValue(v) > 0) { withCond[k] = true; }
        }
        var icon = document.querySelector('.uniIconConditionsMode');
        if (icon) {
            dbeRememberOwnedAttributes(DBE_EDITING_OWNER, icon, ['aria-label', 'data-dbe-tip']);
            var id = activeId();
            var n = id ? condCount(id) : 0;
            var has = n > 0;
            if (icon.classList.contains('dbe-has-cond') !== has) { icon.classList.toggle('dbe-has-cond', has); }
            var want = has
                ? dbeFmt(dbeT('condIconCount', 'Dynamic data conditions (%s set)'), n)
                : dbeT('conditionsMode', 'Dynamic data conditions');
            if (icon.getAttribute('aria-label') !== want) { icon.setAttribute('aria-label', want); }
            if (icon.getAttribute('data-dbe-tip') !== want) { icon.setAttribute('data-dbe-tip', want); }
        }
        [].slice.call(document.querySelectorAll('.uniRightPanel button.uniModTree__item')).forEach(function (btn) {
            var m = btn.className.toString().match(/uni-tree-node-(\w+)/);
            var has2 = !!(m && withCond[m[1]]);
            var descriptionId = m ? 'dbe-cond-desc-' + m[1] : '';
            var dot = btn.querySelector('.dbe-cond-dot');
            if (has2) {
                if (!dot) {
                    var d = document.createElement('span');
                    d.className = 'dbe-cond-dot';
                    d.setAttribute('aria-hidden', 'true');
                    var sr = document.createElement('span');
                    sr.className = 'dbe-visually-hidden dbe-cond-sr';
                    sr.id = descriptionId;
                    sr.textContent = dbeT('condTreeSuffix', 'Has display conditions');
                    btn.appendChild(d);
                    btn.appendChild(sr);
                }
                dbeRememberOwnedAttributes(DBE_EDITING_OWNER, btn, ['aria-describedby']);
                var descriptions = (btn.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
                if (descriptions.indexOf(descriptionId) === -1) {
                    descriptions.push(descriptionId);
                    btn.setAttribute('aria-describedby', descriptions.join(' '));
                }
            } else if (dot) {
                dot.remove();
                var sr2 = btn.querySelector('.dbe-cond-sr');
                if (sr2) { sr2.remove(); }
                var remaining = (btn.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (id) {
                    return id && id !== descriptionId;
                });
                if (remaining.length) { btn.setAttribute('aria-describedby', remaining.join(' ')); }
                else { btn.removeAttribute('aria-describedby'); }
            }
        });
    }

    function ensureConditionHelpers() {
        bindCondAutoClean();
        condCues();
        var view = document.querySelector('.uniLeftPanel .uniElementConditions') || document.querySelector('.uniElementConditions');
        if (!view) {
            dbeCondViewWas = false;
            if (dbeCondSeededCard) { condSeedClean(); }
            return;
        }
        condA11y(view);
        // The user picked a type: the seed did its job, stand down.
        if (dbeCondSeededCard && dbeCondSeededFor && !condBlankOnly(dbeCondSeededFor)) {
            if (dbeCondSeededCard.isConnected) { dbeCondSeededCard.classList.remove('dbe-cond-seeded'); }
            dbeCondSeededCard = null;
            dbeCondSeedOwned = false;
        }
        // Keep the seeded mark on the LIVE card node across React re-renders —
        // until the user engages with the card, when the mark stands down.
        var seeded = condSeedResolve();
        if (seeded) {
            var mark = !dbeCondSeedEngaged;
            if (seeded.classList.contains('dbe-cond-seeded') !== mark) { seeded.classList.toggle('dbe-cond-seeded', mark); }
        }
        // Seed only on the view's OPENING edge. The conditions view is sticky
        // across element selections, and the native add writes a placeholder
        // rule to the store — seeding per selection would dirty every element
        // the user merely arrows past in the tree.
        if (!dbeCondViewWas) { condSeedBlank(view); }
        dbeCondViewWas = true;
    }

    /* ---- Component properties reorder (properties_reorder) -----------------
       A rearrange toggle on a component's created-properties list (the DEFINE
       panel — .uniSettingComponentTmplProperties — not the per-instance value
       list). Drag mode reorders rows by pointer or arrow keys; on exit the new
       order is written back to the component's `componentTmplProperties` entity
       setting — real saveable data (unlike favourites' per-browser order), so it
       persists with the component. The permutation is captured from each row's
       original array index, recorded at drag-start, so no name-matching. */
    var dbePropStatus = null;

    var PROP_ROW_SEL = '.uniSettingComponentTmplProperties_item, .uniSettingComponentTmplProperties_itemEdit';

    /* The TOP-LEVEL created-properties list — never a select-option `_sublist`
       (which shares the `_list` class) and never a list nested inside a property
       row that is being edited. */
    function propList() {
        var lists = [].slice.call(document.querySelectorAll('ul.uniSettingComponentTmplProperties_list'));
        for (var i = 0; i < lists.length; i++) {
            var l = lists[i];
            if (l.classList.contains('uniSettingComponentTmplProperties_sublist')) { continue; }
            if (l.closest('.uniSettingComponentTmplProperties_item, .uniSettingComponentTmplProperties_itemEdit')) { continue; }
            return l;
        }
        return null;
    }
    /* Property rows — a row is `_item` normally, `_itemEdit` while it is being
       edited/expanded; both are top-level properties to reorder. */
    function propItems(list) {
        return [].slice.call(list.children).filter(function (li) {
            return li.classList && (li.classList.contains('uniSettingComponentTmplProperties_item') ||
                li.classList.contains('uniSettingComponentTmplProperties_itemEdit'));
        });
    }
    function propLabel(li) {
        var n = li.querySelector('.uniSettingComponentTmplProperties_itemName');
        return (n && (n.textContent || '').trim()) || 'property';
    }
    function propAnnounce(msg) {
        if (!dbePropStatus || !document.body.contains(dbePropStatus)) {
            dbePropStatus = document.createElement('div');
            dbePropStatus.className = 'dbe-visually-hidden';
            dbePropStatus.setAttribute('role', 'status');
            document.body.appendChild(dbePropStatus);
        }
        dbePropStatus.textContent = msg;
    }

    /* The entity's settings container (Builderius core: getEntitySettings ===
       state entity.settings). It may be an object keyed by setting name OR an
       array of {name, setting} — handle both. */
    function entitySettings() {
        try {
            var ent = store().storeGet('entity');
            if (ent && ent.settings) { return ent.settings; }
        } catch (e) {}
        return null;
    }
    function entitySetting(name) {
        var s = entitySettings();
        if (!s) { return undefined; }
        if (Array.isArray(s)) {
            var hit = s.filter(function (e) { return e && e.name === name; })[0];
            return hit ? hit.setting : undefined;
        }
        return s[name];
    }

    /* Read the created-properties array from entity settings; fall back to the
       React fiber props around the list. Returns null if unreachable. */
    function readComponentProps() {
        var v = entitySetting('componentTmplProperties');
        if (Array.isArray(v)) { return v; }
        var list = propList();
        if (!list) { return null; }
        try {
            var fk = Object.keys(list).find(function (k) { return k.indexOf('__reactFiber$') === 0; });
            var f = fk && list[fk];
            for (var i = 0; i < 12 && f; i++, f = f.return) {
                var p = f.memoizedProps;
                if (!p) { continue; }
                for (var key in p) {
                    var val = p[key];
                    if (Array.isArray(val) && val.length && val.every(function (it) {
                        return it && typeof it === 'object' && ('name' in it || 'label' in it || 'type' in it);
                    })) { return val; }
                }
            }
        } catch (e) {}
        return null;
    }

    /* Write the reordered array back through the builder's own setEntitySettings
       action — the exact channel core's duplicate/remove use:
       Xr("setEntitySettings", [{name:"componentTmplProperties", setting:e},
       {name:"dataVars", setting:i}], false). dataVars is passed through unchanged
       (a reorder doesn't alter it). VERIFY live that the dispatch persists. */
    function writeComponentProps(arr) {
        try {
            var payload = [{ name: 'componentTmplProperties', setting: arr }];
            var dv = entitySetting('dataVars');
            if (dv !== undefined) { payload.push({ name: 'dataVars', setting: dv }); }
            store().storeSet('setEntitySettings', payload, false);
            return true;
        } catch (e) { return false; }
    }

    function propPersistOrder(list) {
        var rows = propItems(list);
        var perm = rows.map(function (li) { return parseInt(li.getAttribute('data-dbe-prop-idx'), 10); });
        if (perm.some(function (v) { return isNaN(v); })) { return; }
        if (perm.every(function (v, i) { return v === i; })) { return; } // unchanged
        var old = readComponentProps();
        if (!old) { propAnnounce(dbeT('propSaveFailed', 'Order changed on screen, but it could not be saved to the component')); return; }
        var next = perm.map(function (idx) { return old[idx]; });
        if (next.some(function (x) { return x === undefined; }) || next.length !== old.length) { return; } // stale — don't corrupt
        if (!writeComponentProps(next)) { propAnnounce(dbeT('propSaveFailed', 'Order changed on screen, but it could not be saved to the component')); }
    }

    function setPropMode(list, onMode) {
        var container = list.closest('.uniSettingComponentTmplProperties') || list.parentNode;
        var btn = container && container.querySelector('.dbe-prop-reorder-btn');
        list.classList.toggle('dbe-prop-reordering', onMode);
        if (btn) { btn.setAttribute('aria-pressed', onMode ? 'true' : 'false'); }
        if (onMode) {
            // DOM order == array order on entry — record it for the permutation.
            // Builderius keeps exactly one property expanded (an "open" _itemEdit
            // row with no native collapse control); the CSS collapses it to a
            // uniform strip while reordering, but its header then reads a generic
            // "Property", so surface the real label on the name element for the
            // ::after relabel (see 24-properties-reorder.css).
            var props = readComponentProps() || [];
            propItems(list).forEach(function (li, i) {
                li.setAttribute('data-dbe-prop-idx', i);
                li.setAttribute('tabindex', '0');
                if (li.classList.contains('uniSettingComponentTmplProperties_itemEdit') && props[i]) {
                    var nm = li.querySelector('.uniSettingComponentTmplProperties_itemName');
                    if (nm) { nm.setAttribute('data-dbe-prop-label', props[i].label || props[i].name || dbeT('property', 'Property')); }
                }
            });
            propAnnounce(dbeT('propModeOn', 'Rearrange mode on: drag a property, or focus one and use the arrow keys'));
        } else {
            propPersistOrder(list);
            propItems(list).forEach(function (li) {
                li.removeAttribute('tabindex');
                var nm = li.querySelector('.uniSettingComponentTmplProperties_itemName[data-dbe-prop-label]');
                if (nm) { nm.removeAttribute('data-dbe-prop-label'); }
            });
            propAnnounce(dbeT('modeOffSaved', 'Rearrange mode off: order saved'));
        }
    }

    function bindPropDrag(list) {
        var drag = null;
        dbeBindOwnedEvent(DBE_EDITING_OWNER, list, 'properties-reorder-click', 'click', function (ev) {
            if (!list.classList.contains('dbe-prop-reordering')) { return; }
            if (ev.target.closest && ev.target.closest('.dbe-prop-reorder')) { return; }
            ev.preventDefault();
            ev.stopPropagation();
        }, true);
        dbeBindOwnedEvent(DBE_EDITING_OWNER, list, 'properties-reorder-pointerdown', 'pointerdown', function (ev) {
            if (!list.classList.contains('dbe-prop-reordering')) { return; }
            var li = ev.target.closest && ev.target.closest(PROP_ROW_SEL);
            if (!li) { return; }
            ev.preventDefault();
            ev.stopPropagation();
            drag = { li: li };
            li.classList.add('dbe-prop-dragging');
            try { ev.target.setPointerCapture(ev.pointerId); } catch (e) {}
        }, true);
        // rAF-gated for the same reason as the favourites drag above.
        var propRaf = 0, propY = 0;
        dbeBindOwnedEvent(DBE_EDITING_OWNER, list, 'properties-reorder-pointermove', 'pointermove', function (ev) {
            if (!drag) { return; }
            propY = ev.clientY;
            if (propRaf) { return; }
            propRaf = dbeSetOwnedFrame(DBE_EDITING_OWNER, function () {
                propRaf = 0;
                if (!drag) { return; } // drag ended before the frame
                var items = propItems(list).filter(function (it) { return it !== drag.li; });
                for (var i = 0; i < items.length; i++) {
                    var r = items[i].getBoundingClientRect();
                    if (propY >= r.top && propY <= r.bottom) {
                        var before = propY < r.top + r.height / 2;
                        list.insertBefore(drag.li, before ? items[i] : items[i].nextSibling);
                        break;
                    }
                }
            });
        }, true);
        function endDrag() {
            if (!drag) { return; }
            var li = drag.li;
            li.classList.remove('dbe-prop-dragging');
            drag = null;
            var items = propItems(list);
            propAnnounce(dbeFmt(dbeT('movedToPosition', 'Moved %1$s to position %2$s of %3$s'), propLabel(li), items.indexOf(li) + 1, items.length));
        }
        dbeBindOwnedEvent(DBE_EDITING_OWNER, list, 'properties-reorder-pointerup', 'pointerup', endDrag, true);
        dbeBindOwnedEvent(DBE_EDITING_OWNER, list, 'properties-reorder-pointercancel', 'pointercancel', endDrag, true);
        dbeBindOwnedEvent(DBE_EDITING_OWNER, list, 'properties-reorder-keys', 'keydown', function (ev) {
            if (!list.classList.contains('dbe-prop-reordering')) { return; }
            if (ev.key === 'Escape') {
                ev.preventDefault();
                ev.stopPropagation();
                setPropMode(list, false);
                var container = list.closest('.uniSettingComponentTmplProperties') || list.parentNode;
                var b = container && container.querySelector('.dbe-prop-reorder-btn');
                if (b) { b.focus(); }
                return;
            }
            if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') { return; }
            var li = ev.target.closest && ev.target.closest(PROP_ROW_SEL);
            if (!li) { return; }
            ev.preventDefault();
            ev.stopPropagation();
            var sib = ev.key === 'ArrowUp' ? li.previousElementSibling : li.nextElementSibling;
            if (!sib || !(sib.classList.contains('uniSettingComponentTmplProperties_item') ||
                sib.classList.contains('uniSettingComponentTmplProperties_itemEdit'))) { return; }
            list.insertBefore(li, ev.key === 'ArrowUp' ? sib : sib.nextSibling);
            var items = propItems(list);
            propAnnounce(dbeFmt(dbeT('movedToPosition', 'Moved %1$s to position %2$s of %3$s'), propLabel(li), items.indexOf(li) + 1, items.length));
            li.focus();
        }, true);
    }

    function ensurePropertiesReorder() {
        var list = propList();
        if (!list) { return; }
        bindPropDrag(list);
        var container = list.closest('.uniSettingComponentTmplProperties') || list.parentNode;
        if (!container || container.querySelector('.dbe-prop-reorder')) { return; }
        if (propItems(list).length < 2) { return; } // nothing to reorder
        var wrapEl = document.createElement('div');
        wrapEl.className = 'dbe-prop-reorder';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dbe-prop-reorder-btn';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('data-dbe-tip', dbeT('rearrangeProperties', 'Rearrange properties'));
        btn.innerHTML = '<svg width="10" height="14" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<circle cx="3" cy="2.5" r="1.3" fill="currentColor"/><circle cx="7" cy="2.5" r="1.3" fill="currentColor"/>' +
            '<circle cx="3" cy="7" r="1.3" fill="currentColor"/><circle cx="7" cy="7" r="1.3" fill="currentColor"/>' +
            '<circle cx="3" cy="11.5" r="1.3" fill="currentColor"/><circle cx="7" cy="11.5" r="1.3" fill="currentColor"/></svg>';
        var btnText = document.createElement('span');
        btnText.textContent = dbeT('rearrange', 'Rearrange');
        btn.appendChild(btnText);
        btn.addEventListener('click', function () {
            setPropMode(list, btn.getAttribute('aria-pressed') !== 'true');
        });
        wrapEl.appendChild(btn);
        var addBtn = container.querySelector('.uniSettingComponentTmplProperties_addNewBtn');
        if (addBtn && addBtn.parentNode) { addBtn.parentNode.insertBefore(wrapEl, addBtn); }
        else { container.insertBefore(wrapEl, container.firstChild); }
    }

    function dbeResetEditingHelpers() {
        if (dbeAttrSeededRow && dbeAttrSeededRow.isConnected) {
            dbeAttrSeededRow.classList.remove('dbe-attr-seeded');
            if (attrRowBlank(dbeAttrSeededRow)) { attrRemoveRow(dbeAttrSeededRow); }
        } else if (dbeAttrSeedOwned && dbeAttrSeededFor) {
            try { dbeRemoveBlankAttrs(dbeAttrSeededFor); } catch (e) {}
        }
        dbeAttrSeededRow = null;
        dbeAttrSeededFor = null;
        dbeAttrSeedOwned = false;
        var attrNames = document.getElementById('dbe-attr-names');
        if (attrNames) { attrNames.remove(); }

        var seededCondition = condSeedResolve();
        if (seededCondition) {
            seededCondition.classList.remove('dbe-cond-seeded');
            if (dbeCondSeedOwned && !dbeCondSeedEngaged && dbeCondSeededFor && condBlankOnly(dbeCondSeededFor)) {
                var remove = seededCondition.querySelector('.uniElementConditions_itemActions .uniIconButton');
                if (remove) { clickSeq(remove); }
            }
        } else if (dbeCondSeedOwned && !dbeCondSeedEngaged && dbeCondSeededFor) {
            try { dbeRemoveBlankCondition(dbeCondSeededFor); } catch (e2) {}
        }
        dbeCondSeededFor = null;
        dbeCondSeededCard = null;
        dbeCondViewWas = false;
        dbeCondSeedEngaged = false;
        dbeCondSeedOwned = false;
        document.querySelectorAll('.dbe-cond-dot, .dbe-cond-sr').forEach(function (node) { node.remove(); });
        document.querySelectorAll('.dbe-has-cond').forEach(function (node) { node.classList.remove('dbe-has-cond'); });

        document.querySelectorAll('.dbe-prop-reorder').forEach(function (node) { node.remove(); });
        document.querySelectorAll('.dbe-prop-reordering').forEach(function (list) {
            list.classList.remove('dbe-prop-reordering');
            propItems(list).forEach(function (item) {
                item.classList.remove('dbe-prop-dragging');
                item.removeAttribute('data-dbe-prop-idx');
                item.removeAttribute('tabindex');
                var label = item.querySelector('[data-dbe-prop-label]');
                if (label) { label.removeAttribute('data-dbe-prop-label'); }
            });
        });
        if (dbePropStatus) { dbePropStatus.remove(); }
        dbePropStatus = null;
    }

    /* (g) Double-click a Navigator row to rename it inline — a second entry point
       to startRename(), for users who expect double-click-to-rename from
       comparable tools. The two single-clicks that precede the double select the
       row (native); then the inline field opens on it. Needs 32-rename.css for the
       field styling, so the feature ships that CSS whether or not inline_rename
       (the context-menu entry point) is also on. */
    function bindDblclickRename() {
        dbeBindOwnedEvent(DBE_EDITING_OWNER, document, 'double-click-rename', 'dblclick', function (e) {
            var btn = e.target.closest && e.target.closest('.uniRightPanel .uniModTree__item');
            if (!btn) { return; }
            var m = btn.className.toString().match(/uni-tree-node-(\w+)/);
            if (!m) { return; }
            e.preventDefault();
            e.stopPropagation();
            startRename(m[1]);
        }, true);
    }

    var DBE_EDITING_OWNER = 'editing';
    var dbeEditingControllerActive = false;
    var NEED_EDITING = on('undo_delete') || on('image_defaults') || on('inline_rename') ||
        on('dblclick_rename') || on('keyboard_shortcuts') || on('command_palette') ||
        on('edit_as_html') || on('import_html') || on('auto_bem') || on('tag_change') ||
        on('wrap_in') || on('element_moves') || on('navigator_paste') ||
        on('save_shortcut') || on('save_state_cue') || on('condition_helpers') ||
        on('properties_reorder') || on('attr_helpers');

    function dbeObserveEditing() {
        dbeObserveChrome(
            'editing-top',
            (on('save_shortcut') || on('save_state_cue')) ? dbeQuery('topPanel') : null,
            { childList: true, subtree: true }
        );
        dbeObserveChrome(
            'editing-main',
            (on('save_state_cue') || on('condition_helpers') || on('properties_reorder') || on('attr_helpers'))
                ? dbeQuery('mainPanel') : null,
            {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['class', 'style']
            }
        );
    }

    function dbeRefreshEditing() {
        if (!dbeEditingControllerActive) { return; }
        dbeObserveEditing();
        if (on('save_shortcut')) { dbeEnsureSaveShortcutMetadata(); }
        if (on('save_state_cue')) { ensureSaveCue(); }
        if (on('condition_helpers')) { ensureConditionHelpers(); }
        if (on('properties_reorder')) { ensurePropertiesReorder(); }
        if (on('attr_helpers')) { ensureBlankAttrRow(); }
    }

    function destroyEditing() {
        dbeEditingControllerActive = false;
        dbeObserveChrome('editing-top', null);
        dbeObserveChrome('editing-main', null);
        closeRename(false, true);
        dbeRemovePriorHtmlDialog();
        dbeRemovePriorBemDialog();
        var toast = document.querySelector('.dbe-undo-toast');
        if (toast && toast.contains(document.activeElement)) { dbeEditingDialogFocusReturn(null); }
        if (toast) { toast.remove(); }
        toastTimer = null;
        toastDuration = 2600;
        undoStack = [];
        redoStack = [];
        dbeHistoryRestoredIds = {};
        dbeDestroyOwnedHooks(DBE_EDITING_OWNER);
        dbeDestroyOwnedActivity(DBE_EDITING_OWNER);
        dbeResetEditingHelpers();
        dbeRestoreOwnedAttributes(DBE_EDITING_OWNER);
        var cue = document.querySelector('.dbe-save-cue');
        if (cue) { cue.remove(); }
        dbeSaveTimer = null;
        dbeSavePending = null;
        dbeSaveState = '';
        dbeSaveLastStamp = 0;
        dbeSaveInitialisingUntil = 0;
        saveBaseline = null;
        saveBaselineSnapshot = null;
        saveSettingsBaseline = null;
        dbeSaveSnapshotItem = null;
        dbeSaveSnapshotSignature = null;
    }

    dbeControllers.register(DBE_EDITING_OWNER, {
        init: function (context) {
            if (!context || !context.builderius) { return; }
            dbeEditingControllerActive = true;
            if (on('undo_delete')) {
                hookHistoryCapture();
                bindUndoKeys();
            }
            if (on('image_defaults')) { hookImageDefaults(); }
            if (on('dblclick_rename')) { bindDblclickRename(); }
            if (on('save_shortcut')) { bindSaveShortcut(); }
            if (on('save_state_cue')) {
                hookSaveStatus();
                dbeBindOwnedEvent(DBE_EDITING_OWNER, document, 'save-button-click', 'click', dbeSaveButtonClick, true);
            }
            dbeRefreshEditing();
        },
        refresh: function (reason) {
            if (reason) { dbeRefreshEditing(); }
        },
        destroy: function () {
            destroyEditing();
        }
    }, NEED_EDITING);

        host.setEditingApi(Object.freeze({
            storeMoveModule: storeMoveModule, undoToast: undoToast, renameActive: renameActive,
            moveSibling: moveSibling, indent: indentElement, outdent: outdentElement, selectParent: selectParentOf,
            startRename: startRename, defaultLabel: defaultLabelFor, commitRename: commitRename, wrap: wrap, unwrap: unwrap,
            bemClassable: bemClassable, openAutoBem: openAutoBemDialog, indentTarget: dbeIndentTarget, canOutdent: dbeCanOutdent,
            htmlEditable: dbeHtmlEditable, openEditHtml: openEditHtmlDialog, openImportHtml: openImportHtmlDialog,
            htmlModules: DBE_HTML_MODULES, tagChoices: DBE_TAG_CHOICES, changeTagEligible: dbeChangeTagEligible,
            changeTag: dbeChangeTag, cleanTagInput: dbeCleanTagInput, insertSection: dbeInsertSection,
            insertSibling: dbeInsertSibling, elementModule: dbeElementModule, decodeEntities: dbeDecodeEntities,
            attributeBlocked: dbeAttrBlocked, updateModuleSettings: dbeUpdateModuleSettings, addClasses: dbeAddClasses,
            emmetParse: dbeEmmetParse, emmetStructureError: dbeEmmetStructureError, emmetInsert: dbeEmmetInsert,
            moveLocation: dbeMoveLocation, moduleClasses: moduleClasses,
            moduleTag: bemModuleTag, hasUnsavedChanges: dbeHasUnsavedChanges
        }));
    };

    window.dbeBuilderChunks = chunks;
}());
