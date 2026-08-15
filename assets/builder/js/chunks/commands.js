(function () {
    'use strict';

    /* Command and Navigator interaction controllers register after builder.js
       supplies the shared lifecycle, Builderius adapter and editing services. */
    const chunks = window.dbeBuilderChunks || {};

    chunks.commands = function (host) {
        const on = host.on;
        const dbeT = host.translate;
        const dbeFmt = host.format;
        const dbeTn = host.plural;
        const CFG = host.config;
        const dbeQuery = host.query;
        const modules = host.builderius.modules;
        const activeId = host.builderius.activeId;
        const store = host.builderius.store;
        const clickSeq = host.click;
        const waitFor = host.waitFor;
        const schedule = host.schedule;
        const setTip = host.tooltip;
        const dbeAccel = host.accelerator;
        const dbeControllers = host.controllers;
        const dbeObserveChrome = host.observe;
        const dbeRememberOwnedAttributes = host.rememberOwnedAttributes;
        const dbeBindOwnedEvent = host.bindOwnedEvent;
        const dbeBindOwnedHook = host.bindOwnedHook;
        const dbeDestroyOwnedHooks = host.destroyOwnedHooks;
        const dbeSetOwnedTimeout = host.setOwnedTimeout;
        const dbeClearOwnedTimeout = host.clearOwnedTimeout;
        const dbeSetOwnedFrame = host.setOwnedFrame;
        const dbeUnbindOwnedEvent = host.unbindOwnedEvent;
        const dbeDestroyOwnedActivity = host.destroyOwnedActivity;
        const dbeDestroyOwnedGroups = host.destroyOwnedGroups;
        const undoToast = host.feedback.undo;
        const dbeMultiSel = host.multiSelection.state;
        const dbeIsMac = host.multiSelection.isMac;
        const clearMultiSel = host.multiSelection.clear;
        const renameActive = host.multiSelection.renameActive;
        const multiCtxIds = host.multiSelection.contextIds;
        const removeMulti = host.multiSelection.remove;
        const dbeSetDisabledReason = host.multiSelection.setDisabledReason;
        const disableCtxItem = host.multiSelection.disableContextItem;
        const contextTarget = host.context.getTarget;
        const setContextTarget = host.context.setTarget;
        const NAV_ROW_SEL = host.navigator.rowSelector;
        const navRootList = host.navigator.rootList;
        const navRowId = host.navigator.rowId;
        const navRowById = host.navigator.rowById;
        const navRowLi = host.navigator.rowListItem;
        const navRowExpandable = host.navigator.rowExpandable;
        const navRowExpanded = host.navigator.rowExpanded;
        const navParentRow = host.navigator.parentRow;
        const navVisibleRows = host.navigator.visibleRows;
        const navFocus = host.navigator.focus;
        const navToggleExpand = host.navigator.toggleExpand;
        const moveSibling = host.navigator.moveSibling;
        const indentElement = host.navigator.indent;
        const outdentElement = host.navigator.outdent;
        const selectParentOf = host.navigator.selectParent;
        const startRename = host.editing.startRename;
        const defaultLabelFor = host.editing.defaultLabel;
        const commitRename = host.editing.commitRename;
        const wrap = host.editing.wrap;
        const unwrap = host.editing.unwrap;
        const bemClassable = host.editing.bemClassable;
        const openAutoBemDialog = host.editing.openAutoBem;
        const dbeIndentTarget = host.editing.indentTarget;
        const dbeCanOutdent = host.editing.canOutdent;
        const dbeHtmlEditable = host.editing.htmlEditable;
        const openEditHtmlDialog = host.editing.openEditHtml;
        const openImportHtmlDialog = host.editing.openImportHtml;
        const DBE_HTML_MODULES = host.editing.htmlModules;
        const DBE_TAG_CHOICES = host.editing.tagChoices;
        const dbeChangeTagEligible = host.editing.changeTagEligible;
        const dbeChangeTag = host.editing.changeTag;
        const dbeCleanTagInput = host.editing.cleanTagInput;
        const dbeInsertSection = host.editing.insertSection;
        const dbeInsertSibling = host.editing.insertSibling;
        const dbeElementModule = host.editing.elementModule;
        const dbeDecodeEntities = host.editing.decodeEntities;
        const dbeAttrBlocked = host.editing.attributeBlocked;
        const dbeUpdateModuleSettings = host.editing.updateModuleSettings;
        const dbeAddClasses = host.editing.addClasses;
        const dbeEmmetParse = host.editing.emmetParse;
        const dbeEmmetStructureError = host.editing.emmetStructureError;
        const dbeEmmetInsert = host.editing.emmetInsert;
        const dbeMoveLocation = host.editing.moveLocation;
        const dbeStyleActionItems = host.styles.actionItems;
        const openStyleInspector = host.styles.openInspector;
        const dbeOpenStyleEditor = host.styles.openEditor;
        const moduleClasses = host.styles.moduleClasses;
        const entityScopeLabel = host.styles.entityScopeLabel;
        const dbeFocusArea = host.workspace.focusArea;
        const dbeCompactActive = host.workspace.compactActive;
        const dbeToggleSidePanels = host.workspace.toggleSidePanels;
        const dbeSetPanelVisibility = host.workspace.setPanelVisibility;
        const dbePanelWrappers = host.workspace.panelWrappers;
        const dbePanelSideHidden = host.workspace.panelSideHidden;
        const ensureNativeShortcuts = host.shortcuts.ensure;
        const openShortcutsDialog = host.shortcuts.open;
        const bindShortcutsKey = host.shortcuts.bind;
        const NEED_NAV_BUTTONS = host.needNavigatorButtons;
        const NEED_CTX_MENU = host.needContextMenu;

        /* A menu row's label with shortcut hints left out. DBE adds
           .dbe-ctx-accel on older Builderius versions; 1.3.6 adds its own
           .uniContextMenu__shortcut spans. Neither is part of the command name.
           When a menu item drives the menu it was activated from (Cut = Copy
           then Remove), React can also reuse the just-closed enriched dialog,
           so exact-label matching must ignore both forms. */
        function nativeCtxLabel(li) {
            let t = '';
            for (let n = li.firstChild; n; n = n.nextSibling) {
                if (n.nodeType === 1 && n.classList &&
                    (n.classList.contains('dbe-ctx-accel') || n.classList.contains('uniContextMenu__shortcut'))) { continue; }
                t += n.textContent || '';
            }
            return t.trim();
        }

        /* Open a row's native context menu invisibly and activate one item. */
        function driveContextMenuItem(rowId, itemText, cb) {
            const row = document.querySelector('.uniRightPanel .uni-tree-node-' + rowId);
            if (!row) { cb(false); return; }
            document.documentElement.classList.add('dbe-auto-ctx');
            // A menu may still be open — Cut drives the menu it was activated from.
            // Close it and wait until it has really gone before opening ours: the
            // poll below would otherwise find the old ENRICHED dialog, and React
            // recycles its rows on re-render, so the node found as "Copy" can be a
            // different item by the time the click lands (observed as a stray
            // Paste during Cut).
            try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
            waitFor(() => {
                return document.querySelector('dialog.uniBuilderContextMenu[open]') ? null : true;
            }, (closed) => {
                if (!closed) {
                    document.documentElement.classList.remove('dbe-auto-ctx');
                    cb(false);
                    return;
                }
                row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
                waitFor(() => {
                    const d = document.querySelector('dialog.uniBuilderContextMenu[open]');
                    if (!d) { return null; }
                    return [].slice.call(d.querySelectorAll('li.uniContextMenu__item')).find((li) => {
                        return !li.classList.contains('dbe-ctx-item') && nativeCtxLabel(li) === itemText;
                    }) || null;
                }, (item) => {
                    if (!item) {
                        document.documentElement.classList.remove('dbe-auto-ctx');
                        try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
                        cb(false);
                        return;
                    }
                    clickSeq(item);
                    setTimeout(() => {
                        try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
                        document.documentElement.classList.remove('dbe-auto-ctx');
                        cb(true);
                    }, 120);
                });
            });
        }

        /* --- Paste where you click (navigator_paste) ---
           Native Paste always inserts into the ACTIVE module (or at root when
           nothing is selected); the row whose menu you opened is irrelevant. So
           right-click → Paste on an unselected row pastes into the wrong place,
           and the only way to aim it is the select-first dance. Two repairs:
           (1) Row menus: when the right-clicked row is not the selection,
               intercept the native Paste item, select that row (same retry
               cadence as the undo restore — the tree can be mid-re-render),
               then re-drive the native Paste on it.
           (2) The empty area below the tree gets a small menu of its own with
               "Paste at top level": clear the selection so the native
               fall-back-to-root path runs.
           Both routes end in the REAL native Paste channel — a raw store insert
           would not survive a save. The paste target row is tracked here rather
           than through contextTarget() so the feature works with every other
           context-menu feature switched off. */
        let dbePasteCtxRow = null; // tree-row id the current menu was opened on, or null

        /* The native Paste item of the open tree menu, when our re-target should
           take over; null when native paste already does the right thing. */
        function dbePasteNativeItem(e) {
            const li = e.target && e.target.closest && e.target.closest('dialog.uniBuilderContextMenu[open] li.uniContextMenu__item');
            if (!li || li.classList.contains('dbe-ctx-item')) { return null; }
            // Auto-driven menus (undo restore, wrap, our own re-drive) are exempt.
            if (document.documentElement.classList.contains('dbe-auto-ctx')) { return null; }
            if (nativeCtxLabel(li) !== 'Paste') { return null; }
            if (!dbePasteCtxRow || activeId() === dbePasteCtxRow) { return null; }
            return li;
        }

        /* Snapshot the module map now; the returned function polls for a pasted
           module under parentId and toasts when nothing arrives (an empty or
           foreign clipboard makes native Paste a silent no-op). */
        function dbeWatchPasteResult(parentId) {
            const beforeIds = Object.keys(modules() || {});
            return function () {
                waitFor(() => {
                    const mods = modules() || {};
                    return Object.keys(mods).find((id) => {
                        return beforeIds.indexOf(id) === -1 && (mods[id].parent || '') === parentId;
                    }) || null;
                }, (newId) => {
                    if (!newId) { undoToast(dbeT('pasteNothing', 'Nothing to paste: copy an element first')); }
                });
            };
        }

        function dbePasteInto(targetId) {
            let attempts = 0;
            (function sel() {
                const row = document.querySelector('.uniRightPanel .uni-tree-node-' + targetId);
                if (row) { clickSeq(row); }
                waitFor(() => { return activeId() === targetId || null; }, (ok) => {
                    if (!ok) {
                        if (++attempts < 4) { sel(); }
                        else { undoToast(dbeT('pasteSelectFailed', 'Paste failed: could not select the element')); }
                        return;
                    }
                    const settled = dbeWatchPasteResult(targetId);
                    driveContextMenuItem(targetId, 'Paste', (done) => {
                        if (!done) { undoToast(dbeT('pasteMenuFailed', 'Paste failed: could not reach Paste')); return; }
                        settled();
                    });
                }, 20);
            })();
        }

        function dbePasteAtRoot() {
            // Any row's menu will do — with no active module, native Paste falls
            // back to root (the same channel the root-level undo restore uses).
            const anyRow = document.querySelector('.uniRightPanel .uniModTree__item');
            const m = anyRow && anyRow.className.toString().match(/uni-tree-node-(\w+)/);
            if (!m) { undoToast(dbeT('pasteNoRows', 'Paste at top level needs at least one element in the tree')); return; }
            try { store().storeSet('activeModule', ''); } catch (e) {}
            const settled = dbeWatchPasteResult('');
            driveContextMenuItem(m[1], 'Paste', (done) => {
                if (!done) { undoToast(dbeT('pasteMenuFailed', 'Paste failed: could not reach Paste')); return; }
                settled();
            });
        }

        function bindPasteTarget() {
            // Which row (if any) the menu-opening right-click landed on. Cleared
            // when the menu hides, so a menu that arrives by another route (e.g.
            // a stale id from an earlier right-click) can never misdirect a paste.
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'paste-target-context', 'contextmenu', (e) => {
                if (document.documentElement.classList.contains('dbe-auto-ctx')) { return; }
                const btn = e.target && e.target.closest && e.target.closest('.uniModTree__item');
                const m = btn && btn.className.toString().match(/uni-tree-node-(\w+)/);
                dbePasteCtxRow = m ? m[1] : null;
            }, true);
            dbeBindOwnedHook(DBE_COMMANDS_OWNER, 'builderius.contextMenu.hide', 'dbePasteCtx', () => { dbePasteCtxRow = null; });
            // Swallow the whole activation sequence: the native item may act on
            // any of these, and the menu keyboard model activates through the
            // same synthetic chain (clickSeq); the flow itself runs on click.
            ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach((t) => {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'paste-target-' + t, t, (e) => {
                    if (dbePasteNativeItem(e)) { e.preventDefault(); e.stopPropagation(); }
                }, true);
            });
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'paste-target-click', 'click', (e) => {
                if (!dbePasteNativeItem(e)) { return; }
                e.preventDefault();
                e.stopPropagation();
                const target = dbePasteCtxRow; // read before the hide hook clears it
                try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (err) {}
                dbePasteInto(target);
            }, true);
        }

        function bindTreeAreaMenu() {
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'tree-area-menu', 'contextmenu', (e) => {
                if (document.documentElement.classList.contains('dbe-auto-ctx')) { return; }
                const t = e.target;
                if (!t || !t.closest) { return; }
                // Only the tree's empty container area — rows keep the native menu,
                // and header buttons / the tree-search input keep their own roles.
                if (!t.closest('.uniRightPanel .uniModTree__container')) { return; }
                if (t.closest('.uniModTree__item, button, input, a')) { return; }
                e.preventDefault();
                e.stopPropagation();
                const focusReturn = document.querySelector('.uniRightPanel .uniModTree__item[tabindex="0"]');
                renderChipCard(focusReturn, e.clientX, e.clientY, [
                    { label: dbeT('pasteAtTop', 'Paste at top level'), fn: dbePasteAtRoot }
                ], dbeT('navigatorAreaMenu', 'Navigator actions'));
            }, true);
        }

        /* --- Branching actions in the native tree context menu --- */

        function removeSubmenus() {
            document.querySelectorAll('.dbe-ctx-submenu').forEach((el) => { el.remove(); });
            document.querySelectorAll('.dbe-ctx-parent[aria-expanded="true"]').forEach((li) => {
                li.setAttribute('aria-expanded', 'false');
            });
        }

        /* Close the native context menu and any DBE submenus — the pair every
           injected item's activation ends with. One copy, so a fix to the close
           recipe can never miss a site again. */
        function closeCtxMenu() {
            removeSubmenus();
            try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
        }

        function positionFlyout(fly, parentLi) {
            const pr = parentLi.getBoundingClientRect();
            const fw = fly.offsetWidth || 176;
            const maxHeight = window.innerHeight - 16;
            if (fly.offsetHeight > maxHeight) {
                fly.style.setProperty('max-height', maxHeight + 'px', 'important');
                fly.style.setProperty('overflow-y', 'auto', 'important');
            }
            const fh = Math.min(fly.offsetHeight || 120, maxHeight);
            let left = pr.right + 2;
            if (left + fw > window.innerWidth - 8) { left = pr.left - fw - 2; } // flip to the left near the edge
            if (left < 8) { left = 8; }
            let top = pr.top - 6;
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
            const margin = 8;
            const avail = window.innerHeight - margin * 2;
            // Drop any cap left from a previous open so we measure the natural height.
            dialog.style.removeProperty('max-height');
            dialog.style.removeProperty('overflow-y');
            const h = dialog.offsetHeight; // forces reflow — rows are already appended
            let top = parseFloat(dialog.style.top);
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

        function makeFlyout(items, labelText) {
            // Rebuild the native menu wrapper chain so the flyout inherits the card
            // styling and the .uniContextMenu list/item resets.
            const fly = document.createElement('div');
            fly.className = 'uniBuilderContextMenu dbe-ctx-submenu';
            const inner = document.createElement('div');
            inner.className = 'uniBuilderContextMenu__inner';
            const menu = document.createElement('div');
            menu.className = 'uniContextMenu';
            menu.setAttribute('role', 'menu');
            menu.setAttribute('aria-label', labelText);
            const ul = document.createElement('ul');
            items.forEach((li) => {
                li.tabIndex = -1; // roving tabindex — the keydown handler moves focus
                ul.appendChild(li);
            });
            menu.appendChild(ul);
            inner.appendChild(menu);
            fly.appendChild(inner);
            return fly;
        }

        let lastFlyoutParent = null;

        function dbeSvgIcon(name, className) {
            const ns = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(ns, 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');
            svg.setAttribute('class', className || '');
            function shape(tag, attrs) {
                const el = document.createElementNS(ns, tag);
                Object.keys(attrs).forEach((key) => { el.setAttribute(key, attrs[key]); });
                svg.appendChild(el);
            }
            const icons = {
                'arrow-up': [['path', { d: 'M12 19V5' }], ['path', { d: 'm5 12 7-7 7 7' }]],
                'arrow-down': [['path', { d: 'M12 5v14' }], ['path', { d: 'm19 12-7 7-7-7' }]],
                'indent-increase': [['path', { d: 'M3 6h18' }], ['path', { d: 'M3 12h8' }], ['path', { d: 'M3 18h18' }], ['path', { d: 'm15 9 3 3-3 3' }]],
                'indent-decrease': [['path', { d: 'M3 6h18' }], ['path', { d: 'M13 12h8' }], ['path', { d: 'M3 18h18' }], ['path', { d: 'm9 9-3 3 3 3' }]],
                'parent': [['path', { d: 'm9 14-5-5 5-5' }], ['path', { d: 'M4 9h10a6 6 0 0 1 6 6v1' }]],
                'panels': [['rect', { x: '3', y: '4', width: '18', height: '16', rx: '2' }], ['path', { d: 'M9 4v16' }], ['path', { d: 'M15 4v16' }]],
                'panel-left': [['rect', { x: '3', y: '4', width: '18', height: '16', rx: '2' }], ['path', { d: 'M9 4v16' }]],
                'panel-right': [['rect', { x: '3', y: '4', width: '18', height: '16', rx: '2' }], ['path', { d: 'M15 4v16' }]],
                'pointer': [['path', { d: 'm5 3 14 9-6 2-3 6-5-17Z' }]],
                'dashboard': [['rect', { x: '3', y: '3', width: '7', height: '9', rx: '1' }], ['rect', { x: '14', y: '3', width: '7', height: '5', rx: '1' }], ['rect', { x: '14', y: '12', width: '7', height: '9', rx: '1' }], ['rect', { x: '3', y: '16', width: '7', height: '5', rx: '1' }]],
                'package': [['path', { d: 'm21 8-9-5-9 5 9 5 9-5Z' }], ['path', { d: 'M3 8v8l9 5 9-5V8' }], ['path', { d: 'M12 13v8' }]],
                'settings': [['path', { d: 'M4 21v-7' }], ['path', { d: 'M4 10V3' }], ['path', { d: 'M12 21v-9' }], ['path', { d: 'M12 8V3' }], ['path', { d: 'M20 21v-5' }], ['path', { d: 'M20 12V3' }], ['path', { d: 'M1 14h6' }], ['path', { d: 'M9 8h6' }], ['path', { d: 'M17 16h6' }]]
            };
            (icons[name] || []).forEach((part) => { shape(part[0], part[1]); });
            return svg;
        }

        function makeParent(labelText, first, itemsFactory, disabled, disabledReason) {
            const li = document.createElement('li');
            li.className = 'uniContextMenu__item dbe-ctx-item dbe-ctx-parent' + (first ? ' dbe-ctx-item--first' : '');
            li.setAttribute('role', 'menuitem');
            li.setAttribute('aria-haspopup', 'true');
            li.setAttribute('aria-expanded', 'false');
            const label = document.createElement('span');
            label.textContent = labelText;
            const caret = document.createElement('span');
            caret.className = 'dbe-ctx-caret';
            caret.textContent = '›'; // ›
            li.appendChild(label);
            li.appendChild(caret);
            if (disabled) {
                li.classList.add('disabled', 'dbe-ctx-disabled');
                li.setAttribute('aria-disabled', 'true');
                dbeSetDisabledReason(li, labelText, disabledReason);
                return li; // no flyout wiring: not hoverable, not keyboard-openable
            }
            function openFlyout() {
                removeSubmenus();
                const fly = makeFlyout(itemsFactory(), labelText);
                // The native menu is a <dialog> shown with showModal(): it paints in
                // the top layer (above any z-index) and everything OUTSIDE it is
                // inert. A sibling flyout is therefore visible but can never receive
                // a hover or click — the close timer always wins. Appending INSIDE
                // the dialog puts the flyout in the modal subtree: hoverable,
                // focusable, and painted in the top layer with the menu. The dialog
                // has no transform/filter, so position:fixed stays viewport-based.
                const nativeMenu = document.querySelector('.uniBuilderContextMenu:not(.dbe-ctx-submenu)');
                const host = nativeMenu || document.body;
                host.appendChild(fly);
                positionFlyout(fly, li);
                li.setAttribute('aria-expanded', 'true');
                lastFlyoutParent = li;
                return fly;
            }
            li._dbeOpenFlyout = openFlyout; // keyboard channel (Enter / ArrowRight)
            // Builderius 1.3.6 opens its native Wrap in and Save to branches on
            // click. Follow that model for DBE branches too: mixed hover/click
            // menus make the caret's behaviour unpredictable, and click works
            // equally for mouse, touch and keyboard users. A second click closes
            // the open branch; Enter and ArrowRight still call openFlyout above.
            li.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                if (li.getAttribute('aria-expanded') === 'true') {
                    removeSubmenus();
                    return;
                }
                openFlyout();
            });
            li.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); });
            return li;
        }

        /* A plain injected leaf item. Mirrors the inline Rename / Auto-BEM pattern:
           mousedown closes the menu, then runs the action. A disabled item renders
           greyed and non-interactive, but remains in the roving keyboard sequence
           so users can discover it and hear why it is unavailable. */
        function makeCtxItem(labelText, onActivate, opts) {
            opts = opts || {};
            const li = document.createElement('li');
            li.className = 'uniContextMenu__item dbe-ctx-item';
            if (opts.className) { li.classList.add(opts.className); }
            li.setAttribute('role', 'menuitem');
            if (opts.icon) {
                const label = document.createElement('span');
                label.className = 'dbe-ctx-label';
                label.appendChild(dbeSvgIcon(opts.icon, 'dbe-ctx-icon'));
                label.appendChild(document.createTextNode(labelText));
                li.appendChild(label);
            } else {
                li.textContent = labelText;
            }
            if (opts.accel) {
                // Right-aligned shortcut hint, mirroring the block editor's menu.
                li.classList.add('dbe-ctx-item--accel');
                const acc = document.createElement('span');
                acc.className = 'dbe-ctx-accel';
                acc.textContent = opts.accel;
                acc.setAttribute('aria-hidden', 'true');
                li.appendChild(acc);
            }
            if (opts.disabled) {
                li.classList.add('disabled', 'dbe-ctx-disabled');
                li.setAttribute('aria-disabled', 'true');
                dbeSetDisabledReason(li, labelText, opts.tip);
                return li;
            }
            li.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                closeCtxMenu();
                onActivate();
            });
            return li;
        }

        /* Append a right-aligned shortcut hint to the native menu rows that have one
           (Duplicate is our shortcut; Copy/Paste/Remove are Builderius'), so they read
           like the injected rows and the block editor's menu. Matched by the English
           labels the plugin already drives the native menu by. Idempotent. */
        function annotateNativeCtxAccels(container) {
            const map = {
                Duplicate: dbeAccel('D', { cmd: true, shift: true }),
                Copy: dbeAccel('C', { cmd: true }),
                Paste: dbeAccel('V', { cmd: true }),
                Remove: dbeT('accelDelete', 'Del')
            };
            [].slice.call(container.querySelectorAll('.uniContextMenu__item')).forEach((li) => {
                if (li.querySelector('.dbe-ctx-accel')) { return; }
                const accel = map[(li.textContent || '').trim()];
                if (!accel) { return; }
                li.classList.add('dbe-ctx-item--accel');
                const s = document.createElement('span');
                s.className = 'dbe-ctx-accel';
                s.textContent = accel;
                s.setAttribute('aria-hidden', 'true');
                li.appendChild(s);
            });
        }

        function makeWrapItem(type, labelText) {
            const li = document.createElement('li');
            li.className = 'uniContextMenu__item';
            li.setAttribute('role', 'menuitem');
            li.setAttribute('aria-disabled', 'false');
            li.textContent = labelText;
            li.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                wrap(type, multiCtxIds());
                closeCtxMenu();
            });
            return li;
        }

        function dbePositionNativeWrapDialog(dialog, targetId) {
            if (!dialog) { return; }
            dialog.classList.add('dbe-wrap-in-anchored');

            /* Read live Navigator geometry each time instead of retaining the
               vanished context-menu row's pixels. Browser zoom changes the CSS
               viewport, so resize-driven recalculation and explicit clamping
               keep the dialog beside the panel and fully on screen. */
            const gap = 6;
            const margin = 8;
            const panel = document.querySelector('.uniRightPanel');
            const row = document.querySelector('.uniRightPanel .uni-tree-node-' + targetId);
            const panelRect = panel ? panel.getBoundingClientRect() : null;
            const rowRect = row ? row.getBoundingClientRect() : null;
            const dialogRect = dialog.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const anchorLeft = panelRect ? panelRect.left : (rowRect ? rowRect.left : viewportWidth);
            const anchorRight = panelRect ? panelRect.right : (rowRect ? rowRect.right : viewportWidth);
            let left = anchorLeft - dialogRect.width - gap;
            if (left < margin) { left = anchorRight + gap; }
            left = Math.max(margin, Math.min(left, viewportWidth - dialogRect.width - margin));

            const rowIsVisible = rowRect && rowRect.bottom > 0 && rowRect.top < viewportHeight;
            const centreY = rowIsVisible ? rowRect.top + rowRect.height / 2 : viewportHeight / 2;
            let top = centreY - dialogRect.height / 2;
            top = Math.max(margin, Math.min(top, viewportHeight - dialogRect.height - margin));
            dialog.style.setProperty('left', Math.round(left) + 'px', 'important');
            dialog.style.setProperty('top', Math.round(top) + 'px', 'important');
            dialog.style.setProperty('right', 'auto', 'important');
            dialog.style.setProperty('bottom', 'auto', 'important');
        }

        /* Builderius 1.3.6 owns Div, Template and Collection wrapping through a
           native mini-modal. Keep those handlers authoritative, but add DBE's
           Figure wrapper as a fourth, native-looking choice instead of leaving
           it as an unrelated top-level context-menu command. The modal is
           created afresh after the native row activates, so decorate each open. */
        function dbeDecorateNativeWrapDialog(dialog, targetId) {
            if (!dialog || !targetId) { return; }
            dbeRememberOwnedAttributes(DBE_COMMANDS_OWNER, dialog, ['aria-label', 'data-dbe-wrap-keyboard']);
            dialog.setAttribute('aria-label', dbeT('wrapIn', 'Wrap in'));
            dbePositionNativeWrapDialog(dialog, targetId);
            function scheduleWrapDialogPosition() {
                dbeSetOwnedFrame(DBE_COMMANDS_OWNER, () => {
                    if (dialog.open) { dbePositionNativeWrapDialog(dialog, targetId); }
                });
            }
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, window, 'wrap-dialog-resize', 'resize', scheduleWrapDialogPosition);
            if (window.visualViewport) {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, window.visualViewport, 'wrap-dialog-visual-resize', 'resize', scheduleWrapDialogPosition);
            }
            const close = dialog.querySelector('.uniMiniModal__header > .uniIconButton');
            if (close) {
                dbeRememberOwnedAttributes(DBE_COMMANDS_OWNER, close, ['aria-label']);
                close.setAttribute('aria-label', dbeT('close', 'Close'));
            }
            const options = dialog.querySelector('.uniWrapInModal__options');
            if (!options) { return; }
            let button = options.querySelector('.dbe-wrap-in-figure');
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'uniPanelButtonTertiaryOutlined uniWrapInModal__option dbe-wrap-in-figure';
                const label = document.createElement('span');
                label.textContent = dbeT('figureLabel', 'Figure');
                button.appendChild(label);
                button.appendChild(document.createElement('span'));
                button.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const closeButton = dialog.querySelector('.uniMiniModal__header > .uniIconButton');
                    if (closeButton) { clickSeq(closeButton); }
                    else { try { dialog.close(); } catch (e) {} }
                    dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => { wrap('figure', [targetId]); }, 80);
                });
                options.appendChild(button);
            }
            if (dialog.getAttribute('data-dbe-wrap-keyboard') !== '1') {
                dialog.setAttribute('data-dbe-wrap-keyboard', '1');
                const choices = [].slice.call(options.querySelectorAll('.uniWrapInModal__option'));
                const focusables = choices.concat(close ? [close] : []);
                let focusReturnQueued = false;
                function releaseWrapDialogEvents() {
                    dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, dialog, 'wrap-dialog-key');
                    dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, dialog, 'wrap-dialog-cancel');
                    dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, dialog, 'wrap-dialog-close');
                    if (close) { dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, close, 'wrap-dialog-close-return'); }
                    choices.forEach((choice, index) => {
                        dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, choice, 'wrap-dialog-choice-return-' + index);
                    });
                    dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, window, 'wrap-dialog-resize');
                    if (window.visualViewport) {
                        dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, window.visualViewport, 'wrap-dialog-visual-resize');
                    }
                }
                function returnWrapDialogFocus() {
                    if (focusReturnQueued) { return; }
                    focusReturnQueued = true;
                    dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => {
                        releaseWrapDialogEvents();
                        const row = document.querySelector('.uniRightPanel .uni-tree-node-' + targetId);
                        if (row) { try { row.focus(); } catch (e) {} }
                    }, 120);
                }
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, dialog, 'wrap-dialog-key', 'keydown', (ev) => {
                    if (ev.key === 'Escape') {
                        returnWrapDialogFocus();
                        return;
                    }
                    if (ev.key !== 'Tab') { return; }
                    if (!focusables.length) { return; }
                    let at = focusables.indexOf(document.activeElement);
                    if (at < 0) { at = 0; }
                    ev.preventDefault();
                    const next = (at + (ev.shiftKey ? focusables.length - 1 : 1)) % focusables.length;
                    focusables[next].focus();
                });
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, dialog, 'wrap-dialog-cancel', 'cancel', () => {
                    returnWrapDialogFocus();
                });
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, dialog, 'wrap-dialog-close', 'close', returnWrapDialogFocus);
                if (close) {
                    dbeBindOwnedEvent(DBE_COMMANDS_OWNER, close, 'wrap-dialog-close-return', 'click', returnWrapDialogFocus);
                }
                choices.forEach((choice, index) => {
                    dbeBindOwnedEvent(DBE_COMMANDS_OWNER, choice, 'wrap-dialog-choice-return-' + index, 'click', returnWrapDialogFocus);
                });
            }
            // Start on the task rather than the dismiss control. Shift+Tab still
            // reaches Close immediately, and the modal cycle above contains focus.
            dbeSetOwnedFrame(DBE_COMMANDS_OWNER, () => {
                const first = options.querySelector('.uniWrapInModal__option');
                if (dialog.open && first) { first.focus(); }
            });
        }

        function dbeWatchNativeWrapDialog(targetId) {
            waitFor(() => {
                return document.querySelector('dialog.uniMiniModal--wrapIn[open]');
            }, (dialog) => {
                if (dialog) { dbeDecorateNativeWrapDialog(dialog, targetId); }
            }, 40, DBE_COMMANDS_OWNER);
        }

        function dbeEnhanceNativeWrapItem(item, targetId) {
            if (!item || item.getAttribute('data-dbe-wrap-dialog') === '1') { return; }
            dbeRememberOwnedAttributes(DBE_COMMANDS_OWNER, item, ['data-dbe-wrap-dialog']);
            item.setAttribute('data-dbe-wrap-dialog', '1');
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, item, 'wrap-dialog-open', 'mousedown', () => {
                dbeWatchNativeWrapDialog(targetId);
            });
        }

        /* Builderius 1.3.6 turns an absent/default label into "<tag>" and then
           renders that beside a separate "<tag>" badge in native Auto-BEM.
           Suppress only that redundant second copy; user-defined labels stay. */
        function dbeNormaliseNativeAutoBemLabels(dialog) {
            if (!dialog) { return; }
            [].slice.call(dialog.querySelectorAll('.uniAutoBemModal__row')).forEach((row) => {
                const tag = row.querySelector('.uniAutoBemModal__rowTag');
                const label = row.querySelector('.uniAutoBemModal__rowLabel');
                if (!tag || !label) { return; }
                const tagText = (tag.textContent || '').replace(/[<>]/g, '').trim().toLowerCase();
                const labelText = (label.textContent || '').replace(/[<>]/g, '').trim().toLowerCase();
                if (tagText && labelText === tagText) {
                    label.hidden = true;
                    label.setAttribute('data-dbe-auto-bem-default-label', '1');
                }
            });
        }

        function dbeWatchNativeAutoBemDialog() {
            waitFor(() => {
                const dialog = document.querySelector('dialog.uniMiniModal--autoBem[open]');
                return dialog && dialog.querySelector('.uniAutoBemModal__row') ? dialog : null;
            }, dbeNormaliseNativeAutoBemLabels, 40, DBE_COMMANDS_OWNER);
        }

        /* Expand the right-clicked row's whole subtree. Same chevron click channel
           as expandAll, scoped to the row's li; runs in short passes because deep
           rows that were never expanded may only mount after their parent opens. */
        /* Repeatedly click every collapsed chevron under `rootEl` until none
           remain — each pass triggers async re-renders that can mount previously
           hidden collapsed rows, hence the multi-pass loop. Bounded at 10 passes.
           Shared by "Expand children" and the Navigator's expand-all button. */
        function dbeExpandPass(rootEl) {
            let passes = 0;
            (function pass() {
                const chevs = [];
                rootEl.querySelectorAll('button.uniModTree__item:not(.expanded)').forEach((btn) => {
                    const chev = btn.querySelector('i');
                    if (chev) { chevs.push(chev); }
                });
                if (!chevs.length || passes >= 10) { return; }
                passes += 1;
                chevs.forEach((chev) => { clickSeq(chev); });
                setTimeout(pass, 120);
            })();
        }

        function expandSubtree(id) {
            const rowBtn = id && document.querySelector('.uniRightPanel .uni-tree-node-' + id);
            const root = rowBtn && rowBtn.closest('li.uniModTree__itemDrag');
            if (!root) { return; }
            dbeExpandPass(root);
        }

        /* Keyboard support for the context menu (APG menu pattern). The native menu
           is mouse-only; a roving tabindex plus this handler adds Up/Down/Home/End
           navigation, Enter/Space activation, ArrowRight/Enter to open a submenu
           (focus moves to its first item), and ArrowLeft/Escape to come back to the
           parent. Escape at the top level falls through to the dialog's native
           cancel. Activation dispatches the same pointer-event sequence the mouse
           produces, so native and injected items behave identically. Disabled
           actions remain focusable but cannot activate; non-action heading and
           selection-note rows stay outside the roving sequence. */
        function menuScopeItems(dialog, li) {
            const fly = li && li.closest('.dbe-ctx-submenu');
            const root = fly || dialog;
            return [].slice.call(root.querySelectorAll('li.uniContextMenu__item')).filter((item) => {
                if (item.classList.contains('dbe-ctx-heading') || item.classList.contains('dbe-ctx-note')) { return false; }
                return fly ? true : !item.closest('.dbe-ctx-submenu');
            });
        }

        function onMenuKeydown(ev) {
            const dialog = ev.currentTarget;
            const li = ev.target && ev.target.closest ? ev.target.closest('li.uniContextMenu__item') : null;
            const inFly = !!(li && li.closest('.dbe-ctx-submenu'));
            let items, idx, handled = true;

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
                    if (li && li.getAttribute('aria-disabled') === 'true') {
                        break;
                    } else if (li && !inFly && typeof li._dbeOpenFlyout === 'function') {
                        const fly = li._dbeOpenFlyout();
                        const firstItem = fly && fly.querySelector('li.uniContextMenu__item');
                        if (firstItem) { firstItem.focus(); }
                    } else { handled = false; }
                    break;
                case 'ArrowLeft':
                case 'Escape':
                    if (inFly) {
                        const parent = lastFlyoutParent;
                        removeSubmenus();
                        if (parent) { parent.focus(); }
                    } else { handled = false; } // Escape falls through: dialog cancel closes the menu
                    break;
                case 'Enter':
                case ' ':
                    if (li && li.getAttribute('aria-disabled') === 'true') {
                        break;
                    } else if (li && typeof li._dbeOpenFlyout === 'function') {
                        const fly2 = li._dbeOpenFlyout();
                        const firstItem2 = fly2 && fly2.querySelector('li.uniContextMenu__item');
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
            const dialog = container.closest('dialog') || container.closest('.uniBuilderContextMenu');
            if (!dialog) { return; }
            [].slice.call(dialog.querySelectorAll('li.uniContextMenu__item')).forEach((li) => {
                li.tabIndex = -1;
                if (li.classList.contains('disabled') && li.getAttribute('aria-disabled') !== 'true') {
                    li.setAttribute('aria-disabled', 'true');
                }
            });
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, dialog, 'context-menu-keys', 'keydown', onMenuKeydown, true);
            // Focus the first action so a Shift+F10 / Menu-key open is usable;
            // after a right-click :focus-visible stays off, so no ring for mouse
            // users. Skipped while undo/redo is auto-driving a hidden menu.
            if (document.documentElement.classList.contains('dbe-auto-ctx')) { return; }
            const first = menuScopeItems(dialog, null)[0];
            if (first) { first.focus(); }
        }

        /* Collect native menu items whose text matches `regex` (never our own
           .dbe-ctx-item rows), detached from the list. Re-parenting a native li
           keeps its React handlers alive — events delegate from an ancestor — as
           the original "Save to" collector proved. An empty result means the
           native item text drifted (new Builderius version / locale): callers must
           treat that as "leave the menu as it is". */
        function collectNativeItems(container, regex) {
            const items = [].slice.call(container.querySelectorAll('.uniContextMenu__item'))
                .filter((li) => {
                    return regex.test(nativeCtxLabel(li)) && !li.classList.contains('dbe-ctx-item');
                });
            items.forEach((li) => { li.parentNode && li.parentNode.removeChild(li); });
            return items;
        }

        function nativeContextItem(container, regex) {
            return [].slice.call(container.querySelectorAll('.uniContextMenu__item'))
                .find((li) => {
                    return !li.classList.contains('dbe-ctx-item') && regex.test(nativeCtxLabel(li));
                }) || null;
        }

        /* The element context menu. With context_menu ON the items are re-laid into
           logical clusters with compact flyouts for insert, move/navigation and
           advanced tools. Frequent actions remain flat; branching and lower-use
           actions stay one arrow-key step away. Native items keep their React
           handlers when re-parented. With context_menu OFF the injected items are
           appended after the untouched native ones. */
        function onContextMenuShow() {
            dbeSetOwnedFrame(DBE_COMMANDS_OWNER, () => {
                removeSubmenus();
                // While a feature is auto-driving the native menu (wrap's Paste,
                // multi-remove's Remove — driveContextMenuItem sets .dbe-auto-ctx),
                // leave the menu exactly as Builderius rendered it. The regrouping
                // below folds the native Copy/Paste/Remove into hover-only flyouts,
                // which the auto-driver can't reach — that is what broke wrapping in
                // a div/collection (the Paste channel), while wrap-in-template, which
                // never touches the menu, kept working.
                if (document.documentElement.classList.contains('dbe-auto-ctx')) { return; }
                const anyItem = document.querySelector('.uniContextMenu__item');
                if (!anyItem) { return; }
                const container = anyItem.parentElement;
                if (!container || container.querySelector('.dbe-ctx-parent') || container.hasAttribute('data-dbe-flat')) { return; }
                if (!/Duplicate|Create Component/.test(container.textContent || '')) { return; }

                // The <dialog> we're about to grow — re-clamped into view once the
                // extra rows are in (fitContextMenu), on every exit path below.
                const ctxDialog = container.closest('dialog') || container.closest('.uniBuilderContextMenu');

                const grouped = on('context_menu');

                // Restyle the native "Actions" header row as a group heading (all
                // caps, muted — the same treatment as the multi-select note row).
                if (grouped) {
                    [].slice.call(container.querySelectorAll('.uniContextMenu__item.disabled')).forEach((li) => {
                        if ((li.textContent || '').trim() === 'Actions') { li.classList.add('dbe-ctx-heading'); }
                    });
                }

                // Multi-selection this menu acts on (null = normal single-row menu).
                const multiIds = multiCtxIds();
                if (multiIds) {
                    const note = document.createElement('li');
                    note.className = 'uniContextMenu__item disabled dbe-ctx-note';
                    note.setAttribute('aria-disabled', 'true');
                    note.textContent = multiIds.length + ' elements selected';
                    container.insertBefore(note, container.firstChild);
                    // Single-target native actions don't apply to a multi-selection.
                    [].slice.call(container.querySelectorAll('.uniContextMenu__item')).forEach((li) => {
                        if (/^(Duplicate|Copy|Paste|Cut|Rename|Auto-BEM|Wrap in|Remove|Create Component)$/.test(nativeCtxLabel(li))) {
                            disableCtxItem(li, dbeT('singleElementOnly', 'Available when one element is selected'));
                        }
                    });
                }

                // Preview opens reuse this exact Navigator menu. Give that
                // pointer-distant surface a visible target heading containing
                // both the Navigator label and rendered tag, while the normal
                // row menu keeps Builderius' native “Actions” heading.
                const previewHeading = dbePreviewContextState && dbePreviewContextState.id === contextTarget()
                    ? dbePreviewContextHeading()
                    : '';
                if (previewHeading) {
                    let targetHeading = [].slice.call(container.querySelectorAll('.uniContextMenu__item.disabled')).filter((li) => {
                        return (li.textContent || '').trim() === 'Actions';
                    })[0];
                    if (!targetHeading) {
                        targetHeading = document.createElement('li');
                        targetHeading.className = 'uniContextMenu__item disabled';
                        targetHeading.setAttribute('aria-disabled', 'true');
                        container.insertBefore(targetHeading, container.firstChild);
                    }
                    targetHeading.textContent = previewHeading;
                    targetHeading.classList.add('dbe-ctx-heading', 'dbe-preview-ctx-heading');
                    if (ctxDialog) {
                        dbeBindOwnedEvent(DBE_COMMANDS_OWNER, ctxDialog, 'preview-context-close', 'close', () => {
                            dbeDiscardPreviewContext(true);
                        }, { once: true });
                    }
                }

                // Name both the enhanced flat menu and the untouched native
                // fallback. This runs before the grouped/ungrouped branch so
                // the preview feature remains independent of context_menu.
                const menuEl = container.closest('[role="menu"]') || (ctxDialog && ctxDialog.querySelector('[role="menu"]'));
                if (menuEl) {
                    const ctxModsForLabel = modules() || {};
                    const ctxModForLabel = contextTarget() && ctxModsForLabel[contextTarget()];
                    const ctxTargetLabel = previewHeading || (ctxModForLabel && (ctxModForLabel.label || defaultLabelFor(contextTarget())));
                    menuEl.setAttribute('aria-label', multiIds
                        ? dbeFmt(dbeT('selectedElementsActions', 'Actions for %s selected elements'), multiIds.length)
                        : dbeFmt(dbeT('elementActionsFor', 'Actions for %s'), ctxTargetLabel || dbeT('element', 'element')));
                }

                /* --- Build the injected items (appended flat or grouped below) --- */

                // Navigator menus retain inline rename; preview menus use the
                // explicit Navigator-name dialog when the 2.1 candidate is on.
                const nameItems = [];
                const advancedItems = [];
                const previewRenamePath = !!previewHeading && on('preview_rename');
                const previewRenameTarget = previewRenamePath && dbePreviewContextState
                    ? dbePreviewContextState.element : null;
                if (!multiIds && (on('inline_rename') || previewRenamePath)) {
                    const renameLi = document.createElement('li');
                    renameLi.className = 'uniContextMenu__item dbe-ctx-item';
                    renameLi.setAttribute('role', 'menuitem');
                    renameLi.textContent = dbeT('rename', 'Rename');
                    if (on('keyboard_shortcuts') || previewRenamePath) {
                        renameLi.classList.add('dbe-ctx-item--accel');
                        const renameAcc = document.createElement('span');
                        renameAcc.className = 'dbe-ctx-accel';
                        renameAcc.textContent = 'F2';
                        renameAcc.setAttribute('aria-hidden', 'true');
                        renameLi.appendChild(renameAcc);
                    }
                    renameLi.addEventListener('mousedown', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        const id = contextTarget() || activeId();
                        const renderedTarget = previewRenameTarget;
                        if (renderedTarget) { dbeDiscardPreviewContext(false); }
                        closeCtxMenu();
                        if (renderedTarget) {
                            dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => {
                                dbeOpenPreviewRename(id, renderedTarget);
                            }, 0);
                        } else {
                            startRename(id);
                        }
                    });
                    nameItems.push(renameLi);

                    // "Reset label" — back to the builder default (the HTML tag).
                    // Only offered when the label actually differs from it.
                    const ctxMods = modules();
                    const ctxDefault = defaultLabelFor(contextTarget());
                    if (ctxDefault && ctxMods && ctxMods[contextTarget()] &&
                        (ctxMods[contextTarget()].label || '') !== ctxDefault) {
                        const resetLi = document.createElement('li');
                        resetLi.className = 'uniContextMenu__item dbe-ctx-item';
                        resetLi.setAttribute('role', 'menuitem');
                        resetLi.textContent = dbeT('resetLabel', 'Reset label');
                        resetLi.addEventListener('mousedown', (ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            const id = contextTarget();
                            closeCtxMenu();
                            commitRename(id, ctxDefault);
                            undoToast(dbeFmt(dbeT('labelResetTo', 'Label reset to <%s>'), ctxDefault));
                        });
                        nameItems.push(resetLi);
                    }
                }

                // "Auto-BEM" -> the class-naming dialog. Offered on any element that
                // can hold a tagClass (decided from the module, not a canvas node, so
                // an unpainted element still qualifies); components / templates can't.
                if (!multiIds && on('auto_bem')) {
                    const bemMods = modules();
                    const bemMod = bemMods && contextTarget() && bemMods[contextTarget()];
                    if (bemClassable(bemMod)) {
                        const bemLi = document.createElement('li');
                        bemLi.className = 'uniContextMenu__item dbe-ctx-item';
                        bemLi.setAttribute('role', 'menuitem');
                        bemLi.textContent = dbeT('autoBem', 'Auto-BEM');
                        bemLi.addEventListener('mousedown', (ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            const id = contextTarget();
                            closeCtxMenu();
                            // Let the menu dialog finish closing (it is showModal —
                            // while open our own dialog could not take focus).
                            setTimeout(() => { openAutoBemDialog(id); }, 120);
                        });
                        advancedItems.push(bemLi);
                    }
                }

                // "Expand children" -> open the whole subtree under this row (only
                // offered when the row is expandable, i.e. has a chevron). From
                // Builderius 1.3.6 the native menu owns this action; keep DBE's
                // implementation only as the older-version fallback.
                let expandLi = null;
                const ctxRowBtn = contextTarget() && document.querySelector('.uniRightPanel .uni-tree-node-' + contextTarget());
                const nativeExpandAvailable = !!nativeContextItem(container, /^Expand children$/);
                if (!multiIds && !nativeExpandAvailable && on('collapse_expand_all') && ctxRowBtn && ctxRowBtn.querySelector('i')) {
                    expandLi = document.createElement('li');
                    expandLi.className = 'uniContextMenu__item dbe-ctx-item';
                    expandLi.setAttribute('role', 'menuitem');
                    expandLi.textContent = dbeT('expandChildren', 'Expand children');
                    expandLi.addEventListener('mousedown', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        const id = contextTarget();
                        closeCtxMenu();
                        expandSubtree(id);
                    });
                }

                // "Wrap in" -> div / template / collection. For a multi-selection it
                // wraps all selected elements — possible only when they're siblings.
                const wrapEnabled = on('wrap_in');
                const nativeWrapItem = nativeContextItem(container, /^Wrap in$/);
                const nativeWrapAvailable = !!nativeWrapItem;
                if (!multiIds && wrapEnabled && nativeWrapItem && contextTarget()) {
                    dbeEnhanceNativeWrapItem(nativeWrapItem, contextTarget());
                }
                let wrapDisabled = false;
                if (wrapEnabled && multiIds) {
                    const mods0 = modules() || {};
                    const p0 = mods0[multiIds[0]] && mods0[multiIds[0]].parent;
                    wrapDisabled = multiIds.some((id) => { return !mods0[id] || mods0[id].parent !== p0; });
                }

                // "Remove N elements" (multi only) — native Remove is single-target
                let removeNLi = null;
                if (multiIds) {
                    removeNLi = document.createElement('li');
                    removeNLi.className = 'uniContextMenu__item dbe-ctx-item dbe-ctx-item--first';
                    removeNLi.setAttribute('role', 'menuitem');
                    removeNLi.textContent = dbeFmt(dbeT('deleteNElements', 'Delete %s elements'), multiIds.length);
                    removeNLi.addEventListener('mousedown', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        const ids = multiIds.slice();
                        closeCtxMenu();
                        clearMultiSel(); // the auto-driven per-row menus must be single-target
                        removeMulti(ids);
                    });
                }

                // "Unwrap" (rides on wrap_in) — promote the target's children up a
                // level and drop the empty wrapper. Single-target, needs children.
                let unwrapLi = null;
                if (!multiIds && wrapEnabled && contextTarget()) {
                    const uwIdx = store().storeGet('indexes') || {};
                    const uwKids = [].concat(uwIdx[contextTarget()] || []);
                    const uwMods = modules() || {};
                    const uwHasParent = !!(uwMods[contextTarget()] && (uwMods[contextTarget()].parent || ''));
                    if (uwKids.length && uwHasParent) {
                        (function () {
                            const uid = contextTarget();
                            unwrapLi = makeCtxItem(dbeT('unwrap', 'Unwrap'), () => { unwrap(uid); });
                        })();
                    }
                }

                // Structural moves and parent navigation (element_moves) — single-target.
                let moveUpLi = null, moveDownLi = null, moveInLi = null, moveOutLi = null, selectParentLi = null;
                if (!multiIds && on('element_moves') && contextTarget()) {
                    const emId = contextTarget();
                    const emMods = modules() || {};
                    const emMod = emMods[emId];
                    if (emMod) {
                        const emParent = emMod.parent || '';
                        const emIdx = store().storeGet('indexes') || {};
                        const emSibs = [].concat(emIdx[emParent || 'root'] || []);
                        const emAt = emSibs.indexOf(emId);
                        moveUpLi = makeCtxItem(dbeT('moveUp', 'Move up'), () => { moveSibling(emId, -1); }, {
                            disabled: emAt <= 0, accel: dbeAccel('↑', { alt: true }), icon: 'arrow-up',
                            tip: dbeT('cannotMoveUp', 'Already first among its siblings')
                        });
                        moveDownLi = makeCtxItem(dbeT('moveDown', 'Move down'), () => { moveSibling(emId, 1); }, {
                            disabled: emAt < 0 || emAt >= emSibs.length - 1, accel: dbeAccel('↓', { alt: true }), icon: 'arrow-down',
                            tip: dbeT('cannotMoveDown', 'Already last among its siblings')
                        });
                        moveInLi = makeCtxItem(dbeT('moveIn', 'Move in one level'), () => { indentElement(emId); }, {
                            disabled: !dbeIndentTarget(emId), accel: dbeAccel('→', { alt: true }), icon: 'indent-increase',
                            tip: dbeT('cannotMoveIn', 'Needs a previous sibling that can contain elements')
                        });
                        moveOutLi = makeCtxItem(dbeT('moveOut', 'Move out one level'), () => { outdentElement(emId); }, {
                            disabled: !dbeCanOutdent(emId), accel: dbeAccel('←', { alt: true }), icon: 'indent-decrease',
                            tip: dbeT('cannotMoveOut', 'Already at the outermost available level')
                        });
                        if (emParent) { selectParentLi = makeCtxItem(dbeT('selectParent', 'Select parent'), () => { selectParentOf(emId); }, { icon: 'parent' }); }
                    }
                }

                // Cut + Add before / Add after (keyboard_shortcuts). Cut mirrors the
                // Cmd/Ctrl+X shortcut (native Copy then Remove) on older Builderius;
                // 1.3.6 owns Cut. Add-before/after open the quick element picker
                // (deferred a tick so the menu closes first).
                let cutLi = null, addBeforeLi = null, addAfterLi = null;
                if (!multiIds && on('keyboard_shortcuts') && contextTarget()) {
                    const ksId = contextTarget();
                    if (!nativeContextItem(container, /^Cut$/)) {
                        cutLi = makeCtxItem(dbeT('cut', 'Cut'), () => {
                            driveContextMenuItem(ksId, 'Copy', (ok) => {
                                if (ok) { driveContextMenuItem(ksId, 'Remove', () => { undoToast(dbeT('cutDone', 'Cut element'), 'undo'); }); }
                            });
                        }, { accel: dbeAccel('X', { cmd: true }) });
                    }
                    addBeforeLi = makeCtxItem(dbeT('addBefore', 'Add element before'), () => { setTimeout(() => { openElementPicker(ksId, -1); }, 60); }, { accel: dbeAccel('T', { cmd: true, alt: true }) });
                    addAfterLi = makeCtxItem(dbeT('addAfter', 'Add element after'), () => { setTimeout(() => { openElementPicker(ksId, 1); }, 60); }, { accel: dbeAccel('Y', { cmd: true, alt: true }) });
                }

                // "Edit as HTML" (edit_as_html, Pro) — plain-element subtrees only;
                // otherwise offered disabled with the reason as its tooltip.
                let editHtmlLi = null;
                if (!multiIds && on('edit_as_html') && contextTarget()) {
                    (function () {
                        const ehId = contextTarget();
                        const ehMods = modules() || {};
                        if (!ehMods[ehId]) { return; }
                        const eligible = dbeHtmlEditable(ehId);
                        editHtmlLi = makeCtxItem(dbeT('editAsHtml', 'Edit as HTML'), () => {
                            // Let the menu dialog finish closing (showModal — while
                            // open our own dialog could not take focus).
                            setTimeout(() => { openEditHtmlDialog(ehId); }, 120);
                        }, eligible ? {} : {
                            disabled: true,
                            tip: dbeT('editAsHtmlOnlyElements', 'Only subtrees of plain elements can be edited as HTML')
                        });
                        advancedItems.push(editHtmlLi);
                    })();
                }

                // "Import HTML…" (import_html, Pro) — paste markup, preview, insert.
                // Any plain element target works (voids take the pasted roots as
                // siblings); other module types are offered disabled with the why.
                let importHtmlLi = null;
                if (!multiIds && on('import_html') && contextTarget()) {
                    (function () {
                        const ihId = contextTarget();
                        const ihMods = modules() || {};
                        const ihMod = ihMods[ihId];
                        if (!ihMod) { return; }
                        // SvgCode is expressible but a leaf — nothing imports INTO it.
                        const ok = !!DBE_HTML_MODULES[ihMod.name] && ihMod.name !== 'SvgCode';
                        importHtmlLi = makeCtxItem(dbeT('importHtmlEllipsis', 'Import HTML…'), () => {
                            setTimeout(() => { openImportHtmlDialog(ihId); }, 120);
                        }, ok ? {} : {
                            disabled: true,
                            tip: dbeT('importHtmlOnlyElements', 'HTML can only be imported into a plain element')
                        });
                        advancedItems.push(importHtmlLi);
                    })();
                }

                // "Change tag…" flyout (tag_change, Pro) — non-void taggable
                // modules (plain elements and Collections; a Template has no tag).
                let changeTagParent = null;
                if (!multiIds && on('tag_change') && contextTarget()) {
                    (function () {
                        const ctId = contextTarget();
                        const curTag = dbeChangeTagEligible(ctId);
                        if (curTag) {
                            changeTagParent = makeParent(dbeT('changeTag', 'Change tag…'), false, () => {
                                return DBE_TAG_CHOICES.map((tg) => {
                                    return makeCtxItem('<' + tg + '>', () => { dbeChangeTag(ctId, tg); },
                                        tg === curTag ? { disabled: true, tip: dbeT('currentTag', 'Current tag') } : {});
                                });
                            });
                        }
                    })();
                }

                // Style inspector: one flyout keeps the primary menu compact while
                // exposing inspect, %local%, and both scopes for every applied class.
                let stylesParent = null;
                if (!multiIds && on('style_inspector') && contextTarget()) {
                    (function () {
                        const siId = contextTarget();
                        const siMod = (modules() || {})[siId];
                        if (!siMod || !bemClassable(siMod)) { return; }
                        stylesParent = makeParent(dbeT('stylesMenu', 'Styles…'), false, () => {
                            return dbeStyleActionItems(siId);
                        });
                    })();
                }

                /* --- Flat layout (context_menu off): append injected items after the
                   native ones, so each feature still works with grouping turned off. */
                if (!grouped) {
                    const injected = nameItems.concat(advancedItems,
                        [stylesParent, cutLi, addBeforeLi, addAfterLi, unwrapLi, moveUpLi, moveDownLi, moveInLi, moveOutLi, selectParentLi, expandLi].filter(Boolean)
                    );
                    if (injected.length) {
                        injected[0].classList.add('dbe-ctx-item--first');
                        injected.forEach((li) => { container.appendChild(li); });
                    }
                    if (removeNLi) { container.appendChild(removeNLi); }
                    if (wrapEnabled && (!nativeWrapAvailable || multiIds)) {
                        const flatWrap = makeParent(
                            multiIds ? dbeFmt(dbeT('wrapNIn', 'Wrap %s in'), multiIds.length) : dbeT('wrapIn', 'Wrap in'),
                            false,
                            () => {
                                return [
                                    makeWrapItem('div', dbeT('divLabel', 'Div')),
                                    makeWrapItem('figure', dbeT('figureLabel', 'Figure')),
                                    makeWrapItem('template', dbeT('templateLabel', 'Template')),
                                    makeWrapItem('collection', dbeT('collectionTemplateLabel', 'Collection + template'))
                                ];
                            },
                            wrapDisabled,
                            dbeT('onlySiblingsWrapped', 'Only sibling elements can be wrapped together')
                        );
                        container.appendChild(flatWrap);
                    }
                    if (changeTagParent) { container.appendChild(changeTagParent); }
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
                const natDuplicate = collectNativeItems(container, /^Duplicate$/);
                const natClip = collectNativeItems(container, /^(Copy|Paste|Cut)$/);
                const natName = collectNativeItems(container, /^Rename$/);
                const natBem = collectNativeItems(container, /^Auto-BEM$/);
                const natWrap = collectNativeItems(container, /^Wrap in$/);
                const natExpand = collectNativeItems(container, /^Expand children$/);
                const natCreate = collectNativeItems(container, /^Create Component$/);
                const natSave = collectNativeItems(container, /^Save\b/);
                const natRemove = collectNativeItems(container, /^Remove$/);
                // Native separators describe the stock ordering. DBE's regrouped
                // menu draws its own cluster separators, so keeping both creates
                // empty and doubled rules after the native rows are re-parented.
                [].slice.call(container.querySelectorAll('.uniContextMenu__divider')).forEach((li) => { li.remove(); });

                // Structure cluster: Wrap in… flyout (the wrap targets are hoisted
                // flat inside it — flyouts can't nest) + Unwrap.
                const wrapLabel = multiIds ? dbeFmt(dbeT('wrapNIn', 'Wrap %s in'), multiIds.length) : dbeT('wrapIn', 'Wrap in');
                let wrapParent = null;
                if (wrapEnabled && (!nativeWrapAvailable || multiIds)) {
                    wrapParent = makeParent(multiIds ? dbeFmt(dbeT('wrapNInEllipsis', 'Wrap %s in…'), multiIds.length) : dbeT('wrapInEllipsis', 'Wrap in…'), false, () => {
                        return [
                            makeWrapItem('div', dbeFmt(dbeT('wrapItemLabel', '%1$s %2$s'), wrapLabel, dbeT('divLabel', 'Div'))),
                            makeWrapItem('figure', dbeFmt(dbeT('wrapItemLabel', '%1$s %2$s'), wrapLabel, dbeT('figureLabel', 'Figure'))),
                            makeWrapItem('template', dbeFmt(dbeT('wrapItemLabel', '%1$s %2$s'), wrapLabel, dbeT('templateLabel', 'Template'))),
                            makeWrapItem('collection', dbeFmt(dbeT('wrapItemLabel', '%1$s %2$s'), wrapLabel, dbeT('collectionTemplateLabel', 'Collection + template')))
                        ];
                    }, wrapDisabled, dbeT('onlySiblingsWrapped', 'Only sibling elements can be wrapped together'));
                }

                // Reuse cluster: Create Component + Save to. Keep Save as a flyout only
                // when it branches (>1 native item); a lone Save item goes flat.
                let saveItem = null;
                if (natSave.length > 1) {
                    saveItem = makeParent(dbeT('saveTo', 'Save to…'), false, () => { return natSave; }, !!multiIds,
                        dbeT('singleElementOnly', 'Available when one element is selected'));
                } else if (natSave.length === 1) {
                    saveItem = natSave[0];
                    if (multiIds) { disableCtxItem(saveItem, dbeT('singleElementOnly', 'Available when one element is selected')); }
                }

                // Keep the primary menu short enough to scan. These actions remain
                // one arrow-key step away inside focused flyouts, and are still
                // individually searchable from the command palette where offered.
                const insertItems = [addBeforeLi, addAfterLi].filter(Boolean);
                const insertParent = insertItems.length
                    ? makeParent(dbeT('insertActions', 'Insert…'), false, () => { return insertItems; })
                    : null;
                const moveNavigateItems = [moveUpLi, moveDownLi, moveInLi, moveOutLi, selectParentLi]
                    .concat(natExpand, expandLi ? [expandLi] : []).filter(Boolean);
                const moveNavigateParent = moveNavigateItems.length
                    ? makeParent(dbeT('moveNavigate', 'Move and navigate…'), false, () => { return moveNavigateItems; })
                    : null;
                const allAdvancedItems = natBem.concat(advancedItems);
                const moreToolsParent = allAdvancedItems.length
                    ? makeParent(dbeT('moreElementTools', 'More element tools…'), false, () => { return allAdvancedItems; })
                    : null;

                // Assemble the clusters in order; empty ones drop out. The first item
                // of every cluster after the first gets a top-border separator via
                // .dbe-ctx-item--first — no separator <li>, so the keyboard focus ring
                // (which skips only non-action rows) is untouched.
                const structureItems = [changeTagParent]
                    .concat(multiIds ? [] : natWrap, [wrapParent, unwrapLi]).filter(Boolean);
                const clusters = [
                    natDuplicate,                                                    // Clone
                    natClip.concat(cutLi ? [cutLi] : []),                            // Clipboard (+ Cut)
                    natName.concat(nameItems),                                       // Name
                    stylesParent ? [stylesParent] : [],                              // Inspect / edit CSS
                    insertParent ? [insertParent] : [],                              // Insert
                    structureItems,                                                  // Structure
                    moveNavigateParent ? [moveNavigateParent] : [],                  // Position / navigate
                    natCreate.concat(saveItem ? [saveItem] : []),                    // Reuse
                    moreToolsParent ? [moreToolsParent] : [],                        // Advanced
                    multiIds ? (removeNLi ? [removeNLi] : []) : natRemove            // Destructive
                ];

                let seenCluster = false;
                clusters.forEach((items) => {
                    if (!items || !items.length) { return; }
                    if (seenCluster) { items[0].classList.add('dbe-ctx-item--first'); }
                    seenCluster = true;
                    items.forEach((li) => { container.appendChild(li); });
                });

                // After clustering (which matches native rows by textContent): append
                // the shortcut hints, so the hint text never corrupts those matches.
                if (on('keyboard_shortcuts') && !multiIds) { annotateNativeCtxAccels(container); }

                setupMenuKeyboard(container);
                fitContextMenu(ctxDialog);
            });
        }

        /* The snippet/variable list menu (Rename / Configure / Delete / Move,
           data-menu-id="var_actions_<title>") and the Selectors-tab context
           menu (data-menu-id="module_actions_<selector>") open through the same
           native dialog machinery as the element menu, but onContextMenuShow
           never touches them (it recognises element menus by their Duplicate /
           Create Component rows). Stamp the shared menu keyboard model on
           either menu, name it after the item it acts on, and anchor it to the
           owning control rather than the opening pointer coordinates. */
        function onItemMenuShow() {
            dbeSetOwnedFrame(DBE_COMMANDS_OWNER, () => {
                const selectorMenu = dbeSelectorMenuTarget && [].slice.call(document.querySelectorAll(
                    'dialog[open] .uniContextMenu[data-menu-id^="module_actions_"]'
                ))
                    .filter((m) => { return m.offsetParent !== null; })[0];
                const variableMenu = [].slice.call(document.querySelectorAll(
                    'dialog[open] .uniContextMenu[data-menu-id^="var_actions_"]'
                )).filter((m) => { return m.offsetParent !== null; })[0];
                const menu = selectorMenu || variableMenu;
                if (!menu) { return; }
                const btn = selectorMenu ? dbeSelectorMenuTarget : dbeVarMenuButton(menu);
                const title = selectorMenu
                    ? btn && ((btn.getAttribute('title') || btn.textContent || '').trim())
                    : (menu.getAttribute('data-menu-id') || '').slice('var_actions_'.length);
                if (!btn || !title) { return; }
                if (!menu.getAttribute('aria-label')) {
                    menu.setAttribute('aria-label', title
                        ? dbeFmt(dbeT('tipItemActions', 'Actions for %s'), title)
                        : dbeT('tipItemActionsFallback', 'Item actions'));
                }
                const container = menu.querySelector('ul') || menu;
                setupMenuKeyboard(container);
                dbeAnchorItemMenu(menu, btn);
            });
        }

        /* Resolve the snippet/variable menu's row action button from the title
           encoded in its menu id. Selector menus instead use the actual
           contextmenu target remembered by dbeRememberContextTarget(), because
           punctuation in selector names is normalised in the native menu id. */
        function dbeVarMenuButton(menu) {
            const title = (menu.getAttribute('data-menu-id') || '').slice('var_actions_'.length);
            let btn = null;
            [].slice.call(document.querySelectorAll('.uniTabDataVars__varsList li')).forEach((row) => {
                if (btn || row.offsetParent === null) { return; }
                const t = row.querySelector('button.varTitle');
                if (t && (t.textContent || '').trim() === title) { btn = row.querySelector('button.iconBoxWrapper'); }
            });
            return btn;
        }

        /* Anchor an item menu to the row control that owns it,
           instead of the click coordinates the native dialog positions itself
           from (a keyboard open otherwise lands at the synthesised event's
           coordinates, and a pointer open wherever the mouse was). Where CSS
           anchor positioning exists, the trigger is stamped as the anchor and
           04-menu-anchor.css tethers the dialog through relayout; elsewhere the
           dialog's inline position is overwritten once (the dbeAnchorSaveMenu
           technique): below the button with right edges aligned, flipped above
           when there is no room below. */
        let dbeItemMenuAnchorBtn = null;
        let dbeSelectorMenuTarget = null;
        function dbeAnchorItemMenu(menu, btn) {
            const dlg = menu.closest('dialog');
            if (!dlg || !btn) { return; }
            if (window.CSS && CSS.supports && CSS.supports('anchor-name: --a')) {
                // One anchor at a time: duplicate anchor-names resolve to the last
                // element in DOM order, which need not be the clicked row's button.
                if (dbeItemMenuAnchorBtn && dbeItemMenuAnchorBtn !== btn) {
                    dbeItemMenuAnchorBtn.style.removeProperty('anchor-name');
                }
                btn.style.setProperty('anchor-name', '--dbe-menu-anchor');
                dbeItemMenuAnchorBtn = btn;
                dlg.classList.add('dbe-menu-anchored');
                return;
            }
            // The dialog node is reused across opens; make sure a class stamped
            // by the CSS path on an earlier open cannot linger into this one.
            dlg.classList.remove('dbe-menu-anchored');
            const br = btn.getBoundingClientRect();
            const dr = dlg.getBoundingClientRect();
            let top = Math.round(br.bottom + 4);
            if (top + dr.height > window.innerHeight - 8) { top = Math.round(br.top - dr.height - 4); }
            dlg.style.left = Math.max(8, Math.round(br.right - dr.width)) + 'px';
            dlg.style.top = Math.max(8, top) + 'px';
        }

        function dbeClearItemMenuAnchor() {
            if (dbeItemMenuAnchorBtn) { dbeItemMenuAnchorBtn.style.removeProperty('anchor-name'); }
            dbeItemMenuAnchorBtn = null;
            dbeSelectorMenuTarget = null;
            document.querySelectorAll('dialog.uniBuilderContextMenu.dbe-menu-anchored').forEach((dlg) => {
                dlg.classList.remove('dbe-menu-anchored');
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
            document.querySelectorAll('.uniRightPanel button.uniModTree__item.expanded').forEach((btn) => {
                const li = btn.closest('li.uniModTree__itemDrag');
                // Keep top-level rows (their parent <ul> is the root list) open.
                if (!li || !li.parentElement.closest('li.uniModTree__itemDrag')) { return; }
                const chev = btn.querySelector('i');
                if (!chev) { return; }
                clickSeq(chev);
            });
        }

        function ensureCollapseButton() {
            const icons = document.querySelector('.uniRightPanel .uniPanelHeader__icons');
            if (!icons || icons.querySelector('.dbe-collapse-subtrees')) { return; }
            const btn = document.createElement('button');
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
            const panel = document.querySelector('.uniRightPanel');
            if (panel) { dbeExpandPass(panel); }
        }

        function ensureExpandAllButton() {
            const icons = document.querySelector('.uniRightPanel .uniPanelHeader__icons');
            if (!icons || icons.querySelector('.dbe-expand-all')) { return; }
            const btn = document.createElement('button');
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

        /* (j) Navigator search: filter box above the tree. Non-matching branches
           hide, while ancestors of a matching row stay visible so its document
           structure remains understandable. Re-applied after every tree render. */
        let treeQuery = '';
        let treeSearchDebounce = null;
        function applyTreeFilter() {
            const q = treeQuery.trim().toLowerCase();
            // schedule() re-runs this on every tree mutation; with no filter active
            // and nothing hidden there is nothing to do, so skip the full-tree
            // textContent walk (one cheap existence probe instead).
            if (!q && !document.querySelector('.uniRightPanel .dbe-tree-filtered-out')) {
                const idleCount = document.querySelector('.dbe-tree-search__count');
                if (idleCount && idleCount.textContent !== '') { idleCount.textContent = ''; }
                return;
            }
            const rows = [].slice.call(document.querySelectorAll('.uniRightPanel .uniModTree__item'));
            const total = rows.length;
            const matches = q ? rows.filter((row) => {
                return (row.textContent || '').toLowerCase().indexOf(q) !== -1;
            }) : rows;
            const visible = new Set(matches);
            // Builderius renders the tree as a flat sequence carrying aria-level.
            // Walk backwards from every match to retain its nearest ancestor at
            // each level, so the result never loses its structural context.
            matches.forEach((match) => {
                let level = parseInt(match.getAttribute('aria-level'), 10) || 1;
                for (let i = rows.indexOf(match) - 1; i >= 0 && level > 1; i--) {
                    const candidateLevel = parseInt(rows[i].getAttribute('aria-level'), 10) || 1;
                    if (candidateLevel < level) {
                        visible.add(rows[i]);
                        level = candidateLevel;
                    }
                }
            });
            rows.forEach((row) => {
                row.classList.remove('dbe-tree-dim'); // clean up the previous implementation
                row.classList.toggle('dbe-tree-filtered-out', !!q && !visible.has(row));
            });
            const count = document.querySelector('.dbe-tree-search__count');
            if (count) {
                const hits = matches.length;
                const msg = !q ? '' : hits === 0
                    ? dbeT('treeNoMatches', 'No matching elements')
                    : dbeFmt(dbeTn(total,
                        'treeMatchesOne', '%1$s of %2$s element matches',
                        'treeMatchesMany', '%1$s of %2$s elements match'), hits, total);
                if (count.textContent !== msg) { count.textContent = msg; }
            }
        }
        function ensureTreeSearch() {
            const panel = document.querySelector('.uniRightPanel');
            const tree = panel && panel.querySelector('.uniModTree');
            if (!tree || panel.querySelector('.dbe-tree-search')) { return; }
            const wrap = document.createElement('div');
            wrap.className = 'dbe-tree-search';
            const input = document.createElement('input');
            input.type = 'search';
            input.placeholder = dbeT('filterElements', 'Filter elements…');
            input.setAttribute('aria-label', dbeT('filterElementsAria', 'Filter elements by label or tag'));
            const count = document.createElement('span');
            count.className = 'dbe-tree-search__count';
            count.setAttribute('role', 'status'); // polite live region for the match count
            input.addEventListener('input', () => {
                dbeClearOwnedTimeout(DBE_COMMANDS_OWNER, treeSearchDebounce);
                treeSearchDebounce = dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => {
                    treeSearchDebounce = null;
                    treeQuery = input.value || '';
                    applyTreeFilter();
                }, 150);
            });
            input.addEventListener('keydown', (e) => {
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

        /* (k3) Save split button (save_split_button). The native Save button
           wraps its dropdown trigger INSIDE the <button> — a
           <div class="actions"> caret strip that opens a small menu
           dialog (Save to Development / Publish to Live). A control inside a
           control cannot be exposed correctly to keyboard or assistive tech; the
           proper fix belongs in Builderius (REPORTED UPSTREAM — retire this
           toggle when it lands). Until then this opt-in rebuilds the proper
           split-button shape instead of decorating the broken one:

             - a REAL sibling menu button (.dbe-save-menu-btn, aria-haspopup +
               live aria-expanded) is injected after Save, and the native strip
               is hidden by 35-save-menu.css — Save stays a completely plain
               button, the caret is its own Tab stop;
             - opening dispatches a coordinate-carrying click sequence on the
               (hidden) native strip: the menu dialog positions itself from the
               click event's clientX/Y — a bare .click() carries (0,0) and lands
               the menu in the top-left corner — so the events carry OUR button's
               centre. The hidden target's own geometry is irrelevant;
             - the menu (natively role=menu/menuitem, mounted fresh per open with
               a random data-menu-id) is stamped focusable and named on open:
               focus lands on the first enabled item, arrows move with wrap,
               Home/End jump, Enter/Space activate (no-op on aria-disabled items,
               which stay focusable for discovery), and Escape stays native — the
               dialog's own cancel closes and returns focus to the menu button. */
        let dbeSaveMenuEl = null;

        function dbeSaveBtn() { return dbeQuery('saveButton'); }

        /* clickSeq with real coordinates — for native handlers that position UI
           from the event's clientX/Y rather than the target's box. */
        function dbeClickSeqAt(el, cx, cy) {
            ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((t) => {
                const Ev = t.indexOf('pointer') === 0 ? PointerEvent : MouseEvent;
                el.dispatchEvent(new Ev(t, { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
            });
        }

        function dbeSaveMenuOpenEl() {
            return (dbeSaveMenuEl && dbeSaveMenuEl.isConnected && dbeSaveMenuEl.offsetParent !== null) ? dbeSaveMenuEl : null;
        }

        function dbeSaveMenuItems(menu) {
            return [].slice.call(menu.querySelectorAll('li.uniContextMenu__item'));
        }

        function dbeStampSaveMenu(menu) {
            dbeSaveMenuEl = menu;
            dbeRememberOwnedAttributes(DBE_COMMANDS_OWNER, menu, ['aria-label']);
            if (!menu.getAttribute('aria-label')) { menu.setAttribute('aria-label', dbeT('tipSaveOptions', 'Save options')); }
            dbeSaveMenuItems(menu).forEach((li) => {
                dbeRememberOwnedAttributes(DBE_COMMANDS_OWNER, li, ['role', 'tabindex', 'aria-disabled']);
                if (li.getAttribute('role') !== 'menuitem') { li.setAttribute('role', 'menuitem'); }
                if (!li.hasAttribute('tabindex')) { li.setAttribute('tabindex', '-1'); }
                // Disabled items stay focusable (aria-disabled) so a keyboard user
                // can discover them and hear why — same convention as the footer
                // toolbar's locked tools.
                if (li.classList.contains('disabled')) {
                    if (li.getAttribute('aria-disabled') !== 'true') { li.setAttribute('aria-disabled', 'true'); }
                } else if (li.hasAttribute('aria-disabled')) {
                    li.removeAttribute('aria-disabled');
                }
            });
            const dlg = menu.closest('dialog');
            if (dlg) {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, dlg, 'save-menu-close', 'close', () => {
                    dbeSaveMenuEl = null;
                    ensureSaveMenuButton();
                });
            }
            ensureSaveMenuButton(); // aria-expanded reflects the open menu at once
        }

        /* Anchor the menu dialog to the injected button: right edges aligned,
           dropped just below. The native dialog positions itself from the click
           event's clientX/Y with its own clamping maths, which lands it well left
           of the button — overwriting its inline left/top after it opens is the
           only placement that is exact regardless of that maths. */
        function dbeAnchorSaveMenu(menu) {
            const btn = document.querySelector('.dbe-save-menu-btn');
            const dlg = menu.closest('dialog');
            if (!btn || !dlg) { return; }
            const br = btn.getBoundingClientRect();
            const dr = dlg.getBoundingClientRect();
            dlg.style.left = Math.max(8, Math.round(br.right - dr.width)) + 'px';
            dlg.style.top = Math.round(br.bottom + 4) + 'px';
        }

        /* The menu mounts as a fresh <dialog> per open with a per-button
           data-menu-id — nothing stable to select on. Every open runs through
           dbeOpenSaveMenu's click on the hidden strip, so the first visible
           dialog menu right after that click is this menu. */
        function dbeWatchSaveMenuOpen(focusFirst) {
            waitFor(() => {
                const menus = [].slice.call(document.querySelectorAll('dialog[open] .uniContextMenu'));
                return menus.filter((m) => { return m.offsetParent !== null; })[0] || null;
            }, (menu) => {
                if (!menu) { return; }
                dbeStampSaveMenu(menu);
                dbeAnchorSaveMenu(menu);
                if (focusFirst) {
                    const items = dbeSaveMenuItems(menu);
                    const first = items.filter((li) => { return !li.classList.contains('disabled'); })[0] || items[0];
                    if (first) { first.focus(); }
                }
            }, 40, DBE_COMMANDS_OWNER);
        }

        /* Open the native menu through the hidden strip, positioned at our
           injected button. */
        function dbeOpenSaveMenu() {
            const save = dbeSaveBtn();
            const actions = save && save.querySelector('.actions');
            const btn = document.querySelector('.dbe-save-menu-btn');
            if (!actions || !btn) { return; }
            const r = btn.getBoundingClientRect();
            dbeClickSeqAt(actions, r.left + r.width / 2, r.top + r.height / 2);
            dbeWatchSaveMenuOpen(true);
        }

        function bindSaveMenuKeys() {
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'save-menu-keys', 'keydown', (e) => {
                const menu = dbeSaveMenuOpenEl();
                if (!menu) { return; }
                const items = dbeSaveMenuItems(menu);
                if (!items.length) { return; }
                const idx = items.indexOf(document.activeElement);
                let next;
                if (e.key === 'ArrowDown') { next = idx < 0 ? 0 : (idx + 1) % items.length; }
                else if (e.key === 'ArrowUp') { next = idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length; }
                else if (e.key === 'Home') { next = 0; }
                else if (e.key === 'End') { next = items.length - 1; }
                else if ((e.key === 'Enter' || e.key === ' ') && idx > -1) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (items[idx].getAttribute('aria-disabled') !== 'true') { items[idx].click(); }
                    return;
                } else {
                    return; // Escape and everything else stay native
                }
                e.preventDefault();
                e.stopPropagation();
                items[next].focus();
            }, true);
        }

        /* Inject/maintain the real menu button after Save. Visuals self-sync by
           copying the Save button's computed colours each tick, so the pair reads
           as one pill through every theme and save-state change without this code
           knowing any of the palettes. */
        function ensureSaveMenuButton() {
            const save = dbeSaveBtn();
            if (!save) { return; }
            const actions = save.querySelector('.actions');
            let btn = save.parentElement.querySelector('.dbe-save-menu-btn');
            if (!actions) {
                // No caret strip mounted (no publish flow) — retire our button too.
                if (btn) { btn.remove(); }
                return;
            }
            dbeRememberOwnedAttributes(DBE_COMMANDS_OWNER, actions, ['aria-hidden']);
            if (actions.getAttribute('aria-hidden') !== 'true') { actions.setAttribute('aria-hidden', 'true'); }
            if (!btn) {
                btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'uniPanelButtonPrimary dbe-save-menu-btn';
                btn.setAttribute('aria-haspopup', 'menu');
                btn.setAttribute('aria-label', dbeT('tipSaveOptions', 'Save options'));
                const caretSvg = actions.querySelector('svg');
                if (caretSvg) { btn.appendChild(caretSvg.cloneNode(true)); }
                else { btn.textContent = '▾'; }
                btn.addEventListener('click', dbeOpenSaveMenu);
                btn.addEventListener('keydown', (e) => {
                    // Enter/Space are the button's native click; ArrowDown matches
                    // the APG menu-button pattern.
                    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); dbeOpenSaveMenu(); }
                });
                save.parentElement.insertBefore(btn, save.nextSibling);
            }
            const exp = dbeSaveMenuOpenEl() ? 'true' : 'false';
            if (btn.getAttribute('aria-expanded') !== exp) { btn.setAttribute('aria-expanded', exp); }
            // Mirror the Save button's current colours AND exact height (theme,
            // save-state and density aware) — flex stretch is not honoured in the
            // top bar's layout, so the height is copied outright.
            const cs = getComputedStyle(save);
            if (btn.style.background !== cs.backgroundColor) { btn.style.background = cs.backgroundColor; }
            if (btn.style.color !== cs.color) { btn.style.color = cs.color; }
            const wantH = Math.round(save.getBoundingClientRect().height) + 'px';
            if (btn.style.blockSize !== wantH) { btn.style.blockSize = wantH; }
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
        const DBE_PICKER_ELEMENTS = [
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
            const prior = document.querySelector('dialog.dbe-el-picker');
            if (prior) { try { prior.close(); } catch (e) {} prior.remove(); }

            const titleKey = dir > 0 ? 'pickAfterTitle' : 'pickBeforeTitle';
            const titleText = dbeT(titleKey, dir > 0 ? 'Add element after' : 'Add element before');
            const dlg = document.createElement('dialog');
            dlg.className = 'dbe-el-picker';
            dlg.setAttribute('aria-label', titleText);

            const head = document.createElement('div');
            head.className = 'dbe-el-picker__head';
            const title = document.createElement('div');
            title.className = 'dbe-el-picker__title';
            title.textContent = titleText;
            const filter = document.createElement('input');
            filter.type = 'text';
            filter.className = 'dbe-el-picker__filter';
            filter.placeholder = dbeT('pickFilter', 'Filter elements…');
            filter.setAttribute('aria-label', dbeT('pickFilter', 'Filter elements…'));
            head.appendChild(title);
            head.appendChild(filter);

            const listEl = document.createElement('ul');
            listEl.className = 'dbe-el-picker__list';
            listEl.setAttribute('role', 'listbox');
            const buttons = DBE_PICKER_ELEMENTS.map((tag) => {
                const li = document.createElement('li');
                // The option role sits on the button, so the wrapper <li> must be
                // presentational or it breaks the listbox→option ownership chain
                // (screen readers then misreport option counts and positions).
                li.setAttribute('role', 'presentation');
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'dbe-el-picker__item';
                btn.setAttribute('role', 'option');
                btn.dataset.tag = tag;
                const name = document.createElement('span');
                name.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
                const tagEl = document.createElement('span');
                tagEl.className = 'dbe-el-picker__tag';
                tagEl.textContent = '<' + tag + '>';
                btn.appendChild(name);
                btn.appendChild(tagEl);
                btn.addEventListener('click', () => { choose(tag); });
                li.appendChild(btn);
                listEl.appendChild(li);
                return btn;
            });
            const empty = document.createElement('div');
            empty.className = 'dbe-el-picker__empty';
            empty.hidden = true;
            empty.textContent = dbeT('pickNoMatch', 'No matching element');

            dlg.appendChild(head);
            dlg.appendChild(listEl);
            dlg.appendChild(empty);
            // Isolate from Builderius' document-level key/click handlers; native
            // <dialog> keeps Escape closing.
            ['keydown', 'pointerdown', 'mousedown', 'click'].forEach((type) => {
                dlg.addEventListener(type, (e) => { e.stopPropagation(); });
            });
            dlg.addEventListener('close', () => { dlg.remove(); });
            document.body.appendChild(dlg);

            function visible() { return buttons.filter((b) => { return !b.parentElement.hidden; }); }
            function applyFilter() {
                const q = filter.value.trim().toLowerCase();
                buttons.forEach((b) => { b.parentElement.hidden = !!q && b.dataset.tag.indexOf(q) === -1; });
                empty.hidden = visible().length > 0;
            }
            function choose(tag) {
                dlg.close(); // close first — showModal makes the tree inert
                const newId = tag === 'section'
                    ? dbeInsertSection(targetId, dir)
                    : dbeInsertSibling(targetId, dir, dbeElementModule(tag));
                if (!newId) { return; }
                waitFor(() => {
                    return document.querySelector('.uniRightPanel .uni-tree-node-' + newId) || null;
                }, (row) => { if (row) { clickSeq(row); } });
                undoToast(dbeFmt(dbeT('addedElement', 'Added %s'), '<' + tag + '>'), 'undo');
            }

            filter.addEventListener('input', applyFilter);
            dlg.addEventListener('keydown', (e) => {
                if (['ArrowDown', 'ArrowUp', 'Enter'].indexOf(e.key) === -1) { return; }
                const vis = visible();
                if (!vis.length) { return; }
                const cur = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.dbe-el-picker__item') : null;
                const i = vis.indexOf(cur);
                e.preventDefault();
                if (e.key === 'Enter') { choose((cur || vis[0]).dataset.tag); return; }
                const next = e.key === 'ArrowDown'
                    ? (i < 0 ? 0 : (i + 1) % vis.length)
                    : (i < 0 ? vis.length - 1 : (i - 1 + vis.length) % vis.length);
                vis[next].focus();
            });

            dlg.showModal();
            filter.focus();
        }


        function dbeElementShortcutsKeydown(e) {
            if (renameActive()) { return; }
            if (document.querySelector('dialog[open]')) { return; } // don't fire over a dialog or the native menu
            const mod = dbeIsMac ? e.metaKey : (e.ctrlKey || e.metaKey);
            const code = e.code;
            // Area jumps are escape routes, so they must work from searches, text
            // fields and Monaco as well as ordinary chrome controls. Process them
            // before the editable-target guard used by destructive/editing keys.
            const AREA = { KeyO: 'navigator', KeyE: 'settings', KeyP: 'canvas', KeyL: 'inserter', KeyB: 'footer' };
            if (mod && e.altKey && !e.shiftKey && AREA[code]) {
                e.preventDefault(); e.stopPropagation();
                dbeFocusArea(AREA[code]);
                return;
            }
            const t = e.target;
            if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], .monaco-editor')) { return; }
            const id = activeId();
            const nativeElementShortcuts = !!(((CFG.builderius || {}).native || {}).elementShortcuts);
            // Builderius 1.3.6+ owns F2, Duplicate and Cut. Do not prevent the
            // native event in this capture-phase handler; retain only DBE's
            // unique region and add-before/after shortcuts on those versions.
            if (!nativeElementShortcuts && e.key === 'F2' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                if (!id) { return; }
                e.preventDefault(); e.stopPropagation();
                startRename(id);
                return;
            }
            if (!mod) { return; }
            if (!nativeElementShortcuts && code === 'KeyD' && e.shiftKey && !e.altKey) { // Duplicate
                if (!id) { return; }
                e.preventDefault(); e.stopPropagation();
                driveContextMenuItem(id, 'Duplicate', (ok) => { if (ok) { undoToast(dbeT('duplicated', 'Duplicated element'), 'undo'); } });
            } else if (!nativeElementShortcuts && code === 'KeyX' && !e.shiftKey && !e.altKey) { // Cut = Copy then Remove
                if (!id) { return; }
                e.preventDefault(); e.stopPropagation();
                driveContextMenuItem(id, 'Copy', (ok) => {
                    if (!ok) { return; }
                    driveContextMenuItem(id, 'Remove', () => { undoToast(dbeT('cutDone', 'Cut element'), 'undo'); });
                });
            } else if (e.altKey && !e.shiftKey && (code === 'KeyT' || code === 'KeyY')) { // Add before / after
                if (!id) { return; }
                e.preventDefault(); e.stopPropagation();
                openElementPicker(id, code === 'KeyY' ? 1 : -1);
            }
        }

        /* (cp) Command palette (command_palette). A configurable shortcut (the
           palette_shortcut setting, default Cmd/Ctrl+K) or the top-bar button opens a
           searchable command list (modelled on openAutoBemDialog's isolation contract).
           With an element selected it offers add-class, add-attribute and add-element
           (minimal Emmet), the element ops and the area jumps. Any command that drives
           the tree or a native picker CLOSES the dialog first (showModal makes the page
           inert), then runs. */
        /* The shortcut choices mirror dbe_enum_settings() in PHP. Ctrl+Shift+K, the
           original default, is reserved by Firefox on Windows/Linux for the DevTools
           Web Console — browser chrome consumes it before the page sees the event —
           so it survives only as an opt-in legacy choice. mod-slash matches on e.key
           rather than e.code (with no shift check) so it works on layouts where "/"
           itself needs Shift. */
        const DBE_PALETTE_KEYS = {
            'mod-k':       { code: 'KeyK', shift: false, label: 'K' },
            'mod-shift-k': { code: 'KeyK', shift: true, label: 'K' },
            'mod-slash':   { key: '/', label: '/' }
        };
        function dbePaletteKey() {
            return DBE_PALETTE_KEYS[(CFG.palette || {}).shortcut] || DBE_PALETTE_KEYS['mod-k'];
        }
        function dbePaletteAccel() {
            // SHORTCUT_GROUPS is assembled before DBE_PALETTE_KEYS is assigned, so
            // derive the display chord directly from configuration at boot time.
            const choice = (CFG.palette || {}).shortcut || 'mod-k';
            return dbeAccel(choice === 'mod-slash' ? '/' : 'K', {
                cmd: true,
                shift: choice === 'mod-shift-k'
            });
        }

        function dbePaletteAriaShortcut() {
            const choice = (CFG.palette || {}).shortcut || 'mod-k';
            const key = choice === 'mod-slash' ? '/' : 'K';
            const parts = [dbeIsMac ? 'Meta' : 'Control'];
            if (choice === 'mod-shift-k') { parts.push('Shift'); }
            parts.push(key);
            return parts.join('+');
        }

        /* Add (or update) one or more HTML attributes on an existing element through
           the settings upsert (a single upsert for the whole batch — no native-control
           driving). `pairs` = [{name, value}, …]. Returns false if the element is gone. */
        function dbeAddAttributes(id, pairs) {
            const safePairs = (pairs || []).map((p) => {
                const name = String((p && p.name) || '').trim().toLowerCase();
                const value = dbeDecodeEntities(p && p.value);
                return dbeAttrBlocked(name, value) ? null : { name, value };
            }).filter(Boolean);
            if (!safePairs.length) { return false; }
            return dbeUpdateModuleSettings(id, (settings) => {
                let ha = settings.filter((s) => { return s.name === 'htmlAttribute'; })[0];
                if (!ha) { ha = { name: 'htmlAttribute', value: [] }; settings.push(ha); }
                if (!Array.isArray(ha.value)) { ha.value = []; }
                safePairs.forEach((p) => {
                    const existing = ha.value.filter((a) => { return a.name === p.name; })[0];
                    if (existing) { existing.value = p.value; } else { ha.value.push({ name: p.name, value: p.value }); }
                });
            }, dbeT('attributeChanges', 'attribute changes'));
        }

        /* Parse an attribute string into {name,value} pairs. Multiple attributes are
           separated by ";" (so values may contain spaces, e.g. an aria-label), or by
           whitespace when there is no ";" (Emmet-style: href=# target=_blank). */
        function dbeParseAttributes(str) {
            str = (str || '').trim();
            const parts = str.indexOf(';') !== -1 ? str.split(';') : str.split(/\s+/);
            return parts.map((p) => { return p.trim(); }).filter(Boolean).map((p) => {
                const eq = p.indexOf('=');
                return { name: (eq < 0 ? p : p.slice(0, eq)).trim(), value: eq < 0 ? '' : p.slice(eq + 1).trim() };
            }).filter((p) => { return p.name; });
        }

        function openCommandPalette() {
            const id = activeId(); // the selected element (the palette is keyboard-invoked)
            const hasEl = !!(id && (modules() || {})[id]);
            const focusReturn = document.activeElement;
            const prior = document.querySelector('dialog.dbe-palette');
            if (prior) { try { prior.close(); } catch (e) {} prior.remove(); }

            const dlg = document.createElement('dialog');
            dlg.className = 'dbe-palette';
            dlg.setAttribute('aria-label', dbeT('commandPalette', 'Command palette'));
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'dbe-palette__input';
            input.setAttribute('aria-label', dbeT('searchCommandsLabel', 'Search commands'));
            input.placeholder = dbeT('searchCommands', 'Search commands…');
            input.setAttribute('role', 'combobox');
            input.setAttribute('aria-autocomplete', 'list');
            input.setAttribute('aria-expanded', 'true');
            input.setAttribute('aria-controls', 'dbe-palette-list');
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'dbe-palette__close';
            close.setAttribute('aria-label', dbeT('close', 'Close'));
            close.textContent = '×';
            close.addEventListener('click', () => { dlg.close(); });
            const searchRow = document.createElement('div');
            searchRow.className = 'dbe-palette__search-row';
            searchRow.appendChild(input);
            searchRow.appendChild(close);
            const listEl = document.createElement('ul');
            listEl.className = 'dbe-palette__list';
            listEl.id = 'dbe-palette-list';
            listEl.setAttribute('role', 'listbox');
            const hintEl = document.createElement('div');
            hintEl.className = 'dbe-palette__hint';
            hintEl.setAttribute('role', 'status');
            dlg.appendChild(searchRow);
            dlg.appendChild(listEl);
            dlg.appendChild(hintEl);
            ['keydown', 'pointerdown', 'mousedown', 'click'].forEach((type) => {
                dlg.addEventListener(type, (e) => { e.stopPropagation(); });
            });
            dlg.addEventListener('close', () => {
                dlg.remove();
                if (focusReturn && focusReturn.isConnected) { try { focusReturn.focus(); } catch (e) {} }
            });
            document.body.appendChild(dlg);

            function runClose(fn) { dlg.close(); dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, fn, 120); }

            // Commands carry a group key; renderList draws a labelled divider each
            // time the group changes, so related commands read as a set. `accel` is a
            // presentational shortcut hint shown right-aligned, mirroring the block
            // editor's context menu.
            const GROUP_LABELS = {
                add: dbeT('paletteGroupAdd', 'Add to element'),
                styles: dbeT('paletteGroupStyles', 'Styles'),
                structure: dbeT('paletteGroupStructure', 'Structure'),
                element: dbeT('paletteGroupElement', 'Element'),
                workspace: dbeT('paletteGroupWorkspace', 'Workspace'),
                admin: dbeT('paletteGroupAdmin', 'WordPress and Builderius'),
                goto: dbeT('paletteGroupGoto', 'Go to')
            };

            const commands = [];
            if (hasEl) {
                commands.push(
                    { group: 'add', label: dbeT('paletteAddClass', 'Add classes'), input: true, ph: dbeT('phClass', 'class1 class2  (or .a.b)'),
                        empty: dbeT('paletteEnterClass', 'Enter at least one class'), run (v) {
                        const cls = v.replace(/^\./, '').split(/[\s.]+/).filter(Boolean);
                        if (!cls.length) { paletteInputError(dbeT('paletteEnterClass', 'Enter at least one class')); return; }
                        runClose(() => {
                            if (dbeAddClasses(id, cls)) {
                                undoToast(dbeFmt(dbeTn(cls.length, 'addedClassesOne', 'Added %s class', 'addedClassesMany', 'Added %s classes'), cls.length), 'undo');
                            }
                        });
                    } },
                    { group: 'add', label: dbeT('paletteAddAttr', 'Add attributes'), input: true, ph: dbeT('phAttr', 'name=value; name2=value2'),
                        empty: dbeT('paletteEnterAttribute', 'Enter an attribute name'), run (v) {
                        const pairs = dbeParseAttributes(v);
                        if (!pairs.length) { paletteInputError(dbeT('paletteEnterAttribute', 'Enter an attribute name')); return; }
                        runClose(() => {
                            if (dbeAddAttributes(id, pairs)) {
                                undoToast(dbeFmt(dbeTn(pairs.length, 'addedAttribute', 'Added attribute %s', 'addedAttributesMany', 'Added %s attributes'), pairs.length === 1 ? pairs[0].name : pairs.length), 'undo');
                            }
                        });
                    } },
                    { group: 'add', label: dbeT('paletteAddEmmet', 'Add elements (Emmet)'), input: true, ph: 'div.card>h3{Title}+p{Text}',
                        empty: dbeT('paletteEnterElement', 'Enter an element abbreviation'), run (v) {
                        let roots;
                        try { roots = dbeEmmetParse(v); } catch (e) { paletteInputError(dbeFmt(dbeT('emmetInvalid', 'Could not parse: %s'), v)); return; }
                        const structErr = dbeEmmetStructureError(id, roots);
                        if (structErr) { paletteInputError(structErr); return; }
                        runClose(() => {
                            const n = dbeEmmetInsert(id, roots);
                            undoToast(dbeFmt(dbeTn(n, 'emmetAddedOne', 'Added %s element', 'emmetAddedMany', 'Added %s elements'), n));
                        });
                    } }
                );
                if (on('style_inspector')) {
                    commands.push(
                        { group: 'styles', label: dbeT('inspectStyles', 'Inspect styles…'), run () { runClose(() => { openStyleInspector(id); }); } },
                        { group: 'styles', label: dbeT('editElementStyles', 'Edit element styles (%local%)'), run () { runClose(() => { dbeOpenStyleEditor(id, '%local%', null); }); } }
                    );
                    moduleClasses((modules() || {})[id]).forEach((className) => {
                        const selector = '.' + className;
                        commands.push(
                            { group: 'styles', label: dbeFmt(dbeT('editClassStyles', 'Edit %1$s — %2$s'), selector, dbeT('scopeGlobal', 'Global')), run () { runClose(() => { dbeOpenStyleEditor(id, selector, 'global'); }); } },
                            { group: 'styles', label: dbeFmt(dbeT('editClassStyles', 'Edit %1$s — %2$s'), selector, entityScopeLabel()), run () { runClose(() => { dbeOpenStyleEditor(id, selector, 'template'); }); } }
                        );
                    });
                }
                commands.push(
                    { group: 'structure', label: dbeT('addBefore', 'Add element before'), accel: dbeAccel('T', { cmd: true, alt: true }), run () { runClose(() => { openElementPicker(id, -1); }); } },
                    { group: 'structure', label: dbeT('addAfter', 'Add element after'), accel: dbeAccel('Y', { cmd: true, alt: true }), run () { runClose(() => { openElementPicker(id, 1); }); } }
                );
                if (on('element_moves')) {
                    const paletteLoc = dbeMoveLocation(id);
                    const canMoveUp = !!(paletteLoc && paletteLoc.index > 0);
                    const canMoveDown = !!(paletteLoc && paletteLoc.index >= 0 && paletteLoc.index < paletteLoc.siblings.length - 1);
                    const canMoveIn = !!dbeIndentTarget(id);
                    const canMoveOut = dbeCanOutdent(id);
                    commands.push(
                        { group: 'structure', label: dbeT('moveUp', 'Move up'), icon: 'arrow-up', accel: dbeAccel('↑', { alt: true }), disabled: !canMoveUp,
                            reason: dbeT('cannotMoveUp', 'Already first among its siblings'), run () { runClose(() => { moveSibling(id, -1); }); } },
                        { group: 'structure', label: dbeT('moveDown', 'Move down'), icon: 'arrow-down', accel: dbeAccel('↓', { alt: true }), disabled: !canMoveDown,
                            reason: dbeT('cannotMoveDown', 'Already last among its siblings'), run () { runClose(() => { moveSibling(id, 1); }); } },
                        { group: 'structure', label: dbeT('moveIn', 'Move in one level'), icon: 'indent-increase', accel: dbeAccel('→', { alt: true }), disabled: !canMoveIn,
                            reason: dbeT('cannotMoveIn', 'Needs a previous sibling that can contain elements'), run () { runClose(() => { indentElement(id); }); } },
                        { group: 'structure', label: dbeT('moveOut', 'Move out one level'), icon: 'indent-decrease', accel: dbeAccel('←', { alt: true }), disabled: !canMoveOut,
                            reason: dbeT('cannotMoveOut', 'Already at the outermost available level'), run () { runClose(() => { outdentElement(id); }); } }
                    );
                }
                if (on('wrap_in')) {
                    commands.push(
                        { group: 'structure', label: dbeT('paletteWrapDiv', 'Wrap in div'), run () { runClose(() => { wrap('div', [id]); }); } },
                        { group: 'structure', label: dbeT('paletteWrapFigure', 'Wrap in figure'), run () { runClose(() => { wrap('figure', [id]); }); } },
                        { group: 'structure', label: dbeT('paletteWrapTemplate', 'Wrap in template'), run () { runClose(() => { wrap('template', [id]); }); } },
                        { group: 'structure', label: dbeT('paletteWrapCollection', 'Wrap in collection'), run () { runClose(() => { wrap('collection', [id]); }); } }
                    );
                }
                commands.push(
                    { group: 'element', label: dbeT('editText', 'Edit text'), accel: 'Enter', disabled: !dbeCanvasTextTarget(),
                        reason: dbeT('cannotEditText', 'Select an element with editable text'), run () { runClose(dbeCanvasStartTextEditing); } },
                    { group: 'element', label: dbeT('rename', 'Rename'), accel: 'F2', input: true, ph: 'New name',
                        empty: dbeT('paletteEnterName', 'Enter a new name'), run (v) {
                        if (!v.trim()) { return; }
                        runClose(() => { commitRename(id, v.trim()); });
                    } }
                );
                if (on('edit_as_html')) {
                    commands.push(
                        { group: 'element', label: dbeT('editAsHtml', 'Edit as HTML'), disabled: !dbeHtmlEditable(id),
                            reason: dbeT('editAsHtmlOnlyElements', 'Only subtrees of plain elements can be edited as HTML'),
                            run () { runClose(() => { openEditHtmlDialog(id); }); } }
                    );
                }
                if (on('import_html')) {
                    const paletteHtmlModule = (modules() || {})[id];
                    const canImportHtml = !!(paletteHtmlModule && DBE_HTML_MODULES[paletteHtmlModule.name] && paletteHtmlModule.name !== 'SvgCode');
                    commands.push(
                        { group: 'element', label: dbeT('importHtml', 'Import HTML'), disabled: !canImportHtml,
                            reason: dbeT('importHtmlOnlyElements', 'HTML can only be imported into a plain element'),
                            run () { runClose(() => { openImportHtmlDialog(id); }); } }
                    );
                }
                if (on('auto_bem')) {
                    commands.push(
                        { group: 'element', label: dbeT('autoBem', 'Auto-BEM'), run () { runClose(() => { openAutoBemDialog(id); }); } }
                    );
                }
                // Change tag by TYPING the tag — the flyout's curated list is a
                // mouse affordance; here any known non-void tag goes.
                if (on('tag_change') && dbeChangeTagEligible(id)) {
                    commands.push(
                        { group: 'element', label: dbeT('paletteChangeTag', 'Change tag'), input: true,
                            ph: dbeFmt(dbeT('phTag', 'section, h2, figure…  (now <%s>)'), dbeChangeTagEligible(id)),
                            empty: dbeT('paletteEnterTag', 'Enter a new HTML tag'),
                            run (v) {
                                const tg = dbeCleanTagInput(v);
                                if (!tg) {
                                    paletteInputError(dbeFmt(dbeT('tagInvalid', 'Not a usable HTML tag: %s'), String(v || '').trim() || '—'));
                                    return;
                                }
                                if (tg === dbeChangeTagEligible(id)) {
                                    paletteInputError(dbeFmt(dbeT('tagAlready', 'Already <%s>'), tg));
                                    return;
                                }
                                runClose(() => { dbeChangeTag(id, tg); });
                            } }
                    );
                }
                commands.push(
                    { group: 'element', label: dbeT('paletteDuplicate', 'Duplicate'), accel: dbeAccel('D', { cmd: true, shift: true }), run () { runClose(() => { driveContextMenuItem(id, 'Duplicate', (ok) => { if (ok) { undoToast(dbeT('duplicated', 'Duplicated element'), 'undo'); } }); }); } },
                    { group: 'element', label: dbeT('paletteCopy', 'Copy'), accel: dbeAccel('C', { cmd: true }), run () { runClose(() => { driveContextMenuItem(id, 'Copy', (ok) => { if (ok) { undoToast(dbeT('copiedElement', 'Copied element')); } }); }); } },
                    { group: 'element', label: dbeT('paletteCut', 'Cut'), accel: dbeAccel('X', { cmd: true }), run () { runClose(() => { driveContextMenuItem(id, 'Copy', (ok) => { if (ok) { driveContextMenuItem(id, 'Remove', () => { undoToast(dbeT('cutDone', 'Cut element'), 'undo'); }); } }); }); } },
                    { group: 'element', label: dbeT('paletteDelete', 'Delete'), accel: dbeT('accelDelete', 'Del'), run () { runClose(() => { driveContextMenuItem(id, 'Remove', () => { undoToast(dbeT('deletedElement', 'Deleted element'), 'undo'); }); }); } },
                    // Settings show the selected element's settings — only useful with one.
                    { group: 'goto', label: dbeT('goToSettings', 'Go to Element settings'), accel: dbeAccel('E', { cmd: true, alt: true }), run () { runClose(() => { dbeFocusArea('settings'); }); } }
                );
            }
            commands.push(
                { group: 'workspace', icon: 'pointer', label: dbeCanvasInteractive() ? dbeT('exitInteractiveCanvas', 'Select elements') : dbeT('enterInteractiveCanvas', 'Interact with page'),
                    run () { runClose(() => { dbeSetCanvasInteractive(!dbeCanvasInteractive()); }); } }
            );
            /* The compact selector owns visibility below 720px. Persisted wide-view
               panel commands would appear to do nothing there, so expose them only
               when they can truthfully affect the current layout. */
            if (!dbeCompactActive()) {
                const panelWrappers = dbePanelWrappers();
                const leftPanelHidden = dbePanelSideHidden('left', panelWrappers.left);
                const rightPanelHidden = dbePanelSideHidden('right', panelWrappers.right);
                const panelsHidden = leftPanelHidden && rightPanelHidden;
                commands.push(
                { group: 'workspace', icon: 'panels', label: panelsHidden ? dbeT('showSidePanels', 'Show side panels') : dbeT('hideSidePanels', 'Hide side panels (full-width canvas)'),
                    run () { runClose(() => {
                        dbeToggleSidePanels((changed) => {
                            if (changed) { undoToast(panelsHidden ? dbeT('sidePanelsShown', 'Side panels shown') : dbeT('sidePanelsHidden', 'Side panels hidden')); }
                        });
                    }); } },
                { group: 'workspace', icon: 'panel-left', label: leftPanelHidden ? dbeT('showSettingsPanel', 'Show settings panel') : dbeT('hideSettingsPanel', 'Hide settings panel'),
                    run () { runClose(() => { dbeSetPanelVisibility('left', !leftPanelHidden); }); } },
                { group: 'workspace', icon: 'panel-right', label: rightPanelHidden ? dbeT('showNavigatorPanel', 'Show Navigator panel') : dbeT('hideNavigatorPanel', 'Hide Navigator panel'),
                    run () { runClose(() => { dbeSetPanelVisibility('right', !rightPanelHidden); }); } }
                );
            }
            commands.push(
                { group: 'goto', label: dbeT('goToNavigator', 'Go to Navigator'), accel: dbeAccel('O', { cmd: true, alt: true }), run () { runClose(() => { dbeFocusArea('navigator'); }); } },
                { group: 'goto', label: dbeT('goToCanvas', 'Go to canvas'), accel: dbeAccel('P', { cmd: true, alt: true }), run () { runClose(() => { dbeFocusArea('canvas'); }); } },
                { group: 'goto', label: dbeT('openInserterCmd', 'Open Element library'), accel: dbeAccel('L', { cmd: true, alt: true }), run () { runClose(() => { dbeFocusArea('inserter'); }); } },
                { group: 'goto', label: dbeT('goToFooter', 'Go to footer bar'), accel: dbeAccel('B', { cmd: true, alt: true }), run () { runClose(() => { dbeFocusArea('footer'); }); } },
                { group: 'goto', label: dbeT('keyboardShortcuts', 'Keyboard shortcuts'), accel: '?', run () { runClose(openShortcutsDialog); } }
            );
            const adminUrls = CFG.adminUrls || {};
            if (adminUrls.dashboard) {
                commands.push({ group: 'admin', icon: 'dashboard', label: dbeT('openWpDashboard', 'Open WordPress dashboard'), href: adminUrls.dashboard });
            }
            if (adminUrls.releases) {
                commands.push({ group: 'admin', icon: 'package', label: dbeT('openBuilderiusReleases', 'Open Builderius releases'), href: adminUrls.releases });
            }
            if (adminUrls.settings) {
                commands.push({ group: 'admin', icon: 'settings', label: dbeT('openBuilderiusSettings', 'Open Builderius settings'), href: adminUrls.settings });
            }

            const paletteGroupOrder = ['add', 'styles', 'structure', 'element', 'workspace', 'goto', 'admin'];
            commands.sort((a, b) => {
                return paletteGroupOrder.indexOf(a.group) - paletteGroupOrder.indexOf(b.group);
            });

            let mode = null; // null = list mode; else the active input command
            let buttons = [];
            let groupHeads = []; // divider/heading <li>s, hidden when their group is fully filtered out
            let activeButton = null;

            function setActiveButton(button, method) {
                buttons.forEach((b) => {
                    const selected = b === button ? 'true' : 'false';
                    if (b.getAttribute('aria-selected') !== selected) { b.setAttribute('aria-selected', selected); }
                    if (b === button && method) { b.setAttribute('data-dbe-active-via', method); }
                    else { b.removeAttribute('data-dbe-active-via'); }
                });
                activeButton = button || null;
                if (activeButton) {
                    input.setAttribute('aria-activedescendant', activeButton.id);
                    try { activeButton.scrollIntoView({ block: 'nearest' }); } catch (e) {}
                } else {
                    input.removeAttribute('aria-activedescendant');
                }
            }

            function renderList() {
                listEl.innerHTML = '';
                buttons = [];
                groupHeads = [];
                activeButton = null;
                input.removeAttribute('aria-activedescendant');
                let lastGroup = null;
                commands.forEach((cmd) => {
                    if (cmd.group && cmd.group !== lastGroup) {
                        lastGroup = cmd.group;
                        // A labelled divider row. role=presentation + aria-hidden: the
                        // options are self-describing, so the grouping is a visual aid
                        // and must not be read as a listbox child.
                        const head = document.createElement('li');
                        head.className = 'dbe-palette__group';
                        head.setAttribute('role', 'presentation');
                        head.setAttribute('aria-hidden', 'true');
                        head.textContent = GROUP_LABELS[cmd.group] || '';
                        head.dbeGroup = cmd.group;
                        listEl.appendChild(head);
                        groupHeads.push(head);
                    }
                    const li = document.createElement('li');
                    // The option role sits on the button; the wrapper <li> must be
                    // presentational (like the group heads above) or it breaks the
                    // listbox→option ownership chain for screen readers.
                    li.setAttribute('role', 'presentation');
                    const btn = document.createElement(cmd.href ? 'a' : 'button');
                    if (cmd.href) {
                        btn.href = cmd.href;
                        btn.target = '_blank';
                        btn.rel = 'noopener';
                    } else {
                        btn.type = 'button';
                    }
                    btn.className = 'dbe-palette__item';
                    btn.setAttribute('role', 'option');
                    btn.id = 'dbe-palette-option-' + buttons.length;
                    btn.tabIndex = -1;
                    btn.setAttribute('aria-selected', 'false');
                    if (cmd.disabled) { btn.setAttribute('aria-disabled', 'true'); }
                    const command = document.createElement('span');
                    command.className = 'dbe-palette__command';
                    if (cmd.icon) { command.appendChild(dbeSvgIcon(cmd.icon, 'dbe-palette__icon')); }
                    const copy = document.createElement('span');
                    copy.className = 'dbe-palette__copy';
                    const lab = document.createElement('span');
                    lab.className = 'dbe-palette__label';
                    lab.id = btn.id + '-label';
                    lab.textContent = cmd.label;
                    copy.appendChild(lab);
                    btn.setAttribute('aria-labelledby', lab.id);
                    if (cmd.disabled && cmd.reason) {
                        const reason = document.createElement('span');
                        reason.className = 'dbe-palette__reason';
                        reason.id = btn.id + '-reason';
                        reason.textContent = cmd.reason;
                        copy.appendChild(reason);
                        btn.setAttribute('aria-describedby', reason.id);
                    }
                    command.appendChild(copy);
                    btn.appendChild(command);
                    if (cmd.accel) {
                        const acc = document.createElement('span');
                        acc.className = 'dbe-palette__accel';
                        acc.textContent = cmd.accel;
                        acc.setAttribute('aria-hidden', 'true'); // decorative; the shortcuts overlay documents it
                        btn.appendChild(acc);
                    }
                    btn.dbeCmd = cmd;
                    btn.dbeGroup = cmd.group;
                    btn.dbeLabel = cmd.label; // filter on the label only, not the accel glyphs
                    btn.addEventListener('click', () => {
                        if (cmd.href) { dlg.close(); return; }
                        pick(cmd);
                    });
                    btn.addEventListener('mouseenter', () => { setActiveButton(btn, 'pointer'); });
                    li.appendChild(btn);
                    listEl.appendChild(li);
                    buttons.push(btn);
                });
                hintEl.textContent = hasEl ? '' : dbeT('paletteNoEl', 'No element selected — element commands are hidden');
            }
            function visible() { return buttons.filter((b) => { return !b.parentElement.hidden; }); }
            function applyFilter() {
                if (mode) { return; }
                const q = input.value.trim().toLowerCase();
                buttons.forEach((b) => { b.parentElement.hidden = !!q && (b.dbeLabel || b.textContent).toLowerCase().indexOf(q) === -1; });
                // Hide a group's divider when the filter left it with no visible items.
                groupHeads.forEach((h) => {
                    h.hidden = !buttons.some((b) => { return b.dbeGroup === h.dbeGroup && !b.parentElement.hidden; });
                });
                if (activeButton && activeButton.parentElement.hidden) { setActiveButton(null); }
                hintEl.classList.remove('dbe-palette__hint--error');
                hintEl.textContent = q && visible().length === 0
                    ? dbeT('paletteNoMatch', 'No matching commands')
                    : (!q && !hasEl ? dbeT('paletteNoEl', 'No element selected — element commands are hidden') : '');
            }
            function pick(cmd) {
                if (cmd.disabled) { undoToast(cmd.reason || dbeT('commandUnavailable', 'That command is not available here')); return; }
                if (cmd.href) {
                    const link = buttons.filter((button) => { return button.dbeCmd === cmd; })[0];
                    if (link) { link.click(); }
                    return;
                }
                if (cmd.input) { enterInput(cmd); } else { cmd.run(); }
            }
            function enterInput(cmd) {
                mode = cmd;
                setActiveButton(null);
                listEl.innerHTML = '';
                input.value = '';
                input.placeholder = cmd.ph || cmd.label;
                input.setAttribute('aria-expanded', 'false');
                hintEl.textContent = cmd.label;
                hintEl.classList.remove('dbe-palette__hint--error');
                input.focus();
            }
            function paletteInputError(message) {
                hintEl.classList.add('dbe-palette__hint--error');
                // Clear first so repeating the same invalid submission is announced.
                hintEl.textContent = '';
                setTimeout(() => { hintEl.textContent = message; }, 20);
            }
            function exitInput() {
                mode = null;
                input.value = '';
                input.placeholder = dbeT('searchCommands', 'Search commands…');
                input.setAttribute('aria-expanded', 'true');
                renderList(); applyFilter();
                input.focus();
            }

            input.addEventListener('input', () => {
                if (mode) {
                    hintEl.classList.remove('dbe-palette__hint--error');
                    hintEl.textContent = mode.label;
                    return;
                }
                applyFilter();
            });
            dlg.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (mode) {
                        if (!input.value.trim()) {
                            paletteInputError(mode.empty || dbeT('paletteEnterValue', 'Enter a value'));
                            return;
                        }
                        mode.run(input.value); return;
                    }
                    const vis = visible();
                    const pickBtn = activeButton || vis[0];
                    if (pickBtn) { pick(pickBtn.dbeCmd); }
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    if (mode) { exitInput(); }
                    else { dlg.close(); }
                    return;
                }
                if (mode || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) { return; }
                e.preventDefault();
                const vis2 = visible();
                if (!vis2.length) { return; }
                const i = vis2.indexOf(activeButton);
                const next = e.key === 'ArrowDown' ? (i < 0 ? 0 : (i + 1) % vis2.length) : (i < 0 ? vis2.length - 1 : (i - 1 + vis2.length) % vis2.length);
                setActiveButton(vis2[next], 'keyboard');
                input.focus();
            });

            renderList();
            dlg.showModal();
            input.focus();
        }

        function dbePaletteKeydown(e) {
            const k = dbePaletteKey();
            if (k.key ? e.key !== k.key : (e.code !== k.code || e.shiftKey !== k.shift)) { return; }
            if (e.altKey) { return; }
            if (!(dbeIsMac ? e.metaKey : (e.ctrlKey || e.metaKey))) { return; }
            if (renameActive()) { return; }
            const t = e.target;
            if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], .monaco-editor')) { return; }
            if (document.querySelector('dialog[open]')) { return; }
            e.preventDefault(); e.stopPropagation();
            openCommandPalette();
        }

        /* The preview is a same-origin iframe. Once focus enters it, key events no
           longer bubble to the builder document, so bridge the canvas-specific keys
           into that document. */
        const DBE_COMMANDS_OWNER = 'commands';
        let dbeCommandsControllerActive = false;
        let dbeKeyboardFrame = null;
        let dbeCommandFrameDocuments = [];
        let dbePreviewContextState = null;
        let dbePreviewPointerContext = null;
        let dbePreviewFocusState = null;
        let dbePreviewRenameDialog = null;

        function dbeCanvasTextEditingKeydown(e) {
            if (e.key !== 'Escape') { return; }
            const target = e.target;
            const editor = target && target.closest
                ? target.closest('uni-inline-editing[contenteditable="true"]')
                : null;
            if (!editor) { return; }
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            // Builderius commits and exits inline editing through this control's
            // native blur handler, including its selection-overlay refresh.
            editor.blur();
        }

        /* Builderius exposes no public "start inline editing" action. Reuse its
           native double-click channel, but only for a selected HtmlElement that
           actually owns a content setting. That keeps Enter's existing canvas-mode
           action for containers, images and every non-text module. */
        function dbeCanvasTextTarget() {
            const id = activeId();
            const mods = modules();
            const mod = id && mods && mods[id];
            if (!mod || mod.name !== 'HtmlElement' || !((mod.settings || []).some((s) => { return s.name === 'content'; }))) {
                return null;
            }
            const frame = dbeQuery('previewFrame');
            let doc;
            try { doc = frame && frame.contentDocument; } catch (e) { doc = null; }
            if (!doc) { return null; }
            const matches = [].slice.call(doc.querySelectorAll('.uni-node-' + id));
            return matches.filter((el) => { return el.getClientRects().length; })[0] || matches[0] || null;
        }

        function dbeCanvasStartTextEditing() {
            const target = dbeCanvasTextTarget();
            if (!target) { return false; }
            const view = target.ownerDocument.defaultView;
            const rect = target.getBoundingClientRect();
            const opts = {
                bubbles: true,
                cancelable: true,
                view,
                detail: 2,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
            };
            target.dispatchEvent(new view.MouseEvent('dblclick', opts));
            return true;
        }

        function dbeSyncCanvasEditingIndicator(doc) {
            if (!doc) { return; }
            const editing = !!doc.querySelector('uni-inline-editing[contenteditable="true"]');
            const wasEditing = doc.dbeCanvasTextEditingActive;
            doc.dbeCanvasTextEditingActive = editing;
            let indicator = document.querySelector('.dbe-canvas-editing-indicator');

            if (editing && !indicator) {
                const host = document.querySelector('.uniIframePanel__outer');
                if (!host) { return; }
                indicator = document.createElement('div');
                indicator.className = 'dbe-canvas-editing-indicator';
                // The hidden live region below owns the natural-language
                // announcement. Keep this compact visual cue out of the
                // accessibility tree to avoid announcing the same state twice.
                indicator.setAttribute('aria-hidden', 'true');
                indicator.innerHTML =
                    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 11.75V13h1.25l7.37-7.37-1.25-1.25L3 11.75Zm9.59-7.09a.66.66 0 0 0 0-.93l-.32-.32a.66.66 0 0 0-.93 0l-.52.52 1.25 1.25.52-.52Z" fill="currentColor"/></svg>' +
                    '<strong>' + dbeT('canvasTextEditing', 'Editing text') + '</strong>' +
                    '<span>' + dbeT('canvasFinishHint', 'Esc to finish') + '</span>';
                host.appendChild(indicator);
            } else if (!editing && indicator) {
                indicator.remove();
            }

            if (editing && wasEditing !== true) {
                dbeCanvasStatus(dbeT('canvasTextEditingAnnounce', 'Editing text. Press Escape to finish.'));
            } else if (!editing && wasEditing === true) {
                dbeCanvasStatus(dbeT('canvasTextFinished', 'Finished editing text'));
            }
        }

        function dbeCanvasInteractive() {
            try {
                const mode = store().storeGet('overlayMode');
                if (mode) { return mode !== 'selectModule'; }
            } catch (e) {}
            const toggle = document.querySelector('.overlayToggleIcon');
            return !!(toggle && toggle.classList.contains('active'));
        }

        function dbePreviewContextBlocked(target) {
            const el = target && target.nodeType === 1 ? target : target && target.parentElement;
            if (!el || !el.closest) { return true; }
            if (el.closest('input, textarea, select, option, button, iframe, object, embed, .monaco-editor, uni-inline-editing')) {
                return true;
            }
            const editable = el.closest('[contenteditable]');
            return !!(editable && editable.getAttribute('contenteditable') !== 'false');
        }

        /* Resolve the nearest rendered module, rather than the first uni-node
           class in the document. Collection instances can render one module id
           more than once; retaining the actual element gives focus return a
           predictable instance even though the shared command target is the id. */
        function dbePreviewContextTarget(target) {
            let el = target && target.nodeType === 1 ? target : target && target.parentElement;
            while (el && el.nodeType === 1) {
                for (let i = 0; i < el.classList.length; i++) {
                    const match = /^uni-node-([A-Za-z0-9_-]+)$/.exec(el.classList[i]);
                    if (match && el.getClientRects().length && (modules() || {})[match[1]]) {
                        return { id: match[1], element: el, tag: (el.localName || '').toLowerCase() };
                    }
                }
                el = el.parentElement;
            }
            return null;
        }

        function dbePreviewContextTargetAtPoint(doc, x, y, fallback) {
            const hits = doc && doc.elementsFromPoint ? doc.elementsFromPoint(x, y) : [];
            for (let i = 0; i < hits.length; i++) {
                const target = dbePreviewContextTarget(hits[i]);
                if (target) { return target; }
            }
            return dbePreviewContextTarget(fallback);
        }

        function dbePreviewActiveTarget(doc) {
            const active = doc && doc.activeElement;
            const target = dbePreviewContextTarget(active);
            if (target) { return target; }
            const id = activeId();
            if (!id || !doc) { return null; }
            const matches = [].slice.call(doc.querySelectorAll('.uni-node-' + id));
            const el = matches.filter((candidate) => { return candidate.getClientRects().length; })[0] || null;
            return el ? { id, element: el, tag: (el.localName || '').toLowerCase() } : null;
        }

        function dbePreviewContextHeading() {
            const state = dbePreviewContextState;
            const mods = modules() || {};
            const mod = state && mods[state.id];
            if (!state || !mod) { return ''; }
            const label = mod.label || defaultLabelFor(state.id) || dbeT('element', 'Element');
            const tagSetting = (mod.settings || []).filter((setting) => { return setting.name === 'tag'; })[0];
            const tag = (tagSetting && tagSetting.value) || state.tag;
            return tag
                ? dbeFmt(dbeT('previewContextTarget', '%1$s · <%2$s>'), label, tag)
                : label;
        }

        function dbeClearPreviewFocusState() {
            const state = dbePreviewFocusState;
            dbePreviewFocusState = null;
            if (!state || !state.element) { return; }
            if (state.blurCleanup) { state.element.removeEventListener('blur', state.blurCleanup); }
            if (state.addedTabindex && state.element.getAttribute('tabindex') === '-1') {
                state.element.removeAttribute('tabindex');
            }
        }

        function dbeReleasePreviewContextState(state, keepFocused) {
            if (!state || !state.element) { return; }
            if (keepFocused && state.element.ownerDocument.activeElement === state.element) {
                dbeClearPreviewFocusState();
                state.blurCleanup = function () {
                    if (dbePreviewFocusState === state) { dbePreviewFocusState = null; }
                    dbeReleasePreviewContextState(state, false);
                };
                dbePreviewFocusState = state;
                state.element.addEventListener('blur', state.blurCleanup, { once: true });
                return;
            }
            if (state.addedTabindex && state.element.getAttribute('tabindex') === '-1') {
                state.element.removeAttribute('tabindex');
            }
        }

        function dbeRestorePreviewContextTarget(state) {
            const target = state.element && state.element.isConnected ? state.element : null;
            if (!target) {
                if (state.frame && state.frame.isConnected) {
                    try { state.frame.focus(); } catch (e) {}
                }
                dbeReleasePreviewContextState(state, false);
                return;
            }
            let attempts = 0;
            let stableChecks = 0;

            function attempt() {
                const outerActive = document.activeElement;
                const innerActive = target.ownerDocument.activeElement;
                if (attempts > 0 && ((outerActive && outerActive !== document.body && outerActive !== state.frame) ||
                    (innerActive && innerActive !== target.ownerDocument.body && innerActive !== target))) {
                    dbeReleasePreviewContextState(state, false);
                    return;
                }
                if (state.frame && state.frame.isConnected) {
                    try { state.frame.focus(); } catch (e) {}
                }
                try { target.ownerDocument.defaultView.focus(); } catch (e) {}
                try { target.focus({ preventScroll: true }); } catch (e) { try { target.focus(); } catch (err) {} }
                dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => {
                    stableChecks = target.ownerDocument.activeElement === target ? stableChecks + 1 : 0;
                    if (stableChecks >= 2) {
                        dbeReleasePreviewContextState(state, true);
                    } else if (attempts++ < 6) {
                        attempt();
                    } else {
                        dbeReleasePreviewContextState(state, false);
                    }
                }, 50);
            }
            attempt();
        }

        function dbeDiscardPreviewContext(restoreFocus) {
            const state = dbePreviewContextState;
            dbePreviewContextState = null;
            if (!state) { return; }
            if (!restoreFocus) {
                dbeReleasePreviewContextState(state, false);
                return;
            }
            waitFor(() => {
                return document.querySelector('dialog.uniBuilderContextMenu[open]') ? null : true;
            }, (closed) => {
                if (!closed || document.querySelector('dialog[open]')) {
                    dbeReleasePreviewContextState(state, false);
                    return;
                }
                dbeRestorePreviewContextTarget(state);
            }, 12, DBE_COMMANDS_OWNER);
        }

        function dbeOpenPreviewRename(id, renderedTarget) {
            const mods = modules() || {};
            const mod = id && mods[id];
            if (!mod || dbeCanvasInteractive()) { return false; }

            if (dbePreviewRenameDialog) {
                dbePreviewRenameDialog.remove();
                dbePreviewRenameDialog = null;
            }
            dbeDiscardPreviewContext(false);
            dbeClearPreviewFocusState();

            const frame = dbeQuery('previewFrame');
            const target = renderedTarget && renderedTarget.isConnected ? renderedTarget : null;
            const hadTabindex = target ? target.hasAttribute('tabindex') : true;
            if (target && !hadTabindex && target.tabIndex < 0) { target.setAttribute('tabindex', '-1'); }
            const focusState = {
                element: target,
                frame,
                addedTabindex: !!(target && !hadTabindex && target.getAttribute('tabindex') === '-1')
            };
            let restoreFocusOnClose = true;
            const oldLabel = mod.label || defaultLabelFor(id) || '';
            const dlg = document.createElement('dialog');
            dlg.className = 'dbe-preview-rename';
            dlg.setAttribute('aria-labelledby', 'dbe-preview-rename-title');
            dlg.setAttribute('aria-describedby', 'dbe-preview-rename-hint dbe-preview-rename-error');
            dbePreviewRenameDialog = dlg;

            const title = document.createElement('h2');
            title.id = 'dbe-preview-rename-title';
            title.className = 'dbe-preview-rename__title';
            title.textContent = dbeT('previewRenameTitle', 'Rename Navigator name');
            dlg.appendChild(title);

            const hint = document.createElement('p');
            hint.id = 'dbe-preview-rename-hint';
            hint.className = 'dbe-preview-rename__hint';
            hint.textContent = dbeT('previewRenameHint',
                'Changes the name shown in the Navigator. This does not change the element’s visible text or HTML tag.');
            dlg.appendChild(hint);

            const form = document.createElement('form');
            form.noValidate = true;
            const label = document.createElement('label');
            label.className = 'dbe-preview-rename__label';
            label.setAttribute('for', 'dbe-preview-rename-input');
            label.textContent = dbeT('previewRenameLabel', 'Navigator name');
            const input = document.createElement('input');
            input.id = 'dbe-preview-rename-input';
            input.className = 'dbe-preview-rename__input';
            input.type = 'text';
            input.value = oldLabel;
            input.required = true;
            input.setAttribute('autocomplete', 'off');
            const error = document.createElement('p');
            error.id = 'dbe-preview-rename-error';
            error.className = 'dbe-preview-rename__error';
            error.setAttribute('role', 'alert');
            label.appendChild(input);
            form.appendChild(label);
            form.appendChild(error);

            const actions = document.createElement('div');
            actions.className = 'dbe-preview-rename__actions';
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'dbe-preview-rename__cancel';
            cancel.textContent = dbeT('cancel', 'Cancel');
            cancel.addEventListener('click', () => { dlg.close(); });
            const save = document.createElement('button');
            save.type = 'submit';
            save.className = 'dbe-preview-rename__save';
            save.textContent = dbeT('previewRenameSave', 'Save name');
            actions.appendChild(cancel);
            actions.appendChild(save);
            form.appendChild(actions);
            dlg.appendChild(form);

            function restoreFocus() {
                dbeRestorePreviewContextTarget(focusState);
            }
            function showError(message) {
                error.textContent = message;
                input.setAttribute('aria-invalid', 'true');
                input.focus();
            }

            input.addEventListener('input', () => {
                error.textContent = '';
                input.removeAttribute('aria-invalid');
            });
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const next = (input.value || '').trim();
                if (!next) {
                    showError(dbeT('previewRenameEmpty', 'Enter a Navigator name.'));
                    return;
                }
                if (next.length > 120) {
                    showError(dbeT('previewRenameTooLong', 'Use 120 characters or fewer.'));
                    return;
                }
                if (next === oldLabel) {
                    dlg.close();
                    return;
                }
                restoreFocusOnClose = false;
                dlg.close();
                commitRename(id, next);
                waitFor(() => {
                    const current = (modules() || {})[id];
                    return current && current.label === next ? true : null;
                }, (renamed) => {
                    restoreFocus();
                    dbeCanvasStatus(renamed
                        ? dbeFmt(dbeT('previewRenameSuccess', 'Renamed element to %s'), next)
                        : dbeT('previewRenameFailed', 'Could not rename the preview element'));
                }, 20, DBE_COMMANDS_OWNER);
            });
            dlg.addEventListener('keydown', (e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                    e.preventDefault();
                    dlg.close();
                }
            });
            ['pointerdown', 'mousedown', 'click'].forEach((type) => {
                dlg.addEventListener(type, (e) => { e.stopPropagation(); });
            });
            dlg.addEventListener('close', () => {
                dlg.remove();
                if (dbePreviewRenameDialog === dlg) { dbePreviewRenameDialog = null; }
                if (restoreFocusOnClose) { restoreFocus(); }
            });
            document.body.appendChild(dlg);
            dlg.showModal();
            input.focus();
            input.select();
            return true;
        }

        function dbePreviewContextCloseKeydown(e) {
            if (e.key !== 'Escape' || !dbePreviewContextState ||
                !document.querySelector('dialog.uniBuilderContextMenu[open]')) { return; }
            // The native dialog restores focus to its Navigator trigger after
            // Escape. Retain the preview target now and move focus only after
            // that top-layer restoration has completed.
            const state = dbePreviewContextState;
            dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => {
                if (dbePreviewContextState === state) { dbePreviewContextState = null; }
                waitFor(() => {
                    return document.querySelector('dialog.uniBuilderContextMenu[open]') ? null : true;
                }, (closed) => {
                    if (closed && !document.querySelector('dialog[open]')) {
                        dbeRestorePreviewContextTarget(state);
                    } else {
                        dbeReleasePreviewContextState(state, false);
                    }
                }, 12, DBE_COMMANDS_OWNER);
            }, 0);
        }

        function dbePreviewBuilderPoint(frame, innerX, innerY) {
            const rect = frame.getBoundingClientRect();
            const scaleX = frame.clientWidth ? rect.width / frame.clientWidth : 1;
            const scaleY = frame.clientHeight ? rect.height / frame.clientHeight : 1;
            return {
                x: Math.min(Math.max(8, rect.left + innerX * scaleX), window.innerWidth - 8),
                y: Math.min(Math.max(8, rect.top + innerY * scaleY), window.innerHeight - 8)
            };
        }

        function dbeOpenPreviewContextMenu(target, innerX, innerY) {
            const frame = dbeQuery('previewFrame');
            const row = target && navRowById(target.id);
            if (!frame || !row || document.querySelector('dialog.uniBuilderContextMenu[open]')) { return false; }

            dbeDiscardPreviewContext(false);
            dbeClearPreviewFocusState();
            if (dbeMultiSel.size) { clearMultiSel(); }
            const hadTabindex = target.element.hasAttribute('tabindex');
            if (!hadTabindex && target.element.tabIndex < 0) { target.element.setAttribute('tabindex', '-1'); }
            dbePreviewContextState = {
                id: target.id,
                element: target.element,
                tag: target.tag,
                frame,
                addedTabindex: !hadTabindex && target.element.getAttribute('tabindex') === '-1'
            };
            try { target.element.focus({ preventScroll: true }); } catch (e) { try { target.element.focus(); } catch (err) {} }
            setContextTarget(target.id);

            function open() {
                if (!dbePreviewContextState || dbePreviewContextState.id !== target.id) { return; }
                const point = dbePreviewBuilderPoint(frame, innerX, innerY);
                const event = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: point.x,
                    clientY: point.y
                });
                try { Object.defineProperty(event, 'dbePreviewContext', { value: true }); } catch (e) { event.dbePreviewContext = true; }
                row.dispatchEvent(event);
                waitFor(() => {
                    return document.querySelector('dialog.uniBuilderContextMenu[open]');
                }, (dialog) => {
                    if (!dialog && dbePreviewContextState && dbePreviewContextState.id === target.id) {
                        dbeDiscardPreviewContext(true);
                        dbeCanvasStatus(dbeT('previewContextFailed', 'Could not open the element menu'));
                    }
                }, 12, DBE_COMMANDS_OWNER);
            }

            if (activeId() === target.id) { open(); }
            else {
                clickSeq(row);
                waitFor(() => { return activeId() === target.id || null; }, (selected) => {
                    if (selected) { open(); }
                    else {
                        dbeDiscardPreviewContext(true);
                        dbeCanvasStatus(dbeT('previewContextSelectFailed', 'Could not select the preview element'));
                    }
                }, 20, DBE_COMMANDS_OWNER);
            }
            return true;
        }

        /* Builderius can retarget the eventual contextmenu event to its current
           overlay ancestor during right-button pointerdown. Capture the actual
           rendered module at pointerdown, before that selection repaint, so a
           nested heading does not become its containing section. */
        function dbePreviewContextPointerDown(e) {
            if (e.button !== 2 && !(e.button === 0 && e.ctrlKey)) { return; }
            const blocked = dbeCanvasInteractive() || dbePreviewContextBlocked(e.target);
            dbePreviewPointerContext = {
                doc: e.currentTarget,
                blocked,
                target: blocked ? null : dbePreviewContextTargetAtPoint(e.currentTarget, e.clientX, e.clientY, e.target)
            };
        }

        function dbePreviewContextMenu(e) {
            const pointer = dbePreviewPointerContext && dbePreviewPointerContext.doc === e.currentTarget
                ? dbePreviewPointerContext
                : null;
            dbePreviewPointerContext = null;
            if ((pointer && pointer.blocked) || (!pointer && (dbeCanvasInteractive() || dbePreviewContextBlocked(e.target)))) { return; }
            const target = pointer && pointer.target
                ? pointer.target
                : dbePreviewContextTargetAtPoint(e.currentTarget, e.clientX, e.clientY, e.target);
            if (!target) { return; }
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            // Let Builderius finish the pointerdown selection repaint before the
            // synthetic Navigator contextmenu opens its outer-document dialog.
            dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => {
                dbeOpenPreviewContextMenu(target, e.clientX, e.clientY);
            }, 0);
        }

        function dbePreviewContextMenuKeydown(e) {
            if (e.key === 'F2' && on('preview_rename') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                if (dbeCanvasInteractive() || dbePreviewContextBlocked(e.target)) { return; }
                const renameTarget = dbePreviewContextTarget(e.target) || dbePreviewActiveTarget(e.currentTarget);
                if (!renameTarget) { return; }
                e.preventDefault();
                e.stopPropagation();
                dbeOpenPreviewRename(renameTarget.id, renameTarget.element);
                return;
            }
            if (e.key !== 'ContextMenu' && !(e.key === 'F10' && e.shiftKey)) { return; }
            if (!on('preview_context_menu')) { return; }
            if (dbeCanvasInteractive() || dbePreviewContextBlocked(e.target)) { return; }
            const doc = e.currentTarget;
            const target = dbePreviewContextTarget(e.target) || dbePreviewActiveTarget(doc);
            if (!target) { return; }
            const rect = target.element.getBoundingClientRect();
            e.preventDefault();
            e.stopPropagation();
            dbeOpenPreviewContextMenu(target, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }

        function dbeCanvasStatus(message) {
            let status = document.querySelector('.dbe-canvas-status');
            if (!status) {
                status = document.createElement('div');
                status.className = 'dbe-canvas-status dbe-visually-hidden';
                status.setAttribute('role', 'status');
                document.body.appendChild(status);
            }
            status.textContent = '';
            dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => {
                if (status.isConnected) { status.textContent = message; }
            }, 20);
        }

        function dbeSetCanvasInteractive(interactive) {
            if (dbeCanvasInteractive() === interactive) { return false; }
            const toggle = document.querySelector('.overlayToggleIcon');
            if (toggle) { clickSeq(toggle); }
            else {
                try { store().storeSet('overlayMode', interactive ? 'interact' : 'selectModule'); } catch (e) { return false; }
            }
            dbeCanvasStatus(interactive
                ? dbeT('canvasInteractiveOn', 'Interacting with page. Press Escape to select elements.')
                : dbeT('canvasSelectionOn', 'Selecting elements.'));
            if (!interactive) {
                const frame = dbeQuery('previewFrame');
                if (frame) { dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => { try { frame.focus(); } catch (e) {} }, 0); }
            }
            return true;
        }

        function dbeCanvasRows() {
            const root = navRootList();
            if (!root) { return []; }
            return [].slice.call(root.querySelectorAll(NAV_ROW_SEL)).filter((row) => {
                let parent = navParentRow(row);
                while (parent) {
                    if (!navRowExpanded(parent)) { return false; }
                    parent = navParentRow(parent);
                }
                return true;
            });
        }

        function dbeCanvasSelectRow(row) {
            if (!row) { return; }
            clickSeq(row);
            const label = (row.textContent || '').trim() || dbeT('element', 'Element');
            dbeCanvasStatus(dbeFmt(dbeT('canvasSelected', 'Selected %s'), label));
        }

        function dbeCanvasNavigationKeydown(e) {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) { return; }
            const target = e.target;
            if (target && target.closest && target.closest('input, textarea, select, [contenteditable="true"], .monaco-editor')) { return; }

            if (dbeCanvasInteractive()) {
                // This listener runs in the bubble phase, so page widgets get the
                // first opportunity to handle Escape themselves.
                if (on('keyboard_shortcuts') && e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    dbeSetCanvasInteractive(false);
                }
                return;
            }

            if (on('keyboard_shortcuts') && e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (!dbeCanvasStartTextEditing()) { dbeSetCanvasInteractive(true); }
                return;
            }
            if (!on('navigator_keyboard') || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) { return; }

            const rows = dbeCanvasRows();
            if (!rows.length) { return; }
            const current = navRowById(activeId());
            const i = rows.indexOf(current);
            e.preventDefault();
            e.stopPropagation();
            if (i < 0) {
                dbeCanvasSelectRow((e.key === 'ArrowUp' || e.key === 'End') ? rows[rows.length - 1] : rows[0]);
                return;
            }

            switch (e.key) {
                case 'ArrowDown':
                    if (i < rows.length - 1) { dbeCanvasSelectRow(rows[i + 1]); }
                    break;
                case 'ArrowUp':
                    if (i > 0) { dbeCanvasSelectRow(rows[i - 1]); }
                    break;
                case 'Home':
                    dbeCanvasSelectRow(rows[0]);
                    break;
                case 'End':
                    dbeCanvasSelectRow(rows[rows.length - 1]);
                    break;
                case 'ArrowRight':
                    if (navRowExpandable(current) && !navRowExpanded(current)) {
                        navToggleExpand(current);
                    } else if (navRowExpandable(current) && navRowExpanded(current)) {
                        const child = rows[i + 1];
                        if (child && navRowLi(current).contains(child)) { dbeCanvasSelectRow(child); }
                    }
                    break;
                case 'ArrowLeft':
                    if (navRowExpandable(current) && navRowExpanded(current)) {
                        navToggleExpand(current);
                    } else {
                        dbeCanvasSelectRow(navParentRow(current));
                    }
                    break;
            }
        }

        function dbeReleaseCommandFrameDocuments(keepDoc) {
            dbeCommandFrameDocuments.filter((record) => { return record.doc !== keepDoc; }).forEach((record) => {
                dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, record.doc, 'palette-key');
                dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, record.doc, 'canvas-text-editing-key');
                dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, record.doc, 'canvas-navigation-key');
                dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, record.doc, 'reveal-selection-click');
                dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, record.doc, 'preview-context-menu');
                dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, record.doc, 'preview-context-menu-key');
                dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, record.doc, 'preview-context-pointer');
                if (record.observer) { record.observer.disconnect(); }
                try { delete record.doc.dbeCanvasTextEditingActive; } catch (e) {}
            });
            dbeCommandFrameDocuments = dbeCommandFrameDocuments.filter((record) => { return record.doc === keepDoc; });
            if (dbePreviewFocusState && dbePreviewFocusState.element.ownerDocument !== keepDoc) {
                dbeClearPreviewFocusState();
            }
        }

        function dbeBindKeyboardFrameDocument(frame) {
            let doc, root;
            try {
                doc = frame && frame.isConnected ? frame.contentDocument : null;
                root = doc && doc.documentElement;
            } catch (e) { return; }
            // Persistent canvas tabs replace the preview iframe document while
            // the shared chrome observer is refreshing. During that short swap
            // contentDocument can exist before it has a documentElement (or the
            // frame can already have been detached). Do not bind a stale realm;
            // the iframe load event or next refresh will attach to the live one.
            if (!doc || !root || root.nodeType !== 1) { return; }
            dbeReleaseCommandFrameDocuments(doc);
            let record = dbeCommandFrameDocuments.filter((item) => { return item.doc === doc; })[0];
            if (!record) {
                record = { doc, observer: null };
                dbeCommandFrameDocuments.push(record);
            }
            if (on('command_palette')) {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, doc, 'palette-key', 'keydown', dbePaletteKeydown, true);
            }
            if (on('keyboard_shortcuts')) {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, doc, 'canvas-text-editing-key', 'keydown', dbeCanvasTextEditingKeydown, true);
            }
            if (on('keyboard_shortcuts') && !record.observer) {
                record.observer = new MutationObserver(() => {
                    dbeSyncCanvasEditingIndicator(doc);
                });
                try {
                    record.observer.observe(root, { childList: true, subtree: true });
                } catch (e) {
                    record.observer.disconnect();
                    record.observer = null;
                    return;
                }
            }
            if (on('keyboard_shortcuts')) { dbeSyncCanvasEditingIndicator(doc); }
            if (on('navigator_keyboard') || on('keyboard_shortcuts')) {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, doc, 'canvas-navigation-key', 'keydown', dbeCanvasNavigationKeydown);
            }
            if (on('reveal_selected')) {
                // Builderius changes activeModule after its own canvas click
                // handler. Schedule on the next task so the store and selected
                // Navigator row have caught up before revealActiveInTree() reads.
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, doc, 'reveal-selection-click', 'click', () => {
                    dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => { schedule('canvas-selection'); }, 0);
                });
            }
            if (on('preview_context_menu')) {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, doc, 'preview-context-pointer', 'pointerdown', dbePreviewContextPointerDown, true);
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, doc, 'preview-context-menu', 'contextmenu', dbePreviewContextMenu, true);
            }
            if (on('preview_context_menu') || on('preview_rename')) {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, doc, 'preview-context-menu-key', 'keydown', dbePreviewContextMenuKeydown, true);
            }
        }

        function ensureKeyboardIframeBridge() {
            const frame = dbeQuery('previewFrame');
            if (!frame) {
                if (dbeKeyboardFrame) { dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, dbeKeyboardFrame, 'canvas-frame-load'); }
                dbeKeyboardFrame = null;
                dbeReleaseCommandFrameDocuments(null);
                return;
            }
            if (dbeKeyboardFrame !== frame) {
                if (dbeKeyboardFrame) { dbeUnbindOwnedEvent(DBE_COMMANDS_OWNER, dbeKeyboardFrame, 'canvas-frame-load'); }
                dbeReleaseCommandFrameDocuments(null);
                dbeKeyboardFrame = frame;
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, frame, 'canvas-frame-load', 'load', () => {
                    dbeBindKeyboardFrameDocument(frame);
                });
            }
            dbeBindKeyboardFrameDocument(frame);
        }


        /* Top-bar palette button: a pointer-visible way into the palette, and the
           shortcut's discovery surface (the tooltip and accessible name carry the
           current combo). Same uniPanelButton recipe as the theme/density toggles;
           sits with them at the start of the right column. */
        function ensurePaletteButton() {
            const col = document.querySelector('.uniTopPanel__rightCol');
            if (!col || col.querySelector('.dbe-palette-btn')) { return; }
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'uniPanelButton dbe-palette-btn';
            const span = document.createElement('span');
            span.innerHTML =
                '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                '<path d="M2.2 3.2l3.2 3.3-3.2 3.3M7.6 10.8h4.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            btn.appendChild(span);
            const tip = dbeFmt(dbeT('paletteTip', 'Command palette (%s)'), dbePaletteAccel());
            setTip(btn, tip);
            btn.setAttribute('aria-label', tip);
            btn.setAttribute('aria-keyshortcuts', dbePaletteAriaShortcut());
            btn.addEventListener('click', () => {
                if (document.querySelector('dialog[open]')) { return; } // a non-modal dialog is up — same guard as the shortcut
                openCommandPalette();
            });
            // After our other mode buttons when present, else first in the column.
            const siblings = col.querySelectorAll('.dbe-theme-btn, .dbe-density-btn');
            const last = siblings.length ? siblings[siblings.length - 1] : null;
            col.insertBefore(btn, last ? last.nextSibling : col.firstChild);
        }

        /* Class-chip copy menu (context_menu). The class chips in the Styles
           editor natively offer only a hover-revealed remove (X); right-click
           (or Shift+F10 on a focused chip) opens a small menu to copy the class
           name — with the leading dot for CSS, without it for markup, or every
           class at once — or remove it from the element (via the chip's own
           remove control, so it goes through the builder store). A plain fixed
           card (no showModal): dismissed by any outside pointer press, scroll
           or Escape. */
        let dbeChipMenu = null;

        function closeChipMenu() {
            if (dbeChipMenu) { dbeChipMenu.remove(); dbeChipMenu = null; }
        }

        function dbeCopyText(text) {
            function done() { undoToast(dbeFmt(dbeT('copied', 'Copied %s'), text)); }
            function fallback() {
                try {
                    const ta = document.createElement('textarea');
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
        function renderChipCard(focusReturn, x, y, items, label) {
            closeChipMenu();
            if (!items || !items.length) { return; }
            const card = document.createElement('div');
            card.className = 'uniBuilderContextMenu dbe-ctx-submenu dbe-chip-menu';
            const inner = document.createElement('div');
            inner.className = 'uniBuilderContextMenu__inner';
            const menu = document.createElement('div');
            menu.className = 'uniContextMenu';
            menu.setAttribute('role', 'menu');
            // A menu needs an accessible name or screen readers announce a bare
            // "menu" with no hint of what it acts on.
            if (label) { menu.setAttribute('aria-label', label); }
            const ul = document.createElement('ul');
            items.forEach((item) => {
                const li = document.createElement('li');
                li.className = 'uniContextMenu__item' + (item.first ? ' dbe-ctx-item--first' : '');
                li.setAttribute('role', 'menuitem');
                li.tabIndex = -1;
                li.textContent = item.label;
                function act(ev) { ev.preventDefault(); ev.stopPropagation(); closeChipMenu(); item.fn(); }
                // Activate on click, not mousedown: pressing and dragging away must
                // cancel, and a screen reader's simulated click must not double-fire
                // against the keydown path. mousedown only suppresses the focus jump.
                li.addEventListener('mousedown', (ev) => { ev.preventDefault(); ev.stopPropagation(); });
                li.addEventListener('click', act);
                li.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') { act(ev); }
                });
                ul.appendChild(li);
            });
            menu.appendChild(ul);
            inner.appendChild(menu);
            card.appendChild(inner);

            // Keyboard: arrows move (wrapping), Home/End jump, Escape closes and
            // returns focus to the chip.
            card.addEventListener('keydown', (ev) => {
                const lis = [].slice.call(card.querySelectorAll('li'));
                const idx = lis.indexOf(document.activeElement);
                let next = -1;
                if (ev.key === 'ArrowDown') { next = idx < 0 ? 0 : (idx + 1) % lis.length; }
                else if (ev.key === 'ArrowUp') { next = idx < 0 ? lis.length - 1 : (idx - 1 + lis.length) % lis.length; }
                else if (ev.key === 'Home') { next = 0; }
                else if (ev.key === 'End') { next = lis.length - 1; }
                if (next > -1) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    lis[next].focus();
                    return;
                }
                if (ev.key === 'Escape') {
                    ev.preventDefault();
                    ev.stopPropagation();
                    closeChipMenu();
                    if (focusReturn) { try { focusReturn.focus(); } catch (e) {} }
                }
            });

            document.body.appendChild(card);
            const cw = card.offsetWidth || 176;
            const ch = card.offsetHeight || 80;
            card.style.setProperty('left', Math.min(Math.max(8, x), window.innerWidth - cw - 8) + 'px', 'important');
            card.style.setProperty('top', Math.min(Math.max(8, y), window.innerHeight - ch - 8) + 'px', 'important');
            dbeChipMenu = card;
            const first = card.querySelector('li');
            if (first) { first.focus(); }
        }

        /* The copy items shared by both menus. `name` is the dotted class ('.foo'),
           `allClasses` the full applied set (dotted or bare — dots are stripped). */
        function chipCopyItems(name, allClasses) {
            const bare = name.replace(/^[.#]/, '');
            const items = [{ label: dbeFmt(dbeT('copyName', 'Copy %s'), name), fn () { dbeCopyText(name); } }];
            if (bare !== name) {
                items.push({ label: dbeFmt(dbeT('copyNoDot', 'Copy %s (no dot)'), bare), fn () { dbeCopyText(bare); } });
            }
            if (allClasses && allClasses.length > 1) {
                items.push({ label: dbeFmt(dbeT('copyAllClasses', 'Copy all classes (%s)'), allClasses.length), fn () {
                    dbeCopyText(allClasses.map((n) => { return n.replace(/^\./, ''); }).join(' '));
                } });
            }
            return items;
        }

        /* Every applied class name for the active module, read from the store so it
           still works while a class is "active" and the DOM chip list is hidden. */
        function activeModuleClasses() {
            try {
                const mods = modules(), id = activeId();
                return (mods && mods[id]) ? moduleClasses(mods[id]).slice() : [];
            } catch (e) { return []; }
        }

        // Applied-class list chip: copy the name(s), or remove it from the element
        // (via the chip's own X, so the removal goes through the builder store).
        function openChipMenu(chipLi, x, y) {
            const nameEl = chipLi.querySelector('span') || chipLi;
            const name = (nameEl.textContent || '').trim();
            if (!name) { return; }
            const all = [].slice.call(document.querySelectorAll('.uniModuleCssClassesSelect__list li > span'))
                .map((s) => { return (s.textContent || '').trim(); })
                .filter(Boolean);
            const items = chipCopyItems(name, all);
            const actions = chipLi.querySelector('.actions');
            if (actions) {
                items.push({ first: true, label: dbeFmt(dbeT('removeFromElement', 'Remove %s from element'), name), fn () {
                    actions.click();
                    undoToast(dbeFmt(dbeT('removedName', 'Removed %s'), name));
                } });
            }
            renderChipCard(chipLi, x, y, items, dbeFmt(dbeT('chipMenuFor', 'Actions for %s'), name));
        }

        /* Active-selector chip — the class currently being edited. Natively it offers
           only a caret → "Close" (deselect) menu; this brings it to parity with the
           list chips: copy the name / all classes, remove it from the element, plus
           the native Close. Reachable by right-click AND the caret (whose native
           "Close"-only menu is suppressed unless dbeSelCaretBypass lets a driver
           through). */
        let dbeSelCaretBypass = false;

        function selCaretBtn() {
            return document.querySelector('.uniSystemSelectClasses .uniModuleCssSelectorItemSelected .actions button');
        }

        /* Drive the native caret → "Close" item to deselect the active class. done(ok). */
        function driveSelectedClose(done) {
            const btn = selCaretBtn();
            if (!btn) { if (done) { done(false); } return; }
            dbeSelCaretBypass = true;               // let this programmatic click reach the native menu
            try { btn.click(); } catch (e) {}
            dbeSelCaretBypass = false;
            waitFor(() => {
                const m = document.querySelector('.uniContextMenu[data-menu-id^="selected_selector_actions_"]');
                if (!m) { return null; }
                return [].slice.call(m.querySelectorAll('li[role="menuitem"]')).filter((l) => {
                    return /^close$/i.test((l.textContent || '').trim());
                })[0] || null;
            }, (li) => {
                if (li) { li.click(); if (done) { done(true); } }
                else if (done) { done(false); }
            });
        }

        /* Remove the active class from the element: deselect (Close) so the chip list
           returns, then click the matching chip's remove control (store-backed). */
        function removeSelectedClass(name, done) {
            driveSelectedClose(() => {
                waitFor(() => {
                    return [].slice.call(document.querySelectorAll('.uniModuleCssClassesSelect__list li')).filter((li) => {
                        const s = li.querySelector('span');
                        return s && (s.textContent || '').trim() === name;
                    })[0] || null;
                }, (li) => {
                    const actions = li && li.querySelector('.actions');
                    if (actions) { actions.click(); if (done) { done(true); } }
                    else if (done) { done(false); }
                });
            });
        }

        function openSelectedChipMenu(selChip, x, y) {
            const nameEl = selChip.querySelector('span') || selChip;
            const name = (nameEl.textContent || '').trim();
            if (!name) { return; }
            const items = chipCopyItems(name, activeModuleClasses());
            items.push({ first: true, label: dbeFmt(dbeT('removeFromElement', 'Remove %s from element'), name), fn () {
                removeSelectedClass(name, (ok) => {
                    if (ok) { undoToast(dbeFmt(dbeT('removedName', 'Removed %s'), name)); }
                });
            } });
            items.push({ label: dbeT('close', 'Close'), fn () { driveSelectedClose(() => {}); } });
            renderChipCard(selChip, x, y, items, dbeFmt(dbeT('chipMenuFor', 'Actions for %s'), name));
        }

        /* Chips are plain li>span with no focus support; tabindex lets keyboard
           users reach them and open the copy menu with Shift+F10 / the Menu key. */
        function decorateClassChips() {
            document.querySelectorAll('.uniModuleCssClassesSelect__list li, .uniSystemSelectClasses .uniModuleCssSelectorItemSelected').forEach((li) => {
                dbeRememberOwnedAttributes(DBE_COMMANDS_OWNER, li, ['tabindex']);
                li.tabIndex = 0;
            });
        }

        function bindChipMenu() {
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'chip-menu-context', 'contextmenu', (e) => {
                // Active-selector chip first (it is not inside the __list).
                const sel = e.target.closest && e.target.closest('.uniSystemSelectClasses .uniModuleCssSelectorItemSelected');
                if (sel) {
                    e.preventDefault();
                    e.stopPropagation();
                    const rs = sel.getBoundingClientRect();
                    openSelectedChipMenu(sel, e.clientX || rs.right, e.clientY || rs.top);
                    return;
                }
                const li = e.target.closest && e.target.closest('.uniModuleCssClassesSelect__list li');
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
            ['pointerdown', 'mousedown'].forEach((t) => {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'chip-menu-' + t, t, (e) => {
                    if (dbeSelCaretBypass) { return; }
                    if (selCaretActions(e)) { e.stopPropagation(); }
                }, true);
            });
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'chip-menu-click', 'click', (e) => {
                if (dbeSelCaretBypass) { return; }
                const actions = selCaretActions(e);
                if (!actions) { return; }
                e.preventDefault();
                e.stopPropagation();
                const sel = actions.closest('.uniModuleCssSelectorItemSelected');
                const anchor = actions.querySelector('button') || actions;
                const rb = anchor.getBoundingClientRect();
                openSelectedChipMenu(sel, rb.left, rb.bottom + 2);
            }, true);
            bindChipMenuDismiss();
        }

        /* Outside dismissal for every renderChipCard menu (chip menus, the
           Navigator empty-area menu): any outside pointer press, scroll or
           Escape closes it. Bound once, shared by whichever features need it. */
        function bindChipMenuDismiss() {
            ['pointerdown', 'wheel'].forEach((t) => {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'chip-menu-dismiss-' + t, t, (e) => {
                    if (dbeChipMenu && !(e.target.closest && e.target.closest('.dbe-chip-menu'))) { closeChipMenu(); }
                }, true);
            });
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'chip-menu-dismiss-key', 'keydown', (e) => {
                if (e.key === 'Escape' && dbeChipMenu && !(e.target.closest && e.target.closest('.dbe-chip-menu'))) {
                    e.stopPropagation();
                    closeChipMenu();
                }
            }, true);
        }

        /* (h) Follow the preview selection in the tree: when the active module changes
           (e.g. the user clicks an element on the canvas), expand every collapsed
           ancestor branch down to it and scroll its row into view, so the selection is
           never hidden inside a collapsed subtree. Builderius exposes no selection
           hook, so the existing coalesced chrome observer and a canvas click bridge
           schedule the cheap storeGet comparison only when relevant UI work occurs. */
        let dbeLastRevealedId = null;
        let dbeSelectionContextState = '';

        function dbeSelectionPath(id) {
            const mods = modules() || {};
            const chain = [];
            const seen = {};
            while (id && mods[id] && !seen[id] && chain.length < 100) {
                seen[id] = true;
                chain.unshift(String(mods[id].label || mods[id].name || dbeT('element', 'element')).trim());
                id = mods[id].parent || '';
            }
            return chain.filter(Boolean);
        }

        /* When the Navigator is collapsed, its selected row and ancestry disappear.
           Keep a compact, non-interactive breadcrumb in the builder chrome so the
           extra canvas space does not cost the user their current location. */
        function dbeSyncSelectionContext() {
            let current = document.querySelector('.dbe-canvas-selection-context');
            const wrappers = dbePanelWrappers();
            const id = activeId();
            if (!id || !dbePanelSideHidden('right', wrappers.right)) {
                if (current) { current.remove(); }
                dbeSelectionContextState = '';
                return;
            }

            const path = dbeSelectionPath(id);
            if (!path.length) {
                if (current) { current.remove(); }
                dbeSelectionContextState = '';
                return;
            }
            const fullPath = path.join(' › ');
            const visiblePath = path.length > 4 ? ['…'].concat(path.slice(-3)).join(' › ') : fullPath;
            const nextState = id + '|' + fullPath;
            if (current && dbeSelectionContextState === nextState) { return; }

            const host = document.querySelector('.uniIframePanel__outer');
            if (!host) { return; }
            if (!current) {
                current = document.createElement('div');
                current.className = 'dbe-canvas-selection-context';
                current.appendChild(document.createElement('strong'));
                current.appendChild(document.createElement('span'));
                host.appendChild(current);
            }
            current.querySelector('strong').textContent = dbeT('selectionContext', 'Selected');
            current.querySelector('span').textContent = visiblePath;
            current.setAttribute('aria-label', dbeFmt(dbeT('selectionContextLabel', 'Selected element: %s'), fullPath));
            current.title = fullPath;
            dbeSelectionContextState = nextState;
        }
        /* Bring the row into view inside the Navigator's OWN scroll box. The tree
           nests several overflow:visible wrappers inside one scrollable container, so
           walk up to the nearest ancestor that actually scrolls (auto/scroll overflow,
           real height, content taller than box) and centre the row by hand — steadier
           than scrollIntoView across the nested layout, and a no-op when the row is
           already fully visible or the panel has no height (collapsed / hidden). */
        function scrollRowIntoTree(row) {
            let sc = row.parentElement;
            while (sc && sc !== document.body) {
                const oy = getComputedStyle(sc).overflowY;
                if ((oy === 'auto' || oy === 'scroll') && sc.clientHeight > 0 && sc.scrollHeight > sc.clientHeight + 2) { break; }
                sc = sc.parentElement;
            }
            if (!sc || sc === document.body || !sc.clientHeight) {
                try { row.scrollIntoView({ block: 'center' }); } catch (e) {}
                return;
            }
            const rr = row.getBoundingClientRect(), sr = sc.getBoundingClientRect();
            if (rr.top >= sr.top && rr.bottom <= sr.bottom) { return; } // already fully visible
            sc.scrollTop += (rr.top - sr.top) - (sc.clientHeight - rr.height) / 2;
        }
        function revealActiveInTree() {
            if (renameActive()) { return; }
            const id = activeId();
            if (!id || id === dbeLastRevealedId) { return; }
            const mods = modules();
            if (!mods || !mods[id]) { return; }
            dbeLastRevealedId = id;

            // Expand each collapsed ancestor, root-most first. Collapsed subtrees stay
            // mounted (their <ul> is display:none), so every ancestor row is already in
            // the DOM — one pass reaches them all. Only rows without .expanded are
            // clicked, so an already-open branch is never toggled shut.
            const chain = [];
            let p = mods[id].parent || '';
            while (p) { chain.unshift(p); p = mods[p] ? (mods[p].parent || '') : ''; }
            chain.forEach((aid) => {
                const abtn = document.querySelector('.uniRightPanel .uni-tree-node-' + aid);
                if (abtn && !abtn.classList.contains('expanded')) {
                    const chev = abtn.querySelector('i');
                    if (chev) { clickSeq(chev); }
                }
            });

            // Scroll the row into view once it actually has layout (expansion is an
            // async re-render; getClientRects() is empty while an ancestor is still
            // collapsed or the panel is hidden), and only if it is not already fully
            // visible — no jump when clicking around already-visible rows.
            waitFor(() => {
                const row = document.querySelector('.uniRightPanel .uni-tree-node-' + id);
                return (row && row.getClientRects().length) ? row : null;
            }, (row) => {
                if (row) { try { scrollRowIntoTree(row); } catch (e) {} }
            }, 60, DBE_COMMANDS_OWNER);
        }
        function bindRevealActive() {
            // Seed with the current selection so the very first tick does not yank the
            // view to whatever happened to be selected at load.
            dbeLastRevealedId = activeId();
            try { dbeSyncSelectionContext(); } catch (e) {}
        }


        /* (ra) Navigator row quick actions (navigator_row_actions). Duplicate and
           Delete buttons on the hovered/focused Navigator row, without opening the
           right-click menu (issue #54).

           ONE floating cluster of two real <button>s, never injected into the
           rows: a row is itself a <button> (buttons cannot nest), the tree is
           React-rendered (injected children die on every re-render), and (nk)
           exposes it as a strict ARIA tree that stray buttons inside would break.
           The cluster lives in .uniModTree__container AFTER the row scroller, so
           from a focused row Tab reaches Duplicate, then Delete, and its fixed
           position overlays the target row's right edge.

           Positioning is progressive enhancement: browsers with CSS anchor
           positioning get anchor-name stamped inline on the target row and track
           scrolling natively (position-visibility hides the cluster when the row
           leaves the scrollport); the rest take a getBoundingClientRect path with
           a capture-phase scroll reposition. Both actions go through the proven
           native channel — driveContextMenuItem — so behaviour (render, save,
           undo capture) is exactly the context menu's. */
        const RA_MODE = (CFG.rowActions && CFG.rowActions.mode) === 'always' ? 'always' : 'hover';
        const RA_CAN_ANCHOR = !!(window.CSS && CSS.supports && CSS.supports('anchor-name: --a'));
        let raBox = null;          // the cluster (module-level singleton: the same
        let raDup = null;          // node is re-inserted after a re-render, so its
        let raDel = null;          // listeners survive)
        let raId = null;           // target row's module id
        let raStampedRow = null;   // the row node currently carrying class/anchor
        let raHideT = null;
        let raSuppressed = false;  // during a native row drag
        let raScrollQueued = false;
        let raDelArmed = false;    // Delete is two-step: arm, then confirm
        let raDelArmT = null;

        function raBuild() {
            if (raBox) { return raBox; }
            raBox = document.createElement('div');
            raBox.className = 'dbe-row-actions';
            raBox.hidden = true;
            raDup = document.createElement('button');
            raDup.type = 'button';
            raDup.className = 'dbe-row-actions__btn dbe-row-actions__dup';
            raDup.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                '<rect x="3.9" y="3.9" width="6.6" height="6.6" rx="1.2" stroke="currentColor" stroke-width="1.3"/>' +
                '<path d="M8.1 2.3v-.2A1.6 1.6 0 0 0 6.5.5H2.1A1.6 1.6 0 0 0 .5 2.1v4.4a1.6 1.6 0 0 0 1.6 1.6h.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
                '</svg>';
            raDel = document.createElement('button');
            raDel.type = 'button';
            raDel.className = 'dbe-row-actions__btn dbe-row-actions__del';
            raDel.innerHTML = '<svg width="12" height="13" viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                '<path d="M1 3h10M4.2 3V1.9c0-.5.4-.9.9-.9h1.8c.5 0 .9.4.9.9V3M2.2 3l.6 8.2c0 .5.4.8.9.8h4.6c.5 0 .9-.3.9-.8L9.8 3M4.8 5.4v4M7.2 5.4v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
                '</svg>';
            raDup.addEventListener('click', raDuplicate);
            raDel.addEventListener('click', raDelete);
            raBox.addEventListener('keydown', raOnKeydown);
            raBox.appendChild(raDup);
            raBox.appendChild(raDel);
            return raBox;
        }

        // Accessible names carry the target so the buttons make sense wherever
        // focus finds them ("Duplicate "Hero"", not a bare "Duplicate"). Labels
        // come from the STORE, not the row text — tag badges write into the row.
        function raSetNames(id) {
            const m = (modules() || {})[id];
            const label = (m && (m.label || m.name)) || dbeT('element', 'element');
            const dup = dbeFmt(dbeT('rowActionDuplicate', 'Duplicate “%s”'), label);
            const del = raDelArmed
                ? dbeFmt(dbeT('rowActionDeleteConfirm', 'Confirm delete “%s”'), label)
                : dbeFmt(dbeT('rowActionDelete', 'Delete “%s”'), label);
            if (raDup.getAttribute('aria-label') !== dup) {
                raDup.setAttribute('aria-label', dup);
                raDup.setAttribute('data-dbe-tip', dup);
            }
            if (raDel.getAttribute('aria-label') !== del) {
                raDel.setAttribute('aria-label', del);
                raDel.setAttribute('data-dbe-tip', del);
            }
        }

        function raUnstamp() {
            if (!raStampedRow) { return; }
            raStampedRow.classList.remove('dbe-row-actions-on');
            if (RA_CAN_ANCHOR) { raStampedRow.style.removeProperty('anchor-name'); }
            raStampedRow = null;
        }

        function raStamp(row) {
            if (raStampedRow === row) { return; }
            raUnstamp();
            row.classList.add('dbe-row-actions-on');
            if (RA_CAN_ANCHOR) { row.style.setProperty('anchor-name', '--dbe-row-actions'); }
            raStampedRow = row;
        }

        function raPosition(row) {
            if (RA_CAN_ANCHOR) {
                raBox.classList.add('dbe-anchored');
                raBox.style.left = '';
                raBox.style.top = '';
                return;
            }
            const r = row.getBoundingClientRect();
            const b = raBox.getBoundingClientRect();
            const w = b.width || 54, h = b.height || 26;
            // Right-aligned inside the row's rect (so pointer travel row → cluster
            // never leaves the union), clamped so a short, deeply nested row cannot
            // push the cluster past its own left edge.
            raBox.style.left = Math.round(Math.max(r.left + 2, r.right - w - 4)) + 'px';
            raBox.style.top = Math.round(r.top + r.height / 2 - h / 2) + 'px';
        }

        // Stand the armed Delete down and restore its resting name/state.
        function raDisarmDelete() {
            if (!raDelArmed) { return; }
            raDelArmed = false;
            dbeClearOwnedTimeout(DBE_COMMANDS_OWNER, raDelArmT);
            raDelArmT = null;
            raDel.classList.remove('dbe-row-actions__del--armed');
            if (raId) { raSetNames(raId); }
        }

        function raHide() {
            raDisarmDelete();
            dbeClearOwnedTimeout(DBE_COMMANDS_OWNER, raHideT);
            raHideT = null;
            const lastRow = raStampedRow;
            raId = null;
            raUnstamp();
            if (raBox && !raBox.hidden) {
                // Never strand focus in a display:none subtree — hand it back to
                // the tree first.
                if (raBox.contains(document.activeElement)) {
                    const row = (lastRow && lastRow.isConnected && lastRow.offsetParent !== null)
                        ? lastRow : navVisibleRows()[0];
                    if (row) { try { row.focus(); } catch (e) {} }
                }
                raBox.hidden = true;
            }
        }

        function raShow(id) {
            dbeClearOwnedTimeout(DBE_COMMANDS_OWNER, raHideT);
            raHideT = null;
            if (!id || raSuppressed) { return; }
            // A REAL open context menu owns the row — do not paint over it. (Our
            // own invisible auto-driven menus are marked html.dbe-auto-ctx.)
            if (document.querySelector('dialog.uniBuilderContextMenu[open]') &&
                !document.documentElement.classList.contains('dbe-auto-ctx')) { return; }
            const row = navRowById(id);
            if (!row || row.offsetParent === null) { return; }
            if (id !== raId) { raDisarmDelete(); } // a retarget invalidates the armed state
            raId = id;
            raSetNames(id);
            raStamp(row);
            if (raBox.hidden) { raBox.hidden = false; }
            raPosition(row);
        }

        // Leaving the row/cluster union: stay with a row that still holds keyboard
        // focus, else in "always" mode fall back to the selected row, else hide.
        function raRelease() {
            const ae = document.activeElement;
            const focusedRow = ae && ae.closest && ae.closest(NAV_ROW_SEL);
            if (focusedRow && focusedRow.offsetParent !== null) { raShow(navRowId(focusedRow)); return; }
            if (RA_MODE === 'always') {
                const sel = activeId();
                const row = sel ? navRowById(sel) : null;
                if (row && row.offsetParent !== null) { raShow(sel); return; }
            }
            raHide();
        }

        // Re-render reconciliation, run from every schedule() tick: the row node
        // behind raId may have been replaced (re-stamp the fresh node) or be gone/
        // hidden entirely (release). In "always" mode this is also what makes the
        // cluster follow selection — the class mutations selection causes already
        // drive schedule().
        function raSync() {
            if (!raBox) { return; }
            if (raSuppressed) { return; }
            if (raId) {
                const row = navRowById(raId);
                if (!row || row.offsetParent === null) { raRelease(); return; }
                raSetNames(raId);
                raStamp(row);
                if (!raBox.hidden) { raPosition(row); }
                return;
            }
            if (RA_MODE === 'always' && !raBox.contains(document.activeElement)) { raRelease(); }
        }

        function raInUnion(node) {
            if (!node || node.nodeType !== 1) { return false; }
            if (raBox && raBox.contains(node)) { return true; }
            const btn = node.closest && node.closest(NAV_ROW_SEL);
            return !!(btn && raId && navRowId(btn) === raId);
        }

        function raPointerOver(e) {
            const btn = e.target.closest && e.target.closest(NAV_ROW_SEL);
            if (btn) {
                dbeClearOwnedTimeout(DBE_COMMANDS_OWNER, raHideT);
                raHideT = null;
                const id = navRowId(btn);
                if (id && id !== raId) { raShow(id); } else { raShow(raId); }
                return;
            }
            if (raBox && raBox.contains(e.target)) {
                dbeClearOwnedTimeout(DBE_COMMANDS_OWNER, raHideT);
                raHideT = null;
            }
        }

        function raPointerOut(e) {
            if (!raId) { return; }
            if (raInUnion(e.relatedTarget)) { return; }
            // Keep the cluster while a keyboard user is inside it — a stray
            // pointerout (e.g. the row re-rendering under a parked pointer) must
            // not steal it from under their focus.
            if (raBox.contains(document.activeElement)) { return; }
            dbeClearOwnedTimeout(DBE_COMMANDS_OWNER, raHideT);
            raHideT = dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => {
                raHideT = null;
                raRelease();
            }, 150); // grace for diagonal/subpixel exits
        }

        function raFocusIn(e) {
            const btn = e.target.closest && e.target.closest(NAV_ROW_SEL);
            if (btn) {
                dbeClearOwnedTimeout(DBE_COMMANDS_OWNER, raHideT);
                raHideT = null;
                raShow(navRowId(btn));
            } else if (raBox && raBox.contains(e.target)) {
                dbeClearOwnedTimeout(DBE_COMMANDS_OWNER, raHideT);
                raHideT = null;
            }
        }

        function raFocusOut(e) {
            if (!raId) { return; }
            if (raInUnion(e.relatedTarget)) { return; }
            raRelease();
        }

        function raOnScroll() {
            if (RA_CAN_ANCHOR || !raId || raScrollQueued) { return; }
            raScrollQueued = true;
            dbeSetOwnedFrame(DBE_COMMANDS_OWNER, () => {
                raScrollQueued = false;
                const row = raId && navRowById(raId);
                if (!row) { return; }
                // Blank the box while the row is outside the scrollport WITHOUT
                // releasing the target (the anchor path gets exactly this from
                // position-visibility) — the row may still hold keyboard focus,
                // and scrolling back brings the cluster with it. Never blank it
                // out from under focus, though: display:none would strand the
                // keyboard user on <body>.
                const sc = row.closest('.uniModTree__container');
                const rr = row.getBoundingClientRect();
                const sr = sc ? sc.getBoundingClientRect() : null;
                const out = !!(sr && (rr.bottom < sr.top || rr.top > sr.bottom));
                if (out && !raBox.contains(document.activeElement)) {
                    if (!raBox.hidden) { raBox.hidden = true; }
                    return;
                }
                if (raBox.hidden) { raBox.hidden = false; }
                raPosition(row);
            });
        }

        function raOnKeydown(e) {
            if (e.key !== 'Escape') { return; }
            e.preventDefault();
            e.stopPropagation(); // the builder's own Escape handlers must not also fire
            if (raDelArmed) { raDisarmDelete(); return; } // first Escape only stands Delete down
            const row = raId && navRowById(raId);
            if (!row) { raRelease(); return; }
            if (on('navigator_keyboard')) { navFocus(row); } else { row.focus(); }
        }

        function raFocusRow(row) {
            if (!row) { return; }
            if (on('navigator_keyboard')) { navFocus(row); } else { row.focus(); }
        }

        function raDuplicate(e) {
            e.stopPropagation();
            raDisarmDelete();
            const id = raId;
            if (!id || raDup.disabled) { return; }
            const before = Object.keys(modules() || {});
            const parent = ((modules() || {})[id] || {}).parent || '';
            raDup.disabled = true;
            driveContextMenuItem(id, 'Duplicate', (ok) => {
                raDup.disabled = false;
                if (!ok) { return; }
                undoToast(dbeT('duplicated', 'Duplicated element'), 'undo');
                // Land focus on the copy: the new id is whatever appeared in the
                // store under the same parent (the dbeRestoreOp diff pattern).
                waitFor(() => {
                    const mods = modules() || {};
                    return Object.keys(mods).find((nid) => {
                        return before.indexOf(nid) === -1 && (mods[nid].parent || '') === parent;
                    }) || null;
                }, (newId) => {
                    const row = navRowById(newId || id);
                    if (!row) { return; }
                    raFocusRow(row);
                    raShow(navRowId(row));
                });
            });
        }

        function raDelete(e) {
            e.stopPropagation();
            const id = raId;
            const row = id && navRowById(id);
            if (!id || !row || raDel.disabled) { return; }
            // Two-step, matching the native footer delete: the first activation
            // arms (renames to "Confirm delete", paints solid red, announces via
            // the status toast), the second performs it. Disarms after 4s, on
            // retarget, on Escape, or when the cluster hides.
            if (!raDelArmed) {
                raDelArmed = true;
                raDel.classList.add('dbe-row-actions__del--armed');
                raSetNames(id);
                undoToast(dbeT('rowActionDeleteArmed', 'Press again to confirm'));
                dbeClearOwnedTimeout(DBE_COMMANDS_OWNER, raDelArmT);
                raDelArmT = dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => {
                    raDelArmT = null;
                    raDisarmDelete();
                }, 4000);
                return;
            }
            raDisarmDelete();
            // Pick the landing row BEFORE the subtree disappears: next visible row
            // outside the doomed subtree, else the previous one, else the parent —
            // the WordPress list-view shape. (Deletion is captured by (u)'s
            // builderius.Module.deleted hook, so Ctrl/Cmd+Z restores it.)
            const rows = navVisibleRows();
            const i = rows.indexOf(row);
            const li = navRowLi(row);
            const next = rows.slice(i + 1).filter((b) => { return !li || !li.contains(b); })[0]
                || (i > 0 ? rows[i - 1] : null)
                || navParentRow(row);
            const nextId = next ? navRowId(next) : null;
            raDel.disabled = true;
            driveContextMenuItem(id, 'Remove', (ok) => {
                raDel.disabled = false;
                if (!ok) { return; }
                undoToast(dbeT('deletedElement', 'Deleted element'), 'undo');
                // Move focus off the cluster onto the landing row straight away
                // (its node usually still exists pre-re-render), so raHide has no
                // stranded focus to rescue, then re-assert once the tree settles.
                const landing = nextId && navRowById(nextId);
                if (landing) { try { landing.focus(); } catch (e2) {} }
                raHide();
                if (!nextId) { return; }
                waitFor(() => {
                    const r = navRowById(nextId);
                    return (r && r.offsetParent !== null) ? r : null;
                }, (r) => {
                    if (r) { raFocusRow(r); }
                });
            });
        }

        function ensureRowActions() {
            const container = document.querySelector('.uniRightPanel .uniModTree__container');
            if (!container) { return; }
            const box = raBuild();
            if (box.parentElement !== container) {
                // After the row scroller (the container's unclassed first child) and
                // before the favourites strip: Tab order runs rows → Duplicate →
                // Delete → favourites. position:fixed keeps it out of the layout.
                const scroller = container.firstElementChild;
                container.insertBefore(box, scroller ? scroller.nextElementSibling : null);
            }
            raSync();
            const panel = document.querySelector('.uniRightPanel');
            if (!panel) { return; }
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, panel, 'row-actions-pointerover', 'pointerover', raPointerOver);
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, panel, 'row-actions-pointerout', 'pointerout', raPointerOut);
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, panel, 'row-actions-focusin', 'focusin', raFocusIn);
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, panel, 'row-actions-focusout', 'focusout', raFocusOut);
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, panel, 'row-actions-scroll', 'scroll', raOnScroll, true);
            // A native drag means the row rects are about to churn — get out of the
            // way until it settles. Document-level: dragstart fires on the row <li>.
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'row-actions-dragstart', 'dragstart', () => {
                raSuppressed = true;
                raHide();
            });
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'row-actions-dragend', 'dragend', () => { raSuppressed = false; });
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'row-actions-drop', 'drop', () => { raSuppressed = false; });
            // A REAL context menu on a row supersedes the cluster; our own invisible
            // auto-driven menus (html.dbe-auto-ctx) must not knock it out mid-action.
            dbeBindOwnedHook(DBE_COMMANDS_OWNER, 'builderius.contextMenu.show', 'dbeRowActionsYield', () => {
                if (!document.documentElement.classList.contains('dbe-auto-ctx')) { raHide(); }
            });
        }

        function dbeRememberContextTarget(e) {
            dbeSelectorMenuTarget = e.target.closest && e.target.closest('.uniSelectorsCss__item');
            if (dbeSelectorMenuTarget) { return; }
            const btn = e.target.closest && e.target.closest('.uniModTree__item');
            if (!btn) { return; }
            if (!e.dbePreviewContext) { dbeDiscardPreviewContext(false); }
            const match = btn.className.toString().match(/uni-tree-node-(\w+)/);
            if (!match) { return; }
            setContextTarget(match[1]);
            if (dbeMultiSel.size && !dbeMultiSel.has(contextTarget()) &&
                !document.documentElement.classList.contains('dbe-auto-ctx')) {
                clearMultiSel();
            }
        }

        function dbeNavigatorContextMenuKeydown(e) {
            if (e.key !== 'ContextMenu' && !(e.key === 'F10' && e.shiftKey)) { return; }
            const row = e.target && e.target.closest && e.target.closest('.uniRightPanel .uniModTree__item');
            if (!row || document.querySelector('dialog.uniBuilderContextMenu[open]')) { return; }
            e.preventDefault();
            e.stopPropagation();
            const rect = row.getBoundingClientRect();
            row.dispatchEvent(new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: rect.left + Math.min(rect.width / 2, 48),
                clientY: rect.top + rect.height / 2
            }));
        }

        function dbeObserveCommands() {
            const needMain = on('command_palette') || on('keyboard_shortcuts') || on('navigator_keyboard') ||
                on('reveal_selected') || on('preview_context_menu') || on('context_menu') || NEED_NAV_BUTTONS || on('tree_search') ||
                on('navigator_row_actions') || on('shortcuts_overlay');
            dbeObserveChrome('commands-top', (on('command_palette') || on('save_split_button')) ? dbeQuery('topPanel') : null, {
                childList: true,
                subtree: true
            });
            dbeObserveChrome('commands-main', needMain ? dbeQuery('mainPanel') : null, {
                childList: true,
                subtree: true,
                characterData: on('tree_search'),
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        }

        function dbeRefreshCommands() {
            if (!dbeCommandsControllerActive) { return; }
            dbeObserveCommands();
            if (on('command_palette')) { ensurePaletteButton(); }
            if (on('save_split_button')) { ensureSaveMenuButton(); }
            if (on('shortcuts_overlay')) { ensureNativeShortcuts(); }
            if (on('command_palette') || on('keyboard_shortcuts') || on('navigator_keyboard') || on('reveal_selected') || on('preview_context_menu') || on('preview_rename')) {
                ensureKeyboardIframeBridge();
            }
            if (on('context_menu')) { decorateClassChips(); }
            if (NEED_NAV_BUTTONS) {
                ensureCollapseButton();
                ensureExpandAllButton();
            }
            if (on('tree_search')) {
                ensureTreeSearch();
                applyTreeFilter();
            }
            if (on('navigator_row_actions')) { ensureRowActions(); }
            if (on('reveal_selected')) {
                revealActiveInTree();
                dbeSyncSelectionContext();
            }
        }

        function destroyCommands() {
            dbeCommandsControllerActive = false;
            dbeObserveChrome('commands-top', null);
            dbeObserveChrome('commands-main', null);
            dbeDestroyOwnedHooks(DBE_COMMANDS_OWNER);
            dbeReleaseCommandFrameDocuments(null);
            dbeDiscardPreviewContext(false);
            dbeClearPreviewFocusState();
            if (dbePreviewRenameDialog) {
                dbePreviewRenameDialog.remove();
                dbePreviewRenameDialog = null;
            }
            if (raBox) { raHide(); }
            dbeDestroyOwnedActivity(DBE_COMMANDS_OWNER);
            dbeDestroyOwnedGroups(DBE_COMMANDS_OWNER);
            removeSubmenus();
            closeChipMenu();
            document.querySelectorAll('[data-dbe-auto-bem-default-label="1"]').forEach((label) => {
                label.hidden = false;
                label.removeAttribute('data-dbe-auto-bem-default-label');
            });
            document.querySelectorAll(
                '.dbe-palette-btn, dialog.dbe-palette, dialog.dbe-shortcuts, dialog.dbe-el-picker, ' +
                '.dbe-canvas-editing-indicator, .dbe-canvas-status, .dbe-save-menu-btn, ' +
                '.dbe-canvas-selection-context, .dbe-collapse-subtrees, .dbe-expand-all, ' +
                '.dbe-tree-search, .dbe-row-actions, .dbe-wrap-in-figure, .dbe-native-shortcuts-group'
            ).forEach((node) => { node.remove(); });
            document.querySelectorAll('.dbe-tree-filtered-out, .dbe-tree-dim').forEach((row) => {
                row.classList.remove('dbe-tree-filtered-out', 'dbe-tree-dim');
            });
            raUnstamp();
            dbeClearItemMenuAnchor();
            dbePasteCtxRow = null;
            dbeKeyboardFrame = null;
            dbePreviewPointerContext = null;
            dbeSaveMenuEl = null;
            treeSearchDebounce = null;
            treeQuery = '';
            raBox = null;
            raDup = null;
            raDel = null;
            raId = null;
            raHideT = null;
            raSuppressed = false;
            raScrollQueued = false;
            raDelArmed = false;
            raDelArmT = null;
            dbeLastRevealedId = null;
            dbeSelectionContextState = '';
        }

        dbeControllers.register(DBE_COMMANDS_OWNER, {
            init (context) {
                if (!context || !context.builderius) { return; }
                dbeCommandsControllerActive = true;
                if (NEED_CTX_MENU) {
                    dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'context-target', 'contextmenu', dbeRememberContextTarget, true);
                    dbeBindOwnedHook(DBE_COMMANDS_OWNER, 'builderius.contextMenu.show', 'dbeWrapMenu', onContextMenuShow);
                    dbeBindOwnedHook(DBE_COMMANDS_OWNER, 'builderius.contextMenu.hide', 'dbeWrapMenuHide', () => {
                        removeSubmenus();
                        // The dialog's close event restores preview focus after
                        // native top-layer focus handling finishes. Keep a short
                        // fallback for Builderius versions that remove the menu
                        // without dispatching close.
                        if (dbePreviewContextState) {
                            dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => {
                                if (dbePreviewContextState) { dbeDiscardPreviewContext(true); }
                            }, 200);
                        }
                    });
                    dbeBindOwnedHook(
                        DBE_COMMANDS_OWNER,
                        'builderius.miniModal.openAutoBem',
                        'dbeNativeAutoBemLabels',
                        dbeWatchNativeAutoBemDialog
                    );
                }
                if (NEED_CTX_MENU || on('navigator_paste') || on('navigator_keyboard')) {
                    dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'navigator-context-menu-key', 'keydown', dbeNavigatorContextMenuKeydown, true);
                }
                if (on('preview_context_menu')) {
                    dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'preview-context-close-key', 'keydown', dbePreviewContextCloseKeydown, true);
                }
                if (on('footer_toolbar') || on('context_menu')) {
                    dbeBindOwnedHook(DBE_COMMANDS_OWNER, 'builderius.contextMenu.show', 'dbeItemMenu', onItemMenuShow);
                    dbeBindOwnedHook(DBE_COMMANDS_OWNER, 'builderius.contextMenu.hide', 'dbeItemMenuHide', dbeClearItemMenuAnchor);
                }
                if (on('context_menu')) { bindChipMenu(); }
                if (on('navigator_paste')) {
                    bindPasteTarget();
                    bindTreeAreaMenu();
                    bindChipMenuDismiss();
                }
                if (on('shortcuts_overlay')) { bindShortcutsKey(); }
                if (on('keyboard_shortcuts')) {
                    dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'element-shortcuts', 'keydown', dbeElementShortcutsKeydown, true);
                }
                if (on('command_palette')) {
                    dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'palette-key', 'keydown', dbePaletteKeydown, true);
                }
                if (on('save_split_button')) { bindSaveMenuKeys(); }
                if (on('reveal_selected')) { bindRevealActive(); }
                dbeRefreshCommands();
            },
            refresh (reason) {
                if (reason) { dbeRefreshCommands(); }
            },
            destroy () {
                destroyCommands();
            }
        }, NEED_CTX_MENU || on('footer_toolbar') || on('preview_context_menu') || on('preview_rename') || on('context_menu') || on('navigator_paste') ||
            on('shortcuts_overlay') || on('keyboard_shortcuts') || on('command_palette') ||
            on('navigator_keyboard') || on('reveal_selected') || on('save_split_button') ||
            NEED_NAV_BUTTONS || on('tree_search') || on('navigator_row_actions'));
        host.setCommandsApi(Object.freeze({
            driveContextMenuItem,
            makeContextItem: makeCtxItem,
            canvasInteractive: dbeCanvasInteractive,
            setCanvasInteractive: dbeSetCanvasInteractive,
            syncSelectionContext: dbeSyncSelectionContext,
            scrollNavigatorRow: scrollRowIntoTree,
            expandNavigatorSubtree: expandSubtree,
            closeSelectedClass: driveSelectedClose
        }));
    };

    window.dbeBuilderChunks = chunks;
})();
