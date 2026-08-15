(function () {
    'use strict';

    /* APG composite controllers register after builder.js supplies the shared
       lifecycle, Builderius adapter and mutation-router services. */
    var chunks = window.dbeBuilderChunks || {};

    chunks.a11yComposites = function (host) {
        var on = host.on;
        var dbeT = host.translate;
        var dbeFmt = host.format;
        var dbeTn = host.plural;
        var dbeQuery = host.query;
        var dbeQueryAll = host.builderius.queryAll;
        var dbeNavigatorRow = host.builderius.navigatorRow;
        var modules = host.builderius.modules;
        var activeId = host.builderius.activeId;
        var store = host.builderius.store;
        var storeMoveModule = host.builderius.moveModule;
        var dbeBreakpoints = host.breakpoints;
        var DBE_BP_LABELS = host.breakpointLabels;
        var clickSeq = host.click;
        var waitFor = host.waitFor;
        var schedule = host.schedule;
        var dbeControllers = host.controllers;
        var dbeObserveChrome = host.observe;
        var dbeObserveFooter = host.observeFooter;
        var dbeUnobserveFooter = host.unobserveFooter;
        var dbePruneGroupState = host.pruneGroupState;
        var dbeRememberOwnedAttributes = host.rememberOwnedAttributes;
        var dbeBindOwnedEvent = host.bindOwnedEvent;
        var dbeSetOwnedTimeout = host.setOwnedTimeout;
        var dbeSetOwnedFrame = host.setOwnedFrame;
        var dbeDestroyOwnedActivity = host.destroyOwnedActivity;
        var dbeDestroyOwnedGroups = host.destroyOwnedGroups;
        var dbeMultiSel = host.multiSelection.state;
        var dbeIsMac = host.multiSelection.isMac;
        var clearMultiSel = host.multiSelection.clear;
        var domRowIds = host.multiSelection.rowIds;
        var toggleMultiSel = host.multiSelection.toggle;
        var rangeMultiSel = host.multiSelection.range;
        var renameActive = host.multiSelection.renameActive;
        var moveSibling = host.navigator.moveSibling;
        var indentElement = host.navigator.indent;
        var outdentElement = host.navigator.outdent;
        var scrollRowIntoTree = host.navigator.scrollIntoView;
        var undoToast = host.feedback.undo;
        var NEED_TREE = host.needTree;
        var KEEP_ICON = /Collection|Template/i;
        var DBE_FOOTER_SCOPE_PANEL_ID = 'dbe-footer-scope-panel';


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
                return el.offsetParent !== null
                    && !el.disabled
                    && el.getAttribute('aria-disabled') !== 'true'; // visible + enabled
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
            dbePruneGroupState();
            opts = opts || {};
            var owner = opts.owner || '';
            var role = opts.role || 'toolbar';
            // APG: a horizontal tablist or toolbar navigates with Left/Right only —
            // Up/Down belong to a vertical orientation and must pass through. A radio
            // group navigates with both axes (Right/Down next, Left/Up previous).
            // Default from the role; override with opts.orientation.
            var orientation = opts.orientation || (role === 'radiogroup' ? 'both' : 'horizontal');
            var useHoriz = orientation !== 'vertical';
            var useVert = orientation === 'vertical' || orientation === 'both';
            dbeRememberOwnedAttributes(owner, container, ['role', 'aria-label', 'aria-orientation']);
            if (container.getAttribute('role') !== role) { container.setAttribute('role', role); }
            if (label && container.getAttribute('aria-label') !== label) { container.setAttribute('aria-label', label); }
            // A vertical group announces its orientation; horizontal is the default.
            if (orientation === 'vertical' && container.getAttribute('aria-orientation') !== 'vertical') {
                container.setAttribute('aria-orientation', 'vertical');
            }
            var currentItems = dbeRovingItems(container, sel);
            currentItems.forEach(function (el) {
                var attributes = ['tabindex'];
                if (opts.itemRole) { attributes.push('role'); }
                if (opts.selectAttr) { attributes.push(opts.selectAttr); }
                dbeRememberOwnedAttributes(owner, el, attributes);
            });
            if (opts.itemRole) {
                currentItems.forEach(function (el) {
                    if (el.getAttribute('role') !== opts.itemRole) { el.setAttribute('role', opts.itemRole); }
                });
            }
            dbeSyncRoving(container, sel, opts);
            if (host.groupBindings().some(function (binding) { return binding.node === container; })) { return; }
            var binding = { node: container, owner: owner, handler: null, frame: 0 };
            binding.handler = function (e) {
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
                    binding.frame = requestAnimationFrame(function () {
                        binding.frame = 0;
                        var scope = container.isConnected ? container : document;
                        var again = dbeRovingItems(scope, sel);
                        var target = dbeGroupActive(again, opts.activeClass) || again[Math.min(next, again.length - 1)];
                        if (target && document.activeElement !== target) {
                            target.setAttribute('tabindex', '0');
                            target.focus();
                        }
                    });
                }
            };
            host.groupBindings().push(binding);
            container.addEventListener('keydown', binding.handler);
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

        /* Builderius exposes not-yet-available Inserter items as ordinary buttons
           with a lockedForPro class and a small visual SOON badge. Keep the visible
           element name first (Label in Name / voice matching), then explain the
           unavailable state. aria-disabled, rather than the native disabled
           attribute, lets assistive technology discover the item while tabindex=-1
           keeps it out of the category's roving keyboard sequence. The capture
           guard also prevents voice software or a scripted click from activating a
           control whose action cannot succeed. */
        function dbeSyncInserterAvailability(container, sel) {
            container.querySelectorAll(sel).forEach(function (btn) {
                dbeRememberOwnedAttributes('a11y/composites', btn, [
                    'aria-disabled', 'tabindex', 'aria-label', 'data-dbe-inserter-original-label',
                    'data-dbe-inserter-name', 'data-dbe-unavailable'
                ]);
                var unavailable = btn.classList.contains('lockedForPro') || btn.classList.contains('locked');
                if (!unavailable) {
                    if (btn.getAttribute('data-dbe-unavailable') === 'true') {
                        btn.removeAttribute('aria-disabled');
                        var original = btn.getAttribute('data-dbe-inserter-original-label');
                        if (original) { btn.setAttribute('aria-label', original); }
                        else { btn.removeAttribute('aria-label'); }
                        btn.removeAttribute('data-dbe-inserter-original-label');
                        btn.removeAttribute('data-dbe-inserter-name');
                        btn.removeAttribute('data-dbe-unavailable');
                    }
                    return;
                }

                var name = btn.getAttribute('data-dbe-inserter-name');
                if (!name) {
                    var title = btn.querySelector('.uniModItems__itemTitle');
                    name = ((title && title.textContent) || btn.textContent || '').trim().replace(/^SOON\s*/i, '').trim();
                    if (name) { btn.setAttribute('data-dbe-inserter-name', name); }
                }
                if (!btn.hasAttribute('data-dbe-inserter-original-label')) {
                    btn.setAttribute('data-dbe-inserter-original-label', btn.getAttribute('aria-label') || '');
                }
                btn.setAttribute('data-dbe-unavailable', 'true');
                btn.setAttribute('aria-disabled', 'true');
                btn.setAttribute('tabindex', '-1');
                if (name) {
                    var label = dbeFmt(dbeT('inserterComingSoon', '%s (coming soon)'), name);
                    if (btn.getAttribute('aria-label') !== label) { btn.setAttribute('aria-label', label); }
                }
            });

            dbeBindOwnedEvent('a11y/composites', container, 'inserter-unavailable', 'click', function (e) {
                var btn = e.target && e.target.closest ? e.target.closest(sel) : null;
                if (!btn || !container.contains(btn) || btn.getAttribute('aria-disabled') !== 'true') { return; }
                e.preventDefault();
                e.stopImmediatePropagation();
            }, true);
        }

        function ensureInserterKeyboard() {
            var sel = '.uniModItems__item';
            document.querySelectorAll('.uniModItems__catWrapper').forEach(function (cw) {
                var container = cw.querySelector('.uniModItems__items');
                if (!container) { return; }
                var titleEl = cw.querySelector('.uniCatTitle');
                var label = titleEl ? (titleEl.textContent || '').trim() : '';
                dbeRememberOwnedAttributes('a11y/composites', container, ['role', 'aria-label']);
                if (container.getAttribute('role') !== 'group') { container.setAttribute('role', 'group'); }
                if (label && container.getAttribute('aria-label') !== label) { container.setAttribute('aria-label', label); }
                dbeSyncInserterAvailability(container, sel);
                dbeRovingItems(container, sel).forEach(function (item) {
                    dbeRememberOwnedAttributes('a11y/composites', item, ['tabindex']);
                });
                dbeSyncRoving(container, sel);
                dbeBindOwnedEvent('a11y/composites', container, 'inserter-keys', 'keydown', function (e) {
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

        /* The compact favourites strip is a second element inserter. Its icon-only
           buttons otherwise create one Tab stop per favourite and their native names
           say only “Heading”, “Image”, and so on — a voice-control or screen-reader
           user is not told that activating one inserts an element. Treat the strip
           as a vertical toolbar: one Tab stop, Up/Down/Home/End navigation and an
           action-led name for every favourite. The individual Navigator tree-row
           names are deliberately untouched. */
        function ensureFavouritesKeyboard() {
            var list = document.querySelector('.uniModTree__favouritesList');
            if (!list) { return; }
            var favouriteSel = '.uniModTree__favouritesListItem .modIcon';
            var sel = '.dbe-fav-reorder-btn, ' + favouriteSel;
            list.querySelectorAll(':scope > li').forEach(function (li) {
                dbeRememberOwnedAttributes('a11y/composites', li, ['role']);
                if (li.getAttribute('role') !== 'presentation') { li.setAttribute('role', 'presentation'); }
            });
            list.querySelectorAll(favouriteSel).forEach(function (btn) {
                dbeRememberOwnedAttributes('a11y/composites', btn, [
                    'data-dbe-favourite-name', 'aria-label', 'data-dbe-tip'
                ]);
                var name = btn.getAttribute('data-dbe-favourite-name');
                if (!name) {
                    var item = btn.closest('.uniModTree__favouritesListItem');
                    var nativeTip = item && item.querySelector('[data-tooltip-content]');
                    name = ((nativeTip && nativeTip.getAttribute('data-tooltip-content'))
                        || btn.getAttribute('aria-label')
                        || btn.getAttribute('data-dbe-tip')
                        || btn.textContent
                        || '').trim();
                    name = name.replace(/^Insert\s+/i, '').trim();
                    if (name) { btn.setAttribute('data-dbe-favourite-name', name); }
                }
                if (!name) { return; }
                var label = dbeFmt(dbeT('insertFavourite', 'Insert %s'), name);
                if (btn.getAttribute('aria-label') !== label) { btn.setAttribute('aria-label', label); }
                if (on('tooltips') && btn.getAttribute('data-dbe-tip') !== label) {
                    btn.setAttribute('data-dbe-tip', label);
                }
            });
            dbeEnsureGroup(list, dbeT('favouriteElements', 'Favourite elements'), sel, {
                role: 'toolbar',
                orientation: 'vertical',
                owner: 'a11y/composites'
            });
        }

        /* (pt) Builder tabs (panel_tabs). The persistent template/component tabs
           above the canvas, the settings panel's Content / Styles strip and the
           Navigator's Elements / Selectors / CSS vars strip are rows of <button>s
           with no tab semantics: a screen reader cannot tell they are tabs or which
           is current, and there is no single-Tab-stop arrow-key model. Wire each
           strip as an APG tab list — role=tablist, each tab role=tab +
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
                dbeRememberOwnedAttributes('a11y/composites', strip, ['role', 'aria-label']);
                if (strip.getAttribute('role') !== 'tablist') { strip.setAttribute('role', 'tablist'); }
                if (strip.getAttribute('aria-label') !== label) { strip.setAttribute('aria-label', label); }
                dbeRovingItems(strip, sel).forEach(function (t) {
                    dbeRememberOwnedAttributes('a11y/composites', t, [
                        'role', 'aria-label', 'aria-selected', 'tabindex'
                    ]);
                    if (t.getAttribute('role') !== 'tab') { t.setAttribute('role', 'tab'); }
                    if (panelSel === '.uniRightPanel') {
                        var tabName = (t.textContent || '').trim();
                        var tabLabel = dbeFmt(dbeT('navigatorViewTab', 'Show %s in Navigator'), tabName);
                        if (tabName && t.getAttribute('aria-label') !== tabLabel) { t.setAttribute('aria-label', tabLabel); }
                    }
                    var on = t.classList.contains('active') ? 'true' : 'false';
                    if (t.getAttribute('aria-selected') !== on) { t.setAttribute('aria-selected', on); }
                });
                dbeSyncRoving(strip, sel, { activeClass: 'active' });
                dbeBindOwnedEvent('a11y/composites', strip, 'panel-tabs-keys', 'keydown', function (e) {
                    var focused = document.activeElement && document.activeElement.closest ? document.activeElement.closest(sel) : null;
                    if ((e.key === 'Enter' || e.key === ' ') && focused && strip.contains(focused)) {
                        // Builderius handles these tabs through its pointer sequence
                        // and ignores the click browsers synthesise for keyboard
                        // activation. Reuse that native path so Enter/Space match a
                        // pointer click without writing Builderius state directly.
                        e.preventDefault();
                        e.stopPropagation();
                        clickSeq(focused);
                        return;
                    }
                    // Horizontal tablist (APG): Left/Right move between tabs; Up/Down
                    // belong to a vertical tablist and are left to pass through.
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) { return; }
                    var items = dbeRovingItems(strip, sel);
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
                    // Move roving focus only; Enter/Space above activates explicitly.
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
                dbeBindOwnedEvent('a11y/composites', strip, 'panel-tabs-click', 'click', function (e) {
                    if (!e.target.closest(sel)) { return; }
                    dbeSetOwnedTimeout('a11y/composites', function () {
                        var ae = document.activeElement;
                        if (ae && ae !== document.body && !(ae.closest && ae.closest('.uniPanelTabs'))) { return; }
                        var live = document.querySelector(panelSel + ' .uniPanelTabs');
                        var active = live && live.querySelector(sel + '.active');
                        if (active) { active.focus(); }
                    }, 0);
                });
            });

            var canvasStrip = document.querySelector('.uniIframeTabs__wrapper');
            var canvasSel = '.uniIframeTabButton';
            if (canvasStrip && canvasStrip.querySelector(canvasSel)) {
                var canvasLabel = dbeT('canvasDocumentTabs', 'Open templates and components');
                dbeRememberOwnedAttributes('a11y/composites', canvasStrip, ['role', 'aria-label']);
                if (canvasStrip.getAttribute('role') !== 'tablist') { canvasStrip.setAttribute('role', 'tablist'); }
                if (canvasStrip.getAttribute('aria-label') !== canvasLabel) { canvasStrip.setAttribute('aria-label', canvasLabel); }
                dbeRovingItems(canvasStrip, canvasSel).forEach(function (tab) {
                    dbeRememberOwnedAttributes('a11y/composites', tab, [
                        'role', 'aria-selected', 'aria-keyshortcuts', 'tabindex'
                    ]);
                    if (tab.getAttribute('role') !== 'tab') { tab.setAttribute('role', 'tab'); }
                    var selected = tab.classList.contains('active') ? 'true' : 'false';
                    if (tab.getAttribute('aria-selected') !== selected) { tab.setAttribute('aria-selected', selected); }
                    if (tab.getAttribute('aria-keyshortcuts') !== 'Delete') { tab.setAttribute('aria-keyshortcuts', 'Delete'); }
                });
                dbeSyncRoving(canvasStrip, canvasSel, { activeClass: 'active' });
                dbeBindOwnedEvent('a11y/composites', canvasStrip, 'canvas-tabs-keys', 'keydown', function (e) {
                    var focused = document.activeElement && document.activeElement.closest
                        ? document.activeElement.closest(canvasSel)
                        : null;
                    if (!focused || !canvasStrip.contains(focused)) { return; }
                    var items = dbeRovingItems(canvasStrip, canvasSel);
                    var i = items.indexOf(focused);
                    if (i === -1 || !items.length) { return; }
                    if (e.key === 'Delete') {
                        var close = focused.querySelector('.uniIframeTabButton__closeIcon');
                        if (!close) { return; }
                        e.preventDefault();
                        e.stopPropagation();
                        clickSeq(close);
                        dbeSetOwnedTimeout('a11y/composites', function () {
                            var live = document.querySelector('.uniIframeTabs__wrapper');
                            var remaining = live ? dbeRovingItems(live, canvasSel) : [];
                            var target = remaining[Math.min(i, remaining.length - 1)]
                                || (live && live.querySelector(canvasSel + '.active'));
                            if (target) { target.focus(); }
                        }, 0);
                        return;
                    }
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        clickSeq(focused);
                        return;
                    }
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) { return; }
                    e.preventDefault();
                    e.stopPropagation();
                    var next = i;
                    if (e.key === 'ArrowRight') { next = (i + 1) % items.length; }
                    else if (e.key === 'ArrowLeft') { next = (i - 1 + items.length) % items.length; }
                    else if (e.key === 'Home') { next = 0; }
                    else if (e.key === 'End') { next = items.length - 1; }
                    items.forEach(function (item, k) { item.setAttribute('tabindex', k === next ? '0' : '-1'); });
                    items[next].focus();
                });
            }

            var canvasOpen = document.querySelector('.uniIframeTabs__navigatorBtn');
            if (canvasOpen) {
                var openLabel = dbeT('openCanvasDocument', 'Open a template or component');
                dbeRememberOwnedAttributes('a11y/composites', canvasOpen, ['aria-label', 'data-dbe-tip']);
                if (canvasOpen.getAttribute('aria-label') !== openLabel) { canvasOpen.setAttribute('aria-label', openLabel); }
                if (on('tooltips') && canvasOpen.getAttribute('data-dbe-tip') !== openLabel) {
                    canvasOpen.setAttribute('data-dbe-tip', openLabel);
                }
            }
        }

        /* (sa) Settings-group accordions (settings_accordions). The element
           settings panel's collapsible groups (Primary, Advanced, Attributes…) are
           mouse-only: each heading is a plain <div> at tabindex -1 with no role,
           no aria-expanded and no key handling, and a COLLAPSED group renders no
           field DOM at all — its settings do not exist in the document, so a
           keyboard or screen-reader user can never reach them. Worse, the
           collapsed state persists globally per group name, so "everything after
           the tag selector is unreachable" is a normal panel state. Wire each
           heading as an APG disclosure button: a real Tab stop (one per heading,
           like the block editor's panel headings — no roving needed for 2-3
           groups), role=button, aria-expanded mirrored from whether the group's
           items wrapper is mounted, and Enter/Space toggling through the
           builder's own click path (clickSeq — React owns the toggle, so a bare
           synthetic click does not fire it). The open group's body gets
           role=region + aria-labelledby so the fields announce which group they
           belong to. The toggle remounts the heading, so focus is re-asserted by
           group NAME after the re-render settles — the text is the only identity
           that survives. Scoped to the left panel: the Inserter and the context
           menu reuse .uniCatTitle but have their own keyboard features. */
        var dbeAccSeq = 0;
        function dbeAccName(head) {
            var span = head.querySelector('span');
            return ((span ? span.textContent : head.textContent) || '').trim();
        }
        function dbeAccRefocus(name) {
            // Two frames: the first re-render swaps the heading node, the group
            // body mounts on the next. Re-stamp the fresh nodes before focusing so
            // the landing heading already announces its new expanded state.
            dbeSetOwnedFrame('a11y/composites', function () {
                dbeSetOwnedFrame('a11y/composites', function () {
                if (!dbeCompositeControllerActive) { return; }
                try { ensureSettingsAccordions(); } catch (e) {}
                var heads = document.querySelectorAll('.uniLeftPanel .uniModCssCatWrapper__catTitle');
                for (var i = 0; i < heads.length; i++) {
                    if (dbeAccName(heads[i]) === name) { heads[i].focus(); return; }
                }
                });
            });
        }
        function ensureSettingsAccordions() {
            document.querySelectorAll('.uniLeftPanel .uniModCssCatWrapper').forEach(function (wrap) {
                var head = wrap.querySelector('.uniModCssCatWrapper__catTitle');
                if (!head) { return; }
                var items = wrap.querySelector('.uniModCssCatWrapper__items');
                dbeRememberOwnedAttributes('a11y/composites', head, [
                    'role', 'tabindex', 'aria-expanded', 'id', 'aria-controls'
                ]);
                if (head.getAttribute('role') !== 'button') { head.setAttribute('role', 'button'); }
                if (head.getAttribute('tabindex') !== '0') { head.setAttribute('tabindex', '0'); }
                var expanded = items ? 'true' : 'false';
                if (head.getAttribute('aria-expanded') !== expanded) { head.setAttribute('aria-expanded', expanded); }
                if (!head.id) { head.id = 'dbe-acc-head-' + (++dbeAccSeq); }
                if (items) {
                    dbeRememberOwnedAttributes('a11y/composites', items, ['id', 'role', 'aria-labelledby']);
                    if (!items.id) { items.id = 'dbe-acc-panel-' + (++dbeAccSeq); }
                    if (items.getAttribute('role') !== 'region') { items.setAttribute('role', 'region'); }
                    if (items.getAttribute('aria-labelledby') !== head.id) { items.setAttribute('aria-labelledby', head.id); }
                    if (head.getAttribute('aria-controls') !== items.id) { head.setAttribute('aria-controls', items.id); }
                } else if (head.hasAttribute('aria-controls')) {
                    // A collapsed group unmounts its body node entirely, so the
                    // reference would dangle — drop it until the body exists again.
                    head.removeAttribute('aria-controls');
                }
                dbeBindOwnedEvent('a11y/composites', head, 'settings-accordion-keys', 'keydown', function (e) {
                    if (e.key !== 'Enter' && e.key !== ' ') { return; }
                    e.preventDefault();
                    e.stopPropagation();
                    var name = dbeAccName(head);
                    clickSeq(head);
                    dbeAccRefocus(name);
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
                dbeRememberOwnedAttributes('a11y/composites', b, ['aria-label']);
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
                { role: 'radiogroup', itemRole: 'radio', selectAttr: 'aria-checked', selectOnMove: true, owner: 'a11y/composites' }
            );
            // Canvas width + zoom — a labelled group, not a roving toolbar (the fields
            // own their arrow keys). The fields themselves are labelled in DBE_TIPS.
            var canvas = document.querySelector('.uniGlobalBreakpoints__canvasControl');
            if (canvas) {
                dbeRememberOwnedAttributes('a11y/composites', canvas, ['role', 'aria-label']);
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
               open one) + aria-controls on the shared panel;
             - unavailable buttons = aria-disabled with “coming soon” in the name;
             - the shared panel = a labelled role="group", named after the open tool.
               A group, not a region: the panel is part of the footer, not a landmark
               of its own — chrome_landmarks marks the whole .uniFooterPanel as the
               footer's landmark, and a second nested landmark would only clutter the
               screen reader's region list. The name still announces on entry.
           The footer lives outside the main-panel root, so its narrow targets join
           the shared router lazily when the bar first appears. */

        function ensureFooterToolbar() {
            var bar = dbeQuery('footerBar');
            if (!bar) { return; }
            dbeObserveFooter(bar, 'a11y-composites-footer');
            var tools = [].slice.call(bar.querySelectorAll('button.uniPanelIconButton--footer'));
            if (!tools.length) { return; }

            var panel = document.querySelector('.uniFooterPanelContent');
            var panelId = 'dbe-footer-panel';
            if (panel) {
                dbeRememberOwnedAttributes('a11y/composites', panel, ['id', 'role', 'aria-label']);
                if (!panel.id) { panel.id = panelId; }
                if (panel.getAttribute('role') !== 'group') { panel.setAttribute('role', 'group'); }
            }
            // The panel has no open/closed class; visible content means open.
            var open = !!panel && panel.offsetHeight > 8;
            var activeTool = tools.filter(function (b) { return b.classList.contains('uniPanelIconButton--active'); })[0];

            tools.forEach(function (b) {
                dbeRememberOwnedAttributes('a11y/composites', b, [
                    'aria-disabled', 'tabindex', 'aria-expanded', 'aria-controls', 'aria-label', 'data-dbe-tip'
                ]);
                var base = (b.textContent || '').trim(); // aria-label never changes textContent
                if (b.classList.contains('locked')) {
                    b.setAttribute('aria-disabled', 'true');
                    b.setAttribute('tabindex', '-1');
                    b.removeAttribute('aria-expanded');
                    b.removeAttribute('aria-controls');
                    var want = dbeFmt(dbeT('footerComingSoon', '%s (coming soon)'), base);
                    if (b.getAttribute('aria-label') !== want) { b.setAttribute('aria-label', want); }
                    var tip = (b.getAttribute('data-dbe-tip') || '').trim();
                    if (/^Soon:\s*/i.test(tip)) {
                        tip = dbeFmt(
                            dbeT('footerComingSoonTip', 'Coming soon: %s'),
                            tip.replace(/^Soon:\s*/i, '')
                        );
                        if (b.getAttribute('data-dbe-tip') !== tip) { b.setAttribute('data-dbe-tip', tip); }
                    }
                } else {
                    b.removeAttribute('aria-disabled');
                    if (b.getAttribute('aria-label')) { b.removeAttribute('aria-label'); } // fall back to the text name
                    if (panel && b.getAttribute('aria-controls') !== panelId) { b.setAttribute('aria-controls', panelId); }
                    var expanded = (open && b === activeTool) ? 'true' : 'false';
                    if (b.getAttribute('aria-expanded') !== expanded) { b.setAttribute('aria-expanded', expanded); }
                }
            });

            if (panel) {
                var rl = (open && activeTool)
                    ? dbeFmt(dbeT('footerPanelNamed', '%s panel'), (activeTool.textContent || '').trim())
                    : dbeT('footerToolsPanel', 'Editor tools panel');
                if (panel.getAttribute('aria-label') !== rl) { panel.setAttribute('aria-label', rl); }
            }

            // Toolbar semantics + roving arrow navigation over available tools. The
            // unavailable items remain visibly labelled “coming soon”, but do not
            // consume the toolbar's single Tab stop or arrow-key sequence.
            dbeEnsureGroup(bar, dbeT('toolbarFooterTools', 'Editor tools'), 'button.uniPanelIconButton--footer', {
                owner: 'a11y/composites'
            });

            dbeEnsureFooterScopeTabs();
            dbeEnsurePanelFieldLabels();
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
                dbeRememberOwnedAttributes('a11y/composites', content, ['id', 'role', 'tabindex', 'aria-labelledby']);
                if (!content.id) { content.id = DBE_FOOTER_SCOPE_PANEL_ID; }
                if (content.getAttribute('role') !== 'tabpanel') { content.setAttribute('role', 'tabpanel'); }
                if (content.getAttribute('tabindex') !== '0') { content.setAttribute('tabindex', '0'); }
            }
            var active = null;
            [].slice.call(scope.querySelectorAll('button')).forEach(function (t, i) {
                dbeRememberOwnedAttributes('a11y/composites', t, ['id', 'aria-controls']);
                if (!t.id) { t.id = 'dbe-footer-scope-tab-' + i; }
                if (content && t.getAttribute('aria-controls') !== content.id) { t.setAttribute('aria-controls', content.id); }
                if (t.classList.contains('active')) { active = t; }
            });
            if (content && active && content.getAttribute('aria-labelledby') !== active.id) {
                content.setAttribute('aria-labelledby', active.id);
            }
            dbeEnsureGroup(scope, dbeT('footerScopeTabs', 'Scope'), 'button', {
                role: 'tablist', itemRole: 'tab', selectAttr: 'aria-selected',
                orientation: 'vertical', activeClass: 'active', owner: 'a11y/composites'
            });
            // Switching scope toggles the `active` class deep inside the footer panel,
            // which the shallow footer observer misses; watch it here so aria-selected
            // and the panel's aria-labelledby follow the switch.
            dbeObserveChrome('a11y-composites-footer-scope-tabs', scope, { attributes: true, subtree: true, attributeFilter: ['class'] });
        }

        /* (tf3) Field labels in the snippet/variable configure panel. Every plain
           .uniPanelField renders its <label class="uniPanelField__label"> as a
           SIBLING of the control with no for/id pair — the Enabled switch, Title,
           Description and Priority fields all announce as unnamed controls
           (1.3.1 / 4.1.2), and clicking a label does nothing. Wire for/id (native
           association — no ARIA needed); radio fields already wrap each option in
           its own <label>, so there the caption instead names the option group
           (role=radiogroup + aria-labelledby — the one place ARIA is required,
           since HTML's fieldset/legend cannot be retrofitted onto React's DOM).
           React re-creates these nodes on state changes (toggling the switch
           re-renders the field), which drops our ids — the configure-panel
           observer below re-runs this pass, and ids are only (re)assigned when
           missing, so the wiring self-heals. */
        var dbePanelFieldSeq = 0;
        function dbeEnsurePanelFieldLabels() {
            [].slice.call(document.querySelectorAll('.uniPanelField')).forEach(function (field) {
                var label = field.querySelector('.uniPanelField__label');
                if (!label) { return; }
                var group = field.querySelector('.uniPanelField__radioGroup');
                if (group) {
                    dbeRememberOwnedAttributes('a11y/composites', label, ['id']);
                    dbeRememberOwnedAttributes('a11y/composites', group, ['role', 'aria-labelledby']);
                    if (!label.id) { label.id = 'dbe-panel-field-label-' + (++dbePanelFieldSeq); }
                    if (group.getAttribute('role') !== 'radiogroup') { group.setAttribute('role', 'radiogroup'); }
                    if (group.getAttribute('aria-labelledby') !== label.id) { group.setAttribute('aria-labelledby', label.id); }
                    return;
                }
                var control = field.querySelector('input, textarea, select');
                // Controls inside their own wrapping <label> are already named.
                if (!control || control.closest('label')) { return; }
                dbeRememberOwnedAttributes('a11y/composites', control, ['id']);
                dbeRememberOwnedAttributes('a11y/composites', label, ['for']);
                if (!control.id) { control.id = 'dbe-panel-field-' + (++dbePanelFieldSeq); }
                if (label.getAttribute('for') !== control.id) { label.setAttribute('for', control.id); }
            });
            // The configure panel mounts on demand (list menu -> Configure) as a
            // child of the scope content, outside every observer above — and its
            // fields re-render on edit. Watch it while it exists; node-tracked so
            // a React-replaced panel is re-observed, and childList-only so our own
            // attribute writes never retrigger the pass.
            var cfg = document.querySelector('.uniTabDataVars__configurePanel');
            if (cfg) { dbeObserveChrome('a11y-composites-footer-config-panel', cfg, { childList: true, subtree: true }); }
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
            rows.forEach(function (el, k) {
                dbeRememberOwnedAttributes('a11y/composites', el, ['tabindex']);
                el.setAttribute('tabindex', k === idx ? '0' : '-1');
            });
            try { rows[idx].focus(); } catch (e) {}
        }

        function ensureBuilderiusMenu() {
            var trigger = dbeMenuTrigger();
            if (!trigger) { return; }
            var open = trigger.classList.contains('active');
            var list = open ? dbeMenuList() : null;

            // Disclosure semantics on the trigger.
            dbeRememberOwnedAttributes('a11y/composites', trigger, [
                'aria-haspopup', 'aria-expanded', 'aria-controls'
            ]);
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

            dbeRememberOwnedAttributes('a11y/composites', list, ['id', 'role', 'aria-label']);
            if (list.getAttribute('role') !== 'tree') { list.setAttribute('role', 'tree'); }
            var label = dbeT('builderiusMenu', 'Builderius menu');
            if (list.getAttribute('aria-label') !== label) { list.setAttribute('aria-label', label); }

            // Category headings = level-1 expandable treeitems controlling their group.
            [].slice.call(list.querySelectorAll('.uniNavigatorItems__catWrapper')).forEach(function (cat, ci) {
                var title = cat.querySelector('.uniCatTitle');
                var wrap = cat.querySelector('.uniNavigatorItems__items');
                if (title) {
                    dbeRememberOwnedAttributes('a11y/composites', title, [
                        'role', 'aria-level', 'aria-hidden', 'aria-expanded',
                        'aria-controls', 'tabindex'
                    ]);
                    if (title.getAttribute('role') !== 'treeitem') { title.setAttribute('role', 'treeitem'); }
                    if (title.getAttribute('aria-level') !== '1') { title.setAttribute('aria-level', '1'); }
                    if (title.hasAttribute('aria-hidden')) { title.removeAttribute('aria-hidden'); }
                    var ex = dbeMenuCatExpanded(title) ? 'true' : 'false';
                    if (title.getAttribute('aria-expanded') !== ex) { title.setAttribute('aria-expanded', ex); }
                    if (wrap) {
                        dbeRememberOwnedAttributes('a11y/composites', wrap, ['id', 'role']);
                        if (!wrap.id) { wrap.id = 'dbe-menu-grp-' + ci; }
                        if (title.getAttribute('aria-controls') !== wrap.id) { title.setAttribute('aria-controls', wrap.id); }
                    }
                }
                if (wrap && wrap.getAttribute('role') !== 'group') { wrap.setAttribute('role', 'group'); }
            });
            // Items = level-2 treeitems.
            [].slice.call(list.querySelectorAll('.uniNavigatorItems__item')).forEach(function (b) {
                dbeRememberOwnedAttributes('a11y/composites', b, ['role', 'aria-level', 'tabindex']);
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
                dbeRememberOwnedAttributes('a11y/composites', el, ['tabindex']);
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
                dbeRememberOwnedAttributes('a11y/composites', sel, [
                    'role', 'aria-haspopup', 'aria-expanded', 'aria-controls',
                    'aria-activedescendant', 'aria-labelledby', 'aria-label'
                ]);
                var hidden = sel.querySelector('.uniSystemSelect__hiddenField');
                dbeRememberOwnedAttributes('a11y/composites', hidden, ['tabindex']);
                if (hidden && hidden.getAttribute('tabindex') !== '-1') { hidden.setAttribute('tabindex', '-1'); }
                // Fold the caret into the trigger: one Tab stop, out of the a11y tree,
                // so the whole control reads and behaves as a single combobox.
                var caret = sel.querySelector('.uniIconButton.caretIcon');
                if (caret) {
                    dbeRememberOwnedAttributes('a11y/composites', caret, ['tabindex', 'aria-hidden']);
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
                if (titleEl) {
                    dbeRememberOwnedAttributes('a11y/composites', titleEl, ['id']);
                    if (!titleEl.id) { titleEl.id = 'dbe-ss-lbl-' + (++dbeSSId); }
                    ref.push(titleEl.id);
                }
                if (valueEl) {
                    dbeRememberOwnedAttributes('a11y/composites', valueEl, ['id']);
                    if (!valueEl.id) { valueEl.id = 'dbe-ss-val-' + (++dbeSSId); }
                    ref.push(valueEl.id);
                }
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
            // Ids are minted PER WIDGET (dbeSSId counter, like dbe-ss-lbl-): a single
            // shared id would be duplicated in the document if two tag selects were
            // ever mounted at once, making every aria-controls ambiguous.
            document.querySelectorAll('.uniSystemSelectModuleTags').forEach(function (mt) {
                var results = mt.querySelector('.uniSystemSelectModuleTags__resultsWrapper');
                if (results) {
                    dbeRememberOwnedAttributes('a11y/composites', results, ['role', 'id', 'aria-label']);
                    if (results.getAttribute('role') !== 'listbox') { results.setAttribute('role', 'listbox'); }
                    if (!results.id || results.id.indexOf('dbe-mtags-list') !== 0) { results.id = 'dbe-mtags-list-' + (++dbeSSId); }
                    if (!results.getAttribute('aria-label')) { results.setAttribute('aria-label', dbeT('comboboxListbox', 'Options')); }
                }
                var curVal = ((mt.querySelector('.uniSystemSelectModuleTags__placeholder') || {}).textContent || '').trim();
                mt.querySelectorAll('.uniSystemSelectModuleTags__item').forEach(function (it) {
                    dbeRememberOwnedAttributes('a11y/composites', it, ['role', 'aria-selected']);
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
                    dbeRememberOwnedAttributes('a11y/composites', mfake, [
                        'role', 'aria-haspopup', 'aria-expanded', 'aria-controls', 'aria-labelledby'
                    ]);
                    if (mfake.getAttribute('role') !== 'combobox') { mfake.setAttribute('role', 'combobox'); }
                    if (mfake.getAttribute('aria-haspopup') !== 'listbox') { mfake.setAttribute('aria-haspopup', 'listbox'); }
                    var fexp = mexp ? 'true' : 'false';
                    if (mfake.getAttribute('aria-expanded') !== fexp) { mfake.setAttribute('aria-expanded', fexp); }
                    if (results && mexp) {
                        if (mfake.getAttribute('aria-controls') !== results.id) { mfake.setAttribute('aria-controls', results.id); }
                    } else if (mfake.hasAttribute('aria-controls')) { mfake.removeAttribute('aria-controls'); }
                    var mTitle = dbeSSLabelEl(mt);
                    var mRef = [];
                    if (mTitle) {
                        dbeRememberOwnedAttributes('a11y/composites', mTitle, ['id']);
                        if (!mTitle.id) { mTitle.id = 'dbe-ss-lbl-' + (++dbeSSId); }
                        mRef.push(mTitle.id);
                    }
                    var mPlaceholder = mt.querySelector('.uniSystemSelectModuleTags__placeholder');
                    if (mPlaceholder) {
                        dbeRememberOwnedAttributes('a11y/composites', mPlaceholder, ['id']);
                        if (!mPlaceholder.id) { mPlaceholder.id = 'dbe-ss-val-' + (++dbeSSId); }
                        mRef.push(mPlaceholder.id);
                    }
                    if (mRef.length && mfake.getAttribute('aria-labelledby') !== mRef.join(' ')) { mfake.setAttribute('aria-labelledby', mRef.join(' ')); }
                }
                var msearch = mt.querySelector('.uniSystemSelectModuleTags__search');
                if (msearch) {
                    dbeRememberOwnedAttributes('a11y/composites', msearch, [
                        'role', 'aria-expanded', 'aria-controls', 'aria-autocomplete', 'aria-label'
                    ]);
                    if (msearch.getAttribute('role') !== 'combobox') { msearch.setAttribute('role', 'combobox'); }
                    if (msearch.getAttribute('aria-expanded') !== (mexp ? 'true' : 'false')) { msearch.setAttribute('aria-expanded', mexp ? 'true' : 'false'); }
                    if (results && msearch.getAttribute('aria-controls') !== results.id) { msearch.setAttribute('aria-controls', results.id); }
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
            document.querySelectorAll('.uniSystemSelectClasses').forEach(function (cs) {
                var csExp = cs.classList.contains('expanded');
                // Resolve the list (and mint its per-widget id) up front so the fake
                // input's aria-controls can reference it in the same pass.
                var csItems = csExp
                    ? [].slice.call(cs.querySelectorAll('.uniSystemSelectClasses__item')).filter(function (it) { return it.offsetParent !== null; })
                    : [];
                var csList = csItems.length ? csItems[0].parentElement : null;
                if (csList) {
                    dbeRememberOwnedAttributes('a11y/composites', csList, [
                        'id', 'role', 'aria-multiselectable', 'aria-label'
                    ]);
                    if (!csList.id || csList.id.indexOf('dbe-csclasses-list') !== 0) { csList.id = 'dbe-csclasses-list-' + (++dbeSSId); }
                }
                var csFake = cs.querySelector('.uniSystemSelectClasses__fakeInput');
                if (csFake) {
                    dbeRememberOwnedAttributes('a11y/composites', csFake, [
                        'role', 'aria-haspopup', 'aria-expanded', 'aria-controls',
                        'aria-labelledby', 'aria-label'
                    ]);
                    if (csFake.getAttribute('role') !== 'combobox') { csFake.setAttribute('role', 'combobox'); }
                    if (csFake.getAttribute('aria-haspopup') !== 'listbox') { csFake.setAttribute('aria-haspopup', 'listbox'); }
                    var ce = csExp ? 'true' : 'false';
                    if (csFake.getAttribute('aria-expanded') !== ce) { csFake.setAttribute('aria-expanded', ce); }
                    if (csExp && csList) {
                        if (csFake.getAttribute('aria-controls') !== csList.id) { csFake.setAttribute('aria-controls', csList.id); }
                    } else if (csFake.hasAttribute('aria-controls')) { csFake.removeAttribute('aria-controls'); }
                    var csTitle = dbeSSLabelEl(cs);
                    if (csTitle) {
                        dbeRememberOwnedAttributes('a11y/composites', csTitle, ['id']);
                        if (!csTitle.id) { csTitle.id = 'dbe-ss-lbl-' + (++dbeSSId); }
                        if (csFake.getAttribute('aria-labelledby') !== csTitle.id) { csFake.setAttribute('aria-labelledby', csTitle.id); }
                    } else {
                        var ph = ((cs.querySelector('.uniSystemSelectClasses__placeholder') || {}).textContent || '').trim();
                        var cname = ph || dbeT('addClass', 'Add an ID or classes');
                        if (csFake.getAttribute('aria-label') !== cname) { csFake.setAttribute('aria-label', cname); }
                    }
                }
                if (!csExp) { return; }
                if (csList) {
                    if (csList.getAttribute('role') !== 'listbox') { csList.setAttribute('role', 'listbox'); }
                    if (csList.getAttribute('aria-multiselectable') !== 'true') { csList.setAttribute('aria-multiselectable', 'true'); }
                    if (!csList.getAttribute('aria-label')) { csList.setAttribute('aria-label', dbeT('comboboxListbox', 'Options')); }
                }
                csItems.forEach(function (it) {
                    dbeRememberOwnedAttributes('a11y/composites', it, ['role', 'aria-selected']);
                    if (it.getAttribute('role') !== 'option') { it.setAttribute('role', 'option'); }
                    var on = it.classList.contains('assigned') ? 'true' : 'false';
                    if (it.getAttribute('aria-selected') !== on) { it.setAttribute('aria-selected', on); }
                });
                var csSearch = cs.querySelector('.uniSystemSelectClasses__search');
                if (csSearch) {
                    dbeRememberOwnedAttributes('a11y/composites', csSearch, [
                        'role', 'aria-expanded', 'aria-controls', 'aria-autocomplete', 'aria-label'
                    ]);
                    if (csSearch.getAttribute('role') !== 'combobox') { csSearch.setAttribute('role', 'combobox'); }
                    if (csSearch.getAttribute('aria-expanded') !== 'true') { csSearch.setAttribute('aria-expanded', 'true'); }
                    if (csList && csSearch.getAttribute('aria-controls') !== csList.id) { csSearch.setAttribute('aria-controls', csList.id); }
                    if (csSearch.getAttribute('aria-autocomplete') !== 'list') { csSearch.setAttribute('aria-autocomplete', 'list'); }
                    if (!csSearch.getAttribute('aria-label')) { csSearch.setAttribute('aria-label', dbeT('comboboxFilter', 'Filter options')); }
                }
            });

            // Multi-value picker (.builderiusMultiSelect — display-condition values
            // and similar). The trigger is a plain div: no tab stop, no role, no
            // keyboard open — mouse-only. Wire it as a combobox whose popup is a
            // list of real checkboxes (natively focusable once open): the trigger
            // becomes the tab stop, Enter/Space/ArrowDown open it via the native
            // click path (the delegated key handler below), Escape closes and
            // returns. Names: the trigger from its field title + shown values,
            // each checkbox from its option row's text.
            document.querySelectorAll('.builderiusMultiSelect').forEach(function (ms) {
                var msTrigger = ms.querySelector('.builderiusMultiSelect__trigger');
                if (!msTrigger) { return; }
                dbeRememberOwnedAttributes('a11y/composites', msTrigger, [
                    'tabindex', 'role', 'aria-haspopup', 'aria-expanded',
                    'aria-labelledby', 'aria-label'
                ]);
                if (msTrigger.getAttribute('tabindex') !== '0') { msTrigger.setAttribute('tabindex', '0'); }
                if (msTrigger.getAttribute('role') !== 'combobox') { msTrigger.setAttribute('role', 'combobox'); }
                if (msTrigger.getAttribute('aria-haspopup') !== 'listbox') { msTrigger.setAttribute('aria-haspopup', 'listbox'); }
                var msExp = msTrigger.classList.contains('is-open') ? 'true' : 'false';
                if (msTrigger.getAttribute('aria-expanded') !== msExp) { msTrigger.setAttribute('aria-expanded', msExp); }
                var msTitle = dbeSSLabelEl(ms);
                var msValue = ms.querySelector('.builderiusMultiSelect__value');
                var msRef = [];
                if (msTitle) {
                    dbeRememberOwnedAttributes('a11y/composites', msTitle, ['id']);
                    if (!msTitle.id) { msTitle.id = 'dbe-ss-lbl-' + (++dbeSSId); }
                    msRef.push(msTitle.id);
                }
                if (msValue) {
                    dbeRememberOwnedAttributes('a11y/composites', msValue, ['id']);
                    if (!msValue.id) { msValue.id = 'dbe-ss-val-' + (++dbeSSId); }
                    msRef.push(msValue.id);
                }
                if (msRef.length) {
                    var mlb = msRef.join(' ');
                    if (msTrigger.getAttribute('aria-labelledby') !== mlb) { msTrigger.setAttribute('aria-labelledby', mlb); }
                } else if (!msTrigger.getAttribute('aria-label')) {
                    msTrigger.setAttribute('aria-label', dbeT('condPickValues', 'Values'));
                }
                // The option checkboxes have no <label> association — name each
                // from its row text so it is not an anonymous checkbox.
                ms.querySelectorAll('.builderiusMultiSelect__option').forEach(function (opt) {
                    var cb = opt.querySelector('input[type="checkbox"]');
                    var t = (opt.textContent || '').trim();
                    dbeRememberOwnedAttributes('a11y/composites', cb, ['aria-label']);
                    if (cb && t && cb.getAttribute('aria-label') !== t) { cb.setAttribute('aria-label', t); }
                });
            });

            var dd = dbeSSOpenDropdown();
            if (!dd) { return; }
            var search = dd.querySelector('.uniSystemSelect__search input') || dd.querySelector('input');
            var items = dbeSSItems(dd);
            var listContainer = items.length ? items[0].parentElement : null;
            if (listContainer) {
                dbeRememberOwnedAttributes('a11y/composites', listContainer, ['role', 'id', 'aria-label']);
                if (listContainer.getAttribute('role') !== 'listbox') { listContainer.setAttribute('role', 'listbox'); }
                if (listContainer.id !== SSCOMBO_LIST_ID) { listContainer.id = SSCOMBO_LIST_ID; }
                if (!listContainer.getAttribute('aria-label')) { listContainer.setAttribute('aria-label', dbeT('comboboxListbox', 'Options')); }
            }
            // Category headings are not options; keep them out of the listbox structure.
            [].slice.call(dd.querySelectorAll('.uniSystemSelect__cat')).forEach(function (c) {
                dbeRememberOwnedAttributes('a11y/composites', c, ['role']);
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
                dbeRememberOwnedAttributes('a11y/composites', it, [
                    'role', 'id', 'tabindex', 'aria-selected', 'class'
                ]);
                if (it.getAttribute('role') !== 'option') { it.setAttribute('role', 'option'); }
                var id = SSCOMBO_LIST_ID + '-opt-' + i;
                if (it.id !== id) { it.id = id; }
                if (it.getAttribute('tabindex') !== '-1') { it.setAttribute('tabindex', '-1'); }
                var isSel = vals.indexOf((it.textContent || '').trim()) !== -1 ? 'true' : 'false';
                if (it.getAttribute('aria-selected') !== isSel) { it.setAttribute('aria-selected', isSel); }
            });
            if (search) {
                dbeRememberOwnedAttributes('a11y/composites', search, [
                    'tabindex', 'role', 'aria-expanded', 'aria-controls',
                    'aria-label', 'aria-activedescendant'
                ]);
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

        function dbeSSActiveIndex(items, id) {
            for (var i = 0; i < items.length; i++) { if (items[i].id === id) { return i; } }
            return -1;
        }
        function dbeSSHighlight(search, items, idx) {
            dbeRememberOwnedAttributes('a11y/composites', search, ['aria-activedescendant']);
            items.forEach(function (it) {
                dbeRememberOwnedAttributes('a11y/composites', it, ['class']);
                it.classList.remove('dbe-sscombo-active');
            });
            var t = items[idx];
            if (!t) { return; }
            t.classList.add('dbe-sscombo-active');
            search.setAttribute('aria-activedescendant', t.id);
            try { t.scrollIntoView({ block: 'nearest' }); } catch (e) {}
        }
        function bindSelectCombobox() {
            // Arrow nav + Enter-when-highlighted, additive over the native search.
            dbeBindOwnedEvent('a11y/composites', document, 'select-search-keys', 'keydown', function (e) {
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
            dbeBindOwnedEvent('a11y/composites', document, 'select-search-input', 'input', function (e) {
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
            dbeBindOwnedEvent('a11y/composites', document, 'select-trigger-keys', 'keydown', function (e) {
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
                            if (!dd || !dbeCompositeControllerActive) { return; }
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

            // Multi-value picker keyboard support (.builderiusMultiSelect). The
            // trigger div opens through the same click path a mouse uses; once the
            // popup is open its options are real checkboxes, so Tab and Space are
            // native — only open/close and Up/Down between options need wiring.
            dbeBindOwnedEvent('a11y/composites', document, 'multi-select-keys', 'keydown', function (e) {
                var t = e.target;
                if (!t || !t.classList) { return; }
                if (t.classList.contains('builderiusMultiSelect__trigger')) {
                    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!t.classList.contains('is-open')) { clickSeq(t); }
                        waitFor(function () {
                            var ms = t.closest('.builderiusMultiSelect');
                            return (ms && ms.querySelector('.builderiusMultiSelect__option input[type="checkbox"]')) || null;
                        }, function (cb) {
                            if (cb && dbeCompositeControllerActive) { try { cb.focus(); } catch (err) {} }
                        });
                    } else if (e.key === 'Escape' && t.classList.contains('is-open')) {
                        e.preventDefault();
                        e.stopPropagation(); // close the popup, not the panel/dialog
                        clickSeq(t);
                    }
                    return;
                }
                var msWrap = t.closest && t.closest('.builderiusMultiSelect');
                if (!msWrap) { return; }
                var msTrig = msWrap.querySelector('.builderiusMultiSelect__trigger');
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (msTrig) {
                        if (msTrig.classList.contains('is-open')) { clickSeq(msTrig); }
                        try { msTrig.focus(); } catch (err) {}
                    }
                    return;
                }
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    var cbs = [].slice.call(msWrap.querySelectorAll('.builderiusMultiSelect__option input[type="checkbox"]'));
                    var ci = cbs.indexOf(document.activeElement);
                    if (ci === -1) { return; }
                    e.preventDefault();
                    e.stopPropagation();
                    var ni = e.key === 'ArrowDown' ? Math.min(ci + 1, cbs.length - 1) : Math.max(ci - 1, 0);
                    try { cbs[ni].focus(); } catch (err) {}
                }
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
            dbeBindOwnedEvent('a11y/composites', document, 'fake-select-focusout', 'focusout', function (e) {
                var w = e.target && e.target.closest && e.target.closest('.uniSystemSelectModuleTags, .uniSystemSelectClasses');
                if (!w || !w.classList.contains('expanded')) { return; }
                var to = e.relatedTarget;
                if (!to || w.contains(to)) { return; }
                var esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
                (w.querySelector('input[class*="__search"]') || w).dispatchEvent(esc);
            }, true);
        }

        /* (a) tag + label, (b) keep-icon flag, (c) selected-row accent flag —
           each part gated on its own toggle. */
        var dbeTreeBadgeRecords = [];
        function decorateTree() {
            var iframe = dbeQuery('previewFrame');
            var idoc = iframe && iframe.contentDocument;
            var mods = modules();
            var sel = activeId();

            // id → tag map, built lazily with ONE canvas pass per call. Without it
            // every badge-less row (templates, components, not-yet-painted nodes)
            // fired its own querySelector into the iframe on every tick, forever.
            var tagById = null;
            function canvasTag(id) {
                if (!idoc) { return null; }
                if (!tagById) {
                    tagById = {};
                    idoc.querySelectorAll('[class*="uni-node-"]').forEach(function (el) {
                        // getAttribute, not className: SVG className is an object.
                        var m = (el.getAttribute('class') || '').match(/uni-node-(\w+)/);
                        // Looped templates paint N instances per id — first wins.
                        if (m && !(m[1] in tagById)) { tagById[m[1]] = el.tagName.toLowerCase(); }
                    });
                }
                return tagById[id] || null;
            }

            dbeQueryAll('navigatorRows').forEach(function (btn) {
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
                var tag = canvasTag(id);
                if (!tag) { return; }
                var raw = span.textContent.trim();
                var idx = raw.indexOf(' .');
                var label = idx >= 0 ? raw.slice(0, idx) : raw;

                dbeTreeBadgeRecords = dbeTreeBadgeRecords.filter(function (record) { return record.node.isConnected; });
                if (!dbeTreeBadgeRecords.some(function (record) { return record.node === span; })) {
                    dbeTreeBadgeRecords.push({ node: span, html: span.innerHTML });
                }

                var badge = document.createElement('span');
                badge.className = 'dbe-tag-badge';
                badge.textContent = '<' + tag + '>';
                badge.setAttribute('aria-hidden', 'true');
                span.textContent = '';
                span.appendChild(badge);
                if (label && label.toLowerCase() !== tag) {
                    var visibleLabel = document.createElement('span');
                    visibleLabel.setAttribute('aria-hidden', 'true');
                    visibleLabel.textContent = ' ' + label;
                    span.appendChild(visibleLabel);
                }
                // The badge is a visual scan aid, not a rename. Preserve the native
                // row label verbatim for screen readers and voice-control matching.
                var spokenLabel = document.createElement('span');
                spokenLabel.className = 'dbe-visually-hidden';
                spokenLabel.textContent = raw;
                span.appendChild(spokenLabel);
            });
        }

        function dbeRestoreTreeDecorations() {
            dbeTreeBadgeRecords.forEach(function (record) {
                if (record.node.isConnected) { record.node.innerHTML = record.html; }
            });
            dbeTreeBadgeRecords = [];
            dbeQueryAll('navigatorRows').forEach(function (row) {
                row.classList.remove('dbe-tree-selected', 'dbe-multi-selected', 'dbe-keep-icon');
            });
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
           1.3.6-beta, 15 Aug 2026); DROP_BEFORE never appears, so "place before the
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
            dbeBindOwnedEvent('a11y/composites', document, 'multi-drag-start', 'dragstart', function (e) {
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
            dbeBindOwnedEvent('a11y/composites', document, 'multi-drag-drop', 'drop', function (e) {
                if (dbeAutoDragging || !dbeMultiDrag) { return; }
                dbeMultiDrag.dropped = !!(e.target.closest && e.target.closest('.uniRightPanel'));
            }, true);
            dbeBindOwnedEvent('a11y/composites', document, 'multi-drag-end', 'dragend', function () {
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
                dbeBindOwnedEvent('a11y/composites', document, 'multi-select-' + t, t, function (e) {
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
            dbeBindOwnedEvent('a11y/composites', document, 'multi-select-escape', 'keydown', function (e) {
                if (e.key !== 'Escape' || !dbeMultiSel.size) { return; }
                if (document.querySelector('dialog.uniBuilderContextMenu[open]') || renameActive()) { return; }
                var t = e.target;
                if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], .monaco-editor')) { return; }
                clearMultiSel();
            }, true);
        }

        /* Favourites editing (favourites_reorder). Builderius 1.3.6 supplies an
           Edit favourites button, React-DnD ordering and store persistence. DBE
           extends that native mode with names, announcements and Up/Down keyboard
           movement. Older Builderius versions retain the original DBE toggle,
           pointer drag and localStorage fallback below. */
        var DBE_FAV_KEY = 'dbeFavouritesOrder';
        var dbeFavStatus = null;

        function favList() { return document.querySelector('.uniModTree__favouritesList'); }

        function nativeFavButton() { return document.querySelector('.editFavouritesIcon'); }

        function favItems() {
            var list = favList();
            return list ? [].slice.call(list.children).filter(function (li) {
                return li.classList.contains('uniModTree__favouritesListItem');
            }) : [];
        }

        function favKey(li) {
            var wrappers = [].slice.call(li.querySelectorAll('[class*="tooltipId__favModule_"]'));
            for (var i = 0; i < wrappers.length; i++) {
                // Builderius renders `favModule_remove_<Type>` first for the
                // delete control, then `favModule_<Type>` for the module button.
                // Only the latter is a pinnedModules store key.
                var m = wrappers[i].className.toString().match(/tooltipId__favModule_(?!remove_)(\S+)/);
                if (m) { return m[1]; }
            }
            var tc = li.querySelector('[data-tooltip-content]');
            if (tc) { return 'label:' + tc.getAttribute('data-tooltip-content'); }
            var p = li.querySelector('.modIcon svg path');
            return p ? 'glyph:' + (p.getAttribute('d') || '').slice(0, 24) : null;
        }

        function favLabel(li) {
            var tc = li.querySelector('[data-tooltip-content]');
            var icon = li.querySelector('button.modIcon');
            return (tc && tc.getAttribute('data-tooltip-content'))
                || (icon && icon.getAttribute('data-dbe-fav-label'))
                || (icon && icon.getAttribute('aria-label'))
                || 'favourite';
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
                return Array.isArray(v) && v.length ? v.map(function (key) {
                    return String(key).replace(/^remove_/, '');
                }) : null;
            } catch (e) { return null; }
        }

        function applyFavouritesOrder() {
            var list = favList();
            var saved = favSavedOrder();
            // Native persistence is authoritative from Builderius 1.3.6 onward.
            if (nativeFavButton()) { return; }
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

        function setNativeFavLabels(list, editing) {
            favItems().forEach(function (li) {
                var icon = li.querySelector('button.modIcon');
                if (!icon) { return; }
                dbeRememberOwnedAttributes('a11y/composites', icon, ['aria-label']);
                if (editing) {
                    if (!icon.hasAttribute('data-dbe-fav-label')) {
                        icon.setAttribute('data-dbe-fav-label', icon.getAttribute('aria-label') || '');
                    }
                    icon.setAttribute('aria-label', dbeFmt(dbeT('favArrowHint', '%s (press up or down arrow to move, Escape to finish)'), favLabel(li)));
                } else {
                    var previous = icon.getAttribute('data-dbe-fav-label');
                    if (previous) { icon.setAttribute('aria-label', previous); }
                    else if (icon.hasAttribute('data-dbe-fav-label')) { icon.removeAttribute('aria-label'); }
                    icon.removeAttribute('data-dbe-fav-label');
                }
            });
        }

        function moveNativeFavourite(list, li, offset) {
            var items = favItems();
            var from = items.indexOf(li);
            var to = from + offset;
            if (from < 0 || to < 0 || to >= items.length) { return; }
            var keys = items.map(favKey);
            if (keys.some(function (key) { return !key; })) { return; }
            var movedKey = keys.splice(from, 1)[0];
            keys.splice(to, 0, movedKey);
            try {
                var sf = store();
                var current = sf && sf.storeGet('pinnedModules');
                if (!Array.isArray(current)) { return; }
                var hidden = current.filter(function (key) { return keys.indexOf(key) === -1; });
                var updated = hidden.concat(keys.slice().reverse());
                sf.storeSet('pinnedModules', updated);
                sf.storeSet('pinnedModulesUpdate', updated);
            } catch (e) { return; }
            favAnnounce(dbeFmt(dbeT('movedToPosition', 'Moved %1$s to position %2$s of %3$s'), favLabel(li), to + 1, items.length));
            waitFor(function () {
                return favItems().filter(function (item) { return favKey(item) === movedKey; })[0] || null;
            }, function (moved) {
                var focusTarget = moved && moved.querySelector('button.modIcon');
                if (focusTarget) { focusTarget.focus(); }
            });
        }

        function ensureNativeFavouritesReorder(list, button) {
            var editing = !!list.querySelector('.uniModTree__favouritesListItem.editting');
            dbeRememberOwnedAttributes('a11y/composites', button, ['aria-label', 'aria-pressed']);
            button.setAttribute('aria-label', dbeT('editFavourites', 'Edit favourites'));
            button.setAttribute('aria-pressed', editing ? 'true' : 'false');
            setNativeFavLabels(list, editing);
            dbeBindOwnedEvent('a11y/composites', list, 'native-favourites-reorder-keys', 'keydown', function (ev) {
                if (!list.querySelector('.uniModTree__favouritesListItem.editting')) { return; }
                if (ev.key === 'Escape') {
                    ev.preventDefault();
                    ev.stopPropagation();
                    clickSeq(button);
                    button.focus();
                    return;
                }
                if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') { return; }
                var icon = ev.target.closest && ev.target.closest('button.modIcon');
                var li = icon && icon.closest('li.uniModTree__favouritesListItem.editting');
                if (!li) { return; }
                ev.preventDefault();
                ev.stopPropagation();
                moveNativeFavourite(list, li, ev.key === 'ArrowUp' ? -1 : 1);
            }, true);
        }

        function bindFavDrag(list) {
            var drag = null;

            // In drag mode clicks must not insert elements or open native UI.
            dbeBindOwnedEvent('a11y/composites', list, 'favourites-reorder-click', 'click', function (ev) {
                if (!list.classList.contains('dbe-fav-reordering')) { return; }
                if (ev.target.closest && ev.target.closest('.dbe-fav-reorder')) { return; }
                ev.preventDefault();
                ev.stopPropagation();
            }, true);

            dbeBindOwnedEvent('a11y/composites', list, 'favourites-reorder-pointerdown', 'pointerdown', function (ev) {
                if (!list.classList.contains('dbe-fav-reordering')) { return; }
                var li = ev.target.closest && ev.target.closest('li.uniModTree__favouritesListItem');
                if (!li) { return; }
                ev.preventDefault();
                ev.stopPropagation();
                drag = { li: li };
                li.classList.add('dbe-fav-dragging');
                try { ev.target.setPointerCapture(ev.pointerId); } catch (e) {}
            }, true);

            // rAF-gated like the panel/preview drags: pointermove can fire several
            // times per frame, and each hit-test reads rects (layout) and may
            // insertBefore (write) — unthrottled, that interleaving thrashes.
            var favRaf = 0, favY = 0;
            dbeBindOwnedEvent('a11y/composites', list, 'favourites-reorder-pointermove', 'pointermove', function (ev) {
                if (!drag) { return; }
                favY = ev.clientY;
                if (favRaf) { return; }
                favRaf = dbeSetOwnedFrame('a11y/composites', function () {
                    favRaf = 0;
                    if (!drag) { return; } // drag ended before the frame
                    var items = favItems().filter(function (it) { return it !== drag.li; });
                    for (var i = 0; i < items.length; i++) {
                        var r = items[i].getBoundingClientRect();
                        if (favY >= r.top && favY <= r.bottom) {
                            var before = favY < r.top + r.height / 2;
                            list.insertBefore(drag.li, before ? items[i] : items[i].nextSibling);
                            break;
                        }
                    }
                });
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
            dbeBindOwnedEvent('a11y/composites', list, 'favourites-reorder-pointerup', 'pointerup', endFavDrag, true);
            dbeBindOwnedEvent('a11y/composites', list, 'favourites-reorder-pointercancel', 'pointercancel', endFavDrag, true);

            dbeBindOwnedEvent('a11y/composites', list, 'favourites-reorder-keys', 'keydown', function (ev) {
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

        function dbeResetFavouritesReorder() {
            document.querySelectorAll('.dbe-fav-reorder').forEach(function (node) { node.remove(); });
            document.querySelectorAll('.dbe-fav-reordering').forEach(function (list) {
                list.classList.remove('dbe-fav-reordering');
                favItems().forEach(function (li) {
                    li.classList.remove('dbe-fav-dragging');
                    var icon = li.querySelector('button.modIcon');
                    if (!icon) { return; }
                    var previous = icon.getAttribute('data-dbe-fav-label');
                    if (previous) { icon.setAttribute('aria-label', previous); }
                    else if (icon.hasAttribute('data-dbe-fav-label')) { icon.removeAttribute('aria-label'); }
                    icon.removeAttribute('data-dbe-fav-label');
                });
            });
            if (dbeFavStatus) { dbeFavStatus.remove(); }
            dbeFavStatus = null;
        }

        function ensureFavouritesReorder() {
            var list = favList();
            if (!list) { return; }
            var nativeButton = nativeFavButton();
            if (nativeButton) {
                document.querySelectorAll('.dbe-fav-reorder').forEach(function (node) { node.remove(); });
                list.classList.remove('dbe-fav-reordering');
                ensureNativeFavouritesReorder(list, nativeButton);
                return;
            }
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
        var NAV_ROW_SEL = 'button.uniModTree__item';

        function navRootList() {
            // Outermost element list — querySelector returns the first in document
            // order (favourites live in a separate list, the footer outside it).
            return dbeQuery('navigatorTree');
        }
        function navRowId(btn) {
            var m = btn && btn.className.toString().match(/uni-tree-node-(\w+)/);
            return m ? m[1] : null;
        }
        function navRowById(id) {
            return dbeNavigatorRow(id);
        }
        function navRowLi(btn) { return btn.closest('li.uniModTree__itemDrag'); }
        function navRowExpandable(btn) { return !!btn.querySelector('i'); }
        function navRowExpanded(btn) { return btn.classList.contains('expanded'); }
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

        // The disclosure is an activation target inside the row button, not a
        // separate treeitem. Keep mouse activation from moving DOM focus away
        // from the row whose visible ring will remain on screen. If collapsing
        // this branch would hide the focused descendant, allow the native focus
        // move onto the branch row so focus never becomes hidden or detached.
        function navPreserveDisclosureFocus(e) {
            if (e.button !== 0) { return; }
            var chev = e.target && e.target.closest && e.target.closest('i');
            var row = chev && chev.closest && chev.closest(NAV_ROW_SEL);
            var root = navRootList();
            if (!row || !root || !root.contains(row) || chev.parentElement !== row) { return; }
            var active = document.activeElement;
            var activeRow = active && active.closest && active.closest(NAV_ROW_SEL);
            var branch = navRowLi(row);
            if (activeRow && activeRow !== row && branch && branch.contains(activeRow)) { return; }
            e.preventDefault();
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
            dbeSetOwnedFrame('a11y/composites', function () {
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
           selected/roving in sync through Builderius' React re-renders.

           ONE top-down traversal: levels derive from the parent's level + 1,
           sibling position/count are computed once per <ul>, and each wrapper is
           stamped role="none" exactly once. The per-row form of this (climb the
           ancestors for level, re-scan siblings for posinset, walk to root for
           ownership — for every one of 100+ rows) was the hottest code on the
           busiest observer. Visibility is derived structurally too — a branch list
           is hidden exactly when its parent row is collapsed — so the roving-stop
           pass needs no offsetParent reads, which would force layout between the
           attribute writes above. */
        function navSyncAria() {
            var root = navRootList();
            if (!root) { return; }
            dbeRememberOwnedAttributes('a11y/composites', root, ['role', 'aria-label']);
            if (root.getAttribute('role') !== 'tree') { root.setAttribute('role', 'tree'); }
            var label = dbeT('elementsTree', 'Elements');
            if (root.getAttribute('aria-label') !== label) { root.setAttribute('aria-label', label); }

            var sel = activeId();
            var rows = [], visRows = [];

            function stampRow(btn, level, pos, size, visible) {
                dbeRememberOwnedAttributes('a11y/composites', btn, [
                    'role', 'aria-level', 'aria-posinset', 'aria-setsize',
                    'aria-expanded', 'aria-selected', 'tabindex'
                ]);
                if (btn.getAttribute('role') !== 'treeitem') { btn.setAttribute('role', 'treeitem'); }
                var lvl = String(level);
                if (btn.getAttribute('aria-level') !== lvl) { btn.setAttribute('aria-level', lvl); }
                if (btn.getAttribute('aria-posinset') !== pos) { btn.setAttribute('aria-posinset', pos); }
                if (btn.getAttribute('aria-setsize') !== size) { btn.setAttribute('aria-setsize', size); }
                if (navRowExpandable(btn)) {
                    var ex = navRowExpanded(btn) ? 'true' : 'false';
                    if (btn.getAttribute('aria-expanded') !== ex) { btn.setAttribute('aria-expanded', ex); }
                } else if (btn.hasAttribute('aria-expanded')) {
                    btn.removeAttribute('aria-expanded');
                }
                var s = (sel && navRowId(btn) === sel) ? 'true' : 'false';
                if (btn.getAttribute('aria-selected') !== s) { btn.setAttribute('aria-selected', s); }
                rows.push(btn);
                if (visible) { visRows.push(btn); }
            }

            function stampLi(li, level, pos, size, visible) {
                dbeRememberOwnedAttributes('a11y/composites', li, ['role']);
                if (li.getAttribute('role') !== 'none') { li.setAttribute('role', 'none'); }
                var btn = null, childLists = [];
                (function scan(parent) {
                    for (var node = parent.firstElementChild; node; node = node.nextElementSibling) {
                        if (node.nodeName === 'UL') { childLists.push(node); continue; }   // nested branch
                        if (node.matches && node.matches(NAV_ROW_SEL)) {
                            // The li's OWN row is its first tree button in document order.
                            if (!btn) { btn = node; }
                            continue; // never descend into a button (chevron/label live there)
                        }
                        dbeRememberOwnedAttributes('a11y/composites', node, ['role']);
                        if (node.getAttribute('role') !== 'none') { node.setAttribute('role', 'none'); }
                        scan(node);
                    }
                })(li);
                if (btn) { stampRow(btn, level, pos, size, visible); }
                // A collapsed row's child <ul> stays mounted but display:none, so
                // child visibility is structural: parent visible AND expanded.
                var childVis = !!(visible && btn && navRowExpanded(btn));
                childLists.forEach(function (ul) { walkList(ul, level + 1, childVis); });
            }

            function walkList(ul, level, visible) {
                if (ul !== root) {
                    dbeRememberOwnedAttributes('a11y/composites', ul, ['role']);
                    if (ul.getAttribute('role') !== 'none') { ul.setAttribute('role', 'none'); }
                }
                var lis = [];
                for (var el = ul.firstElementChild; el; el = el.nextElementSibling) {
                    if (el.matches && el.matches('li.uniModTree__itemDrag')) { lis.push(el); }
                }
                var size = String(lis.length);
                for (var i = 0; i < lis.length; i++) {
                    stampLi(lis[i], level, String(i + 1), size, visible);
                }
            }

            walkList(root, 1, true);

            // Roving tab stop: keep the row that already holds it (so a keyboard
            // user's position survives a re-render), else the selected row, else the
            // first visible one.
            if (!visRows.length) { return; }
            var current = visRows.filter(function (b) { return b.getAttribute('tabindex') === '0'; })[0];
            var selRow = sel ? visRows.filter(function (b) { return navRowId(b) === sel; })[0] : null;
            var keep = current || selRow || visRows[0];
            rows.forEach(function (b) {
                var t = b === keep ? '0' : '-1';
                if (b.getAttribute('tabindex') !== t) { b.setAttribute('tabindex', t); }
            });
        }

        function navOnKeydown(e) {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) { return; }
            var btn = e.target.closest && e.target.closest(NAV_ROW_SEL);
            var root = navRootList();
            if (!btn || !root || !root.contains(btn)) { return; }
            if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && on('element_moves') && /^Arrow/.test(e.key)) {
                var id = navRowId(btn);
                if (!id) { return; }
                e.preventDefault();
                e.stopPropagation();
                var moved = false;
                if (e.key === 'ArrowUp') { moved = moveSibling(id, -1); }
                else if (e.key === 'ArrowDown') { moved = moveSibling(id, 1); }
                else if (e.key === 'ArrowLeft') { moved = outdentElement(id); }
                else if (e.key === 'ArrowRight') { moved = indentElement(id); }
                if (!moved) {
                    undoToast(e.key === 'ArrowLeft'
                        ? dbeT('cannotMoveOut', 'Already at the outermost available level')
                        : (e.key === 'ArrowRight'
                            ? dbeT('cannotMoveIn', 'Needs a previous sibling that can contain elements')
                            : (e.key === 'ArrowUp'
                                ? dbeT('cannotMoveUp', 'Already first among its siblings')
                                : dbeT('cannotMoveDown', 'Already last among its siblings'))));
                }
                return;
            }
            if (!on('navigator_keyboard')) { return; }
            if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) { return; } // leave other modified combos to the builder
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
            if (on('navigator_keyboard')) { navSyncAria(); }
            var panel = document.querySelector('.uniRightPanel');
            if (!panel) { return; }
            if (on('navigator_keyboard')) {
                dbeBindOwnedEvent('a11y/composites', document, 'navigator-disclosure-focus', 'mousedown', navPreserveDisclosureFocus, true);
            }
            // Bound on the stable panel (the tree lists are replaced on re-render),
            // while the controller registry keeps the binding reversible.
            dbeBindOwnedEvent('a11y/composites', panel, 'navigator-keys', 'keydown', navOnKeydown);
        }

        host.setNavigatorApi(Object.freeze({
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
            select: navSelect,
            toggleExpand: navToggleExpand
        }));

        /* Terminal tabs use the same APG roving-group primitive while retaining
           their own integrations lifecycle in the host. */
        host.setEnsureGroup(dbeEnsureGroup);

        var dbeCompositeControllerActive = false;
        var dbeCompositeFooterTimer = 0;
        var dbeCompositeFooterAttempts = 0;
        function dbeObserveA11yComposites() {
            var top = dbeQuery('topPanel');
            if ((on('topbar_toolbar') || on('builderius_menu')) && top) {
                dbeObserveChrome('a11y-composites-top', top, { childList: true, subtree: true });
            }
            var main = dbeQuery('mainPanel');
            if ((on('inserter_keyboard') || on('panel_tabs') || on('settings_accordions') || on('builderius_menu') ||
                NEED_TREE || on('favourites_reorder') || on('navigator_keyboard') || on('element_moves')) && main) {
                dbeObserveChrome('a11y-composites-main', main, {
                    childList: true,
                    subtree: true,
                    characterData: true,
                    attributes: true,
                    attributeFilter: ['class']
                });
            }
            if (on('select_combobox')) {
                dbeObserveChrome('a11y-composites-portals', document.body, { childList: true });
            }
        }
        function dbeRefreshA11yComposites() {
            dbePruneGroupState();
            dbeObserveA11yComposites();
            if (on('topbar_toolbar')) { ensureTopbarToolbars(); }
            if (on('footer_toolbar')) { ensureFooterToolbar(); }
            if (on('inserter_keyboard')) {
                ensureInserterKeyboard();
                ensureFavouritesKeyboard();
            }
            if (on('panel_tabs')) { ensurePanelTabs(); }
            if (on('select_combobox')) { ensureSelectComboboxes(); }
            if (on('settings_accordions')) { ensureSettingsAccordions(); }
            if (on('builderius_menu')) { ensureBuilderiusMenu(); }
            if (NEED_TREE) { decorateTree(); }
            if (on('navigator_keyboard') || on('element_moves')) { ensureNavKeyboard(); }
            if (on('favourites_reorder')) {
                ensureFavouritesReorder();
                applyFavouritesOrder();
            }
        }
        function dbeRetryCompositeFooter() {
            if (!on('footer_toolbar') || dbeQuery('footerBar') || dbeCompositeFooterAttempts >= 30) {
                dbeCompositeFooterTimer = 0;
                return;
            }
            dbeCompositeFooterAttempts++;
            dbeCompositeFooterTimer = setTimeout(function () {
                dbeCompositeFooterTimer = 0;
                dbeRefreshA11yComposites();
                dbeRetryCompositeFooter();
            }, 500);
        }
        function destroyA11yComposites() {
            dbeCompositeControllerActive = false;
            if (dbeCompositeFooterTimer) {
                clearTimeout(dbeCompositeFooterTimer);
                dbeCompositeFooterTimer = 0;
            }
            dbeCompositeFooterAttempts = 0;
            dbeMenuWasOpen = false;
            dbeObserveChrome('a11y-composites-top', null);
            dbeObserveChrome('a11y-composites-main', null);
            dbeObserveChrome('a11y-composites-portals', null);
            dbeUnobserveFooter('a11y-composites-footer');
            dbeObserveChrome('a11y-composites-footer-scope-tabs', null);
            dbeObserveChrome('a11y-composites-footer-config-panel', null);
            dbeDestroyOwnedActivity('a11y/composites');
            dbeDestroyOwnedGroups('a11y/composites');
            dbeResetFavouritesReorder();
            dbeRestoreTreeDecorations();
        }
        dbeControllers.register('a11y/composites', {
            init: function (context) {
                if (!context || !context.builderius) { return; }
                dbeCompositeControllerActive = true;
                // Parked until the multi-row drag is reliable; the registry has no
                // multi_select feature, but keep its dormant wiring with its future
                // tree-composite owner rather than in the global boot path.
                if (on('multi_select')) { bindMultiSelect(); bindMultiDrag(); }
                if (on('select_combobox')) { bindSelectCombobox(); }
                if (on('builderius_menu')) {
                    dbeBindOwnedEvent('a11y/composites', document, 'builderius-menu-keys', 'keydown', dbeMenuKeydown, true);
                }
                dbeRefreshA11yComposites();
                dbeRetryCompositeFooter();
            },
            refresh: function (reason) {
                if (reason) { dbeRefreshA11yComposites(); }
            },
            destroy: function () {
                destroyA11yComposites();
            }
        }, on('topbar_toolbar') || on('footer_toolbar') || on('inserter_keyboard') || on('panel_tabs') ||
            on('select_combobox') || on('settings_accordions') || on('builderius_menu') || NEED_TREE ||
            on('favourites_reorder') || on('navigator_keyboard') || on('element_moves'));
    };

    window.dbeBuilderChunks = chunks;
})();
