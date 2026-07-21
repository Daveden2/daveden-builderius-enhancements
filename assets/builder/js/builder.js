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
    /* Editing-domain entry points are assigned by chunks/editing.js before the
       controller registry boots. Wrappers passed to earlier chunks resolve these
       late-bound functions only when an interaction actually runs. */
    var storeMoveModule = function () { return false; };
    var undoToast = function () {};
    var renameActive = function () { return false; };
    var moveSibling = function () {};
    var indentElement = function () {};
    var outdentElement = function () {};
    var selectParentOf = function () {};
    var startRename = function () {};
    var defaultLabelFor = function () { return ''; };
    var commitRename = function () {};
    var wrap = function () {};
    var unwrap = function () {};
    var bemClassable = function () { return false; };
    var openAutoBemDialog = function () {};
    var dbeIndentTarget = function () { return null; };
    var dbeCanOutdent = function () { return false; };
    var dbeHtmlEditable = function () { return false; };
    var openEditHtmlDialog = function () {};
    var openImportHtmlDialog = function () {};
    var DBE_HTML_MODULES = {};
    var DBE_TAG_CHOICES = [];
    var dbeChangeTagEligible = function () { return false; };
    var dbeChangeTag = function () {};
    var dbeCleanTagInput = function (value) { return value; };
    var dbeInsertSection = function () {};
    var dbeInsertSibling = function () {};
    var dbeElementModule = function () { return null; };
    var dbeDecodeEntities = function (value) { return value; };
    var dbeAttrBlocked = function () { return false; };
    var dbeUpdateModuleSettings = function () { return false; };
    var dbeAddClasses = function () { return false; };
    var dbeEmmetParse = function () { return null; };
    var dbeEmmetStructureError = function () { return null; };
    var dbeEmmetInsert = function () { return false; };
    var dbeMoveLocation = function () { return null; };
    var moduleClasses = function () { return []; };
    var bemModuleTag = function () { return ''; };
    var dbeHasUnsavedChanges = function () { return false; };
    var dbePresenceDirtyChanged = function () {};

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



    /* Which feature groups need which wiring. */
    var NEED_TREE = on('tag_badges') || on('icon_declutter') || on('tree_row_styling') || on('multi_select');
    var NEED_NAV_BUTTONS = on('collapse_expand_all');
    var NEED_STYLES = on('css_code_default') || on('scope_bar') || on('style_inspector') ||
        on('css_hint_dialog') || on('hide_minimap');
    var NEED_CTX_MENU = on('context_menu') || on('style_inspector') || on('wrap_in') || on('inline_rename') || on('multi_select') || on('collapse_expand_all') || on('auto_bem') || on('element_moves') || on('keyboard_shortcuts') || on('edit_as_html') || on('import_html') || on('tag_change');

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
                moveModule: function () { return storeMoveModule.apply(null, arguments); }
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
                renameActive: function () { return renameActive(); }
            }),
            navigator: Object.freeze({
                moveSibling: function () { return moveSibling.apply(null, arguments); },
                indent: function () { return indentElement.apply(null, arguments); },
                outdent: function () { return outdentElement.apply(null, arguments); },
                scrollIntoView: function (row) { return scrollRowIntoTree(row); }
            }),
            feedback: Object.freeze({
                undo: function () { return undoToast.apply(null, arguments); }
            }),
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


    var dbeEditingChunk = window.dbeBuilderChunks && window.dbeBuilderChunks.editing;
    if (typeof dbeEditingChunk === 'function') {
        dbeEditingChunk(Object.freeze({
            on: on, translate: dbeT, format: dbeFmt, plural: dbeTn,
            query: dbeQuery, selector: dbeSelector,
            builderius: Object.freeze({ store: store, modules: modules, activeId: activeId }),
            click: clickSeq, waitFor: waitFor, schedule: schedule,
            controllers: dbeControllers, observe: dbeObserveChrome,
            rememberOwnedAttributes: dbeRememberOwnedAttributes,
            restoreOwnedAttributes: dbeRestoreOwnedAttributes,
            bindOwnedEvent: dbeBindOwnedEvent, bindOwnedHook: dbeBindOwnedHook,
            destroyOwnedHooks: dbeDestroyOwnedHooks, setOwnedTimeout: dbeSetOwnedTimeout,
            clearOwnedTimeout: dbeClearOwnedTimeout, setOwnedFrame: dbeSetOwnedFrame,
            destroyOwnedActivity: dbeDestroyOwnedActivity,
            platform: Object.freeze({ isMac: dbeIsMac }),
            multiSelection: Object.freeze({ clear: clearMultiSel }),
            navigator: Object.freeze({ rowById: navRowById, select: navSelect }),
            context: Object.freeze({ getTarget: function () { return lastCtxId; } }),
            commands: Object.freeze({
                driveContextMenuItem: function () { return driveContextMenuItem.apply(null, arguments); },
                expandNavigatorSubtree: function () { return expandSubtree.apply(null, arguments); }
            }),
            presenceDirtyChanged: function (dirty) { return dbePresenceDirtyChanged(dirty); },
            setEditingApi: function (api) {
                storeMoveModule = api.storeMoveModule;
                undoToast = api.undoToast;
                renameActive = api.renameActive;
                moveSibling = api.moveSibling;
                indentElement = api.indent;
                outdentElement = api.outdent;
                selectParentOf = api.selectParent;
                startRename = api.startRename;
                defaultLabelFor = api.defaultLabel;
                commitRename = api.commitRename;
                wrap = api.wrap;
                unwrap = api.unwrap;
                bemClassable = api.bemClassable;
                openAutoBemDialog = api.openAutoBem;
                dbeIndentTarget = api.indentTarget;
                dbeCanOutdent = api.canOutdent;
                dbeHtmlEditable = api.htmlEditable;
                openEditHtmlDialog = api.openEditHtml;
                openImportHtmlDialog = api.openImportHtml;
                DBE_HTML_MODULES = api.htmlModules;
                DBE_TAG_CHOICES = api.tagChoices;
                dbeChangeTagEligible = api.changeTagEligible;
                dbeChangeTag = api.changeTag;
                dbeCleanTagInput = api.cleanTagInput;
                dbeInsertSection = api.insertSection;
                dbeInsertSibling = api.insertSibling;
                dbeElementModule = api.elementModule;
                dbeDecodeEntities = api.decodeEntities;
                dbeAttrBlocked = api.attributeBlocked;
                dbeUpdateModuleSettings = api.updateModuleSettings;
                dbeAddClasses = api.addClasses;
                dbeEmmetParse = api.emmetParse;
                dbeEmmetStructureError = api.emmetStructureError;
                dbeEmmetInsert = api.emmetInsert;
                dbeMoveLocation = api.moveLocation;
                moduleClasses = api.moduleClasses;
                bemModuleTag = api.moduleTag;
                dbeHasUnsavedChanges = api.hasUnsavedChanges;
            }
        }));
    } else {
        document.documentElement.dataset.dbeChunkError = 'editing:missing';
        if (window.console && console.error) {
            console.error('[DBE] Editing chunk failed to load; editing enhancements were not started.');
        }
    }
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
