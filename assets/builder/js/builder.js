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
    /* Styles-domain entry points are assigned after the commands chunk has
       registered. Command wrappers resolve them only when an action runs. */
    var dbeStyleActionItems = function () { return []; };
    var openStyleInspector = function () {};
    var dbeOpenStyleEditor = function () {};
    var entityScopeLabel = function () { return ''; };
    var dbePresenceDirtyChanged = function () {};
    var dbeRegisterTerminalIntegration = function () {};
    var dbeRegisterPresenceIntegration = function () {};

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
        document.querySelectorAll('.uniTopPanel__rightCol :is(.uniPanelButton, .uniPanelIconButton)').forEach(function (b) {
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

    /* Shared polling primitive. Timers keep progressing while View Transition
       callbacks suppress animation frames; controller-owned calls still use
       the host lifecycle so teardown can cancel them. */
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

    /* Which feature groups need which wiring. */
    var NEED_TREE = on('tag_badges') || on('icon_declutter') || on('tree_row_styling') || on('multi_select');
    var NEED_NAV_BUTTONS = on('collapse_expand_all');
    var NEED_STYLES = on('css_code_default') || on('scope_bar') || on('style_inspector') ||
        on('css_hint_dialog') || on('hide_minimap');
    var NEED_CTX_MENU = on('preview_context_menu') || on('context_menu') || on('style_inspector') || on('wrap_in') || on('inline_rename') || on('multi_select') || on('collapse_expand_all') || on('auto_bem') || on('element_moves') || on('keyboard_shortcuts') || on('edit_as_html') || on('import_html') || on('tag_change');

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

    var dbeIntegrationsChunk = window.dbeBuilderChunks && window.dbeBuilderChunks.integrations;
    if (typeof dbeIntegrationsChunk === 'function') {
        dbeIntegrationsChunk(Object.freeze({
            on: on,
            config: CFG,
            translate: dbeT,
            query: dbeQuery,
            controllers: dbeControllers,
            observe: dbeObserveChrome,
            observeFooter: dbeObserveFooter,
            unobserveFooter: dbeUnobserveFooter,
            ensureGroup: function () { return dbeEnsureGroup.apply(null, arguments); },
            rememberOwnedAttributes: dbeRememberOwnedAttributes,
            bindOwnedEvent: dbeBindOwnedEvent,
            unbindOwnedEvent: dbeUnbindOwnedEvent,
            setOwnedTimeout: dbeSetOwnedTimeout,
            setOwnedInterval: dbeSetOwnedInterval,
            destroyOwnedActivity: dbeDestroyOwnedActivity,
            destroyOwnedGroups: dbeDestroyOwnedGroups,
            editing: Object.freeze({
                hasUnsavedChanges: function () { return dbeHasUnsavedChanges(); }
            }),
            setIntegrationsApi: function (api) {
                dbeRegisterTerminalIntegration = api.registerTerminal;
                dbeRegisterPresenceIntegration = api.registerPresence;
                dbePresenceDirtyChanged = api.presenceDirtyChanged;
            }
        }));
    } else {
        document.documentElement.dataset.dbeChunkError = 'integrations:missing';
        if (window.console && console.error) {
            console.error('[DBE] Integrations chunk failed to load; terminal and presence enhancements were not started.');
        }
    }
    dbeRegisterTerminalIntegration();


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

    var dbeShortcutsApi = Object.freeze({
        ensure: function () {},
        open: function () {},
        bind: function () {}
    });
    var dbeShortcutsChunk = window.dbeBuilderChunks && window.dbeBuilderChunks.shortcuts;
    if (typeof dbeShortcutsChunk === 'function') {
        dbeShortcutsChunk(Object.freeze({
            on: on,
            translate: dbeT,
            config: CFG,
            click: clickSeq,
            waitFor: waitFor,
            accelerator: dbeAccel,
            bindOwnedEvent: dbeBindOwnedEvent,
            setOwnedTimeout: dbeSetOwnedTimeout,
            renameActive: renameActive,
            setShortcutsApi: function (api) { dbeShortcutsApi = api; }
        }));
    } else {
        document.documentElement.dataset.dbeChunkError = 'shortcuts:missing';
        if (window.console && console.error) {
            console.error('[DBE] Shortcuts chunk failed to load; shortcut discovery was not started.');
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
                actionItems: function () { return dbeStyleActionItems.apply(null, arguments); },
                openInspector: function () { return openStyleInspector.apply(null, arguments); },
                openEditor: function () { return dbeOpenStyleEditor.apply(null, arguments); },
                moduleClasses: function () { return moduleClasses.apply(null, arguments); },
                entityScopeLabel: function () { return entityScopeLabel.apply(null, arguments); }
            }),
            workspace: Object.freeze({
                focusArea: dbeFocusArea,
                compactActive: dbeCompactActive,
                toggleSidePanels: dbeToggleSidePanels,
                setPanelVisibility: dbeSetPanelVisibility,
                panelWrappers: dbePanelWrappers,
                panelSideHidden: dbePanelSideHidden
            }),
            shortcuts: dbeShortcutsApi,
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

    var dbeStylesChunk = window.dbeBuilderChunks && window.dbeBuilderChunks.styles;
    if (typeof dbeStylesChunk === 'function') {
        dbeStylesChunk(Object.freeze({
            on: on, translate: dbeT, format: dbeFmt, query: dbeQuery,
            builderius: Object.freeze({ store: store, modules: modules, activeId: activeId }),
            click: clickSeq, waitFor: waitFor, schedule: schedule,
            controllers: dbeControllers, observe: dbeObserveChrome,
            setOwnedTimeout: dbeSetOwnedTimeout, setOwnedFrame: dbeSetOwnedFrame,
            destroyOwnedActivity: dbeDestroyOwnedActivity,
            editing: Object.freeze({ moduleClasses: moduleClasses, moduleTag: bemModuleTag }),
            commands: Object.freeze({ makeContextItem: makeCtxItem, closeSelectedClass: driveSelectedClose }),
            needStyles: NEED_STYLES,
            setStylesApi: function (api) {
                dbeStyleActionItems = api.actionItems;
                openStyleInspector = api.openInspector;
                dbeOpenStyleEditor = api.openEditor;
                entityScopeLabel = api.entityScopeLabel;
            }
        }));
    } else {
        document.documentElement.dataset.dbeChunkError = 'styles:missing';
        if (window.console && console.error) {
            console.error('[DBE] Styles chunk failed to load; CSS editing enhancements were not started.');
        }
    }

    dbeRegisterPresenceIntegration();

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
