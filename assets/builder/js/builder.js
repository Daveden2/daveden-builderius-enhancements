(function () {
    'use strict';

    /* Config printed by the plugin (includes/output-builder.php). Every feature
       is a toggle; helpers below are defined unconditionally (free), but
       WIRING — observers, listeners, hooks, DOM writes — only happens for
       enabled features. */
    var CFG = window.dbeBuilderEnhancements || {};
    var F = CFG.features || {};
    function on(id) { return !!F[id]; }

    /* Translations, supplied by PHP (includes/i18n-builder.php) on CFG.i18n.
       dbeT() falls back to the in-file English so a missing key never blanks a
       control; dbeFmt() resolves sprintf-style %s / %1$s placeholders; dbeTn()
       picks a One/Many key pair by count (English plural shape — see the
       PHP file header for the limitation). */
    var I18N = CFG.i18n || {};
    function dbeT(key, fallback) { return I18N[key] || fallback; }
    function dbeFmt(s) {
        var args = [].slice.call(arguments, 1), i = 0;
        return String(s).replace(/%(\d+\$)?s/g, function (m, n) {
            return String(n ? args[parseInt(n, 10) - 1] : args[i++]);
        });
    }
    function dbeTn(count, keyOne, fallbackOne, keyMany, fallbackMany) {
        return count === 1 ? dbeT(keyOne, fallbackOne) : dbeT(keyMany, fallbackMany);
    }

    var ROW_SEL = '.uniRightPanel .uniModTree__item';
    var KEEP_ICON = /Collection|Template/i; // module .name values whose icon we keep
    var lastCtxId = null;

    function store() { return window.__builderiusStoreFns; }
    function modules() { try { return store().storeGet('modules'); } catch (e) { return null; } }
    function activeId() { try { return store().storeGet('activeModule'); } catch (e) { return null; } }

    /* The site's breakpoints, [{name:'--tablet', label:'Tablet', width:991}]
       in top-bar button order (base first, width:null for the base entry).
       The list lives nowhere in the store (probed) — it is only reachable via
       the React fiber props around .uniGlobalBreakpoints, where the Media
       Queries modal receives items:[{label,name,width,…}] (the base entry uses
       a huge sentinel width). Bounded scan, null on any failure — callers keep
       a hard-coded fallback. */
    function dbeBreakpoints() {
        try {
            var host = document.querySelector('.uniGlobalBreakpoints');
            if (!host) { return null; }
            var fk = Object.keys(host).find(function (k) { return k.indexOf('__reactFiber$') === 0; });
            if (!fk) { return null; }
            var found = null;
            function scan(val, depth) {
                if (found || !val || depth > 10) { return; }
                if (Array.isArray(val)) {
                    if (val.length && val.length < 20 && val.every(function (it) {
                        return it && typeof it === 'object' &&
                            typeof it.width === 'number' && typeof it.label === 'string' && 'name' in it;
                    })) { found = val; return; }
                    for (var j = 0; j < val.length && !found; j++) { scan(val[j], depth + 1); }
                    return;
                }
                if (typeof val === 'object') {
                    if (val.items) { scan(val.items, depth + 1); }
                    if (val.props) { scan(val.props, depth + 1); }
                    if (val.children) { scan(val.children, depth + 1); }
                }
            }
            var f = host[fk];
            for (var i = 0; i < 12 && f && !found; i++, f = f.return) {
                scan(f.memoizedProps, 0);
            }
            if (!found) { return null; }
            return found.map(function (it) {
                return {
                    name: it.name || '',
                    label: it.label || '',
                    width: (it.width && it.width < 100000) ? it.width : null
                };
            });
        } catch (e) { return null; }
    }

    /* (a) tag + label, (b) keep-icon flag, (c) selected-row accent flag —
       each part gated on its own toggle. */
    function decorateTree() {
        var iframe = document.getElementById('builderInner');
        var idoc = iframe && iframe.contentDocument;
        var mods = modules();
        var sel = activeId();

        document.querySelectorAll(ROW_SEL).forEach(function (btn) {
            var idMatch = btn.className.toString().match(/uni-tree-node-(\w+)/);
            if (!idMatch) { return; }
            var id = idMatch[1];

            // Selected-row accent treatment (see .dbe-tree-selected in the CSS).
            if (on('tree_row_styling')) {
                btn.classList.toggle('dbe-tree-selected', !!sel && id === sel);
            }
            if (on('multi_select')) {
                btn.classList.toggle('dbe-multi-selected', dbeMultiSel.has(id));
            }

            // Keep-icon flag for Collection / Template module types
            if (on('icon_declutter')) {
                if (mods && mods[id] && KEEP_ICON.test(mods[id].name || '')) {
                    btn.classList.add('dbe-keep-icon');
                } else {
                    btn.classList.remove('dbe-keep-icon');
                }
            }

            // Tag badge (only for elements that map to a canvas node with a real tag)
            if (!on('tag_badges')) { return; }
            var span = btn.querySelector('span');
            if (!span || span.querySelector('.dbe-tag-badge')) { return; }
            if (!idoc) { return; }
            var canvasEl = idoc.querySelector('.uni-node-' + id);
            if (!canvasEl) { return; }

            var tag = canvasEl.tagName.toLowerCase();
            var raw = span.textContent.trim();
            var idx = raw.indexOf(' .');
            var label = idx >= 0 ? raw.slice(0, idx) : raw;

            var badge = document.createElement('span');
            badge.className = 'dbe-tag-badge';
            badge.textContent = '<' + tag + '>';
            span.textContent = '';
            span.appendChild(badge);
            if (label && label.toLowerCase() !== tag) {
                span.appendChild(document.createTextNode(' ' + label));
            }
        });
    }

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
        var ids = (idsOpt && idsOpt.length ? idsOpt : [lastCtxId || sf.storeGet('activeModule')])
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
        // defaults (verified against 1.3.5-beta). A Collection only renders its
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
    function dbeMakeId() {
        return 'u' + Array.from({ length: 9 }, function () {
            return Math.floor(Math.random() * 16).toString(16);
        }).join('');
    }

    /* Build an HtmlElement module object for a tag, with optional classes/id/text.
       Mirrors the native insert shape used by wrap() — the tag lives in a `tag`
       setting, classes in a `tagClass` array setting. (id/text handling for the
       Emmet palette is resolved in phase 3 against the live settings shape.) */
    function dbeElementModule(tag, opts) {
        opts = opts || {};
        var settings = [{ name: 'tag', value: tag }];
        // Verified live: addModule renders text from a `content` setting, classes
        // from `tagClass`, and the id/attributes from an `htmlAttribute` list — so a
        // fully-formed element (Emmet included) inserts in one call, no native
        // class/attr driving.
        if (opts.text != null && opts.text !== '') { settings.push({ name: 'content', value: opts.text }); }
        if (opts.classes && opts.classes.length) { settings.push({ name: 'tagClass', value: opts.classes.slice() }); }
        if (opts.id) { settings.push({ name: 'htmlAttribute', value: [{ name: 'id', value: opts.id }] }); }
        var label = tag.charAt(0).toUpperCase() + tag.slice(1);
        return { id: dbeMakeId(), name: 'HtmlElement', label: label, settings: settings };
    }

    /* Minimal Emmet parser (command_palette): tag, .class, #id, > child, + sibling,
       * multiply, {text}. No grouping (), climb-up ^, numbering $ or [attr].
       Returns an array of root nodes {tag,id,classes,text,count,children}; throws
       (a plain value) on a parse error. */
    function dbeEmmetParse(str) {
        var s = (str || '').trim();
        var i = 0;
        function parseElement() {
            var node = { tag: '', id: '', classes: [], text: null, count: 1, children: [] };
            var tm = /^[A-Za-z][A-Za-z0-9]*/.exec(s.slice(i));
            if (tm) { node.tag = tm[0]; i += tm[0].length; }
            while (i < s.length) {
                var c = s[i];
                if (c === '#') {
                    i++; var im = /^[A-Za-z0-9_-]+/.exec(s.slice(i)); if (!im) { throw 0; }
                    node.id = im[0]; i += im[0].length;
                } else if (c === '.') {
                    i++; var cm = /^[A-Za-z0-9_-]+/.exec(s.slice(i)); if (!cm) { throw 0; }
                    node.classes.push(cm[0]); i += cm[0].length;
                } else if (c === '{') {
                    var end = s.indexOf('}', i); if (end < 0) { throw 0; }
                    node.text = s.slice(i + 1, end); i = end + 1;
                } else { break; }
            }
            if (!node.tag && !node.classes.length && !node.id && node.text == null) { throw 0; }
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

    function dbeEmmetNodeToModule(node) {
        var tag = node.tag || ((node.text != null && !node.classes.length && !node.id) ? 'span' : 'div');
        return dbeElementModule(tag, { classes: node.classes, id: node.id, text: node.text });
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
       (cloned) settings array to modify. Returns false if the id is gone. */
    function dbeUpdateModuleSettings(id, mutate) {
        var sf = store();
        var mods = sf.storeGet('modules') || {};
        if (!mods[id]) { return false; }
        var updated = JSON.parse(JSON.stringify(mods[id]));
        updated.settings = updated.settings || [];
        mutate(updated.settings);
        sf.storeSet('addModule', { module: updated });
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
        });
    }

    /* (d1) Move the target element up or down among its siblings via the builder's
       own move action (the repaint-and-persist channel). `to` is the desired final
       position in the sibling order; if a Builderius version treats newIndex as
       pre-removal instead, adjust the down case here. Selection is by id, so the
       row stays selected as it moves — no reselect needed. */
    function moveSibling(id, dir) {
        if (dbeUndoBusy) { return; }
        var sf = store();
        var mods = sf.storeGet('modules') || {};
        if (!mods[id]) { return; }
        var parent = mods[id].parent || '';
        var idx = sf.storeGet('indexes') || {};
        var sibs = idx[parent || 'root'] ? [].concat(idx[parent || 'root']) : [];
        var at = sibs.indexOf(id);
        if (at < 0) { return; }
        var to = at + dir;
        if (to < 0 || to >= sibs.length) { return; }
        storeMoveModule(sf, id, parent, to);
        undoToast(dbeFmt(dir < 0 ? dbeT('movedUp', 'Moved “%s” up') : dbeT('movedDown', 'Moved “%s” down'),
            mods[id].label || dbeT('element', 'element')));
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

    function closeRename(commit) {
        var st = renameState;
        if (!st) { return; }
        renameState = null;
        var next = (st.input.value || '').trim();
        st.input.remove();
        st.wrapper.classList.remove('dbe-renaming');
        if (st.li) { st.li.setAttribute('draggable', st.prevDraggable); }
        if (!commit) { return; }
        if (!next) { next = defaultLabelFor(st.id); } // emptied field = reset to default
        if (next && next !== st.oldLabel) { commitRename(st.id, next); }
    }

    function commitRename(id, label) {
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
            prevDraggable: li ? (li.getAttribute('draggable') || 'true') : 'true'
        };

        // Keystrokes must not reach the builder's shortcuts (Delete removes the
        // module!), and pointer events must not select the row or start a drag.
        input.addEventListener('keydown', function (ev) {
            ev.stopPropagation();
            if (ev.key === 'Enter') { ev.preventDefault(); closeRename(true); }
            else if (ev.key === 'Escape') { ev.preventDefault(); closeRename(false); }
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

    /* The subtree in tree order (module-map key order = sibling order). */
    function bemCollectRows(rootId) {
        var mods = modules() || {};
        var iframe = document.getElementById('builderInner');
        var idoc = iframe && iframe.contentDocument;
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
            Object.keys(mods).forEach(function (k) {
                if ((mods[k].parent || '') === id) { walk(k, depth + 1); }
            });
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

    function openAutoBemDialog(rootId) {
        if (dbeBemBusy) { return; }
        var rows = bemCollectRows(rootId);
        if (!rows.length || !rows[0].supported) { return; }

        var old = document.querySelector('dialog.dbe-bem');
        if (old) { old.remove(); }
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
        dlg.addEventListener('keydown', function (e) { e.stopPropagation(); });
        ['pointerdown', 'mousedown', 'click'].forEach(function (t) {
            dlg.addEventListener(t, function (e) { e.stopPropagation(); });
        });
        dlg.addEventListener('close', function () { dlg.remove(); });
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

    /* (d2b) Multi-select in the Navigator: Cmd+click (Mac) / Ctrl+click
       (elsewhere) toggles a row in the selection, Shift+click selects a range
       from the anchor (last toggled row, falling back to the builder's
       selection). On a Mac, Ctrl+click is the system right-click gesture and
       must stay one — only the Command key toggles there. The builder itself
       has no multi-select state at all (activeModule is a single id), so this
       is our own layer: a Set of ids painted via decorateTree (survives React
       re-renders), with modifier-clicks swallowed before the builder can turn
       them into a single-selection change. Plain click or Escape clears it.
       The context menu adapts: single-target items are disabled while a
       multi-selection is active; "Wrap in" wraps all selected siblings and
       "Remove N elements" deletes them all (each capture-undoable). Dragging
       a selected row brings the rest of the selection along (see the
       multi-drag block below). */
    var dbeMultiSel = new Set();
    var dbeMultiAnchor = null;
    // Case-insensitive: userAgentData reports "macOS", navigator.platform "MacIntel".
    var dbeIsMac = /mac|ip(hone|ad|od)/i.test(
        (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''
    );

    /* Platform-formatted accelerator label for a shortcut hint. `o.cmd` is the
       primary modifier (Cmd on Mac, Ctrl elsewhere); `o.alt`/`o.shift` the rest.
       Mac uses the glyph stack in Apple's order (⌃⌥⇧⌘) with no separators; other
       platforms use "Ctrl+Alt+Shift+Key". Purely presentational — the shortcuts
       overlay remains the authoritative reference. */
    function dbeAccel(key, o) {
        o = o || {};
        if (dbeIsMac) {
            return (o.ctrl ? '⌃' : '') + (o.alt ? '⌥' : '') + (o.shift ? '⇧' : '') + (o.cmd ? '⌘' : '') + key;
        }
        var p = [];
        if (o.cmd || o.ctrl) { p.push('Ctrl'); }
        if (o.alt) { p.push('Alt'); }
        if (o.shift) { p.push('Shift'); }
        p.push(key);
        return p.join('+');
    }

    function clearMultiSel() {
        if (!dbeMultiSel.size) { return; }
        dbeMultiSel.clear();
        dbeMultiAnchor = null;
        schedule();
    }

    function domRowIds() {
        return [].slice.call(document.querySelectorAll('.uniRightPanel .uniModTree__item')).map(function (b) {
            var m = b.className.toString().match(/uni-tree-node-(\w+)/);
            return m ? m[1] : null;
        }).filter(Boolean);
    }

    function toggleMultiSel(id) {
        // Seed with the current single selection so Cmd+click extends it.
        if (!dbeMultiSel.size) {
            var act = activeId();
            if (act && act !== id) { dbeMultiSel.add(act); }
        }
        if (dbeMultiSel.has(id)) { dbeMultiSel.delete(id); } else { dbeMultiSel.add(id); }
        dbeMultiAnchor = id;
        schedule();
    }

    function rangeMultiSel(id) {
        var anchor = dbeMultiAnchor || activeId();
        if (!anchor || anchor === id) { toggleMultiSel(id); return; }
        var order = domRowIds();
        var a = order.indexOf(anchor), b = order.indexOf(id);
        if (a === -1 || b === -1) { toggleMultiSel(id); return; }
        if (a > b) { var t = a; a = b; b = t; }
        for (var i = a; i <= b; i++) { dbeMultiSel.add(order[i]); }
        dbeMultiAnchor = id;
        schedule();
    }

    /* The multi-selection the open context menu should act on: only when the
       right-clicked row is part of it. Returned in module-map order (= sibling
       order). */
    function multiCtxIds() {
        if (dbeMultiSel.size < 2 || !lastCtxId || !dbeMultiSel.has(lastCtxId)) { return null; }
        var mods = modules() || {};
        return Object.keys(mods).filter(function (id) { return dbeMultiSel.has(id); });
    }

    function disableCtxItem(li) {
        if (li.classList.contains('dbe-ctx-disabled')) { return; }
        li.classList.add('disabled', 'dbe-ctx-disabled');
        li.setAttribute('aria-disabled', 'true');
        // Native items' React handlers sit on ancestor containers — stopping
        // propagation at the item blocks them without touching the handlers.
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (t) {
            li.addEventListener(t, function (ev) { ev.preventDefault(); ev.stopPropagation(); }, true);
        });
    }

    /* Delete every selected element through the native menu channel (each one
       fires Module.deleted, so each is individually undoable with Cmd+Z).
       Rows deleted along with a selected ancestor are skipped. */
    function removeMulti(ids, doneMsg) {
        var i = 0, removed = 0, retried = false;
        function next() {
            if (i >= ids.length) {
                undoToast(doneMsg || dbeFmt(dbeTn(removed,
                    'removedElementsOne', 'Removed %s element (Cmd+Z restores one at a time)',
                    'removedElementsMany', 'Removed %s elements (Cmd+Z restores one at a time)'), removed));
                return;
            }
            var id = ids[i];
            if (!document.querySelector('.uniRightPanel .uni-tree-node-' + id)) { i += 1; retried = false; next(); return; }
            driveContextMenuItem(id, 'Remove', function (ok) {
                if (ok) { removed += 1; i += 1; retried = false; }
                else if (!retried) { retried = true; } // one retry — the first menu can race the closing user menu
                else { i += 1; retried = false; }
                setTimeout(next, 300);
            });
        }
        // Give the user's own menu a beat to finish closing before auto-driving.
        setTimeout(next, 300);
    }

    /* Multi-drag: dragging one row of a multi-selection brings the rest along.
       The builder's own drag-and-drop is a REAL move channel — a synthetic
       dragstart → dragover → drop sequence with a shared DataTransfer goes
       through the native drop handler exactly like a hand drag (repaints tree
       + canvas, keeps ids, persists on Save). So: let the hand-dragged row
       land wherever the user dropped it, then walk each remaining selected
       row into place directly after it, preserving Navigator order. */
    var dbeMultiDrag = null;
    var dbeAutoDragging = false;

    /* The selection in Navigator order, minus the dragged row and minus rows a
       selected ancestor already carries along. */
    function multiDragIds(draggedId) {
        var mods = modules() || {};
        function carried(id) {
            var p = mods[id] ? mods[id].parent : '';
            while (p) {
                if (dbeMultiSel.has(p)) { return true; }
                p = mods[p] ? mods[p].parent : '';
            }
            return false;
        }
        return domRowIds().filter(function (id) {
            return dbeMultiSel.has(id) && id !== draggedId && !carried(id);
        });
    }

    /* Bring the rest of the selection in beside the hand-dragged row. An earlier
       build drove a synthetic drag per follower and read Builderius's drop
       indicator to place it — but that indicator only ever resolves to
       DROP_INSIDE on a container row and DROP_AFTER on a leaf row (probed against
       1.3.5-beta, 6 Jul 2026); DROP_BEFORE never appears, so "place before the
       next sibling" could not match and the follower silently stayed put — the
       "drag into another parent leaves the rest behind" bug. The move store
       action places by parent + index directly, with no drop-zone guessing, so
       every follower lands deterministically wherever the dragged row ended up. */
    function moveRestOfSelection(st) {
        var sf = store();
        var mods = modules() || {};
        var dragged = mods[st.draggedId];
        if (!sf || !dragged) { return; }
        var newParent = dragged.parent || '';
        var order = sf.storeGet('indexes') || {};
        var siblings = order[newParent || 'root'] ? [].concat(order[newParent || 'root']) : [];
        var base = siblings.indexOf(st.draggedId);
        if (base < 0) { base = siblings.length - 1; }

        var moved = 0, failed = 0;
        // st.ids is in Navigator order; drop each just after the dragged row,
        // keeping their relative order (base+1, base+2, …).
        st.ids.forEach(function (id, k) {
            if (!mods[id]) { failed += 1; return; }
            try { storeMoveModule(sf, id, newParent, base + 1 + k); moved += 1; }
            catch (e) { failed += 1; }
        });

        clearMultiSel();
        var total = moved + 1; // + the hand-dragged row
        undoToast(failed
            ? dbeFmt(dbeTn(total,
                'movedSomeFailedOne', 'Moved %1$s element (%2$s could not follow)',
                'movedSomeFailedMany', 'Moved %1$s elements (%2$s could not follow)'), total, failed)
            : dbeFmt(dbeT('movedTogether', 'Moved %s elements together'), total));
    }

    function bindMultiDrag() {
        document.addEventListener('dragstart', function (e) {
            if (dbeAutoDragging) { return; }
            dbeMultiDrag = null;
            if (dbeMultiSel.size < 2) { return; }
            // dragstart fires on the row's <li.uniModTree__itemDrag> (the react-dnd
            // drag source); the .uniModTree__item button that carries the
            // uni-tree-node-<id> class is a DESCENDANT of it, so closest() walking
            // UP the tree never reaches it. Take the button off the drag source's
            // own subtree instead (its own row button is first in document order,
            // ahead of any nested child rows).
            var btn = e.target.closest && e.target.closest('.uniRightPanel .uniModTree__item');
            if (!btn) {
                var src = e.target.closest && e.target.closest('.uniRightPanel li.uniModTree__itemDrag');
                btn = src && src.querySelector('.uniModTree__item');
            }
            if (!btn) { return; }
            var m = btn.className.toString().match(/uni-tree-node-(\w+)/);
            if (!m || !dbeMultiSel.has(m[1])) { return; }
            var mods = modules() || {};
            dbeMultiDrag = {
                draggedId: m[1],
                ids: multiDragIds(m[1]),
                dropped: false,
                // Where the row started — if the drop leaves it unmoved (or the
                // builder rejected it), don't gather the others around it.
                fromParent: mods[m[1]] ? mods[m[1]].parent : '',
                fromIndex: domRowIds().indexOf(m[1])
            };
        }, true);
        document.addEventListener('drop', function (e) {
            if (dbeAutoDragging || !dbeMultiDrag) { return; }
            dbeMultiDrag.dropped = !!(e.target.closest && e.target.closest('.uniRightPanel'));
        }, true);
        document.addEventListener('dragend', function () {
            if (dbeAutoDragging) { return; }
            var st = dbeMultiDrag;
            dbeMultiDrag = null;
            if (!st || !st.dropped || !st.ids.length) { return; }
            // Let the builder finish the hand-dragged row's own move first.
            setTimeout(function () {
                var mods = modules() || {};
                var parentNow = mods[st.draggedId] ? mods[st.draggedId].parent : null;
                if (parentNow === null) { return; } // row gone — bail
                if (parentNow === st.fromParent && domRowIds().indexOf(st.draggedId) === st.fromIndex) { return; }
                moveRestOfSelection(st);
            }, 350);
        }, true);
    }

    function bindMultiSelect() {
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (t) {
            document.addEventListener(t, function (e) {
                var btn = e.target.closest && e.target.closest('.uniRightPanel .uniModTree__item');
                if (!btn) { return; }
                var mod = dbeIsMac ? e.metaKey : (e.ctrlKey || e.metaKey), sh = e.shiftKey;
                if (!mod && !sh) {
                    if (t === 'click') { clearMultiSel(); } // plain click = single selection again
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                if (t !== 'pointerdown') { return; } // act once per gesture, swallow the rest
                var m = btn.className.toString().match(/uni-tree-node-(\w+)/);
                if (!m) { return; }
                if (sh && !mod) { rangeMultiSel(m[1]); } else { toggleMultiSel(m[1]); }
            }, true);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape' || !dbeMultiSel.size) { return; }
            if (document.querySelector('dialog.uniBuilderContextMenu[open]') || renameActive()) { return; }
            var t = e.target;
            if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], .monaco-editor')) { return; }
            clearMultiSel();
        }, true);
    }

    /* (d3) Undo/redo — Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z — for element ADDS and
       DELETES. Builderius records history but consumes none of it, and a raw
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
       Restored elements get a new id (paste regenerates them) and are appended
       last, so position is not preserved and a re-add whose parent was itself
       restored can fail. Moves and property edits are not covered (no repaint
       channel for them). The user's clipboard is saved/restored around the
       forgery where the browser allows reading it. */
    var undoStack = [];
    var redoStack = [];
    var dbeUndoBusy = false;
    var toastTimer = null;

    function undoToast(msg) {
        var t = document.querySelector('.dbe-undo-toast');
        if (!t) {
            t = document.createElement('div');
            t.className = 'dbe-undo-toast';
            t.setAttribute('role', 'status'); // polite live region for SRs
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove('is-visible'); }, 2600);
    }

    // Collect the subtree rooted at id from a modules map, reparenting the root
    // to '' (the shape native Paste expects in the forged clipboard).
    function dbeCollectSubtree(mods, id) {
        var subtree = {};
        (function collect(x) {
            subtree[x] = JSON.parse(JSON.stringify(mods[x]));
            Object.keys(mods).forEach(function (k) { if (mods[k].parent === x) { collect(k); } });
        })(id);
        subtree[id].parent = '';
        return subtree;
    }

    // Push a user action onto the undo stack; a fresh action invalidates redo.
    function dbeHistoryPush(rec) {
        undoStack.push(rec);
        if (undoStack.length > 10) { undoStack.shift(); }
        redoStack = [];
    }

    function hookHistoryCapture() {
        try {
            var api = window.Builderius.API.hooks;
            // DELETE: the element is already gone from the live store, so rebuild
            // its subtree from the most recent history snapshot that still holds
            // it. Undo re-adds it, hence op:'restore'.
            api.addAction('builderius.Module.deleted', 'dbeUndoCaptureDel', function (p) {
                if (dbeUndoBusy || !p || !p.id) { return; }
                var hist;
                try { hist = store().storeGet('history') || []; } catch (e) { return; }
                var snapMods = null;
                for (var i = hist.length - 1; i >= 0; i--) {
                    var sm = hist[i].snapshot && hist[i].snapshot.modules;
                    if (sm && sm[p.id]) { snapMods = sm; break; }
                }
                if (!snapMods) { return; }
                dbeHistoryPush({
                    op: 'restore',
                    id: p.id,
                    label: snapMods[p.id].label || snapMods[p.id].name || dbeT('element', 'element'),
                    parentId: snapMods[p.id].parent || '',
                    subtree: dbeCollectSubtree(snapMods, p.id)
                });
            });
            // ADD: undo removes it, hence op:'remove'. The subtree needed to
            // re-add it on redo is snapshotted from the live store at undo time
            // (the element still exists then), so only the id + label are stored.
            api.addAction('builderius.Module.added', 'dbeUndoCaptureAdd', function (p) {
                if (dbeUndoBusy || !p || !p.id) { return; }
                var m = (modules() || {})[p.id];
                dbeHistoryPush({
                    op: 'remove',
                    id: p.id,
                    label: (m && (m.label || m.name)) || dbeT('element', 'element'),
                    parentId: (m && m.parent) || ''
                });
            });
        } catch (e) {}
    }

    /* Open a row's native context menu invisibly and activate one item. */
    function driveContextMenuItem(rowId, itemText, cb) {
        var row = document.querySelector('.uniRightPanel .uni-tree-node-' + rowId);
        if (!row) { cb(false); return; }
        document.documentElement.classList.add('dbe-auto-ctx');
        row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
        waitFor(function () {
            var d = document.querySelector('dialog.uniBuilderContextMenu[open]');
            if (!d) { return null; }
            return [].slice.call(d.querySelectorAll('li.uniContextMenu__item')).find(function (li) {
                return (li.textContent || '').trim() === itemText;
            }) || null;
        }, function (item) {
            if (!item) {
                document.documentElement.classList.remove('dbe-auto-ctx');
                try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
                cb(false);
                return;
            }
            clickSeq(item);
            setTimeout(function () {
                try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
                document.documentElement.classList.remove('dbe-auto-ctx');
                cb(true);
            }, 120);
        });
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
            version: { 'builderius': '1.3.5-beta', 'builderius-pro': '1.3.5-beta' },
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
    function dbeRunHistory(from, to, emptyKey, emptyDef) {
        if (dbeUndoBusy) { return; }
        var rec = from.pop();
        if (!rec) { undoToast(dbeT(emptyKey, emptyDef)); return; }
        if (rec.op === 'restore') {
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
                undoToast(dbeFmt(dbeT('restored', 'Restored “%s”'), rec.label));
            });
        } else { // 'remove'
            var mods = modules() || {};
            if (!mods[rec.id] || !document.querySelector('.uniRightPanel .uni-tree-node-' + rec.id)) {
                undoToast(dbeFmt(dbeT('cannotRemoveGone', 'Cannot undo: “%s” is no longer here'), rec.label));
                return;
            }
            // Snapshot the live subtree first so the inverse can re-add it.
            var subtree = dbeCollectSubtree(mods, rec.id);
            var parentId = mods[rec.id].parent || '';
            dbeUndoBusy = true;
            driveContextMenuItem(rec.id, 'Remove', function (ok) {
                setTimeout(function () {
                    dbeUndoBusy = false;
                    if (!ok) { from.push(rec); undoToast(dbeT('undoFailedRemove', 'Undo failed: could not remove the element')); return; }
                    to.push({ op: 'restore', id: rec.id, label: rec.label, parentId: parentId, subtree: subtree });
                    undoToast(dbeFmt(dbeT('removed', 'Removed “%s”'), rec.label));
                }, 300);
            });
        }
    }

    function performUndo() { dbeRunHistory(undoStack, redoStack, 'nothingToUndo', 'Nothing to undo'); }
    function performRedo() { dbeRunHistory(redoStack, undoStack, 'nothingToRedo', 'Nothing to redo'); }

    function bindUndoKeys() {
        document.addEventListener('keydown', function (e) {
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

    /* --- "Wrap in" / "Save to" submenus in the native tree context menu --- */
    var submenuCloseTimer = null;

    function removeSubmenus() {
        document.querySelectorAll('.dbe-ctx-submenu').forEach(function (el) { el.remove(); });
        document.querySelectorAll('.dbe-ctx-parent[aria-expanded="true"]').forEach(function (li) {
            li.setAttribute('aria-expanded', 'false');
        });
    }

    function positionFlyout(fly, parentLi) {
        var pr = parentLi.getBoundingClientRect();
        var fw = fly.offsetWidth || 176;
        var fh = fly.offsetHeight || 120;
        var left = pr.right + 2;
        if (left + fw > window.innerWidth - 8) { left = pr.left - fw - 2; } // flip to the left near the edge
        if (left < 8) { left = 8; }
        var top = pr.top - 6;
        if (top + fh > window.innerHeight - 8) { top = window.innerHeight - fh - 8; }
        if (top < 8) { top = 8; }
        fly.style.setProperty('left', left + 'px', 'important');
        fly.style.setProperty('top', top + 'px', 'important');
    }

    /* The native menu is a position:fixed <dialog> whose top/left Builderius
       computes from the click point BEFORE our extra rows exist (it has no
       max-height and never re-measures). Once we've appended items it can run
       past the bottom of the viewport, clipping the lower rows — the reported
       bug. Re-clamp it into view (shift up, as positionFlyout already does for
       flyouts) and, when it is genuinely taller than the viewport, cap the
       height and let the list scroll. Wrap in / Save to flyouts are appended
       inside the dialog but are position:fixed, so their containing block is
       the viewport and the dialog's overflow never clips them. */
    function fitContextMenu(dialog) {
        if (!dialog) { return; }
        var margin = 8;
        var avail = window.innerHeight - margin * 2;
        // Drop any cap left from a previous open so we measure the natural height.
        dialog.style.removeProperty('max-height');
        dialog.style.removeProperty('overflow-y');
        var h = dialog.offsetHeight; // forces reflow — rows are already appended
        var top = parseFloat(dialog.style.top);
        if (isNaN(top)) { top = dialog.getBoundingClientRect().top; }
        if (h > avail) {
            top = margin;
            dialog.style.maxHeight = avail + 'px';
            dialog.style.overflowY = 'auto';
        } else if (top + h > window.innerHeight - margin) {
            top = window.innerHeight - h - margin;
        }
        if (top < margin) { top = margin; }
        dialog.style.top = top + 'px';
    }

    function makeFlyout(items) {
        // Rebuild the native menu wrapper chain so the flyout inherits the card
        // styling and the .uniContextMenu list/item resets.
        var fly = document.createElement('div');
        fly.className = 'uniBuilderContextMenu dbe-ctx-submenu';
        var inner = document.createElement('div');
        inner.className = 'uniBuilderContextMenu__inner';
        var menu = document.createElement('div');
        menu.className = 'uniContextMenu';
        menu.setAttribute('role', 'menu');
        var ul = document.createElement('ul');
        items.forEach(function (li) {
            li.tabIndex = -1; // roving tabindex — the keydown handler moves focus
            ul.appendChild(li);
        });
        menu.appendChild(ul);
        inner.appendChild(menu);
        fly.appendChild(inner);
        fly.addEventListener('mouseenter', function () { clearTimeout(submenuCloseTimer); });
        fly.addEventListener('mouseleave', function () { submenuCloseTimer = setTimeout(removeSubmenus, 180); });
        return fly;
    }

    var lastFlyoutParent = null;

    function makeParent(labelText, first, itemsFactory, disabled) {
        var li = document.createElement('li');
        li.className = 'uniContextMenu__item dbe-ctx-item dbe-ctx-parent' + (first ? ' dbe-ctx-item--first' : '');
        li.setAttribute('role', 'menuitem');
        li.setAttribute('aria-haspopup', 'true');
        li.setAttribute('aria-expanded', 'false');
        var label = document.createElement('span');
        label.textContent = labelText;
        var caret = document.createElement('span');
        caret.className = 'dbe-ctx-caret';
        caret.textContent = '›'; // ›
        li.appendChild(label);
        li.appendChild(caret);
        if (disabled) {
            li.classList.add('disabled', 'dbe-ctx-disabled');
            li.setAttribute('aria-disabled', 'true');
            return li; // no flyout wiring: not hoverable, not keyboard-openable
        }
        function openFlyout() {
            clearTimeout(submenuCloseTimer);
            removeSubmenus();
            var fly = makeFlyout(itemsFactory());
            // The native menu is a <dialog> shown with showModal(): it paints in
            // the top layer (above any z-index) and everything OUTSIDE it is
            // inert. A sibling flyout is therefore visible but can never receive
            // a hover or click — the close timer always wins. Appending INSIDE
            // the dialog puts the flyout in the modal subtree: hoverable,
            // focusable, and painted in the top layer with the menu. The dialog
            // has no transform/filter, so position:fixed stays viewport-based.
            var nativeMenu = document.querySelector('.uniBuilderContextMenu:not(.dbe-ctx-submenu)');
            var host = nativeMenu || document.body;
            host.appendChild(fly);
            positionFlyout(fly, li);
            li.setAttribute('aria-expanded', 'true');
            lastFlyoutParent = li;
            return fly;
        }
        li._dbeOpenFlyout = openFlyout; // keyboard channel (Enter / ArrowRight)
        li.addEventListener('mouseenter', openFlyout);
        li.addEventListener('mouseleave', function () {
            submenuCloseTimer = setTimeout(removeSubmenus, 180);
        });
        return li;
    }

    /* A plain injected leaf item. Mirrors the inline Rename / Auto-BEM pattern:
       mousedown closes the menu, then runs the action. A disabled item renders
       greyed and non-interactive, and stays out of the keyboard focus ring
       (menuScopeItems skips aria-disabled rows). */
    function makeCtxItem(labelText, onActivate, opts) {
        opts = opts || {};
        var li = document.createElement('li');
        li.className = 'uniContextMenu__item dbe-ctx-item';
        li.setAttribute('role', 'menuitem');
        li.textContent = labelText;
        if (opts.accel) {
            // Right-aligned shortcut hint, mirroring the block editor's menu.
            li.classList.add('dbe-ctx-item--accel');
            var acc = document.createElement('span');
            acc.className = 'dbe-ctx-accel';
            acc.textContent = opts.accel;
            acc.setAttribute('aria-hidden', 'true');
            li.appendChild(acc);
        }
        if (opts.disabled) {
            li.classList.add('disabled', 'dbe-ctx-disabled');
            li.setAttribute('aria-disabled', 'true');
            if (opts.tip) { li.setAttribute('data-dbe-tip', opts.tip); }
            return li;
        }
        li.addEventListener('mousedown', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            removeSubmenus();
            try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
            onActivate();
        });
        return li;
    }

    /* Append a right-aligned shortcut hint to the native menu rows that have one
       (Duplicate is our shortcut; Copy/Paste/Remove are Builderius'), so they read
       like the injected rows and the block editor's menu. Matched by the English
       labels the plugin already drives the native menu by. Idempotent. */
    function annotateNativeCtxAccels(container) {
        var map = {
            Duplicate: dbeAccel('D', { cmd: true, shift: true }),
            Copy: dbeAccel('C', { cmd: true }),
            Paste: dbeAccel('V', { cmd: true }),
            Remove: dbeT('accelDelete', 'Del')
        };
        [].slice.call(container.querySelectorAll('.uniContextMenu__item')).forEach(function (li) {
            if (li.querySelector('.dbe-ctx-accel')) { return; }
            var accel = map[(li.textContent || '').trim()];
            if (!accel) { return; }
            li.classList.add('dbe-ctx-item--accel');
            var s = document.createElement('span');
            s.className = 'dbe-ctx-accel';
            s.textContent = accel;
            s.setAttribute('aria-hidden', 'true');
            li.appendChild(s);
        });
    }

    function makeWrapItem(type, labelText) {
        var li = document.createElement('li');
        li.className = 'uniContextMenu__item';
        li.setAttribute('role', 'menuitem');
        li.setAttribute('aria-disabled', 'false');
        li.textContent = labelText;
        li.addEventListener('mousedown', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            wrap(type, multiCtxIds());
            removeSubmenus();
            try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
        });
        return li;
    }

    /* Expand the right-clicked row's whole subtree. Same chevron click channel
       as expandAll, scoped to the row's li; runs in short passes because deep
       rows that were never expanded may only mount after their parent opens. */
    function expandSubtree(id) {
        var rowBtn = id && document.querySelector('.uniRightPanel .uni-tree-node-' + id);
        var root = rowBtn && rowBtn.closest('li.uniModTree__itemDrag');
        if (!root) { return; }
        var passes = 0;
        (function pass() {
            var chevs = [];
            root.querySelectorAll('button.uniModTree__item:not(.expanded)').forEach(function (btn) {
                var chev = btn.querySelector('i');
                if (chev) { chevs.push(chev); }
            });
            if (!chevs.length || passes >= 10) { return; }
            passes += 1;
            chevs.forEach(function (chev) { clickSeq(chev); });
            setTimeout(pass, 120);
        })();
    }

    /* Keyboard support for the context menu (APG menu pattern). The native menu
       is mouse-only; a roving tabindex plus this handler adds Up/Down/Home/End
       navigation, Enter/Space activation, ArrowRight/Enter to open a submenu
       (focus moves to its first item), and ArrowLeft/Escape to come back to the
       parent. Escape at the top level falls through to the dialog's native
       cancel. Activation dispatches the same pointer-event sequence the mouse
       produces, so native and injected items behave identically. Skips the
       disabled "Actions" header row. */
    function menuScopeItems(dialog, li) {
        var fly = li && li.closest('.dbe-ctx-submenu');
        var root = fly || dialog;
        return [].slice.call(root.querySelectorAll('li.uniContextMenu__item')).filter(function (item) {
            if (item.classList.contains('disabled') || item.getAttribute('aria-disabled') === 'true') { return false; }
            return fly ? true : !item.closest('.dbe-ctx-submenu');
        });
    }

    function onMenuKeydown(ev) {
        var dialog = ev.currentTarget;
        var li = ev.target && ev.target.closest ? ev.target.closest('li.uniContextMenu__item') : null;
        var inFly = !!(li && li.closest('.dbe-ctx-submenu'));
        var items, idx, handled = true;

        switch (ev.key) {
            case 'ArrowDown':
            case 'ArrowUp':
                items = menuScopeItems(dialog, li);
                if (!items.length) { handled = false; break; }
                if (!li) {
                    items[ev.key === 'ArrowDown' ? 0 : items.length - 1].focus();
                } else {
                    idx = items.indexOf(li);
                    if (!inFly) { removeSubmenus(); }
                    items[(idx + (ev.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
                }
                break;
            case 'Home':
            case 'End':
                items = menuScopeItems(dialog, li);
                if (!items.length) { handled = false; break; }
                items[ev.key === 'Home' ? 0 : items.length - 1].focus();
                break;
            case 'ArrowRight':
                if (li && !inFly && typeof li._dbeOpenFlyout === 'function') {
                    var fly = li._dbeOpenFlyout();
                    var firstItem = fly && fly.querySelector('li.uniContextMenu__item');
                    if (firstItem) { firstItem.focus(); }
                } else { handled = false; }
                break;
            case 'ArrowLeft':
            case 'Escape':
                if (inFly) {
                    var parent = lastFlyoutParent;
                    removeSubmenus();
                    if (parent) { parent.focus(); }
                } else { handled = false; } // Escape falls through: dialog cancel closes the menu
                break;
            case 'Enter':
            case ' ':
                if (li && typeof li._dbeOpenFlyout === 'function') {
                    var fly2 = li._dbeOpenFlyout();
                    var firstItem2 = fly2 && fly2.querySelector('li.uniContextMenu__item');
                    if (firstItem2) { firstItem2.focus(); }
                } else if (li) {
                    clickSeq(li);
                } else { handled = false; }
                break;
            default:
                handled = false;
        }
        // Handled keys must not reach the builder's global shortcuts (Delete
        // removes the module; arrows move the canvas selection).
        if (handled) { ev.preventDefault(); ev.stopPropagation(); }
    }

    function setupMenuKeyboard(container) {
        var dialog = container.closest('dialog') || container.closest('.uniBuilderContextMenu');
        if (!dialog) { return; }
        [].slice.call(dialog.querySelectorAll('li.uniContextMenu__item')).forEach(function (li) {
            li.tabIndex = -1;
        });
        if (!dialog.dbeMenuKeysBound) {
            dialog.dbeMenuKeysBound = true;
            dialog.addEventListener('keydown', onMenuKeydown, true);
        }
        // Focus the first enabled item so a Shift+F10 / Menu-key open is usable;
        // after a right-click :focus-visible stays off, so no ring for mouse
        // users. Skipped while undo/redo is auto-driving a hidden menu.
        if (document.documentElement.classList.contains('dbe-auto-ctx')) { return; }
        var first = menuScopeItems(dialog, null)[0];
        if (first) { first.focus(); }
    }

    /* Collect native menu items whose text matches `regex` (never our own
       .dbe-ctx-item rows), detached from the list. Re-parenting a native li
       keeps its React handlers alive — events delegate from an ancestor — as
       the original "Save to" collector proved. An empty result means the
       native item text drifted (new Builderius version / locale): callers must
       treat that as "leave the menu as it is". */
    function collectNativeItems(container, regex) {
        var items = [].slice.call(container.querySelectorAll('.uniContextMenu__item'))
            .filter(function (li) {
                return regex.test((li.textContent || '').trim()) && !li.classList.contains('dbe-ctx-item');
            });
        items.forEach(function (li) { li.parentNode && li.parentNode.removeChild(li); });
        return items;
    }

    /* The element context menu. With context_menu ON the items are re-laid into
       one flat, logically-clustered list (separator borders between clusters, no
       nested groups): Duplicate · Copy/Paste · Rename/Reset/Auto-BEM ·
       Wrap in…/Unwrap · Move up/down/Select parent/Expand · Create Component/
       Save to… · Remove. Native items keep their React handlers when re-parented.
       Flyouts survive only where an action branches (Wrap in…, Save to…). With
       context_menu OFF the injected items are appended after the untouched
       native ones. */
    function onContextMenuShow() {
        requestAnimationFrame(function () {
            removeSubmenus();
            // While a feature is auto-driving the native menu (wrap's Paste,
            // multi-remove's Remove — driveContextMenuItem sets .dbe-auto-ctx),
            // leave the menu exactly as Builderius rendered it. The regrouping
            // below folds the native Copy/Paste/Remove into hover-only flyouts,
            // which the auto-driver can't reach — that is what broke wrapping in
            // a div/collection (the Paste channel), while wrap-in-template, which
            // never touches the menu, kept working.
            if (document.documentElement.classList.contains('dbe-auto-ctx')) { return; }
            var anyItem = document.querySelector('.uniContextMenu__item');
            if (!anyItem) { return; }
            var container = anyItem.parentElement;
            if (!container || container.querySelector('.dbe-ctx-parent') || container.hasAttribute('data-dbe-flat')) { return; }
            if (!/Duplicate|Create Component/.test(container.textContent || '')) { return; }

            // The <dialog> we're about to grow — re-clamped into view once the
            // extra rows are in (fitContextMenu), on every exit path below.
            var ctxDialog = container.closest('dialog') || container.closest('.uniBuilderContextMenu');

            var grouped = on('context_menu');

            // Restyle the native "Actions" header row as a group heading (all
            // caps, muted — the same treatment as the multi-select note row).
            if (grouped) {
                [].slice.call(container.querySelectorAll('.uniContextMenu__item.disabled')).forEach(function (li) {
                    if ((li.textContent || '').trim() === 'Actions') { li.classList.add('dbe-ctx-heading'); }
                });
            }

            // Multi-selection this menu acts on (null = normal single-row menu).
            var multiIds = multiCtxIds();
            if (multiIds) {
                var note = document.createElement('li');
                note.className = 'uniContextMenu__item disabled dbe-ctx-note';
                note.setAttribute('aria-disabled', 'true');
                note.textContent = multiIds.length + ' elements selected';
                container.insertBefore(note, container.firstChild);
                // Single-target native actions don't apply to a multi-selection.
                [].slice.call(container.querySelectorAll('.uniContextMenu__item')).forEach(function (li) {
                    if (/^(Duplicate|Copy|Paste|Remove|Create Component)$/.test((li.textContent || '').trim())) {
                        disableCtxItem(li);
                    }
                });
            }

            /* --- Build the injected items (appended flat or grouped below) --- */

            // "Rename" / "Reset label" -> inline edit on the tree row (single row only)
            var nameItems = [];
            if (!multiIds && on('inline_rename')) {
                var renameLi = document.createElement('li');
                renameLi.className = 'uniContextMenu__item dbe-ctx-item';
                renameLi.setAttribute('role', 'menuitem');
                renameLi.textContent = dbeT('rename', 'Rename');
                if (on('keyboard_shortcuts')) { // F2 is only bound when that feature is on
                    renameLi.classList.add('dbe-ctx-item--accel');
                    var renameAcc = document.createElement('span');
                    renameAcc.className = 'dbe-ctx-accel';
                    renameAcc.textContent = 'F2';
                    renameAcc.setAttribute('aria-hidden', 'true');
                    renameLi.appendChild(renameAcc);
                }
                renameLi.addEventListener('mousedown', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var id = lastCtxId || activeId();
                    removeSubmenus();
                    try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
                    startRename(id);
                });
                nameItems.push(renameLi);

                // "Reset label" — back to the builder default (the HTML tag).
                // Only offered when the label actually differs from it.
                var ctxMods = modules();
                var ctxDefault = defaultLabelFor(lastCtxId);
                if (ctxDefault && ctxMods && ctxMods[lastCtxId] &&
                    (ctxMods[lastCtxId].label || '') !== ctxDefault) {
                    var resetLi = document.createElement('li');
                    resetLi.className = 'uniContextMenu__item dbe-ctx-item';
                    resetLi.setAttribute('role', 'menuitem');
                    resetLi.textContent = dbeT('resetLabel', 'Reset label');
                    resetLi.addEventListener('mousedown', function (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        var id = lastCtxId;
                        removeSubmenus();
                        try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
                        commitRename(id, ctxDefault);
                        undoToast(dbeFmt(dbeT('labelResetTo', 'Label reset to <%s>'), ctxDefault));
                    });
                    nameItems.push(resetLi);
                }
            }

            // "Auto-BEM…" -> the class-naming dialog. Offered on any element that
            // can hold a tagClass (decided from the module, not a canvas node, so
            // an unpainted element still qualifies); components / templates can't.
            if (!multiIds && on('auto_bem')) {
                var bemMods = modules();
                var bemMod = bemMods && lastCtxId && bemMods[lastCtxId];
                if (bemClassable(bemMod)) {
                    var bemLi = document.createElement('li');
                    bemLi.className = 'uniContextMenu__item dbe-ctx-item';
                    bemLi.setAttribute('role', 'menuitem');
                    bemLi.textContent = dbeT('autoBemMenu', 'Auto-BEM…');
                    bemLi.addEventListener('mousedown', function (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        var id = lastCtxId;
                        removeSubmenus();
                        try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
                        // Let the menu dialog finish closing (it is showModal —
                        // while open our own dialog could not take focus).
                        setTimeout(function () { openAutoBemDialog(id); }, 120);
                    });
                    nameItems.push(bemLi);
                }
            }

            // "Expand children" -> open the whole subtree under this row (only
            // offered when the row is expandable, i.e. has a chevron)
            var expandLi = null;
            var ctxRowBtn = lastCtxId && document.querySelector('.uniRightPanel .uni-tree-node-' + lastCtxId);
            if (!multiIds && on('collapse_expand_all') && ctxRowBtn && ctxRowBtn.querySelector('i')) {
                expandLi = document.createElement('li');
                expandLi.className = 'uniContextMenu__item dbe-ctx-item';
                expandLi.setAttribute('role', 'menuitem');
                expandLi.textContent = dbeT('expandChildren', 'Expand children');
                expandLi.addEventListener('mousedown', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var id = lastCtxId;
                    removeSubmenus();
                    try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
                    expandSubtree(id);
                });
            }

            // "Wrap in" -> div / template / collection. For a multi-selection it
            // wraps all selected elements — possible only when they're siblings.
            var wrapEnabled = on('wrap_in');
            var wrapDisabled = false;
            if (wrapEnabled && multiIds) {
                var mods0 = modules() || {};
                var p0 = mods0[multiIds[0]] && mods0[multiIds[0]].parent;
                wrapDisabled = multiIds.some(function (id) { return !mods0[id] || mods0[id].parent !== p0; });
            }

            // "Remove N elements" (multi only) — native Remove is single-target
            var removeNLi = null;
            if (multiIds) {
                removeNLi = document.createElement('li');
                removeNLi.className = 'uniContextMenu__item dbe-ctx-item dbe-ctx-item--first';
                removeNLi.setAttribute('role', 'menuitem');
                removeNLi.textContent = dbeFmt(dbeT('removeNElements', 'Remove %s elements'), multiIds.length);
                removeNLi.addEventListener('mousedown', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var ids = multiIds.slice();
                    removeSubmenus();
                    try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
                    clearMultiSel(); // the auto-driven per-row menus must be single-target
                    removeMulti(ids);
                });
            }

            // "Unwrap" (rides on wrap_in) — promote the target's children up a
            // level and drop the empty wrapper. Single-target, needs children.
            var unwrapLi = null;
            if (!multiIds && wrapEnabled && lastCtxId) {
                var uwIdx = store().storeGet('indexes') || {};
                var uwKids = [].concat(uwIdx[lastCtxId] || []);
                var uwMods = modules() || {};
                var uwHasParent = !!(uwMods[lastCtxId] && (uwMods[lastCtxId].parent || ''));
                if (uwKids.length && uwHasParent) {
                    (function () {
                        var uid = lastCtxId;
                        unwrapLi = makeCtxItem(dbeT('unwrap', 'Unwrap'), function () { unwrap(uid); });
                    })();
                }
            }

            // "Move up" / "Move down" / "Select parent" (element_moves) — single-target.
            var moveUpLi = null, moveDownLi = null, selectParentLi = null;
            if (!multiIds && on('element_moves') && lastCtxId) {
                var emId = lastCtxId;
                var emMods = modules() || {};
                var emMod = emMods[emId];
                if (emMod) {
                    var emParent = emMod.parent || '';
                    var emIdx = store().storeGet('indexes') || {};
                    var emSibs = [].concat(emIdx[emParent || 'root'] || []);
                    var emAt = emSibs.indexOf(emId);
                    moveUpLi = makeCtxItem(dbeT('moveUp', 'Move up'), function () { moveSibling(emId, -1); }, { disabled: emAt <= 0 });
                    moveDownLi = makeCtxItem(dbeT('moveDown', 'Move down'), function () { moveSibling(emId, 1); }, { disabled: emAt < 0 || emAt >= emSibs.length - 1 });
                    if (emParent) { selectParentLi = makeCtxItem(dbeT('selectParent', 'Select parent'), function () { selectParentOf(emId); }); }
                }
            }

            // Cut + Add before / Add after (keyboard_shortcuts). Cut mirrors the
            // Cmd/Ctrl+X shortcut (native Copy then Remove); Add-before/after open
            // the quick element picker (deferred a tick so the menu closes first).
            var cutLi = null, addBeforeLi = null, addAfterLi = null;
            if (!multiIds && on('keyboard_shortcuts') && lastCtxId) {
                var ksId = lastCtxId;
                cutLi = makeCtxItem(dbeT('cut', 'Cut'), function () {
                    driveContextMenuItem(ksId, 'Copy', function (ok) {
                        if (ok) { driveContextMenuItem(ksId, 'Remove', function () { undoToast(dbeT('cutDone', 'Cut element')); }); }
                    });
                }, { accel: dbeAccel('X', { cmd: true }) });
                addBeforeLi = makeCtxItem(dbeT('addBefore', 'Add element before'), function () { setTimeout(function () { openElementPicker(ksId, -1); }, 60); }, { accel: dbeAccel('T', { cmd: true, alt: true }) });
                addAfterLi = makeCtxItem(dbeT('addAfter', 'Add element after'), function () { setTimeout(function () { openElementPicker(ksId, 1); }, 60); }, { accel: dbeAccel('Y', { cmd: true, alt: true }) });
            }

            /* --- Flat layout (context_menu off): append injected items after the
               native ones, so each feature still works with grouping turned off. */
            if (!grouped) {
                var injected = nameItems.concat(
                    [cutLi, addBeforeLi, addAfterLi, unwrapLi, moveUpLi, moveDownLi, selectParentLi, expandLi].filter(Boolean)
                );
                if (injected.length) {
                    injected[0].classList.add('dbe-ctx-item--first');
                    injected.forEach(function (li) { container.appendChild(li); });
                }
                if (removeNLi) { container.appendChild(removeNLi); }
                if (wrapEnabled) {
                    var flatWrap = makeParent(
                        multiIds ? dbeFmt(dbeT('wrapNIn', 'Wrap %s in'), multiIds.length) : dbeT('wrapIn', 'Wrap in'),
                        false,
                        function () {
                            return [
                                makeWrapItem('div', dbeT('divLabel', 'Div')),
                                makeWrapItem('figure', dbeT('figureLabel', 'Figure')),
                                makeWrapItem('template', dbeT('templateLabel', 'Template')),
                                makeWrapItem('collection', dbeT('collectionTemplateLabel', 'Collection + template'))
                            ];
                        },
                        wrapDisabled
                    );
                    if (wrapDisabled) { flatWrap.setAttribute('data-dbe-tip', dbeT('onlySiblingsWrapped', 'Only sibling elements can be wrapped together')); }
                    container.appendChild(flatWrap);
                }
                // After the rows are placed: append shortcut hints to the native
                // rows. Done last so it never mutates the textContent the layout
                // above matches native items by (Remove-last, cluster detection).
                if (on('keyboard_shortcuts') && !multiIds) { annotateNativeCtxAccels(container); }
                fitContextMenu(ctxDialog);
                return;
            }

            /* --- Flat, logically-clustered layout (context_menu on) --- */
            container.setAttribute('data-dbe-flat', '1'); // re-entry guard

            // Native items we reposition. Detaching keeps their React handlers
            // alive (they delegate from an ancestor). An empty match means the
            // native label drifted (new version / locale) — that cluster is just
            // skipped, never a crash. The multi-select pass above already disabled
            // the single-target ones, and that state rides along with the node.
            var natDuplicate = collectNativeItems(container, /^Duplicate$/);
            var natClip = collectNativeItems(container, /^(Copy|Paste)$/);
            var natCreate = collectNativeItems(container, /^Create Component$/);
            var natSave = collectNativeItems(container, /^Save\b/);
            var natRemove = collectNativeItems(container, /^Remove$/);

            // Structure cluster: Wrap in… flyout (the wrap targets are hoisted
            // flat inside it — flyouts can't nest) + Unwrap.
            var wrapLabel = multiIds ? dbeFmt(dbeT('wrapNIn', 'Wrap %s in'), multiIds.length) : dbeT('wrapIn', 'Wrap in');
            var wrapParent = null;
            if (wrapEnabled) {
                wrapParent = makeParent(multiIds ? dbeFmt(dbeT('wrapNInEllipsis', 'Wrap %s in…'), multiIds.length) : dbeT('wrapInEllipsis', 'Wrap in…'), false, function () {
                    return [
                        makeWrapItem('div', dbeFmt(dbeT('wrapItemLabel', '%1$s %2$s'), wrapLabel, dbeT('divLabel', 'Div'))),
                        makeWrapItem('figure', dbeFmt(dbeT('wrapItemLabel', '%1$s %2$s'), wrapLabel, dbeT('figureLabel', 'Figure'))),
                        makeWrapItem('template', dbeFmt(dbeT('wrapItemLabel', '%1$s %2$s'), wrapLabel, dbeT('templateLabel', 'Template'))),
                        makeWrapItem('collection', dbeFmt(dbeT('wrapItemLabel', '%1$s %2$s'), wrapLabel, dbeT('collectionTemplateLabel', 'Collection + template')))
                    ];
                }, wrapDisabled);
                if (wrapDisabled) { wrapParent.setAttribute('data-dbe-tip', dbeT('onlySiblingsWrapped', 'Only sibling elements can be wrapped together')); }
            }

            // Reuse cluster: Create Component + Save to. Keep Save as a flyout only
            // when it branches (>1 native item); a lone Save item goes flat.
            var saveItem = null;
            if (natSave.length > 1) {
                saveItem = makeParent(dbeT('saveTo', 'Save to…'), false, function () { return natSave; }, !!multiIds);
            } else if (natSave.length === 1) {
                saveItem = natSave[0];
                if (multiIds) { disableCtxItem(saveItem); }
            }

            // Assemble the clusters in order; empty ones drop out. The first item
            // of every cluster after the first gets a top-border separator via
            // .dbe-ctx-item--first — no separator <li>, so the keyboard focus ring
            // (which skips only disabled rows) is untouched.
            var clusters = [
                natDuplicate,                                                    // Clone
                natClip.concat(cutLi ? [cutLi] : []),                            // Clipboard (+ Cut)
                nameItems,                                                       // Name & style
                [addBeforeLi, addAfterLi].filter(Boolean),                       // Insert
                [wrapParent, unwrapLi].filter(Boolean),                          // Structure
                [moveUpLi, moveDownLi, selectParentLi, expandLi].filter(Boolean),// Position / navigate
                natCreate.concat(saveItem ? [saveItem] : []),                    // Reuse
                multiIds ? (removeNLi ? [removeNLi] : []) : natRemove            // Destructive
            ];

            var seenCluster = false;
            clusters.forEach(function (items) {
                if (!items || !items.length) { return; }
                if (seenCluster) { items[0].classList.add('dbe-ctx-item--first'); }
                seenCluster = true;
                items.forEach(function (li) { container.appendChild(li); });
            });

            // After clustering (which matches native rows by textContent): append
            // the shortcut hints, so the hint text never corrupts those matches.
            if (on('keyboard_shortcuts') && !multiIds) { annotateNativeCtxAccels(container); }

            setupMenuKeyboard(container);
            fitContextMenu(ctxDialog);
        });
    }

    /* (e) "Collapse subtrees" Navigator header icon. The stock header button
       collapses EVERYTHING, including the top-level rows; this one closes only
       the levels below them (e.g. the sections inside <main>), leaving the
       document skeleton visible. Expansion state is React-local (an .expanded
       class on each row button, toggled by its chevron <i>), so the only
       outside-in channel is dispatching a real event sequence on the chevron —
       verified working. Collapsed groups stay mounted (their <ul> is
       display:none), so one pass reaches hidden deep rows too, which means
       re-expanding a section later reveals an already-tidied subtree. */
    function collapseSubtrees() {
        document.querySelectorAll('.uniRightPanel button.uniModTree__item.expanded').forEach(function (btn) {
            var li = btn.closest('li.uniModTree__itemDrag');
            // Keep top-level rows (their parent <ul> is the root list) open.
            if (!li || !li.parentElement.closest('li.uniModTree__itemDrag')) { return; }
            var chev = btn.querySelector('i');
            if (!chev) { return; }
            ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (t) {
                var Ev = t.indexOf('pointer') === 0 ? PointerEvent : MouseEvent;
                chev.dispatchEvent(new Ev(t, { bubbles: true, cancelable: true, view: window }));
            });
        });
    }

    function ensureCollapseButton() {
        var icons = document.querySelector('.uniRightPanel .uniPanelHeader__icons');
        if (!icons || icons.querySelector('.dbe-collapse-subtrees')) { return; }
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'uniPanelIconButton uniPanelIconButtonSmall dbe-collapse-subtrees';
        btn.setAttribute('aria-label', dbeT('collapseSubtrees', 'Collapse subtrees'));
        btn.title = dbeT('collapseSubtreesTip', 'Collapse subtrees (keeps top-level elements open)');
        btn.innerHTML = '<span><svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<path d="M1.2 1.5h9.6M6 12.5V6M3.8 8.2 6 6l2.2 2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg></span>';
        btn.addEventListener('click', collapseSubtrees);
        // Gentler action first, stock collapse-all second.
        icons.insertBefore(btn, icons.firstChild);
    }

    /* (e2) "Expand all" Navigator header icon. The stock header button is a
       collapse-all/expand-all TOGGLE, but Builderius unmounts it whenever the
       Styles CSS code editor is open — native behaviour, verified with all our
       injections removed. Because (f) makes code mode the Styles default, the
       tree would have no expand-all most of the time without this. Expansion
       goes through the same chevron click channel as collapseSubtrees; deep
       rows that were never expanded may only mount after their parent opens,
       so this runs in short passes until no closed chevron rows remain. */
    function expandAll() {
        var passes = 0;
        (function pass() {
            var chevs = [];
            document.querySelectorAll('.uniRightPanel button.uniModTree__item:not(.expanded)').forEach(function (btn) {
                var chev = btn.querySelector('i');
                if (chev) { chevs.push(chev); }
            });
            if (!chevs.length || passes >= 10) { return; }
            passes += 1;
            chevs.forEach(function (chev) { clickSeq(chev); });
            setTimeout(pass, 120);
        })();
    }

    function ensureExpandAllButton() {
        var icons = document.querySelector('.uniRightPanel .uniPanelHeader__icons');
        if (!icons || icons.querySelector('.dbe-expand-all')) { return; }
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'uniPanelIconButton uniPanelIconButtonSmall dbe-expand-all';
        btn.setAttribute('aria-label', dbeT('expandAll', 'Expand all'));
        btn.title = dbeT('expandAllElements', 'Expand all elements');
        btn.innerHTML = '<span><svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<path d="M1.2 1.5h9.6M6 5.5V12M3.8 9.8 6 12l2.2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg></span>';
        btn.addEventListener('click', expandAll);
        // Sits first: Expand all, Collapse subtrees, then the stock toggle
        // (when Builderius renders it).
        icons.insertBefore(btn, icons.querySelector('.dbe-collapse-subtrees') || icons.firstChild);
    }

    /* (h) Tooltips + accessible names for icon-only chrome buttons. setTip()
       gives each control — Navigator header icons, the settings-header
       conditions/CSS-mode icons, the top-bar breakpoint and reload buttons, the
       tree-footer delete — an aria-label (4.1.2) and a data-dbe-tip driving the
       shared .dbe-tooltip chip. Controls that ship their own native tooltip
       (the favourites bar and footer bar) are brought into the same chip by
       adoptNativeTips(), so the whole chrome speaks through one tooltip.

       Any native tooltip on a control we label is a duplicate, so setTip strips
       it: the title attribute, and — Builderius labels many icons with a
       react-tooltip anchor (.tooltipItem[data-tooltip-content], one shared
       floating chip keyed off the hovered anchor's content) — the
       data-tooltip-content, both on el itself (footer items carry it directly)
       and on any inner wrapper (the breakpoint/reload icons wrap it a level
       down). Dropping the content leaves the native chip nothing to show, so
       only our .dbe-tooltip appears. Runs every labelChromeIcons() pass, so it
       self-heals after a React re-render re-adds the attribute. */
    function setTip(el, label) {
        if (!el) { return; }
        if (el.getAttribute('data-dbe-tip') !== label) { el.setAttribute('data-dbe-tip', label); }
        if (!el.getAttribute('aria-label')) { el.setAttribute('aria-label', label); }
        if (el.hasAttribute('title')) { el.removeAttribute('title'); }
        if (el.hasAttribute('data-tooltip-content')) { el.removeAttribute('data-tooltip-content'); }
        el.querySelectorAll('[data-tooltip-content]').forEach(function (a) {
            a.removeAttribute('data-tooltip-content');
        });
    }

    /* Adopt Builderius' own tooltips on the favourites bar and the footer bar
       into our chip. Those controls carry a native react-tooltip
       (.tooltipItem[data-tooltip-content]) and no chip of ours; rather than
       leave a second, differently-styled system, take their text over so the
       whole chrome speaks through one .dbe-tooltip. Reusing Builderius' copy
       keeps the labels correct with nothing to maintain (incl. the footer's
       "Soon: …" strings). setTip() then drops the native content, so only our
       chip shows. Re-runs each pass, self-healing on re-render. */
    function adoptNativeTips() {
        document.querySelectorAll(
            '.uniModTree__favouritesList [data-tooltip-content], .uniFooterPanelBar [data-tooltip-content]'
        ).forEach(function (a) {
            var label = (a.getAttribute('data-tooltip-content') || '').trim();
            if (label) { setTip(a, label); }
        });
    }

    var DBE_TIPS = [
        ['.uniRightPanel .uniPanelHeader__icons .dbe-expand-all', dbeT('expandAllElements', 'Expand all elements')],
        ['.uniRightPanel .uniPanelHeader__icons .dbe-collapse-subtrees', dbeT('collapseSubtreesTip', 'Collapse subtrees (keeps top-level elements open)')],
        ['.uniLeftPanel .uniIconConditionsMode', dbeT('tipDynamicConditions', 'Dynamic data conditions')],
        ['.uniLeftPanel .uniIconCssMode', dbeT('tipToggleCssEditor', 'Toggle CSS code editor')],
        ['.uniPanelButton--builderiusMenu', dbeT('tipBuilderiusMenu', 'Builderius menu')],
        ['.uniGlobalBreakpoints__modalIcon', dbeT('tipBreakpointSettings', 'Breakpoint settings')],
        ['.uniReloadIframeBtn', dbeT('tipReloadPreview', 'Reload preview')],
        ['.uniIconButton.caretIcon', dbeT('tipSaveOptions', 'Save options')],
        ['.uniModTree__footer button.uniPanelIconButton', dbeT('tipDeleteSelected', 'Delete selected element (click twice to confirm)')],
        ['.uniModTree__footer .editFavouritesIcon', dbeT('tipEditFavourites', 'Edit favourite elements')],
        ['.uniFooterPanelBar .collapsePanelIcon', dbeT('tipCollapseBottomPanel', 'Collapse bottom panel')],
        ['.uniBreakpointsTable__addNew', dbeT('tipAddBreakpoint', 'Add breakpoint')],
        ['.uniBreakpointsTable__delete', dbeT('tipDeleteBreakpoint', 'Delete breakpoint')],
        ['.uniFormField__ddTagsBtn', dbeT('tipInsertDynamicData', 'Insert dynamic data')],
        // Top-bar canvas-size fields ship with no label at all (bare inputs); a
        // screen reader announces them as unnamed edit boxes. Give each an
        // accessible name (3.3.2 / 4.1.2) plus a matching hover tooltip.
        ['.uniTopPanel input[name="width"]', dbeT('tipCanvasWidth', 'Canvas width in pixels')],
        ['.uniTopPanel input[name="zoom"]', dbeT('tipCanvasZoom', 'Canvas zoom, percent')]
    ];

    /* Fallback breakpoint labels, used only when dbeBreakpoints() can't read
       the real list from the builder. Order is base canvas first, then
       breakpoints large-to-small. */
    var DBE_BP_LABELS = [
        dbeT('bpFallbackBase', 'Base styles (full width)'),
        dbeT('bpFallbackDesktop', 'Desktop (max 1279px)'),
        dbeT('bpFallbackTablet', 'Tablet (max 991px)'),
        dbeT('bpFallbackMobile', 'Mobile (max 478px)')
    ];

    function labelChromeIcons() {
        DBE_TIPS.forEach(function (pair) {
            document.querySelectorAll(pair[0]).forEach(function (el) { setTip(el, pair[1]); });
        });
        adoptNativeTips();
        // Top-bar breakpoint buttons carry no name anywhere in the DOM; label
        // them from the site's real breakpoints (order matches the buttons:
        // base first, then large-to-small), falling back to the static list.
        var bps = dbeBreakpoints();
        document.querySelectorAll('.uniPanelButtonBreakpoint').forEach(function (b, i) {
            var bp = bps && bps[i];
            if (bp) {
                setTip(b, bp.width ? dbeFmt(dbeT('bpMax', '%1$s (max %2$spx)'), bp.label, bp.width) : dbeFmt(dbeT('bpBase', '%s (base styles, full width)'), bp.label));
            } else {
                setTip(b, DBE_BP_LABELS[i] || dbeT('breakpoint', 'Breakpoint'));
            }
        });
        // The stock Navigator button is a collapse-all/expand-all toggle whose
        // icon swaps per click — label follows the icon (collapse-all state
        // draws the "M0.53125 7..." bar path).
        var stock = document.querySelector('.uniRightPanel .uniPanelHeader__icons > button:not(.dbe-expand-all):not(.dbe-collapse-subtrees)');
        if (stock) {
            var d = stock.querySelector('svg path');
            d = d ? (d.getAttribute('d') || '') : '';
            setTip(stock, d.indexOf('M0.53125') === 0 ? dbeT('collapseAll', 'Collapse all') : dbeT('expandAll', 'Expand all'));
        }
        // Left-panel page header icons carry no distinguishing classes — identify
        // by glyph. The Inserter reuses the same collapse/expand toggle glyph pair
        // as the Navigator (here it folds the element GROUPS), plus a close X
        // (onClick = closeLeftPanelPage, so "panel" not "Inserter" — the header
        // component is shared by every left-panel page).
        document.querySelectorAll('.uniLeftPanel .uniPanelHeader__icons > button').forEach(function (b) {
            if (/dbe-|uniIconCssMode|uniIconConditionsMode/.test(b.className)) { return; }
            var d = b.querySelector('svg path');
            d = d ? (d.getAttribute('d') || '') : '';
            if (d.indexOf('M0.53125') === 0) { setTip(b, dbeT('collapseAllGroups', 'Collapse all groups')); }
            else if (d.indexOf('M11.6445') === 0) { setTip(b, dbeT('expandAllGroups', 'Expand all groups')); }
            else if (d.indexOf('M11.9198') === 0) { setTip(b, dbeT('closePanel', 'Close panel')); }
        });
        // Top-bar right: the square icon hides both side panels for a full-width
        // canvas (verified: right panel unmounts, canvas 1392 -> 1652, .active
        // marks the hidden state); the eye opens the entity's front-end URL in
        // a new browser tab.
        document.querySelectorAll('.uniTopPanel__rightCol .uniPanelButton').forEach(function (b) {
            if ((b.textContent || '').trim()) { return; }
            var d = b.querySelector('svg path');
            d = d ? (d.getAttribute('d') || '') : '';
            if (d.indexOf('M14.4551') === 0) {
                setTip(b, b.classList.contains('active') ? dbeT('showSidePanels', 'Show side panels') : dbeT('hideSidePanels', 'Hide side panels (full-width canvas)'));
            } else if (d.indexOf('M19.6173') === 0) {
                setTip(b, dbeT('previewNewTab', 'Preview page in a new tab'));
            }
        });
    }

    /* Shared tooltip chip. Shown after a short hover delay (instantly on
       keyboard focus), hidden on leave/blur/Escape/pointerdown/scroll.
       Placement prefers ABOVE the trigger (never sits under the pointer), then
       BELOW, and only then beside. Top-bar controls (breakpoints, save, the
       canvas-size fields) sit flush to the top edge, so they fall to BELOW —
       matching the native tooltip and dropping the chip into the open canvas,
       clear of the busy toolbar row rather than overlapping a neighbour beside
       it. Anchored to the element, not the cursor, so keyboard focus behaves
       identically. */
    var tipEl = null, tipTimer = null, tipTarget = null;
    function placeTip(r, w, h) {
        var M = 4, G = 8;
        var clampX = function (x) { return Math.min(Math.max(M, x), window.innerWidth - w - M); };
        var clampY = function (y) { return Math.min(Math.max(M, y), window.innerHeight - h - M); };
        // 1. Above, centred — anything with headroom.
        if (r.top - h - G >= M) {
            return [clampX(r.left + r.width / 2 - w / 2), r.top - h - G];
        }
        // 2. Below, centred — top-edge controls land here (over the canvas).
        if (r.bottom + h + G <= window.innerHeight - M) {
            return [clampX(r.left + r.width / 2 - w / 2), r.bottom + G];
        }
        // 3. Beside, vertically centred — last resort (no room above or below).
        var spaceRight = window.innerWidth - r.right, spaceLeft = r.left;
        var x = spaceRight >= spaceLeft ? r.right + G : r.left - w - G;
        return [clampX(x), clampY(r.top + r.height / 2 - h / 2)];
    }
    /* Where to mount the chip. A chip on <body> renders BEHIND a showModal()
       dialog (down in its blurred backdrop), so when the trigger sits inside an
       open modal <dialog> — the breakpoints modal, our own Auto-BEM dialog —
       host it in that dialog instead, joining its top layer so it paints above
       the backdrop. These dialogs carry no transform/filter, so the chip's
       position:fixed viewport coordinates still hold. Everything else uses body. */
    function tipHost(target) {
        var dlg = target.closest && target.closest('dialog');
        if (dlg) { try { if (dlg.matches(':modal')) { return dlg; } } catch (e) {} }
        return document.body;
    }
    function showTip(target, instant) {
        var label = target.getAttribute('data-dbe-tip');
        if (!label) { return; }
        clearTimeout(tipTimer);
        tipTarget = target;
        tipTimer = setTimeout(function () {
            if (tipTarget !== target || !document.contains(target)) { return; }
            if (!tipEl) {
                tipEl = document.createElement('div');
                tipEl.className = 'dbe-tooltip';
                tipEl.setAttribute('aria-hidden', 'true');
            }
            var host = tipHost(target);
            if (tipEl.parentNode !== host) { host.appendChild(tipEl); }
            tipEl.textContent = label;
            var r = target.getBoundingClientRect();
            tipEl.style.left = '0px'; tipEl.style.top = '0px';
            var pos = placeTip(r, tipEl.offsetWidth, tipEl.offsetHeight);
            tipEl.style.left = pos[0] + 'px'; tipEl.style.top = pos[1] + 'px';
            tipEl.classList.add('is-visible');
        }, instant ? 0 : 250);
    }
    function hideTip() {
        clearTimeout(tipTimer);
        tipTarget = null;
        if (tipEl) { tipEl.classList.remove('is-visible'); }
    }
    function bindTooltips() {
        document.addEventListener('mouseover', function (e) {
            var t = e.target.closest && e.target.closest('[data-dbe-tip]');
            if (t) { if (t !== tipTarget) { showTip(t, false); } }
            else if (tipTarget) { hideTip(); }
        });
        document.addEventListener('focusin', function (e) {
            var t = e.target.closest && e.target.closest('[data-dbe-tip]');
            if (t) { showTip(t, true); }
        });
        document.addEventListener('focusout', hideTip);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hideTip(); } }, true);
        document.addEventListener('pointerdown', hideTip, true);
        document.addEventListener('scroll', hideTip, true);
    }

    function clickSeq(el) {
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (t) {
            var Ev = t.indexOf('pointer') === 0 ? PointerEvent : MouseEvent;
            el.dispatchEvent(new Ev(t, { bubbles: true, cancelable: true, view: window }));
        });
    }

    /* Reliable state detection. .monaco-editor and .uniModCssCatWrapper are NOT
       code-mode markers — the Content field also mounts a Monaco editor, and the
       category wrapper is reused by the Content tab. The CSS code editor is the
       only view that renders .uniSettingsPageModuleDataForEditorWrapper. */
    function isCssCodeMode(lp) {
        return !!lp.querySelector('.uniSettingsPageModuleDataForEditorWrapper');
    }
    function nativeStripActiveTab(lp) {
        var strip = lp.querySelector('.uniPanelTabs');           // native tab strip (absent in code mode)
        var active = strip && strip.querySelector('.uniPanelTabs__tab.active:not(.dbe-code-tab)');
        return active ? (active.textContent || '').trim() : null;
    }

    /* (f) Styles tab -> default to the CSS code editor, and disable the visual
       accordion. Builderius' CSS-mode (.uniIconCssMode) is a GLOBAL, sticky
       toggle. Whenever the native Styles tab is the active view (and we are not
       already in code mode), flip to the code editor. Keyed off the ACTIVE native
       tab, so the Content tab is never touched. The raw toggle is hidden by CSS
       (redundant now) but still works when clicked programmatically below.
       `goingToContent` suppresses the flip during the Content bounce. */
    var goingToContent = false;
    function ensureCssCodeDefault() {
        if (goingToContent) { return; }
        var lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return; }
        if (isCssCodeMode(lp)) { return; }                       // already in code mode
        if (!/Styles/i.test(nativeStripActiveTab(lp) || '')) { return; } // only flip from the Styles tab
        var btn = lp.querySelector('.uniIconCssMode');
        if (btn) { clickSeq(btn); }
    }

    /* In code mode Builderius drops the whole Content/Styles tab strip, so there
       is no way back to element settings without leaving the editor. Re-inject a
       matching switcher. "Styles" is the current view; "Content" bounces out of
       code mode (which restores the native strip) and clicks the real Content
       tab. `goingToContent` stops ensureCssCodeDefault re-flipping mid-bounce. */
    function gotoContent() {
        var lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return; }
        goingToContent = true;
        var toggle = lp.querySelector('.uniIconCssMode');
        if (toggle) { clickSeq(toggle); } // exit code mode -> native tabs return
        var tries = 0;
        (function waitForContentTab() {
            var lp2 = document.querySelector('.uniLeftPanel');
            var contentTab = lp2 && [].slice.call(lp2.querySelectorAll('.uniPanelTabs__tab:not(.dbe-code-tab)'))
                .filter(function (t) { return /Content/i.test(t.textContent || ''); })[0];
            if (contentTab) {
                clickSeq(contentTab);
                goingToContent = false;
            } else if (tries++ < 40) {
                requestAnimationFrame(waitForContentTab);
            } else {
                goingToContent = false;
            }
        })();
    }

    function ensureCodeModeTabs() {
        var lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return; }
        var sp = lp.querySelector('.uniSettingsPage');
        var codeMode = isCssCodeMode(lp);
        var existing = lp.querySelector('.dbe-code-tabs');
        if (!codeMode || !sp) { if (existing) { existing.remove(); } return; }
        if (existing) { return; }
        var strip = document.createElement('div');
        strip.className = 'uniPanelTabs uniPanelTabs--2 dbe-code-tabs';
        strip.setAttribute('role', 'tablist');
        var mk = function (label, active, onClick) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'uniPanelTabs__tab dbe-code-tab' + (active ? ' active' : '');
            b.setAttribute('role', 'tab');
            b.setAttribute('aria-selected', active ? 'true' : 'false');
            var s = document.createElement('span');
            s.textContent = label;
            b.appendChild(s);
            if (onClick) { b.addEventListener('click', onClick); }
            return b;
        };
        strip.appendChild(mk(dbeT('contentTab', 'Content'), false, gotoContent));
        strip.appendChild(mk(dbeT('stylesTab', 'Styles'), true, null));
        var header = sp.querySelector('.uniPanelHeader');
        if (header && header.nextSibling) { sp.insertBefore(strip, header.nextSibling); }
        else { sp.insertBefore(strip, sp.firstChild); }
    }

    /* (g) CSS scope: surface the Global/Template switch at the Styles editor and
       indicate the current level. The scope lives in the builder store as the
       boolean `isGlobalScope` — the native Global/Template buttons' ENTIRE
       onClick is storeSet('isGlobalScope', bool) (verified 5 Jul 2026 via the
       buttons' React props), so reading and writing that key is exactly the
       native control, repaints every consumer reactively, and — unlike mounting
       the Selectors tab — does not deselect the element. The old Selectors-tab
       bounce (setScope's slow path) is kept only as a fallback for the day the
       key is renamed. Level = local when the selected selector is
       %local%/%#local%, else the global/template scope. */
    var dbeScope = 'global';        // cached scope; default matches Builderius
    var dbeSwitchingScope = false;

    /* Display name for the non-global scope. It follows the entity being
       edited: "Component" when a component is open, "Template" otherwise —
       mirroring the native TemplateScopeBtn, which labels itself from
       entityMeta.type (verified 8 Jul 2026: editing a component, getEntitySettings
       already returns the COMPONENT's CSS, so the store routes edits correctly;
       only our label lagged). The internal scope key stays 'template' for both,
       so nothing about the switch behaviour or the data-dbe-level CSS changes —
       only the words the user reads. */
    function entityScopeLabel() {
        var t;
        try { var m = store().storeGet('entityMeta'); t = m && m.type; } catch (e) { /* store not ready */ }
        return t === 'component' ? dbeT('scopeComponent', 'Component') : dbeT('scopeTemplate', 'Template');
    }

    /* The store's scope boolean, or null when unavailable (store not ready, or
       the key renamed by a Builderius update). */
    function scopeStoreValue() {
        try {
            var v = store().storeGet('isGlobalScope');
            return typeof v === 'boolean' ? v : null;
        } catch (e) { return null; }
    }

    function readScopeFromControl() {
        var v = scopeStoreValue();
        if (v !== null) { dbeScope = v ? 'global' : 'template'; return; }
        var ctrl = document.querySelector('.uniRightPanel .uniScopeControl');
        if (!ctrl) { return; }
        var active = ctrl.querySelector('button.active');
        if (active) { dbeScope = /template/i.test(active.textContent || '') ? 'template' : 'global'; }
    }

    function currentSelectorName(lp) {
        var sel = lp.querySelector('.uniModuleCssSelectorItemSelected');
        return sel ? (sel.textContent || '').trim() : '';
    }
    function currentCssLevel(lp) {
        var name = currentSelectorName(lp);
        if (!name || name.charAt(0) === '%') { return 'local'; } // %local% / %#local%
        return dbeScope;                                          // a class selector -> global | template
    }

    /* Poll until test() is truthy, then cb(value); cb(null) if it never is. Uses
       setTimeout (not rAF) because this runs inside a View Transition update
       callback, during which rAF can be suppressed — timer tasks still fire. */
    function waitFor(test, cb, maxTries) {
        var n = 0, max = maxTries || 60;
        (function loop() {
            var v; try { v = test(); } catch (e) { v = null; }
            if (v) { cb(v); }
            else if (n++ < max) { setTimeout(loop, 25); }
            else { cb(null); }
        })();
    }
    /* Re-point the styles editor at `target` scope for the active class.

       The native builder has a defect: when a class has saved rules in only ONE
       scope, an effect force-switches the working object
       (activeSelectorSettingsCssObj) back to that scope on every render, so a
       raw isGlobalScope write cannot open the EMPTY scope to add a first rule
       there. Verified 7 Jul 2026 against the store: with a template-only class
       selected, isGlobalScope read Global while activeSelectorSettingsCssObj
       stayed Template, and edits saved to Template. The effect is gated on
       `!isCssMode`, so it bites the visual properties panel; in the CSS code
       editor the same symptom appears because the editor's content is bound to
       the working object, which nothing refreshes on a scope flip in code mode.

       Builderius' own public hook `cssSelector.modifyCssObj` sets that working
       object with an EXPLICIT scope, loading the class's existing rules FROM the
       target scope's stylesheet (or empty when the class isn't there yet), so
       the user's next declaration lands in the target scope. Once a rule exists
       in both scopes the native force-switch stops firing and the toggle is free.

       `force` splits the two calls in setScope: the immediate one sets the
       scope; the deferred one only RE-asserts if the native effect has since
       flipped the working object back, so it never clobbers an edit already in
       flight when no revert happened (e.g. code mode, where the effect is
       dormant). Class selectors only; %local% one-offs are unambiguous. */
    function repointScope(target, force) {
        try {
            var sf = store();
            var sel = sf.storeGet('activeSelector');
            if (!sel || sel.charAt(0) === '%') { return; }
            var want = target === 'global';
            var cur = sf.storeGet('activeSelectorSettingsCssObj') || {};
            if (!force && cur.selector === sel && cur.isGlobalScope === want) { return; }
            var settings = want ? sf.storeGet('getGlobalSettings') : sf.storeGet('getEntitySettings');
            var css = settings && typeof settings.css === 'string' ? settings.css : '';
            var bp = sf.storeGet('activeBreakpoint') || '';
            window.Builderius.API.hooks.doAction('builderius.cssSelector.modifyCssObj', {
                value: css, selector: sel, breakpoint: bp, isGlobalScope: want
            });
        } catch (e) { /* store or hooks unavailable; leave the native toggle as-is */ }
    }

    /* Give a class that has rules only in the OTHER scope ("elsewhere") a real,
       empty rule in the ACTIVE scope, so it becomes cleanly editable HERE.

       Builderius mounts the per-selector code editor onto the scope where the
       class physically has rules, ignoring the active scope — so a Global view of
       a Template-only class shows (and would fork) Template's rules. Seeding an
       empty `sel {}` into the active scope's stylesheet makes the class exist in
       both scopes: Builderius re-mounts the editor onto the active scope's own
       (empty) model, and edits then save to the active scope. Uses the public
       modifyCssAll hook with plain CSS text, so it never touches Builderius'
       internal rule-object shape. No-ops if the active scope already has the rule
       (so it can't clobber real styles) — and modifyCssAll REPLACES the whole
       stylesheet, so we read the current text fresh and only append. */
    function seedActiveScope() {
        try {
            var sf = store();
            var sel = sf.storeGet('activeSelector');
            if (!sel || sel.charAt(0) !== '.') { return; }        // class selectors only
            var isGlobal = sf.storeGet('isGlobalScope') === true;
            var settings = isGlobal ? sf.storeGet('getGlobalSettings') : sf.storeGet('getEntitySettings');
            var css = settings && typeof settings.css === 'string' ? settings.css : '';
            if (selectorInScope(css, sel)) { return; }            // already editable here; nothing to seed
            window.Builderius.API.hooks.doAction('builderius.cssSelector.modifyCssAll', {
                value: css + '\n' + sel + ' {\n}\n',
                scope: isGlobal ? 'global' : 'entity'
            });
        } catch (e) { /* store or hooks unavailable; leave the warning as-is */ }
    }

    /* Switch the CSS scope from the Styles editor.

       FAST PATH: write the store's `isGlobalScope` boolean — byte-for-byte what
       the native Global/Template buttons do on click — and everything bound to
       it repaints in place, selection untouched. Near-instant, no mask.

       SLOW PATH (fallback only, e.g. the key renamed by an update): the native
       scope control is reachable only via the Selectors tab, and ACTIVATING that
       tab deselects the element. So: bounce to Selectors -> click the target
       scope button -> restore the previous right-panel tab -> re-select the
       element by clicking its tree row (a REAL selection; storeSet leaves the
       class list un-hydrated) -> reopen Styles -> re-pick the class the user was
       on. Guarded against re-entry; ends by refreshing the bar. */
    function setScope(target) {
        if (scopeStoreValue() !== null) {
            try {
                store().storeSet('isGlobalScope', target === 'global');
                dbeScope = target;
                repointScope(target, true);                              // open the target scope now
                setTimeout(function () { repointScope(target, false); }, 60); // re-assert if the native effect reverts it
                schedule();
                return Promise.resolve();
            } catch (e) { /* fall through to the slow path */ }
        }
        if (dbeSwitchingScope) { return Promise.resolve(); }
        var lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return Promise.resolve(); }
        var savedModule = activeId();
        var savedSelector = currentSelectorName(lp);
        var rp = document.querySelector('.uniRightPanel');
        var prevTab = rp && rp.querySelector('.uniPanelTabs__tab.active:not(.dbe-code-tab)');
        var prevTabText = prevTab ? (prevTab.textContent || '').trim() : 'Elements';
        dbeSwitchingScope = true;

        // Returns a promise that ALWAYS resolves — a View Transition wraps this, so
        // an unresolved promise would freeze the page. A safety timer guarantees it.
        return new Promise(function (resolve) {
            var finished = false;
            function done() {
                if (finished) { return; }
                finished = true;
                dbeSwitchingScope = false;
                schedule();
                resolve();
            }
            setTimeout(done, 6000);

            var selTab = rp && [].slice.call(rp.querySelectorAll('.uniPanelTabs__tab'))
                .filter(function (t) { return /Selector/i.test(t.textContent || ''); })[0];
            if (selTab && !selTab.classList.contains('active')) { clickSeq(selTab); }

            waitFor(function () { return document.querySelector('.uniRightPanel .uniScopeControl'); }, function (ctrl) {
                if (ctrl) {
                    var btn = [].slice.call(ctrl.querySelectorAll('button'))
                        .filter(function (b) { return new RegExp(target, 'i').test(b.textContent || ''); })[0];
                    if (btn && !btn.classList.contains('active')) { clickSeq(btn); }
                    dbeScope = target;
                }
                // restore the right-panel tab the user was on
                var restore = [].slice.call(document.querySelectorAll('.uniRightPanel .uniPanelTabs__tab'))
                    .filter(function (t) { return new RegExp('^' + prevTabText, 'i').test((t.textContent || '').trim()); })[0];
                if (restore && !restore.classList.contains('active')) { clickSeq(restore); }
                // Re-select the element the Selectors tab cleared by clicking its tree
                // row. This must be a REAL selection: storeSet('activeModule') renders
                // the panel shell but leaves the CSS class list un-hydrated (same class
                // of limitation as raw store writes elsewhere). Needs the Elements tab
                // (restored above) and the row visible (not in a collapsed branch).
                waitFor(function () {
                    return !savedModule || document.querySelector('.uniRightPanel .uni-tree-node-' + savedModule);
                }, function (row) {
                    if (row && row.nodeType === 1) { clickSeq(row); }
                    waitFor(function () { return document.querySelector('.uniLeftPanel .uniPanelTabs__tab:not(.dbe-code-tab)'); }, function () {
                        var lp2 = document.querySelector('.uniLeftPanel');
                        var styles = lp2 && [].slice.call(lp2.querySelectorAll('.uniPanelTabs__tab:not(.dbe-code-tab)'))
                            .filter(function (t) { return /Styles/i.test(t.textContent || ''); })[0];
                        if (styles && !styles.classList.contains('active')) { clickSeq(styles); }
                        waitFor(function () { return document.querySelector('.uniLeftPanel .uniSettingsPageModuleDataForEditorWrapper'); }, function () {
                            if (savedSelector && savedSelector.charAt(0) !== '%') {
                                // The class list hydrates a beat after the editor wrapper — wait
                                // for the specific item, then re-pick the user's selector.
                                waitFor(function () {
                                    var lp4 = document.querySelector('.uniLeftPanel');
                                    return lp4 && [].slice.call(lp4.querySelectorAll('.uniModuleCssClassesSelect__list li'))
                                        .filter(function (x) { return (x.textContent || '').trim().indexOf(savedSelector) === 0; })[0];
                                }, function (li) {
                                    if (li && li.querySelector('span')) { clickSeq(li.querySelector('span')); }
                                    done();
                                }, 24);
                            } else {
                                done();
                            }
                        });
                    });
                });
            });
        });
    }

    /* Cover the settings + navigator panels with an opaque, panel-coloured mask
       for the duration of the switch, then fade it out to reveal the settled
       result. The mask starts fully opaque (no fade-in) so no churn peeks through;
       only the reveal is animated. Runs promiseFactory() and clears on resolve. */
    function withScopeMask(promiseFactory) {
        var panels = ['.uniLeftPanel', '.uniRightPanel']
            .map(function (s) { return document.querySelector(s); })
            .filter(Boolean);
        var masks = panels.map(function (el) {
            var r = el.getBoundingClientRect();
            var m = document.createElement('div');
            m.className = 'dbe-scope-mask';
            m.style.left = r.left + 'px';
            m.style.top = r.top + 'px';
            m.style.width = r.width + 'px';
            m.style.height = r.height + 'px';
            document.body.appendChild(m);
            return m;
        });
        // Label only the widest mask (the settings panel) so the brief wait reads
        // as an intentional "working" state rather than a frozen panel.
        if (masks.length) {
            var lbl = document.createElement('div');
            lbl.className = 'dbe-scope-mask__label';
            lbl.textContent = dbeT('switchingScope', 'Switching scope…');
            masks[0].appendChild(lbl);
        }
        var cleanup = function () {
            masks.forEach(function (m) {
                m.classList.add('is-fading');
                setTimeout(function () { if (m.parentNode) { m.parentNode.removeChild(m); } }, 340);
            });
        };
        var p;
        try { p = promiseFactory(); } catch (e) { cleanup(); throw e; }
        if (p && typeof p.then === 'function') { p.then(cleanup, cleanup); }
        else { setTimeout(cleanup, 400); }
        return p;
    }

    /* Handle to the visible left-panel (Styles) Monaco editor. window.monaco is
       NOT global here, but Builderius exposes the namespace at
       window.Builderius.API.monaco — that gives getEditors(), Range and the
       reveal/decoration API the "All CSS" jump needs. Returns {m, ed} or null. */
    function leftPanelMonaco() {
        try {
            var m = window.Builderius.API.monaco;
            if (!m || !m.editor || !m.editor.getEditors) { return null; }
            var eds = m.editor.getEditors();
            for (var i = 0; i < eds.length; i++) {
                var n = eds[i].getDomNode && eds[i].getDomNode();
                if (n && n.offsetParent !== null && n.closest('.uniLeftPanel')) { return { m: m, ed: eds[i] }; }
            }
        } catch (e) { /* API shape changed — jump degrades to a no-op */ }
        return null;
    }

    /* The native "Selector CSS" | "All CSS" sub-tab (label-matched) in the Styles
       code editor. These are the only .uniPanelTabs__tab in the left panel
       carrying that text, so a text match is unambiguous. */
    function cssViewTab(label) {
        var lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return null; }
        var tabs = [].slice.call(lp.querySelectorAll('.uniPanelTabs__tab'));
        for (var i = 0; i < tabs.length; i++) {
            if ((tabs[i].textContent || '').trim() === label) { return tabs[i]; }
        }
        return null;
    }

    /* Reveal the current selector's rule in the (already-open) All CSS view and
       flash it, so the eye lands on where its CSS lives in the full stylesheet.
       In All CSS the token is RESOLVED (e.g. `.page-content {`), not `%selector%`. */
    var dbeAllCssDecos = [];
    var dbeFlashGen = 0; // two rapid All-CSS clicks = two live polls; only the newest may touch the shared decorations
    function flashSelectorLine(name) {
        var gen = ++dbeFlashGen;
        var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // The class as a standalone selector in a rule head — not a value, and
        // not a longer BEM sibling (.card must not match .card__title).
        var re = new RegExp('(^|[\\s,>+~(])' + esc + '(?![\\w-])');
        // Reaching All CSS triggers several builder re-renders that swap the
        // Monaco instance; a decoration applied mid-churn is dropped with the old
        // editor. So WAIT for the editor to settle — the All-CSS model present and
        // its length unchanged for two ticks — then flash the live one once.
        var lastLen = -1, stable = 0, tries = 0;
        (function poll() {
            if (gen !== dbeFlashGen) { return; } // a newer flash took over
            var h = leftPanelMonaco();
            var text = h ? h.ed.getModel().getValue() : '';
            var ready = !!h && text.indexOf(name) > -1;
            stable = (ready && text.length === lastLen) ? stable + 1 : 0;
            lastLen = ready ? text.length : -1;
            if (ready && stable >= 2) {
                var lines = text.split('\n'), lineNo = -1;
                for (var i = 0; i < lines.length; i++) { if (re.test(lines[i])) { lineNo = i + 1; break; } }
                if (lineNo > 0) {
                    try {
                        dbeAllCssDecos = h.ed.deltaDecorations(dbeAllCssDecos, [{
                            range: new h.m.Range(lineNo, 1, lineNo, 1),
                            options: { isWholeLine: true, className: 'dbe-allcss-flash', linesDecorationsClassName: 'dbe-allcss-flash-gutter' }
                        }]);
                        h.ed.revealLineInCenter(lineNo);
                        // A flash to locate, not a permanent mark — clear it after a beat.
                        setTimeout(function () {
                            if (gen !== dbeFlashGen) { return; } // the decorations belong to a newer flash now
                            var g = leftPanelMonaco();
                            try { if (g) { g.ed.deltaDecorations(dbeAllCssDecos, []); } } catch (e) { /* editor gone */ }
                            dbeAllCssDecos = [];
                        }, 2600);
                    } catch (e) { dbeAllCssDecos = []; }
                }
                return;
            }
            if (tries++ < 45) { setTimeout(poll, 150); }   // wait up to ~7s for the churn to settle
        })();
    }

    /* A top-level Navigator tab (Elements / Selectors / CSS vars) by label.
       "Selectors" is unique across every .uniPanelTabs__tab, so no scoping. */
    function navPanelTab(label) {
        var tabs = [].slice.call(document.querySelectorAll('.uniPanelTabs__tab'));
        for (var i = 0; i < tabs.length; i++) {
            if ((tabs[i].textContent || '').trim() === label) { return tabs[i]; }
        }
        return null;
    }

    /* Scope-bar "All CSS" button. The native "All CSS" view lives in the
       Navigator's Selectors tab, NOT the element's Styles editor where this
       button sits — the two are separate panels. So this drives the same route
       a user would: open Selectors → pick the selector (which mounts the
       Selector CSS | All CSS sub-tabs) → switch to All CSS → flash the rule.
       Scope (Global/Template) rides the shared store value, so All CSS already
       shows whichever the switch beside this button has active. Each step waits
       for the builder to re-render before the next (it rebuilds the panel). */
    function openAllCss() {
        var lp = document.querySelector('.uniLeftPanel');
        var name = lp ? currentSelectorName(lp) : '';   // capture before we navigate away
        var flashName = (name && name.charAt(0) === '.') ? name : '';  // only class selectors flash safely
        var nav = navPanelTab('Selectors');
        if (!nav) { return; }
        clickSeq(nav);   // the Selectors list is React-driven — plain .click() is ignored, so fire the full pointer sequence
        // Switching to Selectors from an active element re-renders the list a few
        // times; a single item click during that churn hits a node that is about
        // to be replaced and is lost. Re-click the current selector (or any item,
        // to bootstrap) until the Selector CSS | All CSS sub-tabs actually mount.
        clickSelectorUntilLoaded(name, 30, function (allTab) {
            if (!allTab) { return; }
            if (!allTab.classList.contains('active')) { clickSeq(allTab); }  // picking an item may already land on All CSS
            if (flashName) { flashSelectorLine(flashName); }                 // flashSelectorLine polls for the live editor itself
        });
    }

    /* Re-click a Selectors-list item until the CSS editor mounts (its All CSS
       sub-tab appears), tolerating the list's post-navigation re-renders. Calls
       done(allTab) on success, done(null) if it never mounts. */
    function clickSelectorUntilLoaded(name, attemptsLeft, done) {
        var allTab = cssViewTab('All CSS');
        if (allTab) { done(allTab); return; }
        if (attemptsLeft <= 0) { done(null); return; }
        var items = document.querySelectorAll('.uniSelectorsCss__item');
        if (items.length) {
            var target = null;
            for (var i = 0; i < items.length && name; i++) {
                if ((items[i].textContent || '').trim() === name) { target = items[i]; break; }
            }
            clickSeq(target || items[0]);
        }
        setTimeout(function () { clickSelectorUntilLoaded(name, attemptsLeft - 1, done); }, 120);
    }

    function ensureScopeBar() {
        var lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return; }
        if (!isCssCodeMode(lp)) {
            lp.removeAttribute('data-dbe-level');
            var ex = lp.querySelector('.dbe-scope-bar');
            if (ex) { ex.remove(); }
            return;
        }
        var level = currentCssLevel(lp);
        lp.setAttribute('data-dbe-level', level);
        var picker = lp.querySelector('.uniSettingsPageModuleDataForEditorWrapper');
        if (!picker) { return; }
        var bar = lp.querySelector('.dbe-scope-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'dbe-scope-bar';
            var badge = document.createElement('span');
            badge.className = 'dbe-scope-badge';
            // Builderius shows a class's EXISTING rules in the editor no matter
            // which scope is active — the scope only routes where edits are
            // saved. Spell that out, or a rule seen under Global (but stored in
            // Template) gets silently forked into global CSS by an edit.
            badge.setAttribute('data-dbe-tip',
                dbeT('scopeBadgeTip', 'Scope controls where edits are SAVED. The editor shows the ' +
                'selector’s existing rules from both scopes, so a rule you ' +
                'see here may be stored in the other scope.'));
            badge.tabIndex = 0;
            bar.appendChild(badge);
            var sw = document.createElement('div');
            sw.className = 'dbe-scope-switch';
            sw.setAttribute('role', 'group');
            sw.setAttribute('aria-label', dbeT('cssScope', 'CSS scope'));
            ['global', 'template'].forEach(function (sc) {
                var b = document.createElement('button');
                b.type = 'button';
                b.setAttribute('data-scope', sc);
                b.textContent = sc === 'global' ? dbeT('scopeGlobal', 'Global') : entityScopeLabel();
                b.addEventListener('click', function () {
                    // Fast path (store write) is instant — no cover needed. Only
                    // the slow Selectors-tab bounce gets masked: it is a multi-
                    // step, builder-re-rendered re-selection (~2.5s) that would
                    // flicker. (document.startViewTransition CAN'T smooth that
                    // one: its update callback must settle quickly, but the steps
                    // depend on the builder re-rendering, which the transition's
                    // render-suppression stalls — it times out and aborts.)
                    if (scopeStoreValue() !== null) { setScope(sc); }
                    else { withScopeMask(function () { return setScope(sc); }); }
                });
                sw.appendChild(b);
            });
            bar.appendChild(sw);
            // "All CSS": jump from this selector's rules to the whole active-scope
            // stylesheet, with the selector's rule flashed. Sits after the scope
            // switch so the cluster reads scope → view.
            var allBtn = document.createElement('button');
            allBtn.type = 'button';
            allBtn.className = 'dbe-scope-allcss';
            // Icon-only (Builderius' own CSS-file glyph, cloned so it tracks any
            // icon change) to leave the Template/Component label its full width.
            // The label moves to the accessible name + tooltip. Text fallback if
            // the native icon isn't in the DOM.
            var cssIcon = document.querySelector('.uniIconCssMode svg');
            if (cssIcon) { allBtn.appendChild(cssIcon.cloneNode(true)); allBtn.classList.add('dbe-scope-allcss--icon'); }
            else { allBtn.textContent = dbeT('scopeAllCss', 'All CSS'); }
            allBtn.setAttribute('aria-label', dbeT('scopeAllCss', 'All CSS'));
            allBtn.setAttribute('data-dbe-tip', dbeT('scopeAllCssTip', 'Show the full CSS for the active scope and jump to this selector'));
            allBtn.addEventListener('click', openAllCss);
            bar.appendChild(allBtn);
            if (picker.nextSibling) { picker.parentNode.insertBefore(bar, picker.nextSibling); }
            else { picker.parentNode.appendChild(bar); }
        }
        var entLabel = entityScopeLabel();
        // Only write when the text actually changes: this runs every schedule()
        // tick, and rewriting textContent replaces the text node even when the
        // value is identical — a childList mutation the left-panel observer would
        // catch, re-scheduling us into a self-sustaining loop (the label visibly
        // flickered in the DOM).
        var badgeText = level === 'local' ? dbeT('scopeLocal', 'Local') : (level === 'template' ? entLabel : dbeT('scopeGlobal', 'Global'));
        var badge = bar.querySelector('.dbe-scope-badge');
        if (badge.textContent !== badgeText) { badge.textContent = badgeText; }
        [].slice.call(bar.querySelectorAll('.dbe-scope-switch button')).forEach(function (b) {
            var sc = b.getAttribute('data-scope');
            if (sc === 'template' && b.textContent !== entLabel) { b.textContent = entLabel; } // keep in sync after an entity switch
            b.classList.toggle('is-active', sc === dbeScope);
        });
        // "All CSS" needs a class selector to locate — a %local% one-off has no
        // shared rule to jump to, so disable it at the local level.
        var allBtn = bar.querySelector('.dbe-scope-allcss');
        if (allBtn) { allBtn.disabled = (level === 'local'); }
    }

    /* (h) Scope isolation.

       The native per-selector CSS editor shows a class's rules from whichever
       scope PHYSICALLY stores them, ignoring the active Global/Template scope —
       the scope only routes where a SAVE lands. So the same rules appear under
       both scopes, and an edit made while the "wrong" scope is active silently
       forks the rules into it. We can't rebind the native Monaco editor
       reliably: neither writing `isGlobalScope` nor the public
       `cssSelector.modifyCssObj` hook re-renders it (verified 8 Jul 2026 against
       the live store — the editor content is bound to a model set at selection
       time and nothing refreshes it on a scope flip).

       So we drive the truth from the one authoritative source instead: each
       scope's raw stylesheet in the store (getGlobalSettings.css /
       getEntitySettings.css — the latter is the component's OR the template's
       CSS, whichever entity is open, so this works identically for both). When
       the active scope has NO rules for the selector but the other scope does,
       we cover the editor — hiding the phantom rules and blocking the
       fork-prone edit — and offer a one-click switch. A status line names the
       scope the visible rules belong to at all times.

       Base breakpoint + class selectors only: %local% is unambiguous, and
       per-breakpoint presence isn't reliably parseable from the flat stylesheet
       (a false "empty" would hide real CSS). This supersedes the older
       REST-fed scope guard, which only warned and left the merged view intact. */
    function scopeCss(which) {
        try {
            var s = store().storeGet(which === 'global' ? 'getGlobalSettings' : 'getEntitySettings');
            return s && typeof s.css === 'string' ? s.css : '';
        } catch (e) { return ''; }
    }
    /* Strip comments, collapse whitespace, tighten comma groups — so a stored
       rule head compares equal to the store's `activeSelector` string. */
    function normSel(str) {
        return String(str).replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ').trim();
    }
    /* True when `selector` is a base-breakpoint (top-level) rule head in `css`.
       Walks balanced braces; conditional at-rule bodies (@media/@supports/…) and
       other at-rules (@font-face, @keyframes) are skipped, so a responsive
       override never counts as a base rule. Grouped heads (`.a, .b`) match on
       any member. */
    function selectorInScope(css, selector) {
        if (!css) { return false; }
        var want = normSel(selector), i = 0, n = css.length;
        while (i < n) {
            if (css[i] === '/' && css[i + 1] === '*') { var e = css.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
            var open = css.indexOf('{', i);
            if (open < 0) { break; }
            var head = css.slice(i, open);
            var depth = 1, j = open + 1;
            while (j < n && depth > 0) {
                var c = css[j];
                if (c === '/' && css[j + 1] === '*') { var e2 = css.indexOf('*/', j + 2); j = e2 < 0 ? n : e2 + 2; continue; }
                if (c === '{') { depth++; } else if (c === '}') { depth--; }
                j++;
            }
            var h = normSel(head);
            if (h.charAt(0) !== '@' && (h === want || h.split(',').indexOf(want) >= 0)) { return true; }
            i = j;
        }
        return false;
    }

    /* Render the scope status line for the active selector. Idempotent and
       signature-guarded so an unchanged tick writes no DOM (the panel
       MutationObserver re-runs schedule() on our own edits otherwise). */
    function ensureScopeIsolation() {
        var lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return; }
        var mon = lp.querySelector('.monaco-editor');
        var holder = mon && mon.parentElement;
        function teardown() {
            var st = lp.querySelector('.dbe-scope-status'); if (st) { st.remove(); }
            var cov = lp.querySelector('.dbe-scope-cover'); if (cov) { cov.remove(); }
            if (holder) { holder.classList.remove('dbe-scope-hold'); }
            if (mon) { mon.classList.remove('dbe-scope-covered'); mon.removeAttribute('inert'); }
        }
        if (!isCssCodeMode(lp) || !holder) { return teardown(); }
        var sf; try { sf = store(); } catch (e) { return teardown(); }
        var sel, bp, isGlobal;
        try {
            sel = sf.storeGet('activeSelector');
            bp = sf.storeGet('activeBreakpoint') || '';
            isGlobal = sf.storeGet('isGlobalScope') === true;
        } catch (e) { return teardown(); }
        // Base breakpoint only — see the note above. The local (element) scope
        // surfaces when NO class is selected: activeSelector is empty and
        // Builderius targets the element's own autogenerated %local% class. Class
        // selectors are compared across scopes; any other selector kind (id,
        // element, …) gets no status.
        if (bp !== '') { return teardown(); }
        var isLocal = !sel || sel.charAt(0) === '%';         // no class selected, or the %local% / %#local% token
        if (!isLocal && sel.charAt(0) !== '.') { return teardown(); }

        var displaySel = sel;
        var activeName, otherName = '', otherTarget = '', activeHas = false, otherHas = false, state;
        if (isLocal) {
            // %local% is the element's own autogenerated class, derived from the
            // element JSON. It belongs to no class and sits outside the
            // Global/Template scopes, so there is nothing to compare across scopes
            // and never anything to cover.
            state = 'local';
            activeName = dbeT('scopeLocal', 'Local');
            displaySel = '%local%';
        } else {
            activeName = isGlobal ? dbeT('scopeGlobal', 'Global') : entityScopeLabel();
            otherName = isGlobal ? entityScopeLabel() : dbeT('scopeGlobal', 'Global');
            otherTarget = isGlobal ? 'template' : 'global';
            activeHas = selectorInScope(scopeCss(isGlobal ? 'global' : 'entity'), sel);
            otherHas = selectorInScope(scopeCss(isGlobal ? 'entity' : 'global'), sel);
            state = activeHas ? 'own' : (otherHas ? 'elsewhere' : 'new');
        }
        var sig = state + '|' + displaySel + '|' + activeName + '|' + otherName + '|' + (otherHas ? 1 : 0);

        // Status line — always present, anchored under the scope bar.
        var status = lp.querySelector('.dbe-scope-status');
        if (!status) {
            status = document.createElement('div');
            status.className = 'dbe-scope-status';
            status.setAttribute('role', 'status');
            var bar = lp.querySelector('.dbe-scope-bar');
            var anchor = bar || lp.querySelector('.uniSettingsPageModuleDataForEditorWrapper');
            if (!anchor) { return; }
            if (anchor.nextSibling) { anchor.parentNode.insertBefore(status, anchor.nextSibling); }
            else { anchor.parentNode.appendChild(status); }
        }

        if (status.getAttribute('data-dbe-sig') !== sig) {
            status.setAttribute('data-dbe-sig', sig);
            status.setAttribute('data-dbe-state', state);
            var verb = state === 'own' ? dbeFmt(dbeT('scopeEditing', 'Editing %s rules'), activeName)
                : state === 'new' ? dbeFmt(dbeT('scopeNewRule', 'New %s rule'), activeName)
                    : state === 'local' ? dbeT('scopeLocalEditing', 'Editing element styles')
                        : dbeFmt(dbeT('scopeNoRules', 'No %s rules'), activeName); // elsewhere
            status.innerHTML = '';
            var vspan = document.createElement('span');
            vspan.className = 'dbe-scope-status__verb';
            vspan.textContent = verb;
            var code = document.createElement('code');
            code.textContent = displaySel;
            status.appendChild(vspan);
            status.appendChild(code);
            if (state === 'own' && otherHas) {
                var dup = document.createElement('span');
                dup.className = 'dbe-scope-status__dup';
                dup.textContent = ' ' + dbeFmt(dbeT('scopeAlsoIn', '· also in %s'), otherName);
                status.appendChild(dup);
            } else if (state === 'elsewhere') {
                // Name where the rules currently live; the actions live in the
                // editor cover below (built further down).
                var where = document.createElement('span');
                where.className = 'dbe-scope-status__dup';
                where.textContent = ' ' + dbeFmt(dbeT('scopeRulesIn', '· rules in %s'), otherName);
                status.appendChild(where);
            }
        }

        // In "elsewhere" the editor is showing the OTHER scope's rules (Builderius
        // mounts the model where the rules physically live), so typing here would
        // edit — and fork — those rules. Cover the editor with a light, inert
        // scrim until the user picks an action: "Add <scope> rules" seeds an empty
        // editable rule in THIS scope (via seedActiveScope), "Switch to <other>"
        // jumps to where the rules live. Any other state clears the cover.
        if (state === 'elsewhere') {
            holder.classList.add('dbe-scope-hold');
            mon.classList.add('dbe-scope-covered');
            mon.setAttribute('inert', '');                 // block accidental typing / tab-in
            var cover = holder.querySelector('.dbe-scope-cover');
            if (!cover) {
                cover = document.createElement('div');
                cover.className = 'dbe-scope-cover';
                var note = document.createElement('p');
                note.className = 'dbe-scope-cover__note';
                var actions = document.createElement('div');
                actions.className = 'dbe-scope-cover__actions';
                var addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'dbe-scope-status__btn dbe-scope-status__add';
                addBtn.addEventListener('click', function () { seedActiveScope(); });
                var swBtn = document.createElement('button');
                swBtn.type = 'button';
                swBtn.className = 'dbe-scope-status__btn dbe-scope-status__switch';
                swBtn.addEventListener('click', function () {
                    var t = cover.getAttribute('data-dbe-target');
                    if (t) { try { setScope(t); } catch (e) {} }
                });
                actions.appendChild(addBtn);
                actions.appendChild(swBtn);
                cover.appendChild(note);
                cover.appendChild(actions);
                holder.appendChild(cover);
            }
            if (cover.getAttribute('data-dbe-sig') !== sig) {
                cover.setAttribute('data-dbe-sig', sig);
                cover.setAttribute('data-dbe-target', otherTarget);
                cover.querySelector('.dbe-scope-cover__note').textContent =
                    dbeFmt(dbeT('scopeCoverWhy', 'Editing here would change %s rules'), otherName);
                cover.querySelector('.dbe-scope-status__add').textContent = dbeFmt(dbeT('scopeAddHere', 'Add %s rules'), activeName);
                cover.querySelector('.dbe-scope-status__switch').textContent = dbeFmt(dbeT('switchTo', 'Switch to %s'), otherName);
            }
        } else {
            var existingCover = holder.querySelector('.dbe-scope-cover');
            if (existingCover) { existingCover.remove(); }
            holder.classList.remove('dbe-scope-hold');
            mon.classList.remove('dbe-scope-covered');
            mon.removeAttribute('inert');
        }
    }

    /* (i) Theme switcher: cycles light -> dark -> auto, persisted per browser.
       html[data-dbe-theme] selects the token palette (00-tokens.css) and sets
       color-scheme for native controls — no per-element JS repainting. Monaco has its
       own theming: when the bundle exposes window.monaco we retheme it to
       match; otherwise the code editor stays a dark island (documented
       compromise — never touch its fonts or colours directly, see the
       caret-drift note). */
    var THEME_ORDER = ['light', 'dark', 'auto'];
    var THEME_ICONS = {
        light: '<circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M7 .9v1.7M7 11.4v1.7M.9 7h1.7M11.4 7h1.7M2.7 2.7l1.2 1.2M10.1 10.1l1.2 1.2M11.3 2.7l-1.2 1.2M3.9 10.1 2.7 11.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
        dark:  '<path d="M12.1 8.5A5.5 5.5 0 0 1 5.5 1.9 5.6 5.6 0 1 0 12.1 8.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
        auto:  '<circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 1.5a5.5 5.5 0 0 1 0 11Z" fill="currentColor"/>'
    };
    /* Translated display names for the theme/density keywords (the keywords
       themselves stay English — they are data attributes and storage keys). */
    function dbeModeName(mode) {
        return {
            light: dbeT('themeLight', 'light'),
            dark: dbeT('themeDark', 'dark'),
            auto: dbeT('themeAuto', 'auto'),
            comfortable: dbeT('densityComfortable', 'comfortable'),
            compact: dbeT('densityCompact', 'compact')
        }[mode] || mode;
    }

    /* Shared live region for the top-bar mode toggles (theme, density). The
       toggles rewrite their own aria-label on each click, but a focused button
       whose label changes silently is NOT re-announced by NVDA/VoiceOver, so
       the switch was inaudible. A role="status" region carries the result
       instead — the joshwcomeau pattern. Created eagerly when a toggle mounts
       (dbeEnsureModeStatus) so it is present in the DOM before the first update;
       a live region added and written in the same tick is unreliable. */
    var dbeModeStatus = null;
    function dbeEnsureModeStatus() {
        if (dbeModeStatus && document.body.contains(dbeModeStatus)) { return dbeModeStatus; }
        dbeModeStatus = document.createElement('div');
        dbeModeStatus.className = 'dbe-visually-hidden';
        dbeModeStatus.setAttribute('role', 'status');
        document.body.appendChild(dbeModeStatus);
        return dbeModeStatus;
    }
    function dbeModeAnnounce(msg) {
        dbeEnsureModeStatus().textContent = msg;
    }

    function currentTheme() {
        var t = document.documentElement.dataset.dbeTheme;
        return THEME_ORDER.indexOf(t) !== -1 ? t : ((CFG.theme && CFG.theme.default) || 'auto');
    }
    /* Monaco is deliberately NOT retheming via setTheme(): the light theme is
       produced by the pixel-invert filter in 60-theme.css, refined across
       several releases (find-widget, native-edit-context). A real setTheme('vs')
       underneath that filter would invert a light editor back to dark, so no JS
       theming here — the CSS tracks [data-dbe-theme] and the OS scheme itself. */

    /* Turn off Monaco's minimap (the code-overview strip) on every builder editor.
       43-scope-isolation.css hides the minimap PAINT, but Monaco still reserves
       its width in the layout, so long lines clip ~77px short of the right edge.
       The only real fix is the editor option — which needs the Monaco namespace.
       It is not exposed as window.monaco here, so we pull it out of the builder's
       webpack bundle once (chunk-push to grab __webpack_require__, then find the
       module that exports `editor.getEditors`/`onDidCreateEditor`) and disable the
       minimap on all current editors + every future one. Wrapped throughout: if
       the bundle internals ever change we fail soft and the CSS hide still applies
       (overview gone, width merely reserved). */
    var dbeMonacoNs = null;      // resolved Monaco namespace, cached once found
    var dbeWebpackReq = null;    // the builder bundle's __webpack_require__
    var dbeProbeN = 0;           // unique id per chunk-push so the callback always fires
    var dbeMinimapDone = false;  // current editors done + onDidCreateEditor hooked
    function dbeGetMonaco() {
        if (dbeMonacoNs) { return dbeMonacoNs; }
        try {
            if (!dbeWebpackReq) {
                var chunk = window.webpackChunkbuilderius;
                if (!chunk || typeof chunk.push !== 'function') { return null; }
                var req = null;
                chunk.push([['dbe-monaco-' + (dbeProbeN++)], {}, function (r) { req = r; }]);
                if (typeof req === 'function' && req.m) { dbeWebpackReq = req; } else { return null; }
            }
            var m = dbeWebpackReq.m;
            for (var id in m) {
                var src;
                try { src = m[id].toString(); } catch (e) { continue; }
                if (src.indexOf('onDidCreateEditor') < 0 && src.indexOf('getEditors') < 0) { continue; }
                var ex;
                try { ex = dbeWebpackReq(id); } catch (e) { continue; }
                if (ex && ex.editor && typeof ex.editor.getEditors === 'function'
                    && typeof ex.editor.onDidCreateEditor === 'function') {
                    dbeMonacoNs = ex;
                    return ex;
                }
            }
        } catch (e) { /* bundle internals changed — the CSS hide is the fallback */ }
        return null;
    }
    function dbeDisableMinimap() {
        if (dbeMinimapDone) { return; }
        if (!document.querySelector('.monaco-editor')) { return; } // Monaco not loaded yet
        var monaco = dbeGetMonaco();
        if (!monaco) { return; }
        try {
            monaco.editor.getEditors().forEach(function (ed) {
                try { ed.updateOptions({ minimap: { enabled: false } }); } catch (e) {}
            });
            monaco.editor.onDidCreateEditor(function (ed) {
                try { ed.updateOptions({ minimap: { enabled: false } }); } catch (e) {}
            });
            dbeMinimapDone = true;
        } catch (e) { /* fail soft */ }
    }
    function decorateThemeButton(btn) {
        var t = currentTheme();
        var next = THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length];
        btn.querySelector('span').innerHTML =
            '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            THEME_ICONS[t] + '</svg>';
        var tip = dbeFmt(dbeT('themeTip', 'Theme: %1$s (switch to %2$s)'), dbeModeName(t), dbeModeName(next));
        setTip(btn, tip);
        // setTip only sets aria-label when absent (it must not clobber static
        // controls an observer re-decorates); this label is dynamic, so keep the
        // accessible name in sync with the current state on every toggle.
        btn.setAttribute('aria-label', tip);
    }
    function setTheme(t, announce) {
        document.documentElement.dataset.dbeTheme = t;
        try { localStorage.setItem('dbeBuilderTheme', t); } catch (e) {}
        var btn = document.querySelector('.dbe-theme-btn');
        if (btn) { decorateThemeButton(btn); }
        // Only speak on a user switch, never on the initial restore.
        if (announce) { dbeModeAnnounce(dbeFmt(dbeT('themeAnnounce', 'Theme set to %s'), dbeModeName(t))); }
    }
    function ensureThemeButton() {
        var col = document.querySelector('.uniTopPanel__rightCol');
        if (!col || col.querySelector('.dbe-theme-btn')) { return; }
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'uniPanelButton dbe-theme-btn';
        btn.appendChild(document.createElement('span'));
        btn.addEventListener('click', function () {
            setTheme(THEME_ORDER[(THEME_ORDER.indexOf(currentTheme()) + 1) % THEME_ORDER.length], true);
        });
        decorateThemeButton(btn);
        dbeEnsureModeStatus(); // present before the first click so the switch is announced
        col.insertBefore(btn, col.firstChild);
    }

    /* (i2) Density toggle: comfortable <-> compact, persisted per browser.
       html[data-dbe-density] drives the row/padding tokens (62-density.css). */
    var DENSITY_ICONS = {
        comfortable: '<path d="M1.5 3h11M1.5 7h11M1.5 11h11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
        compact: '<path d="M1.5 2.4h11M1.5 5.4h11M1.5 8.4h11M1.5 11.4h11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'
    };
    function currentDensity() {
        var d = document.documentElement.dataset.dbeDensity;
        return d === 'compact' ? 'compact' : 'comfortable';
    }
    function decorateDensityButton(btn) {
        var d = currentDensity();
        var next = d === 'compact' ? 'comfortable' : 'compact';
        btn.querySelector('span').innerHTML =
            '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            DENSITY_ICONS[d] + '</svg>';
        var tip = dbeFmt(dbeT('densityTip', 'Density: %1$s (switch to %2$s)'), dbeModeName(d), dbeModeName(next));
        setTip(btn, tip);
        // Dynamic label — set explicitly so the accessible name tracks each toggle
        // (setTip won't overwrite an existing aria-label).
        btn.setAttribute('aria-label', tip);
    }
    function ensureDensityButton() {
        var col = document.querySelector('.uniTopPanel__rightCol');
        if (!col || col.querySelector('.dbe-density-btn')) { return; }
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'uniPanelButton dbe-density-btn';
        btn.appendChild(document.createElement('span'));
        btn.addEventListener('click', function () {
            var next = currentDensity() === 'compact' ? 'comfortable' : 'compact';
            document.documentElement.dataset.dbeDensity = next;
            try { localStorage.setItem('dbeBuilderDensity', next); } catch (e) {}
            decorateDensityButton(btn);
            dbeModeAnnounce(dbeFmt(dbeT('densityAnnounce', 'Density set to %s'), dbeModeName(next)));
        });
        decorateDensityButton(btn);
        dbeEnsureModeStatus(); // present before the first click so the switch is announced
        // Sit next to the theme button when both are on.
        var themeBtn = col.querySelector('.dbe-theme-btn');
        col.insertBefore(btn, themeBtn ? themeBtn.nextSibling : col.firstChild);
    }

    /* (tb) Top-bar keyboard groups (topbar_toolbar). Give the top-bar control
       clusters correct grouping semantics for screen readers and keyboard users:

       - The breakpoint switcher becomes a radio group (one of base/desktop/
         tablet/mobile) — it announces which breakpoint is current and how many
         there are, and the arrow keys move and select the way radios do, with a
         single Tab stop into the group.
       - The canvas width + zoom fields become a labelled role="group". They are
         NOT a roving toolbar: those are text inputs whose own arrow keys move the
         caret / change the value, so a group that captured the arrows would break
         them.

       (The theme and density buttons are deliberately left as two separate,
       individually-labelled buttons — with only two of them, a toolbar wrapper
       adds keyboard indirection for no real gain.)

       Everything re-runs on the schedule() tick, so it re-applies after React
       re-renders the top bar; syncing tabindex/state is idempotent and the
       keydown handler binds once per container (guarded by a flag). The generic
       dbeEnsureGroup helper also supports a plain role="toolbar" (focus-only
       arrows) for future all-button clusters. */

    function dbeRovingItems(container, sel) {
        return [].slice.call(container.querySelectorAll(sel)).filter(function (el) {
            return el.offsetParent !== null && !el.disabled; // visible + enabled
        });
    }

    /* The selected item in a group. Builderius marks the current breakpoint with
       an `active` class — the source of truth — so prefer it whenever any item
       carries it. Only fall back to the ARIA single-select states when nothing is
       `active`. Crucially this must NOT read `aria-checked` back as a truth signal
       while an `active` item exists: dbeSyncRoving mirrors the active state onto
       aria-checked itself, so a stale mirrored value (left on the old breakpoint
       after a resize moves `active` elsewhere) would otherwise be read as current
       and re-affirmed every tick, never catching up. */
    function dbeGroupActive(items, activeClass) {
        var cls = activeClass || 'active';
        var byClass = items.filter(function (el) { return el.classList.contains(cls); })[0];
        if (byClass) { return byClass; }
        return items.filter(function (el) {
            return el.getAttribute('aria-checked') === 'true'
                || el.getAttribute('aria-pressed') === 'true'
                || el.getAttribute('aria-selected') === 'true';
        })[0] || null;
    }

    /* Keep exactly one item in the tab order (tabindex=0), the rest at -1, and —
       for a single-select group (opts.selectAttr, e.g. 'aria-checked') — mirror
       the selected state onto every item. For the tab stop, prefer the item that
       already holds it (so a keyboard user's position survives a re-render), then
       the selected/active one, then the first. */
    function dbeSyncRoving(container, sel, opts) {
        opts = opts || {};
        var items = dbeRovingItems(container, sel);
        if (!items.length) { return; }
        var active = dbeGroupActive(items, opts.activeClass);
        if (opts.selectAttr) {
            items.forEach(function (el) { el.setAttribute(opts.selectAttr, el === active ? 'true' : 'false'); });
        }
        var current = items.filter(function (el) { return el.getAttribute('tabindex') === '0'; })[0];
        var keep = current || active || items[0];
        items.forEach(function (el) { el.setAttribute('tabindex', el === keep ? '0' : '-1'); });
    }

    /* Generic keyboard single-tab-stop group. opts:
         role         container role ('toolbar' default, 'radiogroup' for a
                      mutually-exclusive selector)
         itemRole     role stamped on each item (e.g. 'radio')
         selectAttr   single-select state attribute to mirror ('aria-checked')
         selectOnMove activate the item the arrows land on — the conforming radio
                      behaviour (arrows move AND select). Toolbars leave this off,
                      so arrows only move focus.
         activeClass  class token that marks the current item when Builderius uses
                      something other than a bare 'active' (e.g. a BEM modifier like
                      'uniAiChat__terminalTab--active'). Defaults to 'active'.
       Re-runs each schedule() tick (roles + state stay in sync through React
       re-renders); the keydown handler binds once per container. */
    function dbeEnsureGroup(container, label, sel, opts) {
        if (!container) { return; }
        opts = opts || {};
        var role = opts.role || 'toolbar';
        // APG: a horizontal tablist or toolbar navigates with Left/Right only —
        // Up/Down belong to a vertical orientation and must pass through. A radio
        // group navigates with both axes (Right/Down next, Left/Up previous).
        // Default from the role; override with opts.orientation.
        var orientation = opts.orientation || (role === 'radiogroup' ? 'both' : 'horizontal');
        var useHoriz = orientation !== 'vertical';
        var useVert = orientation === 'vertical' || orientation === 'both';
        if (container.getAttribute('role') !== role) { container.setAttribute('role', role); }
        if (label && container.getAttribute('aria-label') !== label) { container.setAttribute('aria-label', label); }
        // A vertical group announces its orientation; horizontal is the default.
        if (orientation === 'vertical' && container.getAttribute('aria-orientation') !== 'vertical') {
            container.setAttribute('aria-orientation', 'vertical');
        }
        if (opts.itemRole) {
            dbeRovingItems(container, sel).forEach(function (el) {
                if (el.getAttribute('role') !== opts.itemRole) { el.setAttribute('role', opts.itemRole); }
            });
        }
        dbeSyncRoving(container, sel, opts);
        if (container.dbeGroupBound) { return; }
        container.dbeGroupBound = true;
        container.addEventListener('keydown', function (e) {
            var moveNext = (useHoriz && e.key === 'ArrowRight') || (useVert && e.key === 'ArrowDown');
            var movePrev = (useHoriz && e.key === 'ArrowLeft') || (useVert && e.key === 'ArrowUp');
            if (!moveNext && !movePrev && e.key !== 'Home' && e.key !== 'End') { return; }
            var items = dbeRovingItems(container, sel);
            if (!items.length) { return; }
            var focused = document.activeElement && document.activeElement.closest ? document.activeElement.closest(sel) : null;
            var i = items.indexOf(focused);
            if (i === -1) { return; }
            var next = i;
            if (moveNext) { next = (i + 1) % items.length; }
            else if (movePrev) { next = (i - 1 + items.length) % items.length; }
            else if (e.key === 'Home') { next = 0; }
            else if (e.key === 'End') { next = items.length - 1; }
            e.preventDefault();
            e.stopPropagation();
            items.forEach(function (el, k) { el.setAttribute('tabindex', k === next ? '0' : '-1'); });
            // Only an automatic (selectOnMove) group selects on move. A manually
            // activated tablist leaves aria-selected on the active tab (mirrored
            // from its class by dbeSyncRoving) until the user presses Enter/Space.
            if (opts.selectAttr && opts.selectOnMove) {
                items.forEach(function (el, k) { el.setAttribute(opts.selectAttr, k === next ? 'true' : 'false'); });
            }
            items[next].focus();
            // Radio semantics: moving the selection also makes it take effect.
            // Builderius switches the active breakpoint on click; the class it sets
            // is re-mirrored to aria-checked on the next schedule() tick.
            if (opts.selectOnMove && next !== i) {
                try { items[next].click(); } catch (err) {}
                // The switch re-renders the breakpoint row and drops focus; restore
                // it next frame to the (possibly rebuilt) selected radio so keyboard
                // users are not stranded. Re-query in case the nodes were replaced.
                requestAnimationFrame(function () {
                    var scope = container.isConnected ? container : document;
                    var again = dbeRovingItems(scope, sel);
                    var target = dbeGroupActive(again, opts.activeClass) || again[Math.min(next, again.length - 1)];
                    if (target && document.activeElement !== target) {
                        target.setAttribute('tabindex', '0');
                        target.focus();
                    }
                });
            }
        });
    }

    /* Inserter keyboard navigation (inserter_keyboard). The element Inserter
       (left panel) lists ~60 add-element buttons across categories. They are
       native <button>s, so every one is a tab stop — reaching a lower category
       means tabbing past everything above it. Wire each category's grid as a
       single tab stop with roving tabindex and grid-aware arrow keys, mirroring
       the WordPress block inserter: Tab moves category-to-category, arrows move
       within a category (Left/Right along a row, Up/Down between rows), Home/End
       jump to the first/last, and Enter/Space still inserts (native button). The
       category grid gets role="group" + the category name — the honest semantics
       for a set of action buttons, without overstating them as a selectable
       listbox. Re-runs each schedule() tick (roving stays synced through the
       search filter's re-renders); the keydown handler binds once per grid. */
    function dbeInserterCols(items) {
        // Column count = how many leading items share the first item's row (same
        // top). Read from layout each keypress so it survives a panel resize.
        if (!items.length) { return 1; }
        var top0 = items[0].getBoundingClientRect().top;
        var cols = 0;
        for (var k = 0; k < items.length; k++) {
            if (Math.abs(items[k].getBoundingClientRect().top - top0) <= 1) { cols++; } else { break; }
        }
        return cols || 1;
    }

    function ensureInserterKeyboard() {
        var sel = '.uniModItems__item';
        document.querySelectorAll('.uniModItems__catWrapper').forEach(function (cw) {
            var container = cw.querySelector('.uniModItems__items');
            if (!container) { return; }
            var titleEl = cw.querySelector('.uniCatTitle');
            var label = titleEl ? (titleEl.textContent || '').trim() : '';
            if (container.getAttribute('role') !== 'group') { container.setAttribute('role', 'group'); }
            if (label && container.getAttribute('aria-label') !== label) { container.setAttribute('aria-label', label); }
            dbeSyncRoving(container, sel);
            if (container.dbeInserterBound) { return; }
            container.dbeInserterBound = true;
            container.addEventListener('keydown', function (e) {
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(e.key) === -1) { return; }
                var items = dbeRovingItems(container, sel);
                if (!items.length) { return; }
                var focused = document.activeElement && document.activeElement.closest ? document.activeElement.closest(sel) : null;
                var i = items.indexOf(focused);
                if (i === -1) { return; }
                var cols = dbeInserterCols(items);
                var next = i;
                if (e.key === 'ArrowRight') { next = Math.min(i + 1, items.length - 1); }
                else if (e.key === 'ArrowLeft') { next = Math.max(i - 1, 0); }
                else if (e.key === 'ArrowDown') { next = (i + cols < items.length) ? i + cols : i; }
                else if (e.key === 'ArrowUp') { next = (i - cols >= 0) ? i - cols : i; }
                else if (e.key === 'Home') { next = 0; }
                else if (e.key === 'End') { next = items.length - 1; }
                e.preventDefault();
                e.stopPropagation();
                if (next === i) { return; }
                items.forEach(function (el, k) { el.setAttribute('tabindex', k === next ? '0' : '-1'); });
                items[next].focus();
            });
        });
    }

    /* (pt) Panel tabs (panel_tabs). The settings panel's Content / Styles strip
       and the Navigator's Elements / Selectors / CSS vars strip are rows of
       <button>s with no tab semantics: a screen reader cannot tell they are tabs
       or which is current, and there is no single-Tab-stop arrow-key model. Wire
       each strip as an APG tab list — role=tablist, each tab role=tab +
       aria-selected mirrored from the native `active` class, one Tab stop where
       arrows move focus and Enter/Space activates (the tabs are native buttons,
       so activation is their own click). MANUAL activation, not automatic:
       switching to Styles mounts the CSS editor, which grabs focus, and the
       settings strip is replaced by our code-mode replica — so auto-switching on
       arrow would fight the editor for focus and disorient. Arrows therefore only
       move the roving focus between tabs; the user presses Enter/Space when ready
       to switch. aria-selected tracks the native `active` class, so it stays on
       the shown tab until one is actually activated. Not dbeEnsureGroup: its
       selectOnMove refocus is document-wide, and the shared .uniPanelTabs__tab
       selector would let it land on the other panel's tablist. */
    function ensurePanelTabs() {
        ['.uniLeftPanel', '.uniRightPanel'].forEach(function (panelSel) {
            var panel = document.querySelector(panelSel);
            var strip = panel && panel.querySelector('.uniPanelTabs');
            if (!strip || !strip.querySelector('.uniPanelTabs__tab')) { return; }
            var sel = '.uniPanelTabs__tab';
            var label = panelSel === '.uniRightPanel'
                ? dbeT('navigatorTabs', 'Navigator views')
                : dbeT('settingsTabs', 'Element settings');
            if (strip.getAttribute('role') !== 'tablist') { strip.setAttribute('role', 'tablist'); }
            if (strip.getAttribute('aria-label') !== label) { strip.setAttribute('aria-label', label); }
            dbeRovingItems(strip, sel).forEach(function (t) {
                if (t.getAttribute('role') !== 'tab') { t.setAttribute('role', 'tab'); }
                var on = t.classList.contains('active') ? 'true' : 'false';
                if (t.getAttribute('aria-selected') !== on) { t.setAttribute('aria-selected', on); }
            });
            dbeSyncRoving(strip, sel, { activeClass: 'active' });
            if (strip.dbePanelTabsBound) { return; }
            strip.dbePanelTabsBound = true;
            strip.addEventListener('keydown', function (e) {
                // Horizontal tablist (APG): Left/Right move between tabs; Up/Down
                // belong to a vertical tablist and are left to pass through.
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) { return; }
                var items = dbeRovingItems(strip, sel);
                var focused = document.activeElement && document.activeElement.closest ? document.activeElement.closest(sel) : null;
                var i = items.indexOf(focused);
                if (i === -1 || !items.length) { return; }
                e.preventDefault();
                e.stopPropagation();
                var next = i;
                if (e.key === 'ArrowRight') { next = (i + 1) % items.length; }
                else if (e.key === 'ArrowLeft') { next = (i - 1 + items.length) % items.length; }
                else if (e.key === 'Home') { next = 0; }
                else if (e.key === 'End') { next = items.length - 1; }
                if (next === i) { return; }
                // Move the roving focus only; Enter/Space (native button) switches.
                items.forEach(function (el, k) { el.setAttribute('tabindex', k === next ? '0' : '-1'); });
                items[next].focus();
            });
            // Builderius suppresses focus-on-click for these tab buttons (focus
            // falls to <body>) and remounts the strip when the tab switches, so a
            // mouse user is left with no tab focused and the keyboard flow broken.
            // After the remount settles, move focus to the now-active tab — but
            // only when nothing else has legitimately claimed focus (activating
            // Styles mounts the CSS editor, which should keep it). Re-query the
            // live strip: the node captured in this closure is detached by the
            // remount, so focusing its buttons would silently land on <body>.
            strip.addEventListener('click', function (e) {
                if (!e.target.closest(sel)) { return; }
                setTimeout(function () {
                    var ae = document.activeElement;
                    if (ae && ae !== document.body && !(ae.closest && ae.closest('.uniPanelTabs'))) { return; }
                    var live = document.querySelector(panelSel + ' .uniPanelTabs');
                    var active = live && live.querySelector(sel + '.active');
                    if (active) { active.focus(); }
                }, 0);
            });
        });
    }

    function ensureTopbarToolbars() {
        // Breakpoint buttons carry no text, so a radio with no name is useless.
        // The tooltips feature labels them (setTip), but topbar_toolbar must not
        // depend on it being on: name any still-unnamed button from the real
        // breakpoints. Only fills a missing aria-label, so it never fights setTip.
        var bps = dbeBreakpoints();
        document.querySelectorAll('.uniPanelButtonBreakpoint').forEach(function (b, i) {
            if (b.getAttribute('aria-label')) { return; }
            var bp = bps && bps[i];
            b.setAttribute('aria-label', bp
                ? (bp.width
                    ? dbeFmt(dbeT('bpMax', '%1$s (max %2$spx)'), bp.label, bp.width)
                    : dbeFmt(dbeT('bpBase', '%s (base styles, full width)'), bp.label))
                : (DBE_BP_LABELS[i] || dbeT('breakpoint', 'Breakpoint')));
        });
        // Breakpoint switcher — pick exactly one of base/desktop/tablet/mobile.
        // A radio group, not a toolbar: it conveys the mutually-exclusive choice
        // and which breakpoint is current (aria-checked), and arrow keys move and
        // select the way radios do.
        dbeEnsureGroup(
            document.querySelector('.uniGlobalBreakpoints__list'),
            dbeT('toolbarBreakpoints', 'Breakpoints'),
            '.uniPanelButtonBreakpoint',
            { role: 'radiogroup', itemRole: 'radio', selectAttr: 'aria-checked', selectOnMove: true }
        );
        // Canvas width + zoom — a labelled group, not a roving toolbar (the fields
        // own their arrow keys). The fields themselves are labelled in DBE_TIPS.
        var canvas = document.querySelector('.uniGlobalBreakpoints__canvasControl');
        if (canvas) {
            if (canvas.getAttribute('role') !== 'group') { canvas.setAttribute('role', 'group'); }
            var cl = dbeT('groupCanvasSize', 'Canvas size');
            if (canvas.getAttribute('aria-label') !== cl) { canvas.setAttribute('aria-label', cl); }
        }
    }

    /* (tf) Bottom-bar editor tools (footer_toolbar). The footer is a row of
       buttons (Custom CSS, JavaScript, Dynamic Data, Sense AI, …) that reveal a
       shared panel one at a time. It is NOT a tablist: several items are locked
       (Pro), the panel can be collapsed to nothing, and a tab must own a panel
       with one always selected — none of which holds. It is a toolbar of
       disclosure buttons:
         - bar = role="toolbar" with roving arrow-key navigation over the tools;
         - each functional button = aria-expanded (true only when its panel is the
           open one) + aria-controls on the shared panel region;
         - locked buttons = aria-disabled with "(locked)" in the accessible name;
         - the shared panel = a labelled role="region", named after the open tool.
       The footer lives outside the panels the other observers watch, so it wires
       its own (attached once, lazily, when the bar first appears). */
    /* Shared by footer_toolbar and ai_terminal_tabs (previously each attached
       its own identical observer, doubling the callback work). Tracked by NODE,
       not a done-once flag: a flag would outlive a React-replaced bar — the old
       observer dies with the old node and the feature would go silently dead.
       The panel is retried independently of the bar: it can mount later, and
       the old code never re-checked once the bar was seen. */
    var dbeFooterBarNode = null, dbeFooterPanelNode = null;
    var DBE_FOOTER_SCOPE_PANEL_ID = 'dbe-footer-scope-panel';
    function dbeObserveFooter(bar) {
        if (!window.MutationObserver) { return; }
        if (bar && bar !== dbeFooterBarNode) {
            try {
                // Bar: button active/locked class + add/remove (small subtree).
                new MutationObserver(schedule).observe(bar, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
                dbeFooterBarNode = bar;
            } catch (e) {}
        }
        // Panel: open/collapse (content mounts/unmounts, height/style change).
        // Shallow — no subtree — so the Monaco editors inside do not spam it.
        var fp = document.querySelector('.uniFooterPanel');
        if (fp && fp !== dbeFooterPanelNode) {
            try {
                new MutationObserver(schedule).observe(fp, { childList: true, attributes: true, attributeFilter: ['class', 'style'] });
                dbeFooterPanelNode = fp;
            } catch (e) {}
        }
    }
    function ensureFooterToolbar() {
        var bar = document.querySelector('.uniFooterPanelBar');
        if (!bar) { return; }
        dbeObserveFooter(bar);
        var tools = [].slice.call(bar.querySelectorAll('button.uniPanelIconButton--footer'));
        if (!tools.length) { return; }

        var region = document.querySelector('.uniFooterPanelContent');
        var regionId = 'dbe-footer-panel';
        if (region) {
            if (!region.id) { region.id = regionId; }
            if (region.getAttribute('role') !== 'region') { region.setAttribute('role', 'region'); }
        }
        // The panel has no open/closed class; a visible content region means open.
        var open = !!region && region.offsetHeight > 8;
        var activeTool = tools.filter(function (b) { return b.classList.contains('uniPanelIconButton--active'); })[0];

        tools.forEach(function (b) {
            var base = (b.textContent || '').trim(); // aria-label never changes textContent
            if (b.classList.contains('locked')) {
                b.setAttribute('aria-disabled', 'true');
                b.removeAttribute('aria-expanded');
                b.removeAttribute('aria-controls');
                var want = dbeFmt(dbeT('footerLocked', '%s (locked)'), base);
                if (b.getAttribute('aria-label') !== want) { b.setAttribute('aria-label', want); }
            } else {
                b.removeAttribute('aria-disabled');
                if (b.getAttribute('aria-label')) { b.removeAttribute('aria-label'); } // fall back to the text name
                if (region && b.getAttribute('aria-controls') !== regionId) { b.setAttribute('aria-controls', regionId); }
                var expanded = (open && b === activeTool) ? 'true' : 'false';
                if (b.getAttribute('aria-expanded') !== expanded) { b.setAttribute('aria-expanded', expanded); }
            }
        });

        if (region) {
            var rl = (open && activeTool)
                ? dbeFmt(dbeT('footerPanelNamed', '%s panel'), (activeTool.textContent || '').trim())
                : dbeT('footerToolsPanel', 'Editor tools panel');
            if (region.getAttribute('aria-label') !== rl) { region.setAttribute('aria-label', rl); }
        }

        // Toolbar semantics + roving arrow navigation over the tool buttons. Locked
        // buttons stay in the roving set (focusable, aria-disabled) so a keyboard
        // user can discover them and hear that they are locked.
        dbeEnsureGroup(bar, dbeT('toolbarFooterTools', 'Editor tools'), 'button.uniPanelIconButton--footer');

        dbeEnsureFooterScopeTabs();
    }

    /* (tf2) Global / Template scope tabs inside the JavaScript and Dynamic Data
       footer tools (.uniFooterTabScopes). Two stacked buttons that switch the
       editor beside them (.uniFooterTabScopeContent) between the global and the
       template scope — a VERTICAL tablist, but with no tab semantics or keyboard
       model. Wire it as an APG vertical tablist: role=tablist + aria-orientation,
       each button role=tab controlling the content panel, one roving tab stop
       with Up/Down moving between them. Activation is MANUAL (Enter/Space on the
       native button switches, mounting the other scope's editor), so the arrows
       only move focus; aria-selected tracks the native `active` class. Its own
       observer keeps that in sync — the shared footer observer is shallow and
       would miss the deep class toggle on switch. */
    function dbeEnsureFooterScopeTabs() {
        var scope = document.querySelector('.uniFooterTabScopes');
        if (!scope) { return; }
        var content = document.querySelector('.uniFooterTabScopeContent');
        if (content) {
            if (!content.id) { content.id = DBE_FOOTER_SCOPE_PANEL_ID; }
            if (content.getAttribute('role') !== 'tabpanel') { content.setAttribute('role', 'tabpanel'); }
            if (content.getAttribute('tabindex') !== '0') { content.setAttribute('tabindex', '0'); }
        }
        var active = null;
        [].slice.call(scope.querySelectorAll('button')).forEach(function (t, i) {
            if (!t.id) { t.id = 'dbe-footer-scope-tab-' + i; }
            if (content && t.getAttribute('aria-controls') !== content.id) { t.setAttribute('aria-controls', content.id); }
            if (t.classList.contains('active')) { active = t; }
        });
        if (content && active && content.getAttribute('aria-labelledby') !== active.id) {
            content.setAttribute('aria-labelledby', active.id);
        }
        dbeEnsureGroup(scope, dbeT('footerScopeTabs', 'Scope'), 'button', {
            role: 'tablist', itemRole: 'tab', selectAttr: 'aria-selected',
            orientation: 'vertical', activeClass: 'active'
        });
        // Switching scope toggles the `active` class deep inside the footer panel,
        // which the shallow footer observer misses; watch it here so aria-selected
        // and the panel's aria-labelledby follow the switch.
        if (!scope.dbeScopeObserved) {
            scope.dbeScopeObserved = true;
            try {
                new MutationObserver(schedule).observe(scope, { attributes: true, subtree: true, attributeFilter: ['class'] });
            } catch (e) { scope.dbeScopeObserved = false; }
        }
    }

    /* (bm) Accessible Builderius menu (builderius_menu). The menu button in the
       top bar (.uniPanelButton--builderiusMenu) opens a left-panel sidebar
       (.uniNavigator) of templates, pages, components and admin links — but with
       no semantics, no focus management (focus stayed on the page) and no keyboard
       model. It is not a flat list: the category headers (.uniCatTitle) are
       collapsible sections, so it is wired as an APG tree.
         - The button gets aria-haspopup=tree + aria-expanded + aria-controls.
         - The items list (.uniNavigatorItems) becomes role=tree; each category
           heading a level-1 role=treeitem carrying aria-expanded and controlling
           its role=group of level-2 item treeitems.
         - Focus moves to the first row when the menu opens; Up/Down move between
           the visible rows (headers + items), Right opens a collapsed section then
           steps into it, Left collapses it then steps out to the header, Home/End
           jump to the ends. Enter/Space toggles a header (a plain <div>, so the
           click is synthesised) and activates an item (native button).
         - Escape closes the menu and returns focus to the button; so does the
           panel's own Close button (focus is re-homed when the menu closes).
       Collapse leaves no state class, so expanded state is read from whether a
       section's items are on screen. */
    var DBE_MENU_ID = 'dbe-builderius-menu';
    var dbeMenuWasOpen = false;
    var dbeMenuKeyBound = false;
    var DBE_MENU_ROW_SEL = '.uniCatTitle, .uniNavigatorItems__item';

    function dbeMenuTrigger() { return document.querySelector('.uniPanelButton--builderiusMenu'); }
    function dbeMenuList() { return document.querySelector('.uniLeftPanel .uniNavigatorItems'); }
    function dbeMenuIsHeader(el) { return !!(el && el.classList && el.classList.contains('uniCatTitle')); }
    function dbeMenuCatExpanded(header) {
        var cat = header.closest('.uniNavigatorItems__catWrapper');
        var wrap = cat && cat.querySelector('.uniNavigatorItems__items');
        return !!(wrap && wrap.offsetHeight > 0);
    }
    // Navigable rows in DOM order: every category header, plus the items of the
    // expanded sections (a collapsed section's items have no offsetParent).
    function dbeMenuRows() {
        var list = dbeMenuList();
        if (!list) { return []; }
        return [].slice.call(list.querySelectorAll(DBE_MENU_ROW_SEL)).filter(function (el) {
            return el.offsetParent !== null && !el.disabled;
        });
    }
    function dbeMenuFocus(rows, idx) {
        rows.forEach(function (el, k) { el.setAttribute('tabindex', k === idx ? '0' : '-1'); });
        try { rows[idx].focus(); } catch (e) {}
    }

    function ensureBuilderiusMenu() {
        var trigger = dbeMenuTrigger();
        if (!trigger) { return; }
        var open = trigger.classList.contains('active');
        var list = open ? dbeMenuList() : null;

        // Disclosure semantics on the trigger.
        if (trigger.getAttribute('aria-haspopup') !== 'tree') { trigger.setAttribute('aria-haspopup', 'tree'); }
        var exp = open ? 'true' : 'false';
        if (trigger.getAttribute('aria-expanded') !== exp) { trigger.setAttribute('aria-expanded', exp); }
        if (open && list) {
            if (!list.id) { list.id = DBE_MENU_ID; }
            if (trigger.getAttribute('aria-controls') !== list.id) { trigger.setAttribute('aria-controls', list.id); }
        } else if (trigger.hasAttribute('aria-controls')) {
            trigger.removeAttribute('aria-controls');
        }

        if (!open || !list) {
            // The menu just closed. If the close stranded focus (e.g. the panel's
            // Close button, which leaves focus on <body>), return it to the button.
            if (dbeMenuWasOpen) {
                dbeMenuWasOpen = false;
                var ae = document.activeElement;
                if (!ae || ae === document.body) { try { trigger.focus(); } catch (e) {} }
            }
            return;
        }

        if (list.getAttribute('role') !== 'tree') { list.setAttribute('role', 'tree'); }
        var label = dbeT('builderiusMenu', 'Builderius menu');
        if (list.getAttribute('aria-label') !== label) { list.setAttribute('aria-label', label); }

        // Category headings = level-1 expandable treeitems controlling their group.
        [].slice.call(list.querySelectorAll('.uniNavigatorItems__catWrapper')).forEach(function (cat, ci) {
            var title = cat.querySelector('.uniCatTitle');
            var wrap = cat.querySelector('.uniNavigatorItems__items');
            if (title) {
                if (title.getAttribute('role') !== 'treeitem') { title.setAttribute('role', 'treeitem'); }
                if (title.getAttribute('aria-level') !== '1') { title.setAttribute('aria-level', '1'); }
                if (title.hasAttribute('aria-hidden')) { title.removeAttribute('aria-hidden'); }
                var ex = dbeMenuCatExpanded(title) ? 'true' : 'false';
                if (title.getAttribute('aria-expanded') !== ex) { title.setAttribute('aria-expanded', ex); }
                if (wrap) {
                    if (!wrap.id) { wrap.id = 'dbe-menu-grp-' + ci; }
                    if (title.getAttribute('aria-controls') !== wrap.id) { title.setAttribute('aria-controls', wrap.id); }
                }
            }
            if (wrap && wrap.getAttribute('role') !== 'group') { wrap.setAttribute('role', 'group'); }
        });
        // Items = level-2 treeitems.
        [].slice.call(list.querySelectorAll('.uniNavigatorItems__item')).forEach(function (b) {
            if (b.getAttribute('role') !== 'treeitem') { b.setAttribute('role', 'treeitem'); }
            if (b.getAttribute('aria-level') !== '2') { b.setAttribute('aria-level', '2'); }
        });

        // One roving tab stop across every header + item (keep the current one,
        // else the first visible row).
        var rows = dbeMenuRows();
        var all = [].slice.call(list.querySelectorAll(DBE_MENU_ROW_SEL));
        var current = all.filter(function (el) { return el.getAttribute('tabindex') === '0' && el.offsetParent !== null; })[0];
        var keep = current || rows[0];
        all.forEach(function (el) {
            var t = el === keep ? '0' : '-1';
            if (el.getAttribute('tabindex') !== t) { el.setAttribute('tabindex', t); }
        });

        // Move focus into the tree on the open transition (it stayed on the page
        // before). Once per open, and only if focus is not already inside.
        if (!dbeMenuWasOpen) {
            dbeMenuWasOpen = true;
            if (rows[0] && !list.contains(document.activeElement)) { dbeMenuFocus(rows, 0); }
        }
    }

    function dbeMenuKeydown(e) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape', 'Enter', ' '].indexOf(e.key) === -1) { return; }
        var list = dbeMenuList();
        if (e.key === 'Escape') {
            // Close only when focus is within the open menu; otherwise let Escape
            // fall through (it may close a dialog or clear a selection elsewhere).
            if (!list || !list.contains(document.activeElement)) { return; }
            e.preventDefault();
            e.stopPropagation();
            var trigger = dbeMenuTrigger();
            if (trigger) { clickSeq(trigger); trigger.focus(); }
            dbeMenuWasOpen = false;
            return;
        }
        var row = e.target && e.target.closest ? e.target.closest(DBE_MENU_ROW_SEL) : null;
        if (!row || !list || !list.contains(row)) { return; }
        var header = dbeMenuIsHeader(row);

        // Enter/Space: toggle a header (a <div>, so synthesise the click), or let
        // an item's native button activation run.
        if (e.key === 'Enter' || e.key === ' ') {
            if (header) { e.preventDefault(); e.stopPropagation(); clickSeq(row); }
            return;
        }

        var rows = dbeMenuRows();
        var i = rows.indexOf(row);
        if (i === -1) { return; }
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'ArrowRight') {
            if (header && !dbeMenuCatExpanded(row)) { clickSeq(row); }          // open the section
            else if (header && rows[i + 1] && !dbeMenuIsHeader(rows[i + 1])) { dbeMenuFocus(rows, i + 1); } // step into it
            return;
        }
        if (e.key === 'ArrowLeft') {
            if (header && dbeMenuCatExpanded(row)) { clickSeq(row); }            // collapse the section
            else if (!header) {                                                 // step out to the header
                var cat = row.closest('.uniNavigatorItems__catWrapper');
                var hdr = cat && cat.querySelector('.uniCatTitle');
                var hi = rows.indexOf(hdr);
                if (hi !== -1) { dbeMenuFocus(rows, hi); }
            }
            return;
        }
        var next = i;
        if (e.key === 'ArrowDown') { next = (i + 1) % rows.length; }
        else if (e.key === 'ArrowUp') { next = (i - 1 + rows.length) % rows.length; }
        else if (e.key === 'Home') { next = 0; }
        else if (e.key === 'End') { next = rows.length - 1; }
        if (next === i) { return; }
        dbeMenuFocus(rows, next);
    }

    /* (sc) Accessible select comboboxes (select_combobox). Builderius's reused
       custom select popover (.uniSystemSelect — the preview picker, the
       responsive-strategy select, …) is a searchable list with no ARIA and no
       keyboard way to pick an option: you can type to filter but Arrow keys do
       nothing, so a keyboard user is stuck. This wires it as an ARIA 1.2 editable
       combobox WITHOUT touching Builderius's own search/select code:

         - roles only describe what is already there (combobox / listbox / option)
           — they change nothing behavioural;
         - the ONLY keys intercepted are ArrowDown/ArrowUp (which the native
           single-line search input ignores) to move aria-activedescendant, and
           Enter — but Enter is handled ONLY when one of our options is highlighted,
           otherwise it passes straight through to native. Home/End, typing and
           click-to-select are left entirely to Builderius.
         - selection reuses the native path: we click the highlighted option, which
           is exactly what a mouse user does.

       Re-applied each tick (React rebuilds the filtered list); the key handler
       binds once. If any of this fought the native widget it would degrade to
       "roles present, arrows do nothing", never a broken search. */
    var SSCOMBO_LIST_ID = 'dbe-sscombo-list';
    function dbeSSItems(dd) {
        return [].slice.call(dd.querySelectorAll('.uniSystemSelect__item')).filter(function (it) {
            return it.offsetParent !== null;
        });
    }
    function dbeSSOpenDropdown() {
        var dd = document.querySelector('.uniSystemSelect__dropdown');
        return (dd && dd.offsetParent !== null) ? dd : null;
    }
    var dbeSSId = 0;
    /* The field's visible title, used to name the combobox (aria-labelledby, so
       both the label and the shown value are announced). */
    function dbeSSLabelEl(sel) {
        var field = sel.closest('.uniFormField') || sel;
        var c = field.parentElement;
        var el = c ? c.querySelector('[class*="settingLabel"], [class*="settingTitle"], [class*="__label"], [class*="__title"], label') : null;
        return (el && !sel.contains(el)) ? el : null;
    }
    function ensureSelectComboboxes() {
        // Closed triggers: drop the invisible hidden field out of the tab order
        // (it is an 8px opacity:0 input that makes the control a double Tab stop)
        // and name the caret by the current value — it otherwise inherits the
        // generic "Save options" tooltip label from the .caretIcon selector.
        document.querySelectorAll('.uniSystemSelect').forEach(function (sel) {
            var hidden = sel.querySelector('.uniSystemSelect__hiddenField');
            if (hidden && hidden.getAttribute('tabindex') !== '-1') { hidden.setAttribute('tabindex', '-1'); }
            // Fold the caret into the trigger: one Tab stop, out of the a11y tree,
            // so the whole control reads and behaves as a single combobox.
            var caret = sel.querySelector('.uniIconButton.caretIcon');
            if (caret) {
                if (caret.getAttribute('tabindex') !== '-1') { caret.setAttribute('tabindex', '-1'); }
                if (caret.getAttribute('aria-hidden') !== 'true') { caret.setAttribute('aria-hidden', 'true'); }
            }
            // The focusable trigger IS the combobox (APG select-only pattern):
            // haspopup + an expanded state that controls the listbox when open.
            if (sel.getAttribute('role') !== 'combobox') { sel.setAttribute('role', 'combobox'); }
            if (sel.getAttribute('aria-haspopup') !== 'listbox') { sel.setAttribute('aria-haspopup', 'listbox'); }
            var open = sel.classList.contains('expanded');
            var exp = open ? 'true' : 'false';
            if (sel.getAttribute('aria-expanded') !== exp) { sel.setAttribute('aria-expanded', exp); }
            if (open) {
                if (sel.getAttribute('aria-controls') !== SSCOMBO_LIST_ID) { sel.setAttribute('aria-controls', SSCOMBO_LIST_ID); }
            } else if (sel.hasAttribute('aria-controls')) {
                sel.removeAttribute('aria-controls');
                sel.removeAttribute('aria-activedescendant');
            }
            // Name it from its field title + shown value via aria-labelledby, so
            // both are announced without duplicating the trigger's own text.
            var titleEl = dbeSSLabelEl(sel);
            var valueEl = sel.querySelector('.uniSystemSelect__value') || sel.querySelector('.uniSystemSelect__valueInner');
            var ref = [];
            if (titleEl) { if (!titleEl.id) { titleEl.id = 'dbe-ss-lbl-' + (++dbeSSId); } ref.push(titleEl.id); }
            if (valueEl) { if (!valueEl.id) { valueEl.id = 'dbe-ss-val-' + (++dbeSSId); } ref.push(valueEl.id); }
            if (ref.length) {
                var lb = ref.join(' ');
                if (sel.getAttribute('aria-labelledby') !== lb) { sel.setAttribute('aria-labelledby', lb); }
            } else {
                var val = ((valueEl || {}).textContent || '').trim();
                var want = val ? dbeFmt(dbeT('comboboxTrigger', 'Selection: %s'), val) : '';
                if (want && sel.getAttribute('aria-label') !== want) { sel.setAttribute('aria-label', want); }
            }
        });

        // HTML-tag select (.uniSystemSelectModuleTags — the element "HTML" field).
        // A sibling component that moves REAL focus onto each option as you arrow,
        // so it already has keyboard navigation — it only lacks the ARIA roles.
        // Roles only here: no key handler (native owns the arrows) and no tabindex
        // changes (native owns focus). The `expanded` class drives aria-expanded.
        var MTAGS_LIST_ID = 'dbe-mtags-list';
        document.querySelectorAll('.uniSystemSelectModuleTags').forEach(function (mt) {
            var results = mt.querySelector('.uniSystemSelectModuleTags__resultsWrapper');
            if (results) {
                if (results.getAttribute('role') !== 'listbox') { results.setAttribute('role', 'listbox'); }
                if (results.id !== MTAGS_LIST_ID) { results.id = MTAGS_LIST_ID; }
                if (!results.getAttribute('aria-label')) { results.setAttribute('aria-label', dbeT('comboboxListbox', 'Options')); }
            }
            var curVal = ((mt.querySelector('.uniSystemSelectModuleTags__placeholder') || {}).textContent || '').trim();
            mt.querySelectorAll('.uniSystemSelectModuleTags__item').forEach(function (it) {
                if (it.getAttribute('role') !== 'option') { it.setAttribute('role', 'option'); }
                var isSel = (curVal && (it.textContent || '').trim() === curVal) ? 'true' : 'false';
                if (it.getAttribute('aria-selected') !== isSel) { it.setAttribute('aria-selected', isSel); }
            });
            var mexp = mt.classList.contains('expanded');
            // Closed trigger (the fake input focused before you type/open): give
            // it combobox semantics so a screen reader announces it as one, with
            // the current tag as its value. Focus moves to the real search on open.
            var mfake = mt.querySelector('.uniSystemSelectModuleTags__fakeInput');
            if (mfake) {
                if (mfake.getAttribute('role') !== 'combobox') { mfake.setAttribute('role', 'combobox'); }
                if (mfake.getAttribute('aria-haspopup') !== 'listbox') { mfake.setAttribute('aria-haspopup', 'listbox'); }
                var fexp = mexp ? 'true' : 'false';
                if (mfake.getAttribute('aria-expanded') !== fexp) { mfake.setAttribute('aria-expanded', fexp); }
                if (results && mexp) {
                    if (mfake.getAttribute('aria-controls') !== MTAGS_LIST_ID) { mfake.setAttribute('aria-controls', MTAGS_LIST_ID); }
                } else if (mfake.hasAttribute('aria-controls')) { mfake.removeAttribute('aria-controls'); }
                var mTitle = dbeSSLabelEl(mt);
                var mRef = [];
                if (mTitle) { if (!mTitle.id) { mTitle.id = 'dbe-ss-lbl-' + (++dbeSSId); } mRef.push(mTitle.id); }
                var mPlaceholder = mt.querySelector('.uniSystemSelectModuleTags__placeholder');
                if (mPlaceholder) { if (!mPlaceholder.id) { mPlaceholder.id = 'dbe-ss-val-' + (++dbeSSId); } mRef.push(mPlaceholder.id); }
                if (mRef.length && mfake.getAttribute('aria-labelledby') !== mRef.join(' ')) { mfake.setAttribute('aria-labelledby', mRef.join(' ')); }
            }
            var msearch = mt.querySelector('.uniSystemSelectModuleTags__search');
            if (msearch) {
                if (msearch.getAttribute('role') !== 'combobox') { msearch.setAttribute('role', 'combobox'); }
                if (msearch.getAttribute('aria-expanded') !== (mexp ? 'true' : 'false')) { msearch.setAttribute('aria-expanded', mexp ? 'true' : 'false'); }
                if (results && msearch.getAttribute('aria-controls') !== MTAGS_LIST_ID) { msearch.setAttribute('aria-controls', MTAGS_LIST_ID); }
                if (msearch.getAttribute('aria-autocomplete') !== 'list') { msearch.setAttribute('aria-autocomplete', 'list'); }
                if (!msearch.getAttribute('aria-label')) { msearch.setAttribute('aria-label', dbeT('comboboxFilter', 'Filter options')); }
            }
        });

        // Class selector (.uniSystemSelectClasses — the Styles "Add an ID or
        // classes" field). Same fake-input pattern as the HTML-tag field, and
        // native owns open/type/navigate/select; it only lacks ARIA. It is
        // MULTI-select (you add several classes), so the listbox is
        // aria-multiselectable and each already-applied item is aria-selected.
        // Roles only — no key handler and no store writes — so it never disturbs
        // Auto-BEM, which drives the same search input.
        var CSCLASSES_LIST_ID = 'dbe-csclasses-list';
        document.querySelectorAll('.uniSystemSelectClasses').forEach(function (cs) {
            var csExp = cs.classList.contains('expanded');
            var csFake = cs.querySelector('.uniSystemSelectClasses__fakeInput');
            if (csFake) {
                if (csFake.getAttribute('role') !== 'combobox') { csFake.setAttribute('role', 'combobox'); }
                if (csFake.getAttribute('aria-haspopup') !== 'listbox') { csFake.setAttribute('aria-haspopup', 'listbox'); }
                var ce = csExp ? 'true' : 'false';
                if (csFake.getAttribute('aria-expanded') !== ce) { csFake.setAttribute('aria-expanded', ce); }
                if (csExp) {
                    if (csFake.getAttribute('aria-controls') !== CSCLASSES_LIST_ID) { csFake.setAttribute('aria-controls', CSCLASSES_LIST_ID); }
                } else if (csFake.hasAttribute('aria-controls')) { csFake.removeAttribute('aria-controls'); }
                var csTitle = dbeSSLabelEl(cs);
                if (csTitle) {
                    if (!csTitle.id) { csTitle.id = 'dbe-ss-lbl-' + (++dbeSSId); }
                    if (csFake.getAttribute('aria-labelledby') !== csTitle.id) { csFake.setAttribute('aria-labelledby', csTitle.id); }
                } else {
                    var ph = ((cs.querySelector('.uniSystemSelectClasses__placeholder') || {}).textContent || '').trim();
                    var cname = ph || dbeT('addClass', 'Add an ID or classes');
                    if (csFake.getAttribute('aria-label') !== cname) { csFake.setAttribute('aria-label', cname); }
                }
            }
            if (!csExp) { return; }
            var csItems = [].slice.call(cs.querySelectorAll('.uniSystemSelectClasses__item')).filter(function (it) { return it.offsetParent !== null; });
            var csList = csItems.length ? csItems[0].parentElement : null;
            if (csList) {
                if (csList.getAttribute('role') !== 'listbox') { csList.setAttribute('role', 'listbox'); }
                if (csList.id !== CSCLASSES_LIST_ID) { csList.id = CSCLASSES_LIST_ID; }
                if (csList.getAttribute('aria-multiselectable') !== 'true') { csList.setAttribute('aria-multiselectable', 'true'); }
                if (!csList.getAttribute('aria-label')) { csList.setAttribute('aria-label', dbeT('comboboxListbox', 'Options')); }
            }
            csItems.forEach(function (it) {
                if (it.getAttribute('role') !== 'option') { it.setAttribute('role', 'option'); }
                var on = it.classList.contains('assigned') ? 'true' : 'false';
                if (it.getAttribute('aria-selected') !== on) { it.setAttribute('aria-selected', on); }
            });
            var csSearch = cs.querySelector('.uniSystemSelectClasses__search');
            if (csSearch) {
                if (csSearch.getAttribute('role') !== 'combobox') { csSearch.setAttribute('role', 'combobox'); }
                if (csSearch.getAttribute('aria-expanded') !== 'true') { csSearch.setAttribute('aria-expanded', 'true'); }
                if (csList && csSearch.getAttribute('aria-controls') !== CSCLASSES_LIST_ID) { csSearch.setAttribute('aria-controls', CSCLASSES_LIST_ID); }
                if (csSearch.getAttribute('aria-autocomplete') !== 'list') { csSearch.setAttribute('aria-autocomplete', 'list'); }
                if (!csSearch.getAttribute('aria-label')) { csSearch.setAttribute('aria-label', dbeT('comboboxFilter', 'Filter options')); }
            }
        });

        var dd = dbeSSOpenDropdown();
        if (!dd) { return; }
        var search = dd.querySelector('.uniSystemSelect__search input') || dd.querySelector('input');
        var items = dbeSSItems(dd);
        var listContainer = items.length ? items[0].parentElement : null;
        if (listContainer) {
            if (listContainer.getAttribute('role') !== 'listbox') { listContainer.setAttribute('role', 'listbox'); }
            if (listContainer.id !== SSCOMBO_LIST_ID) { listContainer.id = SSCOMBO_LIST_ID; }
            if (!listContainer.getAttribute('aria-label')) { listContainer.setAttribute('aria-label', dbeT('comboboxListbox', 'Options')); }
        }
        // Category headings are not options; keep them out of the listbox structure.
        [].slice.call(dd.querySelectorAll('.uniSystemSelect__cat')).forEach(function (c) {
            if (c.getAttribute('role') !== 'presentation') { c.setAttribute('role', 'presentation'); }
        });
        // The current value has no native marker, so match option text against the
        // open control's shown value to flag aria-selected.
        var vals = [];
        document.querySelectorAll('.uniSystemSelect__valueInner').forEach(function (v) {
            var t = (v.textContent || '').trim();
            if (t) { vals.push(t); }
        });
        items.forEach(function (it, i) {
            if (it.getAttribute('role') !== 'option') { it.setAttribute('role', 'option'); }
            var id = SSCOMBO_LIST_ID + '-opt-' + i;
            if (it.id !== id) { it.id = id; }
            if (it.getAttribute('tabindex') !== '-1') { it.setAttribute('tabindex', '-1'); }
            var isSel = vals.indexOf((it.textContent || '').trim()) !== -1 ? 'true' : 'false';
            if (it.getAttribute('aria-selected') !== isSel) { it.setAttribute('aria-selected', isSel); }
        });
        if (search) {
            // The trigger owns combobox semantics now; the in-popup search is a
            // plain filter. Keep it out of the Tab order (keyboard drives from the
            // trigger via aria-activedescendant) but leave it clickable/typeable
            // for mouse users. Drop the combobox role it used to carry.
            if (search.getAttribute('tabindex') !== '-1') { search.setAttribute('tabindex', '-1'); }
            if (search.getAttribute('role') === 'combobox') { search.removeAttribute('role'); }
            if (search.hasAttribute('aria-expanded')) { search.removeAttribute('aria-expanded'); }
            if (search.getAttribute('aria-controls') === SSCOMBO_LIST_ID) { search.removeAttribute('aria-controls'); }
            if (!search.getAttribute('aria-label')) { search.setAttribute('aria-label', dbeT('comboboxFilter', 'Filter options')); }
        }
    }

    /* (at) Sense AI terminal tabs. When a remote agent (Claude Code, Gemini CLI…)
       is connected, the Sense AI panel shows a strip of session tabs above the
       terminal. Natively they are bare <button>s with no tab semantics, so a
       screen reader cannot tell which session is active, the set has no
       single-tab-stop keyboard model, and the "new session" button carries only a
       "+" glyph as its name. This wires the strip as an APG tab list:
         - the list = role="tablist" with roving arrow-key navigation;
         - each tab = role="tab" + aria-selected (mirrored from the native
           --active class) + aria-controls on the terminal panel; arrows move and
           switch the session (native owns the switch, driven by selectOnMove's
           click on the tab the arrows land on);
         - the terminal = role="tabpanel", named by the active tab;
         - the "+" button gets a real accessible name and, with its agent picker,
           becomes a menu button (aria-haspopup/expanded, role=menu/menuitem,
           focus moves in on open, arrow/Home/End roam, Escape/Tab close it).
       The strip lives in the footer, which the main panel observers do not watch
       (like footer_toolbar), and native re-renders it on every switch. Two cheap
       observers keep it in sync: one on the always-present footer bar (fires when
       Sense AI is opened) and one on the .uniAiChat panel (fires on connect and on
       every tab switch). Neither spans a Monaco editor, so subtree is safe here;
       schedule()'s rAF debounce coalesces the rest. The "+" sits inside the list
       as a labelled button (as a browser tab strip's does); it is not a tab, so
       the roving set (matched on .uniAiChat__terminalTab) skips it. */
    var dbeTermAiNode = null;
    var dbeTermAiObs = null;
    function dbeObserveTerminalBar() {
        // Same bar, same options as the footer toolbar — share its observer.
        dbeObserveFooter(document.querySelector('.uniFooterPanelBar'));
    }
    function dbeObserveTerminalPanel(ai) {
        if (!ai || ai === dbeTermAiNode || !window.MutationObserver) { return; }
        if (dbeTermAiObs) { try { dbeTermAiObs.disconnect(); } catch (e) {} }
        dbeTermAiNode = ai;
        try {
            dbeTermAiObs = new MutationObserver(schedule);
            dbeTermAiObs.observe(ai, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        } catch (e) { dbeTermAiNode = null; dbeTermAiObs = null; }
    }
    var DBE_AI_MENU_ID = 'dbe-ai-agent-menu';
    var dbeAgentMenuWasOpen = false;
    var dbeAgentKeysBound = false;
    function dbeAgentMenuItems() {
        var m = document.querySelector('.uniAiChat__agentPicker');
        return m ? [].slice.call(m.querySelectorAll('.uniAiChat__agentPickerItem')).filter(function (el) { return el.offsetParent !== null; }) : [];
    }
    /* The picker is a toggle: clicking the "+" while it is open closes it. */
    function dbeCloseAgentMenu(add) {
        if (document.querySelector('.uniAiChat__agentPicker') && add) { try { add.click(); } catch (e) {} }
        if (add) { add.focus(); }
    }
    /* Wire the "+" as a menu button and the picker it opens as a role="menu".
       Natively the picker is a bare div of <button>s with no roles, no focus
       management and no Escape — reachable but not a menu. Add the menu-button
       semantics and, when it opens from the button, move focus to the first item. */
    function dbeEnsureAgentPicker(add) {
        if (!add) { return; }
        if (add.getAttribute('aria-haspopup') !== 'menu') { add.setAttribute('aria-haspopup', 'menu'); }
        var menu = document.querySelector('.uniAiChat__agentPicker');
        var open = !!menu;
        if (add.getAttribute('aria-expanded') !== String(open)) { add.setAttribute('aria-expanded', String(open)); }
        if (open) {
            if (!menu.id) { menu.id = DBE_AI_MENU_ID; }
            if (add.getAttribute('aria-controls') !== menu.id) { add.setAttribute('aria-controls', menu.id); }
            if (menu.getAttribute('role') !== 'menu') { menu.setAttribute('role', 'menu'); }
            if (!menu.getAttribute('aria-label')) { menu.setAttribute('aria-label', dbeT('terminalAgentMenu', 'Choose an agent')); }
            [].slice.call(menu.querySelectorAll('.uniAiChat__agentPickerItem')).forEach(function (it) {
                if (it.getAttribute('role') !== 'menuitem') { it.setAttribute('role', 'menuitem'); }
                if (it.getAttribute('tabindex') !== '-1') { it.setAttribute('tabindex', '-1'); }
            });
            // Just opened from the "+" (keyboard, or a click that focused it): move
            // focus to the first item, the menu-button convention.
            if (!dbeAgentMenuWasOpen && document.activeElement === add) {
                var first = dbeAgentMenuItems()[0];
                if (first) { first.focus(); }
            }
        } else if (add.getAttribute('aria-controls')) {
            add.removeAttribute('aria-controls');
        }
        dbeAgentMenuWasOpen = open;
    }
    /* Keyboard model for the "+" menu button and its menu (bound once). Down/Up on
       the button opens the menu and dives to the first/last item; inside the menu,
       Up/Down/Home/End roam (wrapping) and Escape/Tab close it and return focus to
       the button. Enter/Space on an item is left to the native <button>. */
    function dbeBindAgentPickerKeys() {
        if (dbeAgentKeysBound) { return; }
        dbeAgentKeysBound = true;
        document.addEventListener('keydown', function (e) {
            var addBtn = e.target && e.target.closest ? e.target.closest('.uniAiChat__terminalAddTabBtn') : null;
            if (addBtn) {
                if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') { return; }
                e.preventDefault();
                var last = e.key === 'ArrowUp';
                if (!document.querySelector('.uniAiChat__agentPicker')) { try { addBtn.click(); } catch (err) {} }
                var tries = 0;
                (function focusItem() {
                    var opts = dbeAgentMenuItems();
                    if (opts.length) { (last ? opts[opts.length - 1] : opts[0]).focus(); }
                    else if (tries++ < 10) { setTimeout(focusItem, 20); }
                })();
                return;
            }
            var inMenu = e.target && e.target.closest ? e.target.closest('.uniAiChat__agentPicker') : null;
            if (!inMenu) { return; }
            var items = dbeAgentMenuItems();
            if (!items.length) { return; }
            var add = document.querySelector('.uniAiChat__terminalAddTabBtn');
            var i = items.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') { e.preventDefault(); items[i < 0 ? 0 : (i + 1) % items.length].focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); items[i < 0 ? items.length - 1 : (i - 1 + items.length) % items.length].focus(); }
            else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
            else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
            else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); dbeCloseAgentMenu(add); }
        });
    }
    var DBE_AI_PANEL_ID = 'dbe-ai-terminal-panel';
    function ensureTerminalTabs() {
        dbeObserveTerminalBar();
        dbeObserveTerminalPanel(document.querySelector('.uniAiChat'));
        var list = document.querySelector('.uniAiChat__terminalTabList');
        if (!list) { return; }
        var panel = document.querySelector('.uniAiChat__terminalFrameWrap');
        if (panel) {
            if (!panel.id) { panel.id = DBE_AI_PANEL_ID; }
            if (panel.getAttribute('role') !== 'tabpanel') { panel.setAttribute('role', 'tabpanel'); }
            if (panel.getAttribute('tabindex') !== '0') { panel.setAttribute('tabindex', '0'); }
        }
        var active = null;
        [].slice.call(list.querySelectorAll('.uniAiChat__terminalTab')).forEach(function (t, i) {
            if (!t.id) { t.id = 'dbe-ai-terminal-tab-' + i; }
            if (panel && t.getAttribute('aria-controls') !== panel.id) { t.setAttribute('aria-controls', panel.id); }
            if (t.classList.contains('uniAiChat__terminalTab--active')) { active = t; }
        });
        // Name the panel after whichever session is showing.
        if (panel && active && panel.getAttribute('aria-labelledby') !== active.id) {
            panel.setAttribute('aria-labelledby', active.id);
        }
        // The "+" button's only content is a "+", so give it a real name, and wire
        // it + its agent picker as a proper menu button (roles, focus, Escape).
        var add = list.querySelector('.uniAiChat__terminalAddTabBtn');
        if (add) {
            var al = dbeT('terminalNewTab', 'New chat session');
            if (add.getAttribute('aria-label') !== al) { add.setAttribute('aria-label', al); }
        }
        dbeEnsureAgentPicker(add);
        dbeBindAgentPickerKeys();
        // Tab-list semantics + roving arrow-key navigation.
        dbeEnsureGroup(list, dbeT('terminalTablist', 'AI chat sessions'), '.uniAiChat__terminalTab', {
            role: 'tablist', itemRole: 'tab', selectAttr: 'aria-selected',
            selectOnMove: true, activeClass: 'uniAiChat__terminalTab--active'
        });
    }
    function dbeSSActiveIndex(items, id) {
        for (var i = 0; i < items.length; i++) { if (items[i].id === id) { return i; } }
        return -1;
    }
    function dbeSSHighlight(search, items, idx) {
        items.forEach(function (it) { it.classList.remove('dbe-sscombo-active'); });
        var t = items[idx];
        if (!t) { return; }
        t.classList.add('dbe-sscombo-active');
        search.setAttribute('aria-activedescendant', t.id);
        try { t.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
    function bindSelectCombobox() {
        // Arrow nav + Enter-when-highlighted, additive over the native search.
        document.addEventListener('keydown', function (e) {
            var search = e.target;
            if (!search || !search.classList || !search.classList.contains('uniSystemSelect__search')) { return; }
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== 'Escape' && e.key !== 'Tab') { return; }
            var dd = dbeSSOpenDropdown();
            if (!dd) { return; }
            var items = dbeSSItems(dd);
            if (!items.length) { return; }
            var idx = dbeSSActiveIndex(items, search.getAttribute('aria-activedescendant'));
            if (e.key === 'Tab') {
                // Focus is leaving the open popup. Opening the picker moves real
                // focus into this in-popup search, so Tab/Shift+Tab walks focus out
                // of it — but native never closes the popup, leaving it open behind
                // the trigger (confusing for keyboard users). Close it by re-selecting
                // the current option (value unchanged) and let the browser move focus
                // naturally: Shift+Tab lands back on the trigger, Tab moves on to the
                // next control. No preventDefault — the focus move must proceed.
                var curTab = items.filter(function (it) { return it.getAttribute('aria-selected') === 'true'; })[0] || items[0];
                if (curTab) { curTab.click(); }
                return;
            }
            if (e.key === 'Escape') {
                // Close without changing the value (re-select the current option),
                // and return focus to the trigger. Native has no Escape-to-close;
                // stopPropagation so it does not also close an enclosing dialog.
                e.preventDefault();
                e.stopPropagation();
                var trig = document.querySelector('.uniSystemSelect.expanded');
                var cur = items.filter(function (it) { return it.getAttribute('aria-selected') === 'true'; })[0] || items[0];
                if (cur) { cur.click(); }
                if (trig) { trig.focus(); }
                return;
            }
            if (e.key === 'Enter') {
                // Only take Enter when WE have a highlighted option; otherwise leave
                // it for Builderius (e.g. its own submit/first-match behaviour).
                if (idx < 0) { return; }
                e.preventDefault();
                e.stopPropagation();
                items[idx].click(); // native selection path (same as a mouse click)
                return;
            }
            // ArrowDown / ArrowUp — native single-line input ignores these.
            e.preventDefault();
            var next = e.key === 'ArrowDown'
                ? (idx < 0 ? 0 : (idx + 1) % items.length)
                : (idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length);
            dbeSSHighlight(search, items, next);
        }, true);
        // Typing re-filters (native): the old highlight is stale, so drop it and
        // let schedule() re-apply roles/ids to the rebuilt list.
        document.addEventListener('input', function (e) {
            var search = e.target;
            if (!search || !search.classList || !search.classList.contains('uniSystemSelect__search')) { return; }
            search.removeAttribute('aria-activedescendant');
            schedule();
        }, true);

        // Trigger keyboard support (select-only combobox). The native widget is
        // mouse-only — no keyboard open, and Escape does not close it — so drive
        // it with the same clicks a mouse makes: focus stays on the trigger,
        // arrows move aria-activedescendant, and selecting an option is the native
        // close+commit path. Escape/Tab close by re-selecting the current value
        // (a no-op that leaves it unchanged). Runs only when the trigger itself
        // holds focus, so it never clashes with the in-popup search handler above.
        document.addEventListener('keydown', function (e) {
            var trigger = e.target;
            if (!trigger || !trigger.classList || !trigger.classList.contains('uniSystemSelect')) { return; }
            var open = trigger.classList.contains('expanded');
            // preventDefault + stopPropagation on every key we handle, so it never
            // also reaches the builder or the dialog (e.g. Enter re-triggering the
            // widget or submitting the modal, Escape closing the modal, arrows
            // scrolling). Tab is the exception — it must fall through to move focus.
            var take = function () { e.preventDefault(); e.stopPropagation(); };
            if (!open) {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    take();
                    clickSeq(trigger.querySelector('.uniSystemSelect__valueWrapper') || trigger);
                    // Poll for the dropdown rather than a fixed delay: a long
                    // option list on a busy frame can mount later than one tick,
                    // and a missed mount would leave ArrowDown apparently dead.
                    waitFor(dbeSSOpenDropdown, function (dd) {
                        if (!dd) { return; }
                        try { ensureSelectComboboxes(); } catch (err) {}   // stamp option ids/roles
                        var items = dbeSSItems(dd);
                        var si = items.map(function (it) { return it.getAttribute('aria-selected') === 'true'; }).indexOf(true);
                        dbeSSHighlight(trigger, items, si >= 0 ? si : 0);
                    }, 40);
                }
                return;
            }
            var dd = dbeSSOpenDropdown();
            var items = dd ? dbeSSItems(dd) : [];
            var idx = dbeSSActiveIndex(items, trigger.getAttribute('aria-activedescendant'));
            var current = function () { return items.filter(function (it) { return it.getAttribute('aria-selected') === 'true'; })[0] || items[0]; };
            var closeVia = function (opt) { if (opt) { opt.click(); } trigger.removeAttribute('aria-activedescendant'); };
            if (e.key === 'ArrowDown') { take(); if (items.length) { dbeSSHighlight(trigger, items, idx < 0 ? 0 : (idx + 1) % items.length); } }
            else if (e.key === 'ArrowUp') { take(); if (items.length) { dbeSSHighlight(trigger, items, idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length); } }
            else if (e.key === 'Home') { take(); if (items.length) { dbeSSHighlight(trigger, items, 0); } }
            else if (e.key === 'End') { take(); if (items.length) { dbeSSHighlight(trigger, items, items.length - 1); } }
            else if (e.key === 'Enter' || e.key === ' ') { take(); closeVia(idx >= 0 ? items[idx] : current()); trigger.focus(); }
            else if (e.key === 'Escape') { take(); closeVia(current()); trigger.focus(); }   // keep value; don't also close the dialog
            else if (e.key === 'Tab') { closeVia(current()); }                               // close, let focus move on
        }, true);

        // The native fake-input selects — the element HTML-tag field
        // (.uniSystemSelectModuleTags) and the Styles "Add an ID or classes" field
        // (.uniSystemSelectClasses) — move real focus into an in-popup search on
        // open, but never close when focus tabs back out, so the dropdown lingers
        // open behind the field (the confusion reported for both). Close it on
        // focusout: once focus has settled on a real element OUTSIDE the widget,
        // dispatch the widget's own close.
        //
        // Two details matter. (1) The native close is an Escape handler that checks
        // keyCode === 27, so the synthetic event must carry keyCode/which — a plain
        // {key:'Escape'} is silently ignored. (2) Closing while focus is still
        // inside the widget drops focus to <body>, from where the CSS editor's
        // Monaco grabs it; closing only AFTER focus has moved elsewhere leaves it
        // where the user tabbed. So we act only when relatedTarget is a real
        // element outside the widget (a null relatedTarget is an outside click,
        // which the widget already closes itself). Neither close commits (verified)
        // — the class field is multi-select, so re-committing would be especially
        // wrong.
        document.addEventListener('focusout', function (e) {
            var w = e.target && e.target.closest && e.target.closest('.uniSystemSelectModuleTags, .uniSystemSelectClasses');
            if (!w || !w.classList.contains('expanded')) { return; }
            var to = e.relatedTarget;
            if (!to || w.contains(to)) { return; }
            var esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
            (w.querySelector('input[class*="__search"]') || w).dispatchEvent(esc);
        }, true);
    }

    /* (j) Navigator search: filter box above the tree. Non-matching rows dim
       (not hide) so the structure stays readable; matches are re-applied after
       every tree re-render via schedule(). */
    var treeQuery = '';
    var treeSearchDebounce = null;
    function applyTreeFilter() {
        var q = treeQuery.trim().toLowerCase();
        var rows = document.querySelectorAll('.uniRightPanel .uniModTree__item');
        var total = 0, hits = 0;
        rows.forEach(function (row) {
            total += 1;
            var match = !q || (row.textContent || '').toLowerCase().indexOf(q) !== -1;
            row.classList.toggle('dbe-tree-dim', !!q && !match);
            if (match) { hits += 1; }
        });
        var count = document.querySelector('.dbe-tree-search__count');
        if (count) {
            var msg = q ? (hits + ' of ' + total + ' elements match') : '';
            if (count.textContent !== msg) { count.textContent = msg; }
        }
    }
    function ensureTreeSearch() {
        var panel = document.querySelector('.uniRightPanel');
        var tree = panel && panel.querySelector('.uniModTree');
        if (!tree || panel.querySelector('.dbe-tree-search')) { return; }
        var wrap = document.createElement('div');
        wrap.className = 'dbe-tree-search';
        var input = document.createElement('input');
        input.type = 'search';
        input.placeholder = dbeT('filterElements', 'Filter elements…');
        input.setAttribute('aria-label', dbeT('filterElementsAria', 'Filter elements by label or tag'));
        var count = document.createElement('span');
        count.className = 'dbe-tree-search__count';
        count.setAttribute('role', 'status'); // polite live region for the match count
        input.addEventListener('input', function () {
            clearTimeout(treeSearchDebounce);
            treeSearchDebounce = setTimeout(function () {
                treeQuery = input.value || '';
                applyTreeFilter();
            }, 150);
        });
        input.addEventListener('keydown', function (e) {
            e.stopPropagation(); // Delete etc. must not hit the builder shortcuts
            if (e.key === 'Escape' && input.value) {
                e.preventDefault();
                input.value = '';
                treeQuery = '';
                applyTreeFilter();
            }
        });
        wrap.appendChild(input);
        wrap.appendChild(count);
        tree.parentNode.insertBefore(wrap, tree);
    }

    /* (k) Unsaved-changes cue. Builderius records a history snapshot per
       module operation and warns on unload, but gives no visible cue. Dirty =
       history has grown past the baseline; the baseline resets when the Save
       button is clicked. Settings-only edits that skip history are missed —
       the native beforeunload warning still covers those. */
    var saveBaseline = null;
    function historyLen() {
        try { return (store().storeGet('history') || []).length; } catch (e) { return null; }
    }
    var dbeSaveClickBound = false;
    function ensureSaveCue() {
        // .saveBtn, not bare .uniPanelButtonPrimary: the breakpoints modal mounts
        // its own (disabled) primary Save earlier in document order, and the bare
        // class would anchor the cue to — and rebaseline on — that dead button.
        var save = document.querySelector('.uniTopPanel .uniPanelButtonPrimary.saveBtn');
        if (!save) { return; }
        if (!dbeSaveClickBound) {
            dbeSaveClickBound = true;
            // Delegated to document, NOT bound to the button: React remounts the
            // Save button freely, and a listener on a replaced button never fires
            // again — the baseline would stop resetting and the cue would read
            // "Unsaved" forever after the first save.
            document.addEventListener('click', function (e) {
                if (!(e.target.closest && e.target.closest('.uniTopPanel .uniPanelButtonPrimary.saveBtn'))) { return; }
                // Give the save request a beat, then treat the current state as
                // clean. Optimistic: a save that fails re-flags only on the next
                // history-growing edit — the native beforeunload warning remains
                // the backstop for that window.
                setTimeout(function () {
                    saveBaseline = historyLen();
                    ensureSaveCue();
                }, 500);
            }, true);
        }
        var cue = document.querySelector('.dbe-save-cue');
        if (!cue) {
            cue = document.createElement('span');
            cue.className = 'dbe-save-cue';
            cue.setAttribute('role', 'status');
            cue.textContent = dbeT('unsaved', 'Unsaved');
            save.parentNode.insertBefore(cue, save);
        }
        var len = historyLen();
        if (len === null) { return; }
        if (saveBaseline === null) { saveBaseline = len; }
        cue.classList.toggle('is-dirty', len > saveBaseline);
    }

    /* (k2) Cmd/Ctrl+S saves the template (save_shortcut). The browser's
       save-page dialog is useless inside the builder, and every editor trains
       this muscle memory. Capture-phase, so it wins before Monaco or the
       builder see the key; deliberately NOT gated on inputs/contenteditable —
       saving from the middle of typing is exactly what the WordPress block
       editor does. Acts (and suppresses the browser dialog) only when the
       native Save button is actually present; the programmatic click also
       bubbles through the save cue's delegated listener, so the "Unsaved"
       marker rebaselines exactly as a pointer click would. */
    function bindSaveShortcut() {
        document.addEventListener('keydown', function (e) {
            if (e.repeat || (e.key || '').toLowerCase() !== 's') { return; }
            var mod = dbeIsMac ? (e.metaKey && !e.ctrlKey) : e.ctrlKey;
            if (!mod || e.shiftKey || e.altKey) { return; }
            // .saveBtn, not bare .uniPanelButtonPrimary: the breakpoints modal
            // mounts its own (disabled) primary Save earlier in document order,
            // and querySelector on the bare class lands on that dead button.
            var save = document.querySelector('.uniTopPanel .uniPanelButtonPrimary.saveBtn');
            if (!save || save.disabled) { return; } // nothing to drive — leave the browser default alone
            e.preventDefault();
            e.stopPropagation();
            clickSeq(save);
        }, true);
    }

    /* (l) Keyboard shortcuts overlay — ? opens a native <dialog>. */
    var SHORTCUT_GROUPS = [
        [dbeT('scGroupGeneral', 'General'), [
            ['?', dbeT('scOpenOverlay', 'Open this shortcuts overlay')],
            ['Esc', dbeT('scEscape', 'Close menus and dialogs; clear the multi-selection')],
            ['Delete', dbeT('scDelete', 'Remove the selected element (Builderius)')],
            ['Cmd/Ctrl+C · Cmd/Ctrl+V', dbeT('scCopyPaste', 'Copy / paste the selected element (Builderius)')]
        ].concat(on('save_shortcut') ? [
            ['Cmd/Ctrl+S', dbeT('scSave', 'Save the template')]
        ] : [])],
        [dbeT('scGroupNavigator', 'Navigator'), [].concat(
            on('navigator_keyboard') ? [
                ['↑ ↓', dbeT('scTreeMove', 'Move between elements (selection follows)')],
                ['→', dbeT('scTreeExpand', 'Open a branch, then step into its first child')],
                ['←', dbeT('scTreeCollapse', 'Close a branch, then step out to the parent')],
                ['Home · End', dbeT('scTreeFirstLast', 'First / last element')]
            ] : [],
            [
                ['Cmd/Ctrl+Z', dbeT('scUndo', 'Restore the last deleted element')],
                ['Cmd/Ctrl+Shift+Z', dbeT('scRedo', 'Redo the delete')],
                ['Cmd/Ctrl+click', dbeT('scMultiToggle', 'Add or remove a row from the multi-selection')],
                ['Shift+click', dbeT('scRange', 'Select a range of rows')],
                ['Shift+F10', dbeT('scCtxOpen', 'Open the context menu on the focused row')]
            ]
        )],
        [dbeT('scGroupContextMenu', 'Context menu'), [
            ['↑ ↓', dbeT('scMove', 'Move between items (wraps)')],
            ['Home · End', dbeT('scFirstLast', 'First / last item')],
            ['Enter · Space', dbeT('scActivate', 'Activate an item or open its submenu')],
            ['→ ←', dbeT('scSubmenu', 'Open / close a submenu')]
        ]]
    ].concat(on('keyboard_shortcuts') ? [
        [dbeT('scGroupElements', 'Selected element'), [
            ['Cmd/Ctrl+Shift+D', dbeT('scDuplicate', 'Duplicate')],
            ['Cmd/Ctrl+X', dbeT('scCut', 'Cut')],
            ['Cmd/Ctrl+Alt+T', dbeT('scAddBefore', 'Add an element before')],
            ['Cmd/Ctrl+Alt+Y', dbeT('scAddAfter', 'Add an element after')],
            ['F2', dbeT('scRename', 'Rename')],
            ['Cmd/Ctrl+C · Cmd/Ctrl+V · Delete', dbeT('scCopyPasteDelete', 'Copy / paste / delete the element (Builderius)')]
        ]],
        [dbeT('scGroupAreas', 'Move to area'), [
            ['Cmd/Ctrl+Alt+O', dbeT('scGotoNavigator', 'Navigator')],
            ['Cmd/Ctrl+Alt+S', dbeT('scGotoSettings', 'Settings panel')],
            ['Cmd/Ctrl+Alt+P', dbeT('scGotoCanvas', 'Canvas / preview')],
            ['Cmd/Ctrl+Alt+N', dbeT('scGotoInserter', 'Insert elements')]
        ]]
    ] : []).concat(on('command_palette') ? [
        [dbeT('scGroupPalette', 'Command palette'), [
            ['Cmd/Ctrl+Shift+K', dbeT('scOpenPalette', 'Open the command palette (add class / attribute / element)')]
        ]]
    ] : []);
    function openShortcutsDialog() {
        var dlg = document.querySelector('dialog.dbe-shortcuts');
        if (!dlg) {
            dlg = document.createElement('dialog');
            dlg.className = 'dbe-shortcuts';
            dlg.setAttribute('aria-label', dbeT('keyboardShortcuts', 'Keyboard shortcuts'));
            var head = document.createElement('div');
            head.className = 'dbe-shortcuts__head';
            var title = document.createElement('h2');
            title.className = 'dbe-shortcuts__title';
            title.textContent = dbeT('keyboardShortcuts', 'Keyboard shortcuts');
            var close = document.createElement('button');
            close.type = 'button';
            close.className = 'dbe-shortcuts__close';
            close.setAttribute('aria-label', dbeT('close', 'Close'));
            close.textContent = '✕';
            close.addEventListener('click', function () { dlg.close(); });
            head.appendChild(title);
            head.appendChild(close);
            dlg.appendChild(head);
            var table = document.createElement('table');
            SHORTCUT_GROUPS.forEach(function (group) {
                var th = document.createElement('tr');
                var thCell = document.createElement('th');
                thCell.colSpan = 2;
                thCell.textContent = group[0];
                th.appendChild(thCell);
                table.appendChild(th);
                group[1].forEach(function (pair) {
                    var tr = document.createElement('tr');
                    var kd = document.createElement('td');
                    pair[0].split(' · ').forEach(function (combo, i) {
                        if (i) { kd.appendChild(document.createTextNode(' ')); }
                        var kbd = document.createElement('kbd');
                        kbd.textContent = combo;
                        kd.appendChild(kbd);
                    });
                    var desc = document.createElement('td');
                    desc.textContent = pair[1];
                    tr.appendChild(kd);
                    tr.appendChild(desc);
                    table.appendChild(tr);
                });
            });
            dlg.appendChild(table);
            // Keys inside the dialog must not reach the builder (Delete removes
            // the selected element!); Escape keeps its native close behaviour.
            dlg.addEventListener('keydown', function (e) { e.stopPropagation(); });
            document.body.appendChild(dlg);
        }
        if (!dlg.open) { dlg.showModal(); }
    }
    function bindShortcutsKey() {
        document.addEventListener('keydown', function (e) {
            if (e.key !== '?') { return; }
            if (renameActive()) { return; }
            var t = e.target;
            if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], .monaco-editor')) { return; }
            if (document.querySelector('dialog[open]')) { return; }
            e.preventDefault();
            e.stopPropagation();
            openShortcutsDialog();
        }, true);
    }

    /* (ks) Element keyboard shortcuts (keyboard_shortcuts). Gutenberg-style keys
       for the element selected in the Navigator: Duplicate (Cmd/Ctrl+Shift+D),
       Cut (Cmd/Ctrl+X = native Copy then Remove), Add before / after
       (Cmd/Ctrl+Alt+T / +Y, via a quick element picker) and Rename (F2). Each
       reuses a proven channel — driveContextMenuItem for the native duplicate/cut,
       storeAddModule for the inserts, startRename for renaming. Copy/Paste/Delete
       stay with Builderius' own native shortcuts (documented in the overlay only).
       Letter keys are matched by e.code (KeyD/KeyX/KeyT/KeyY) so Option/Alt on Mac
       — which rewrites e.key to a symbol — does not break the combos. */

    // Elements the quick picker offers (all HtmlElement, tag only).
    var DBE_PICKER_ELEMENTS = [
        'div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'img', 'ul', 'ol', 'li',
        'button', 'figure', 'figcaption', 'blockquote', 'label'
    ];

    /* The quick element picker for Add-before / Add-after. A small modal (same
       isolation contract as openAutoBemDialog: stop key/pointer events, close
       before driving the tree) whose only job is to return a tag; the module is
       built and inserted at the sibling slot via dbeInsertSibling. */
    function openElementPicker(targetId, dir) {
        if (!targetId || !(modules() || {})[targetId]) { undoToast(dbeT('noElementSelected', 'Select an element first')); return; }
        var prior = document.querySelector('dialog.dbe-el-picker');
        if (prior) { try { prior.close(); } catch (e) {} prior.remove(); }

        var titleKey = dir > 0 ? 'pickAfterTitle' : 'pickBeforeTitle';
        var titleText = dbeT(titleKey, dir > 0 ? 'Add element after' : 'Add element before');
        var dlg = document.createElement('dialog');
        dlg.className = 'dbe-el-picker';
        dlg.setAttribute('aria-label', titleText);

        var head = document.createElement('div');
        head.className = 'dbe-el-picker__head';
        var title = document.createElement('div');
        title.className = 'dbe-el-picker__title';
        title.textContent = titleText;
        var filter = document.createElement('input');
        filter.type = 'text';
        filter.className = 'dbe-el-picker__filter';
        filter.placeholder = dbeT('pickFilter', 'Filter elements…');
        filter.setAttribute('aria-label', dbeT('pickFilter', 'Filter elements…'));
        head.appendChild(title);
        head.appendChild(filter);

        var listEl = document.createElement('ul');
        listEl.className = 'dbe-el-picker__list';
        listEl.setAttribute('role', 'listbox');
        var buttons = DBE_PICKER_ELEMENTS.map(function (tag) {
            var li = document.createElement('li');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dbe-el-picker__item';
            btn.setAttribute('role', 'option');
            btn.dataset.tag = tag;
            var name = document.createElement('span');
            name.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
            var tagEl = document.createElement('span');
            tagEl.className = 'dbe-el-picker__tag';
            tagEl.textContent = '<' + tag + '>';
            btn.appendChild(name);
            btn.appendChild(tagEl);
            btn.addEventListener('click', function () { choose(tag); });
            li.appendChild(btn);
            listEl.appendChild(li);
            return btn;
        });
        var empty = document.createElement('div');
        empty.className = 'dbe-el-picker__empty';
        empty.hidden = true;
        empty.textContent = dbeT('pickNoMatch', 'No matching element');

        dlg.appendChild(head);
        dlg.appendChild(listEl);
        dlg.appendChild(empty);
        // Isolate from Builderius' document-level key/click handlers; native
        // <dialog> keeps Escape closing.
        ['keydown', 'pointerdown', 'mousedown', 'click'].forEach(function (type) {
            dlg.addEventListener(type, function (e) { e.stopPropagation(); });
        });
        dlg.addEventListener('close', function () { dlg.remove(); });
        document.body.appendChild(dlg);

        function visible() { return buttons.filter(function (b) { return !b.parentElement.hidden; }); }
        function applyFilter() {
            var q = filter.value.trim().toLowerCase();
            buttons.forEach(function (b) { b.parentElement.hidden = !!q && b.dataset.tag.indexOf(q) === -1; });
            empty.hidden = visible().length > 0;
        }
        function choose(tag) {
            dlg.close(); // close first — showModal makes the tree inert
            var newId = tag === 'section'
                ? dbeInsertSection(targetId, dir)
                : dbeInsertSibling(targetId, dir, dbeElementModule(tag));
            if (!newId) { return; }
            waitFor(function () {
                return document.querySelector('.uniRightPanel .uni-tree-node-' + newId) || null;
            }, function (row) { if (row) { clickSeq(row); } });
            undoToast(dbeFmt(dbeT('addedElement', 'Added %s'), '<' + tag + '>'));
        }

        filter.addEventListener('input', applyFilter);
        dlg.addEventListener('keydown', function (e) {
            if (['ArrowDown', 'ArrowUp', 'Enter'].indexOf(e.key) === -1) { return; }
            var vis = visible();
            if (!vis.length) { return; }
            var cur = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.dbe-el-picker__item') : null;
            var i = vis.indexOf(cur);
            e.preventDefault();
            if (e.key === 'Enter') { choose((cur || vis[0]).dataset.tag); return; }
            var next = e.key === 'ArrowDown'
                ? (i < 0 ? 0 : (i + 1) % vis.length)
                : (i < 0 ? vis.length - 1 : (i - 1 + vis.length) % vis.length);
            vis[next].focus();
        });

        dlg.showModal();
        filter.focus();
    }

    /* Move keyboard focus to one of the builder's regions. Targets are chosen for
       resilience: the Navigator hands off to navigator_keyboard's roving row; the
       settings panel and the quick-insert bar fall back to their container (given
       a -1 tabindex) when they have no focusable control mounted; the canvas is
       the preview iframe itself. */
    function dbeFocusArea(which) {
        var el = null;
        if (which === 'navigator') {
            el = document.querySelector('.uniRightPanel .uni-tree-node-' + (activeId() || '\0'))
                || document.querySelector('.uniRightPanel .uniModTree__list button.uniModTree__item');
            if (el) { el.setAttribute('tabindex', '0'); }
        } else if (which === 'settings') {
            // The settings panel shows the selected element's settings — nothing to
            // go to without a selection.
            if (!activeId()) { return; }
            var left = document.querySelector('.uniLeftPanel');
            el = (left && left.querySelector('button, input, select, textarea, a[href], [tabindex="0"]')) || left;
            if (el === left && left && left.tabIndex < 0) { left.setAttribute('tabindex', '-1'); }
        } else if (which === 'canvas') {
            el = document.getElementById('builderInner');
        } else if (which === 'inserter') {
            el = document.querySelector('.uniModItems__item')
                || document.querySelector('.uniModTree__favouritesListItem');
            if (el && el.tabIndex < 0 && !/^(a|button|input)$/i.test(el.tagName)) { el.setAttribute('tabindex', '-1'); }
        }
        if (!el) { return; }
        try { el.focus(); } catch (e) {}
        try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }

    var dbeShortcutKeyBound = false;
    function dbeElementShortcutsKeydown(e) {
        if (renameActive()) { return; }
        var t = e.target;
        if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], .monaco-editor')) { return; }
        if (document.querySelector('dialog[open]')) { return; } // don't fire over a dialog or the native menu
        var id = activeId();
        // F2 — rename (no modifiers).
        if (e.key === 'F2' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            if (!id) { return; }
            e.preventDefault(); e.stopPropagation();
            startRename(id);
            return;
        }
        var mod = dbeIsMac ? e.metaKey : (e.ctrlKey || e.metaKey);
        if (!mod) { return; }
        var code = e.code;
        // Area jumps — Cmd/Ctrl+Alt+O/S/P/N. No selected element required.
        var AREA = { KeyO: 'navigator', KeyS: 'settings', KeyP: 'canvas', KeyN: 'inserter' };
        if (e.altKey && !e.shiftKey && AREA[code]) {
            e.preventDefault(); e.stopPropagation();
            dbeFocusArea(AREA[code]);
            return;
        }
        if (code === 'KeyD' && e.shiftKey && !e.altKey) {                       // Duplicate
            if (!id) { return; }
            e.preventDefault(); e.stopPropagation();
            driveContextMenuItem(id, 'Duplicate', function (ok) { if (ok) { undoToast(dbeT('duplicated', 'Duplicated element')); } });
        } else if (code === 'KeyX' && !e.shiftKey && !e.altKey) {               // Cut = Copy then Remove
            if (!id) { return; }
            e.preventDefault(); e.stopPropagation();
            driveContextMenuItem(id, 'Copy', function (ok) {
                if (!ok) { return; }
                driveContextMenuItem(id, 'Remove', function () { undoToast(dbeT('cutDone', 'Cut element')); });
            });
        } else if (e.altKey && !e.shiftKey && (code === 'KeyT' || code === 'KeyY')) { // Add before / after
            if (!id) { return; }
            e.preventDefault(); e.stopPropagation();
            openElementPicker(id, code === 'KeyY' ? 1 : -1);
        }
    }

    /* (cp) Command palette (command_palette). Cmd/Ctrl+Shift+K opens a searchable
       command list (modelled on openAutoBemDialog's isolation contract). With an
       element selected it offers add-class, add-attribute and add-element (minimal
       Emmet), the element ops and the area jumps. Any command that drives the tree
       or a native picker CLOSES the dialog first (showModal makes the page inert),
       then runs. */
    var dbePaletteKeyBound = false;

    /* Add (or update) one or more HTML attributes on an existing element through
       the settings upsert (a single upsert for the whole batch — no native-control
       driving). `pairs` = [{name, value}, …]. Returns false if the element is gone. */
    function dbeAddAttributes(id, pairs) {
        if (!pairs.length) { return false; }
        return dbeUpdateModuleSettings(id, function (settings) {
            var ha = settings.filter(function (s) { return s.name === 'htmlAttribute'; })[0];
            if (!ha) { ha = { name: 'htmlAttribute', value: [] }; settings.push(ha); }
            if (!Array.isArray(ha.value)) { ha.value = []; }
            pairs.forEach(function (p) {
                var existing = ha.value.filter(function (a) { return a.name === p.name; })[0];
                if (existing) { existing.value = p.value; } else { ha.value.push({ name: p.name, value: p.value }); }
            });
        });
    }

    /* Parse an attribute string into {name,value} pairs. Multiple attributes are
       separated by ";" (so values may contain spaces, e.g. an aria-label), or by
       whitespace when there is no ";" (Emmet-style: href=# target=_blank). */
    function dbeParseAttributes(str) {
        str = (str || '').trim();
        var parts = str.indexOf(';') !== -1 ? str.split(';') : str.split(/\s+/);
        return parts.map(function (p) { return p.trim(); }).filter(Boolean).map(function (p) {
            var eq = p.indexOf('=');
            return { name: (eq < 0 ? p : p.slice(0, eq)).trim(), value: eq < 0 ? '' : p.slice(eq + 1).trim() };
        }).filter(function (p) { return p.name; });
    }

    function openCommandPalette() {
        var id = activeId(); // the selected element (the palette is keyboard-invoked)
        var hasEl = !!(id && (modules() || {})[id]);
        var prior = document.querySelector('dialog.dbe-palette');
        if (prior) { try { prior.close(); } catch (e) {} prior.remove(); }

        var dlg = document.createElement('dialog');
        dlg.className = 'dbe-palette';
        dlg.setAttribute('aria-label', dbeT('commandPalette', 'Command palette'));
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'dbe-palette__input';
        input.setAttribute('aria-label', dbeT('searchCommands', 'Search commands'));
        input.placeholder = dbeT('searchCommands', 'Search commands…');
        var listEl = document.createElement('ul');
        listEl.className = 'dbe-palette__list';
        listEl.setAttribute('role', 'listbox');
        var hintEl = document.createElement('div');
        hintEl.className = 'dbe-palette__hint';
        dlg.appendChild(input);
        dlg.appendChild(listEl);
        dlg.appendChild(hintEl);
        ['keydown', 'pointerdown', 'mousedown', 'click'].forEach(function (type) {
            dlg.addEventListener(type, function (e) { e.stopPropagation(); });
        });
        dlg.addEventListener('close', function () { dlg.remove(); });
        document.body.appendChild(dlg);

        function runClose(fn) { dlg.close(); setTimeout(fn, 120); }

        // Commands carry a group key; renderList draws a labelled divider each
        // time the group changes, so related commands read as a set. `accel` is a
        // presentational shortcut hint shown right-aligned, mirroring the block
        // editor's context menu.
        var GROUP_LABELS = {
            add: dbeT('paletteGroupAdd', 'Add to element'),
            structure: dbeT('paletteGroupStructure', 'Structure'),
            element: dbeT('paletteGroupElement', 'Element'),
            goto: dbeT('paletteGroupGoto', 'Go to')
        };

        var commands = [];
        if (hasEl) {
            commands.push(
                { group: 'add', label: dbeT('paletteAddClass', 'Add class…'), input: true, ph: dbeT('phClass', 'class1 class2  (or .a.b)'), run: function (v) {
                    var cls = v.replace(/^\./, '').split(/[\s.]+/).filter(Boolean);
                    if (!cls.length) { return; }
                    runClose(function () {
                        if (dbeAddClasses(id, cls)) {
                            undoToast(dbeFmt(dbeTn(cls.length, 'addedClassesOne', 'Added %s class', 'addedClassesMany', 'Added %s classes'), cls.length));
                        }
                    });
                } },
                { group: 'add', label: dbeT('paletteAddAttr', 'Add attribute…'), input: true, ph: dbeT('phAttr', 'name=value; name2=value2'), run: function (v) {
                    var pairs = dbeParseAttributes(v);
                    if (!pairs.length) { return; }
                    runClose(function () {
                        if (dbeAddAttributes(id, pairs)) {
                            undoToast(dbeFmt(dbeTn(pairs.length, 'addedAttribute', 'Added attribute %s', 'addedAttributesMany', 'Added %s attributes'), pairs.length === 1 ? pairs[0].name : pairs.length));
                        }
                    });
                } },
                { group: 'add', label: dbeT('paletteAddEmmet', 'Add element (Emmet)…'), input: true, ph: 'div.card>h3{Title}+p{Text}', run: function (v) {
                    var roots;
                    try { roots = dbeEmmetParse(v); } catch (e) { undoToast(dbeFmt(dbeT('emmetInvalid', 'Could not parse: %s'), v)); return; }
                    runClose(function () {
                        var n = dbeEmmetInsert(id, roots);
                        undoToast(dbeFmt(dbeTn(n, 'emmetAddedOne', 'Added %s element', 'emmetAddedMany', 'Added %s elements'), n));
                    });
                } }
            );
            commands.push(
                { group: 'structure', label: dbeT('addBefore', 'Add element before'), accel: dbeAccel('T', { cmd: true, alt: true }), run: function () { runClose(function () { openElementPicker(id, -1); }); } },
                { group: 'structure', label: dbeT('addAfter', 'Add element after'), accel: dbeAccel('Y', { cmd: true, alt: true }), run: function () { runClose(function () { openElementPicker(id, 1); }); } }
            );
            if (on('wrap_in')) {
                commands.push(
                    { group: 'structure', label: dbeT('paletteWrapDiv', 'Wrap in div'), run: function () { runClose(function () { wrap('div', [id]); }); } },
                    { group: 'structure', label: dbeT('paletteWrapFigure', 'Wrap in figure'), run: function () { runClose(function () { wrap('figure', [id]); }); } },
                    { group: 'structure', label: dbeT('paletteWrapTemplate', 'Wrap in template'), run: function () { runClose(function () { wrap('template', [id]); }); } },
                    { group: 'structure', label: dbeT('paletteWrapCollection', 'Wrap in collection'), run: function () { runClose(function () { wrap('collection', [id]); }); } }
                );
            }
            commands.push(
                { group: 'element', label: dbeT('paletteRename', 'Rename…'), accel: 'F2', input: true, ph: 'New name', run: function (v) {
                    if (!v.trim()) { return; }
                    runClose(function () { commitRename(id, v.trim()); });
                } }
            );
            if (on('auto_bem')) {
                commands.push(
                    { group: 'element', label: dbeT('paletteAutoBem', 'Auto-BEM…'), run: function () { runClose(function () { openAutoBemDialog(id); }); } }
                );
            }
            commands.push(
                { group: 'element', label: dbeT('paletteDuplicate', 'Duplicate'), accel: dbeAccel('D', { cmd: true, shift: true }), run: function () { runClose(function () { driveContextMenuItem(id, 'Duplicate', function (ok) { if (ok) { undoToast(dbeT('duplicated', 'Duplicated element')); } }); }); } },
                { group: 'element', label: dbeT('paletteCopy', 'Copy'), accel: dbeAccel('C', { cmd: true }), run: function () { runClose(function () { driveContextMenuItem(id, 'Copy', function (ok) { if (ok) { undoToast(dbeT('copiedElement', 'Copied element')); } }); }); } },
                { group: 'element', label: dbeT('paletteCut', 'Cut'), accel: dbeAccel('X', { cmd: true }), run: function () { runClose(function () { driveContextMenuItem(id, 'Copy', function (ok) { if (ok) { driveContextMenuItem(id, 'Remove', function () { undoToast(dbeT('cutDone', 'Cut element')); }); } }); }); } },
                { group: 'element', label: dbeT('paletteDelete', 'Delete'), accel: dbeT('accelDelete', 'Del'), run: function () { runClose(function () { driveContextMenuItem(id, 'Remove', function () { undoToast(dbeT('deletedElement', 'Deleted element')); }); }); } },
                // Settings show the selected element's settings — only useful with one.
                { group: 'goto', label: dbeT('goToSettings', 'Go to settings'), accel: dbeAccel('S', { cmd: true, alt: true }), run: function () { runClose(function () { dbeFocusArea('settings'); }); } }
            );
        }
        commands.push(
            { group: 'goto', label: dbeT('goToNavigator', 'Go to Navigator'), accel: dbeAccel('O', { cmd: true, alt: true }), run: function () { runClose(function () { dbeFocusArea('navigator'); }); } },
            { group: 'goto', label: dbeT('goToCanvas', 'Go to canvas'), accel: dbeAccel('P', { cmd: true, alt: true }), run: function () { runClose(function () { dbeFocusArea('canvas'); }); } },
            { group: 'goto', label: dbeT('openInserterCmd', 'Open Inserter'), accel: dbeAccel('N', { cmd: true, alt: true }), run: function () { runClose(function () { dbeFocusArea('inserter'); }); } },
            { group: 'goto', label: dbeT('keyboardShortcuts', 'Keyboard shortcuts'), accel: '?', run: function () { runClose(openShortcutsDialog); } }
        );

        var mode = null; // null = list mode; else the active input command
        var buttons = [];
        var groupHeads = []; // divider/heading <li>s, hidden when their group is fully filtered out

        function renderList() {
            listEl.innerHTML = '';
            buttons = [];
            groupHeads = [];
            var lastGroup = null;
            commands.forEach(function (cmd) {
                if (cmd.group && cmd.group !== lastGroup) {
                    lastGroup = cmd.group;
                    // A labelled divider row. role=presentation + aria-hidden: the
                    // options are self-describing, so the grouping is a visual aid
                    // and must not be read as a listbox child.
                    var head = document.createElement('li');
                    head.className = 'dbe-palette__group';
                    head.setAttribute('role', 'presentation');
                    head.setAttribute('aria-hidden', 'true');
                    head.textContent = GROUP_LABELS[cmd.group] || '';
                    head.dbeGroup = cmd.group;
                    listEl.appendChild(head);
                    groupHeads.push(head);
                }
                var li = document.createElement('li');
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'dbe-palette__item';
                btn.setAttribute('role', 'option');
                var lab = document.createElement('span');
                lab.className = 'dbe-palette__label';
                lab.textContent = cmd.label;
                btn.appendChild(lab);
                if (cmd.accel) {
                    var acc = document.createElement('span');
                    acc.className = 'dbe-palette__accel';
                    acc.textContent = cmd.accel;
                    acc.setAttribute('aria-hidden', 'true'); // decorative; the shortcuts overlay documents it
                    btn.appendChild(acc);
                }
                btn.dbeCmd = cmd;
                btn.dbeGroup = cmd.group;
                btn.dbeLabel = cmd.label; // filter on the label only, not the accel glyphs
                btn.addEventListener('click', function () { pick(cmd); });
                li.appendChild(btn);
                listEl.appendChild(li);
                buttons.push(btn);
            });
            hintEl.textContent = hasEl ? '' : dbeT('paletteNoEl', 'No element selected — element commands are hidden');
        }
        function visible() { return buttons.filter(function (b) { return !b.parentElement.hidden; }); }
        function applyFilter() {
            if (mode) { return; }
            var q = input.value.trim().toLowerCase();
            buttons.forEach(function (b) { b.parentElement.hidden = !!q && (b.dbeLabel || b.textContent).toLowerCase().indexOf(q) === -1; });
            // Hide a group's divider when the filter left it with no visible items.
            groupHeads.forEach(function (h) {
                h.hidden = !buttons.some(function (b) { return b.dbeGroup === h.dbeGroup && !b.parentElement.hidden; });
            });
        }
        function pick(cmd) { if (cmd.input) { enterInput(cmd); } else { cmd.run(); } }
        function enterInput(cmd) {
            mode = cmd;
            listEl.innerHTML = '';
            input.value = '';
            input.placeholder = cmd.ph || cmd.label;
            hintEl.textContent = cmd.label;
            input.focus();
        }
        function exitInput() {
            mode = null;
            input.value = '';
            input.placeholder = dbeT('searchCommands', 'Search commands…');
            renderList(); applyFilter();
            input.focus();
        }

        input.addEventListener('input', applyFilter);
        dlg.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (mode) { mode.run(input.value); return; }
                var vis = visible();
                var cur = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.dbe-palette__item') : null;
                var pickBtn = cur || vis[0];
                if (pickBtn) { pick(pickBtn.dbeCmd); }
                return;
            }
            if (e.key === 'Escape') {
                if (mode) { e.preventDefault(); exitInput(); } // list mode: native dialog Escape closes
                return;
            }
            if (mode || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) { return; }
            e.preventDefault();
            var vis2 = visible();
            if (!vis2.length) { return; }
            var cur2 = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.dbe-palette__item') : null;
            var i = vis2.indexOf(cur2);
            var next = e.key === 'ArrowDown' ? (i < 0 ? 0 : (i + 1) % vis2.length) : (i < 0 ? vis2.length - 1 : (i - 1 + vis2.length) % vis2.length);
            vis2[next].focus();
        });

        renderList();
        dlg.showModal();
        input.focus();
    }

    function dbePaletteKeydown(e) {
        if (e.code !== 'KeyK' || !e.shiftKey || e.altKey) { return; }
        if (!(dbeIsMac ? e.metaKey : (e.ctrlKey || e.metaKey))) { return; }
        if (renameActive()) { return; }
        var t = e.target;
        if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], .monaco-editor')) { return; }
        if (document.querySelector('dialog[open]')) { return; }
        e.preventDefault(); e.stopPropagation();
        openCommandPalette();
    }

    /* Preview resize handles (preview_resize): drag either edge of the canvas
       to resize it around the centre — a container-query-style workflow.
       Width writes go through the builder's OWN top-bar width input
       (.uniGlobalBreakpoints__canvasControl input[name=width]): driving it
       with the native value setter + an input event makes React resize the
       canvas, keep the readout in sync AND highlight the breakpoint whose
       range the width falls into — identical to typing in the field. The one
       width that has no numeric equivalent is the base/"All" state (see
       dbeApplyPreviewWidth): a full-open drag selects it by clicking the base
       button rather than writing a width that would land on Desktop/Tablet. */
    var DBE_PREVIEW_MIN = 240;

    function dbeSetCanvasWidth(w) {
        var input = document.querySelector('.uniGlobalBreakpoints__canvasControl input[name="width"]');
        if (!input) { return false; }
        try {
            var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, String(Math.round(w)));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        } catch (e) { return false; }
    }

    function dbeCanvasInner() { return document.querySelector('.uniIframePanel__inner'); }

    function dbeCanvasMax() {
        var outer = document.querySelector('.uniIframePanel__outer');
        return outer ? Math.round(outer.getBoundingClientRect().width) : window.innerWidth;
    }

    /* Widest breakpoint max (Desktop's "max 1279px" → 1279), 0 if unknown. */
    function dbeLargestBpMax() {
        var bps = dbeBreakpoints();
        var m = 0;
        if (bps) { bps.forEach(function (bp) { if (bp.width && bp.width > m) { m = bp.width; } }); }
        return m;
    }

    /* The base/"All" (full-width, no media query) breakpoint button. It carries
       no width in the breakpoint list; in the top-bar row it sits first. */
    function dbeAllBreakpointBtn() {
        var btns = document.querySelectorAll('.uniPanelButtonBreakpoint');
        if (!btns.length) { return null; }
        var bps = dbeBreakpoints();
        if (bps && bps.length === btns.length) {
            for (var i = 0; i < bps.length; i++) {
                if (!bps[i].width) { return btns[i]; }
            }
        }
        return btns[0];
    }

    /* --- Preview width channel ------------------------------------------------
       The builder couples canvas SIZE and breakpoint CONTEXT through one width
       input, and above the widest breakpoint it has no canvas size of its own: any
       width there is "All", which it renders at full width — the readout keeps
       your number but the canvas is pinned to full. To let the drag rest at any
       width past the widest breakpoint (previewing base styles wider than Desktop,
       what the container-query workflow wants), split the two sides of that
       boundary:

         - At/below the widest breakpoint — native drives both: dbeSetCanvasWidth
           sizes the canvas AND lights the Mobile/Tablet/Desktop band.
         - Between the widest breakpoint and full — keep the base/"All" context (one
           click as we cross in) but OWN the canvas width: write it as a plain inline
           width on the sized element, and set the readout value directly (no input
           event — an input event would send us back through the native path that
           pins to full). React leaves the inline width alone until something
           re-renders that element (picking a breakpoint does, and its write then
           replaces ours — which is why plain, not !important: an !important would
           survive and override those later clicks).
         - At full — the true native "All", no override, so the state stays clean. */

    function dbePreviewSetReadout(w) {
        var input = document.querySelector('.uniGlobalBreakpoints__canvasControl input[name="width"]');
        if (!input) { return; }
        try {
            var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, String(Math.round(w)));
        } catch (e) {}
    }

    var dbePreviewOverriding = false;
    var dbePreviewWantW = 0;
    var dbePreviewGuardObserver = null;
    var dbePreviewGuardTimer = 0;
    var dbePreviewGuardRaf = 0;

    /* Hold the canvas at our width across React's re-render when we flip to the
       base/"All" context. Clicking that button makes React reset the sized element
       to full width, and its timing (a synchronous flush or a later effect) is not
       guaranteed — a plain re-apply can land a paint late and flash. Two channels:
       - a MutationObserver re-applies our inline width in the same microtask as
         React's reset, before the browser paints, so the canvas never flashes wide;
       - a rAF loop re-pins the readout INPUT, which React reverts too but via its
         value property (not an attribute), so the observer can't see it.
       Needed only around the context flip, so it self-stops shortly after the last
       override tick (and outright when the drag ends or leaves the zone) — which
       keeps it from ever fighting a later breakpoint click or a manual width entry. */
    function dbePreviewGuard(wantW) {
        dbePreviewWantW = wantW;
        var inner = dbeCanvasInner();
        if (inner && !dbePreviewGuardObserver && window.MutationObserver) {
            dbePreviewGuardObserver = new MutationObserver(function () {
                if (!dbePreviewOverriding) { return; }
                var el = dbeCanvasInner();
                if (el && el.style.width !== dbePreviewWantW + 'px') {
                    el.style.width = dbePreviewWantW + 'px';
                }
            });
            dbePreviewGuardObserver.observe(inner, { attributes: true, attributeFilter: ['style'] });
            dbePreviewGuardRaf = requestAnimationFrame(function tick() {
                if (!dbePreviewGuardObserver) { return; }
                if (dbePreviewOverriding) { dbePreviewSetReadout(dbePreviewWantW); }
                dbePreviewGuardRaf = requestAnimationFrame(tick);
            });
        }
        if (dbePreviewGuardTimer) { clearTimeout(dbePreviewGuardTimer); }
        dbePreviewGuardTimer = setTimeout(dbePreviewGuardStop, 300);
    }
    function dbePreviewGuardStop() {
        if (dbePreviewGuardTimer) { clearTimeout(dbePreviewGuardTimer); dbePreviewGuardTimer = 0; }
        if (dbePreviewGuardRaf) { cancelAnimationFrame(dbePreviewGuardRaf); dbePreviewGuardRaf = 0; }
        if (dbePreviewGuardObserver) { dbePreviewGuardObserver.disconnect(); dbePreviewGuardObserver = null; }
    }

    function dbePreviewClearOverride() {
        dbePreviewGuardStop();
        if (!dbePreviewOverriding) { return; }
        var inner = dbeCanvasInner();
        if (inner) { inner.style.removeProperty('width'); }
        dbePreviewOverriding = false;
    }

    function dbeApplyPreviewWidth(w, max) {
        w = Math.round(w);
        var bpMax = dbeLargestBpMax();
        var inner = dbeCanvasInner();

        // Custom width strictly between the widest breakpoint and full: base/"All"
        // context, canvas sized by us.
        if (bpMax && inner && w > bpMax && w < max) {
            var all = dbeAllBreakpointBtn();
            if (all && !all.classList.contains('active')) {
                try { all.click(); } catch (e) {}
            }
            inner.style.width = w + 'px';
            dbePreviewOverriding = true;
            dbePreviewSetReadout(w);
            dbePreviewGuard(w); // re-apply across React's post-click reset (no flash)
            return;
        }

        // Fully open: native full-width "All". Set the sized element to full
        // explicitly — when All was already active (we came from a custom width)
        // native won't reassert its 100% on its own, so just clearing our width
        // would collapse the canvas to nothing.
        if (w >= max) {
            dbePreviewGuardStop();
            var allBtn = dbeAllBreakpointBtn();
            if (allBtn && !allBtn.classList.contains('active')) {
                try { allBtn.click(); } catch (e) {}
            }
            if (inner) { inner.style.width = '100%'; }
            dbePreviewOverriding = false;
            dbePreviewSetReadout(dbeCanvasMax());
            return;
        }

        // At/below the widest breakpoint: native owns size + band.
        dbePreviewClearOverride();
        dbeSetCanvasWidth(w);
    }

    function dbeSyncHandleAria(handle) {
        var inner = dbeCanvasInner();
        if (!inner) { return; }
        handle.setAttribute('aria-valuemin', String(DBE_PREVIEW_MIN));
        handle.setAttribute('aria-valuemax', String(dbeCanvasMax()));
        handle.setAttribute('aria-valuenow', String(Math.round(inner.getBoundingClientRect().width)));
    }

    function makePreviewHandle(edge) {
        var h = document.createElement('button');
        h.type = 'button';
        h.className = 'dbe-preview-handle';
        h.setAttribute('data-edge', edge);
        h.setAttribute('role', 'separator');
        h.setAttribute('aria-orientation', 'vertical');
        h.setAttribute('aria-label', dbeT('resizePreview', 'Resize preview canvas'));

        var drag = null;
        h.addEventListener('pointerdown', function (ev) {
            var inner = dbeCanvasInner();
            if (!inner) { return; }
            ev.preventDefault();
            // Drag spans the whole available canvas: the widest breakpoint is a
            // boundary within it (dbeApplyPreviewWidth), not a ceiling.
            drag = { x: ev.clientX, w: inner.getBoundingClientRect().width, max: dbeCanvasMax(), raf: 0 };
            try { h.setPointerCapture(ev.pointerId); } catch (e) {}
            var panel = document.querySelector('.uniIframePanel');
            if (panel) { panel.classList.add('dbe-preview-resizing'); }
        });
        h.addEventListener('pointermove', function (ev) {
            if (!drag || drag.raf) { return; }
            // The canvas is centred, so a 1px pointer move changes the width
            // by 2px (both edges mirror around the middle).
            var delta = (ev.clientX - drag.x) * (edge === 'right' ? 2 : -2);
            var w = Math.max(DBE_PREVIEW_MIN, Math.min(drag.max, drag.w + delta));
            drag.raf = requestAnimationFrame(function () {
                if (drag) { drag.raf = 0; }
                dbeApplyPreviewWidth(w, drag.max);
                dbeSyncHandleAria(h);
            });
        });
        function endPreviewDrag() {
            if (!drag) { return; }
            drag = null;
            var panel = document.querySelector('.uniIframePanel');
            if (panel) { panel.classList.remove('dbe-preview-resizing'); }
            // Release the guard now the drag is over, so it can never fight a
            // breakpoint click; the custom width stays as a plain inline value.
            dbePreviewGuardStop();
        }
        h.addEventListener('pointerup', endPreviewDrag);
        h.addEventListener('pointercancel', endPreviewDrag);

        h.addEventListener('keydown', function (ev) {
            var inner = dbeCanvasInner();
            if (!inner) { return; }
            var max = dbeCanvasMax();
            var w = inner.getBoundingClientRect().width;
            var step = ev.shiftKey ? 50 : 10;
            var next = null;
            switch (ev.key) {
                case 'ArrowRight':
                case 'ArrowUp':
                    next = w + step; break;
                case 'ArrowLeft':
                case 'ArrowDown':
                    next = w - step; break;
                case 'Home': next = DBE_PREVIEW_MIN; break;
                case 'End': next = max; break;
                default: return;
            }
            // Handled keys must not reach the builder's global shortcuts
            // (arrows move the canvas selection).
            ev.preventDefault();
            ev.stopPropagation();
            dbeApplyPreviewWidth(Math.max(DBE_PREVIEW_MIN, Math.min(max, next)), max);
            dbeSyncHandleAria(h);
        });
        return h;
    }

    function ensurePreviewHandles() {
        var inner = dbeCanvasInner();
        if (!inner) { return; }
        // No native width input = no write channel; don't render dead handles.
        if (!document.querySelector('.uniGlobalBreakpoints__canvasControl input[name="width"]')) { return; }
        if (inner.querySelector(':scope > .dbe-preview-handle')) { return; }
        var left = makePreviewHandle('left');
        var right = makePreviewHandle('right');
        inner.appendChild(left);
        inner.appendChild(right);
        dbeSyncHandleAria(left);
        dbeSyncHandleAria(right);
    }

    /* Side-panel resize (panel_resize): drag the inner edge of either side panel
       to set ONE shared width for both — the settings/styles panel (left) and the
       Navigator (right) always match. The width is a single CSS custom property,
       --dbe-panel-width on <body>, that every panel-width rule reads (see
       75-panel-resize.css), so moving either handle moves both. The left panel is
       a normal flex item (the canvas reflows on its own); the right panel is an
       absolutely-positioned overlay whose reserved space lives in the iframe
       panel's own margin — 75-panel-resize.css re-points both at the variable,
       scoped to when the Navigator is actually mounted so a closed panel still
       gives the space back. Width persists in localStorage and re-applies after
       native re-renders. Keyboard: arrows nudge, Home/End jump to the clamp ends. */
    var DBE_PANEL_KEY = 'dbeBuilderPanelWidth';
    var DBE_PANEL_MIN = 260;
    var DBE_PANEL_MAX = 600;
    var DBE_PANEL_DEFAULT = 320;

    function dbePanelWidth() {
        var v = parseInt(getComputedStyle(document.body).getPropertyValue('--dbe-panel-width'), 10);
        return isNaN(v) ? DBE_PANEL_DEFAULT : v;
    }
    function dbeSetPanelWidth(w) {
        w = Math.max(DBE_PANEL_MIN, Math.min(DBE_PANEL_MAX, Math.round(w)));
        document.body.style.setProperty('--dbe-panel-width', w + 'px');
        try { localStorage.setItem(DBE_PANEL_KEY, String(w)); } catch (e) {}
        dbeSyncPanelHandlesAria();
        return w;
    }
    function dbeSyncPanelHandlesAria() {
        var w = dbePanelWidth();
        document.querySelectorAll('.dbe-panel-handle').forEach(function (h) {
            h.setAttribute('aria-valuemin', String(DBE_PANEL_MIN));
            h.setAttribute('aria-valuemax', String(DBE_PANEL_MAX));
            h.setAttribute('aria-valuenow', String(w));
        });
    }

    function makePanelHandle(side) { // side: 'left' | 'right'
        var h = document.createElement('button');
        h.type = 'button';
        h.className = 'dbe-panel-handle';
        h.setAttribute('data-side', side);
        h.setAttribute('role', 'separator');
        h.setAttribute('aria-orientation', 'vertical');
        h.setAttribute('aria-label', dbeT('resizePanels', 'Resize panels'));

        var drag = null;
        h.addEventListener('pointerdown', function (ev) {
            ev.preventDefault();
            drag = { raf: 0 };
            try { h.setPointerCapture(ev.pointerId); } catch (e) {}
            document.body.classList.add('dbe-panel-resizing');
        });
        h.addEventListener('pointermove', function (ev) {
            if (!drag || drag.raf) { return; }
            // Left panel's inner edge is measured from viewport x=0; the right
            // panel sits flush to the viewport's right edge.
            var vw = document.documentElement.clientWidth;
            var w = side === 'left' ? ev.clientX : (vw - ev.clientX);
            drag.raf = requestAnimationFrame(function () {
                if (drag) { drag.raf = 0; }
                dbeSetPanelWidth(w);
            });
        });
        function endPanelDrag() {
            if (!drag) { return; }
            drag = null;
            document.body.classList.remove('dbe-panel-resizing');
        }
        h.addEventListener('pointerup', endPanelDrag);
        h.addEventListener('pointercancel', endPanelDrag);

        h.addEventListener('keydown', function (ev) {
            var step = ev.shiftKey ? 40 : 10;
            var w = dbePanelWidth();
            var next = null;
            switch (ev.key) {
                case 'ArrowRight':
                case 'ArrowUp': next = w + step; break;
                case 'ArrowLeft':
                case 'ArrowDown': next = w - step; break;
                case 'Home': next = DBE_PANEL_MIN; break;
                case 'End': next = DBE_PANEL_MAX; break;
                default: return;
            }
            // Keep arrows off the builder's global canvas-nudge shortcuts.
            ev.preventDefault();
            ev.stopPropagation();
            dbeSetPanelWidth(next);
        });
        return h;
    }

    function ensurePanelHandles() {
        // Left settings/inserter panel — grip on its inner (right) edge. The outer
        // is made position:relative by 75-panel-resize.css so the absolute grip
        // anchors to it without taking flex space.
        var lpo = document.querySelector('.uniLeftPanelOuter');
        if (lpo && !lpo.querySelector(':scope > .dbe-panel-handle')) {
            lpo.appendChild(makePanelHandle('left'));
        }
        // Right Navigator panel — grip on its inner (left) edge, appended to the
        // absolutely-positioned wrapper so panel overflow can't clip it.
        var rp = document.querySelector('.uniRightPanel');
        var rpWrap = rp && rp.parentElement;
        if (rpWrap && !rpWrap.querySelector(':scope > .dbe-panel-handle')) {
            rpWrap.appendChild(makePanelHandle('right'));
        }
        dbeSyncPanelHandlesAria();
    }

    /* Seed --dbe-panel-width from the stored value before the handles mount, so
       the panels open at the remembered width (the CSS carries a 320px fallback
       for the first-ever run). */
    function applyStoredPanelWidth() {
        var v;
        try { v = parseInt(localStorage.getItem(DBE_PANEL_KEY), 10); } catch (e) {}
        if (!isNaN(v)) {
            document.body.style.setProperty('--dbe-panel-width',
                Math.max(DBE_PANEL_MIN, Math.min(DBE_PANEL_MAX, v)) + 'px');
        }
    }

    /* CSS-panel hint (css_hint_dialog): Builderius prints a two-line
       selector/breakpoint hint (.uniInlineTooltipMessage) under the CSS editor
       that eats vertical space AND whose wording is inconsistent by scope — the
       %local% variant lists the breakpoint VARIABLES (--desktop/--tablet/--mobile),
       while the class/%selector% variant mentions only the breakpoints switcher.
       We hide the native lines (44-css-hint.css) and replace them with one
       compact, dismissable affordance whose dialog carries a SINGLE unified
       explanation covering both tokens and both breakpoint facts. First run shows
       a one-line banner with a close (×); dismissing it (remembered in
       localStorage) collapses it to a small info button that always reopens the
       dialog, so the help is reclaimed-but-recoverable. */
    var DBE_HINT_KEY = 'dbeBuilderCssHintDismissed';

    function cssHintDismissed() {
        try { return localStorage.getItem(DBE_HINT_KEY) === '1'; } catch (e) { return false; }
    }

    function cssHintBodyHtml() {
        // One consistent structure for both tokens, breakpoints stated once for
        // both. The strings carry <code> markup for the tokens; they are our own
        // trusted copy (i18n-builder.php).
        return '<dl class="dbe-css-hint-dl">' +
            '<dt><code>%local%</code></dt><dd>' +
            dbeT('cssHintLocal', 'Targets this element only, through its automatic class. Use <code>%#local%</code> to target it by ID instead.') + '</dd>' +
            '<dt><code>%selector%</code></dt><dd>' +
            dbeT('cssHintSelector', 'Targets every element that uses the current class.') + '</dd>' +
            '<dt>' + dbeT('cssHintBreakpointsTerm', 'Breakpoints') + '</dt><dd>' +
            dbeT('cssHintBreakpoints', 'Switch breakpoint in the top bar to write CSS for a specific screen size. Inside a rule you can also use the breakpoint variables <code>--desktop</code>, <code>--tablet</code> and <code>--mobile</code> as values.') + '</dd>' +
            '</dl>';
    }

    function openCssHintDialog() {
        var dlg = document.getElementById('dbe-css-hint-dialog');
        if (!dlg) {
            dlg = document.createElement('dialog');
            dlg.id = 'dbe-css-hint-dialog';
            dlg.className = 'dbe-css-hint-dialog';
            dlg.innerHTML =
                '<div class="dbe-css-hint-dialog__head">' +
                    '<h2 class="dbe-css-hint-dialog__title">' + dbeT('cssHintTitle', 'Selector tokens & breakpoints') + '</h2>' +
                    '<button type="button" class="dbe-css-hint-dialog__close" aria-label="' + dbeT('cssHintClose', 'Close') + '">×</button>' +
                '</div>' +
                '<div class="dbe-css-hint-dialog__body">' + cssHintBodyHtml() + '</div>';
            dlg.querySelector('.dbe-css-hint-dialog__close').addEventListener('click', function () { dlg.close(); });
            // Keep builder shortcuts from firing while the dialog has focus.
            dlg.addEventListener('keydown', function (e) { e.stopPropagation(); });
            // Backdrop click closes (native <dialog> also gives Esc for free).
            dlg.addEventListener('click', function (e) { if (e.target === dlg) { dlg.close(); } });
            document.body.appendChild(dlg);
        }
        if (!dlg.open) { dlg.showModal(); }
    }

    function ensureCssHint() {
        // Anchor to the native hint block so our affordance lands exactly where
        // the help used to be. The native lines are hidden by CSS (still in the
        // DOM), so their presence is a reliable "we're in the styles view" signal.
        var firstMsg = document.querySelector('.uniLeftPanel .uniInlineTooltipMessage');
        if (!firstMsg) {
            var stale = document.querySelector('.dbe-css-hint');
            if (stale) { stale.remove(); }
            return;
        }
        var host = firstMsg.parentElement;
        var dismissed = cssHintDismissed();
        var existing = host.querySelector(':scope > .dbe-css-hint');
        if (existing) {
            existing.classList.toggle('is-collapsed', dismissed);
            return;
        }
        var el = document.createElement('div');
        el.className = 'dbe-css-hint' + (dismissed ? ' is-collapsed' : '');
        el.innerHTML =
            '<button type="button" class="dbe-css-hint-btn">' +
                '<span class="dbe-css-hint-i" aria-hidden="true">i</span>' +
                '<span class="dbe-css-hint-label">' + dbeT('cssHintBanner', 'How %local%, %selector% & breakpoints work') + '</span>' +
            '</button>' +
            '<button type="button" class="dbe-css-hint-dismiss" aria-label="' + dbeT('cssHintDismiss', 'Dismiss hint') + '">×</button>';
        var btn = el.querySelector('.dbe-css-hint-btn');
        btn.setAttribute('aria-label', dbeT('cssHintOpen', 'Selector and breakpoint help'));
        btn.addEventListener('click', openCssHintDialog);
        el.querySelector('.dbe-css-hint-dismiss').addEventListener('click', function () {
            try { localStorage.setItem(DBE_HINT_KEY, '1'); } catch (e) {}
            el.classList.add('is-collapsed');
        });
        host.insertBefore(el, firstMsg);
    }

    /* Detachable Navigator (panel_detach, experimental): float the Navigator free
       of the docked layout so it can sit over the canvas. We do NOT move the
       React-owned panel node (that would sever its store bindings) — instead we
       switch its absolutely-positioned wrapper to position:fixed and drive its box
       from CSS vars (--dbe-nav-x/y/w/h) that 76-panel-detach.css reads, and the
       canvas reclaims the docked column via body.dbe-nav-detached. Drag by the
       panel header, resize from the bottom-inline-end grip. The detached flag and
       geometry persist in localStorage and re-apply idempotently after native
       re-renders (CSS vars + a body class, never one-shot inline writes). */
    var DBE_NAV_KEY = 'dbeBuilderNavFloat';
    var DBE_NAV_MIN_W = 240;
    var DBE_NAV_MIN_H = 200;
    var dbeNavHeaderBound = false;

    function navWrap() {
        var rp = document.querySelector('.uniRightPanel');
        return rp ? rp.parentElement : null;
    }
    function navFloatState() {
        try { return JSON.parse(localStorage.getItem(DBE_NAV_KEY)) || null; } catch (e) { return null; }
    }
    function saveNavFloat(st) {
        try { localStorage.setItem(DBE_NAV_KEY, JSON.stringify(st)); } catch (e) {}
    }
    /* Keep the floating panel inside the viewport (below the ~47px top bar), with
       a sensible minimum size. */
    function clampNav(st) {
        var vw = document.documentElement.clientWidth;
        var vh = document.documentElement.clientHeight;
        st.w = Math.max(DBE_NAV_MIN_W, Math.min(st.w, vw));
        st.h = Math.max(DBE_NAV_MIN_H, Math.min(st.h, vh - 47));
        st.x = Math.max(0, Math.min(st.x, vw - 40));
        st.y = Math.max(47, Math.min(st.y, vh - 40));
        return st;
    }
    function applyNavFloatVars(st) {
        var r = document.documentElement.style;
        r.setProperty('--dbe-nav-x', st.x + 'px');
        r.setProperty('--dbe-nav-y', st.y + 'px');
        r.setProperty('--dbe-nav-w', st.w + 'px');
        r.setProperty('--dbe-nav-h', st.h + 'px');
    }

    function detachNav() {
        var wrap = navWrap();
        if (!wrap) { return; }
        var st = navFloatState();
        if (!st || !st.detached) {
            // Seed geometry from the panel's current docked box so it floats in place.
            var r = wrap.getBoundingClientRect();
            st = { detached: true, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
        } else {
            st.detached = true;
        }
        clampNav(st);
        applyNavFloatVars(st);
        document.body.classList.add('dbe-nav-detached');
        saveNavFloat(st);
        syncDetachButton();
    }
    function dockNav() {
        document.body.classList.remove('dbe-nav-detached');
        var st = navFloatState() || {};
        st.detached = false;
        saveNavFloat(st);
        syncDetachButton();
    }
    function toggleNav() {
        if (document.body.classList.contains('dbe-nav-detached')) { dockNav(); } else { detachNav(); }
    }

    var DETACH_SVG = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M8 1.5h4.5V6M12.5 1.5 7 7M6 2H2.5A1 1 0 0 0 1.5 3v8.5a1 1 0 0 0 1 1H11a1 1 0 0 0 1-1V8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';


    function syncDetachButton() {
        var btn = document.querySelector('.uniRightPanel .dbe-detach-btn');
        if (!btn) { return; }
        var floating = document.body.classList.contains('dbe-nav-detached');
        btn.classList.toggle('is-detached', floating);
        btn.setAttribute('aria-pressed', floating ? 'true' : 'false');
        var label = floating ? dbeT('dockPanel', 'Dock panel') : dbeT('detachPanel', 'Detach panel');
        btn.setAttribute('aria-label', label);
        // Prefer our branded chip. The label is dynamic (Detach ↔ Dock), so this
        // button can't ride the static DBE_TIPS list like the other header icons
        // — set data-dbe-tip here and drop the native title so the two never
        // double up. With the tooltips feature off, fall back to the title.
        if (on('tooltips')) {
            btn.setAttribute('data-dbe-tip', label);
            btn.removeAttribute('title');
        } else {
            btn.title = label;
            btn.removeAttribute('data-dbe-tip');
        }
    }

    function ensureDetachButton() {
        var icons = document.querySelector('.uniRightPanel .uniPanelHeader__icons');
        if (!icons || icons.querySelector('.dbe-detach-btn')) { return; }
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'uniPanelIconButton uniPanelIconButtonSmall dbe-detach-btn';
        btn.innerHTML = '<span>' + DETACH_SVG + '</span>';
        btn.addEventListener('click', toggleNav);
        icons.appendChild(btn);
        syncDetachButton();
    }

    /* Inject a visible drag handle at the top of the header. The header itself is
       the drag surface (bindNavHeaderDrag), but nothing told users so; this marks
       where to grab. A centred horizontal bar (styled in 76-panel-detach.css) reads
       as "drag to move" the way a bottom-sheet grabber does. A decorative <span>
       (not a button) so the delegated header-drag handler — which ignores
       buttons/inputs — still fires on it. Re-added each schedule() tick, so it
       survives the header re-rendering. */
    function ensureNavGrip() {
        var header = document.querySelector('.uniRightPanel .uniPanelHeader');
        if (!header || header.querySelector(':scope > .dbe-nav-grip')) { return; }
        var grip = document.createElement('span');
        grip.className = 'dbe-nav-grip';
        grip.setAttribute('aria-hidden', 'true');
        grip.title = dbeT('dragToMove', 'Drag to move');
        header.insertBefore(grip, header.firstChild);
    }

    function ensureNavResizeGrip() {
        var wrap = navWrap();
        if (!wrap || wrap.querySelector(':scope > .dbe-nav-resize')) { return; }
        var grip = document.createElement('button');
        grip.type = 'button';
        grip.className = 'dbe-nav-resize';
        grip.setAttribute('aria-label', dbeT('resizePanel', 'Resize panel'));
        var drag = null;
        grip.addEventListener('pointerdown', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            var st = navFloatState() || {};
            drag = { x: ev.clientX, y: ev.clientY, w: st.w, h: st.h, raf: 0 };
            try { grip.setPointerCapture(ev.pointerId); } catch (e) {}
            document.body.classList.add('dbe-nav-dragging');
        });
        grip.addEventListener('pointermove', function (ev) {
            if (!drag || drag.raf) { return; }
            drag.raf = requestAnimationFrame(function () {
                drag.raf = 0;
                var st = navFloatState() || {};
                st.w = drag.w + (ev.clientX - drag.x);
                st.h = drag.h + (ev.clientY - drag.y);
                clampNav(st);
                applyNavFloatVars(st);
                saveNavFloat(st);
            });
        });
        function end() { if (drag) { drag = null; document.body.classList.remove('dbe-nav-dragging'); } }
        grip.addEventListener('pointerup', end);
        grip.addEventListener('pointercancel', end);
        wrap.appendChild(grip);
    }

    /* Drag the whole float by its header (delegated + bound once on document, so
       it survives the header re-rendering). Ignores clicks on the header's own
       buttons so the detach/collapse/expand icons still work. */
    function bindNavHeaderDrag() {
        if (dbeNavHeaderBound) { return; }
        dbeNavHeaderBound = true;
        var drag = null;
        document.addEventListener('pointerdown', function (ev) {
            if (!document.body.classList.contains('dbe-nav-detached')) { return; }
            var header = ev.target.closest && ev.target.closest('.uniRightPanel .uniPanelHeader');
            if (!header) { return; }
            if (ev.target.closest('button, input, [contenteditable="true"]')) { return; }
            var st = navFloatState();
            if (!st) { return; }
            ev.preventDefault();
            drag = { px: ev.clientX, py: ev.clientY, x: st.x, y: st.y, raf: 0 };
            document.body.classList.add('dbe-nav-dragging');
        }, true);
        document.addEventListener('pointermove', function (ev) {
            if (!drag || drag.raf) { return; }
            drag.raf = requestAnimationFrame(function () {
                drag.raf = 0;
                var st = navFloatState() || {};
                st.x = drag.x + (ev.clientX - drag.px);
                st.y = drag.y + (ev.clientY - drag.py);
                clampNav(st);
                applyNavFloatVars(st);
                saveNavFloat(st);
            });
        }, true);
        function end() { if (drag) { drag = null; document.body.classList.remove('dbe-nav-dragging'); } }
        document.addEventListener('pointerup', end, true);
        document.addEventListener('pointercancel', end, true);
    }

    /* Called from schedule(): keep the detach button + resize grip present, and
       re-assert the floating state (body class + CSS vars) after re-renders. */
    function ensureNavDetach() {
        ensureDetachButton();
        ensureNavGrip();
        ensureNavResizeGrip();
        bindNavHeaderDrag();
        var st = navFloatState();
        if (st && st.detached) {
            clampNav(st);
            applyNavFloatVars(st);
            if (!document.body.classList.contains('dbe-nav-detached')) {
                document.body.classList.add('dbe-nav-detached');
            }
        }
        syncDetachButton();
    }

    /* Favourites bar reorder (favourites_reorder). The bar is the vertical
       ul.uniModTree__favouritesList beside the tree; each li holds a hidden
       remove button (shown by the native edit mode) and a tooltipItem wrapper
       whose tooltipId__favModule_<Type> class is a stable identity. A
       rearrange toggle at the top of the bar enters drag mode — outside it
       nothing is draggable and clicks insert elements as normal. The order
       persists in localStorage and is re-applied (idempotently — mutating
       only when the order differs, which is what stops an observer feedback
       loop) after every React re-render. */
    var DBE_FAV_KEY = 'dbeFavouritesOrder';
    var dbeFavStatus = null;

    function favList() { return document.querySelector('.uniModTree__favouritesList'); }

    function favItems() {
        var list = favList();
        return list ? [].slice.call(list.children).filter(function (li) {
            return li.classList.contains('uniModTree__favouritesListItem');
        }) : [];
    }

    function favKey(li) {
        var t = li.querySelector('[class*="tooltipId__favModule_"]');
        var m = t && t.className.toString().match(/tooltipId__favModule_(\S+)/);
        if (m) { return m[1]; }
        var tc = li.querySelector('[data-tooltip-content]');
        if (tc) { return 'label:' + tc.getAttribute('data-tooltip-content'); }
        var p = li.querySelector('.modIcon svg path');
        return p ? 'glyph:' + (p.getAttribute('d') || '').slice(0, 24) : null;
    }

    function favLabel(li) {
        var tc = li.querySelector('[data-tooltip-content]');
        return (tc && tc.getAttribute('data-tooltip-content')) || 'favourite';
    }

    function favAnnounce(msg) {
        if (!dbeFavStatus || !document.body.contains(dbeFavStatus)) {
            dbeFavStatus = document.createElement('div');
            dbeFavStatus.className = 'dbe-visually-hidden';
            dbeFavStatus.setAttribute('role', 'status');
            document.body.appendChild(dbeFavStatus);
        }
        dbeFavStatus.textContent = msg;
    }

    function favPersistOrder() {
        try { localStorage.setItem(DBE_FAV_KEY, JSON.stringify(favItems().map(favKey).filter(Boolean))); } catch (e) {}
    }

    function favSavedOrder() {
        try {
            var v = JSON.parse(localStorage.getItem(DBE_FAV_KEY) || 'null');
            return Array.isArray(v) && v.length ? v : null;
        } catch (e) { return null; }
    }

    function applyFavouritesOrder() {
        var list = favList();
        var saved = favSavedOrder();
        if (!list || !saved) { return; }
        // Never fight the user mid-rearrange or the native edit mode.
        if (list.classList.contains('dbe-fav-reordering')) { return; }
        if (list.querySelector('.uniModTree__favouritesListItem.editting')) { return; }
        var items = favItems();
        if (items.length < 2) { return; }
        var pos = {};
        saved.forEach(function (k, i) { pos[k] = i; });
        // Known icons sort by their saved position; new/unknown ones keep
        // their native relative order after the known ones.
        var target = items.map(function (li, i) {
            var k = favKey(li);
            return { li: li, i: i, saved: (k && pos[k] !== undefined) ? pos[k] : saved.length + i };
        }).sort(function (a, b) { return (a.saved - b.saved) || (a.i - b.i); }).map(function (d) { return d.li; });
        var differs = target.some(function (li, i) { return items[i] !== li; });
        if (!differs) { return; }
        target.forEach(function (li) { list.appendChild(li); });
    }

    function setFavMode(list, onMode) {
        var btn = list.querySelector('.dbe-fav-reorder-btn');
        list.classList.toggle('dbe-fav-reordering', onMode);
        if (btn) { btn.setAttribute('aria-pressed', onMode ? 'true' : 'false'); }
        favItems().forEach(function (li) {
            var icon = li.querySelector('button.modIcon');
            if (!icon) { return; }
            if (onMode) {
                icon.setAttribute('data-dbe-fav-label', icon.getAttribute('aria-label') || '');
                icon.setAttribute('aria-label', dbeFmt(dbeT('favArrowHint', '%s (press up or down arrow to move, Escape to finish)'), favLabel(li)));
            } else {
                var prev = icon.getAttribute('data-dbe-fav-label');
                if (prev) { icon.setAttribute('aria-label', prev); } else { icon.removeAttribute('aria-label'); }
                icon.removeAttribute('data-dbe-fav-label');
            }
        });
        if (onMode) {
            favAnnounce(dbeT('favModeOn', 'Rearrange mode on: drag the icons, or focus one and use the arrow keys'));
        } else {
            favPersistOrder();
            favAnnounce(dbeT('modeOffSaved', 'Rearrange mode off: order saved'));
        }
    }

    function bindFavDrag(list) {
        if (list.dbeFavBound) { return; }
        list.dbeFavBound = true;
        var drag = null;

        // In drag mode clicks must not insert elements or open native UI.
        list.addEventListener('click', function (ev) {
            if (!list.classList.contains('dbe-fav-reordering')) { return; }
            if (ev.target.closest && ev.target.closest('.dbe-fav-reorder')) { return; }
            ev.preventDefault();
            ev.stopPropagation();
        }, true);

        list.addEventListener('pointerdown', function (ev) {
            if (!list.classList.contains('dbe-fav-reordering')) { return; }
            var li = ev.target.closest && ev.target.closest('li.uniModTree__favouritesListItem');
            if (!li) { return; }
            ev.preventDefault();
            ev.stopPropagation();
            drag = { li: li };
            li.classList.add('dbe-fav-dragging');
            try { ev.target.setPointerCapture(ev.pointerId); } catch (e) {}
        }, true);

        list.addEventListener('pointermove', function (ev) {
            if (!drag) { return; }
            var items = favItems().filter(function (it) { return it !== drag.li; });
            for (var i = 0; i < items.length; i++) {
                var r = items[i].getBoundingClientRect();
                if (ev.clientY >= r.top && ev.clientY <= r.bottom) {
                    var before = ev.clientY < r.top + r.height / 2;
                    list.insertBefore(drag.li, before ? items[i] : items[i].nextSibling);
                    break;
                }
            }
        }, true);

        function endFavDrag() {
            if (!drag) { return; }
            var li = drag.li;
            li.classList.remove('dbe-fav-dragging');
            drag = null;
            favPersistOrder();
            var items = favItems();
            favAnnounce(dbeFmt(dbeT('movedToPosition', 'Moved %1$s to position %2$s of %3$s'), favLabel(li), items.indexOf(li) + 1, items.length));
        }
        list.addEventListener('pointerup', endFavDrag, true);
        list.addEventListener('pointercancel', endFavDrag, true);

        list.addEventListener('keydown', function (ev) {
            if (!list.classList.contains('dbe-fav-reordering')) { return; }
            if (ev.key === 'Escape') {
                ev.preventDefault();
                ev.stopPropagation();
                setFavMode(list, false);
                var b = list.querySelector('.dbe-fav-reorder-btn');
                if (b) { b.focus(); }
                return;
            }
            if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') { return; }
            var li = ev.target.closest && ev.target.closest('li.uniModTree__favouritesListItem');
            if (!li) { return; }
            ev.preventDefault();
            ev.stopPropagation();
            var sib = ev.key === 'ArrowUp' ? li.previousElementSibling : li.nextElementSibling;
            if (!sib || !sib.classList.contains('uniModTree__favouritesListItem')) { return; }
            list.insertBefore(li, ev.key === 'ArrowUp' ? sib : sib.nextSibling);
            favPersistOrder();
            var items = favItems();
            favAnnounce(dbeFmt(dbeT('movedToPosition', 'Moved %1$s to position %2$s of %3$s'), favLabel(li), items.indexOf(li) + 1, items.length));
            var focusTarget = li.querySelector('button.modIcon');
            if (focusTarget) { focusTarget.focus(); }
        }, true);
    }

    function ensureFavouritesReorder() {
        var list = favList();
        if (!list) { return; }
        bindFavDrag(list);
        // The native edit-favourites mode owns the bar while active.
        if (list.classList.contains('dbe-fav-reordering') &&
            list.querySelector('.uniModTree__favouritesListItem.editting')) {
            setFavMode(list, false);
        }
        if (list.querySelector('.dbe-fav-reorder')) { return; }
        var li = document.createElement('li');
        li.className = 'dbe-fav-reorder';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dbe-fav-reorder-btn';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', dbeT('rearrangeFavourites', 'Rearrange favourites'));
        btn.setAttribute('data-dbe-tip', dbeT('rearrangeFavourites', 'Rearrange favourites'));
        btn.innerHTML = '<svg width="10" height="14" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<circle cx="3" cy="2.5" r="1.3" fill="currentColor"/><circle cx="7" cy="2.5" r="1.3" fill="currentColor"/>' +
            '<circle cx="3" cy="7" r="1.3" fill="currentColor"/><circle cx="7" cy="7" r="1.3" fill="currentColor"/>' +
            '<circle cx="3" cy="11.5" r="1.3" fill="currentColor"/><circle cx="7" cy="11.5" r="1.3" fill="currentColor"/></svg>';
        btn.addEventListener('click', function () {
            setFavMode(list, btn.getAttribute('aria-pressed') !== 'true');
        });
        li.appendChild(btn);
        list.insertBefore(li, list.firstChild);
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
                if (nameInput.getAttribute('list') !== 'dbe-attr-names') { nameInput.setAttribute('list', 'dbe-attr-names'); }
                // The inputs carry only a "name"/"value" placeholder, which is not
                // an accessible name — give each a real label for screen readers.
                if (!nameInput.getAttribute('aria-label')) { nameInput.setAttribute('aria-label', dbeT('attrNameLabel', 'Attribute name')); }
            }
            [].slice.call(row.querySelectorAll('input')).forEach(function (inp) {
                if (inp !== nameInput && !inp.getAttribute('aria-label')) {
                    inp.setAttribute('aria-label', dbeT('attrValueLabel', 'Attribute value'));
                }
            });
        });
    }

    function bindAttrAutoClean() {
        if (document.dbeAttrCleanBound) { return; }
        document.dbeAttrCleanBound = true;
        // When focus leaves the seeded row while it is still blank, drop it — the
        // row the user never filled in never reaches the store's save.
        document.addEventListener('focusout', function () {
            if (!dbeAttrSeededRow) { return; }
            setTimeout(function () {
                var r = dbeAttrSeededRow;
                if (!r) { return; }
                if (!document.body.contains(r)) {
                    // Row gone with the panel — clean the store copy instead.
                    dbeAttrSeededRow = null;
                    if (dbeAttrSeededFor) { try { dbeRemoveBlankAttrs(dbeAttrSeededFor); } catch (e) {} }
                    return;
                }
                if (r.contains(document.activeElement)) { return; } // still editing it
                r.classList.remove('dbe-attr-seeded');
                if (attrRowBlank(r)) { attrRemoveRow(r); }
                dbeAttrSeededRow = null; // its fate is settled either way
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
        clickSeq(addBtn);
        waitFor(function () {
            var l = attrList();
            return (l && l.querySelector(ATTR_ROW_SEL)) || null;
        }, function (r) {
            if (!r) { return; }
            dbeAttrSeededRow = r;
            r.classList.add('dbe-attr-seeded');
            var l = attrList();
            if (l) { bindAttrQuickPick(l); }
            var ni = attrNameInput(r);
            if (ni) { try { ni.focus(); } catch (e) {} }
        });
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
        if (list.dbePropBound) { return; }
        list.dbePropBound = true;
        var drag = null;
        list.addEventListener('click', function (ev) {
            if (!list.classList.contains('dbe-prop-reordering')) { return; }
            if (ev.target.closest && ev.target.closest('.dbe-prop-reorder')) { return; }
            ev.preventDefault();
            ev.stopPropagation();
        }, true);
        list.addEventListener('pointerdown', function (ev) {
            if (!list.classList.contains('dbe-prop-reordering')) { return; }
            var li = ev.target.closest && ev.target.closest(PROP_ROW_SEL);
            if (!li) { return; }
            ev.preventDefault();
            ev.stopPropagation();
            drag = { li: li };
            li.classList.add('dbe-prop-dragging');
            try { ev.target.setPointerCapture(ev.pointerId); } catch (e) {}
        }, true);
        list.addEventListener('pointermove', function (ev) {
            if (!drag) { return; }
            var items = propItems(list).filter(function (it) { return it !== drag.li; });
            for (var i = 0; i < items.length; i++) {
                var r = items[i].getBoundingClientRect();
                if (ev.clientY >= r.top && ev.clientY <= r.bottom) {
                    var before = ev.clientY < r.top + r.height / 2;
                    list.insertBefore(drag.li, before ? items[i] : items[i].nextSibling);
                    break;
                }
            }
        }, true);
        function endDrag() {
            if (!drag) { return; }
            var li = drag.li;
            li.classList.remove('dbe-prop-dragging');
            drag = null;
            var items = propItems(list);
            propAnnounce(dbeFmt(dbeT('movedToPosition', 'Moved %1$s to position %2$s of %3$s'), propLabel(li), items.indexOf(li) + 1, items.length));
        }
        list.addEventListener('pointerup', endDrag, true);
        list.addEventListener('pointercancel', endDrag, true);
        list.addEventListener('keydown', function (ev) {
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

    /* Class-chip copy menu (context_menu). The class chips in the Styles
       editor natively offer only a hover-revealed remove (X); right-click
       (or Shift+F10 on a focused chip) opens a small menu to copy the class
       name — with the leading dot for CSS, without it for markup, or every
       class at once — or remove it from the element (via the chip's own
       remove control, so it goes through the builder store). A plain fixed
       card (no showModal): dismissed by any outside pointer press, scroll
       or Escape. */
    var dbeChipMenu = null;

    function closeChipMenu() {
        if (dbeChipMenu) { dbeChipMenu.remove(); dbeChipMenu = null; }
    }

    function dbeCopyText(text) {
        function done() { undoToast(dbeFmt(dbeT('copied', 'Copied %s'), text)); }
        function fallback() {
            try {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                done();
            } catch (e) { undoToast(dbeT('copyFailed', 'Copy failed: clipboard unavailable')); }
        }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done, fallback);
                return;
            }
        } catch (e) {}
        fallback();
    }

    /* Shared renderer for both class-chip menus (the applied-class list chips and
       the active-selector chip). items: [{label, fn, first?}] — `first` draws the
       group separator (30-context-menu.css). focusReturn takes focus back on
       Escape. Same card chain as the flyouts so the framework CSS styles it. */
    function renderChipCard(focusReturn, x, y, items) {
        closeChipMenu();
        if (!items || !items.length) { return; }
        var card = document.createElement('div');
        card.className = 'uniBuilderContextMenu dbe-ctx-submenu dbe-chip-menu';
        var inner = document.createElement('div');
        inner.className = 'uniBuilderContextMenu__inner';
        var menu = document.createElement('div');
        menu.className = 'uniContextMenu';
        menu.setAttribute('role', 'menu');
        var ul = document.createElement('ul');
        items.forEach(function (item) {
            var li = document.createElement('li');
            li.className = 'uniContextMenu__item' + (item.first ? ' dbe-ctx-item--first' : '');
            li.setAttribute('role', 'menuitem');
            li.tabIndex = -1;
            li.textContent = item.label;
            function act(ev) { ev.preventDefault(); ev.stopPropagation(); closeChipMenu(); item.fn(); }
            li.addEventListener('mousedown', act);
            li.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter' || ev.key === ' ') { act(ev); }
            });
            ul.appendChild(li);
        });
        menu.appendChild(ul);
        inner.appendChild(menu);
        card.appendChild(inner);

        // Keyboard: arrows move, Escape closes and returns focus to the chip.
        card.addEventListener('keydown', function (ev) {
            var lis = [].slice.call(card.querySelectorAll('li'));
            var idx = lis.indexOf(document.activeElement);
            if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
                ev.preventDefault();
                ev.stopPropagation();
                lis[(idx + (ev.key === 'ArrowDown' ? 1 : lis.length - 1)) % lis.length].focus();
            } else if (ev.key === 'Escape') {
                ev.preventDefault();
                ev.stopPropagation();
                closeChipMenu();
                if (focusReturn) { try { focusReturn.focus(); } catch (e) {} }
            }
        });

        document.body.appendChild(card);
        var cw = card.offsetWidth || 176;
        var ch = card.offsetHeight || 80;
        card.style.setProperty('left', Math.min(Math.max(8, x), window.innerWidth - cw - 8) + 'px', 'important');
        card.style.setProperty('top', Math.min(Math.max(8, y), window.innerHeight - ch - 8) + 'px', 'important');
        dbeChipMenu = card;
        var first = card.querySelector('li');
        if (first) { first.focus(); }
    }

    /* The copy items shared by both menus. `name` is the dotted class ('.foo'),
       `allClasses` the full applied set (dotted or bare — dots are stripped). */
    function chipCopyItems(name, allClasses) {
        var bare = name.replace(/^[.#]/, '');
        var items = [{ label: dbeFmt(dbeT('copyName', 'Copy %s'), name), fn: function () { dbeCopyText(name); } }];
        if (bare !== name) {
            items.push({ label: dbeFmt(dbeT('copyNoDot', 'Copy %s (no dot)'), bare), fn: function () { dbeCopyText(bare); } });
        }
        if (allClasses && allClasses.length > 1) {
            items.push({ label: dbeFmt(dbeT('copyAllClasses', 'Copy all classes (%s)'), allClasses.length), fn: function () {
                dbeCopyText(allClasses.map(function (n) { return n.replace(/^\./, ''); }).join(' '));
            } });
        }
        return items;
    }

    /* Every applied class name for the active module, read from the store so it
       still works while a class is "active" and the DOM chip list is hidden. */
    function activeModuleClasses() {
        try {
            var mods = modules(), id = activeId();
            return (mods && mods[id]) ? moduleClasses(mods[id]).slice() : [];
        } catch (e) { return []; }
    }

    // Applied-class list chip: copy the name(s), or remove it from the element
    // (via the chip's own X, so the removal goes through the builder store).
    function openChipMenu(chipLi, x, y) {
        var nameEl = chipLi.querySelector('span') || chipLi;
        var name = (nameEl.textContent || '').trim();
        if (!name) { return; }
        var all = [].slice.call(document.querySelectorAll('.uniModuleCssClassesSelect__list li > span'))
            .map(function (s) { return (s.textContent || '').trim(); })
            .filter(Boolean);
        var items = chipCopyItems(name, all);
        var actions = chipLi.querySelector('.actions');
        if (actions) {
            items.push({ first: true, label: dbeFmt(dbeT('removeFromElement', 'Remove %s from element'), name), fn: function () {
                actions.click();
                undoToast(dbeFmt(dbeT('removedName', 'Removed %s'), name));
            } });
        }
        renderChipCard(chipLi, x, y, items);
    }

    /* Active-selector chip — the class currently being edited. Natively it offers
       only a caret → "Close" (deselect) menu; this brings it to parity with the
       list chips: copy the name / all classes, remove it from the element, plus
       the native Close. Reachable by right-click AND the caret (whose native
       "Close"-only menu is suppressed unless dbeSelCaretBypass lets a driver
       through). */
    var dbeSelCaretBypass = false;

    function selCaretBtn() {
        return document.querySelector('.uniSystemSelectClasses .uniModuleCssSelectorItemSelected .actions button');
    }

    /* Drive the native caret → "Close" item to deselect the active class. done(ok). */
    function driveSelectedClose(done) {
        var btn = selCaretBtn();
        if (!btn) { if (done) { done(false); } return; }
        dbeSelCaretBypass = true;               // let this programmatic click reach the native menu
        try { btn.click(); } catch (e) {}
        dbeSelCaretBypass = false;
        waitFor(function () {
            var m = document.querySelector('.uniContextMenu[data-menu-id^="selected_selector_actions_"]');
            if (!m) { return null; }
            return [].slice.call(m.querySelectorAll('li[role="menuitem"]')).filter(function (l) {
                return /^close$/i.test((l.textContent || '').trim());
            })[0] || null;
        }, function (li) {
            if (li) { li.click(); if (done) { done(true); } }
            else if (done) { done(false); }
        });
    }

    /* Remove the active class from the element: deselect (Close) so the chip list
       returns, then click the matching chip's remove control (store-backed). */
    function removeSelectedClass(name, done) {
        driveSelectedClose(function () {
            waitFor(function () {
                return [].slice.call(document.querySelectorAll('.uniModuleCssClassesSelect__list li')).filter(function (li) {
                    var s = li.querySelector('span');
                    return s && (s.textContent || '').trim() === name;
                })[0] || null;
            }, function (li) {
                var actions = li && li.querySelector('.actions');
                if (actions) { actions.click(); if (done) { done(true); } }
                else if (done) { done(false); }
            });
        });
    }

    function openSelectedChipMenu(selChip, x, y) {
        var nameEl = selChip.querySelector('span') || selChip;
        var name = (nameEl.textContent || '').trim();
        if (!name) { return; }
        var items = chipCopyItems(name, activeModuleClasses());
        items.push({ first: true, label: dbeFmt(dbeT('removeFromElement', 'Remove %s from element'), name), fn: function () {
            removeSelectedClass(name, function (ok) {
                if (ok) { undoToast(dbeFmt(dbeT('removedName', 'Removed %s'), name)); }
            });
        } });
        items.push({ label: dbeT('close', 'Close'), fn: function () { driveSelectedClose(function () {}); } });
        renderChipCard(selChip, x, y, items);
    }

    /* Chips are plain li>span with no focus support; tabindex lets keyboard
       users reach them and open the copy menu with Shift+F10 / the Menu key. */
    function decorateClassChips() {
        document.querySelectorAll('.uniModuleCssClassesSelect__list li, .uniSystemSelectClasses .uniModuleCssSelectorItemSelected').forEach(function (li) {
            if (li.dbeChipDecorated) { return; }
            li.dbeChipDecorated = true;
            li.tabIndex = 0;
        });
    }

    function bindChipMenu() {
        document.addEventListener('contextmenu', function (e) {
            // Active-selector chip first (it is not inside the __list).
            var sel = e.target.closest && e.target.closest('.uniSystemSelectClasses .uniModuleCssSelectorItemSelected');
            if (sel) {
                e.preventDefault();
                e.stopPropagation();
                var rs = sel.getBoundingClientRect();
                openSelectedChipMenu(sel, e.clientX || rs.right, e.clientY || rs.top);
                return;
            }
            var li = e.target.closest && e.target.closest('.uniModuleCssClassesSelect__list li');
            if (!li) { return; }
            e.preventDefault();
            e.stopPropagation();
            openChipMenu(li, e.clientX || li.getBoundingClientRect().right, e.clientY || li.getBoundingClientRect().top);
        }, true);
        // Caret on the active-selector chip: open our enriched menu in place of
        // the native "Close"-only one. Match the whole .actions area, not just
        // the ~8px caret button — Builderius's native handler sits on a wider
        // target, so a click landing in .actions but off the button used to fall
        // through to the native menu. That was the "sometimes only Close, other
        // times the full menu" inconsistency: which menu you got depended on
        // whether the pointer hit the tiny button exactly.
        //
        // The pointerdown/mousedown swallow blocks the native menu whichever of
        // those events it opens on; click then opens ours. All three are bypassed
        // while driveSelectedClose() deliberately reaches the native Close item —
        // that drives the caret with .click(), which fires no pointerdown/
        // mousedown, so the swallow never touches it. preventDefault is NOT called
        // on the down events, so the caret button still takes focus.
        function selCaretActions(e) {
            return (e.target.closest && e.target.closest('.uniSystemSelectClasses .uniModuleCssSelectorItemSelected .actions')) || null;
        }
        ['pointerdown', 'mousedown'].forEach(function (t) {
            document.addEventListener(t, function (e) {
                if (dbeSelCaretBypass) { return; }
                if (selCaretActions(e)) { e.stopPropagation(); }
            }, true);
        });
        document.addEventListener('click', function (e) {
            if (dbeSelCaretBypass) { return; }
            var actions = selCaretActions(e);
            if (!actions) { return; }
            e.preventDefault();
            e.stopPropagation();
            var sel = actions.closest('.uniModuleCssSelectorItemSelected');
            var anchor = actions.querySelector('button') || actions;
            var rb = anchor.getBoundingClientRect();
            openSelectedChipMenu(sel, rb.left, rb.bottom + 2);
        }, true);
        ['pointerdown', 'wheel'].forEach(function (t) {
            document.addEventListener(t, function (e) {
                if (dbeChipMenu && !(e.target.closest && e.target.closest('.dbe-chip-menu'))) { closeChipMenu(); }
            }, true);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && dbeChipMenu && !(e.target.closest && e.target.closest('.dbe-chip-menu'))) {
                e.stopPropagation();
                closeChipMenu();
            }
        }, true);
    }

    /* Which feature groups need which wiring. */
    var NEED_TREE = on('tag_badges') || on('icon_declutter') || on('tree_row_styling') || on('multi_select');
    var NEED_NAV_BUTTONS = on('collapse_expand_all');
    var NEED_LEFT_PANEL = on('css_code_default') || on('scope_bar') || on('context_menu') || on('properties_reorder') || on('attr_helpers') || on('css_hint_dialog');
    var NEED_CTX_MENU = on('context_menu') || on('wrap_in') || on('inline_rename') || on('multi_select') || on('collapse_expand_all') || on('auto_bem') || on('element_moves') || on('keyboard_shortcuts');

    var scheduled = false;
    /* (g) Double-click a Navigator row to rename it inline — a second entry point
       to startRename(), for users who expect double-click-to-rename from
       comparable tools. The two single-clicks that precede the double select the
       row (native); then the inline field opens on it. Needs 32-rename.css for the
       field styling, so the feature ships that CSS whether or not inline_rename
       (the context-menu entry point) is also on. */
    function bindDblclickRename() {
        document.addEventListener('dblclick', function (e) {
            var btn = e.target.closest && e.target.closest('.uniRightPanel .uniModTree__item');
            if (!btn) { return; }
            var m = btn.className.toString().match(/uni-tree-node-(\w+)/);
            if (!m) { return; }
            e.preventDefault();
            e.stopPropagation();
            startRename(m[1]);
        }, true);
    }

    /* (h) Follow the preview selection in the tree: when the active module changes
       (e.g. the user clicks an element on the canvas), expand every collapsed
       ancestor branch down to it and scroll its row into view, so the selection is
       never hidden inside a collapsed subtree. Polled — Builderius sets
       activeModule in a reducer with no hook to subscribe to; the check is a cheap
       storeGet compare that only acts when the id actually changes. */
    var dbeLastRevealedId = null;
    var dbeRevealTimer = null;
    /* Bring the row into view inside the Navigator's OWN scroll box. The tree
       nests several overflow:visible wrappers inside one scrollable container, so
       walk up to the nearest ancestor that actually scrolls (auto/scroll overflow,
       real height, content taller than box) and centre the row by hand — steadier
       than scrollIntoView across the nested layout, and a no-op when the row is
       already fully visible or the panel has no height (collapsed / hidden). */
    function scrollRowIntoTree(row) {
        var sc = row.parentElement;
        while (sc && sc !== document.body) {
            var oy = getComputedStyle(sc).overflowY;
            if ((oy === 'auto' || oy === 'scroll') && sc.clientHeight > 0 && sc.scrollHeight > sc.clientHeight + 2) { break; }
            sc = sc.parentElement;
        }
        if (!sc || sc === document.body || !sc.clientHeight) {
            try { row.scrollIntoView({ block: 'center' }); } catch (e) {}
            return;
        }
        var rr = row.getBoundingClientRect(), sr = sc.getBoundingClientRect();
        if (rr.top >= sr.top && rr.bottom <= sr.bottom) { return; } // already fully visible
        sc.scrollTop += (rr.top - sr.top) - (sc.clientHeight - rr.height) / 2;
    }
    function revealActiveInTree() {
        if (renameActive()) { return; }
        var id = activeId();
        if (!id || id === dbeLastRevealedId) { return; }
        var mods = modules();
        if (!mods || !mods[id]) { return; }
        dbeLastRevealedId = id;

        // Expand each collapsed ancestor, root-most first. Collapsed subtrees stay
        // mounted (their <ul> is display:none), so every ancestor row is already in
        // the DOM — one pass reaches them all. Only rows without .expanded are
        // clicked, so an already-open branch is never toggled shut.
        var chain = [], p = mods[id].parent || '';
        while (p) { chain.unshift(p); p = mods[p] ? (mods[p].parent || '') : ''; }
        chain.forEach(function (aid) {
            var abtn = document.querySelector('.uniRightPanel .uni-tree-node-' + aid);
            if (abtn && !abtn.classList.contains('expanded')) {
                var chev = abtn.querySelector('i');
                if (chev) { clickSeq(chev); }
            }
        });

        // Scroll the row into view once it actually has layout (expansion is an
        // async re-render; getClientRects() is empty while an ancestor is still
        // collapsed or the panel is hidden), and only if it is not already fully
        // visible — no jump when clicking around already-visible rows.
        waitFor(function () {
            var row = document.querySelector('.uniRightPanel .uni-tree-node-' + id);
            return (row && row.getClientRects().length) ? row : null;
        }, function (row) {
            if (row) { try { scrollRowIntoTree(row); } catch (e) {} }
        });
    }
    function bindRevealActive() {
        if (dbeRevealTimer) { return; }
        // Seed with the current selection so the very first tick does not yank the
        // view to whatever happened to be selected at load.
        dbeLastRevealedId = activeId();
        dbeRevealTimer = setInterval(function () {
            try { revealActiveInTree(); } catch (e) {}
        }, 200);
    }

    /* (nk) Navigator keyboard tree (navigator_keyboard). The element Navigator is
       a nested <ul>/<li> of plain <button> rows: every one of the 100+ rows is a
       tab stop, there is no arrow-key model, and a screen reader hears "button",
       not "level 2, expanded". Wire it as an APG tree with the WordPress
       list-view keys — Up/Down move (and select, so the canvas follows), Right
       opens a branch then steps into its first child, Left closes it then steps
       out to the parent, Home/End jump to the ends.

       A row's child <ul> is a SIBLING of its button, not a descendant, so DOM
       nesting cannot express treeitem ownership; the flat aria-level form is used
       (level + setsize + posinset on each row) with the intervening wrappers
       marked presentational so the tree owns every treeitem directly. Selection
       and expand/collapse go through the proven channels: clickSeq(button)
       selects, clickSeq(chevron <i>) toggles — both async re-renders, so focus is
       re-asserted by node id afterwards. */
    var NAV_TREE_SEL = '.uniRightPanel .uniModTree .uniModTree__list';
    var NAV_ROW_SEL = 'button.uniModTree__item';

    function navRootList() {
        // Outermost element list — querySelector returns the first in document
        // order (favourites live in a separate list, the footer outside it).
        return document.querySelector(NAV_TREE_SEL);
    }
    function navRowId(btn) {
        var m = btn && btn.className.toString().match(/uni-tree-node-(\w+)/);
        return m ? m[1] : null;
    }
    function navRowById(id) {
        return id ? document.querySelector('.uniRightPanel .uni-tree-node-' + id) : null;
    }
    function navRowLi(btn) { return btn.closest('li.uniModTree__itemDrag'); }
    function navRowExpandable(btn) { return !!btn.querySelector('i'); }
    function navRowExpanded(btn) { return btn.classList.contains('expanded'); }
    function navRowLevel(btn) {
        var n = 0, li = navRowLi(btn);
        while (li) { n += 1; li = li.parentElement && li.parentElement.closest('li.uniModTree__itemDrag'); }
        return n || 1;
    }
    function navParentRow(btn) {
        var li = navRowLi(btn);
        var pli = li && li.parentElement && li.parentElement.closest('li.uniModTree__itemDrag');
        // The parent li's OWN row is the first tree button inside it (its content
        // wrapper precedes the nested child <ul>).
        return pli ? pli.querySelector(NAV_ROW_SEL) : null;
    }
    // Rows currently on screen — a collapsed branch's <ul> is display:none, so its
    // rows have no offsetParent and drop out of the flattened visible order.
    function navVisibleRows(root) {
        root = root || navRootList();
        if (!root) { return []; }
        return [].slice.call(root.querySelectorAll(NAV_ROW_SEL)).filter(function (b) {
            return b.offsetParent !== null;
        });
    }

    // Move the single tab stop onto `target`, focus it, scroll it into view.
    function navFocus(target) {
        if (!target) { return; }
        var root = navRootList();
        if (root) {
            [].slice.call(root.querySelectorAll(NAV_ROW_SEL)).forEach(function (b) {
                var t = b === target ? '0' : '-1';
                if (b.getAttribute('tabindex') !== t) { b.setAttribute('tabindex', t); }
            });
        }
        target.focus();
        try { scrollRowIntoTree(target); } catch (e) {}
    }

    // Select the row's element (canvas + settings follow), then re-assert focus on
    // it after the async re-render — re-queried by id in case the node moved.
    function navSelect(target) {
        var id = navRowId(target);
        navFocus(target);
        if (!id) { return; }
        clickSeq(target);
        requestAnimationFrame(function () {
            var row = navRowById(id);
            if (row && document.activeElement !== row) { navFocus(row); }
        });
    }

    // Expand/collapse a branch without changing the selection (chevron channel).
    function navToggleExpand(btn) {
        var chev = btn.querySelector('i');
        if (chev) { clickSeq(chev); }
    }

    /* Stamp the APG tree semantics. Idempotent (only writes when a value changes)
       so it is cheap to re-run every schedule() tick, keeping level/expanded/
       selected/roving in sync through Builderius' React re-renders. */
    function navSyncAria() {
        var root = navRootList();
        if (!root) { return; }
        if (root.getAttribute('role') !== 'tree') { root.setAttribute('role', 'tree'); }
        var label = dbeT('elementsTree', 'Elements');
        if (root.getAttribute('aria-label') !== label) { root.setAttribute('aria-label', label); }

        var sel = activeId();
        var rows = [].slice.call(root.querySelectorAll(NAV_ROW_SEL));
        rows.forEach(function (btn) {
            if (btn.getAttribute('role') !== 'treeitem') { btn.setAttribute('role', 'treeitem'); }

            var lvl = String(navRowLevel(btn));
            if (btn.getAttribute('aria-level') !== lvl) { btn.setAttribute('aria-level', lvl); }

            var li = navRowLi(btn);
            var ul = li && li.parentElement;
            if (ul) {
                var sibs = [].slice.call(ul.children).filter(function (el) {
                    return el.matches && el.matches('li.uniModTree__itemDrag');
                });
                var pos = String(sibs.indexOf(li) + 1), size = String(sibs.length);
                if (btn.getAttribute('aria-posinset') !== pos) { btn.setAttribute('aria-posinset', pos); }
                if (btn.getAttribute('aria-setsize') !== size) { btn.setAttribute('aria-setsize', size); }
            }

            if (navRowExpandable(btn)) {
                var ex = navRowExpanded(btn) ? 'true' : 'false';
                if (btn.getAttribute('aria-expanded') !== ex) { btn.setAttribute('aria-expanded', ex); }
            } else if (btn.hasAttribute('aria-expanded')) {
                btn.removeAttribute('aria-expanded');
            }

            var s = (sel && navRowId(btn) === sel) ? 'true' : 'false';
            if (btn.getAttribute('aria-selected') !== s) { btn.setAttribute('aria-selected', s); }

            // Flatten ownership: the <li>, its wrappers and any nested <ul> between
            // this button and the tree become presentational, so the tree owns
            // every treeitem directly (the level attributes carry the hierarchy).
            var node = btn.parentElement;
            while (node && node !== root) {
                if (node.getAttribute('role') !== 'none') { node.setAttribute('role', 'none'); }
                node = node.parentElement;
            }
        });

        // Roving tab stop: keep the row that already holds it (so a keyboard
        // user's position survives a re-render), else the selected row, else the
        // first visible one.
        var vis = rows.filter(function (b) { return b.offsetParent !== null; });
        if (!vis.length) { return; }
        var current = vis.filter(function (b) { return b.getAttribute('tabindex') === '0'; })[0];
        var selRow = sel ? vis.filter(function (b) { return navRowId(b) === sel; })[0] : null;
        var keep = current || selRow || vis[0];
        rows.forEach(function (b) {
            var t = b === keep ? '0' : '-1';
            if (b.getAttribute('tabindex') !== t) { b.setAttribute('tabindex', t); }
        });
    }

    function navOnKeydown(e) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) { return; }
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) { return; } // leave modified combos to the builder
        var btn = e.target.closest && e.target.closest(NAV_ROW_SEL);
        var root = navRootList();
        if (!btn || !root || !root.contains(btn)) { return; }
        var rows = navVisibleRows(root);
        var i = rows.indexOf(btn);
        if (i === -1) { return; }
        e.preventDefault();
        e.stopPropagation();

        switch (e.key) {
            case 'ArrowDown':
                if (i < rows.length - 1) { navSelect(rows[i + 1]); }
                break;
            case 'ArrowUp':
                if (i > 0) { navSelect(rows[i - 1]); }
                break;
            case 'Home':
                navSelect(rows[0]);
                break;
            case 'End':
                navSelect(rows[rows.length - 1]);
                break;
            case 'ArrowRight':
                if (navRowExpandable(btn) && !navRowExpanded(btn)) {
                    navToggleExpand(btn); // open the branch in place
                } else if (navRowExpandable(btn) && navRowExpanded(btn)) {
                    // Already open: the next visible row is this branch's first
                    // child (guard that it really is a descendant).
                    var child = rows[i + 1];
                    if (child && navRowLi(btn).contains(child)) { navSelect(child); }
                }
                break;
            case 'ArrowLeft':
                if (navRowExpandable(btn) && navRowExpanded(btn)) {
                    navToggleExpand(btn); // close the branch in place
                } else {
                    var parent = navParentRow(btn);
                    if (parent) { navSelect(parent); }
                }
                break;
        }
    }

    function ensureNavKeyboard() {
        var root = navRootList();
        if (!root) { return; }
        navSyncAria();
        var panel = document.querySelector('.uniRightPanel');
        if (!panel || panel.dbeNavKeyBound) { return; }
        // Bound on the stable panel (the tree lists are replaced on re-render), so
        // one binding survives every repaint of the tree below it. The flag lives
        // ON the panel node (not module state): if React ever replaces the panel,
        // the replacement simply gets bound afresh instead of the feature dying.
        panel.addEventListener('keydown', navOnKeydown);
        panel.dbeNavKeyBound = true;
    }

    function schedule() {
        if (scheduled) { return; }
        scheduled = true;
        requestAnimationFrame(function () {
            scheduled = false;
            if (NEED_TREE) { try { decorateTree(); } catch (e) {} }
            if (NEED_NAV_BUTTONS) {
                try { ensureCollapseButton(); } catch (e) {}
                try { ensureExpandAllButton(); } catch (e) {}
            }
            if (on('tooltips')) { try { labelChromeIcons(); } catch (e) {} }
            if (on('css_code_default')) {
                try { ensureCssCodeDefault(); } catch (e) {}
                try { ensureCodeModeTabs(); } catch (e) {}
            }
            if (on('css_hint_dialog')) { try { ensureCssHint(); } catch (e) {} }
            if (on('hide_minimap')) { try { dbeDisableMinimap(); } catch (e) {} }
            if (on('scope_bar')) {
                try { readScopeFromControl(); } catch (e) {}
                try { ensureScopeBar(); } catch (e) {}
                try { ensureScopeIsolation(); } catch (e) {}
            }
            if (on('context_menu')) { try { decorateClassChips(); } catch (e) {} }
            if (on('theme_switcher')) { try { ensureThemeButton(); } catch (e) {} }
            if (on('density_toggle')) { try { ensureDensityButton(); } catch (e) {} }
            if (on('topbar_toolbar')) { try { ensureTopbarToolbars(); } catch (e) {} }
            if (on('inserter_keyboard')) { try { ensureInserterKeyboard(); } catch (e) {} }
            if (on('panel_tabs')) { try { ensurePanelTabs(); } catch (e) {} }
            if (on('footer_toolbar')) { try { ensureFooterToolbar(); } catch (e) {} }
            if (on('builderius_menu')) { try { ensureBuilderiusMenu(); } catch (e) {} }
            if (on('select_combobox')) { try { ensureSelectComboboxes(); } catch (e) {} }
            if (on('ai_terminal_tabs')) { try { ensureTerminalTabs(); } catch (e) {} }
            if (on('tree_search')) {
                try { ensureTreeSearch(); } catch (e) {}
                try { applyTreeFilter(); } catch (e) {}
            }
            if (on('navigator_keyboard')) { try { ensureNavKeyboard(); } catch (e) {} }
            if (on('save_state_cue')) { try { ensureSaveCue(); } catch (e) {} }
            if (on('preview_resize')) { try { ensurePreviewHandles(); } catch (e) {} }
            if (on('panel_resize')) { try { ensurePanelHandles(); } catch (e) {} }
            if (on('panel_detach')) { try { ensureNavDetach(); } catch (e) {} }
            if (on('favourites_reorder')) {
                try { ensureFavouritesReorder(); } catch (e) {}
                try { applyFavouritesOrder(); } catch (e) {}
            }
            if (on('properties_reorder')) { try { ensurePropertiesReorder(); } catch (e) {} }
            if (on('attr_helpers')) { try { ensureBlankAttrRow(); } catch (e) {} }
        });
    }

    function boot() {
        var panel = document.querySelector('.uniRightPanel');
        if (!panel) { return void setTimeout(boot, 500); }
        // Seed the shared panel width before the first paint of the handles.
        if (on('panel_resize')) { try { applyStoredPanelWidth(); } catch (e) {} }
        // Restore a detached Navigator before first paint (avoids a docked flash).
        if (on('panel_detach')) {
            try {
                var navSt = navFloatState();
                if (navSt && navSt.detached) { applyNavFloatVars(clampNav(navSt)); document.body.classList.add('dbe-nav-detached'); }
            } catch (e) {}
        }
        schedule();

        // Navigator (right panel) observer — tree decoration, header buttons,
        // multi-select paint, the scope-control cache, the search filter and
        // the tooltip labels that live in its header. Tree mutations are also
        // the cheapest signal that a module operation happened, which is what
        // the save cue keys off.
        if (NEED_TREE || NEED_NAV_BUTTONS || on('tooltips') || on('scope_bar') || on('tree_search') || on('save_state_cue') || on('favourites_reorder') || on('panel_detach') || on('panel_tabs') || on('navigator_keyboard')) {
            new MutationObserver(schedule).observe(panel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
        }

        // Also watch the settings panel area (left) so the CSS-code default
        // reacts to element selection, tab switches, and the CSS-mode toggle.
        // .uniMainPanel is a stable parent of both panels (and of the canvas
        // wrappers the preview + panel handles live in); the rAF debounce in
        // schedule() coalesces the busier stream of mutations.
        if (NEED_LEFT_PANEL || on('tooltips') || on('inserter_keyboard') || on('panel_tabs') || on('preview_resize') || on('panel_resize') || on('panel_detach') || on('builderius_menu')) {
            var main = document.querySelector('.uniMainPanel') || panel.parentElement;
            if (main) {
                new MutationObserver(schedule).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
            }
        }

        // Top bar too — breakpoint buttons and the breakpoints modal mount
        // there; labelChromeIcons(), the theme/density buttons and the save
        // cue must reach it when it re-renders.
        if (on('tooltips') || on('theme_switcher') || on('density_toggle') || on('save_state_cue') || on('topbar_toolbar') || on('builderius_menu')) {
            var top = document.querySelector('.uniTopPanel');
            if (top) {
                new MutationObserver(schedule).observe(top, { childList: true, subtree: true });
            }
        }
        // Footer bar sits outside uniMainPanel/uniTopPanel, so it needs its own
        // watch for adoptNativeTips() to re-take the footer tooltips if the bar
        // re-renders. childList only (no attributes) so our own data-dbe-tip /
        // aria-label edits don't retrigger it.
        if (on('tooltips')) {
            var footer = document.querySelector('.uniFooterPanel');
            if (footer) {
                new MutationObserver(schedule).observe(footer, { childList: true, subtree: true });
            }
        }
        if (on('tooltips')) { bindTooltips(); }

        // Select comboboxes: bind the additive arrow/Enter handling, and watch
        // <body> (where the popover portals) so roles are applied when it opens.
        if (on('select_combobox')) {
            bindSelectCombobox();
            try { new MutationObserver(schedule).observe(document.body, { childList: true }); } catch (e) {}
        }

        // The bottom-bar tools live outside every panel observed above, and
        // ensureFooterToolbar() wires the footer's own observers the first time it
        // sees the bar. Nudge schedule() until that happens, so footer_toolbar
        // works even when it is the only feature enabled (nothing else would be
        // keeping schedule() running). Bounded; stops as soon as the bar is found.
        if (on('footer_toolbar')) {
            (function footerBoot(n) {
                if (dbeFooterBarNode || n <= 0) { return; }
                schedule();
                setTimeout(function () { footerBoot(n - 1); }, 500);
            })(30);
        }

        // The Sense AI session tabs live in that same footer. Nudge schedule()
        // until ensureTerminalTabs() has wired its own observer to the footer bar,
        // so the tabs are reachable even when this is the only feature enabled.
        if (on('ai_terminal_tabs')) {
            (function terminalBoot(n) {
                if (dbeFooterBarNode || n <= 0) { return; }
                schedule();
                setTimeout(function () { terminalBoot(n - 1); }, 500);
            })(30);
        }

        // Remember which row was right-clicked (target for wrap/rename/expand).
        // Right-clicking OUTSIDE the multi-selection resets it to a single-row
        // menu (the convention in comparable tools); auto-driven menus are exempt.
        if (NEED_CTX_MENU) {
            document.addEventListener('contextmenu', function (e) {
                var btn = e.target.closest && e.target.closest('.uniModTree__item');
                if (btn) {
                    var m = btn.className.toString().match(/uni-tree-node-(\w+)/);
                    if (m) {
                        lastCtxId = m[1];
                        if (dbeMultiSel.size && !dbeMultiSel.has(lastCtxId) &&
                            !document.documentElement.classList.contains('dbe-auto-ctx')) {
                            clearMultiSel();
                        }
                    }
                }
            }, true);

            // Hook the native context menu.
            try { window.Builderius.API.hooks.addAction('builderius.contextMenu.show', 'dbeWrapMenu', onContextMenuShow); } catch (e) {}
            try { window.Builderius.API.hooks.addAction('builderius.contextMenu.hide', 'dbeWrapMenuHide', removeSubmenus); } catch (e) {}
        }

        // Copy menu on the Styles editor's class chips.
        if (on('context_menu')) { bindChipMenu(); }

        // Multi-select (Cmd/Ctrl+click, Shift+click) in the Navigator tree —
        // temporarily withdrawn (the multi-row drag never reliably carried the
        // whole selection). The 'multi_select' registry entry is removed, so
        // on('multi_select') is always false; bindMultiSelect / bindMultiDrag
        // stay parked below for when the drag is fixed.
        if (on('multi_select')) { bindMultiSelect(); bindMultiDrag(); }

        // Undo/redo element adds & deletes (Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z).
        if (on('undo_delete')) {
            hookHistoryCapture();
            bindUndoKeys();
        }

        // Cmd/Ctrl+S saves the template.
        if (on('save_shortcut')) { bindSaveShortcut(); }

        // Keyboard shortcuts overlay (?).
        if (on('shortcuts_overlay')) { bindShortcutsKey(); }

        // Double-click a Navigator row to rename it inline.
        if (on('dblclick_rename')) { bindDblclickRename(); }

        // Follow the preview selection: expand + scroll the active row into view.
        if (on('reveal_selected')) { bindRevealActive(); }

        // Builderius menu: arrow/Home/End/Escape while focus is inside the menu.
        // Bound on document (capture) so it survives the menu mounting/unmounting.
        if (on('builderius_menu') && !dbeMenuKeyBound) {
            dbeMenuKeyBound = true;
            document.addEventListener('keydown', dbeMenuKeydown, true);
        }

        // Element keyboard shortcuts (Duplicate / Cut / Add before-after / Rename).
        if (on('keyboard_shortcuts') && !dbeShortcutKeyBound) {
            dbeShortcutKeyBound = true;
            document.addEventListener('keydown', dbeElementShortcutsKeydown, true);
        }

        // Command palette (Cmd/Ctrl+Shift+K).
        if (on('command_palette') && !dbePaletteKeyBound) {
            dbePaletteKeyBound = true;
            document.addEventListener('keydown', dbePaletteKeydown, true);
        }
    }

    /* Presence heartbeat for the admin-bar "Edit template" link (see
       includes/admin-bar.php): it warns before opening a second builder tab.
       Key and cadence come from the shared PHP config so writer and reader
       cannot drift; cleared on pagehide, and the reader treats an old beat
       as stale so a crashed tab can't warn forever. */
    if (on('presence_heartbeat')) {
        (function () {
            var hb = CFG.heartbeat || {};
            var key = hb.key || 'dbeBuilderiusOpen';
            function beat() {
                try {
                    localStorage.setItem(key, JSON.stringify({
                        t: Date.now(),
                        title: document.title
                    }));
                } catch (e) {}
            }
            beat();
            setInterval(beat, hb.interval || 2500);
            window.addEventListener('pagehide', function () {
                try { localStorage.removeItem(key); } catch (e) {}
            });
        })();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
