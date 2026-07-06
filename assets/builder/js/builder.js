(function () {
    'use strict';

    /* Config printed by the plugin (includes/output-builder.php). Every feature
       is a toggle; helpers below are defined unconditionally (free), but
       WIRING — observers, listeners, hooks, DOM writes — only happens for
       enabled features. */
    var CFG = window.dbeBuilderEnhancements || {};
    var F = CFG.features || {};
    function on(id) { return !!F[id]; }

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
            undoToast('Wrap needs sibling elements');
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

        var makeId = function () {
            return 'u' + Array.from({ length: 9 }, function () {
                return Math.floor(Math.random() * 16).toString(16);
            }).join('');
        };
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
            undoToast('Wrapped ' + order.length + ' element' + (order.length === 1 ? '' : 's') +
                ' in a template — add a rendering condition or its contents won’t show on the page');
        } else {
            var typeLabel = type === 'collection' ? 'collection + template' : type;
            undoToast('Wrapped ' + order.length + ' element' + (order.length === 1 ? '' : 's') + ' in ' + typeLabel);
        }

        // Land on the new wrapper so the next step (condition, settings) is one click away.
        waitFor(function () {
            return document.querySelector('.uniRightPanel .uni-tree-node-' + newId) || null;
        }, function (row) { if (row) { clickSeq(row); } });
        console.log('[DBE] Wrapped ' + order.join(', ') + ' in ' + type + ' (' + newId + ') via store actions.');
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
        input.setAttribute('aria-label', 'Rename element');

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
        dlg.setAttribute('aria-label', 'Auto-BEM');

        var head = document.createElement('div');
        head.className = 'dbe-bem__head';
        var title = document.createElement('h2');
        title.className = 'dbe-bem__title';
        title.textContent = 'Auto-BEM';
        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'dbe-bem__close';
        close.setAttribute('aria-label', 'Close');
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
        blockLabel.textContent = 'Block name';
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
        list.setAttribute('aria-label', 'Elements and class names');
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
            check.setAttribute('aria-label', 'Add a class to this element');

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
            field.setAttribute('aria-label', 'Class name');
            field.addEventListener('input', function () { field.dataset.dbeEdited = '1'; });

            var hint = document.createElement('span');
            hint.className = 'dbe-bem__hint';
            if (!row.supported) { hint.textContent = 'not supported'; }
            else if (row.classes.length) { hint.textContent = 'has .' + row.classes.join(' .'); }

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
            applyBtn.textContent = 'Add ' + n + ' class' + (n === 1 ? '' : 'es');
            applyBtn.disabled = !n;
        }

        var foot = document.createElement('div');
        foot.className = 'dbe-bem__foot';
        var cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'dbe-bem__cancel';
        cancel.textContent = 'Cancel';
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
                undoToast('Invalid class name: “' + bad[0].className + '”');
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

        // Keys inside the dialog must not reach the builder (Delete removes the
        // selected element!); Escape keeps its native close behaviour.
        dlg.addEventListener('keydown', function (e) { e.stopPropagation(); });
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
        stop.textContent = 'Stop';
        var aborted = false;
        stop.addEventListener('click', function () {
            aborted = true;
            stop.disabled = true;
            stop.textContent = 'Stopping…';
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
                progress.update('Applying classes… ' + (added + 1) + '/' + total + '  (.' + job.className + ')');
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
            undoToast('Added ' + added + ' class' + (added === 1 ? '' : 'es') +
                (failed ? ', ' + failed + ' failed' : '') +
                (added ? ' — remember to save' : ''));
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
                undoToast(doneMsg || ('Removed ' + removed + ' element' + (removed === 1 ? '' : 's') + ' — Cmd+Z restores one at a time'));
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
            ? ('Moved ' + total + ' element' + (total === 1 ? '' : 's') + ' — ' + failed + ' could not follow')
            : ('Moved ' + total + ' elements together'));
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
            if (document.querySelector('dialog.uniBuilderContextMenu[open]') || renameState) { return; }
            var t = e.target;
            if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], .monaco-editor')) { return; }
            clearMultiSel();
        }, true);
    }

    /* (d3) Undo/redo last delete — Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z.
       Builderius already RECORDS history (storeGet('history') = [{timestamp,
       snapshot:{modules}}], a full pre-op snapshot per module operation) but
       nothing consumes it and Cmd+Z is unbound. A raw storeSet restore neither
       repaints nor persists (see the file-header channel note), so undo instead
       re-adds the deleted subtree through the builder's own paste controller,
       which repaints tree + canvas natively:
       - native Copy writes JSON to the SYSTEM clipboard: {modules, indexes,
         template, version, source:"builderiusCopiedElements"} — a payload we
         can forge from the history snapshot of the deleted subtree;
       - Paste inserts the clipboard subtree as the LAST CHILD of the ACTIVE
         (selected) module — right-click alone doesn't set selection — or at
         root when nothing is selected;
       so: capture deletes via builderius.Module.deleted, and on undo select the
       former parent, forge the clipboard, drive Paste via a hidden auto-opened
       context menu. Restored elements get a new id (paste regenerates ids) and
       are appended last among their siblings — original position is not
       restored. Redo re-deletes via the same menu channel, which re-captures it
       for undo. The user's clipboard is saved/restored around the forgery where
       the browser allows reading it. */
    var undoStack = [];
    var redoStack = [];
    var dbeUndoBusy = false;
    var dbeRedoDeleting = false;
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

    function hookDeleteCapture() {
        try {
            window.Builderius.API.hooks.addAction('builderius.Module.deleted', 'dbeUndoCapture', function (p) {
                if (!p || !p.id) { return; }
                var sf = store();
                var hist;
                try { hist = sf.storeGet('history') || []; } catch (e) { return; }
                // Most recent snapshot that still contains the deleted module
                var snapMods = null;
                for (var i = hist.length - 1; i >= 0; i--) {
                    var sm = hist[i].snapshot && hist[i].snapshot.modules;
                    if (sm && sm[p.id]) { snapMods = sm; break; }
                }
                if (!snapMods) { return; }
                var subtree = {};
                (function collect(id) {
                    subtree[id] = JSON.parse(JSON.stringify(snapMods[id]));
                    Object.keys(snapMods).forEach(function (k) {
                        if (snapMods[k].parent === id) { collect(k); }
                    });
                })(p.id);
                subtree[p.id].parent = '';
                undoStack.push({
                    id: p.id,
                    label: snapMods[p.id].label || snapMods[p.id].name || 'element',
                    parentId: snapMods[p.id].parent || '', // '' = root
                    subtree: subtree
                });
                if (undoStack.length > 10) { undoStack.shift(); }
                // A fresh manual delete invalidates the redo chain; a redo's own
                // delete must not (it is the redo chain).
                if (!dbeRedoDeleting) { redoStack = []; }
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

    function performUndo() {
        if (dbeUndoBusy) { return; }
        var rec = undoStack.pop();
        if (!rec) { undoToast('Nothing to undo'); return; }
        if (rec.parentId && !document.querySelector('.uniRightPanel .uni-tree-node-' + rec.parentId)) {
            undoToast('Cannot restore “' + rec.label + '” — its parent is gone');
            return;
        }
        dbeUndoBusy = true;
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
        var fail = function (msg) {
            dbeUndoBusy = false;
            undoStack.push(rec); // keep it available for another try
            undoToast(msg);
        };
        var paste = function (menuRowId) {
            var prevClip = null;
            navigator.clipboard.readText()
                .then(function (t) { prevClip = t; })
                .catch(function () {})
                .then(function () { return navigator.clipboard.writeText(payload); })
                .then(function () {
                    driveContextMenuItem(menuRowId, 'Paste', function (ok) {
                        if (!ok) { fail('Undo failed — could not reach Paste'); return; }
                        waitFor(function () {
                            var mods = modules() || {};
                            return Object.keys(mods).find(function (id) {
                                return beforeIds.indexOf(id) === -1 && (mods[id].parent || '') === rec.parentId;
                            }) || null;
                        }, function (newId) {
                            if (prevClip !== null) { navigator.clipboard.writeText(prevClip).catch(function () {}); }
                            if (!newId) { fail('Undo failed — element not restored'); return; }
                            dbeUndoBusy = false;
                            redoStack.push({ id: newId, label: rec.label });
                            undoToast('Restored “' + rec.label + '”');
                        });
                    });
                })
                .catch(function () { fail('Undo failed — clipboard blocked'); });
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
                    else { fail('Undo failed — could not select the parent'); }
                }, 20); // 4 tries x ~500ms instead of one 1.5s wait
            })();
        } else {
            // Root-level restore: clear the selection so paste falls back to root.
            try { store().storeSet('activeModule', ''); } catch (e) {}
            var anyRow = document.querySelector('.uniRightPanel .uniModTree__item');
            var m = anyRow && anyRow.className.toString().match(/uni-tree-node-(\w+)/);
            if (!m) { fail('Undo failed — no tree rows'); return; }
            paste(m[1]);
        }
    }

    function performRedo() {
        if (dbeUndoBusy) { return; }
        var rec = redoStack.pop();
        if (!rec) { undoToast('Nothing to redo'); return; }
        if (!document.querySelector('.uniRightPanel .uni-tree-node-' + rec.id)) {
            redoStack = [];
            undoToast('Cannot redo — “' + rec.label + '” no longer exists');
            return;
        }
        dbeUndoBusy = true;
        dbeRedoDeleting = true;
        driveContextMenuItem(rec.id, 'Remove', function (ok) {
            setTimeout(function () {
                dbeRedoDeleting = false;
                dbeUndoBusy = false;
                if (ok) { undoToast('Deleted “' + rec.label + '” again'); }
                else { redoStack.push(rec); undoToast('Redo failed'); }
            }, 300);
        });
    }

    function bindUndoKeys() {
        document.addEventListener('keydown', function (e) {
            if (!(e.metaKey || e.ctrlKey) || (e.key || '').toLowerCase() !== 'z') { return; }
            // Leave text-editing undo alone: inputs, contenteditables (settings
            // header rename), Monaco code editors, and our inline rename field.
            var t = e.target;
            if (renameState) { return; }
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

    /* The element context menu. With context_menu ON the long flat list is
       regrouped into logical submenus — Duplicate and Create Component stay
       top-level, Copy/Paste fold into "Clipboard", the naming actions into
       "Name & classes", wrap + expand into "Structure", the native Save items
       into "Save to", and Remove drops to the bottom behind a separator. With
       context_menu OFF the injected items keep their original flat layout and
       the native items are left untouched. */
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
            if (!container || container.querySelector('.dbe-ctx-parent')) { return; }
            if (!/Duplicate|Create Component/.test(container.textContent || '')) { return; }

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
                renameLi.textContent = 'Rename';
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
                    resetLi.textContent = 'Reset label';
                    resetLi.addEventListener('mousedown', function (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        var id = lastCtxId;
                        removeSubmenus();
                        try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
                        commitRename(id, ctxDefault);
                        undoToast('Label reset to <' + ctxDefault + '>');
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
                    bemLi.textContent = 'Auto-BEM…';
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
                expandLi.textContent = 'Expand children';
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
                removeNLi.textContent = 'Remove ' + multiIds.length + ' elements';
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

            /* --- Flat layout (context_menu off): original append order --- */
            if (!grouped) {
                if (nameItems.length) {
                    nameItems[0].classList.add('dbe-ctx-item--first');
                    nameItems.forEach(function (li) { container.appendChild(li); });
                }
                if (expandLi) {
                    if (!nameItems.length) { expandLi.classList.add('dbe-ctx-item--first'); }
                    container.appendChild(expandLi);
                }
                if (removeNLi) { container.appendChild(removeNLi); }
                if (wrapEnabled) {
                    var flatWrap = makeParent(
                        multiIds ? ('Wrap ' + multiIds.length + ' in') : 'Wrap in',
                        false,
                        function () {
                            return [
                                makeWrapItem('div', 'Div'),
                                makeWrapItem('template', 'Template'),
                                makeWrapItem('collection', 'Collection + template')
                            ];
                        },
                        wrapDisabled
                    );
                    if (wrapDisabled) { flatWrap.setAttribute('data-dbe-tip', 'Only sibling elements can be wrapped together'); }
                    container.appendChild(flatWrap);
                }
                return;
            }

            /* --- Grouped layout (context_menu on) --- */

            // Clipboard › Copy / Paste (single-target: disabled for multi).
            var clipItems = collectNativeItems(container, /^(Copy|Paste)$/);
            if (clipItems.length) {
                container.appendChild(makeParent('Clipboard', false, function () { return clipItems; }, !!multiIds));
            }

            // Name & classes › Rename / Reset label / Auto-BEM…
            if (nameItems.length) {
                container.appendChild(makeParent('Name & classes', false, function () { return nameItems; }, false));
            }

            // Structure › Wrap in … / Expand children. The wrap actions are
            // hoisted flat into this flyout (labels gain a "Wrap in " prefix) —
            // flyouts cannot nest: openFlyout() tears down any open submenu.
            if (wrapEnabled || expandLi) {
                var wrapLabel = multiIds ? ('Wrap ' + multiIds.length + ' in ') : 'Wrap in ';
                var structParent = makeParent('Structure', false, function () {
                    var items = [];
                    if (wrapEnabled) {
                        items.push(makeWrapItem('div', wrapLabel + 'Div'));
                        items.push(makeWrapItem('template', wrapLabel + 'Template'));
                        items.push(makeWrapItem('collection', wrapLabel + 'Collection + template'));
                    }
                    if (expandLi) { items.push(expandLi); }
                    return items;
                }, wrapDisabled);
                if (wrapDisabled) { structParent.setAttribute('data-dbe-tip', 'Only sibling elements can be wrapped together'); }
                container.appendChild(structParent);
            }

            // Save to › the native "Save ..." (SOON) items (disabled for multi).
            var saveItems = collectNativeItems(container, /^Save\b/);
            if (saveItems.length) {
                container.appendChild(makeParent('Save to', false, function () { return saveItems; }, !!multiIds));
            }

            // Remove sits last, behind a separator — the destructive action is
            // easiest to hit by muscle memory, so give it its own zone. For a
            // multi-selection "Remove N elements" replaces the (single-target)
            // native item.
            var removeNative = collectNativeItems(container, /^Remove$/);
            if (multiIds) {
                if (removeNLi) { container.appendChild(removeNLi); }
            } else if (removeNative.length) {
                removeNative.forEach(function (li) {
                    li.classList.add('dbe-ctx-item--first');
                    container.appendChild(li);
                });
            }

            setupMenuKeyboard(container);
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
        btn.setAttribute('aria-label', 'Collapse subtrees');
        btn.title = 'Collapse subtrees (keeps top-level elements open)';
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
        btn.setAttribute('aria-label', 'Expand all');
        btn.title = 'Expand all elements';
        btn.innerHTML = '<span><svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<path d="M1.2 1.5h9.6M6 5.5V12M3.8 9.8 6 12l2.2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg></span>';
        btn.addEventListener('click', expandAll);
        // Sits first: Expand all, Collapse subtrees, then the stock toggle
        // (when Builderius renders it).
        icons.insertBefore(btn, icons.querySelector('.dbe-collapse-subtrees') || icons.firstChild);
    }

    /* (h) Tooltips + accessible names for icon-only chrome buttons. Builderius
       wraps a few controls (favourites bar, footer overlay toggle) in a
       react-tooltip .tooltipItem; everything else — Navigator header icons, the
       settings-header conditions/CSS-mode icons, the top-bar breakpoint and
       reload buttons, the tree-footer delete — has neither a tooltip nor an
       accessible name. setTip() gives each an aria-label (4.1.2) and a
       data-dbe-tip driving the shared .dbe-tooltip chip; any title attribute is
       dropped so native and custom tooltips never double up. */
    function setTip(el, label) {
        if (!el) { return; }
        if (el.getAttribute('data-dbe-tip') !== label) { el.setAttribute('data-dbe-tip', label); }
        if (!el.getAttribute('aria-label')) { el.setAttribute('aria-label', label); }
        if (el.hasAttribute('title')) { el.removeAttribute('title'); }
    }

    var DBE_TIPS = [
        ['.uniRightPanel .uniPanelHeader__icons .dbe-expand-all', 'Expand all elements'],
        ['.uniRightPanel .uniPanelHeader__icons .dbe-collapse-subtrees', 'Collapse subtrees — keeps top level open'],
        ['.uniLeftPanel .uniIconConditionsMode', 'Dynamic data conditions'],
        ['.uniLeftPanel .uniIconCssMode', 'Toggle CSS code editor'],
        ['.uniLeftPanel .dbe-expand-panel', 'Widen panel for the CSS editor'],
        ['.uniPanelButton--builderiusMenu', 'Builderius menu'],
        ['.uniGlobalBreakpoints__modalIcon', 'Breakpoint settings'],
        ['.uniReloadIframeBtn', 'Reload preview'],
        ['.uniIconButton.caretIcon', 'Save options'],
        ['.uniModTree__footer button.uniPanelIconButton', 'Delete selected element — click twice to confirm'],
        ['.uniModTree__footer .editFavouritesIcon', 'Edit favourite elements'],
        ['.uniFooterPanelBar .collapsePanelIcon', 'Collapse bottom panel'],
        ['.uniBreakpointsTable__addNew', 'Add breakpoint'],
        ['.uniBreakpointsTable__delete', 'Delete breakpoint'],
        ['.uniFormField__ddTagsBtn', 'Insert dynamic data']
    ];

    /* Fallback breakpoint labels, used only when dbeBreakpoints() can't read
       the real list from the builder. Order is base canvas first, then
       breakpoints large-to-small. */
    var DBE_BP_LABELS = [
        'Base styles — full width',
        'Desktop — max 1279px',
        'Tablet — max 991px',
        'Mobile — max 478px'
    ];

    function labelChromeIcons() {
        DBE_TIPS.forEach(function (pair) {
            document.querySelectorAll(pair[0]).forEach(function (el) { setTip(el, pair[1]); });
        });
        // Top-bar breakpoint buttons carry no name anywhere in the DOM; label
        // them from the site's real breakpoints (order matches the buttons:
        // base first, then large-to-small), falling back to the static list.
        var bps = dbeBreakpoints();
        document.querySelectorAll('.uniPanelButtonBreakpoint').forEach(function (b, i) {
            var bp = bps && bps[i];
            if (bp) {
                setTip(b, bp.width ? (bp.label + ' — max ' + bp.width + 'px') : (bp.label + ' — base styles, full width'));
            } else {
                setTip(b, DBE_BP_LABELS[i] || 'Breakpoint');
            }
        });
        // The stock Navigator button is a collapse-all/expand-all toggle whose
        // icon swaps per click — label follows the icon (collapse-all state
        // draws the "M0.53125 7..." bar path).
        var stock = document.querySelector('.uniRightPanel .uniPanelHeader__icons > button:not(.dbe-expand-all):not(.dbe-collapse-subtrees)');
        if (stock) {
            var d = stock.querySelector('svg path');
            d = d ? (d.getAttribute('d') || '') : '';
            setTip(stock, d.indexOf('M0.53125') === 0 ? 'Collapse all' : 'Expand all');
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
            if (d.indexOf('M0.53125') === 0) { setTip(b, 'Collapse all groups'); }
            else if (d.indexOf('M11.6445') === 0) { setTip(b, 'Expand all groups'); }
            else if (d.indexOf('M11.9198') === 0) { setTip(b, 'Close panel'); }
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
                setTip(b, b.classList.contains('active') ? 'Show side panels' : 'Hide side panels — full-width canvas');
            } else if (d.indexOf('M19.6173') === 0) {
                setTip(b, 'Preview page in a new tab');
            }
        });
    }

    /* Shared tooltip chip. Shown after a short hover delay (instantly on
       keyboard focus), hidden on leave/blur/Escape/pointerdown/scroll.
       Placement prefers ABOVE the trigger (never sits under the pointer),
       then the side with the most room, and only then below — so the top-bar
       icons get a side chip and everything else gets an above chip. Anchored
       to the element, not the cursor, so keyboard focus behaves identically. */
    var tipEl = null, tipTimer = null, tipTarget = null;
    function placeTip(r, w, h) {
        var M = 4, G = 8;
        var clampX = function (x) { return Math.min(Math.max(M, x), window.innerWidth - w - M); };
        var clampY = function (y) { return Math.min(Math.max(M, y), window.innerHeight - h - M); };
        // 1. Above, centred.
        if (r.top - h - G >= M) {
            return [clampX(r.left + r.width / 2 - w / 2), r.top - h - G];
        }
        // 2. Beside, vertically centred — whichever side has more room.
        var spaceRight = window.innerWidth - r.right, spaceLeft = r.left;
        if (spaceRight >= w + G + M || spaceLeft >= w + G + M) {
            var x = spaceRight >= spaceLeft ? r.right + G : r.left - w - G;
            return [x, clampY(r.top + r.height / 2 - h / 2)];
        }
        // 3. Below, centred (last resort).
        return [clampX(r.left + r.width / 2 - w / 2), clampY(r.bottom + G)];
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
                document.body.appendChild(tipEl);
            }
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
        strip.appendChild(mk('Content', false, gotoContent));
        strip.appendChild(mk('Styles', true, null));
        var header = sp.querySelector('.uniPanelHeader');
        if (header && header.nextSibling) { sp.insertBefore(strip, header.nextSibling); }
        else { sp.insertBefore(strip, sp.firstChild); }
    }

    /* Widen button in the settings-panel header: toggles body.dbe-css-wide, which
       releases the compact width clamp (see CSS) so the code editor gets the full
       native width. Hidden by CSS unless Monaco is present. */
    var EXPAND_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M2 7h10M4.4 4.6 2 7l2.4 2.4M9.6 4.6 12 7l-2.4 2.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';
    function ensureExpandButton() {
        var icons = document.querySelector('.uniLeftPanel .uniPanelHeader__icons');
        if (!icons) { return; }
        var btn = icons.querySelector('.dbe-expand-panel');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'uniPanelIconButton uniPanelIconButtonSmall dbe-expand-panel';
            btn.setAttribute('aria-label', 'Widen settings panel');
            btn.title = 'Widen settings panel for the CSS editor';
            btn.innerHTML = '<span>' + EXPAND_SVG + '</span>';
            btn.addEventListener('click', function () {
                var wide = document.body.classList.toggle('dbe-css-wide');
                btn.setAttribute('aria-pressed', wide ? 'true' : 'false');
            });
            icons.appendChild(btn);
        }
        // Keep the pressed state in sync with the body class (survives re-renders).
        btn.setAttribute('aria-pressed', document.body.classList.contains('dbe-css-wide') ? 'true' : 'false');
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
            lbl.textContent = 'Switching scope…';
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
                'Scope controls where edits are SAVED. The editor shows the ' +
                'selector’s existing rules from both scopes, so a rule you ' +
                'see here may be stored in the other scope.');
            badge.tabIndex = 0;
            bar.appendChild(badge);
            var sw = document.createElement('div');
            sw.className = 'dbe-scope-switch';
            sw.setAttribute('role', 'group');
            sw.setAttribute('aria-label', 'CSS scope');
            ['global', 'template'].forEach(function (sc) {
                var b = document.createElement('button');
                b.type = 'button';
                b.setAttribute('data-scope', sc);
                b.textContent = sc.charAt(0).toUpperCase() + sc.slice(1);
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
            if (picker.nextSibling) { picker.parentNode.insertBefore(bar, picker.nextSibling); }
            else { picker.parentNode.appendChild(bar); }
        }
        bar.querySelector('.dbe-scope-badge').textContent =
            level === 'local' ? 'Local' : (level === 'template' ? 'Template' : 'Global');
        [].slice.call(bar.querySelectorAll('.dbe-scope-switch button')).forEach(function (b) {
            b.classList.toggle('is-active', b.getAttribute('data-scope') === dbeScope);
        });
    }

    /* (i) Theme switcher: cycles light -> dark -> auto, persisted per browser.
       html[data-dbe-theme] drives color-scheme (00-tokens.css), which resolves
       every light-dark() token — no per-element JS repainting. Monaco has its
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
    var lastMonacoTheme = null;

    function currentTheme() {
        var t = document.documentElement.dataset.dbeTheme;
        return THEME_ORDER.indexOf(t) !== -1 ? t : ((CFG.theme && CFG.theme.default) || 'auto');
    }
    function effectiveTheme() {
        var t = currentTheme();
        if (t === 'auto') { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
        return t;
    }
    function applyMonacoTheme() {
        var want = effectiveTheme() === 'light' ? 'vs' : 'vs-dark';
        if (want === lastMonacoTheme) { return; }
        try {
            if (window.monaco && window.monaco.editor) {
                window.monaco.editor.setTheme(want);
                lastMonacoTheme = want;
            }
        } catch (e) {}
    }
    function decorateThemeButton(btn) {
        var t = currentTheme();
        var next = THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length];
        btn.querySelector('span').innerHTML =
            '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            THEME_ICONS[t] + '</svg>';
        setTip(btn, 'Theme: ' + t + ' — switch to ' + next);
    }
    function setTheme(t) {
        document.documentElement.dataset.dbeTheme = t;
        try { localStorage.setItem('dbeBuilderTheme', t); } catch (e) {}
        applyMonacoTheme();
        var btn = document.querySelector('.dbe-theme-btn');
        if (btn) { decorateThemeButton(btn); }
    }
    function ensureThemeButton() {
        var col = document.querySelector('.uniTopPanel__rightCol');
        if (!col || col.querySelector('.dbe-theme-btn')) { return; }
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'uniPanelButton dbe-theme-btn';
        btn.appendChild(document.createElement('span'));
        btn.addEventListener('click', function () {
            setTheme(THEME_ORDER[(THEME_ORDER.indexOf(currentTheme()) + 1) % THEME_ORDER.length]);
        });
        decorateThemeButton(btn);
        col.insertBefore(btn, col.firstChild);
        // Auto mode: retheme Monaco when the OS scheme flips (CSS tracks itself).
        try {
            matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyMonacoTheme);
        } catch (e) {}
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
        setTip(btn, 'Density: ' + d + ' — switch to ' + next);
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
        });
        decorateDensityButton(btn);
        // Sit next to the theme button when both are on.
        var themeBtn = col.querySelector('.dbe-theme-btn');
        col.insertBefore(btn, themeBtn ? themeBtn.nextSibling : col.firstChild);
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
        input.placeholder = 'Filter elements…';
        input.setAttribute('aria-label', 'Filter elements by label or tag');
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
    function ensureSaveCue() {
        var save = document.querySelector('.uniTopPanel .uniPanelButtonPrimary');
        if (!save) { return; }
        var cue = document.querySelector('.dbe-save-cue');
        if (!cue) {
            cue = document.createElement('span');
            cue.className = 'dbe-save-cue';
            cue.setAttribute('role', 'status');
            cue.textContent = 'Unsaved';
            save.parentNode.insertBefore(cue, save);
            save.addEventListener('click', function () {
                // Give the save request a beat, then treat the current state as clean.
                setTimeout(function () {
                    saveBaseline = historyLen();
                    ensureSaveCue();
                }, 500);
            }, true);
        }
        var len = historyLen();
        if (len === null) { return; }
        if (saveBaseline === null) { saveBaseline = len; }
        cue.classList.toggle('is-dirty', len > saveBaseline);
    }

    /* (l) Keyboard shortcuts overlay — ? opens a native <dialog>. */
    var SHORTCUT_GROUPS = [
        ['General', [
            ['?', 'Open this shortcuts overlay'],
            ['Esc', 'Close menus and dialogs; clear the multi-selection'],
            ['Delete', 'Remove the selected element (Builderius)'],
            ['Cmd/Ctrl+C · Cmd/Ctrl+V', 'Copy / paste the selected element (Builderius)']
        ]],
        ['Navigator', [
            ['Cmd/Ctrl+Z', 'Restore the last deleted element'],
            ['Cmd/Ctrl+Shift+Z', 'Redo the delete'],
            ['Cmd/Ctrl+click', 'Add or remove a row from the multi-selection'],
            ['Shift+click', 'Select a range of rows'],
            ['Shift+F10', 'Open the context menu on the focused row']
        ]],
        ['Context menu', [
            ['↑ ↓', 'Move between items (wraps)'],
            ['Home · End', 'First / last item'],
            ['Enter · Space', 'Activate an item or open its submenu'],
            ['→ ←', 'Open / close a submenu']
        ]]
    ];
    function openShortcutsDialog() {
        var dlg = document.querySelector('dialog.dbe-shortcuts');
        if (!dlg) {
            dlg = document.createElement('dialog');
            dlg.className = 'dbe-shortcuts';
            dlg.setAttribute('aria-label', 'Keyboard shortcuts');
            var head = document.createElement('div');
            head.className = 'dbe-shortcuts__head';
            var title = document.createElement('h2');
            title.className = 'dbe-shortcuts__title';
            title.textContent = 'Keyboard shortcuts';
            var close = document.createElement('button');
            close.type = 'button';
            close.className = 'dbe-shortcuts__close';
            close.setAttribute('aria-label', 'Close');
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
            if (renameState) { return; }
            var t = e.target;
            if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], .monaco-editor')) { return; }
            if (document.querySelector('dialog[open]')) { return; }
            e.preventDefault();
            e.stopPropagation();
            openShortcutsDialog();
        }, true);
    }

    /* Preview resize handles (preview_resize): drag either edge of the canvas
       to resize it around the centre — a container-query-style workflow.
       Width writes go through the builder's OWN top-bar width input
       (.uniGlobalBreakpoints__canvasControl input[name=width]): driving it
       with the native value setter + an input event makes React resize the
       canvas, keep the readout in sync AND highlight the breakpoint whose
       range the width falls into — identical to typing in the field. Clicking
       a breakpoint button snaps back natively, so no reset code is needed. */
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
        h.setAttribute('aria-label', 'Resize preview canvas');

        var drag = null;
        h.addEventListener('pointerdown', function (ev) {
            var inner = dbeCanvasInner();
            if (!inner) { return; }
            ev.preventDefault();
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
                dbeSetCanvasWidth(w);
                dbeSyncHandleAria(h);
            });
        });
        function endPreviewDrag() {
            if (!drag) { return; }
            drag = null;
            var panel = document.querySelector('.uniIframePanel');
            if (panel) { panel.classList.remove('dbe-preview-resizing'); }
        }
        h.addEventListener('pointerup', endPreviewDrag);
        h.addEventListener('pointercancel', endPreviewDrag);

        h.addEventListener('keydown', function (ev) {
            var inner = dbeCanvasInner();
            if (!inner) { return; }
            var w = inner.getBoundingClientRect().width;
            var step = ev.shiftKey ? 50 : 10;
            var max = dbeCanvasMax();
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
            dbeSetCanvasWidth(Math.max(DBE_PREVIEW_MIN, Math.min(max, next)));
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
                icon.setAttribute('aria-label', favLabel(li) + ' — press up or down arrow to move, Escape to finish');
            } else {
                var prev = icon.getAttribute('data-dbe-fav-label');
                if (prev) { icon.setAttribute('aria-label', prev); } else { icon.removeAttribute('aria-label'); }
                icon.removeAttribute('data-dbe-fav-label');
            }
        });
        if (onMode) {
            favAnnounce('Rearrange mode on — drag the icons, or focus one and use the arrow keys');
        } else {
            favPersistOrder();
            favAnnounce('Rearrange mode off — order saved');
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
            favAnnounce('Moved ' + favLabel(li) + ' to position ' + (items.indexOf(li) + 1) + ' of ' + items.length);
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
            favAnnounce('Moved ' + favLabel(li) + ' to position ' + (items.indexOf(li) + 1) + ' of ' + items.length);
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
        btn.setAttribute('aria-label', 'Rearrange favourites');
        btn.setAttribute('data-dbe-tip', 'Rearrange favourites');
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
        function done() { undoToast('Copied ' + text); }
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
            } catch (e) { undoToast('Copy failed — clipboard unavailable'); }
        }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done, fallback);
                return;
            }
        } catch (e) {}
        fallback();
    }

    function openChipMenu(chipLi, x, y) {
        closeChipMenu();
        var nameEl = chipLi.querySelector('span') || chipLi;
        var name = (nameEl.textContent || '').trim();
        if (!name) { return; }
        var bare = name.replace(/^[.#]/, '');
        var all = [].slice.call(document.querySelectorAll('.uniModuleCssClassesSelect__list li > span'))
            .map(function (s) { return (s.textContent || '').trim(); })
            .filter(Boolean);

        // Same card chain as the flyouts so 30-context-menu.css styles it.
        var card = document.createElement('div');
        card.className = 'uniBuilderContextMenu dbe-ctx-submenu dbe-chip-menu';
        var inner = document.createElement('div');
        inner.className = 'uniBuilderContextMenu__inner';
        var menu = document.createElement('div');
        menu.className = 'uniContextMenu';
        menu.setAttribute('role', 'menu');
        var ul = document.createElement('ul');
        function mkItem(label, fn) {
            var li = document.createElement('li');
            li.className = 'uniContextMenu__item';
            li.setAttribute('role', 'menuitem');
            li.tabIndex = -1;
            li.textContent = label;
            function act(ev) { ev.preventDefault(); ev.stopPropagation(); closeChipMenu(); fn(); }
            li.addEventListener('mousedown', act);
            li.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter' || ev.key === ' ') { act(ev); }
            });
            return li;
        }
        ul.appendChild(mkItem('Copy ' + name, function () { dbeCopyText(name); }));
        if (bare !== name) {
            ul.appendChild(mkItem('Copy ' + bare + ' (no dot)', function () { dbeCopyText(bare); }));
        }
        if (all.length > 1) {
            ul.appendChild(mkItem('Copy all classes (' + all.length + ')', function () {
                dbeCopyText(all.map(function (n) { return n.replace(/^\./, ''); }).join(' '));
            }));
        }
        var actions = chipLi.querySelector('.actions');
        if (actions) {
            var rm = mkItem('Remove ' + name + ' from element', function () {
                actions.click();
                undoToast('Removed ' + name);
            });
            rm.classList.add('dbe-ctx-item--first');
            ul.appendChild(rm);
        }
        menu.appendChild(ul);
        inner.appendChild(menu);
        card.appendChild(inner);

        // Keyboard: arrows move, Escape closes and returns focus to the chip.
        card.addEventListener('keydown', function (ev) {
            var items = [].slice.call(card.querySelectorAll('li'));
            var idx = items.indexOf(document.activeElement);
            if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
                ev.preventDefault();
                ev.stopPropagation();
                items[(idx + (ev.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
            } else if (ev.key === 'Escape') {
                ev.preventDefault();
                ev.stopPropagation();
                closeChipMenu();
                try { chipLi.focus(); } catch (e) {}
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

    /* Chips are plain li>span with no focus support; tabindex lets keyboard
       users reach them and open the copy menu with Shift+F10 / the Menu key. */
    function decorateClassChips() {
        document.querySelectorAll('.uniModuleCssClassesSelect__list li').forEach(function (li) {
            if (li.dbeChipDecorated) { return; }
            li.dbeChipDecorated = true;
            li.tabIndex = 0;
        });
    }

    function bindChipMenu() {
        document.addEventListener('contextmenu', function (e) {
            var li = e.target.closest && e.target.closest('.uniModuleCssClassesSelect__list li');
            if (!li) { return; }
            e.preventDefault();
            e.stopPropagation();
            openChipMenu(li, e.clientX || li.getBoundingClientRect().right, e.clientY || li.getBoundingClientRect().top);
        }, true);
        ['pointerdown', 'wheel'].forEach(function (t) {
            document.addEventListener(t, function (e) {
                if (dbeChipMenu && !(e.target.closest && e.target.closest('.dbe-chip-menu'))) { closeChipMenu(); }
            }, true);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && dbeChipMenu && !e.target.closest('.dbe-chip-menu')) {
                e.stopPropagation();
                closeChipMenu();
            }
        }, true);
    }

    /* Scope guard (scope_guard). Builderius' Styles code editor shows a
       selector's existing rules whichever scope is active — the Global/
       Template toggle only routes where edits are SAVED, so a template rule
       viewed under Global gets silently forked into global CSS by an edit.
       PHP supplies both scopes' SAVED stylesheets (from the builderius_dsm
       posts) in CFG.scopeGuard.css; this indexes the class tokens per scope
       and warns (or auto-switches, per the sub-setting) when the selected
       selector's rules live in the other scope. Saved state only: the index
       re-fetches after each Save. */
    var dbeScopeCss = (CFG.scopeGuard && CFG.scopeGuard.css) || null;
    var dbeScopeIndex = null;
    var dbeScopeAutoLast = ''; // last selector auto-switched for (stops re-flips)

    /* Class tokens used by any rule selector in a stylesheet. Membership is
       all the guard needs, so this is a brace-walk, not a CSS parser: text
       between the previous rule boundary and an opening brace is a selector
       (unless it starts an at-rule), and every .class token in it counts. */
    function dbeClassTokens(cssText) {
        if (typeof cssText !== 'string') { return null; } // scope unknown
        var set = {};
        var txt = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
        var buf = '';
        for (var i = 0; i < txt.length; i++) {
            var c = txt.charAt(i);
            if (c === '{') {
                var sel = buf.trim();
                if (sel && sel.charAt(0) !== '@') {
                    var toks = sel.match(/\.[A-Za-z0-9_-]+/g);
                    if (toks) { toks.forEach(function (t) { set[t] = true; }); }
                }
                buf = '';
            } else if (c === '}' || c === ';') {
                buf = '';
            } else {
                buf += c;
            }
        }
        return set;
    }

    function rebuildScopeIndex() {
        dbeScopeIndex = dbeScopeCss ? {
            template: dbeClassTokens(dbeScopeCss.template),
            global: dbeClassTokens(dbeScopeCss.global)
        } : null;
    }

    /* Where the selected class's saved rules live. Null when either scope's
       stylesheet could not be resolved — the guard stays quiet rather than
       warn from half the picture. */
    function dbeScopeOwnership(selector) {
        if (!dbeScopeIndex || !dbeScopeIndex.template || !dbeScopeIndex.global) { return null; }
        return {
            template: !!dbeScopeIndex.template[selector],
            global: !!dbeScopeIndex.global[selector]
        };
    }

    function refetchScopeCss() {
        var sg = CFG.scopeGuard || {};
        if (!sg.restUrl || !window.fetch) { return; }
        var url = sg.restUrl + (sg.restUrl.indexOf('?') === -1 ? '?' : '&') +
            'template=' + encodeURIComponent(sg.templateSlug || '');
        fetch(url, { headers: { 'X-WP-Nonce': sg.restNonce || '' }, credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                if (data && typeof data === 'object') {
                    dbeScopeCss = data;
                    rebuildScopeIndex();
                    schedule();
                }
            })
            .catch(function () {});
    }

    function bindScopeGuardRefresh() {
        document.addEventListener('click', function (e) {
            if (e.target.closest && e.target.closest('.uniTopPanel .uniPanelButtonPrimary')) {
                setTimeout(refetchScopeCss, 2000); // let the save round-trip land
            }
        }, true);
    }

    function ensureScopeGuard() {
        var lp = document.querySelector('.uniLeftPanel');
        var existing = lp && lp.querySelector('.dbe-scope-guard');
        var remove = function () { if (existing) { existing.remove(); } };
        if (!lp) { return; }
        var picker = lp.querySelector('.uniSettingsPageModuleDataForEditorWrapper');
        if (!picker) { return remove(); }

        var sel = currentSelectorName(lp);
        if (!sel || sel.charAt(0) !== '.') { return remove(); } // %local% / none: unambiguous

        var active = scopeStoreValue();
        active = active === null ? dbeScope : (active ? 'global' : 'template');
        var own = dbeScopeOwnership(sel);
        // Warn only on the clear-cut case: the active scope has NO saved
        // rules for this class while the other scope does.
        var owner = null;
        if (own) {
            if (active === 'global' && !own.global && own.template) { owner = 'template'; }
            else if (active === 'template' && !own.template && own.global) { owner = 'global'; }
        }
        if (!owner) { dbeScopeAutoLast = ''; return remove(); }

        var mode = (CFG.scopeGuard && CFG.scopeGuard.mode) || 'warn';
        if (mode === 'auto' && dbeScopeAutoLast !== sel) {
            // Flip once per selector; if the user flips back we respect it.
            dbeScopeAutoLast = sel;
            remove();
            try { setScope(owner); undoToast('Scope switched to ' + owner + ' — it owns the ' + sel + ' rules'); } catch (e) {}
            return;
        }

        var ownerLabel = owner.charAt(0).toUpperCase() + owner.slice(1);
        var activeLabel = active.charAt(0).toUpperCase() + active.slice(1);
        var guard = existing;
        if (!guard) {
            guard = document.createElement('div');
            guard.className = 'dbe-scope-guard';
            guard.setAttribute('role', 'status');
            var msg = document.createElement('span');
            msg.className = 'dbe-scope-guard__msg';
            guard.appendChild(msg);
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dbe-scope-guard__switch';
            btn.addEventListener('click', function () {
                var target = guard.getAttribute('data-dbe-owner');
                if (target) { try { setScope(target); } catch (e) {} }
            });
            guard.appendChild(btn);
            var bar = lp.querySelector('.dbe-scope-bar');
            var anchor = bar || picker;
            if (anchor.nextSibling) { anchor.parentNode.insertBefore(guard, anchor.nextSibling); }
            else { anchor.parentNode.appendChild(guard); }
        }
        guard.setAttribute('data-dbe-owner', owner);
        guard.querySelector('.dbe-scope-guard__msg').innerHTML = '';
        var code = document.createElement('code');
        code.textContent = sel;
        var msgEl = guard.querySelector('.dbe-scope-guard__msg');
        msgEl.appendChild(code);
        msgEl.appendChild(document.createTextNode(
            ' rules are stored in ' + ownerLabel + ' — edits here save to ' + activeLabel + '.'
        ));
        guard.querySelector('.dbe-scope-guard__switch').textContent = 'Switch to ' + ownerLabel;
    }

    /* Which feature groups need which wiring. */
    var NEED_TREE = on('tag_badges') || on('icon_declutter') || on('tree_row_styling') || on('multi_select');
    var NEED_NAV_BUTTONS = on('collapse_expand_all');
    var NEED_LEFT_PANEL = on('css_code_default') || on('scope_bar') || on('scope_guard') || on('context_menu');
    var NEED_CTX_MENU = on('context_menu') || on('wrap_in') || on('inline_rename') || on('multi_select') || on('collapse_expand_all') || on('auto_bem');

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
        if (renameState) { return; }
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
                try { ensureExpandButton(); } catch (e) {}
            }
            if (on('scope_bar')) {
                try { readScopeFromControl(); } catch (e) {}
                try { ensureScopeBar(); } catch (e) {}
            }
            if (on('scope_guard')) { try { ensureScopeGuard(); } catch (e) {} }
            if (on('context_menu')) { try { decorateClassChips(); } catch (e) {} }
            if (on('theme_switcher')) {
                try { ensureThemeButton(); } catch (e) {}
                try { applyMonacoTheme(); } catch (e) {}
            }
            if (on('density_toggle')) { try { ensureDensityButton(); } catch (e) {} }
            if (on('tree_search')) {
                try { ensureTreeSearch(); } catch (e) {}
                try { applyTreeFilter(); } catch (e) {}
            }
            if (on('save_state_cue')) { try { ensureSaveCue(); } catch (e) {} }
            if (on('preview_resize')) { try { ensurePreviewHandles(); } catch (e) {} }
            if (on('favourites_reorder')) {
                try { ensureFavouritesReorder(); } catch (e) {}
                try { applyFavouritesOrder(); } catch (e) {}
            }
        });
    }

    function boot() {
        var panel = document.querySelector('.uniRightPanel');
        if (!panel) { return void setTimeout(boot, 500); }
        schedule();

        // Navigator (right panel) observer — tree decoration, header buttons,
        // multi-select paint, the scope-control cache, the search filter and
        // the tooltip labels that live in its header. Tree mutations are also
        // the cheapest signal that a module operation happened, which is what
        // the save cue keys off.
        if (NEED_TREE || NEED_NAV_BUTTONS || on('tooltips') || on('scope_bar') || on('tree_search') || on('save_state_cue') || on('favourites_reorder')) {
            new MutationObserver(schedule).observe(panel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
        }

        // Also watch the settings panel area (left) so the CSS-code default and
        // the widen button react to element selection, tab switches, and the
        // CSS-mode toggle. .uniMainPanel is a stable parent of both panels (and
        // of the canvas wrappers the preview handles live in); the rAF debounce
        // in schedule() coalesces the busier stream of mutations.
        if (NEED_LEFT_PANEL || on('tooltips') || on('preview_resize')) {
            var main = document.querySelector('.uniMainPanel') || panel.parentElement;
            if (main) {
                new MutationObserver(schedule).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
            }
        }

        // Top bar too — breakpoint buttons and the breakpoints modal mount
        // there; labelChromeIcons(), the theme/density buttons and the save
        // cue must reach it when it re-renders.
        if (on('tooltips') || on('theme_switcher') || on('density_toggle') || on('save_state_cue')) {
            var top = document.querySelector('.uniTopPanel');
            if (top) {
                new MutationObserver(schedule).observe(top, { childList: true, subtree: true });
            }
        }
        if (on('tooltips')) { bindTooltips(); }

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

        // Scope guard: index the per-scope stylesheets and track saves.
        if (on('scope_guard')) {
            rebuildScopeIndex();
            bindScopeGuardRefresh();
        }

        // Copy menu on the Styles editor's class chips.
        if (on('context_menu')) { bindChipMenu(); }

        // Multi-select (Cmd/Ctrl+click, Shift+click) in the Navigator tree —
        // temporarily withdrawn (the multi-row drag never reliably carried the
        // whole selection). The 'multi_select' registry entry is removed, so
        // on('multi_select') is always false; bindMultiSelect / bindMultiDrag
        // stay parked below for when the drag is fixed.
        if (on('multi_select')) { bindMultiSelect(); bindMultiDrag(); }

        // Undo/redo last delete (Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z).
        if (on('undo_delete')) {
            hookDeleteCapture();
            bindUndoKeys();
        }

        // Keyboard shortcuts overlay (?).
        if (on('shortcuts_overlay')) { bindShortcutsKey(); }

        // Double-click a Navigator row to rename it inline.
        if (on('dblclick_rename')) { bindDblclickRename(); }

        // Follow the preview selection: expand + scroll the active row into view.
        if (on('reveal_selected')) { bindRevealActive(); }
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
