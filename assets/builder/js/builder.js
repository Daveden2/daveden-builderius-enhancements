(function () {
    'use strict';

    /* core-runtime.js loads immediately before this feature runtime. Capture its
       private API once; all feature wiring remains toggle-gated below. */
    var dbeRuntimeFactory = window.dbeBuilderRuntime;
    if (!dbeRuntimeFactory || typeof dbeRuntimeFactory.create !== 'function') {
        if (window.console && console.error) { console.error('[DBE] Core runtime failed to load; enhancements were not started.'); }
        return;
    }
    var dbeRuntime = dbeRuntimeFactory.create(window.dbeBuilderEnhancements || {});
    var CFG = dbeRuntime.config;
    var on = dbeRuntime.on;
    var dbeT = dbeRuntime.translate;
    var dbeFmt = dbeRuntime.format;
    var dbeTn = dbeRuntime.plural;
    var dbeBuilderius = dbeRuntime.builderius;
    var dbeSelector = dbeBuilderius.selector;
    var dbeQuery = dbeBuilderius.query;
    var dbeQueryAll = dbeBuilderius.queryAll;
    var dbeNavigatorRow = dbeBuilderius.navigatorRow;
    var store = dbeBuilderius.store;
    var modules = dbeBuilderius.modules;
    var activeId = dbeBuilderius.activeId;
    var dbeControllers = dbeRuntime.createControllerRegistry(dbeRuntime);

    var lastCtxId = null;
    var dbeRememberChromeAttributes = function () {};
    var NAV_ROW_SEL = 'button.uniModTree__item';
    var navRootList = function () { return null; };
    var navRowId = function () { return null; };
    var navRowById = function () { return null; };
    var navRowLi = function () { return null; };
    var navRowExpandable = function () { return false; };
    var navRowExpanded = function () { return false; };
    var navParentRow = function () { return null; };
    var navVisibleRows = function () { return []; };
    var navFocus = function () {};
    var navSelect = function () {};
    var navToggleExpand = function () {};
    var dbeFocusArea = function () {};
    var dbeCompactActive = function () { return false; };
    var dbePanelWrappers = function () { return { left: null, right: null }; };
    var dbePanelSideHidden = function () { return false; };
    var dbeToggleSidePanels = function () {};
    var dbeSetPanelVisibility = function () {};
    var driveContextMenuItem = function (id, label, callback) {
        if (callback) { callback(false); }
    };
    var makeCtxItem = function () { return null; };
    var dbeCanvasInteractive = function () { return false; };
    var dbeSetCanvasInteractive = function () { return false; };
    var dbeSyncSelectionContext = function () {};
    var scrollRowIntoTree = function () {};
    var expandSubtree = function () {};
    var driveSelectedClose = function (callback) {
        if (callback) { callback(false); }
    };

    /* The site's breakpoints, [{name:'--tablet', label:'Tablet', width:991}]
       in top-bar button order (base first, width:null for the base entry).
       The list lives nowhere in the store (probed) — it is only reachable via
       the React fiber props around .uniGlobalBreakpoints, where the Media
       Queries modal receives items:[{label,name,width,…}] (the base entry uses
       a huge sentinel width). Bounded scan, null on any failure — callers keep
       a hard-coded fallback. */
    /* The fiber walk below is expensive (up to 12 fibers × depth-10 object
       scans) and used to run on EVERY schedule() tick, twice when two consumer
       features are on — for a list that changes about never. Successful scans
       are cached; the builder's own breakpoint actions invalidate the cache.
       A failed scan (panel not mounted yet) is NOT cached, so callers retry
       exactly as before. */
    var dbeBpCache = null;
    var dbeBpHooked = false;
    function dbeHookBreakpointInvalidation() {
        if (dbeBpHooked) { return; }
        dbeBpHooked = true;
        try {
            var hooks = window.Builderius.API.hooks;
            ['builderius.breakpoints.set', 'builderius.Setting.breakpointsAndStrategyUpdated'].forEach(function (h) {
                hooks.addAction(h, 'dbeBreakpointsCache', function () { dbeBpCache = null; });
            });
        } catch (e) { dbeBpHooked = false; } // hooks not ready — retry on the next call
    }
    function dbeBreakpoints() {
        if (dbeBpCache) { return dbeBpCache; }
        dbeHookBreakpointInvalidation();
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
            dbeBpCache = found.map(function (it) {
                return {
                    name: it.name || '',
                    label: it.label || '',
                    width: (it.width && it.width < 100000) ? it.width : null
                };
            });
            return dbeBpCache;
        } catch (e) { return null; }
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

    /* Machine-readable counterpart for the global area-jump chords. Keep this
       separate from dbeAccel: aria-keyshortcuts requires named modifier tokens,
       not the glyphs and abbreviations used in visual shortcut hints. */
    function dbeAreaAriaShortcut(key) {
        return (dbeIsMac ? 'Meta' : 'Control') + '+Alt+' + key;
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

    function dbeSetDisabledReason(li, label, reason) {
        if (!reason) { return; }
        li.setAttribute('data-dbe-tip', reason);
        li.setAttribute('aria-label', label + '. ' + reason);
    }

    function disableCtxItem(li, reason) {
        if (li.classList.contains('dbe-ctx-disabled')) { return; }
        li.classList.add('disabled', 'dbe-ctx-disabled');
        li.setAttribute('aria-disabled', 'true');
        dbeSetDisabledReason(li, (li.textContent || '').trim(), reason);
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
                    'removedElementsOne', 'Deleted %s element (Cmd+Z restores one at a time)',
                    'removedElementsMany', 'Deleted %s elements (Cmd+Z restores one at a time)'), removed), removed ? 'undo' : null);
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
       immediate and preserves identity. Restored elements get a new id (paste regenerates them) and are appended
       last, so position is not preserved and a re-add whose parent was itself
       restored can fail. Property edits are not covered. The user's clipboard is saved/restored around the
       forgery where the browser allows reading it. */
    var undoStack = [];
    var redoStack = [];
    var dbeUndoBusy = false;
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
                copen += dbeSerializeLabel(m, (creg[slug] && creg[slug].label) || 'Component');
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
                    ariaLabel: opts.ariaLabel || ''
                });
            } catch (e) { ed = null; }
            if (ed) {
                var escapeKeyListener = null;
                var escapeAction = null;
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
                    dbeClearOwnedTimeout(DBE_EDITING_OWNER, decoTimer);
                    decoTimer = dbeSetOwnedTimeout(DBE_EDITING_OWNER, decorateMarkers, 120);
                });
                return {
                    el: host,
                    isMonaco: true,
                    getValue: function () { return ed.getValue(); },
                    // Guard the write so an unchanged re-set can't move the caret.
                    setValue: function (v) { if (ed.getValue() !== v) { ed.setValue(v); decorateMarkers(); } },
                    focus: function () { try { ed.focus(); } catch (e) {} },
                    cursorStart: function () { try { ed.setPosition({ lineNumber: 1, column: 1 }); } catch (e) {} },
                    onChange: function (cb) { ed.onDidChangeModelContent(cb); },
                    layout: function () { try { ed.layout(); } catch (e) {} },
                    dispose: function () {
                        dbeClearOwnedTimeout(DBE_EDITING_OWNER, decoTimer);
                        if (escapeKeyListener) { try { escapeKeyListener.dispose(); } catch (e) {} }
                        if (escapeAction) { try { escapeAction.dispose(); } catch (e) {} }
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
        return {
            el: ta,
            isMonaco: false,
            getValue: function () { return ta.value; },
            setValue: function (v) { ta.value = v; },
            focus: function () { ta.focus(); },
            cursorStart: function () { try { ta.setSelectionRange(0, 0); } catch (e) {} },
            onChange: function (cb) { ta.addEventListener('input', cb); },
            layout: function () {},
            dispose: function () {}
        };
    }

    function dbeHtmlUndoWarning(id, text) {
        var warning = document.createElement('p');
        warning.id = id;
        warning.className = 'dbe-html__undo-warning';
        warning.textContent = text;
        return warning;
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
        dlg.appendChild(editor.el);

        var status = document.createElement('p');
        status.className = 'dbe-html__status';
        status.setAttribute('role', 'status');
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
        var mod = {
            id: dbeMakeId(), name: moduleName,
            label: node.label || (moduleName === 'HtmlElement'
                ? node.tag.charAt(0).toUpperCase() + node.tag.slice(1)
                : moduleName),
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

        var status = document.createElement('p');
        status.className = 'dbe-html__status';
        status.setAttribute('role', 'status');
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
                preview.textContent = dbeT('importHtmlEmpty', 'Nothing to preview yet.');
                return;
            }
            var p = dbeParseHtmlFragment(html, {});
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
            var parentId = mods[rec.id].parent || '';
            dbeUndoBusy = true;
            driveContextMenuItem(rec.id, 'Remove', function (ok) {
                setTimeout(function () {
                    dbeUndoBusy = false;
                    if (!ok) { from.push(rec); undoToast(dbeT('undoFailedRemove', 'Undo failed: could not remove the element')); return; }
                    to.push({ op: 'restore', id: rec.id, label: rec.label, parentId: parentId, subtree: subtree });
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
        if (on('tooltips')) {
            dbeRememberChromeAttributes(el, ['data-dbe-tip', 'aria-label', 'title', 'data-tooltip-content']);
        }
        if (el.getAttribute('data-dbe-tip') !== label) { el.setAttribute('data-dbe-tip', label); }
        if (!el.getAttribute('aria-label')) { el.setAttribute('aria-label', label); }
        if (el.hasAttribute('title')) { el.removeAttribute('title'); }
        if (el.hasAttribute('data-tooltip-content')) { el.removeAttribute('data-tooltip-content'); }
        el.querySelectorAll('[data-tooltip-content]').forEach(function (a) {
            if (on('tooltips')) { dbeRememberChromeAttributes(a, ['data-tooltip-content']); }
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
            if (!label) { return; }
            var control = a.matches('button, [role="button"]') ? a : a.querySelector('button, [role="button"]');
            setTip(control || a, label);
            // The tooltip anchor often wraps the actual favourite button. Once
            // its copy has moved onto the control, disable the duplicate native
            // tooltip on the wrapper too.
            if (control && control !== a) {
                dbeRememberChromeAttributes(a, ['data-tooltip-content', 'title']);
                a.removeAttribute('data-tooltip-content');
                if (a.hasAttribute('title')) { a.removeAttribute('title'); }
            }
        });

        // Edit mode adds a separate remove button before each favourite, but
        // Builderius leaves those controls unnamed. Borrow the adjacent
        // favourite button's adopted label so each destructive action names
        // its target and uses the same tooltip treatment as the rest of the
        // favourites bar.
        document.querySelectorAll('.uniModTree__favouritesListItem .closeIcon').forEach(function (btn) {
            var favourite = btn.parentElement && btn.parentElement.querySelector('.modIcon');
            var name = favourite && (
                favourite.getAttribute('data-dbe-favourite-name')
                || favourite.getAttribute('aria-label')
                || favourite.getAttribute('data-dbe-tip')
            );
            setTip(btn, name
                ? dbeFmt(dbeT('tipRemoveFavourite', 'Remove %s from favourites'), name)
                : dbeT('tipRemoveFavouriteFallback', 'Remove from favourites'));
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
        // Snippet/variable list rows (the JavaScript and Dynamic Data footer
        // tools): the sliders button that opens the Rename/Configure/Delete
        // menu is icon-only with no name anywhere (4.1.2). Name it after the
        // row's own title, and declare the menu it pops open. Renaming
        // re-renders the row, so a stale name cannot outlive its item.
        document.querySelectorAll('.uniTabDataVars__varsList ul li').forEach(function (row) {
            var btn = row.querySelector('button.iconBoxWrapper');
            if (!btn) { return; }
            var title = row.querySelector('button.varTitle');
            title = title ? (title.textContent || '').trim() : '';
            setTip(btn, title
                ? dbeFmt(dbeT('tipItemActions', 'Actions for %s'), title)
                : dbeT('tipItemActionsFallback', 'Item actions'));
            if (btn.getAttribute('aria-haspopup') !== 'menu') {
                dbeRememberChromeAttributes(btn, ['aria-haspopup']);
                btn.setAttribute('aria-haspopup', 'menu');
            }
        });
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
    var dbeTooltipsBound = false;
    function dbeTooltipMouseover(e) {
        var t = e.target.closest && e.target.closest('[data-dbe-tip]');
        if (t) { if (t !== tipTarget) { showTip(t, false); } }
        else if (tipTarget) { hideTip(); }
    }
    function dbeTooltipFocusin(e) {
        var t = e.target.closest && e.target.closest('[data-dbe-tip]');
        if (t) { showTip(t, true); }
    }
    function dbeTooltipKeydown(e) { if (e.key === 'Escape') { hideTip(); } }
    function bindTooltips() {
        if (dbeTooltipsBound) { return; }
        dbeTooltipsBound = true;
        document.addEventListener('mouseover', dbeTooltipMouseover);
        document.addEventListener('focusin', dbeTooltipFocusin);
        document.addEventListener('focusout', hideTip);
        document.addEventListener('keydown', dbeTooltipKeydown, true);
        document.addEventListener('pointerdown', hideTip, true);
        document.addEventListener('scroll', hideTip, true);
    }
    function unbindTooltips() {
        if (!dbeTooltipsBound) { return; }
        dbeTooltipsBound = false;
        document.removeEventListener('mouseover', dbeTooltipMouseover);
        document.removeEventListener('focusin', dbeTooltipFocusin);
        document.removeEventListener('focusout', hideTip);
        document.removeEventListener('keydown', dbeTooltipKeydown, true);
        document.removeEventListener('pointerdown', hideTip, true);
        document.removeEventListener('scroll', hideTip, true);
        hideTip();
        if (tipEl) { tipEl.remove(); }
        tipEl = null;
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
    var dbeCssCodeDefaultForced = false;
    function ensureCssCodeDefault() {
        if (goingToContent) { return; }
        var lp = document.querySelector('.uniLeftPanel');
        if (!lp) { return; }
        if (isCssCodeMode(lp)) { return; }                       // already in code mode
        if (!/Styles/i.test(nativeStripActiveTab(lp) || '')) { return; } // only flip from the Styles tab
        var btn = lp.querySelector('.uniIconCssMode');
        if (btn) { dbeCssCodeDefaultForced = true; clickSeq(btn); }
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
                dbeSetOwnedFrame(DBE_STYLES_OWNER, waitForContentTab);
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
    var dbeScopeFinish = null;

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
    function waitFor(test, cb, maxTries, owner) {
        var n = 0, max = maxTries || 60;
        (function loop() {
            var v; try { v = test(); } catch (e) { v = null; }
            if (v) { cb(v); }
            else if (n++ < max) {
                if (owner) { dbeSetOwnedTimeout(owner, loop, 25); }
                else { setTimeout(loop, 25); }
            }
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
                dbeSetOwnedTimeout(DBE_STYLES_OWNER, function () { repointScope(target, false); }, 60); // re-assert if the native effect reverts it
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
                dbeScopeFinish = null;
                if (dbeStylesControllerActive) { schedule(); }
                resolve();
            }
            dbeScopeFinish = done;
            dbeSetOwnedTimeout(DBE_STYLES_OWNER, done, 6000);

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
                                }, 24, DBE_STYLES_OWNER);
                            } else {
                                done();
                            }
                        }, 60, DBE_STYLES_OWNER);
                    }, 60, DBE_STYLES_OWNER);
                }, 60, DBE_STYLES_OWNER);
            }, 60, DBE_STYLES_OWNER);
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
                if (!dbeStylesControllerActive) {
                    if (m.parentNode) { m.parentNode.removeChild(m); }
                    return;
                }
                m.classList.add('is-fading');
                dbeSetOwnedTimeout(DBE_STYLES_OWNER, function () { if (m.parentNode) { m.parentNode.removeChild(m); } }, 340);
            });
        };
        var p;
        try { p = promiseFactory(); } catch (e) { cleanup(); throw e; }
        if (p && typeof p.then === 'function') { p.then(cleanup, cleanup); }
        else { dbeSetOwnedTimeout(DBE_STYLES_OWNER, cleanup, 400); }
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
                        dbeSetOwnedTimeout(DBE_STYLES_OWNER, function () {
                            if (gen !== dbeFlashGen) { return; } // the decorations belong to a newer flash now
                            var g = leftPanelMonaco();
                            try { if (g) { g.ed.deltaDecorations(dbeAllCssDecos, []); } } catch (e) { /* editor gone */ }
                            dbeAllCssDecos = [];
                        }, 2600);
                    } catch (e) { dbeAllCssDecos = []; }
                }
                return;
            }
            if (tries++ < 45) { dbeSetOwnedTimeout(DBE_STYLES_OWNER, poll, 150); } // wait up to ~7s for the churn to settle
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
        if (!dbeStylesControllerActive) { return; }
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
        if (!dbeStylesControllerActive) { done(null); return; }
        var allTab = cssViewTab('All CSS');
        // The editor may already be mounted for a previously selected item.
        // Only finish once the requested selector is the store's active one;
        // otherwise a compound-rule edit could open the wrong CSS model.
        if (allTab && (!name || normSel(dbeStyleCurrentSelector()) === normSel(name))) { done(allTab); return; }
        if (attemptsLeft <= 0) { done(null); return; }
        var items = document.querySelectorAll('.uniSelectorsCss__item');
        if (items.length) {
            var target = null;
            for (var i = 0; i < items.length && name; i++) {
                if (normSel(items[i].textContent || '') === normSel(name)) { target = items[i]; break; }
            }
            clickSeq(target || items[0]);
        }
        dbeSetOwnedTimeout(DBE_STYLES_OWNER, function () { clickSelectorUntilLoaded(name, attemptsLeft - 1, done); }, 120);
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
            // Builderius initially shows a class's existing rules no matter
            // which scope is active. The isolation guard below protects rules
            // stored elsewhere; explain that outcome rather than the confusing
            // native model behind it.
            badge.setAttribute('data-dbe-tip',
                dbeT('scopeBadgeTip', 'Choose where edits are saved. If these rules live in the other scope, the editor is protected until you switch scope or add rules here.'));
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
        // Re-queried (not the creation-branch variable): the bar may pre-date this call.
        badge = bar.querySelector('.dbe-scope-badge');
        if (badge.textContent !== badgeText) { badge.textContent = badgeText; }
        [].slice.call(bar.querySelectorAll('.dbe-scope-switch button')).forEach(function (b) {
            var sc = b.getAttribute('data-scope');
            if (sc === 'template' && b.textContent !== entLabel) { b.textContent = entLabel; } // keep in sync after an entity switch
            b.classList.toggle('is-active', sc === dbeScope);
        });
        // "All CSS" needs a class selector to locate — a %local% one-off has no
        // shared rule to jump to, so disable it at the local level.
        allBtn = bar.querySelector('.dbe-scope-allcss');
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

    /* selectorInScope is a full brace-balancing walk over a whole stylesheet
       and ensureScopeIsolation runs it twice per schedule() tick on the
       busiest observer. The store returns an unchanged css string between
       edits, so one memo slot per scope skips the parse on almost every tick
       (string === is a cheap reference check when nothing changed). */
    var dbeSelScopeMemo = { global: { css: null, sel: null, hit: false }, entity: { css: null, sel: null, hit: false } };
    function selectorInScopeCached(which, sel) {
        var css = scopeCss(which);
        var m = dbeSelScopeMemo[which];
        if (m.css === css && m.sel === sel) { return m.hit; }
        m.css = css;
        m.sel = sel;
        m.hit = selectorInScope(css, sel);
        return m.hit;
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
            activeHas = selectorInScopeCached(isGlobal ? 'global' : 'entity', sel);
            otherHas = selectorInScopeCached(isGlobal ? 'entity' : 'global', sel);
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

    /* (si) Style inspector (style_inspector).

       The context menu and command palette both route into Builderius' native
       Styles view. DBE selects the module, selector and scope, then gets out of
       the way: there is one editing surface and one save path. The companion
       inspector is deliberately read-only. It combines getComputedStyle() with
       accessible CSSOM rules from the live preview, which makes it useful for
       framework and page CSS as well as Builderius-authored rules. */
    var dbeStyleInspectorState = {
        id: null,
        instance: 0,
        tab: 'rules',
        filter: '',
        allComputed: false,
        focusReturn: null
    };

    var DBE_STYLE_COMMON_PROPERTIES = [
        'display', 'position', 'inset', 'inset-block', 'inset-inline', 'z-index',
        'box-sizing', 'inline-size', 'block-size', 'min-inline-size', 'max-inline-size',
        'min-block-size', 'max-block-size', 'margin', 'padding', 'overflow',
        'grid', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
        'flex', 'flex-direction', 'flex-wrap', 'align-items', 'align-content',
        'justify-content', 'justify-items', 'gap', 'order',
        'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
        'letter-spacing', 'text-align', 'text-decoration', 'text-transform',
        'color', 'background', 'border', 'border-radius', 'box-shadow', 'opacity',
        'transform', 'transition', 'visibility', 'cursor', 'pointer-events'
    ];

    /* Properties whose computed values normally inherit from an ancestor.
       Custom properties are handled separately in dbeStyleCanInherit(). The
       list deliberately includes inherited SVG presentation properties and
       common shorthands such as font/list-style so authored rules remain
       recognisable instead of being exploded into browser longhands. */
    var DBE_STYLE_INHERITED_PROPERTIES = {};
    (
        'accent-color border-collapse border-spacing caption-side color cursor direction empty-cells ' +
        'fill fill-opacity fill-rule font font-family font-feature-settings font-kerning font-language-override ' +
        'font-optical-sizing font-palette font-size font-size-adjust font-stretch font-style font-synthesis ' +
        'font-variant font-variation-settings font-weight hyphens image-rendering letter-spacing line-break ' +
        'line-height list-style list-style-image list-style-position list-style-type marker marker-end marker-mid ' +
        'marker-start orphans overflow-wrap paint-order pointer-events quotes ruby-align ruby-position shape-rendering ' +
        'speak stroke stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit ' +
        'stroke-opacity stroke-width tab-size text-align text-align-last text-combine-upright text-indent text-justify ' +
        'text-orientation text-rendering text-shadow text-transform text-underline-position visibility white-space ' +
        'widows word-break word-spacing word-wrap writing-mode'
    ).split(' ').forEach(function (name) { DBE_STYLE_INHERITED_PROPERTIES[name] = true; });

    var DBE_STYLE_PSEUDO_PROPERTIES = [
        'content', 'display', 'position', 'inset', 'z-index', 'box-sizing',
        'inline-size', 'block-size', 'margin', 'padding', 'overflow',
        'font-family', 'font-size', 'font-weight', 'line-height', 'color',
        'background', 'border', 'border-radius', 'box-shadow', 'opacity',
        'transform', 'transition', 'visibility', 'pointer-events'
    ];

    var DBE_STYLE_STATE_PSEUDOS = [
        'active', 'checked', 'disabled', 'enabled', 'focus', 'focus-visible',
        'focus-within', 'hover', 'invalid', 'open', 'placeholder-shown',
        'target', 'user-invalid', 'valid', 'visited'
    ];

    var DBE_STYLE_STATE_RE = new RegExp(':(?:' + DBE_STYLE_STATE_PSEUDOS.join('|') + ')(?![A-Za-z0-9_-])', 'gi');
    var DBE_STYLE_ELEMENT_RE = /::[A-Za-z-]+(?:\([^)]*\))?|:(?:before|after|first-letter|first-line)(?![A-Za-z0-9_-])/gi;

    function dbeStyleTargets(id) {
        try {
            var iframe = dbeQuery('previewFrame');
            var idoc = iframe && iframe.contentDocument;
            return idoc ? [].slice.call(idoc.querySelectorAll('.uni-node-' + id)) : [];
        } catch (e) { return []; }
    }

    function dbeStyleTargetName(id) {
        var mods = modules() || {};
        var mod = mods[id];
        if (!mod) { return id || ''; }
        var tag = bemModuleTag(mod, '') || mod.name || 'element';
        var classes = moduleClasses(mod);
        return '<' + tag + '>' + (classes.length ? ' .' + classes.join(' .') : '');
    }

    function dbeStyleCurrentSelector() {
        try { return store().storeGet('activeSelector') || ''; } catch (e) { return ''; }
    }

    function dbeStyleFocusEditor() {
        if (!dbeStylesControllerActive) { return; }
        dbeSetOwnedTimeout(DBE_STYLES_OWNER, function () {
            var h = leftPanelMonaco();
            if (h && h.ed && h.ed.focus) { h.ed.focus(); return; }
            var lp = document.querySelector('.uniLeftPanel');
            var focusable = lp && lp.querySelector('input:not([disabled]), button:not([disabled]), textarea:not([disabled])');
            if (focusable) { try { focusable.focus(); } catch (e) {} }
        }, 120);
    }

    /* Select an already-applied class through its native chip. The picker hides
       the applied-class list while another selector is active, so close that
       selector first and wait for the list to return. `%local%` is Builderius'
       no-active-class state, reached through the same native Close action. */
    function dbeStyleSelectSelector(selector, done) {
        if (!dbeStylesControllerActive) { done(false); return; }
        var want = selector === '%local%' ? '' : selector;
        var current = dbeStyleCurrentSelector();
        if ((want === '' && (!current || current.charAt(0) === '%')) || current === want) {
            done(true); return;
        }
        if (current && current.charAt(0) !== '%') {
            driveSelectedClose(function (ok) {
                if (!dbeStylesControllerActive || !ok) { done(false); return; }
                dbeSetOwnedTimeout(DBE_STYLES_OWNER, function () { dbeStyleSelectSelector(selector, done); }, 80);
            });
            return;
        }
        waitFor(function () {
            return [].slice.call(document.querySelectorAll('.uniModuleCssClassesSelect__list li')).filter(function (li) {
                var text = ((li.querySelector('span') || li).textContent || '').trim();
                return text === want || text === want.replace(/^\./, '');
            })[0] || null;
        }, function (li) {
            if (!li) { done(false); return; }
            clickSeq(li.querySelector('span') || li);
            waitFor(function () { return dbeStyleCurrentSelector() === want || null; }, function (selected) {
                done(!!selected);
            }, 40, DBE_STYLES_OWNER);
        }, 50, DBE_STYLES_OWNER);
    }

    function dbeOpenStyleEditor(id, selector, scopeName) {
        if (!dbeStylesControllerActive) { return; }
        var row = id && document.querySelector('.uniRightPanel .uni-tree-node-' + id);
        // Clicking the already-active Navigator row toggles its selection off,
        // leaving the settings panel empty. Only drive the row when the command
        // targets a different module (e.g. a context menu on an unselected row).
        if (row && activeId() !== id) { clickSeq(row); }
        waitFor(function () { return activeId() === id || null; }, function (selected) {
            if (!selected) { return; }
            var lp = document.querySelector('.uniLeftPanel');
            var styles = lp && [].slice.call(lp.querySelectorAll('.uniPanelTabs__tab'))
                .filter(function (tab) { return /Styles/i.test(tab.textContent || ''); })[0];
            if (styles && !styles.classList.contains('active')) { clickSeq(styles); }
            waitFor(function () {
                var left = document.querySelector('.uniLeftPanel');
                return left && (isCssCodeMode(left) || left.querySelector('.uniSystemSelectClasses'));
            }, function (ready) {
                if (!ready) { return; }
                dbeStyleSelectSelector(selector, function (selectorReady) {
                    if (!selectorReady) { return; }
                    if (scopeName && selector !== '%local%') {
                        setScope(scopeName).then(dbeStyleFocusEditor);
                    } else {
                        dbeStyleFocusEditor();
                    }
                });
            }, 80, DBE_STYLES_OWNER);
        }, 50, DBE_STYLES_OWNER);
    }

    /* Compound/custom selectors are authored through Builderius' Navigator
       Selectors view, not the applied-class chips in an element's Styles view.
       Select the exact native selector after switching scope, then leave the
       user in Builderius' own Selector CSS editor. */
    function dbeOpenStylesheetSelector(selector, scopeName) {
        if (!dbeStylesControllerActive) { return; }
        function openSelector() {
            var nav = navPanelTab('Selectors');
            if (!nav) { return; }
            if (!nav.classList.contains('active')) { clickSeq(nav); }
            clickSelectorUntilLoaded(selector, 30, function () {
                var selectorTab = cssViewTab('Selector CSS');
                if (selectorTab && !selectorTab.classList.contains('active')) { clickSeq(selectorTab); }
                dbeStyleFocusEditor();
            });
        }
        if (scopeName) { setScope(scopeName).then(openSelector); }
        else { openSelector(); }
    }

    var dbeStyleScopeSelectorMemo = {
        global: { css: null, selectors: {} },
        entity: { css: null, selectors: {} }
    };

    /* Build the selector set through the browser's CSS parser so formatting
       differences and selectors nested in @layer/@media do not hide authored
       Builderius rules from the edit route. Cache by stylesheet string because
       the inspector is refreshed from the builder's busy mutation loop. */
    function dbeStyleScopeSelectors(which) {
        var css = scopeCss(which);
        var memo = dbeStyleScopeSelectorMemo[which];
        if (memo.css === css) { return memo.selectors; }
        var selectors = {};
        function walk(rules) {
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                if (rule.selectorText) { selectors[normSel(rule.selectorText)] = true; }
                if (rule.cssRules) { try { walk(rule.cssRules); } catch (e) {} }
            }
        }
        try {
            var sheet = new CSSStyleSheet();
            sheet.replaceSync(css);
            walk(sheet.cssRules);
        } catch (e) { /* malformed/unsupported rule: attribution stays conservative */ }
        memo.css = css;
        memo.selectors = selectors;
        return selectors;
    }

    function dbeStyleSelectorInScope(which, selector) {
        return !!dbeStyleScopeSelectors(which)[normSel(selector)];
    }

    function dbeStyleRuleSource(rule, id) {
        var selector = rule.selectorText || '';
        if (selector.indexOf('.uni-node-' + id) !== -1) { return 'local'; }
        var ruleText = String(rule.cssText || '').replace(/\s+/g, ' ').trim();
        var entityCss = scopeCss('entity');
        var globalCss = scopeCss('global');
        var entity = entityCss.replace(/\s+/g, ' ');
        var global = globalCss.replace(/\s+/g, ' ');
        if (ruleText && entity.indexOf(ruleText) !== -1) { return 'entity'; }
        if (ruleText && global.indexOf(ruleText) !== -1) { return 'global'; }
        // Formatting differs between authored CSS and CSSOM serialisation in
        // some browsers (notably spaces inserted inside :is()/:where() lists).
        // Compare parsed rule heads rather than raw substrings; only attribute
        // a selector when it exists in one Builderius scope.
        var inEntity = selector && dbeStyleSelectorInScope('entity', selector);
        var inGlobal = selector && dbeStyleSelectorInScope('global', selector);
        if (inEntity && !inGlobal) { return 'entity'; }
        if (inGlobal && !inEntity) { return 'global'; }
        return 'page';
    }

    function dbeStyleMatchedClass(selector, id) {
        var mod = (modules() || {})[id];
        var classes = moduleClasses(mod);
        for (var i = 0; i < classes.length; i++) {
            var cls = '.' + classes[i];
            var esc = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (new RegExp(esc + '(?![A-Za-z0-9_-])').test(selector)) { return cls; }
        }
        return '';
    }

    function dbeStyleCanInherit(name, includeCustomProperties) {
        return (includeCustomProperties && name.indexOf('--') === 0) || !!DBE_STYLE_INHERITED_PROPERTIES[name];
    }

    function dbeStyleElementModuleId(el) {
        if (!el || !el.classList) { return ''; }
        var mods = modules() || {};
        for (var i = 0; i < el.classList.length; i++) {
            var match = /^uni-node-(.+)$/.exec(el.classList[i]);
            if (match && mods[match[1]]) { return match[1]; }
        }
        return '';
    }

    function dbeStyleSelectorModuleId(selector) {
        var mods = modules() || {};
        var re = /\.uni-node-([A-Za-z0-9_-]+)/g;
        var match;
        while ((match = re.exec(selector))) {
            if (mods[match[1]]) { return match[1]; }
        }
        return '';
    }

    function dbeStyleClosestMatch(el, selector) {
        try { return el.closest(selector); } catch (e) { return null; }
    }

    function dbeStyleElementName(el) {
        if (!el || !el.tagName) { return ''; }
        var name = '<' + el.tagName.toLowerCase();
        if (el.id) { name += '#' + el.id; }
        var classes = [].slice.call(el.classList || []).filter(function (className) {
            return className.indexOf('uni-node-') !== 0;
        }).slice(0, 3);
        if (classes.length) { name += '.' + classes.join('.'); }
        return name + '>';
    }

    /* Native CSS nesting keeps child CSSStyleRules inside the parent rule and
       serialises their relative selectors with `&`. Resolve that selector for
       Element.matches() while retaining the outer selector as the edit route.
       :is() preserves selector lists without a fragile string cross-product. */
    function dbeStyleResolveNestedSelector(parentSelector, selector) {
        if (!parentSelector) { return selector; }
        var parent = ':is(' + parentSelector + ')';
        return dbeStyleSplitSelectorList(selector).map(function (part) {
            if (part.indexOf('&') !== -1) { return part.replace(/&/g, parent); }
            return parent + ' ' + part;
        }).join(', ');
    }

    /* Flatten every accessible rule from ordinary and adopted stylesheets.
       Unlike the old walker, a CSSStyleRule is not a leaf: CSS Nesting makes
       it a grouping rule, so its child rules must be visited with the resolved
       parent selector. Nested conditional rules keep the same parent context. */
    function dbeStyleAccessibleRules(el, id) {
        var found = [];
        var idoc = el.ownerDocument;
        var view = idoc.defaultView;
        function walk(rules, contexts, parentSelector, root) {
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                if (rule.selectorText && rule.style) {
                    var resolvedSelector = dbeStyleResolveNestedSelector(parentSelector, rule.selectorText);
                    var rootInfo = root;
                    if (!rootInfo) {
                        var selectorId = dbeStyleSelectorModuleId(rule.selectorText);
                        var owner = dbeStyleClosestMatch(el, resolvedSelector);
                        var targetId = selectorId || dbeStyleElementModuleId(owner) || id;
                        var source = dbeStyleRuleSource(rule, targetId);
                        var matchedClass = dbeStyleMatchedClass(rule.selectorText, targetId);
                        var simpleClass = matchedClass && normSel(rule.selectorText) === matchedClass;
                        rootInfo = {
                            source: source,
                            targetId: targetId,
                            editSelector: source === 'local' ? '%local%' : (source === 'page' ? '' : rule.selectorText),
                            editMode: source === 'local' || simpleClass ? 'element' : 'stylesheet'
                        };
                    }
                    if (rule.style.length) {
                        found.push({
                            selector: resolvedSelector,
                            authoredSelector: rule.selectorText,
                            style: rule.style,
                            source: rootInfo.source,
                            targetId: rootInfo.targetId,
                            contexts: contexts.slice(),
                            nested: !!parentSelector,
                            editSelector: rootInfo.editSelector,
                            editMode: rootInfo.editMode
                        });
                    }
                    if (rule.cssRules) {
                        try { walk(rule.cssRules, contexts, resolvedSelector, rootInfo); } catch (e) {}
                    }
                    continue;
                }
                // Declarations written after a nested rule are represented by
                // CSSNestedDeclarations: a style block with no selector of its
                // own. They still belong to the current parent selector.
                if (rule.style && parentSelector && rule.style.length && root) {
                    found.push({
                        selector: parentSelector,
                        authoredSelector: parentSelector,
                        style: rule.style,
                        source: root.source,
                        targetId: root.targetId,
                        contexts: contexts.slice(),
                        nested: true,
                        editSelector: root.editSelector,
                        editMode: root.editMode
                    });
                }
                if (!rule.cssRules) { continue; }
                var nextContexts = contexts.slice();
                if (rule.media && rule.media.mediaText) {
                    try { if (!view.matchMedia(rule.media.mediaText).matches) { continue; } } catch (e) {}
                    nextContexts.push('@media ' + rule.media.mediaText);
                } else if (rule.conditionText) {
                    nextContexts.push(rule.cssText.split('{')[0].trim());
                }
                try { walk(rule.cssRules, nextContexts, parentSelector, root); } catch (e) {}
            }
        }
        // Builderius places the saved global/entity styles in constructable
        // adoptedStyleSheets; ordinary linked and inline CSS lives in
        // document.styleSheets. Inspect both, de-duplicated for browsers that
        // may expose an adopted sheet through both collections.
        var sheets = [].slice.call(idoc.styleSheets || []).concat([].slice.call(idoc.adoptedStyleSheets || []));
        sheets.filter(function (sheet, index) { return sheets.indexOf(sheet) === index; }).forEach(function (sheet) {
            try { walk(sheet.cssRules, [], '', null); } catch (e) { /* cross-origin stylesheet */ }
        });
        return found;
    }

    function dbeStyleMatchedRules(el, id, accessibleRules) {
        var found = (accessibleRules || dbeStyleAccessibleRules(el, id)).filter(function (rule) {
            try { return el.matches(rule.selector); } catch (e) { return false; }
        });
        return found.reverse(); // later rules first, matching DevTools' scan order
    }

    function dbeStyleInheritedRuleGroups(el, accessibleRules, query) {
        var ancestors = [];
        var parent = el.parentElement;
        while (parent) {
            ancestors.push({ element: parent, label: dbeStyleElementName(parent), rules: [] });
            parent = parent.parentElement;
        }
        if (!ancestors.length) { return []; }
        var childComputed = el.ownerDocument.defaultView.getComputedStyle(el);
        accessibleRules.forEach(function (rule) {
            try { if (el.matches(rule.selector)) { return; } } catch (e) { return; }
            var inherited = [];
            for (var i = 0; i < rule.style.length; i++) {
                var property = rule.style[i];
                if (dbeStyleCanInherit(property, !!query)) { inherited.push(property); }
            }
            if (!inherited.length) { return; }
            ancestors.forEach(function (group) {
                try { if (!group.element.matches(rule.selector)) { return; } } catch (e) { return; }
                var ancestorComputed = group.element.ownerDocument.defaultView.getComputedStyle(group.element);
                var activeProperties = inherited.filter(function (property) {
                    var childValue = childComputed.getPropertyValue(property).trim();
                    return childValue && childValue === ancestorComputed.getPropertyValue(property).trim();
                });
                if (!activeProperties.length) { return; }
                var inheritedRule = {};
                Object.keys(rule).forEach(function (key) { inheritedRule[key] = rule[key]; });
                inheritedRule.properties = activeProperties;
                group.rules.push(inheritedRule);
            });
        });
        ancestors.forEach(function (group) { group.rules.reverse(); });
        return ancestors.filter(function (group) { return group.rules.length; });
    }

    /* Split grouped selectors without treating commas inside functional
       pseudo-classes or attribute selectors as selector separators. */
    function dbeStyleSplitSelectorList(selector) {
        var parts = [];
        var start = 0;
        var round = 0;
        var square = 0;
        var quote = '';
        var escaped = false;
        for (var i = 0; i < selector.length; i++) {
            var char = selector.charAt(i);
            if (escaped) { escaped = false; continue; }
            if (char === '\\') { escaped = true; continue; }
            if (quote) {
                if (char === quote) { quote = ''; }
                continue;
            }
            if (char === '"' || char === "'") { quote = char; continue; }
            if (char === '(') { round++; continue; }
            if (char === ')') { round = Math.max(0, round - 1); continue; }
            if (char === '[') { square++; continue; }
            if (char === ']') { square = Math.max(0, square - 1); continue; }
            if (char === ',' && !round && !square) {
                parts.push(selector.slice(start, i).trim());
                start = i + 1;
            }
        }
        parts.push(selector.slice(start).trim());
        return parts.filter(Boolean);
    }

    function dbeStylePseudoTokens(selector) {
        var states = [];
        var elements = [];
        var seen = {};
        selector.replace(DBE_STYLE_ELEMENT_RE, function (token) {
            token = token.toLowerCase().replace(/^:(before|after|first-letter|first-line)$/, '::$1');
            if (!seen[token]) { seen[token] = true; elements.push(token); }
            return token;
        });
        selector.replace(DBE_STYLE_STATE_RE, function (token) {
            token = token.toLowerCase();
            if (!seen[token]) { seen[token] = true; states.push(token); }
            return token;
        });
        return { states: states, elements: elements, all: states.concat(elements) };
    }

    /* Remove the state and generated-box portion to find whether the authored
       selector is connected to the selected element even while a state such
       as :hover is inactive. Empty functional pseudos are cleaned afterwards. */
    function dbeStylePseudoBaseSelector(selector) {
        var base = selector.replace(DBE_STYLE_ELEMENT_RE, '').replace(DBE_STYLE_STATE_RE, '');
        var previous = '';
        while (base !== previous) {
            previous = base;
            base = base
                .replace(/:(?:not|is|where|has)\(\s*(?:,\s*)*\)/gi, '')
                .replace(/\(\s*,/g, '(')
                .replace(/,\s*\)/g, ')');
        }
        return base.trim() || '*';
    }

    function dbeStylePseudoRules(el, id) {
        var found = [];
        dbeStyleAccessibleRules(el, id).forEach(function (rule) {
            dbeStyleSplitSelectorList(rule.selector).forEach(function (selector) {
                var tokens = dbeStylePseudoTokens(selector);
                if (!tokens.all.length) { return; }
                try {
                    if (!el.matches(dbeStylePseudoBaseSelector(selector))) { return; }
                    var activeSelector = selector.replace(DBE_STYLE_ELEMENT_RE, '').trim() || '*';
                    var pseudoRule = {};
                    Object.keys(rule).forEach(function (key) { pseudoRule[key] = rule[key]; });
                    pseudoRule.selector = selector;
                    pseudoRule.tokens = tokens;
                    pseudoRule.active = el.matches(activeSelector);
                    found.push(pseudoRule);
                } catch (e) { /* selector unsupported by Element.matches */ }
            });
        });
        return found.reverse();
    }

    function dbeStyleSourceLabel(source) {
        if (source === 'local') { return dbeT('styleSourceLocal', 'Local'); }
        if (source === 'global') { return dbeT('styleSourceGlobal', 'Global'); }
        if (source === 'entity') { return entityScopeLabel(); }
        return dbeT('styleSourcePage', 'Page or framework');
    }

    function dbeStyleEmpty(message) {
        var p = document.createElement('p');
        p.className = 'dbe-style-inspector__empty';
        p.textContent = message;
        return p;
    }

    function dbeStyleRenderComputed(content, el) {
        var computed = el.ownerDocument.defaultView.getComputedStyle(el);
        var names = [];
        if (dbeStyleInspectorState.allComputed) {
            for (var i = 0; i < computed.length; i++) { names.push(computed[i]); }
        } else {
            names = DBE_STYLE_COMMON_PROPERTIES.filter(function (name) {
                return computed.getPropertyValue(name).trim() !== '';
            });
        }
        var query = dbeStyleInspectorState.filter.toLowerCase();
        names = names.filter(function (name) {
            var value = computed.getPropertyValue(name).trim();
            return !query || name.toLowerCase().indexOf(query) !== -1 || value.toLowerCase().indexOf(query) !== -1;
        });
        if (!names.length) {
            content.appendChild(dbeStyleEmpty(dbeT('styleNoProperties', 'No computed properties match this filter.')));
            return;
        }
        var dl = document.createElement('dl');
        dl.className = 'dbe-style-inspector__properties';
        names.forEach(function (name) {
            var row = document.createElement('div');
            row.className = 'dbe-style-inspector__property';
            var dt = document.createElement('dt');
            var dd = document.createElement('dd');
            dt.textContent = name;
            dd.textContent = computed.getPropertyValue(name).trim();
            row.appendChild(dt); row.appendChild(dd); dl.appendChild(row);
        });
        content.appendChild(dl);
    }

    function dbeStyleRuleProperties(rule) {
        if (rule.properties) { return rule.properties; }
        var properties = [];
        for (var i = 0; i < rule.style.length; i++) { properties.push(rule.style[i]); }
        return properties;
    }

    function dbeStyleRuleMatchesFilter(rule, query, extra) {
        if (!query) { return true; }
        var text = rule.selector + ' ' + (extra || '') + ' ';
        dbeStyleRuleProperties(rule).forEach(function (property) {
            text += property + ' ' + rule.style.getPropertyValue(property) + ' ';
        });
        return text.toLowerCase().indexOf(query) !== -1;
    }

    function dbeStyleRenderRuleList(rules, fallbackId) {
        var list = document.createElement('ol');
        list.className = 'dbe-style-inspector__rules';
        rules.forEach(function (rule) {
            var item = document.createElement('li');
            item.className = 'dbe-style-inspector__rule';
            item.setAttribute('data-source', rule.source);
            var head = document.createElement('div');
            head.className = 'dbe-style-inspector__rule-head';
            var copy = document.createElement('div');
            var selector = document.createElement('div');
            selector.className = 'dbe-style-inspector__selector';
            selector.textContent = rule.selector;
            copy.appendChild(selector);
            var meta = document.createElement('div');
            meta.className = 'dbe-style-inspector__rule-meta';
            var metaLabels = [dbeStyleSourceLabel(rule.source)];
            if (rule.nested) { metaLabels.push(dbeT('styleNestedRule', 'Nested')); }
            metaLabels.concat(rule.contexts).forEach(function (label) {
                var badge = document.createElement('span');
                badge.className = 'dbe-style-inspector__badge';
                badge.textContent = label;
                meta.appendChild(badge);
            });
            copy.appendChild(meta); head.appendChild(copy);
            if (rule.editSelector && rule.source !== 'page') {
                var edit = document.createElement('button');
                edit.type = 'button';
                edit.className = 'dbe-style-inspector__edit';
                edit.textContent = dbeT('styleEditRule', 'Edit rule');
                edit.addEventListener('click', function () {
                    var editScope = rule.source === 'global' ? 'global' : (rule.source === 'entity' ? 'template' : null);
                    var inspector = document.querySelector('.dbe-style-inspector');
                    if (inspector) { inspector.remove(); dbeStyleInspectorState.id = null; }
                    if (rule.editMode === 'stylesheet') { dbeOpenStylesheetSelector(rule.editSelector, editScope); }
                    else { dbeOpenStyleEditor(rule.targetId || fallbackId, rule.editSelector, editScope); }
                });
                head.appendChild(edit);
            }
            item.appendChild(head);
            var declarations = document.createElement('dl');
            declarations.className = 'dbe-style-inspector__declarations';
            dbeStyleRuleProperties(rule).forEach(function (prop) {
                var decl = document.createElement('div');
                decl.className = 'dbe-style-inspector__declaration';
                var dt = document.createElement('dt');
                var dd = document.createElement('dd');
                dt.textContent = prop + ':';
                dd.textContent = rule.style.getPropertyValue(prop).trim() + (rule.style.getPropertyPriority(prop) ? ' !important' : '');
                decl.appendChild(dt); decl.appendChild(dd); declarations.appendChild(decl);
            });
            item.appendChild(declarations); list.appendChild(item);
        });
        return list;
    }

    function dbeStyleRenderRules(content, el, id) {
        var query = dbeStyleInspectorState.filter.toLowerCase();
        var accessibleRules = dbeStyleAccessibleRules(el, id);
        var rules = dbeStyleMatchedRules(el, id, accessibleRules).filter(function (rule) {
            return dbeStyleRuleMatchesFilter(rule, query);
        });
        var inheritedGroups = dbeStyleInheritedRuleGroups(el, accessibleRules, query).map(function (group) {
            return {
                label: group.label,
                rules: group.rules.filter(function (rule) {
                    return dbeStyleRuleMatchesFilter(rule, query, group.label);
                })
            };
        }).filter(function (group) { return group.rules.length; });
        if (!rules.length && !inheritedGroups.length) {
            content.appendChild(dbeStyleEmpty(dbeT('styleNoMatchedRules', 'No accessible authored rules match this rendered element.')));
            return;
        }
        if (rules.length) { content.appendChild(dbeStyleRenderRuleList(rules, id)); }
        if (!inheritedGroups.length) { return; }
        var inheritedSection = document.createElement('section');
        inheritedSection.className = 'dbe-style-inspector__section dbe-style-inspector__inherited';
        var heading = document.createElement('h3');
        heading.className = 'dbe-style-inspector__section-title';
        heading.textContent = dbeT('styleInheritedStyles', 'Inherited styles');
        inheritedSection.appendChild(heading);
        var hint = document.createElement('p');
        hint.className = 'dbe-style-inspector__hint';
        hint.textContent = dbeT('styleInheritedHint', 'Rules on ancestors whose inheritable declarations resolve to the same value here. Computed shows the final cascade.');
        inheritedSection.appendChild(hint);
        inheritedGroups.forEach(function (group) {
            var ancestor = document.createElement('section');
            ancestor.className = 'dbe-style-inspector__inherited-group';
            var ancestorHeading = document.createElement('h4');
            ancestorHeading.className = 'dbe-style-inspector__inherited-from';
            ancestorHeading.textContent = dbeFmt(dbeT('styleInheritedFrom', 'Inherited from %s'), group.label);
            ancestor.appendChild(ancestorHeading);
            ancestor.appendChild(dbeStyleRenderRuleList(group.rules, id));
            inheritedSection.appendChild(ancestor);
        });
        content.appendChild(inheritedSection);
    }

    function dbeStyleRenderPseudos(content, el, id) {
        var query = dbeStyleInspectorState.filter.toLowerCase();
        var rules = dbeStylePseudoRules(el, id);
        var hint = document.createElement('p');
        hint.className = 'dbe-style-inspector__hint';
        hint.textContent = dbeT('stylePseudoHint', 'Inactive states show authored declarations. Computed values are available for generated pseudo-elements and states currently active in the canvas.');
        content.appendChild(hint);

        var pseudoElements = [];
        rules.forEach(function (rule) {
            rule.tokens.elements.forEach(function (pseudo) {
                if (pseudoElements.indexOf(pseudo) === -1) { pseudoElements.push(pseudo); }
            });
        });

        var computedSection = document.createElement('section');
        computedSection.className = 'dbe-style-inspector__section';
        var computedShown = false;
        pseudoElements.forEach(function (pseudo) {
            var computed;
            try { computed = el.ownerDocument.defaultView.getComputedStyle(el, pseudo); } catch (e) { return; }
            var names = DBE_STYLE_PSEUDO_PROPERTIES.filter(function (name) {
                var value = computed.getPropertyValue(name).trim();
                return value && (!query || pseudo.toLowerCase().indexOf(query) !== -1 || name.toLowerCase().indexOf(query) !== -1 || value.toLowerCase().indexOf(query) !== -1);
            });
            if (!names.length) { return; }
            if (!computedShown) {
                var heading = document.createElement('h3');
                heading.className = 'dbe-style-inspector__section-title';
                heading.textContent = dbeT('stylePseudoComputed', 'Computed pseudo-elements');
                computedSection.appendChild(heading);
                computedShown = true;
            }
            var card = document.createElement('div');
            card.className = 'dbe-style-inspector__pseudo-computed';
            var label = document.createElement('h4');
            label.className = 'dbe-style-inspector__pseudo-label';
            label.textContent = pseudo;
            card.appendChild(label);
            var dl = document.createElement('dl');
            dl.className = 'dbe-style-inspector__properties';
            names.forEach(function (name) {
                var row = document.createElement('div');
                row.className = 'dbe-style-inspector__property';
                var dt = document.createElement('dt');
                var dd = document.createElement('dd');
                dt.textContent = name;
                dd.textContent = computed.getPropertyValue(name).trim();
                row.appendChild(dt); row.appendChild(dd); dl.appendChild(row);
            });
            card.appendChild(dl); computedSection.appendChild(card);
        });
        rules = rules.filter(function (rule) {
            if (!query) { return true; }
            var text = rule.selector + ' ' + rule.tokens.all.join(' ') + ' ';
            for (var i = 0; i < rule.style.length; i++) {
                var prop = rule.style[i];
                text += prop + ' ' + rule.style.getPropertyValue(prop) + ' ';
            }
            return text.toLowerCase().indexOf(query) !== -1;
        });
        if (!rules.length) {
            if (computedShown) { content.appendChild(computedSection); }
            else { content.appendChild(dbeStyleEmpty(dbeT('styleNoPseudos', 'No authored pseudo-state or pseudo-element rules are connected to this element.'))); }
            return;
        }

        var rulesSection = document.createElement('section');
        rulesSection.className = 'dbe-style-inspector__section';
        var rulesHeading = document.createElement('h3');
        rulesHeading.className = 'dbe-style-inspector__section-title';
        rulesHeading.textContent = dbeT('stylePseudoRules', 'Related authored rules');
        rulesSection.appendChild(rulesHeading);
        var list = document.createElement('ol');
        list.className = 'dbe-style-inspector__rules';
        rules.forEach(function (rule) {
            var item = document.createElement('li');
            item.className = 'dbe-style-inspector__rule';
            item.setAttribute('data-source', rule.source);
            var head = document.createElement('div');
            head.className = 'dbe-style-inspector__rule-head';
            var copy = document.createElement('div');
            var selector = document.createElement('div');
            selector.className = 'dbe-style-inspector__selector';
            selector.textContent = rule.selector;
            copy.appendChild(selector);
            var meta = document.createElement('div');
            meta.className = 'dbe-style-inspector__rule-meta';
            var labels = [dbeStyleSourceLabel(rule.source)];
            if (rule.nested) { labels.push(dbeT('styleNestedRule', 'Nested')); }
            labels = labels.concat(rule.tokens.all).concat(rule.contexts);
            labels.push(rule.active ? dbeT('stylePseudoActive', 'Active now') : dbeT('stylePseudoInactive', 'Inactive state'));
            labels.forEach(function (label, index) {
                var badge = document.createElement('span');
                badge.className = 'dbe-style-inspector__badge';
                if (index === labels.length - 1) { badge.setAttribute('data-state', rule.active ? 'active' : 'inactive'); }
                badge.textContent = label;
                meta.appendChild(badge);
            });
            copy.appendChild(meta); head.appendChild(copy);
            if (rule.editSelector && rule.source !== 'page') {
                var edit = document.createElement('button');
                edit.type = 'button';
                edit.className = 'dbe-style-inspector__edit';
                edit.textContent = dbeT('styleEditRule', 'Edit rule');
                edit.addEventListener('click', function () {
                    var editScope = rule.source === 'global' ? 'global' : (rule.source === 'entity' ? 'template' : null);
                    var inspector = document.querySelector('.dbe-style-inspector');
                    if (inspector) { inspector.remove(); dbeStyleInspectorState.id = null; }
                    if (rule.editMode === 'stylesheet') { dbeOpenStylesheetSelector(rule.editSelector, editScope); }
                    else { dbeOpenStyleEditor(rule.targetId || id, rule.editSelector, editScope); }
                });
                head.appendChild(edit);
            }
            item.appendChild(head);
            var declarations = document.createElement('dl');
            declarations.className = 'dbe-style-inspector__declarations';
            for (var i = 0; i < rule.style.length; i++) {
                var prop = rule.style[i];
                var decl = document.createElement('div');
                decl.className = 'dbe-style-inspector__declaration';
                var dt = document.createElement('dt');
                var dd = document.createElement('dd');
                dt.textContent = prop + ':';
                dd.textContent = rule.style.getPropertyValue(prop).trim() + (rule.style.getPropertyPriority(prop) ? ' !important' : '');
                decl.appendChild(dt); decl.appendChild(dd); declarations.appendChild(decl);
            }
            item.appendChild(declarations); list.appendChild(item);
        });
        rulesSection.appendChild(list); content.appendChild(rulesSection);
        if (computedShown) { content.appendChild(computedSection); }
    }

    function dbeRenderStyleInspector() {
        var panel = document.querySelector('.dbe-style-inspector');
        if (!panel || !dbeStyleInspectorState.id) { return; }
        var id = dbeStyleInspectorState.id;
        var targets = dbeStyleTargets(id);
        if (dbeStyleInspectorState.instance >= targets.length) { dbeStyleInspectorState.instance = 0; }
        panel.querySelector('.dbe-style-inspector__target').textContent = dbeStyleTargetName(id);
        var count = panel.querySelector('.dbe-style-inspector__instance-count');
        var prev = panel.querySelector('[data-instance="prev"]');
        var next = panel.querySelector('[data-instance="next"]');
        var multi = targets.length > 1;
        prev.hidden = !multi; next.hidden = !multi; count.hidden = !multi;
        count.textContent = multi ? dbeFmt(dbeT('styleInstanceCount', '%1$s of %2$s rendered instances'), dbeStyleInspectorState.instance + 1, targets.length) : '';
        [].slice.call(panel.querySelectorAll('.dbe-style-inspector__tab')).forEach(function (tab) {
            var active = tab.getAttribute('data-tab') === dbeStyleInspectorState.tab;
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
            tab.tabIndex = active ? 0 : -1;
            if (active) { panel.querySelector('.dbe-style-inspector__content').setAttribute('aria-labelledby', tab.id); }
        });
        var all = panel.querySelector('.dbe-style-inspector__all');
        all.hidden = dbeStyleInspectorState.tab !== 'computed';
        var check = all.querySelector('input');
        check.checked = dbeStyleInspectorState.allComputed;
        var content = panel.querySelector('.dbe-style-inspector__content');
        var scrollTop = content.scrollTop;
        var nextContent = document.createElement('div');
        if (!targets.length) {
            nextContent.appendChild(dbeStyleEmpty(dbeT('styleNoCanvasElement', 'This element is not currently rendered in the canvas.')));
        } else if (dbeStyleInspectorState.tab === 'computed') {
            dbeStyleRenderComputed(nextContent, targets[dbeStyleInspectorState.instance]);
        } else if (dbeStyleInspectorState.tab === 'pseudos') {
            dbeStyleRenderPseudos(nextContent, targets[dbeStyleInspectorState.instance], id);
        } else {
            dbeStyleRenderRules(nextContent, targets[dbeStyleInspectorState.instance], id);
        }
        var renderKey = [id, dbeStyleInspectorState.instance, dbeStyleInspectorState.tab, dbeStyleInspectorState.filter, dbeStyleInspectorState.allComputed ? 'all' : 'common'].join('|');
        // schedule() runs for unrelated Builderius mutations. Leave identical
        // inspector DOM intact so those ticks cannot reset scrolling or focus.
        if (content.getAttribute('data-dbe-render-key') === renderKey && content.innerHTML === nextContent.innerHTML) { return; }
        content.replaceChildren.apply(content, [].slice.call(nextContent.childNodes));
        content.setAttribute('data-dbe-render-key', renderKey);
        content.scrollTop = Math.min(scrollTop, Math.max(0, content.scrollHeight - content.clientHeight));
    }

    function dbeCloseStyleInspector(panel) {
        var id = dbeStyleInspectorState.id;
        var preferred = dbeStyleInspectorState.focusReturn;
        panel.remove();
        dbeStyleInspectorState.id = null;
        dbeStyleInspectorState.focusReturn = null;
        var target = preferred && preferred.isConnected
            ? preferred : (id && document.querySelector('.uniRightPanel .uni-tree-node-' + id));
        if (target) { try { target.focus(); } catch (e) {} }
    }

    function dbeBuildStyleInspector() {
        var panel = document.createElement('aside');
        panel.className = 'dbe-style-inspector';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'false');
        panel.setAttribute('aria-labelledby', 'dbe-style-inspector-title');
        var head = document.createElement('div');
        head.className = 'dbe-style-inspector__head';
        var identity = document.createElement('div');
        identity.className = 'dbe-style-inspector__identity';
        var title = document.createElement('h2');
        title.id = 'dbe-style-inspector-title';
        title.className = 'dbe-style-inspector__title';
        title.textContent = dbeT('styleInspector', 'Style inspector');
        var target = document.createElement('div');
        target.className = 'dbe-style-inspector__target';
        identity.appendChild(title); identity.appendChild(target); head.appendChild(identity);
        var actions = document.createElement('div');
        actions.className = 'dbe-style-inspector__head-actions';
        function iconButton(label, glyph) {
            var button = document.createElement('button');
            button.type = 'button'; button.className = 'dbe-style-inspector__icon-button';
            button.setAttribute('aria-label', label); button.textContent = glyph;
            return button;
        }
        var prev = iconButton(dbeT('stylePreviousInstance', 'Previous rendered instance'), '‹'); prev.setAttribute('data-instance', 'prev');
        var count = document.createElement('span'); count.className = 'dbe-style-inspector__instance-count';
        var next = iconButton(dbeT('styleNextInstance', 'Next rendered instance'), '›'); next.setAttribute('data-instance', 'next');
        prev.addEventListener('click', function () {
            var n = dbeStyleTargets(dbeStyleInspectorState.id).length;
            if (n) { dbeStyleInspectorState.instance = (dbeStyleInspectorState.instance + n - 1) % n; dbeRenderStyleInspector(); }
        });
        next.addEventListener('click', function () {
            var n = dbeStyleTargets(dbeStyleInspectorState.id).length;
            if (n) { dbeStyleInspectorState.instance = (dbeStyleInspectorState.instance + 1) % n; dbeRenderStyleInspector(); }
        });
        var refresh = iconButton(dbeT('styleRefresh', 'Refresh styles'), '↻');
        refresh.addEventListener('click', dbeRenderStyleInspector);
        var close = iconButton(dbeT('close', 'Close'), '×');
        close.addEventListener('click', function () { dbeCloseStyleInspector(panel); });
        actions.appendChild(prev); actions.appendChild(count); actions.appendChild(next); actions.appendChild(refresh); actions.appendChild(close);
        head.appendChild(actions); panel.appendChild(head);
        var tabs = document.createElement('div');
        tabs.className = 'dbe-style-inspector__tabs'; tabs.setAttribute('role', 'tablist');
        [['rules', dbeT('styleMatchedRules', 'Matched rules')], ['computed', dbeT('styleComputed', 'Computed')], ['pseudos', dbeT('stylePseudos', 'Pseudos')]].forEach(function (pair) {
            var tab = document.createElement('button');
            tab.type = 'button'; tab.className = 'dbe-style-inspector__tab'; tab.id = 'dbe-style-tab-' + pair[0]; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'dbe-style-inspector-panel'); tab.setAttribute('data-tab', pair[0]); tab.textContent = pair[1];
            tab.addEventListener('click', function () { dbeStyleInspectorState.tab = pair[0]; dbeRenderStyleInspector(); });
            tabs.appendChild(tab);
        });
        tabs.addEventListener('keydown', function (e) {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) { return; }
            e.preventDefault();
            var buttons = [].slice.call(tabs.querySelectorAll('[role="tab"]'));
            var at = buttons.indexOf(document.activeElement);
            if (e.key === 'Home') { at = 0; }
            else if (e.key === 'End') { at = buttons.length - 1; }
            else { at = (at + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length; }
            buttons[at].click(); buttons[at].focus();
        });
        panel.appendChild(tabs);
        var body = document.createElement('div'); body.className = 'dbe-style-inspector__body';
        var toolbar = document.createElement('div'); toolbar.className = 'dbe-style-inspector__toolbar';
        var search = document.createElement('input');
        search.type = 'search'; search.className = 'dbe-style-inspector__search'; search.placeholder = dbeT('styleSearchProperties', 'Filter CSS properties'); search.setAttribute('aria-label', search.placeholder);
        search.addEventListener('input', function () { dbeStyleInspectorState.filter = search.value.trim(); dbeRenderStyleInspector(); });
        var all = document.createElement('label'); all.className = 'dbe-style-inspector__all';
        var check = document.createElement('input'); check.type = 'checkbox';
        check.addEventListener('change', function () { dbeStyleInspectorState.allComputed = check.checked; dbeRenderStyleInspector(); });
        all.appendChild(check); all.appendChild(document.createTextNode(dbeT('styleShowAll', 'Show all computed properties')));
        toolbar.appendChild(search); toolbar.appendChild(all); body.appendChild(toolbar);
        var content = document.createElement('div'); content.id = 'dbe-style-inspector-panel'; content.className = 'dbe-style-inspector__content'; content.setAttribute('role', 'tabpanel');
        body.appendChild(content); panel.appendChild(body);
        panel.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); dbeCloseStyleInspector(panel); }
        });
        document.body.appendChild(panel);
        return panel;
    }

    function openStyleInspector(id) {
        var existing = document.querySelector('.dbe-style-inspector');
        if (!existing) { dbeStyleInspectorState.focusReturn = document.activeElement; }
        var row = id && document.querySelector('.uniRightPanel .uni-tree-node-' + id);
        if (row && activeId() !== id) { clickSeq(row); }
        dbeStyleInspectorState.id = id;
        dbeStyleInspectorState.instance = 0;
        var panel = existing || dbeBuildStyleInspector();
        dbeRenderStyleInspector();
        var search = panel.querySelector('.dbe-style-inspector__search');
        if (search) { try { search.focus(); } catch (e) {} }
    }

    function refreshOpenStyleInspector() {
        var panel = document.querySelector('.dbe-style-inspector');
        if (!panel) { return; }
        var id = activeId();
        if (id && id !== dbeStyleInspectorState.id) {
            dbeStyleInspectorState.id = id;
            dbeStyleInspectorState.instance = 0;
        }
        dbeRenderStyleInspector();
    }

    function dbeStyleActionItems(id) {
        var items = [
            makeCtxItem(dbeT('inspectStyles', 'Inspect styles…'), function () {
                dbeSetOwnedTimeout(DBE_STYLES_OWNER, function () { openStyleInspector(id); }, 120);
            }),
            makeCtxItem(dbeT('editElementStyles', 'Edit element styles (%local%)'), function () { dbeOpenStyleEditor(id, '%local%', null); })
        ];
        var mod = (modules() || {})[id];
        moduleClasses(mod).forEach(function (className) {
            var selector = '.' + className;
            items.push(makeCtxItem(dbeFmt(dbeT('editClassStyles', 'Edit %1$s — %2$s'), selector, dbeT('scopeGlobal', 'Global')), function () {
                dbeOpenStyleEditor(id, selector, 'global');
            }));
            items.push(makeCtxItem(dbeFmt(dbeT('editClassStyles', 'Edit %1$s — %2$s'), selector, entityScopeLabel()), function () {
                dbeOpenStyleEditor(id, selector, 'template');
            }));
        });
        return items;
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
    var dbeMinimapCreateListener = null;
    var dbeMinimapEditors = [];
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
    function dbeDisableEditorMinimap(ed) {
        if (!ed || dbeMinimapEditors.some(function (item) { return item.editor === ed; })) { return; }
        var enabled = true;
        try {
            var raw = typeof ed.getRawOptions === 'function' ? ed.getRawOptions() : null;
            if (raw && raw.minimap && typeof raw.minimap.enabled === 'boolean') { enabled = raw.minimap.enabled; }
        } catch (e) { /* retain Monaco's enabled default */ }
        dbeMinimapEditors.push({ editor: ed, enabled: enabled });
        try { ed.updateOptions({ minimap: { enabled: false } }); } catch (e) {}
    }
    function dbeDisableMinimap() {
        if (dbeMinimapDone) { return; }
        if (!document.querySelector('.monaco-editor')) { return; } // Monaco not loaded yet
        var monaco = dbeGetMonaco();
        if (!monaco) { return; }
        try {
            monaco.editor.getEditors().forEach(dbeDisableEditorMinimap);
            dbeMinimapCreateListener = monaco.editor.onDidCreateEditor(dbeDisableEditorMinimap);
            dbeMinimapDone = true;
        } catch (e) { /* fail soft */ }
    }
    function dbeRestoreMinimap() {
        if (dbeMinimapCreateListener) {
            try { dbeMinimapCreateListener.dispose(); } catch (e) {}
        }
        dbeMinimapCreateListener = null;
        dbeMinimapEditors.forEach(function (item) {
            try { item.editor.updateOptions({ minimap: { enabled: item.enabled } }); } catch (e) {}
        });
        dbeMinimapEditors = [];
        dbeMinimapDone = false;
    }
    var dbeOwnedAttributeRecords = [];
    var dbeGroupBindings = [];
    var dbeOwnedEventBindings = [];
    var dbeOwnedTimers = [];
    var dbeOwnedIntervals = [];
    var dbeOwnedFrames = [];
    var dbeOwnedHookBindings = [];
    var dbeOwnedHookApi = null;
    var dbeEnsureGroup = function () {};
    function dbePruneGroupState() {
        dbeGroupBindings = dbeGroupBindings.filter(function (binding) {
            if (binding.node.isConnected) { return true; }
            binding.node.removeEventListener('keydown', binding.handler);
            if (binding.frame) { cancelAnimationFrame(binding.frame); }
            return false;
        });
        dbeOwnedAttributeRecords = dbeOwnedAttributeRecords.filter(function (record) {
            return record.node.isConnected;
        });
        dbeOwnedEventBindings = dbeOwnedEventBindings.filter(function (binding) {
            if (binding.node === document || typeof binding.node.isConnected !== 'boolean' || binding.node.isConnected) { return true; }
            binding.node.removeEventListener(binding.type, binding.handler, binding.options);
            return false;
        });
    }
    function dbeRememberOwnedAttributes(owner, node, attributes) {
        if (!owner || !node) { return; }
        var record = dbeOwnedAttributeRecords.filter(function (item) {
            return item.owner === owner && item.node === node;
        })[0];
        if (!record) {
            record = { owner: owner, node: node, attributes: {} };
            dbeOwnedAttributeRecords.push(record);
        }
        attributes.forEach(function (name) {
            if (Object.prototype.hasOwnProperty.call(record.attributes, name)) { return; }
            record.attributes[name] = node.hasAttribute(name) ? node.getAttribute(name) : null;
        });
    }
    function dbeRestoreOwnedAttributes(owner) {
        dbeOwnedAttributeRecords.filter(function (record) { return record.owner === owner; }).forEach(function (record) {
            Object.keys(record.attributes).forEach(function (name) {
                var value = record.attributes[name];
                if (value === null) { record.node.removeAttribute(name); }
                else { record.node.setAttribute(name, value); }
            });
        });
        dbeOwnedAttributeRecords = dbeOwnedAttributeRecords.filter(function (record) { return record.owner !== owner; });
    }
    function dbeDestroyOwnedGroups(owner) {
        dbeGroupBindings.filter(function (binding) { return binding.owner === owner; }).forEach(function (binding) {
            binding.node.removeEventListener('keydown', binding.handler);
            if (binding.frame) { cancelAnimationFrame(binding.frame); }
        });
        dbeGroupBindings = dbeGroupBindings.filter(function (binding) { return binding.owner !== owner; });
        dbeRestoreOwnedAttributes(owner);
    }
    function dbeBindOwnedEvent(owner, node, key, type, handler, options) {
        if (!owner || !node || dbeOwnedEventBindings.some(function (binding) {
            return binding.owner === owner && binding.node === node && binding.key === key;
        })) { return; }
        node.addEventListener(type, handler, options);
        dbeOwnedEventBindings.push({
            owner: owner,
            node: node,
            key: key,
            type: type,
            handler: handler,
            options: options
        });
    }
    function dbeUnbindOwnedEvent(owner, node, key) {
        dbeOwnedEventBindings.filter(function (binding) {
            return binding.owner === owner && binding.node === node && binding.key === key;
        }).forEach(function (binding) {
            binding.node.removeEventListener(binding.type, binding.handler, binding.options);
        });
        dbeOwnedEventBindings = dbeOwnedEventBindings.filter(function (binding) {
            return binding.owner !== owner || binding.node !== node || binding.key !== key;
        });
    }
    function dbeSetOwnedTimeout(owner, callback, delay) {
        var timer = { owner: owner, id: 0 };
        timer.id = setTimeout(function () {
            dbeOwnedTimers = dbeOwnedTimers.filter(function (item) { return item !== timer; });
            callback();
        }, delay);
        dbeOwnedTimers.push(timer);
        return timer.id;
    }
    function dbeClearOwnedTimeout(owner, id) {
        if (!id) { return; }
        clearTimeout(id);
        dbeOwnedTimers = dbeOwnedTimers.filter(function (timer) {
            return timer.owner !== owner || timer.id !== id;
        });
    }
    function dbeSetOwnedInterval(owner, callback, delay) {
        var interval = { owner: owner, id: setInterval(callback, delay) };
        dbeOwnedIntervals.push(interval);
        return interval.id;
    }
    function dbeSetOwnedFrame(owner, callback) {
        var frame = { owner: owner, id: 0 };
        frame.id = requestAnimationFrame(function () {
            dbeOwnedFrames = dbeOwnedFrames.filter(function (item) { return item !== frame; });
            callback();
        });
        dbeOwnedFrames.push(frame);
        return frame.id;
    }
    function dbeDestroyOwnedActivity(owner) {
        dbeOwnedEventBindings.filter(function (binding) { return binding.owner === owner; }).forEach(function (binding) {
            binding.node.removeEventListener(binding.type, binding.handler, binding.options);
        });
        dbeOwnedEventBindings = dbeOwnedEventBindings.filter(function (binding) { return binding.owner !== owner; });
        dbeOwnedTimers.filter(function (timer) { return timer.owner === owner; }).forEach(function (timer) {
            clearTimeout(timer.id);
        });
        dbeOwnedTimers = dbeOwnedTimers.filter(function (timer) { return timer.owner !== owner; });
        dbeOwnedIntervals.filter(function (interval) { return interval.owner === owner; }).forEach(function (interval) {
            clearInterval(interval.id);
        });
        dbeOwnedIntervals = dbeOwnedIntervals.filter(function (interval) { return interval.owner !== owner; });
        dbeOwnedFrames.filter(function (frame) { return frame.owner === owner; }).forEach(function (frame) {
            cancelAnimationFrame(frame.id);
        });
        dbeOwnedFrames = dbeOwnedFrames.filter(function (frame) { return frame.owner !== owner; });
    }
    function dbeOwnedHooksApi() {
        if (dbeOwnedHookApi) { return dbeOwnedHookApi; }
        try { dbeOwnedHookApi = window.Builderius.API.hooks; } catch (e) { dbeOwnedHookApi = null; }
        return dbeOwnedHookApi;
    }
    function dbeBindOwnedHook(owner, hook, namespace, callback) {
        var api = dbeOwnedHooksApi();
        if (!owner || !api || typeof api.addAction !== 'function' || dbeOwnedHookBindings.some(function (item) {
            return item.owner === owner && item.hook === hook && item.namespace === namespace;
        })) { return; }
        api.addAction(hook, namespace, callback);
        dbeOwnedHookBindings.push({ owner: owner, hook: hook, namespace: namespace });
    }
    function dbeDestroyOwnedHooks(owner) {
        var api = dbeOwnedHooksApi();
        if (api && typeof api.removeAction === 'function') {
            dbeOwnedHookBindings.filter(function (item) { return item.owner === owner; }).forEach(function (item) {
                api.removeAction(item.hook, item.namespace);
            });
        }
        dbeOwnedHookBindings = dbeOwnedHookBindings.filter(function (item) { return item.owner !== owner; });
        // Builderius removes window.Builderius after boot. Retain only this API
        // reference so controllers can unsubscribe and later initialise again.
    }


    /* One mutation router owns every builder-chrome observation whose only job
       is to schedule the shared refresh pass. A single MutationObserver may
       watch multiple narrow roots with different options, so this removes the
       per-feature observer objects without widening observation over Monaco or
       unrelated builder subtrees. When React replaces a registered root, rebuild
       the registrations as one set so the detached node is released. The two
       observers with specialised callbacks (preview-document editing state and
       the temporary canvas-width guard) deliberately remain independent. */
    var dbeChromeObserver = dbeRuntime.createMutationRouter(schedule);
    function dbeObserveChrome(key, node, options) {
        dbeChromeObserver.observe(key, node, options);
    }

    /* Shared by footer_toolbar and ai_terminal_tabs. Each owner uses distinct
       router keys, so overlapping roots merge while either lifecycle remains
       active. */
    function dbeObserveFooter(bar, owner) {
        if (!window.MutationObserver) { return; }
        var prefix = owner || 'footer-shared';
        if (bar) {
            // Bar: button active/locked class + add/remove (small subtree).
            dbeObserveChrome(prefix + '-bar', bar, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        }
        // Panel: open/collapse (content mounts/unmounts, height/style change).
        // Shallow — no subtree — so the Monaco editors inside do not spam it.
        var fp = dbeQuery('footerPanel');
        if (fp) {
            dbeObserveChrome(prefix + '-panel', fp, { childList: true, attributes: true, attributeFilter: ['class', 'style'] });
        }
        // Scope content: the snippet/variable configure panel mounts and
        // unmounts as a DIRECT child (list menu -> Configure), which the
        // shallow panel observer above cannot see. childList-only, so the
        // Monaco editors deeper inside still do not spam it. Node-tracked:
        // the content remounts when the tool or scope switches.
        var sc = document.querySelector('.uniFooterTabScopeContent');
        if (sc) {
            dbeObserveChrome(prefix + '-scope-content', sc, { childList: true });
        }
    }
    function dbeUnobserveFooter(owner) {
        dbeObserveChrome(owner + '-bar', null);
        dbeObserveChrome(owner + '-panel', null);
        dbeObserveChrome(owner + '-scope-content', null);
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
       The strip lives in the footer, which the main panel observation does not
       watch (like footer_toolbar), and native re-renders it on every switch. Two
       narrow roots feed the shared chrome mutation router: the always-present
       footer bar (fires when Sense AI is opened) and the .uniAiChat panel (fires
       on connect and every tab switch). Neither spans a Monaco editor. The "+"
       sits inside the list as a labelled button (as a browser tab strip's does);
       it is not a tab, so the roving set (matched on .uniAiChat__terminalTab)
       skips it. */
    var DBE_TERMINAL_OWNER = 'integrations/terminal';
    var dbeTermAiNode = null;
    var dbeTerminalControllerActive = false;
    var dbeTerminalFooterAttempts = 0;
    var dbeTerminalFrameDocuments = [];
    var dbeTerminalEscapeHintNode = null;
    var dbeTerminalEscapeHintOwned = false;
    function dbeObserveTerminalBar() {
        // Same bar, same options as the footer toolbar — share its observer.
        dbeObserveFooter(dbeQuery('footerBar'), 'integrations-terminal-footer');
    }
    function dbeObserveTerminalPanel(ai) {
        if (!window.MutationObserver || ai === dbeTermAiNode) { return; }
        if (!ai) {
            dbeTermAiNode = null;
            dbeObserveChrome('integrations-terminal-panel', null);
            return;
        }
        dbeTermAiNode = ai;
        dbeObserveChrome('integrations-terminal-panel', ai, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    var DBE_AI_MENU_ID = 'dbe-ai-agent-menu';
    var dbeAgentMenuWasOpen = false;
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
        dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, add, ['aria-haspopup', 'aria-expanded', 'aria-controls']);
        if (add.getAttribute('aria-haspopup') !== 'menu') { add.setAttribute('aria-haspopup', 'menu'); }
        var menu = document.querySelector('.uniAiChat__agentPicker');
        var open = !!menu;
        if (add.getAttribute('aria-expanded') !== String(open)) { add.setAttribute('aria-expanded', String(open)); }
        if (open) {
            dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, menu, ['id', 'role', 'aria-label']);
            if (!menu.id) { menu.id = DBE_AI_MENU_ID; }
            if (add.getAttribute('aria-controls') !== menu.id) { add.setAttribute('aria-controls', menu.id); }
            if (menu.getAttribute('role') !== 'menu') { menu.setAttribute('role', 'menu'); }
            if (!menu.getAttribute('aria-label')) { menu.setAttribute('aria-label', dbeT('terminalAgentMenu', 'Choose an agent')); }
            [].slice.call(menu.querySelectorAll('.uniAiChat__agentPickerItem')).forEach(function (it) {
                dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, it, ['role', 'tabindex']);
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
    /* Keyboard model for the "+" menu button and its menu. Down/Up on
       the button opens the menu and dives to the first/last item; inside the menu,
       Up/Down/Home/End roam (wrapping) and Escape/Tab close it and return focus to
       the button. Enter/Space on an item is left to the native <button>. */
    function dbeBindAgentPickerKeys() {
        dbeBindOwnedEvent(DBE_TERMINAL_OWNER, document, 'terminal-agent-picker-keys', 'keydown', function (e) {
            var addBtn = e.target && e.target.closest ? e.target.closest('.uniAiChat__terminalAddTabBtn') : null;
            if (addBtn) {
                if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') { return; }
                e.preventDefault();
                var last = e.key === 'ArrowUp';
                if (!document.querySelector('.uniAiChat__agentPicker')) { try { addBtn.click(); } catch (err) {} }
                var tries = 0;
                (function focusItem() {
                    if (!dbeTerminalControllerActive) { return; }
                    var opts = dbeAgentMenuItems();
                    if (opts.length) { (last ? opts[opts.length - 1] : opts[0]).focus(); }
                    else if (tries++ < 10) { dbeSetOwnedTimeout(DBE_TERMINAL_OWNER, focusItem, 20); }
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
    var DBE_AI_ESCAPE_HINT_ID = 'dbe-ai-terminal-escape-hint';

    function dbeTerminalEscapeHint() {
        var hint = document.getElementById(DBE_AI_ESCAPE_HINT_ID);
        if (!hint) {
            hint = document.createElement('span');
            hint.id = DBE_AI_ESCAPE_HINT_ID;
            hint.className = 'dbe-visually-hidden';
            hint.textContent = dbeT('terminalEscapeHint', 'Press Control and the grave accent key to move focus out of the terminal');
            document.body.appendChild(hint);
            dbeTerminalEscapeHintOwned = true;
        }
        dbeTerminalEscapeHintNode = hint;
        return hint;
    }

    function dbeTerminalEscapeKeydown(e) {
        if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.code !== 'Backquote') { return; }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        var tab = document.querySelector('.uniAiChat__terminalTab--active') || document.querySelector('.uniAiChat__terminalTab');
        var panel = document.querySelector('.uniAiChat__terminalFrameWrap');
        var target = tab || panel;
        if (target) { try { target.focus(); } catch (err) {} }
    }

    function dbePruneTerminalFrameDocuments() {
        dbeTerminalFrameDocuments = dbeTerminalFrameDocuments.filter(function (record) {
            if (record.frame.isConnected) { return true; }
            dbeUnbindOwnedEvent(DBE_TERMINAL_OWNER, record.doc, 'terminal-escape-keys');
            return false;
        });
    }

    function dbeBindTerminalEscape(frame) {
        if (!frame) { return; }
        var doc;
        try { doc = frame.contentDocument; } catch (e) { doc = null; }
        var record = dbeTerminalFrameDocuments.filter(function (item) { return item.frame === frame; })[0];
        if (record && record.doc !== doc) {
            dbeUnbindOwnedEvent(DBE_TERMINAL_OWNER, record.doc, 'terminal-escape-keys');
            dbeTerminalFrameDocuments = dbeTerminalFrameDocuments.filter(function (item) { return item !== record; });
            record = null;
        }
        if (doc && !record) {
            dbeBindOwnedEvent(DBE_TERMINAL_OWNER, doc, 'terminal-escape-keys', 'keydown', dbeTerminalEscapeKeydown, true);
            dbeTerminalFrameDocuments.push({ frame: frame, doc: doc });
            var hint = dbeTerminalEscapeHint();
            dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, frame, ['aria-describedby']);
            if (frame.getAttribute('aria-describedby') !== hint.id) { frame.setAttribute('aria-describedby', hint.id); }
        }
        dbeBindOwnedEvent(DBE_TERMINAL_OWNER, frame, 'terminal-frame-load', 'load', function () {
            if (dbeTerminalControllerActive) { dbeBindTerminalEscape(frame); }
        });
    }

    function ensureTerminalEscapeKeys() {
        dbePruneTerminalFrameDocuments();
        document.querySelectorAll('.uniAiChat__terminalFrame').forEach(dbeBindTerminalEscape);
    }

    function ensureTerminalTabs() {
        var list = document.querySelector('.uniAiChat__terminalTabList');
        if (!list) { return; }
        var panel = document.querySelector('.uniAiChat__terminalFrameWrap');
        if (panel) {
            dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, panel, ['id', 'role', 'tabindex', 'aria-labelledby']);
            if (!panel.id) { panel.id = DBE_AI_PANEL_ID; }
            if (panel.getAttribute('role') !== 'tabpanel') { panel.setAttribute('role', 'tabpanel'); }
            if (panel.getAttribute('tabindex') !== '0') { panel.setAttribute('tabindex', '0'); }
        }
        ensureTerminalEscapeKeys();
        var active = null;
        [].slice.call(list.querySelectorAll('.uniAiChat__terminalTab')).forEach(function (t, i) {
            dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, t, ['id', 'aria-controls']);
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
            dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, add, ['aria-label']);
            var al = dbeT('terminalNewTab', 'New chat session');
            if (add.getAttribute('aria-label') !== al) { add.setAttribute('aria-label', al); }
        }
        dbeEnsureAgentPicker(add);
        dbeBindAgentPickerKeys();
        // Tab-list semantics + roving arrow-key navigation.
        dbeEnsureGroup(list, dbeT('terminalTablist', 'AI chat sessions'), '.uniAiChat__terminalTab', {
            role: 'tablist', itemRole: 'tab', selectAttr: 'aria-selected',
            selectOnMove: true, activeClass: 'uniAiChat__terminalTab--active',
            owner: DBE_TERMINAL_OWNER
        });
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
    /* Assigned by the optional server-presence controller below. Keeping the
       hand-off here lets the visible save-state calculation publish an already
       computed dirty value instead of making presence serialise the same
       snapshot again on its own polling cadence. */
    var dbePresenceDirtyChanged = function () {};
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
    var dbeCssHintFocusReturn = null;

    function cssHintDismissed() {
        try { return localStorage.getItem(DBE_HINT_KEY) === '1'; } catch (e) { return false; }
    }

    function cssHintCode(value) {
        var code = document.createElement('code');
        code.textContent = value;
        return code;
    }

    function cssHintBody() {
        var dl = document.createElement('dl');
        dl.className = 'dbe-css-hint-dl';
        function row(term, parts) {
            var dt = document.createElement('dt');
            var dd = document.createElement('dd');
            if (term && term.nodeType) { dt.appendChild(term); } else { dt.textContent = term; }
            parts.forEach(function (part) {
                dd.appendChild(part && part.nodeType ? part : document.createTextNode(part));
            });
            dl.appendChild(dt);
            dl.appendChild(dd);
        }
        row(cssHintCode('%local%'), [
            dbeT('cssHintLocalLead', 'Targets this element only, through its automatic class. Use '),
            cssHintCode('%#local%'),
            dbeT('cssHintLocalTail', ' to target it by ID instead.')
        ]);
        row(cssHintCode('%selector%'), [
            dbeT('cssHintSelector', 'Targets every element that uses the current class.')
        ]);
        row(dbeT('cssHintBreakpointsTerm', 'Breakpoints'), [
            dbeT('cssHintBreakpointsLead', 'Switch breakpoint in the top bar to write CSS for a specific screen size. Inside a rule you can also use '),
            cssHintCode('--desktop'), ', ', cssHintCode('--tablet'), ' ', dbeT('or', 'or'), ' ', cssHintCode('--mobile'),
            dbeT('cssHintBreakpointsTail', ' as breakpoint-variable values.')
        ]);
        return dl;
    }

    function openCssHintDialog() {
        dbeCssHintFocusReturn = document.activeElement;
        var dlg = document.getElementById('dbe-css-hint-dialog');
        if (!dlg) {
            dlg = document.createElement('dialog');
            dlg.id = 'dbe-css-hint-dialog';
            dlg.className = 'dbe-css-hint-dialog';
            dlg.setAttribute('aria-labelledby', 'dbe-css-hint-dialog-title');
            var head = document.createElement('div');
            head.className = 'dbe-css-hint-dialog__head';
            var title = document.createElement('h2');
            title.id = 'dbe-css-hint-dialog-title';
            title.className = 'dbe-css-hint-dialog__title';
            title.textContent = dbeT('cssHintTitle', 'Selector tokens & breakpoints');
            var close = document.createElement('button');
            close.type = 'button';
            close.className = 'dbe-css-hint-dialog__close';
            close.setAttribute('aria-label', dbeT('cssHintClose', 'Close'));
            close.textContent = '×';
            var body = document.createElement('div');
            body.className = 'dbe-css-hint-dialog__body';
            body.appendChild(cssHintBody());
            head.appendChild(title);
            head.appendChild(close);
            dlg.appendChild(head);
            dlg.appendChild(body);
            close.addEventListener('click', function () { dlg.close(); });
            // Keep builder shortcuts from firing while the dialog has focus;
            // close Escape explicitly before an embedded/native handler can
            // consume it without reaching the browser's dialog cancellation.
            dlg.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') { e.preventDefault(); dlg.close(); }
                e.stopPropagation();
            });
            // Backdrop click offers the equivalent pointer exit.
            dlg.addEventListener('click', function (e) { if (e.target === dlg) { dlg.close(); } });
            dlg.addEventListener('close', function () {
                var target = dbeCssHintFocusReturn && dbeCssHintFocusReturn.isConnected
                    ? dbeCssHintFocusReturn : document.querySelector('.dbe-css-hint-btn, .dbe-scope-badge');
                dbeCssHintFocusReturn = null;
                if (target) { try { target.focus(); } catch (e) {} }
            });
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
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dbe-css-hint-btn';
        var icon = document.createElement('span');
        icon.className = 'dbe-css-hint-i';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = 'i';
        var label = document.createElement('span');
        label.className = 'dbe-css-hint-label';
        label.textContent = dbeT('cssHintBanner', 'How %local%, %selector% & breakpoints work');
        var dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'dbe-css-hint-dismiss';
        dismiss.setAttribute('aria-label', dbeT('cssHintDismiss', 'Dismiss hint'));
        dismiss.textContent = '×';
        btn.appendChild(icon);
        btn.appendChild(label);
        el.appendChild(btn);
        el.appendChild(dismiss);
        btn.setAttribute('aria-label', dbeT('cssHintOpen', 'Selector and breakpoint help'));
        btn.addEventListener('click', openCssHintDialog);
        dismiss.addEventListener('click', function () {
            try { localStorage.setItem(DBE_HINT_KEY, '1'); } catch (e) {}
            el.classList.add('is-collapsed');
        });
        host.insertBefore(el, firstMsg);
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


    /* Which feature groups need which wiring. */
    var NEED_TREE = on('tag_badges') || on('icon_declutter') || on('tree_row_styling') || on('multi_select');
    var NEED_NAV_BUTTONS = on('collapse_expand_all');
    var NEED_STYLES = on('css_code_default') || on('scope_bar') || on('style_inspector') ||
        on('css_hint_dialog') || on('hide_minimap');
    var NEED_CTX_MENU = on('context_menu') || on('style_inspector') || on('wrap_in') || on('inline_rename') || on('multi_select') || on('collapse_expand_all') || on('auto_bem') || on('element_moves') || on('keyboard_shortcuts') || on('edit_as_html') || on('import_html') || on('tag_change');

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


    var dbeA11yChunk = window.dbeBuilderChunks && window.dbeBuilderChunks.a11y;
    if (typeof dbeA11yChunk === 'function') {
        dbeA11yChunk(Object.freeze({
            on: on,
            translate: dbeT,
            query: dbeQuery,
            controllers: dbeControllers,
            observe: dbeObserveChrome,
            areaAriaShortcut: dbeAreaAriaShortcut,
            bindTooltips: bindTooltips,
            unbindTooltips: unbindTooltips,
            labelChromeIcons: labelChromeIcons,
            setAttributeRecorder: function (callback) { dbeRememberChromeAttributes = callback; }
        }));
    } else {
        document.documentElement.dataset.dbeChunkError = 'a11y:missing';
        if (window.console && console.error) {
            console.error('[DBE] Accessibility chunk failed to load; chrome accessibility enhancements were not started.');
        }
    }

    var dbeCompositesChunk = window.dbeBuilderChunks && window.dbeBuilderChunks.a11yComposites;
    if (typeof dbeCompositesChunk === 'function') {
        dbeCompositesChunk(Object.freeze({
            on: on,
            translate: dbeT,
            format: dbeFmt,
            plural: dbeTn,
            query: dbeQuery,
            builderius: Object.freeze({
                queryAll: dbeQueryAll,
                navigatorRow: dbeNavigatorRow,
                modules: modules,
                activeId: activeId,
                store: store,
                moveModule: storeMoveModule
            }),
            breakpoints: dbeBreakpoints,
            breakpointLabels: DBE_BP_LABELS,
            click: clickSeq,
            waitFor: waitFor,
            schedule: schedule,
            controllers: dbeControllers,
            observe: dbeObserveChrome,
            observeFooter: dbeObserveFooter,
            unobserveFooter: dbeUnobserveFooter,
            pruneGroupState: dbePruneGroupState,
            groupBindings: function () { return dbeGroupBindings; },
            rememberOwnedAttributes: dbeRememberOwnedAttributes,
            bindOwnedEvent: dbeBindOwnedEvent,
            setOwnedTimeout: dbeSetOwnedTimeout,
            setOwnedFrame: dbeSetOwnedFrame,
            destroyOwnedActivity: dbeDestroyOwnedActivity,
            destroyOwnedGroups: dbeDestroyOwnedGroups,
            multiSelection: Object.freeze({
                state: dbeMultiSel,
                isMac: dbeIsMac,
                clear: clearMultiSel,
                rowIds: domRowIds,
                toggle: toggleMultiSel,
                range: rangeMultiSel,
                renameActive: renameActive
            }),
            navigator: Object.freeze({
                moveSibling: moveSibling,
                indent: indentElement,
                outdent: outdentElement,
                scrollIntoView: function (row) { return scrollRowIntoTree(row); }
            }),
            feedback: Object.freeze({ undo: undoToast }),
            needTree: NEED_TREE,
            setNavigatorApi: function (api) {
                NAV_ROW_SEL = api.rowSelector;
                navRootList = api.rootList;
                navRowId = api.rowId;
                navRowById = api.rowById;
                navRowLi = api.rowListItem;
                navRowExpandable = api.rowExpandable;
                navRowExpanded = api.rowExpanded;
                navParentRow = api.parentRow;
                navVisibleRows = api.visibleRows;
                navFocus = api.focus;
                navSelect = api.select;
                navToggleExpand = api.toggleExpand;
            },
            setEnsureGroup: function (callback) { dbeEnsureGroup = callback; }
        }));
    } else {
        document.documentElement.dataset.dbeChunkError = 'a11y/composites:missing';
        if (window.console && console.error) {
            console.error('[DBE] Accessibility composites chunk failed to load; composite keyboard enhancements were not started.');
        }
    }

    function dbeRefreshTerminalIntegration() {
        if (!dbeTerminalControllerActive) { return; }
        dbeObserveTerminalBar();
        dbeObserveTerminalPanel(document.querySelector('.uniAiChat'));
        ensureTerminalTabs();
    }
    function dbeRetryTerminalFooter() {
        if (!dbeTerminalControllerActive || dbeQuery('footerBar') || dbeTerminalFooterAttempts >= 30) { return; }
        dbeTerminalFooterAttempts++;
        dbeSetOwnedTimeout(DBE_TERMINAL_OWNER, function () {
            if (!dbeTerminalControllerActive) { return; }
            dbeRefreshTerminalIntegration();
            dbeRetryTerminalFooter();
        }, 500);
    }
    function destroyTerminalIntegration() {
        dbeTerminalControllerActive = false;
        dbeTerminalFooterAttempts = 0;
        dbeAgentMenuWasOpen = false;
        dbeUnobserveFooter('integrations-terminal-footer');
        dbeObserveChrome('integrations-terminal-panel', null);
        dbeDestroyOwnedActivity(DBE_TERMINAL_OWNER);
        dbeDestroyOwnedGroups(DBE_TERMINAL_OWNER);
        dbeTerminalFrameDocuments = [];
        dbeTermAiNode = null;
        if (dbeTerminalEscapeHintOwned && dbeTerminalEscapeHintNode && dbeTerminalEscapeHintNode.parentNode) {
            dbeTerminalEscapeHintNode.parentNode.removeChild(dbeTerminalEscapeHintNode);
        }
        dbeTerminalEscapeHintNode = null;
        dbeTerminalEscapeHintOwned = false;
    }
    dbeControllers.register(DBE_TERMINAL_OWNER, {
        init: function (context) {
            if (!context || !context.builderius) { return; }
            dbeTerminalControllerActive = true;
            dbeBindAgentPickerKeys();
            dbeRefreshTerminalIntegration();
            dbeRetryTerminalFooter();
        },
        refresh: function (reason) {
            if (reason) { dbeRefreshTerminalIntegration(); }
        },
        destroy: function () {
            destroyTerminalIntegration();
        }
    }, on('ai_terminal_tabs'));

    var dbeWorkspaceChunk = window.dbeBuilderChunks && window.dbeBuilderChunks.workspace;
    if (typeof dbeWorkspaceChunk === 'function') {
        dbeWorkspaceChunk(Object.freeze({
            on: on,
            translate: dbeT,
            format: dbeFmt,
            config: CFG,
            query: dbeQuery,
            builderius: Object.freeze({
                navigatorRow: dbeNavigatorRow,
                activeId: activeId
            }),
            breakpoints: dbeBreakpoints,
            schedule: schedule,
            tooltip: setTip,
            syncSelectionContext: function () { return dbeSyncSelectionContext(); },
            canvas: Object.freeze({
                interactive: function () { return dbeCanvasInteractive(); },
                setInteractive: function (interactive) { return dbeSetCanvasInteractive(interactive); }
            }),
            controllers: dbeControllers,
            observe: dbeObserveChrome,
            observeFooter: dbeObserveFooter,
            unobserveFooter: dbeUnobserveFooter,
            rememberOwnedAttributes: dbeRememberOwnedAttributes,
            bindOwnedEvent: dbeBindOwnedEvent,
            setOwnedTimeout: dbeSetOwnedTimeout,
            setOwnedFrame: dbeSetOwnedFrame,
            destroyOwnedActivity: dbeDestroyOwnedActivity,
            destroyOwnedGroups: dbeDestroyOwnedGroups,
            setWorkspaceApi: function (api) {
                dbeFocusArea = api.focusArea;
                dbeCompactActive = api.compactActive;
                dbePanelWrappers = api.panelWrappers;
                dbePanelSideHidden = api.panelSideHidden;
                dbeToggleSidePanels = api.toggleSidePanels;
                dbeSetPanelVisibility = api.setPanelVisibility;
            }
        }));
    } else {
        document.documentElement.dataset.dbeChunkError = 'workspace:missing';
        if (window.console && console.error) {
            console.error('[DBE] Workspace chunk failed to load; responsive and workspace enhancements were not started.');
        }
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

    var dbeCommandsChunk = window.dbeBuilderChunks && window.dbeBuilderChunks.commands;
    if (typeof dbeCommandsChunk === 'function') {
        dbeCommandsChunk(Object.freeze({
            on: on,
            translate: dbeT,
            format: dbeFmt,
            plural: dbeTn,
            config: CFG,
            query: dbeQuery,
            builderius: Object.freeze({
                modules: modules,
                activeId: activeId,
                store: store
            }),
            click: clickSeq,
            waitFor: waitFor,
            schedule: schedule,
            tooltip: setTip,
            accelerator: dbeAccel,
            controllers: dbeControllers,
            observe: dbeObserveChrome,
            rememberOwnedAttributes: dbeRememberOwnedAttributes,
            bindOwnedEvent: dbeBindOwnedEvent,
            unbindOwnedEvent: dbeUnbindOwnedEvent,
            bindOwnedHook: dbeBindOwnedHook,
            destroyOwnedHooks: dbeDestroyOwnedHooks,
            setOwnedTimeout: dbeSetOwnedTimeout,
            clearOwnedTimeout: dbeClearOwnedTimeout,
            setOwnedFrame: dbeSetOwnedFrame,
            destroyOwnedActivity: dbeDestroyOwnedActivity,
            destroyOwnedGroups: dbeDestroyOwnedGroups,
            feedback: Object.freeze({ undo: undoToast }),
            context: Object.freeze({
                getTarget: function () { return lastCtxId; },
                setTarget: function (id) { lastCtxId = id; }
            }),
            multiSelection: Object.freeze({
                state: dbeMultiSel,
                isMac: dbeIsMac,
                clear: clearMultiSel,
                renameActive: renameActive,
                contextIds: multiCtxIds,
                remove: removeMulti,
                setDisabledReason: dbeSetDisabledReason,
                disableContextItem: disableCtxItem
            }),
            navigator: Object.freeze({
                rowSelector: NAV_ROW_SEL,
                rootList: navRootList,
                rowId: navRowId,
                rowById: navRowById,
                rowListItem: navRowLi,
                rowExpandable: navRowExpandable,
                rowExpanded: navRowExpanded,
                parentRow: navParentRow,
                visibleRows: navVisibleRows,
                focus: navFocus,
                toggleExpand: navToggleExpand,
                moveSibling: moveSibling,
                indent: indentElement,
                outdent: outdentElement,
                selectParent: selectParentOf
            }),
            editing: Object.freeze({
                startRename: startRename,
                defaultLabel: defaultLabelFor,
                commitRename: commitRename,
                wrap: wrap,
                unwrap: unwrap,
                bemClassable: bemClassable,
                openAutoBem: openAutoBemDialog,
                indentTarget: dbeIndentTarget,
                canOutdent: dbeCanOutdent,
                htmlEditable: dbeHtmlEditable,
                openEditHtml: openEditHtmlDialog,
                openImportHtml: openImportHtmlDialog,
                htmlModules: DBE_HTML_MODULES,
                tagChoices: DBE_TAG_CHOICES,
                changeTagEligible: dbeChangeTagEligible,
                changeTag: dbeChangeTag,
                cleanTagInput: dbeCleanTagInput,
                insertSection: dbeInsertSection,
                insertSibling: dbeInsertSibling,
                elementModule: dbeElementModule,
                decodeEntities: dbeDecodeEntities,
                attributeBlocked: dbeAttrBlocked,
                updateModuleSettings: dbeUpdateModuleSettings,
                addClasses: dbeAddClasses,
                emmetParse: dbeEmmetParse,
                emmetStructureError: dbeEmmetStructureError,
                emmetInsert: dbeEmmetInsert,
                moveLocation: dbeMoveLocation
            }),
            styles: Object.freeze({
                actionItems: dbeStyleActionItems,
                openInspector: openStyleInspector,
                openEditor: dbeOpenStyleEditor,
                moduleClasses: moduleClasses,
                entityScopeLabel: entityScopeLabel
            }),
            workspace: Object.freeze({
                focusArea: dbeFocusArea,
                compactActive: dbeCompactActive,
                toggleSidePanels: dbeToggleSidePanels,
                setPanelVisibility: dbeSetPanelVisibility,
                panelWrappers: dbePanelWrappers,
                panelSideHidden: dbePanelSideHidden
            }),
            needNavigatorButtons: NEED_NAV_BUTTONS,
            needContextMenu: NEED_CTX_MENU,
            setCommandsApi: function (api) {
                driveContextMenuItem = api.driveContextMenuItem;
                makeCtxItem = api.makeContextItem;
                dbeCanvasInteractive = api.canvasInteractive;
                dbeSetCanvasInteractive = api.setCanvasInteractive;
                dbeSyncSelectionContext = api.syncSelectionContext;
                scrollRowIntoTree = api.scrollNavigatorRow;
                expandSubtree = api.expandNavigatorSubtree;
                driveSelectedClose = api.closeSelectedClass;
            }
        }));
    } else {
        document.documentElement.dataset.dbeChunkError = 'commands:missing';
        if (window.console && console.error) {
            console.error('[DBE] Commands chunk failed to load; command and Navigator interaction enhancements were not started.');
        }
    }

    var DBE_STYLES_OWNER = 'styles';
    var dbeStylesControllerActive = false;

    function dbeObserveStyles() {
        var main = dbeQuery('mainPanel');
        dbeObserveChrome('styles-main', main, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    function dbeRefreshStyles() {
        if (!dbeStylesControllerActive) { return; }
        dbeObserveStyles();
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
        if (on('style_inspector')) { try { refreshOpenStyleInspector(); } catch (e) {} }
    }

    function dbeClearAllCssDecorations() {
        dbeFlashGen++;
        var handle = leftPanelMonaco();
        try { if (handle && dbeAllCssDecos.length) { handle.ed.deltaDecorations(dbeAllCssDecos, []); } } catch (e) {}
        dbeAllCssDecos = [];
    }

    function destroyStyles() {
        dbeStylesControllerActive = false;
        dbeObserveChrome('styles-main', null);
        if (dbeScopeFinish) { dbeScopeFinish(); }
        dbeDestroyOwnedActivity(DBE_STYLES_OWNER);
        dbeClearAllCssDecorations();

        var hintDialog = document.getElementById('dbe-css-hint-dialog');
        if (hintDialog && hintDialog.open) { try { hintDialog.close(); } catch (e) {} }
        if (hintDialog && hintDialog.isConnected) { hintDialog.remove(); }
        dbeCssHintFocusReturn = null;

        var inspector = document.querySelector('.dbe-style-inspector');
        if (inspector) { dbeCloseStyleInspector(inspector); }
        document.querySelectorAll(
            '.dbe-code-tabs, .dbe-scope-bar, .dbe-scope-status, .dbe-scope-cover, ' +
            '.dbe-scope-mask, .dbe-css-hint'
        ).forEach(function (node) { node.remove(); });

        document.querySelectorAll('.uniLeftPanel').forEach(function (left) {
            left.removeAttribute('data-dbe-level');
            left.querySelectorAll('.dbe-scope-hold').forEach(function (node) { node.classList.remove('dbe-scope-hold'); });
            left.querySelectorAll('.dbe-scope-covered').forEach(function (node) {
                node.classList.remove('dbe-scope-covered');
                node.removeAttribute('inert');
            });
        });

        var currentLeft = document.querySelector('.uniLeftPanel');
        if (dbeCssCodeDefaultForced && currentLeft && isCssCodeMode(currentLeft)) {
            var cssToggle = currentLeft.querySelector('.uniIconCssMode');
            if (cssToggle) { clickSeq(cssToggle); }
        }
        dbeCssCodeDefaultForced = false;
        goingToContent = false;
        dbeSwitchingScope = false;
        dbeScopeFinish = null;
        dbeSelScopeMemo = { global: { css: null, sel: null, hit: false }, entity: { css: null, sel: null, hit: false } };
        dbeStyleScopeSelectorMemo = {
            global: { css: null, selectors: {} },
            entity: { css: null, selectors: {} }
        };
        dbeStyleInspectorState = { id: null, instance: 0, tab: 'rules', filter: '', allComputed: false, focusReturn: null };
        dbeRestoreMinimap();
    }

    dbeControllers.register(DBE_STYLES_OWNER, {
        init: function (context) {
            if (!context || !context.builderius) { return; }
            dbeStylesControllerActive = true;
            dbeRefreshStyles();
        },
        refresh: function (reason) {
            if (reason) { dbeRefreshStyles(); }
        },
        destroy: function () {
            destroyStyles();
        }
    }, NEED_STYLES);

    /* Presence has two audiences: the front-end admin-bar guard reads a local
       heartbeat before opening a second builder tab, while server-side agent
       abilities read the REST heartbeat before committing changes. Keep both
       resources under one controller so pagehide reliably stops its intervals,
       removes only this tab's local record and clears its server record. */
    var DBE_PRESENCE_OWNER = 'integrations/presence';
    var dbePresenceActive = false;
    var dbePresenceHeartbeat = null;
    var dbePresenceServer = null;
    var dbePresenceTabId = '';
    var dbePresenceServerLastDirty = null;
    var dbePresenceServerLastSent = 0;

    function dbePresenceLocalRecords() {
        var records = {};
        if (!dbePresenceHeartbeat) { return records; }
        var key = dbePresenceHeartbeat.key || 'dbeBuilderiusOpen';
        var staleAfter = dbePresenceHeartbeat.staleAfter || 8000;
        var stored = null;
        try { stored = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
        if (stored && stored.tabs && typeof stored.tabs === 'object' && !Array.isArray(stored.tabs)) {
            records = stored.tabs;
        } else if (stored && typeof stored.t === 'number') {
            // Preserve one old-format beat during an in-place plugin update.
            records.legacy = { t: stored.t, title: stored.title || '' };
        }
        Object.keys(records).forEach(function (id) {
            var record = records[id];
            if (!record || typeof record.t !== 'number' || (Date.now() - record.t) > staleAfter) {
                delete records[id];
            }
        });
        return records;
    }

    function dbePresenceCreateTabId() {
        var id = '';
        try {
            var records = dbePresenceLocalRecords();
            id = sessionStorage.getItem('dbeBuilderiusTabId') || '';
            // Browsers may clone sessionStorage when a tab is duplicated. A
            // fresh record with the same id proves that this is a second tab,
            // not a reload whose pagehide teardown has already removed it.
            if (id && records[id]) { id = ''; }
            if (!id) {
                var random = new Uint32Array(4);
                crypto.getRandomValues(random);
                id = 'tab-' + [].map.call(random, function (number) {
                    return number.toString(16).padStart(8, '0');
                }).join('');
                sessionStorage.setItem('dbeBuilderiusTabId', id);
            }
        } catch (e) {
            id = 'tab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 18);
        }
        return id;
    }

    function dbePresenceWriteLocalBeat() {
        if (!dbePresenceActive || !dbePresenceHeartbeat || !dbePresenceTabId) { return; }
        var key = dbePresenceHeartbeat.key || 'dbeBuilderiusOpen';
        var records = dbePresenceLocalRecords();
        records[dbePresenceTabId] = { t: Date.now(), title: document.title };
        try { localStorage.setItem(key, JSON.stringify({ version: 2, tabs: records })); } catch (e) {}
    }

    function dbePresenceClearLocalBeat() {
        if (!dbePresenceHeartbeat || !dbePresenceTabId) { return; }
        var key = dbePresenceHeartbeat.key || 'dbeBuilderiusOpen';
        var records = dbePresenceLocalRecords();
        delete records[dbePresenceTabId];
        try {
            if (Object.keys(records).length) {
                localStorage.setItem(key, JSON.stringify({ version: 2, tabs: records }));
            } else {
                localStorage.removeItem(key);
            }
        } catch (e) {}
    }

    function dbePresenceSlug() {
        try { return new URLSearchParams(location.search).get('builderius_template') || ''; }
        catch (e) { return ''; }
    }

    function dbePresenceDirty() {
        return dbeHasUnsavedChanges();
    }

    function dbePresenceSendServerBeat(force, clear, knownDirty) {
        var server = dbePresenceServer || {};
        var slug = dbePresenceSlug();
        if (!server.url || !server.nonce || !slug || !dbePresenceTabId) { return; }
        var dirty = clear ? false : (typeof knownDirty === 'boolean' ? knownDirty : dbePresenceDirty());
        var now = Date.now();
        if (!force && dirty === dbePresenceServerLastDirty &&
            (now - dbePresenceServerLastSent) < (server.interval || 20000)) { return; }
        dbePresenceServerLastDirty = dirty;
        dbePresenceServerLastSent = now;
        try {
            fetch(server.url, {
                method: 'POST',
                credentials: 'same-origin',
                keepalive: true,
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': server.nonce
                },
                body: JSON.stringify({ entity: slug, tab: dbePresenceTabId, dirty: dirty })
            }).catch(function () {});
        } catch (e) {}
    }

    function dbePresenceInit() {
        dbePresenceActive = true;
        dbePresenceHeartbeat = CFG.heartbeat || {};
        dbePresenceServer = CFG.presence || {};
        dbePresenceTabId = dbePresenceCreateTabId();
        dbePresenceServerLastDirty = null;
        dbePresenceServerLastSent = 0;

        dbePresenceWriteLocalBeat();
        dbeSetOwnedInterval(
            DBE_PRESENCE_OWNER,
            dbePresenceWriteLocalBeat,
            dbePresenceHeartbeat.interval || 2500
        );

        if (dbePresenceServer.url && dbePresenceServer.nonce) {
            /* The save cue already calculates dirty state whenever the
               Builderius history/settings signals change. Reuse that result
               for immediate transition beats; do not serialise the same
               snapshot again on another normal-config polling cadence. */
            dbePresenceDirtyChanged = function (dirty) {
                dbePresenceSendServerBeat(false, false, dirty);
            };
            dbePresenceSendServerBeat(true);

            // Clean state has no server record to renew. Only a dirty tab needs
            // the slow keep-alive that prevents its 60-second record expiring.
            dbeSetOwnedInterval(DBE_PRESENCE_OWNER, function () {
                if (dbePresenceServerLastDirty === true) {
                    dbePresenceSendServerBeat(true, false, true);
                }
            }, dbePresenceServer.interval || 20000);

            // Without the visible save cue there is no transition publisher,
            // so retain a small fallback scanner for that configuration only.
            if (!on('save_state_cue')) {
                dbeSetOwnedInterval(DBE_PRESENCE_OWNER, function () {
                    dbePresenceSendServerBeat(false);
                }, dbePresenceServer.transitionInterval || 2500);
            }
        }
    }

    function dbePresenceDestroy() {
        dbePresenceActive = false;
        dbePresenceDirtyChanged = function () {};
        dbeDestroyOwnedActivity(DBE_PRESENCE_OWNER);
        dbePresenceClearLocalBeat();
        dbePresenceSendServerBeat(true, true);
        dbePresenceHeartbeat = null;
        dbePresenceServer = null;
        dbePresenceServerLastDirty = null;
        dbePresenceServerLastSent = 0;
    }

    dbeControllers.register(DBE_PRESENCE_OWNER, {
        init: function (context) {
            if (!context || !context.builderius) { return; }
            dbePresenceInit();
        },
        refresh: function () {},
        destroy: function () {
            dbePresenceDestroy();
        }
    }, on('presence_heartbeat'));

    var dbeScheduleReason = 'scheduled';
    var dbeScheduleRefresh = dbeRuntime.createScheduler(function () {
            var refreshReason = dbeScheduleReason;
            dbeScheduleReason = 'scheduled';
            dbeControllers.refresh(refreshReason);
    });
    function schedule(reason) {
        if (typeof reason === 'string') { dbeScheduleReason = reason; }
        else if (reason && typeof reason.length === 'number') { dbeScheduleReason = 'mutation'; }
        dbeScheduleRefresh();
    }

    function boot() {
        var panel = dbeQuery('navigatorPanel');
        if (!panel) { return void setTimeout(boot, 500); }
        dbeControllers.init();
        schedule('boot');
    }

    dbeRuntime.whenReady(boot);
})();
