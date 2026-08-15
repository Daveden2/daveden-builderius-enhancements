(function () {
    'use strict';

    /* Command and Navigator interaction controllers register after builder.js
       supplies the shared lifecycle, Builderius adapter and editing services. */
    var chunks = window.dbeBuilderChunks || {};

    chunks.commands = function (host) {
        var on = host.on;
        var dbeT = host.translate;
        var dbeFmt = host.format;
        var dbeTn = host.plural;
        var CFG = host.config;
        var dbeQuery = host.query;
        var modules = host.builderius.modules;
        var activeId = host.builderius.activeId;
        var store = host.builderius.store;
        var clickSeq = host.click;
        var waitFor = host.waitFor;
        var schedule = host.schedule;
        var setTip = host.tooltip;
        var dbeAccel = host.accelerator;
        var dbeControllers = host.controllers;
        var dbeObserveChrome = host.observe;
        var dbeRememberOwnedAttributes = host.rememberOwnedAttributes;
        var dbeBindOwnedEvent = host.bindOwnedEvent;
        var dbeBindOwnedHook = host.bindOwnedHook;
        var dbeDestroyOwnedHooks = host.destroyOwnedHooks;
        var dbeSetOwnedTimeout = host.setOwnedTimeout;
        var dbeClearOwnedTimeout = host.clearOwnedTimeout;
        var dbeSetOwnedFrame = host.setOwnedFrame;
        var dbeUnbindOwnedEvent = host.unbindOwnedEvent;
        var dbeDestroyOwnedActivity = host.destroyOwnedActivity;
        var dbeDestroyOwnedGroups = host.destroyOwnedGroups;
        var undoToast = host.feedback.undo;
        var dbeMultiSel = host.multiSelection.state;
        var dbeIsMac = host.multiSelection.isMac;
        var clearMultiSel = host.multiSelection.clear;
        var renameActive = host.multiSelection.renameActive;
        var multiCtxIds = host.multiSelection.contextIds;
        var removeMulti = host.multiSelection.remove;
        var dbeSetDisabledReason = host.multiSelection.setDisabledReason;
        var disableCtxItem = host.multiSelection.disableContextItem;
        var contextTarget = host.context.getTarget;
        var setContextTarget = host.context.setTarget;
        var NAV_ROW_SEL = host.navigator.rowSelector;
        var navRootList = host.navigator.rootList;
        var navRowId = host.navigator.rowId;
        var navRowById = host.navigator.rowById;
        var navRowLi = host.navigator.rowListItem;
        var navRowExpandable = host.navigator.rowExpandable;
        var navRowExpanded = host.navigator.rowExpanded;
        var navParentRow = host.navigator.parentRow;
        var navVisibleRows = host.navigator.visibleRows;
        var navFocus = host.navigator.focus;
        var navToggleExpand = host.navigator.toggleExpand;
        var moveSibling = host.navigator.moveSibling;
        var indentElement = host.navigator.indent;
        var outdentElement = host.navigator.outdent;
        var selectParentOf = host.navigator.selectParent;
        var startRename = host.editing.startRename;
        var defaultLabelFor = host.editing.defaultLabel;
        var commitRename = host.editing.commitRename;
        var wrap = host.editing.wrap;
        var unwrap = host.editing.unwrap;
        var bemClassable = host.editing.bemClassable;
        var openAutoBemDialog = host.editing.openAutoBem;
        var dbeIndentTarget = host.editing.indentTarget;
        var dbeCanOutdent = host.editing.canOutdent;
        var dbeHtmlEditable = host.editing.htmlEditable;
        var openEditHtmlDialog = host.editing.openEditHtml;
        var openImportHtmlDialog = host.editing.openImportHtml;
        var DBE_HTML_MODULES = host.editing.htmlModules;
        var DBE_TAG_CHOICES = host.editing.tagChoices;
        var dbeChangeTagEligible = host.editing.changeTagEligible;
        var dbeChangeTag = host.editing.changeTag;
        var dbeCleanTagInput = host.editing.cleanTagInput;
        var dbeInsertSection = host.editing.insertSection;
        var dbeInsertSibling = host.editing.insertSibling;
        var dbeElementModule = host.editing.elementModule;
        var dbeDecodeEntities = host.editing.decodeEntities;
        var dbeAttrBlocked = host.editing.attributeBlocked;
        var dbeUpdateModuleSettings = host.editing.updateModuleSettings;
        var dbeAddClasses = host.editing.addClasses;
        var dbeEmmetParse = host.editing.emmetParse;
        var dbeEmmetStructureError = host.editing.emmetStructureError;
        var dbeEmmetInsert = host.editing.emmetInsert;
        var dbeMoveLocation = host.editing.moveLocation;
        var dbeStyleActionItems = host.styles.actionItems;
        var openStyleInspector = host.styles.openInspector;
        var dbeOpenStyleEditor = host.styles.openEditor;
        var moduleClasses = host.styles.moduleClasses;
        var entityScopeLabel = host.styles.entityScopeLabel;
        var dbeFocusArea = host.workspace.focusArea;
        var dbeCompactActive = host.workspace.compactActive;
        var dbeToggleSidePanels = host.workspace.toggleSidePanels;
        var dbeSetPanelVisibility = host.workspace.setPanelVisibility;
        var dbePanelWrappers = host.workspace.panelWrappers;
        var dbePanelSideHidden = host.workspace.panelSideHidden;
        var NEED_NAV_BUTTONS = host.needNavigatorButtons;
        var NEED_CTX_MENU = host.needContextMenu;

        /* A menu row's label with shortcut hints left out. DBE adds
           .dbe-ctx-accel on older Builderius versions; 1.3.6 adds its own
           .uniContextMenu__shortcut spans. Neither is part of the command name.
           When a menu item drives the menu it was activated from (Cut = Copy
           then Remove), React can also reuse the just-closed enriched dialog,
           so exact-label matching must ignore both forms. */
        function nativeCtxLabel(li) {
            var t = '';
            for (var n = li.firstChild; n; n = n.nextSibling) {
                if (n.nodeType === 1 && n.classList &&
                    (n.classList.contains('dbe-ctx-accel') || n.classList.contains('uniContextMenu__shortcut'))) { continue; }
                t += n.textContent || '';
            }
            return t.trim();
        }

        /* Open a row's native context menu invisibly and activate one item. */
        function driveContextMenuItem(rowId, itemText, cb) {
            var row = document.querySelector('.uniRightPanel .uni-tree-node-' + rowId);
            if (!row) { cb(false); return; }
            document.documentElement.classList.add('dbe-auto-ctx');
            // A menu may still be open — Cut drives the menu it was activated from.
            // Close it and wait until it has really gone before opening ours: the
            // poll below would otherwise find the old ENRICHED dialog, and React
            // recycles its rows on re-render, so the node found as "Copy" can be a
            // different item by the time the click lands (observed as a stray
            // Paste during Cut).
            try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
            waitFor(function () {
                return document.querySelector('dialog.uniBuilderContextMenu[open]') ? null : true;
            }, function (closed) {
                if (!closed) {
                    document.documentElement.classList.remove('dbe-auto-ctx');
                    cb(false);
                    return;
                }
                row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
                waitFor(function () {
                    var d = document.querySelector('dialog.uniBuilderContextMenu[open]');
                    if (!d) { return null; }
                    return [].slice.call(d.querySelectorAll('li.uniContextMenu__item')).find(function (li) {
                        return !li.classList.contains('dbe-ctx-item') && nativeCtxLabel(li) === itemText;
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
        var dbePasteCtxRow = null; // tree-row id the current menu was opened on, or null

        /* The native Paste item of the open tree menu, when our re-target should
           take over; null when native paste already does the right thing. */
        function dbePasteNativeItem(e) {
            var li = e.target && e.target.closest && e.target.closest('dialog.uniBuilderContextMenu[open] li.uniContextMenu__item');
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
            var beforeIds = Object.keys(modules() || {});
            return function () {
                waitFor(function () {
                    var mods = modules() || {};
                    return Object.keys(mods).find(function (id) {
                        return beforeIds.indexOf(id) === -1 && (mods[id].parent || '') === parentId;
                    }) || null;
                }, function (newId) {
                    if (!newId) { undoToast(dbeT('pasteNothing', 'Nothing to paste: copy an element first')); }
                });
            };
        }

        function dbePasteInto(targetId) {
            var attempts = 0;
            (function sel() {
                var row = document.querySelector('.uniRightPanel .uni-tree-node-' + targetId);
                if (row) { clickSeq(row); }
                waitFor(function () { return activeId() === targetId || null; }, function (ok) {
                    if (!ok) {
                        if (++attempts < 4) { sel(); }
                        else { undoToast(dbeT('pasteSelectFailed', 'Paste failed: could not select the element')); }
                        return;
                    }
                    var settled = dbeWatchPasteResult(targetId);
                    driveContextMenuItem(targetId, 'Paste', function (done) {
                        if (!done) { undoToast(dbeT('pasteMenuFailed', 'Paste failed: could not reach Paste')); return; }
                        settled();
                    });
                }, 20);
            })();
        }

        function dbePasteAtRoot() {
            // Any row's menu will do — with no active module, native Paste falls
            // back to root (the same channel the root-level undo restore uses).
            var anyRow = document.querySelector('.uniRightPanel .uniModTree__item');
            var m = anyRow && anyRow.className.toString().match(/uni-tree-node-(\w+)/);
            if (!m) { undoToast(dbeT('pasteNoRows', 'Paste at top level needs at least one element in the tree')); return; }
            try { store().storeSet('activeModule', ''); } catch (e) {}
            var settled = dbeWatchPasteResult('');
            driveContextMenuItem(m[1], 'Paste', function (done) {
                if (!done) { undoToast(dbeT('pasteMenuFailed', 'Paste failed: could not reach Paste')); return; }
                settled();
            });
        }

        function bindPasteTarget() {
            // Which row (if any) the menu-opening right-click landed on. Cleared
            // when the menu hides, so a menu that arrives by another route (e.g.
            // a stale id from an earlier right-click) can never misdirect a paste.
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'paste-target-context', 'contextmenu', function (e) {
                if (document.documentElement.classList.contains('dbe-auto-ctx')) { return; }
                var btn = e.target && e.target.closest && e.target.closest('.uniModTree__item');
                var m = btn && btn.className.toString().match(/uni-tree-node-(\w+)/);
                dbePasteCtxRow = m ? m[1] : null;
            }, true);
            dbeBindOwnedHook(DBE_COMMANDS_OWNER, 'builderius.contextMenu.hide', 'dbePasteCtx', function () { dbePasteCtxRow = null; });
            // Swallow the whole activation sequence: the native item may act on
            // any of these, and the menu keyboard model activates through the
            // same synthetic chain (clickSeq); the flow itself runs on click.
            ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(function (t) {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'paste-target-' + t, t, function (e) {
                    if (dbePasteNativeItem(e)) { e.preventDefault(); e.stopPropagation(); }
                }, true);
            });
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'paste-target-click', 'click', function (e) {
                if (!dbePasteNativeItem(e)) { return; }
                e.preventDefault();
                e.stopPropagation();
                var target = dbePasteCtxRow; // read before the hide hook clears it
                try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (err) {}
                dbePasteInto(target);
            }, true);
        }

        function bindTreeAreaMenu() {
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'tree-area-menu', 'contextmenu', function (e) {
                if (document.documentElement.classList.contains('dbe-auto-ctx')) { return; }
                var t = e.target;
                if (!t || !t.closest) { return; }
                // Only the tree's empty container area — rows keep the native menu,
                // and header buttons / the tree-search input keep their own roles.
                if (!t.closest('.uniRightPanel .uniModTree__container')) { return; }
                if (t.closest('.uniModTree__item, button, input, a')) { return; }
                e.preventDefault();
                e.stopPropagation();
                var focusReturn = document.querySelector('.uniRightPanel .uniModTree__item[tabindex="0"]');
                renderChipCard(focusReturn, e.clientX, e.clientY, [
                    { label: dbeT('pasteAtTop', 'Paste at top level'), fn: dbePasteAtRoot }
                ], dbeT('navigatorAreaMenu', 'Navigator actions'));
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

        /* Close the native context menu and any DBE submenus — the pair every
           injected item's activation ends with. One copy, so a fix to the close
           recipe can never miss a site again. */
        function closeCtxMenu() {
            removeSubmenus();
            try { window.Builderius.API.hooks.doAction('builderius.contextMenu.hide'); } catch (e) {}
        }

        function positionFlyout(fly, parentLi) {
            var pr = parentLi.getBoundingClientRect();
            var fw = fly.offsetWidth || 176;
            var maxHeight = window.innerHeight - 16;
            if (fly.offsetHeight > maxHeight) {
                fly.style.setProperty('max-height', maxHeight + 'px', 'important');
                fly.style.setProperty('overflow-y', 'auto', 'important');
            }
            var fh = Math.min(fly.offsetHeight || 120, maxHeight);
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

        function makeFlyout(items, labelText) {
            // Rebuild the native menu wrapper chain so the flyout inherits the card
            // styling and the .uniContextMenu list/item resets.
            var fly = document.createElement('div');
            fly.className = 'uniBuilderContextMenu dbe-ctx-submenu';
            var inner = document.createElement('div');
            inner.className = 'uniBuilderContextMenu__inner';
            var menu = document.createElement('div');
            menu.className = 'uniContextMenu';
            menu.setAttribute('role', 'menu');
            menu.setAttribute('aria-label', labelText);
            var ul = document.createElement('ul');
            items.forEach(function (li) {
                li.tabIndex = -1; // roving tabindex — the keydown handler moves focus
                ul.appendChild(li);
            });
            menu.appendChild(ul);
            inner.appendChild(menu);
            fly.appendChild(inner);
            fly.addEventListener('mouseenter', function () { clearTimeout(submenuCloseTimer); });
            fly.addEventListener('mouseleave', function () { submenuCloseTimer = dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, removeSubmenus, 180); });
            return fly;
        }

        var lastFlyoutParent = null;

        function dbeSvgIcon(name, className) {
            var ns = 'http://www.w3.org/2000/svg';
            var svg = document.createElementNS(ns, 'svg');
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
                var el = document.createElementNS(ns, tag);
                Object.keys(attrs).forEach(function (key) { el.setAttribute(key, attrs[key]); });
                svg.appendChild(el);
            }
            var icons = {
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
            (icons[name] || []).forEach(function (part) { shape(part[0], part[1]); });
            return svg;
        }

        function makeParent(labelText, first, itemsFactory, disabled, disabledReason) {
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
                dbeSetDisabledReason(li, labelText, disabledReason);
                return li; // no flyout wiring: not hoverable, not keyboard-openable
            }
            function openFlyout() {
                clearTimeout(submenuCloseTimer);
                removeSubmenus();
                var fly = makeFlyout(itemsFactory(), labelText);
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
                submenuCloseTimer = dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, removeSubmenus, 180);
            });
            return li;
        }

        /* A plain injected leaf item. Mirrors the inline Rename / Auto-BEM pattern:
           mousedown closes the menu, then runs the action. A disabled item renders
           greyed and non-interactive, but remains in the roving keyboard sequence
           so users can discover it and hear why it is unavailable. */
        function makeCtxItem(labelText, onActivate, opts) {
            opts = opts || {};
            var li = document.createElement('li');
            li.className = 'uniContextMenu__item dbe-ctx-item';
            li.setAttribute('role', 'menuitem');
            if (opts.icon) {
                var label = document.createElement('span');
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
                var acc = document.createElement('span');
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
            li.addEventListener('mousedown', function (ev) {
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
                closeCtxMenu();
            });
            return li;
        }

        /* Expand the right-clicked row's whole subtree. Same chevron click channel
           as expandAll, scoped to the row's li; runs in short passes because deep
           rows that were never expanded may only mount after their parent opens. */
        /* Repeatedly click every collapsed chevron under `rootEl` until none
           remain — each pass triggers async re-renders that can mount previously
           hidden collapsed rows, hence the multi-pass loop. Bounded at 10 passes.
           Shared by "Expand children" and the Navigator's expand-all button. */
        function dbeExpandPass(rootEl) {
            var passes = 0;
            (function pass() {
                var chevs = [];
                rootEl.querySelectorAll('button.uniModTree__item:not(.expanded)').forEach(function (btn) {
                    var chev = btn.querySelector('i');
                    if (chev) { chevs.push(chev); }
                });
                if (!chevs.length || passes >= 10) { return; }
                passes += 1;
                chevs.forEach(function (chev) { clickSeq(chev); });
                setTimeout(pass, 120);
            })();
        }

        function expandSubtree(id) {
            var rowBtn = id && document.querySelector('.uniRightPanel .uni-tree-node-' + id);
            var root = rowBtn && rowBtn.closest('li.uniModTree__itemDrag');
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
            var fly = li && li.closest('.dbe-ctx-submenu');
            var root = fly || dialog;
            return [].slice.call(root.querySelectorAll('li.uniContextMenu__item')).filter(function (item) {
                if (item.classList.contains('dbe-ctx-heading') || item.classList.contains('dbe-ctx-note')) { return false; }
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
                    if (li && li.getAttribute('aria-disabled') === 'true') {
                        break;
                    } else if (li && !inFly && typeof li._dbeOpenFlyout === 'function') {
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
                    if (li && li.getAttribute('aria-disabled') === 'true') {
                        break;
                    } else if (li && typeof li._dbeOpenFlyout === 'function') {
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
                if (li.classList.contains('disabled') && li.getAttribute('aria-disabled') !== 'true') {
                    li.setAttribute('aria-disabled', 'true');
                }
            });
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, dialog, 'context-menu-keys', 'keydown', onMenuKeydown, true);
            // Focus the first action so a Shift+F10 / Menu-key open is usable;
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
                    return regex.test(nativeCtxLabel(li)) && !li.classList.contains('dbe-ctx-item');
                });
            items.forEach(function (li) { li.parentNode && li.parentNode.removeChild(li); });
            return items;
        }

        function nativeContextItem(container, regex) {
            return [].slice.call(container.querySelectorAll('.uniContextMenu__item'))
                .find(function (li) {
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
            dbeSetOwnedFrame(DBE_COMMANDS_OWNER, function () {
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
                        if (/^(Duplicate|Copy|Paste|Cut|Rename|Auto-BEM|Wrap in|Remove|Create Component)$/.test(nativeCtxLabel(li))) {
                            disableCtxItem(li, dbeT('singleElementOnly', 'Available when one element is selected'));
                        }
                    });
                }

                // Preview opens reuse this exact Navigator menu. Give that
                // pointer-distant surface a visible target heading containing
                // both the Navigator label and rendered tag, while the normal
                // row menu keeps Builderius' native “Actions” heading.
                var previewHeading = dbePreviewContextState && dbePreviewContextState.id === contextTarget()
                    ? dbePreviewContextHeading()
                    : '';
                if (previewHeading) {
                    var targetHeading = [].slice.call(container.querySelectorAll('.uniContextMenu__item.disabled')).filter(function (li) {
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
                        dbeBindOwnedEvent(DBE_COMMANDS_OWNER, ctxDialog, 'preview-context-close', 'close', function () {
                            dbeDiscardPreviewContext(true);
                        }, { once: true });
                    }
                }

                // Name both the enhanced flat menu and the untouched native
                // fallback. This runs before the grouped/ungrouped branch so
                // the preview feature remains independent of context_menu.
                var menuEl = container.closest('[role="menu"]') || (ctxDialog && ctxDialog.querySelector('[role="menu"]'));
                if (menuEl) {
                    var ctxModsForLabel = modules() || {};
                    var ctxModForLabel = contextTarget() && ctxModsForLabel[contextTarget()];
                    var ctxTargetLabel = previewHeading || (ctxModForLabel && (ctxModForLabel.label || defaultLabelFor(contextTarget())));
                    menuEl.setAttribute('aria-label', multiIds
                        ? dbeFmt(dbeT('selectedElementsActions', 'Actions for %s selected elements'), multiIds.length)
                        : dbeFmt(dbeT('elementActionsFor', 'Actions for %s'), ctxTargetLabel || dbeT('element', 'element')));
                }

                /* --- Build the injected items (appended flat or grouped below) --- */

                // Navigator menus retain inline rename; preview menus use the
                // explicit Navigator-name dialog when the 2.1 candidate is on.
                var nameItems = [];
                var advancedItems = [];
                var previewRenamePath = !!previewHeading && on('preview_rename');
                var previewRenameTarget = previewRenamePath && dbePreviewContextState
                    ? dbePreviewContextState.element : null;
                if (!multiIds && (on('inline_rename') || previewRenamePath)) {
                    var renameLi = document.createElement('li');
                    renameLi.className = 'uniContextMenu__item dbe-ctx-item';
                    renameLi.setAttribute('role', 'menuitem');
                    renameLi.textContent = dbeT('rename', 'Rename');
                    if (on('keyboard_shortcuts') || previewRenamePath) {
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
                        var id = contextTarget() || activeId();
                        var renderedTarget = previewRenameTarget;
                        if (renderedTarget) { dbeDiscardPreviewContext(false); }
                        closeCtxMenu();
                        if (renderedTarget) {
                            dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, function () {
                                dbeOpenPreviewRename(id, renderedTarget);
                            }, 0);
                        } else {
                            startRename(id);
                        }
                    });
                    nameItems.push(renameLi);

                    // "Reset label" — back to the builder default (the HTML tag).
                    // Only offered when the label actually differs from it.
                    var ctxMods = modules();
                    var ctxDefault = defaultLabelFor(contextTarget());
                    if (ctxDefault && ctxMods && ctxMods[contextTarget()] &&
                        (ctxMods[contextTarget()].label || '') !== ctxDefault) {
                        var resetLi = document.createElement('li');
                        resetLi.className = 'uniContextMenu__item dbe-ctx-item';
                        resetLi.setAttribute('role', 'menuitem');
                        resetLi.textContent = dbeT('resetLabel', 'Reset label');
                        resetLi.addEventListener('mousedown', function (ev) {
                            ev.preventDefault();
                            ev.stopPropagation();
                            var id = contextTarget();
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
                    var bemMods = modules();
                    var bemMod = bemMods && contextTarget() && bemMods[contextTarget()];
                    if (bemClassable(bemMod)) {
                        var bemLi = document.createElement('li');
                        bemLi.className = 'uniContextMenu__item dbe-ctx-item';
                        bemLi.setAttribute('role', 'menuitem');
                        bemLi.textContent = dbeT('autoBem', 'Auto-BEM');
                        bemLi.addEventListener('mousedown', function (ev) {
                            ev.preventDefault();
                            ev.stopPropagation();
                            var id = contextTarget();
                            closeCtxMenu();
                            // Let the menu dialog finish closing (it is showModal —
                            // while open our own dialog could not take focus).
                            setTimeout(function () { openAutoBemDialog(id); }, 120);
                        });
                        advancedItems.push(bemLi);
                    }
                }

                // "Expand children" -> open the whole subtree under this row (only
                // offered when the row is expandable, i.e. has a chevron). From
                // Builderius 1.3.6 the native menu owns this action; keep DBE's
                // implementation only as the older-version fallback.
                var expandLi = null;
                var ctxRowBtn = contextTarget() && document.querySelector('.uniRightPanel .uni-tree-node-' + contextTarget());
                var nativeExpandAvailable = !!nativeContextItem(container, /^Expand children$/);
                if (!multiIds && !nativeExpandAvailable && on('collapse_expand_all') && ctxRowBtn && ctxRowBtn.querySelector('i')) {
                    expandLi = document.createElement('li');
                    expandLi.className = 'uniContextMenu__item dbe-ctx-item';
                    expandLi.setAttribute('role', 'menuitem');
                    expandLi.textContent = dbeT('expandChildren', 'Expand children');
                    expandLi.addEventListener('mousedown', function (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        var id = contextTarget();
                        closeCtxMenu();
                        expandSubtree(id);
                    });
                }

                // "Wrap in" -> div / template / collection. For a multi-selection it
                // wraps all selected elements — possible only when they're siblings.
                var wrapEnabled = on('wrap_in');
                var nativeWrapAvailable = !!nativeContextItem(container, /^Wrap in$/);
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
                    removeNLi.textContent = dbeFmt(dbeT('deleteNElements', 'Delete %s elements'), multiIds.length);
                    removeNLi.addEventListener('mousedown', function (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        var ids = multiIds.slice();
                        closeCtxMenu();
                        clearMultiSel(); // the auto-driven per-row menus must be single-target
                        removeMulti(ids);
                    });
                }

                // "Unwrap" (rides on wrap_in) — promote the target's children up a
                // level and drop the empty wrapper. Single-target, needs children.
                var unwrapLi = null;
                if (!multiIds && wrapEnabled && contextTarget()) {
                    var uwIdx = store().storeGet('indexes') || {};
                    var uwKids = [].concat(uwIdx[contextTarget()] || []);
                    var uwMods = modules() || {};
                    var uwHasParent = !!(uwMods[contextTarget()] && (uwMods[contextTarget()].parent || ''));
                    if (uwKids.length && uwHasParent) {
                        (function () {
                            var uid = contextTarget();
                            unwrapLi = makeCtxItem(dbeT('unwrap', 'Unwrap'), function () { unwrap(uid); });
                        })();
                    }
                }

                // Structural moves and parent navigation (element_moves) — single-target.
                var moveUpLi = null, moveDownLi = null, moveInLi = null, moveOutLi = null, selectParentLi = null;
                if (!multiIds && on('element_moves') && contextTarget()) {
                    var emId = contextTarget();
                    var emMods = modules() || {};
                    var emMod = emMods[emId];
                    if (emMod) {
                        var emParent = emMod.parent || '';
                        var emIdx = store().storeGet('indexes') || {};
                        var emSibs = [].concat(emIdx[emParent || 'root'] || []);
                        var emAt = emSibs.indexOf(emId);
                        moveUpLi = makeCtxItem(dbeT('moveUp', 'Move up'), function () { moveSibling(emId, -1); }, {
                            disabled: emAt <= 0, accel: dbeAccel('↑', { alt: true }), icon: 'arrow-up',
                            tip: dbeT('cannotMoveUp', 'Already first among its siblings')
                        });
                        moveDownLi = makeCtxItem(dbeT('moveDown', 'Move down'), function () { moveSibling(emId, 1); }, {
                            disabled: emAt < 0 || emAt >= emSibs.length - 1, accel: dbeAccel('↓', { alt: true }), icon: 'arrow-down',
                            tip: dbeT('cannotMoveDown', 'Already last among its siblings')
                        });
                        moveInLi = makeCtxItem(dbeT('moveIn', 'Move in one level'), function () { indentElement(emId); }, {
                            disabled: !dbeIndentTarget(emId), accel: dbeAccel('→', { alt: true }), icon: 'indent-increase',
                            tip: dbeT('cannotMoveIn', 'Needs a previous sibling that can contain elements')
                        });
                        moveOutLi = makeCtxItem(dbeT('moveOut', 'Move out one level'), function () { outdentElement(emId); }, {
                            disabled: !dbeCanOutdent(emId), accel: dbeAccel('←', { alt: true }), icon: 'indent-decrease',
                            tip: dbeT('cannotMoveOut', 'Already at the outermost available level')
                        });
                        if (emParent) { selectParentLi = makeCtxItem(dbeT('selectParent', 'Select parent'), function () { selectParentOf(emId); }, { icon: 'parent' }); }
                    }
                }

                // Cut + Add before / Add after (keyboard_shortcuts). Cut mirrors the
                // Cmd/Ctrl+X shortcut (native Copy then Remove) on older Builderius;
                // 1.3.6 owns Cut. Add-before/after open the quick element picker
                // (deferred a tick so the menu closes first).
                var cutLi = null, addBeforeLi = null, addAfterLi = null;
                if (!multiIds && on('keyboard_shortcuts') && contextTarget()) {
                    var ksId = contextTarget();
                    if (!nativeContextItem(container, /^Cut$/)) {
                        cutLi = makeCtxItem(dbeT('cut', 'Cut'), function () {
                            driveContextMenuItem(ksId, 'Copy', function (ok) {
                                if (ok) { driveContextMenuItem(ksId, 'Remove', function () { undoToast(dbeT('cutDone', 'Cut element'), 'undo'); }); }
                            });
                        }, { accel: dbeAccel('X', { cmd: true }) });
                    }
                    addBeforeLi = makeCtxItem(dbeT('addBefore', 'Add element before'), function () { setTimeout(function () { openElementPicker(ksId, -1); }, 60); }, { accel: dbeAccel('T', { cmd: true, alt: true }) });
                    addAfterLi = makeCtxItem(dbeT('addAfter', 'Add element after'), function () { setTimeout(function () { openElementPicker(ksId, 1); }, 60); }, { accel: dbeAccel('Y', { cmd: true, alt: true }) });
                }

                // Native Wrap in covers Div, Template and Collection in 1.3.6.
                // Figure and Unwrap remain DBE additions; older Builderius keeps
                // DBE's complete wrapping flyout.
                var wrapFigureLi = null;
                if (!multiIds && wrapEnabled && nativeWrapAvailable) {
                    var figureId = contextTarget();
                    wrapFigureLi = makeCtxItem(dbeFmt(dbeT('wrapItemLabel', '%1$s %2$s'), dbeT('wrapIn', 'Wrap in'), dbeT('figureLabel', 'Figure')), function () {
                        wrap('figure', [figureId]);
                    });
                }

                // "Edit as HTML" (edit_as_html, Pro) — plain-element subtrees only;
                // otherwise offered disabled with the reason as its tooltip.
                var editHtmlLi = null;
                if (!multiIds && on('edit_as_html') && contextTarget()) {
                    (function () {
                        var ehId = contextTarget();
                        var ehMods = modules() || {};
                        if (!ehMods[ehId]) { return; }
                        var eligible = dbeHtmlEditable(ehId);
                        editHtmlLi = makeCtxItem(dbeT('editAsHtml', 'Edit as HTML'), function () {
                            // Let the menu dialog finish closing (showModal — while
                            // open our own dialog could not take focus).
                            setTimeout(function () { openEditHtmlDialog(ehId); }, 120);
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
                var importHtmlLi = null;
                if (!multiIds && on('import_html') && contextTarget()) {
                    (function () {
                        var ihId = contextTarget();
                        var ihMods = modules() || {};
                        var ihMod = ihMods[ihId];
                        if (!ihMod) { return; }
                        // SvgCode is expressible but a leaf — nothing imports INTO it.
                        var ok = !!DBE_HTML_MODULES[ihMod.name] && ihMod.name !== 'SvgCode';
                        importHtmlLi = makeCtxItem(dbeT('importHtmlEllipsis', 'Import HTML…'), function () {
                            setTimeout(function () { openImportHtmlDialog(ihId); }, 120);
                        }, ok ? {} : {
                            disabled: true,
                            tip: dbeT('importHtmlOnlyElements', 'HTML can only be imported into a plain element')
                        });
                        advancedItems.push(importHtmlLi);
                    })();
                }

                // "Change tag…" flyout (tag_change, Pro) — non-void taggable
                // modules (plain elements and Collections; a Template has no tag).
                var changeTagParent = null;
                if (!multiIds && on('tag_change') && contextTarget()) {
                    (function () {
                        var ctId = contextTarget();
                        var curTag = dbeChangeTagEligible(ctId);
                        if (curTag) {
                            changeTagParent = makeParent(dbeT('changeTag', 'Change tag…'), false, function () {
                                return DBE_TAG_CHOICES.map(function (tg) {
                                    return makeCtxItem('<' + tg + '>', function () { dbeChangeTag(ctId, tg); },
                                        tg === curTag ? { disabled: true, tip: dbeT('currentTag', 'Current tag') } : {});
                                });
                            });
                        }
                    })();
                }

                // Style inspector: one flyout keeps the primary menu compact while
                // exposing inspect, %local%, and both scopes for every applied class.
                var stylesParent = null;
                if (!multiIds && on('style_inspector') && contextTarget()) {
                    (function () {
                        var siId = contextTarget();
                        var siMod = (modules() || {})[siId];
                        if (!siMod || !bemClassable(siMod)) { return; }
                        stylesParent = makeParent(dbeT('stylesMenu', 'Styles…'), false, function () {
                            return dbeStyleActionItems(siId);
                        });
                    })();
                }

                /* --- Flat layout (context_menu off): append injected items after the
                   native ones, so each feature still works with grouping turned off. */
                if (!grouped) {
                    var injected = nameItems.concat(advancedItems,
                        [stylesParent, cutLi, addBeforeLi, addAfterLi, wrapFigureLi, unwrapLi, moveUpLi, moveDownLi, moveInLi, moveOutLi, selectParentLi, expandLi].filter(Boolean)
                    );
                    if (injected.length) {
                        injected[0].classList.add('dbe-ctx-item--first');
                        injected.forEach(function (li) { container.appendChild(li); });
                    }
                    if (removeNLi) { container.appendChild(removeNLi); }
                    if (wrapEnabled && (!nativeWrapAvailable || multiIds)) {
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
                var natDuplicate = collectNativeItems(container, /^Duplicate$/);
                var natClip = collectNativeItems(container, /^(Copy|Paste|Cut)$/);
                var natName = collectNativeItems(container, /^Rename$/);
                var natBem = collectNativeItems(container, /^Auto-BEM$/);
                var natWrap = collectNativeItems(container, /^Wrap in$/);
                var natExpand = collectNativeItems(container, /^Expand children$/);
                var natCreate = collectNativeItems(container, /^Create Component$/);
                var natSave = collectNativeItems(container, /^Save\b/);
                var natRemove = collectNativeItems(container, /^Remove$/);
                // Native separators describe the stock ordering. DBE's regrouped
                // menu draws its own cluster separators, so keeping both creates
                // empty and doubled rules after the native rows are re-parented.
                [].slice.call(container.querySelectorAll('.uniContextMenu__divider')).forEach(function (li) { li.remove(); });

                // Structure cluster: Wrap in… flyout (the wrap targets are hoisted
                // flat inside it — flyouts can't nest) + Unwrap.
                var wrapLabel = multiIds ? dbeFmt(dbeT('wrapNIn', 'Wrap %s in'), multiIds.length) : dbeT('wrapIn', 'Wrap in');
                var wrapParent = null;
                if (wrapEnabled && (!nativeWrapAvailable || multiIds)) {
                    wrapParent = makeParent(multiIds ? dbeFmt(dbeT('wrapNInEllipsis', 'Wrap %s in…'), multiIds.length) : dbeT('wrapInEllipsis', 'Wrap in…'), false, function () {
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
                var saveItem = null;
                if (natSave.length > 1) {
                    saveItem = makeParent(dbeT('saveTo', 'Save to…'), false, function () { return natSave; }, !!multiIds,
                        dbeT('singleElementOnly', 'Available when one element is selected'));
                } else if (natSave.length === 1) {
                    saveItem = natSave[0];
                    if (multiIds) { disableCtxItem(saveItem, dbeT('singleElementOnly', 'Available when one element is selected')); }
                }

                // Keep the primary menu short enough to scan. These actions remain
                // one arrow-key step away inside focused flyouts, and are still
                // individually searchable from the command palette where offered.
                var insertItems = [addBeforeLi, addAfterLi].filter(Boolean);
                var insertParent = insertItems.length
                    ? makeParent(dbeT('insertActions', 'Insert…'), false, function () { return insertItems; })
                    : null;
                var moveNavigateItems = [moveUpLi, moveDownLi, moveInLi, moveOutLi, selectParentLi]
                    .concat(natExpand, expandLi ? [expandLi] : []).filter(Boolean);
                var moveNavigateParent = moveNavigateItems.length
                    ? makeParent(dbeT('moveNavigate', 'Move and navigate…'), false, function () { return moveNavigateItems; })
                    : null;
                var allAdvancedItems = natBem.concat(advancedItems);
                var moreToolsParent = allAdvancedItems.length
                    ? makeParent(dbeT('moreElementTools', 'More element tools…'), false, function () { return allAdvancedItems; })
                    : null;

                // Assemble the clusters in order; empty ones drop out. The first item
                // of every cluster after the first gets a top-border separator via
                // .dbe-ctx-item--first — no separator <li>, so the keyboard focus ring
                // (which skips only non-action rows) is untouched.
                var structureItems = [changeTagParent]
                    .concat(multiIds ? [] : natWrap, [wrapParent, wrapFigureLi, unwrapLi]).filter(Boolean);
                var clusters = [
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

        /* The snippet/variable list menu (Rename / Configure / Delete / Move,
           data-menu-id="var_actions_<title>") and the Selectors-tab context
           menu (data-menu-id="module_actions_<selector>") open through the same
           native dialog machinery as the element menu, but onContextMenuShow
           never touches them (it recognises element menus by their Duplicate /
           Create Component rows). Stamp the shared menu keyboard model on
           either menu, name it after the item it acts on, and anchor it to the
           owning control rather than the opening pointer coordinates. */
        function onItemMenuShow() {
            dbeSetOwnedFrame(DBE_COMMANDS_OWNER, function () {
                var selectorMenu = dbeSelectorMenuTarget && [].slice.call(document.querySelectorAll(
                    'dialog[open] .uniContextMenu[data-menu-id^="module_actions_"]'
                ))
                    .filter(function (m) { return m.offsetParent !== null; })[0];
                var variableMenu = [].slice.call(document.querySelectorAll(
                    'dialog[open] .uniContextMenu[data-menu-id^="var_actions_"]'
                )).filter(function (m) { return m.offsetParent !== null; })[0];
                var menu = selectorMenu || variableMenu;
                if (!menu) { return; }
                var btn = selectorMenu ? dbeSelectorMenuTarget : dbeVarMenuButton(menu);
                var title = selectorMenu
                    ? btn && ((btn.getAttribute('title') || btn.textContent || '').trim())
                    : (menu.getAttribute('data-menu-id') || '').slice('var_actions_'.length);
                if (!btn || !title) { return; }
                if (!menu.getAttribute('aria-label')) {
                    menu.setAttribute('aria-label', title
                        ? dbeFmt(dbeT('tipItemActions', 'Actions for %s'), title)
                        : dbeT('tipItemActionsFallback', 'Item actions'));
                }
                var container = menu.querySelector('ul') || menu;
                setupMenuKeyboard(container);
                dbeAnchorItemMenu(menu, btn);
            });
        }

        /* Resolve the snippet/variable menu's row action button from the title
           encoded in its menu id. Selector menus instead use the actual
           contextmenu target remembered by dbeRememberContextTarget(), because
           punctuation in selector names is normalised in the native menu id. */
        function dbeVarMenuButton(menu) {
            var title = (menu.getAttribute('data-menu-id') || '').slice('var_actions_'.length);
            var btn = null;
            [].slice.call(document.querySelectorAll('.uniTabDataVars__varsList li')).forEach(function (row) {
                if (btn || row.offsetParent === null) { return; }
                var t = row.querySelector('button.varTitle');
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
        var dbeItemMenuAnchorBtn = null;
        var dbeSelectorMenuTarget = null;
        function dbeAnchorItemMenu(menu, btn) {
            var dlg = menu.closest('dialog');
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
            var br = btn.getBoundingClientRect();
            var dr = dlg.getBoundingClientRect();
            var top = Math.round(br.bottom + 4);
            if (top + dr.height > window.innerHeight - 8) { top = Math.round(br.top - dr.height - 4); }
            dlg.style.left = Math.max(8, Math.round(br.right - dr.width)) + 'px';
            dlg.style.top = Math.max(8, top) + 'px';
        }

        function dbeClearItemMenuAnchor() {
            if (dbeItemMenuAnchorBtn) { dbeItemMenuAnchorBtn.style.removeProperty('anchor-name'); }
            dbeItemMenuAnchorBtn = null;
            dbeSelectorMenuTarget = null;
            document.querySelectorAll('dialog.uniBuilderContextMenu.dbe-menu-anchored').forEach(function (dlg) {
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
            document.querySelectorAll('.uniRightPanel button.uniModTree__item.expanded').forEach(function (btn) {
                var li = btn.closest('li.uniModTree__itemDrag');
                // Keep top-level rows (their parent <ul> is the root list) open.
                if (!li || !li.parentElement.closest('li.uniModTree__itemDrag')) { return; }
                var chev = btn.querySelector('i');
                if (!chev) { return; }
                clickSeq(chev);
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
            var panel = document.querySelector('.uniRightPanel');
            if (panel) { dbeExpandPass(panel); }
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

        /* (j) Navigator search: filter box above the tree. Non-matching branches
           hide, while ancestors of a matching row stay visible so its document
           structure remains understandable. Re-applied after every tree render. */
        var treeQuery = '';
        var treeSearchDebounce = null;
        function applyTreeFilter() {
            var q = treeQuery.trim().toLowerCase();
            // schedule() re-runs this on every tree mutation; with no filter active
            // and nothing hidden there is nothing to do, so skip the full-tree
            // textContent walk (one cheap existence probe instead).
            if (!q && !document.querySelector('.uniRightPanel .dbe-tree-filtered-out')) {
                var idleCount = document.querySelector('.dbe-tree-search__count');
                if (idleCount && idleCount.textContent !== '') { idleCount.textContent = ''; }
                return;
            }
            var rows = [].slice.call(document.querySelectorAll('.uniRightPanel .uniModTree__item'));
            var total = rows.length;
            var matches = q ? rows.filter(function (row) {
                return (row.textContent || '').toLowerCase().indexOf(q) !== -1;
            }) : rows;
            var visible = new Set(matches);
            // Builderius renders the tree as a flat sequence carrying aria-level.
            // Walk backwards from every match to retain its nearest ancestor at
            // each level, so the result never loses its structural context.
            matches.forEach(function (match) {
                var level = parseInt(match.getAttribute('aria-level'), 10) || 1;
                for (var i = rows.indexOf(match) - 1; i >= 0 && level > 1; i--) {
                    var candidateLevel = parseInt(rows[i].getAttribute('aria-level'), 10) || 1;
                    if (candidateLevel < level) {
                        visible.add(rows[i]);
                        level = candidateLevel;
                    }
                }
            });
            rows.forEach(function (row) {
                row.classList.remove('dbe-tree-dim'); // clean up the previous implementation
                row.classList.toggle('dbe-tree-filtered-out', !!q && !visible.has(row));
            });
            var count = document.querySelector('.dbe-tree-search__count');
            if (count) {
                var hits = matches.length;
                var msg = !q ? '' : hits === 0
                    ? dbeT('treeNoMatches', 'No matching elements')
                    : dbeFmt(dbeTn(total,
                        'treeMatchesOne', '%1$s of %2$s element matches',
                        'treeMatchesMany', '%1$s of %2$s elements match'), hits, total);
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
                dbeClearOwnedTimeout(DBE_COMMANDS_OWNER, treeSearchDebounce);
                treeSearchDebounce = dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, function () {
                    treeSearchDebounce = null;
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
        var dbeSaveMenuEl = null;

        function dbeSaveBtn() { return dbeQuery('saveButton'); }

        /* clickSeq with real coordinates — for native handlers that position UI
           from the event's clientX/Y rather than the target's box. */
        function dbeClickSeqAt(el, cx, cy) {
            ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (t) {
                var Ev = t.indexOf('pointer') === 0 ? PointerEvent : MouseEvent;
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
            dbeSaveMenuItems(menu).forEach(function (li) {
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
            var dlg = menu.closest('dialog');
            if (dlg) {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, dlg, 'save-menu-close', 'close', function () {
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
            var btn = document.querySelector('.dbe-save-menu-btn');
            var dlg = menu.closest('dialog');
            if (!btn || !dlg) { return; }
            var br = btn.getBoundingClientRect();
            var dr = dlg.getBoundingClientRect();
            dlg.style.left = Math.max(8, Math.round(br.right - dr.width)) + 'px';
            dlg.style.top = Math.round(br.bottom + 4) + 'px';
        }

        /* The menu mounts as a fresh <dialog> per open with a per-button
           data-menu-id — nothing stable to select on. Every open runs through
           dbeOpenSaveMenu's click on the hidden strip, so the first visible
           dialog menu right after that click is this menu. */
        function dbeWatchSaveMenuOpen(focusFirst) {
            waitFor(function () {
                var menus = [].slice.call(document.querySelectorAll('dialog[open] .uniContextMenu'));
                return menus.filter(function (m) { return m.offsetParent !== null; })[0] || null;
            }, function (menu) {
                if (!menu) { return; }
                dbeStampSaveMenu(menu);
                dbeAnchorSaveMenu(menu);
                if (focusFirst) {
                    var items = dbeSaveMenuItems(menu);
                    var first = items.filter(function (li) { return !li.classList.contains('disabled'); })[0] || items[0];
                    if (first) { first.focus(); }
                }
            }, 40, DBE_COMMANDS_OWNER);
        }

        /* Open the native menu through the hidden strip, positioned at our
           injected button. */
        function dbeOpenSaveMenu() {
            var save = dbeSaveBtn();
            var actions = save && save.querySelector('.actions');
            var btn = document.querySelector('.dbe-save-menu-btn');
            if (!actions || !btn) { return; }
            var r = btn.getBoundingClientRect();
            dbeClickSeqAt(actions, r.left + r.width / 2, r.top + r.height / 2);
            dbeWatchSaveMenuOpen(true);
        }

        function bindSaveMenuKeys() {
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'save-menu-keys', 'keydown', function (e) {
                var menu = dbeSaveMenuOpenEl();
                if (!menu) { return; }
                var items = dbeSaveMenuItems(menu);
                if (!items.length) { return; }
                var idx = items.indexOf(document.activeElement);
                var next;
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
            var save = dbeSaveBtn();
            if (!save) { return; }
            var actions = save.querySelector('.actions');
            var btn = save.parentElement.querySelector('.dbe-save-menu-btn');
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
                var caretSvg = actions.querySelector('svg');
                if (caretSvg) { btn.appendChild(caretSvg.cloneNode(true)); }
                else { btn.textContent = '▾'; }
                btn.addEventListener('click', dbeOpenSaveMenu);
                btn.addEventListener('keydown', function (e) {
                    // Enter/Space are the button's native click; ArrowDown matches
                    // the APG menu-button pattern.
                    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); dbeOpenSaveMenu(); }
                });
                save.parentElement.insertBefore(btn, save.nextSibling);
            }
            var exp = dbeSaveMenuOpenEl() ? 'true' : 'false';
            if (btn.getAttribute('aria-expanded') !== exp) { btn.setAttribute('aria-expanded', exp); }
            // Mirror the Save button's current colours AND exact height (theme,
            // save-state and density aware) — flex stretch is not honoured in the
            // top bar's layout, so the height is copied outright.
            var cs = getComputedStyle(save);
            if (btn.style.background !== cs.backgroundColor) { btn.style.background = cs.backgroundColor; }
            if (btn.style.color !== cs.color) { btn.style.color = cs.color; }
            var wantH = Math.round(save.getBoundingClientRect().height) + 'px';
            if (btn.style.blockSize !== wantH) { btn.style.blockSize = wantH; }
        }

        /* (l) Keyboard shortcuts overlay — ? opens a native <dialog>. Combos are
           rendered for THIS platform through dbeAccel, matching the context menu's
           accelerator hints: the Mac glyph stack (⌥⌘T) there, Ctrl+Alt+T
           elsewhere — never the dual "Cmd/Ctrl" spelling. */
        function sc(key, o) { return dbeAccel(key, o); }
        var SHORTCUT_GROUPS = [
            [dbeT('scGroupGeneral', 'General'), [
                ['?', dbeT('scOpenOverlay', 'Open keyboard shortcuts')],
                // multi_select is withdrawn from the registry (see features.php);
                // its rows and the Esc clause return with it via these gates.
                ['Esc', on('multi_select') ?
                    dbeT('scEscape', 'Close menus and dialogs; clear the multi-selection') :
                    dbeT('scEscapeClose', 'Close menus and dialogs')],
                ['Delete', dbeT('scDelete', 'Remove the selected element (Builderius)')],
                [sc('C', { cmd: true }) + ' · ' + sc('V', { cmd: true }), dbeT('scCopyPaste', 'Copy / paste the selected element (Builderius)')]
            ].concat(on('save_shortcut') ? [
                [sc('S', { cmd: true }), dbeT('scSave', 'Save the template')]
            ] : [])],
            [dbeT('scGroupNavigator', 'Navigator'), [].concat(
                on('navigator_keyboard') ? [
                    ['↑ ↓', dbeT('scTreeMove', 'Move to the previous or next element and select it')],
                    ['→', dbeT('scTreeExpand', 'Open a branch, then step into its first child')],
                    ['←', dbeT('scTreeCollapse', 'Close a branch, then step out to the parent')],
                    ['Home · End', dbeT('scTreeFirstLast', 'First / last element')]
                ] : [],
                on('element_moves') ? [
                    [sc('↑', { alt: true }) + ' · ' + sc('↓', { alt: true }), dbeT('scReorder', 'Move the element among its siblings')],
                    [sc('→', { alt: true }), dbeT('scMoveIn', 'Move the element into its previous sibling')],
                    [sc('←', { alt: true }), dbeT('scMoveOut', 'Move the element out one level')]
                ] : [],
                [
                    [sc('Z', { cmd: true }), dbeT('scUndo', 'Undo the last element change')],
                    [sc('Z', { cmd: true, shift: true }), dbeT('scRedo', 'Redo the element change')]
                ],
                on('multi_select') ? [
                    [sc('click', { cmd: true }), dbeT('scMultiToggle', 'Add or remove a row from the multi-selection')],
                    [sc('click', { shift: true }), dbeT('scRange', 'Select a range of rows')]
                ] : [],
                [
                    [sc('F10', { shift: true }), dbeT('scCtxOpen', 'Open the context menu on the focused row')]
                ]
            )]
        ].concat((on('navigator_keyboard') || on('keyboard_shortcuts')) ? [
            [dbeT('scGroupCanvas', 'Canvas'), [].concat(
                on('navigator_keyboard') ? [
                    ['↑ ↓', dbeT('scCanvasMove', 'Move between visible elements')],
                    ['→', dbeT('scCanvasChild', 'Open a branch, then select its first child')],
                    ['←', dbeT('scCanvasParent', 'Close a branch, then select its parent')],
                    ['Home · End', dbeT('scCanvasFirstLast', 'First / last visible element')]
                ] : [],
                on('keyboard_shortcuts') ? [
                    ['Enter', dbeT('scEnterInteractive', 'Edit selected text; otherwise interact with the page')],
                    ['Esc', dbeT('scExitInteractive', 'Return to selecting elements')]
                ] : []
            )]
        ] : []).concat([
            [dbeT('scGroupContextMenu', 'Context menu'), [
                ['↑ ↓', dbeT('scMove', 'Move between items (wraps)')],
                ['Home · End', dbeT('scFirstLast', 'First / last item')],
                ['Enter · Space', dbeT('scActivate', 'Activate an item or open its submenu')],
                ['→ ←', dbeT('scSubmenu', 'Open / close a submenu')]
            ]]
        ]).concat(on('keyboard_shortcuts') ? [
            [dbeT('scGroupElements', 'Selected element'), [
                [sc('D', { cmd: true, shift: true }), dbeT('scDuplicate', 'Duplicate')],
                [sc('X', { cmd: true }), dbeT('scCut', 'Cut')],
                [sc('T', { cmd: true, alt: true }), dbeT('scAddBefore', 'Add an element before')],
                [sc('Y', { cmd: true, alt: true }), dbeT('scAddAfter', 'Add an element after')],
                ['F2', dbeT('scRename', 'Rename')],
                ['Esc', dbeT('scFinishCanvasText', 'Finish editing text in the canvas')],
                [sc('C', { cmd: true }) + ' · ' + sc('V', { cmd: true }) + ' · Delete', dbeT('scCopyPasteDelete', 'Copy / paste / delete the element (Builderius)')]
            ]],
            [dbeT('scGroupAreas', 'Move focus to'), [
                [sc('O', { cmd: true, alt: true }), dbeT('scGotoNavigator', 'Navigator')],
                [sc('E', { cmd: true, alt: true }), dbeT('scGotoSettings', 'Element settings')],
                [sc('P', { cmd: true, alt: true }), dbeT('scGotoCanvas', 'Canvas')],
                [sc('L', { cmd: true, alt: true }), dbeT('scGotoInserter', 'Element library')],
                [sc('B', { cmd: true, alt: true }), dbeT('scGotoFooter', 'Footer bar')]
            ]]
        ] : []).concat(on('ai_terminal_tabs') ? [
            [dbeT('scGroupSenseAi', 'Sense AI'), [
                [sc('`', { ctrl: true }), dbeT('scExitTerminal', 'Move focus out of the terminal')]
            ]]
        ] : []).concat(on('command_palette') ? [
            [dbeT('scGroupPalette', 'Command palette'), [
                [dbePaletteAccel(), dbeT('scOpenPalette', 'Open the command palette')]
            ]]
        ] : []);
        var dbeShortcutFocusReturn = null;
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
                // the selected element!). Handle Escape explicitly: stopping the
                // event can suppress the browser's native dialog cancellation.
                dlg.addEventListener('keydown', function (e) {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        dlg.close();
                    }
                    e.stopPropagation();
                });
                dlg.addEventListener('close', function () {
                    var target = dbeShortcutFocusReturn;
                    dbeShortcutFocusReturn = null;
                    if (target && target.isConnected && typeof target.focus === 'function') {
                        dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, function () { target.focus(); }, 0);
                    }
                });
                document.body.appendChild(dlg);
            }
            if (!dlg.open) {
                dbeShortcutFocusReturn = document.activeElement;
                dlg.showModal();
            }
        }
        function bindShortcutsKey() {
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'shortcut-help-key', 'keydown', function (e) {
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
                // The option role sits on the button, so the wrapper <li> must be
                // presentational or it breaks the listbox→option ownership chain
                // (screen readers then misreport option counts and positions).
                li.setAttribute('role', 'presentation');
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
                undoToast(dbeFmt(dbeT('addedElement', 'Added %s'), '<' + tag + '>'), 'undo');
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


        function dbeElementShortcutsKeydown(e) {
            if (renameActive()) { return; }
            if (document.querySelector('dialog[open]')) { return; } // don't fire over a dialog or the native menu
            var mod = dbeIsMac ? e.metaKey : (e.ctrlKey || e.metaKey);
            var code = e.code;
            // Area jumps are escape routes, so they must work from searches, text
            // fields and Monaco as well as ordinary chrome controls. Process them
            // before the editable-target guard used by destructive/editing keys.
            var AREA = { KeyO: 'navigator', KeyE: 'settings', KeyP: 'canvas', KeyL: 'inserter', KeyB: 'footer' };
            if (mod && e.altKey && !e.shiftKey && AREA[code]) {
                e.preventDefault(); e.stopPropagation();
                dbeFocusArea(AREA[code]);
                return;
            }
            var t = e.target;
            if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], .monaco-editor')) { return; }
            var id = activeId();
            var nativeElementShortcuts = !!(((CFG.builderius || {}).native || {}).elementShortcuts);
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
                driveContextMenuItem(id, 'Duplicate', function (ok) { if (ok) { undoToast(dbeT('duplicated', 'Duplicated element'), 'undo'); } });
            } else if (!nativeElementShortcuts && code === 'KeyX' && !e.shiftKey && !e.altKey) { // Cut = Copy then Remove
                if (!id) { return; }
                e.preventDefault(); e.stopPropagation();
                driveContextMenuItem(id, 'Copy', function (ok) {
                    if (!ok) { return; }
                    driveContextMenuItem(id, 'Remove', function () { undoToast(dbeT('cutDone', 'Cut element'), 'undo'); });
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
        var DBE_PALETTE_KEYS = {
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
            var choice = (CFG.palette || {}).shortcut || 'mod-k';
            return dbeAccel(choice === 'mod-slash' ? '/' : 'K', {
                cmd: true,
                shift: choice === 'mod-shift-k'
            });
        }

        function dbePaletteAriaShortcut() {
            var choice = (CFG.palette || {}).shortcut || 'mod-k';
            var key = choice === 'mod-slash' ? '/' : 'K';
            var parts = [dbeIsMac ? 'Meta' : 'Control'];
            if (choice === 'mod-shift-k') { parts.push('Shift'); }
            parts.push(key);
            return parts.join('+');
        }

        /* Add (or update) one or more HTML attributes on an existing element through
           the settings upsert (a single upsert for the whole batch — no native-control
           driving). `pairs` = [{name, value}, …]. Returns false if the element is gone. */
        function dbeAddAttributes(id, pairs) {
            var safePairs = (pairs || []).map(function (p) {
                var name = String((p && p.name) || '').trim().toLowerCase();
                var value = dbeDecodeEntities(p && p.value);
                return dbeAttrBlocked(name, value) ? null : { name: name, value: value };
            }).filter(Boolean);
            if (!safePairs.length) { return false; }
            return dbeUpdateModuleSettings(id, function (settings) {
                var ha = settings.filter(function (s) { return s.name === 'htmlAttribute'; })[0];
                if (!ha) { ha = { name: 'htmlAttribute', value: [] }; settings.push(ha); }
                if (!Array.isArray(ha.value)) { ha.value = []; }
                safePairs.forEach(function (p) {
                    var existing = ha.value.filter(function (a) { return a.name === p.name; })[0];
                    if (existing) { existing.value = p.value; } else { ha.value.push({ name: p.name, value: p.value }); }
                });
            }, dbeT('attributeChanges', 'attribute changes'));
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
            var focusReturn = document.activeElement;
            var prior = document.querySelector('dialog.dbe-palette');
            if (prior) { try { prior.close(); } catch (e) {} prior.remove(); }

            var dlg = document.createElement('dialog');
            dlg.className = 'dbe-palette';
            dlg.setAttribute('aria-label', dbeT('commandPalette', 'Command palette'));
            var input = document.createElement('input');
            input.type = 'text';
            input.className = 'dbe-palette__input';
            input.setAttribute('aria-label', dbeT('searchCommandsLabel', 'Search commands'));
            input.placeholder = dbeT('searchCommands', 'Search commands…');
            input.setAttribute('role', 'combobox');
            input.setAttribute('aria-autocomplete', 'list');
            input.setAttribute('aria-expanded', 'true');
            input.setAttribute('aria-controls', 'dbe-palette-list');
            var close = document.createElement('button');
            close.type = 'button';
            close.className = 'dbe-palette__close';
            close.setAttribute('aria-label', dbeT('close', 'Close'));
            close.textContent = '×';
            close.addEventListener('click', function () { dlg.close(); });
            var searchRow = document.createElement('div');
            searchRow.className = 'dbe-palette__search-row';
            searchRow.appendChild(input);
            searchRow.appendChild(close);
            var listEl = document.createElement('ul');
            listEl.className = 'dbe-palette__list';
            listEl.id = 'dbe-palette-list';
            listEl.setAttribute('role', 'listbox');
            var hintEl = document.createElement('div');
            hintEl.className = 'dbe-palette__hint';
            hintEl.setAttribute('role', 'status');
            dlg.appendChild(searchRow);
            dlg.appendChild(listEl);
            dlg.appendChild(hintEl);
            ['keydown', 'pointerdown', 'mousedown', 'click'].forEach(function (type) {
                dlg.addEventListener(type, function (e) { e.stopPropagation(); });
            });
            dlg.addEventListener('close', function () {
                dlg.remove();
                if (focusReturn && focusReturn.isConnected) { try { focusReturn.focus(); } catch (e) {} }
            });
            document.body.appendChild(dlg);

            function runClose(fn) { dlg.close(); dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, fn, 120); }

            // Commands carry a group key; renderList draws a labelled divider each
            // time the group changes, so related commands read as a set. `accel` is a
            // presentational shortcut hint shown right-aligned, mirroring the block
            // editor's context menu.
            var GROUP_LABELS = {
                add: dbeT('paletteGroupAdd', 'Add to element'),
                styles: dbeT('paletteGroupStyles', 'Styles'),
                structure: dbeT('paletteGroupStructure', 'Structure'),
                element: dbeT('paletteGroupElement', 'Element'),
                workspace: dbeT('paletteGroupWorkspace', 'Workspace'),
                admin: dbeT('paletteGroupAdmin', 'WordPress and Builderius'),
                goto: dbeT('paletteGroupGoto', 'Go to')
            };

            var commands = [];
            if (hasEl) {
                commands.push(
                    { group: 'add', label: dbeT('paletteAddClass', 'Add classes'), input: true, ph: dbeT('phClass', 'class1 class2  (or .a.b)'),
                        empty: dbeT('paletteEnterClass', 'Enter at least one class'), run: function (v) {
                        var cls = v.replace(/^\./, '').split(/[\s.]+/).filter(Boolean);
                        if (!cls.length) { paletteInputError(dbeT('paletteEnterClass', 'Enter at least one class')); return; }
                        runClose(function () {
                            if (dbeAddClasses(id, cls)) {
                                undoToast(dbeFmt(dbeTn(cls.length, 'addedClassesOne', 'Added %s class', 'addedClassesMany', 'Added %s classes'), cls.length), 'undo');
                            }
                        });
                    } },
                    { group: 'add', label: dbeT('paletteAddAttr', 'Add attributes'), input: true, ph: dbeT('phAttr', 'name=value; name2=value2'),
                        empty: dbeT('paletteEnterAttribute', 'Enter an attribute name'), run: function (v) {
                        var pairs = dbeParseAttributes(v);
                        if (!pairs.length) { paletteInputError(dbeT('paletteEnterAttribute', 'Enter an attribute name')); return; }
                        runClose(function () {
                            if (dbeAddAttributes(id, pairs)) {
                                undoToast(dbeFmt(dbeTn(pairs.length, 'addedAttribute', 'Added attribute %s', 'addedAttributesMany', 'Added %s attributes'), pairs.length === 1 ? pairs[0].name : pairs.length), 'undo');
                            }
                        });
                    } },
                    { group: 'add', label: dbeT('paletteAddEmmet', 'Add elements (Emmet)'), input: true, ph: 'div.card>h3{Title}+p{Text}',
                        empty: dbeT('paletteEnterElement', 'Enter an element abbreviation'), run: function (v) {
                        var roots;
                        try { roots = dbeEmmetParse(v); } catch (e) { paletteInputError(dbeFmt(dbeT('emmetInvalid', 'Could not parse: %s'), v)); return; }
                        var structErr = dbeEmmetStructureError(id, roots);
                        if (structErr) { paletteInputError(structErr); return; }
                        runClose(function () {
                            var n = dbeEmmetInsert(id, roots);
                            undoToast(dbeFmt(dbeTn(n, 'emmetAddedOne', 'Added %s element', 'emmetAddedMany', 'Added %s elements'), n));
                        });
                    } }
                );
                if (on('style_inspector')) {
                    commands.push(
                        { group: 'styles', label: dbeT('inspectStyles', 'Inspect styles…'), run: function () { runClose(function () { openStyleInspector(id); }); } },
                        { group: 'styles', label: dbeT('editElementStyles', 'Edit element styles (%local%)'), run: function () { runClose(function () { dbeOpenStyleEditor(id, '%local%', null); }); } }
                    );
                    moduleClasses((modules() || {})[id]).forEach(function (className) {
                        var selector = '.' + className;
                        commands.push(
                            { group: 'styles', label: dbeFmt(dbeT('editClassStyles', 'Edit %1$s — %2$s'), selector, dbeT('scopeGlobal', 'Global')), run: function () { runClose(function () { dbeOpenStyleEditor(id, selector, 'global'); }); } },
                            { group: 'styles', label: dbeFmt(dbeT('editClassStyles', 'Edit %1$s — %2$s'), selector, entityScopeLabel()), run: function () { runClose(function () { dbeOpenStyleEditor(id, selector, 'template'); }); } }
                        );
                    });
                }
                commands.push(
                    { group: 'structure', label: dbeT('addBefore', 'Add element before'), accel: dbeAccel('T', { cmd: true, alt: true }), run: function () { runClose(function () { openElementPicker(id, -1); }); } },
                    { group: 'structure', label: dbeT('addAfter', 'Add element after'), accel: dbeAccel('Y', { cmd: true, alt: true }), run: function () { runClose(function () { openElementPicker(id, 1); }); } }
                );
                if (on('element_moves')) {
                    var paletteLoc = dbeMoveLocation(id);
                    var canMoveUp = !!(paletteLoc && paletteLoc.index > 0);
                    var canMoveDown = !!(paletteLoc && paletteLoc.index >= 0 && paletteLoc.index < paletteLoc.siblings.length - 1);
                    var canMoveIn = !!dbeIndentTarget(id);
                    var canMoveOut = dbeCanOutdent(id);
                    commands.push(
                        { group: 'structure', label: dbeT('moveUp', 'Move up'), icon: 'arrow-up', accel: dbeAccel('↑', { alt: true }), disabled: !canMoveUp,
                            reason: dbeT('cannotMoveUp', 'Already first among its siblings'), run: function () { runClose(function () { moveSibling(id, -1); }); } },
                        { group: 'structure', label: dbeT('moveDown', 'Move down'), icon: 'arrow-down', accel: dbeAccel('↓', { alt: true }), disabled: !canMoveDown,
                            reason: dbeT('cannotMoveDown', 'Already last among its siblings'), run: function () { runClose(function () { moveSibling(id, 1); }); } },
                        { group: 'structure', label: dbeT('moveIn', 'Move in one level'), icon: 'indent-increase', accel: dbeAccel('→', { alt: true }), disabled: !canMoveIn,
                            reason: dbeT('cannotMoveIn', 'Needs a previous sibling that can contain elements'), run: function () { runClose(function () { indentElement(id); }); } },
                        { group: 'structure', label: dbeT('moveOut', 'Move out one level'), icon: 'indent-decrease', accel: dbeAccel('←', { alt: true }), disabled: !canMoveOut,
                            reason: dbeT('cannotMoveOut', 'Already at the outermost available level'), run: function () { runClose(function () { outdentElement(id); }); } }
                    );
                }
                if (on('wrap_in')) {
                    commands.push(
                        { group: 'structure', label: dbeT('paletteWrapDiv', 'Wrap in div'), run: function () { runClose(function () { wrap('div', [id]); }); } },
                        { group: 'structure', label: dbeT('paletteWrapFigure', 'Wrap in figure'), run: function () { runClose(function () { wrap('figure', [id]); }); } },
                        { group: 'structure', label: dbeT('paletteWrapTemplate', 'Wrap in template'), run: function () { runClose(function () { wrap('template', [id]); }); } },
                        { group: 'structure', label: dbeT('paletteWrapCollection', 'Wrap in collection'), run: function () { runClose(function () { wrap('collection', [id]); }); } }
                    );
                }
                commands.push(
                    { group: 'element', label: dbeT('editText', 'Edit text'), accel: 'Enter', disabled: !dbeCanvasTextTarget(),
                        reason: dbeT('cannotEditText', 'Select an element with editable text'), run: function () { runClose(dbeCanvasStartTextEditing); } },
                    { group: 'element', label: dbeT('rename', 'Rename'), accel: 'F2', input: true, ph: 'New name',
                        empty: dbeT('paletteEnterName', 'Enter a new name'), run: function (v) {
                        if (!v.trim()) { return; }
                        runClose(function () { commitRename(id, v.trim()); });
                    } }
                );
                if (on('edit_as_html')) {
                    commands.push(
                        { group: 'element', label: dbeT('editAsHtml', 'Edit as HTML'), disabled: !dbeHtmlEditable(id),
                            reason: dbeT('editAsHtmlOnlyElements', 'Only subtrees of plain elements can be edited as HTML'),
                            run: function () { runClose(function () { openEditHtmlDialog(id); }); } }
                    );
                }
                if (on('import_html')) {
                    var paletteHtmlModule = (modules() || {})[id];
                    var canImportHtml = !!(paletteHtmlModule && DBE_HTML_MODULES[paletteHtmlModule.name] && paletteHtmlModule.name !== 'SvgCode');
                    commands.push(
                        { group: 'element', label: dbeT('importHtml', 'Import HTML'), disabled: !canImportHtml,
                            reason: dbeT('importHtmlOnlyElements', 'HTML can only be imported into a plain element'),
                            run: function () { runClose(function () { openImportHtmlDialog(id); }); } }
                    );
                }
                if (on('auto_bem')) {
                    commands.push(
                        { group: 'element', label: dbeT('autoBem', 'Auto-BEM'), run: function () { runClose(function () { openAutoBemDialog(id); }); } }
                    );
                }
                // Change tag by TYPING the tag — the flyout's curated list is a
                // mouse affordance; here any known non-void tag goes.
                if (on('tag_change') && dbeChangeTagEligible(id)) {
                    commands.push(
                        { group: 'element', label: dbeT('paletteChangeTag', 'Change tag'), input: true,
                            ph: dbeFmt(dbeT('phTag', 'section, h2, figure…  (now <%s>)'), dbeChangeTagEligible(id)),
                            empty: dbeT('paletteEnterTag', 'Enter a new HTML tag'),
                            run: function (v) {
                                var tg = dbeCleanTagInput(v);
                                if (!tg) {
                                    paletteInputError(dbeFmt(dbeT('tagInvalid', 'Not a usable HTML tag: %s'), String(v || '').trim() || '—'));
                                    return;
                                }
                                if (tg === dbeChangeTagEligible(id)) {
                                    paletteInputError(dbeFmt(dbeT('tagAlready', 'Already <%s>'), tg));
                                    return;
                                }
                                runClose(function () { dbeChangeTag(id, tg); });
                            } }
                    );
                }
                commands.push(
                    { group: 'element', label: dbeT('paletteDuplicate', 'Duplicate'), accel: dbeAccel('D', { cmd: true, shift: true }), run: function () { runClose(function () { driveContextMenuItem(id, 'Duplicate', function (ok) { if (ok) { undoToast(dbeT('duplicated', 'Duplicated element'), 'undo'); } }); }); } },
                    { group: 'element', label: dbeT('paletteCopy', 'Copy'), accel: dbeAccel('C', { cmd: true }), run: function () { runClose(function () { driveContextMenuItem(id, 'Copy', function (ok) { if (ok) { undoToast(dbeT('copiedElement', 'Copied element')); } }); }); } },
                    { group: 'element', label: dbeT('paletteCut', 'Cut'), accel: dbeAccel('X', { cmd: true }), run: function () { runClose(function () { driveContextMenuItem(id, 'Copy', function (ok) { if (ok) { driveContextMenuItem(id, 'Remove', function () { undoToast(dbeT('cutDone', 'Cut element'), 'undo'); }); } }); }); } },
                    { group: 'element', label: dbeT('paletteDelete', 'Delete'), accel: dbeT('accelDelete', 'Del'), run: function () { runClose(function () { driveContextMenuItem(id, 'Remove', function () { undoToast(dbeT('deletedElement', 'Deleted element'), 'undo'); }); }); } },
                    // Settings show the selected element's settings — only useful with one.
                    { group: 'goto', label: dbeT('goToSettings', 'Go to Element settings'), accel: dbeAccel('E', { cmd: true, alt: true }), run: function () { runClose(function () { dbeFocusArea('settings'); }); } }
                );
            }
            commands.push(
                { group: 'workspace', icon: 'pointer', label: dbeCanvasInteractive() ? dbeT('exitInteractiveCanvas', 'Select elements') : dbeT('enterInteractiveCanvas', 'Interact with page'),
                    run: function () { runClose(function () { dbeSetCanvasInteractive(!dbeCanvasInteractive()); }); } }
            );
            /* The compact selector owns visibility below 720px. Persisted wide-view
               panel commands would appear to do nothing there, so expose them only
               when they can truthfully affect the current layout. */
            if (!dbeCompactActive()) {
                var panelWrappers = dbePanelWrappers();
                var leftPanelHidden = dbePanelSideHidden('left', panelWrappers.left);
                var rightPanelHidden = dbePanelSideHidden('right', panelWrappers.right);
                var panelsHidden = leftPanelHidden && rightPanelHidden;
                commands.push(
                { group: 'workspace', icon: 'panels', label: panelsHidden ? dbeT('showSidePanels', 'Show side panels') : dbeT('hideSidePanels', 'Hide side panels (full-width canvas)'),
                    run: function () { runClose(function () {
                        dbeToggleSidePanels(function (changed) {
                            if (changed) { undoToast(panelsHidden ? dbeT('sidePanelsShown', 'Side panels shown') : dbeT('sidePanelsHidden', 'Side panels hidden')); }
                        });
                    }); } },
                { group: 'workspace', icon: 'panel-left', label: leftPanelHidden ? dbeT('showSettingsPanel', 'Show settings panel') : dbeT('hideSettingsPanel', 'Hide settings panel'),
                    run: function () { runClose(function () { dbeSetPanelVisibility('left', !leftPanelHidden); }); } },
                { group: 'workspace', icon: 'panel-right', label: rightPanelHidden ? dbeT('showNavigatorPanel', 'Show Navigator panel') : dbeT('hideNavigatorPanel', 'Hide Navigator panel'),
                    run: function () { runClose(function () { dbeSetPanelVisibility('right', !rightPanelHidden); }); } }
                );
            }
            commands.push(
                { group: 'goto', label: dbeT('goToNavigator', 'Go to Navigator'), accel: dbeAccel('O', { cmd: true, alt: true }), run: function () { runClose(function () { dbeFocusArea('navigator'); }); } },
                { group: 'goto', label: dbeT('goToCanvas', 'Go to canvas'), accel: dbeAccel('P', { cmd: true, alt: true }), run: function () { runClose(function () { dbeFocusArea('canvas'); }); } },
                { group: 'goto', label: dbeT('openInserterCmd', 'Open Element library'), accel: dbeAccel('L', { cmd: true, alt: true }), run: function () { runClose(function () { dbeFocusArea('inserter'); }); } },
                { group: 'goto', label: dbeT('goToFooter', 'Go to footer bar'), accel: dbeAccel('B', { cmd: true, alt: true }), run: function () { runClose(function () { dbeFocusArea('footer'); }); } },
                { group: 'goto', label: dbeT('keyboardShortcuts', 'Keyboard shortcuts'), accel: '?', run: function () { runClose(openShortcutsDialog); } }
            );
            var adminUrls = CFG.adminUrls || {};
            if (adminUrls.dashboard) {
                commands.push({ group: 'admin', icon: 'dashboard', label: dbeT('openWpDashboard', 'Open WordPress dashboard'), href: adminUrls.dashboard });
            }
            if (adminUrls.releases) {
                commands.push({ group: 'admin', icon: 'package', label: dbeT('openBuilderiusReleases', 'Open Builderius releases'), href: adminUrls.releases });
            }
            if (adminUrls.settings) {
                commands.push({ group: 'admin', icon: 'settings', label: dbeT('openBuilderiusSettings', 'Open Builderius settings'), href: adminUrls.settings });
            }

            var paletteGroupOrder = ['add', 'styles', 'structure', 'element', 'workspace', 'goto', 'admin'];
            commands.sort(function (a, b) {
                return paletteGroupOrder.indexOf(a.group) - paletteGroupOrder.indexOf(b.group);
            });

            var mode = null; // null = list mode; else the active input command
            var buttons = [];
            var groupHeads = []; // divider/heading <li>s, hidden when their group is fully filtered out
            var activeButton = null;

            function setActiveButton(button, method) {
                buttons.forEach(function (b) {
                    var selected = b === button ? 'true' : 'false';
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
                    // The option role sits on the button; the wrapper <li> must be
                    // presentational (like the group heads above) or it breaks the
                    // listbox→option ownership chain for screen readers.
                    li.setAttribute('role', 'presentation');
                    var btn = document.createElement(cmd.href ? 'a' : 'button');
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
                    var command = document.createElement('span');
                    command.className = 'dbe-palette__command';
                    if (cmd.icon) { command.appendChild(dbeSvgIcon(cmd.icon, 'dbe-palette__icon')); }
                    var copy = document.createElement('span');
                    copy.className = 'dbe-palette__copy';
                    var lab = document.createElement('span');
                    lab.className = 'dbe-palette__label';
                    lab.id = btn.id + '-label';
                    lab.textContent = cmd.label;
                    copy.appendChild(lab);
                    btn.setAttribute('aria-labelledby', lab.id);
                    if (cmd.disabled && cmd.reason) {
                        var reason = document.createElement('span');
                        reason.className = 'dbe-palette__reason';
                        reason.id = btn.id + '-reason';
                        reason.textContent = cmd.reason;
                        copy.appendChild(reason);
                        btn.setAttribute('aria-describedby', reason.id);
                    }
                    command.appendChild(copy);
                    btn.appendChild(command);
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
                    btn.addEventListener('click', function () {
                        if (cmd.href) { dlg.close(); return; }
                        pick(cmd);
                    });
                    btn.addEventListener('mouseenter', function () { setActiveButton(btn, 'pointer'); });
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
                if (activeButton && activeButton.parentElement.hidden) { setActiveButton(null); }
                hintEl.classList.remove('dbe-palette__hint--error');
                hintEl.textContent = q && visible().length === 0
                    ? dbeT('paletteNoMatch', 'No matching commands')
                    : (!q && !hasEl ? dbeT('paletteNoEl', 'No element selected — element commands are hidden') : '');
            }
            function pick(cmd) {
                if (cmd.disabled) { undoToast(cmd.reason || dbeT('commandUnavailable', 'That command is not available here')); return; }
                if (cmd.href) {
                    var link = buttons.filter(function (button) { return button.dbeCmd === cmd; })[0];
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
                setTimeout(function () { hintEl.textContent = message; }, 20);
            }
            function exitInput() {
                mode = null;
                input.value = '';
                input.placeholder = dbeT('searchCommands', 'Search commands…');
                input.setAttribute('aria-expanded', 'true');
                renderList(); applyFilter();
                input.focus();
            }

            input.addEventListener('input', function () {
                if (mode) {
                    hintEl.classList.remove('dbe-palette__hint--error');
                    hintEl.textContent = mode.label;
                    return;
                }
                applyFilter();
            });
            dlg.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (mode) {
                        if (!input.value.trim()) {
                            paletteInputError(mode.empty || dbeT('paletteEnterValue', 'Enter a value'));
                            return;
                        }
                        mode.run(input.value); return;
                    }
                    var vis = visible();
                    var pickBtn = activeButton || vis[0];
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
                var vis2 = visible();
                if (!vis2.length) { return; }
                var i = vis2.indexOf(activeButton);
                var next = e.key === 'ArrowDown' ? (i < 0 ? 0 : (i + 1) % vis2.length) : (i < 0 ? vis2.length - 1 : (i - 1 + vis2.length) % vis2.length);
                setActiveButton(vis2[next], 'keyboard');
                input.focus();
            });

            renderList();
            dlg.showModal();
            input.focus();
        }

        function dbePaletteKeydown(e) {
            var k = dbePaletteKey();
            if (k.key ? e.key !== k.key : (e.code !== k.code || e.shiftKey !== k.shift)) { return; }
            if (e.altKey) { return; }
            if (!(dbeIsMac ? e.metaKey : (e.ctrlKey || e.metaKey))) { return; }
            if (renameActive()) { return; }
            var t = e.target;
            if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], .monaco-editor')) { return; }
            if (document.querySelector('dialog[open]')) { return; }
            e.preventDefault(); e.stopPropagation();
            openCommandPalette();
        }

        /* The preview is a same-origin iframe. Once focus enters it, key events no
           longer bubble to the builder document, so bridge the canvas-specific keys
           into that document. */
        var DBE_COMMANDS_OWNER = 'commands';
        var dbeCommandsControllerActive = false;
        var dbeKeyboardFrame = null;
        var dbeCommandFrameDocuments = [];
        var dbePreviewContextState = null;
        var dbePreviewPointerContext = null;
        var dbePreviewFocusState = null;
        var dbePreviewRenameDialog = null;

        function dbeCanvasTextEditingKeydown(e) {
            if (e.key !== 'Escape') { return; }
            var target = e.target;
            var editor = target && target.closest
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
            var id = activeId();
            var mods = modules();
            var mod = id && mods && mods[id];
            if (!mod || mod.name !== 'HtmlElement' || !((mod.settings || []).some(function (s) { return s.name === 'content'; }))) {
                return null;
            }
            var frame = dbeQuery('previewFrame');
            var doc;
            try { doc = frame && frame.contentDocument; } catch (e) { doc = null; }
            if (!doc) { return null; }
            var matches = [].slice.call(doc.querySelectorAll('.uni-node-' + id));
            return matches.filter(function (el) { return el.getClientRects().length; })[0] || matches[0] || null;
        }

        function dbeCanvasStartTextEditing() {
            var target = dbeCanvasTextTarget();
            if (!target) { return false; }
            var view = target.ownerDocument.defaultView;
            var rect = target.getBoundingClientRect();
            var opts = {
                bubbles: true,
                cancelable: true,
                view: view,
                detail: 2,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
            };
            target.dispatchEvent(new view.MouseEvent('dblclick', opts));
            return true;
        }

        function dbeSyncCanvasEditingIndicator(doc) {
            if (!doc) { return; }
            var editing = !!doc.querySelector('uni-inline-editing[contenteditable="true"]');
            var wasEditing = doc.dbeCanvasTextEditingActive;
            doc.dbeCanvasTextEditingActive = editing;
            var indicator = document.querySelector('.dbe-canvas-editing-indicator');

            if (editing && !indicator) {
                var host = document.querySelector('.uniIframePanel__outer');
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
                var mode = store().storeGet('overlayMode');
                if (mode) { return mode !== 'selectModule'; }
            } catch (e) {}
            var toggle = document.querySelector('.overlayToggleIcon');
            return !!(toggle && toggle.classList.contains('active'));
        }

        function dbePreviewContextBlocked(target) {
            var el = target && target.nodeType === 1 ? target : target && target.parentElement;
            if (!el || !el.closest) { return true; }
            if (el.closest('input, textarea, select, option, button, iframe, object, embed, .monaco-editor, uni-inline-editing')) {
                return true;
            }
            var editable = el.closest('[contenteditable]');
            return !!(editable && editable.getAttribute('contenteditable') !== 'false');
        }

        /* Resolve the nearest rendered module, rather than the first uni-node
           class in the document. Collection instances can render one module id
           more than once; retaining the actual element gives focus return a
           predictable instance even though the shared command target is the id. */
        function dbePreviewContextTarget(target) {
            var el = target && target.nodeType === 1 ? target : target && target.parentElement;
            while (el && el.nodeType === 1) {
                for (var i = 0; i < el.classList.length; i++) {
                    var match = /^uni-node-([A-Za-z0-9_-]+)$/.exec(el.classList[i]);
                    if (match && el.getClientRects().length && (modules() || {})[match[1]]) {
                        return { id: match[1], element: el, tag: (el.localName || '').toLowerCase() };
                    }
                }
                el = el.parentElement;
            }
            return null;
        }

        function dbePreviewContextTargetAtPoint(doc, x, y, fallback) {
            var hits = doc && doc.elementsFromPoint ? doc.elementsFromPoint(x, y) : [];
            for (var i = 0; i < hits.length; i++) {
                var target = dbePreviewContextTarget(hits[i]);
                if (target) { return target; }
            }
            return dbePreviewContextTarget(fallback);
        }

        function dbePreviewActiveTarget(doc) {
            var active = doc && doc.activeElement;
            var target = dbePreviewContextTarget(active);
            if (target) { return target; }
            var id = activeId();
            if (!id || !doc) { return null; }
            var matches = [].slice.call(doc.querySelectorAll('.uni-node-' + id));
            var el = matches.filter(function (candidate) { return candidate.getClientRects().length; })[0] || null;
            return el ? { id: id, element: el, tag: (el.localName || '').toLowerCase() } : null;
        }

        function dbePreviewContextHeading() {
            var state = dbePreviewContextState;
            var mods = modules() || {};
            var mod = state && mods[state.id];
            if (!state || !mod) { return ''; }
            var label = mod.label || defaultLabelFor(state.id) || dbeT('element', 'Element');
            var tagSetting = (mod.settings || []).filter(function (setting) { return setting.name === 'tag'; })[0];
            var tag = (tagSetting && tagSetting.value) || state.tag;
            return tag
                ? dbeFmt(dbeT('previewContextTarget', '%1$s · <%2$s>'), label, tag)
                : label;
        }

        function dbeClearPreviewFocusState() {
            var state = dbePreviewFocusState;
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
            var target = state.element && state.element.isConnected ? state.element : null;
            if (!target) {
                if (state.frame && state.frame.isConnected) {
                    try { state.frame.focus(); } catch (e) {}
                }
                dbeReleasePreviewContextState(state, false);
                return;
            }
            var attempts = 0;
            var stableChecks = 0;

            function attempt() {
                var outerActive = document.activeElement;
                var innerActive = target.ownerDocument.activeElement;
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
                dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, function () {
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
            var state = dbePreviewContextState;
            dbePreviewContextState = null;
            if (!state) { return; }
            if (!restoreFocus) {
                dbeReleasePreviewContextState(state, false);
                return;
            }
            waitFor(function () {
                return document.querySelector('dialog.uniBuilderContextMenu[open]') ? null : true;
            }, function (closed) {
                if (!closed || document.querySelector('dialog[open]')) {
                    dbeReleasePreviewContextState(state, false);
                    return;
                }
                dbeRestorePreviewContextTarget(state);
            }, 12, DBE_COMMANDS_OWNER);
        }

        function dbeOpenPreviewRename(id, renderedTarget) {
            var mods = modules() || {};
            var mod = id && mods[id];
            if (!mod || dbeCanvasInteractive()) { return false; }

            if (dbePreviewRenameDialog) {
                dbePreviewRenameDialog.remove();
                dbePreviewRenameDialog = null;
            }
            dbeDiscardPreviewContext(false);
            dbeClearPreviewFocusState();

            var frame = dbeQuery('previewFrame');
            var target = renderedTarget && renderedTarget.isConnected ? renderedTarget : null;
            var hadTabindex = target ? target.hasAttribute('tabindex') : true;
            if (target && !hadTabindex && target.tabIndex < 0) { target.setAttribute('tabindex', '-1'); }
            var focusState = {
                element: target,
                frame: frame,
                addedTabindex: !!(target && !hadTabindex && target.getAttribute('tabindex') === '-1')
            };
            var restoreFocusOnClose = true;
            var oldLabel = mod.label || defaultLabelFor(id) || '';
            var dlg = document.createElement('dialog');
            dlg.className = 'dbe-preview-rename';
            dlg.setAttribute('aria-labelledby', 'dbe-preview-rename-title');
            dlg.setAttribute('aria-describedby', 'dbe-preview-rename-hint dbe-preview-rename-error');
            dbePreviewRenameDialog = dlg;

            var title = document.createElement('h2');
            title.id = 'dbe-preview-rename-title';
            title.className = 'dbe-preview-rename__title';
            title.textContent = dbeT('previewRenameTitle', 'Rename Navigator name');
            dlg.appendChild(title);

            var hint = document.createElement('p');
            hint.id = 'dbe-preview-rename-hint';
            hint.className = 'dbe-preview-rename__hint';
            hint.textContent = dbeT('previewRenameHint',
                'Changes the name shown in the Navigator. This does not change the element’s visible text or HTML tag.');
            dlg.appendChild(hint);

            var form = document.createElement('form');
            form.noValidate = true;
            var label = document.createElement('label');
            label.className = 'dbe-preview-rename__label';
            label.setAttribute('for', 'dbe-preview-rename-input');
            label.textContent = dbeT('previewRenameLabel', 'Navigator name');
            var input = document.createElement('input');
            input.id = 'dbe-preview-rename-input';
            input.className = 'dbe-preview-rename__input';
            input.type = 'text';
            input.value = oldLabel;
            input.required = true;
            input.setAttribute('autocomplete', 'off');
            var error = document.createElement('p');
            error.id = 'dbe-preview-rename-error';
            error.className = 'dbe-preview-rename__error';
            error.setAttribute('role', 'alert');
            label.appendChild(input);
            form.appendChild(label);
            form.appendChild(error);

            var actions = document.createElement('div');
            actions.className = 'dbe-preview-rename__actions';
            var cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'dbe-preview-rename__cancel';
            cancel.textContent = dbeT('cancel', 'Cancel');
            cancel.addEventListener('click', function () { dlg.close(); });
            var save = document.createElement('button');
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

            input.addEventListener('input', function () {
                error.textContent = '';
                input.removeAttribute('aria-invalid');
            });
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var next = (input.value || '').trim();
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
                waitFor(function () {
                    var current = (modules() || {})[id];
                    return current && current.label === next ? true : null;
                }, function (renamed) {
                    restoreFocus();
                    dbeCanvasStatus(renamed
                        ? dbeFmt(dbeT('previewRenameSuccess', 'Renamed element to %s'), next)
                        : dbeT('previewRenameFailed', 'Could not rename the preview element'));
                }, 20, DBE_COMMANDS_OWNER);
            });
            dlg.addEventListener('keydown', function (e) {
                e.stopPropagation();
                if (e.key === 'Escape') {
                    e.preventDefault();
                    dlg.close();
                }
            });
            ['pointerdown', 'mousedown', 'click'].forEach(function (type) {
                dlg.addEventListener(type, function (e) { e.stopPropagation(); });
            });
            dlg.addEventListener('close', function () {
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
            var state = dbePreviewContextState;
            dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, function () {
                if (dbePreviewContextState === state) { dbePreviewContextState = null; }
                waitFor(function () {
                    return document.querySelector('dialog.uniBuilderContextMenu[open]') ? null : true;
                }, function (closed) {
                    if (closed && !document.querySelector('dialog[open]')) {
                        dbeRestorePreviewContextTarget(state);
                    } else {
                        dbeReleasePreviewContextState(state, false);
                    }
                }, 12, DBE_COMMANDS_OWNER);
            }, 0);
        }

        function dbePreviewBuilderPoint(frame, innerX, innerY) {
            var rect = frame.getBoundingClientRect();
            var scaleX = frame.clientWidth ? rect.width / frame.clientWidth : 1;
            var scaleY = frame.clientHeight ? rect.height / frame.clientHeight : 1;
            return {
                x: Math.min(Math.max(8, rect.left + innerX * scaleX), window.innerWidth - 8),
                y: Math.min(Math.max(8, rect.top + innerY * scaleY), window.innerHeight - 8)
            };
        }

        function dbeOpenPreviewContextMenu(target, innerX, innerY) {
            var frame = dbeQuery('previewFrame');
            var row = target && navRowById(target.id);
            if (!frame || !row || document.querySelector('dialog.uniBuilderContextMenu[open]')) { return false; }

            dbeDiscardPreviewContext(false);
            dbeClearPreviewFocusState();
            if (dbeMultiSel.size) { clearMultiSel(); }
            var hadTabindex = target.element.hasAttribute('tabindex');
            if (!hadTabindex && target.element.tabIndex < 0) { target.element.setAttribute('tabindex', '-1'); }
            dbePreviewContextState = {
                id: target.id,
                element: target.element,
                tag: target.tag,
                frame: frame,
                addedTabindex: !hadTabindex && target.element.getAttribute('tabindex') === '-1'
            };
            try { target.element.focus({ preventScroll: true }); } catch (e) { try { target.element.focus(); } catch (err) {} }
            setContextTarget(target.id);

            function open() {
                if (!dbePreviewContextState || dbePreviewContextState.id !== target.id) { return; }
                var point = dbePreviewBuilderPoint(frame, innerX, innerY);
                var event = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: point.x,
                    clientY: point.y
                });
                try { Object.defineProperty(event, 'dbePreviewContext', { value: true }); } catch (e) { event.dbePreviewContext = true; }
                row.dispatchEvent(event);
                waitFor(function () {
                    return document.querySelector('dialog.uniBuilderContextMenu[open]');
                }, function (dialog) {
                    if (!dialog && dbePreviewContextState && dbePreviewContextState.id === target.id) {
                        dbeDiscardPreviewContext(true);
                        dbeCanvasStatus(dbeT('previewContextFailed', 'Could not open the element menu'));
                    }
                }, 12, DBE_COMMANDS_OWNER);
            }

            if (activeId() === target.id) { open(); }
            else {
                clickSeq(row);
                waitFor(function () { return activeId() === target.id || null; }, function (selected) {
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
            var blocked = dbeCanvasInteractive() || dbePreviewContextBlocked(e.target);
            dbePreviewPointerContext = {
                doc: e.currentTarget,
                blocked: blocked,
                target: blocked ? null : dbePreviewContextTargetAtPoint(e.currentTarget, e.clientX, e.clientY, e.target)
            };
        }

        function dbePreviewContextMenu(e) {
            var pointer = dbePreviewPointerContext && dbePreviewPointerContext.doc === e.currentTarget
                ? dbePreviewPointerContext
                : null;
            dbePreviewPointerContext = null;
            if ((pointer && pointer.blocked) || (!pointer && (dbeCanvasInteractive() || dbePreviewContextBlocked(e.target)))) { return; }
            var target = pointer && pointer.target
                ? pointer.target
                : dbePreviewContextTargetAtPoint(e.currentTarget, e.clientX, e.clientY, e.target);
            if (!target) { return; }
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            // Let Builderius finish the pointerdown selection repaint before the
            // synthetic Navigator contextmenu opens its outer-document dialog.
            dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, function () {
                dbeOpenPreviewContextMenu(target, e.clientX, e.clientY);
            }, 0);
        }

        function dbePreviewContextMenuKeydown(e) {
            if (e.key === 'F2' && on('preview_rename') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                if (dbeCanvasInteractive() || dbePreviewContextBlocked(e.target)) { return; }
                var renameTarget = dbePreviewContextTarget(e.target) || dbePreviewActiveTarget(e.currentTarget);
                if (!renameTarget) { return; }
                e.preventDefault();
                e.stopPropagation();
                dbeOpenPreviewRename(renameTarget.id, renameTarget.element);
                return;
            }
            if (e.key !== 'ContextMenu' && !(e.key === 'F10' && e.shiftKey)) { return; }
            if (!on('preview_context_menu')) { return; }
            if (dbeCanvasInteractive() || dbePreviewContextBlocked(e.target)) { return; }
            var doc = e.currentTarget;
            var target = dbePreviewContextTarget(e.target) || dbePreviewActiveTarget(doc);
            if (!target) { return; }
            var rect = target.element.getBoundingClientRect();
            e.preventDefault();
            e.stopPropagation();
            dbeOpenPreviewContextMenu(target, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }

        function dbeCanvasStatus(message) {
            var status = document.querySelector('.dbe-canvas-status');
            if (!status) {
                status = document.createElement('div');
                status.className = 'dbe-canvas-status dbe-visually-hidden';
                status.setAttribute('role', 'status');
                document.body.appendChild(status);
            }
            status.textContent = '';
            dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, function () {
                if (status.isConnected) { status.textContent = message; }
            }, 20);
        }

        function dbeSetCanvasInteractive(interactive) {
            if (dbeCanvasInteractive() === interactive) { return false; }
            var toggle = document.querySelector('.overlayToggleIcon');
            if (toggle) { clickSeq(toggle); }
            else {
                try { store().storeSet('overlayMode', interactive ? 'interact' : 'selectModule'); } catch (e) { return false; }
            }
            dbeCanvasStatus(interactive
                ? dbeT('canvasInteractiveOn', 'Interacting with page. Press Escape to select elements.')
                : dbeT('canvasSelectionOn', 'Selecting elements.'));
            if (!interactive) {
                var frame = dbeQuery('previewFrame');
                if (frame) { dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, function () { try { frame.focus(); } catch (e) {} }, 0); }
            }
            return true;
        }

        function dbeCanvasRows() {
            var root = navRootList();
            if (!root) { return []; }
            return [].slice.call(root.querySelectorAll(NAV_ROW_SEL)).filter(function (row) {
                var parent = navParentRow(row);
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
            var label = (row.textContent || '').trim() || dbeT('element', 'Element');
            dbeCanvasStatus(dbeFmt(dbeT('canvasSelected', 'Selected %s'), label));
        }

        function dbeCanvasNavigationKeydown(e) {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) { return; }
            var target = e.target;
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

            var rows = dbeCanvasRows();
            if (!rows.length) { return; }
            var current = navRowById(activeId());
            var i = rows.indexOf(current);
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
                        var child = rows[i + 1];
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
            dbeCommandFrameDocuments.filter(function (record) { return record.doc !== keepDoc; }).forEach(function (record) {
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
            dbeCommandFrameDocuments = dbeCommandFrameDocuments.filter(function (record) { return record.doc === keepDoc; });
            if (dbePreviewFocusState && dbePreviewFocusState.element.ownerDocument !== keepDoc) {
                dbeClearPreviewFocusState();
            }
        }

        function dbeBindKeyboardFrameDocument(frame) {
            var doc;
            try { doc = frame && frame.contentDocument; } catch (e) { return; }
            if (!doc) { return; }
            dbeReleaseCommandFrameDocuments(doc);
            var record = dbeCommandFrameDocuments.filter(function (item) { return item.doc === doc; })[0];
            if (!record) {
                record = { doc: doc, observer: null };
                dbeCommandFrameDocuments.push(record);
            }
            if (on('command_palette')) {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, doc, 'palette-key', 'keydown', dbePaletteKeydown, true);
            }
            if (on('keyboard_shortcuts')) {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, doc, 'canvas-text-editing-key', 'keydown', dbeCanvasTextEditingKeydown, true);
            }
            if (on('keyboard_shortcuts') && !record.observer) {
                record.observer = new MutationObserver(function () {
                    dbeSyncCanvasEditingIndicator(doc);
                });
                record.observer.observe(doc.documentElement, { childList: true, subtree: true });
            }
            if (on('keyboard_shortcuts')) { dbeSyncCanvasEditingIndicator(doc); }
            if (on('navigator_keyboard') || on('keyboard_shortcuts')) {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, doc, 'canvas-navigation-key', 'keydown', dbeCanvasNavigationKeydown);
            }
            if (on('reveal_selected')) {
                // Builderius changes activeModule after its own canvas click
                // handler. Schedule on the next task so the store and selected
                // Navigator row have caught up before revealActiveInTree() reads.
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, doc, 'reveal-selection-click', 'click', function () {
                    dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, function () { schedule('canvas-selection'); }, 0);
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
            var frame = dbeQuery('previewFrame');
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
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, frame, 'canvas-frame-load', 'load', function () {
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
            var col = document.querySelector('.uniTopPanel__rightCol');
            if (!col || col.querySelector('.dbe-palette-btn')) { return; }
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'uniPanelButton dbe-palette-btn';
            var span = document.createElement('span');
            span.innerHTML =
                '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                '<path d="M2.2 3.2l3.2 3.3-3.2 3.3M7.6 10.8h4.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            btn.appendChild(span);
            var tip = dbeFmt(dbeT('paletteTip', 'Command palette (%s)'), dbePaletteAccel());
            setTip(btn, tip);
            btn.setAttribute('aria-label', tip);
            btn.setAttribute('aria-keyshortcuts', dbePaletteAriaShortcut());
            btn.addEventListener('click', function () {
                if (document.querySelector('dialog[open]')) { return; } // a non-modal dialog is up — same guard as the shortcut
                openCommandPalette();
            });
            // After our other mode buttons when present, else first in the column.
            var siblings = col.querySelectorAll('.dbe-theme-btn, .dbe-density-btn');
            var last = siblings.length ? siblings[siblings.length - 1] : null;
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
        function renderChipCard(focusReturn, x, y, items, label) {
            closeChipMenu();
            if (!items || !items.length) { return; }
            var card = document.createElement('div');
            card.className = 'uniBuilderContextMenu dbe-ctx-submenu dbe-chip-menu';
            var inner = document.createElement('div');
            inner.className = 'uniBuilderContextMenu__inner';
            var menu = document.createElement('div');
            menu.className = 'uniContextMenu';
            menu.setAttribute('role', 'menu');
            // A menu needs an accessible name or screen readers announce a bare
            // "menu" with no hint of what it acts on.
            if (label) { menu.setAttribute('aria-label', label); }
            var ul = document.createElement('ul');
            items.forEach(function (item) {
                var li = document.createElement('li');
                li.className = 'uniContextMenu__item' + (item.first ? ' dbe-ctx-item--first' : '');
                li.setAttribute('role', 'menuitem');
                li.tabIndex = -1;
                li.textContent = item.label;
                function act(ev) { ev.preventDefault(); ev.stopPropagation(); closeChipMenu(); item.fn(); }
                // Activate on click, not mousedown: pressing and dragging away must
                // cancel, and a screen reader's simulated click must not double-fire
                // against the keydown path. mousedown only suppresses the focus jump.
                li.addEventListener('mousedown', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
                li.addEventListener('click', act);
                li.addEventListener('keydown', function (ev) {
                    if (ev.key === 'Enter' || ev.key === ' ') { act(ev); }
                });
                ul.appendChild(li);
            });
            menu.appendChild(ul);
            inner.appendChild(menu);
            card.appendChild(inner);

            // Keyboard: arrows move (wrapping), Home/End jump, Escape closes and
            // returns focus to the chip.
            card.addEventListener('keydown', function (ev) {
                var lis = [].slice.call(card.querySelectorAll('li'));
                var idx = lis.indexOf(document.activeElement);
                var next = -1;
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
            renderChipCard(chipLi, x, y, items, dbeFmt(dbeT('chipMenuFor', 'Actions for %s'), name));
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
            renderChipCard(selChip, x, y, items, dbeFmt(dbeT('chipMenuFor', 'Actions for %s'), name));
        }

        /* Chips are plain li>span with no focus support; tabindex lets keyboard
           users reach them and open the copy menu with Shift+F10 / the Menu key. */
        function decorateClassChips() {
            document.querySelectorAll('.uniModuleCssClassesSelect__list li, .uniSystemSelectClasses .uniModuleCssSelectorItemSelected').forEach(function (li) {
                dbeRememberOwnedAttributes(DBE_COMMANDS_OWNER, li, ['tabindex']);
                li.tabIndex = 0;
            });
        }

        function bindChipMenu() {
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'chip-menu-context', 'contextmenu', function (e) {
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
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'chip-menu-' + t, t, function (e) {
                    if (dbeSelCaretBypass) { return; }
                    if (selCaretActions(e)) { e.stopPropagation(); }
                }, true);
            });
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'chip-menu-click', 'click', function (e) {
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
            bindChipMenuDismiss();
        }

        /* Outside dismissal for every renderChipCard menu (chip menus, the
           Navigator empty-area menu): any outside pointer press, scroll or
           Escape closes it. Bound once, shared by whichever features need it. */
        function bindChipMenuDismiss() {
            ['pointerdown', 'wheel'].forEach(function (t) {
                dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'chip-menu-dismiss-' + t, t, function (e) {
                    if (dbeChipMenu && !(e.target.closest && e.target.closest('.dbe-chip-menu'))) { closeChipMenu(); }
                }, true);
            });
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'chip-menu-dismiss-key', 'keydown', function (e) {
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
        var dbeLastRevealedId = null;
        var dbeSelectionContextState = '';

        function dbeSelectionPath(id) {
            var mods = modules() || {};
            var chain = [];
            var seen = {};
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
            var current = document.querySelector('.dbe-canvas-selection-context');
            var wrappers = dbePanelWrappers();
            var id = activeId();
            if (!id || !dbePanelSideHidden('right', wrappers.right)) {
                if (current) { current.remove(); }
                dbeSelectionContextState = '';
                return;
            }

            var path = dbeSelectionPath(id);
            if (!path.length) {
                if (current) { current.remove(); }
                dbeSelectionContextState = '';
                return;
            }
            var fullPath = path.join(' › ');
            var visiblePath = path.length > 4 ? ['…'].concat(path.slice(-3)).join(' › ') : fullPath;
            var nextState = id + '|' + fullPath;
            if (current && dbeSelectionContextState === nextState) { return; }

            var host = document.querySelector('.uniIframePanel__outer');
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
        var RA_MODE = (CFG.rowActions && CFG.rowActions.mode) === 'always' ? 'always' : 'hover';
        var RA_CAN_ANCHOR = !!(window.CSS && CSS.supports && CSS.supports('anchor-name: --a'));
        var raBox = null;          // the cluster (module-level singleton: the same
        var raDup = null;          // node is re-inserted after a re-render, so its
        var raDel = null;          // listeners survive)
        var raId = null;           // target row's module id
        var raStampedRow = null;   // the row node currently carrying class/anchor
        var raHideT = null;
        var raSuppressed = false;  // during a native row drag
        var raScrollQueued = false;
        var raDelArmed = false;    // Delete is two-step: arm, then confirm
        var raDelArmT = null;

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
            var m = (modules() || {})[id];
            var label = (m && (m.label || m.name)) || dbeT('element', 'element');
            var dup = dbeFmt(dbeT('rowActionDuplicate', 'Duplicate “%s”'), label);
            var del = raDelArmed
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
            var r = row.getBoundingClientRect();
            var b = raBox.getBoundingClientRect();
            var w = b.width || 54, h = b.height || 26;
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
            var lastRow = raStampedRow;
            raId = null;
            raUnstamp();
            if (raBox && !raBox.hidden) {
                // Never strand focus in a display:none subtree — hand it back to
                // the tree first.
                if (raBox.contains(document.activeElement)) {
                    var row = (lastRow && lastRow.isConnected && lastRow.offsetParent !== null)
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
            var row = navRowById(id);
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
            var ae = document.activeElement;
            var focusedRow = ae && ae.closest && ae.closest(NAV_ROW_SEL);
            if (focusedRow && focusedRow.offsetParent !== null) { raShow(navRowId(focusedRow)); return; }
            if (RA_MODE === 'always') {
                var sel = activeId();
                var row = sel ? navRowById(sel) : null;
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
                var row = navRowById(raId);
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
            var btn = node.closest && node.closest(NAV_ROW_SEL);
            return !!(btn && raId && navRowId(btn) === raId);
        }

        function raPointerOver(e) {
            var btn = e.target.closest && e.target.closest(NAV_ROW_SEL);
            if (btn) {
                dbeClearOwnedTimeout(DBE_COMMANDS_OWNER, raHideT);
                raHideT = null;
                var id = navRowId(btn);
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
            raHideT = dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, function () {
                raHideT = null;
                raRelease();
            }, 150); // grace for diagonal/subpixel exits
        }

        function raFocusIn(e) {
            var btn = e.target.closest && e.target.closest(NAV_ROW_SEL);
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
            dbeSetOwnedFrame(DBE_COMMANDS_OWNER, function () {
                raScrollQueued = false;
                var row = raId && navRowById(raId);
                if (!row) { return; }
                // Blank the box while the row is outside the scrollport WITHOUT
                // releasing the target (the anchor path gets exactly this from
                // position-visibility) — the row may still hold keyboard focus,
                // and scrolling back brings the cluster with it. Never blank it
                // out from under focus, though: display:none would strand the
                // keyboard user on <body>.
                var sc = row.closest('.uniModTree__container');
                var rr = row.getBoundingClientRect();
                var sr = sc ? sc.getBoundingClientRect() : null;
                var out = !!(sr && (rr.bottom < sr.top || rr.top > sr.bottom));
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
            var row = raId && navRowById(raId);
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
            var id = raId;
            if (!id || raDup.disabled) { return; }
            var before = Object.keys(modules() || {});
            var parent = ((modules() || {})[id] || {}).parent || '';
            raDup.disabled = true;
            driveContextMenuItem(id, 'Duplicate', function (ok) {
                raDup.disabled = false;
                if (!ok) { return; }
                undoToast(dbeT('duplicated', 'Duplicated element'), 'undo');
                // Land focus on the copy: the new id is whatever appeared in the
                // store under the same parent (the dbeRestoreOp diff pattern).
                waitFor(function () {
                    var mods = modules() || {};
                    return Object.keys(mods).find(function (nid) {
                        return before.indexOf(nid) === -1 && (mods[nid].parent || '') === parent;
                    }) || null;
                }, function (newId) {
                    var row = navRowById(newId || id);
                    if (!row) { return; }
                    raFocusRow(row);
                    raShow(navRowId(row));
                });
            });
        }

        function raDelete(e) {
            e.stopPropagation();
            var id = raId;
            var row = id && navRowById(id);
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
                raDelArmT = dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, function () {
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
            var rows = navVisibleRows();
            var i = rows.indexOf(row);
            var li = navRowLi(row);
            var next = rows.slice(i + 1).filter(function (b) { return !li || !li.contains(b); })[0]
                || (i > 0 ? rows[i - 1] : null)
                || navParentRow(row);
            var nextId = next ? navRowId(next) : null;
            raDel.disabled = true;
            driveContextMenuItem(id, 'Remove', function (ok) {
                raDel.disabled = false;
                if (!ok) { return; }
                undoToast(dbeT('deletedElement', 'Deleted element'), 'undo');
                // Move focus off the cluster onto the landing row straight away
                // (its node usually still exists pre-re-render), so raHide has no
                // stranded focus to rescue, then re-assert once the tree settles.
                var landing = nextId && navRowById(nextId);
                if (landing) { try { landing.focus(); } catch (e2) {} }
                raHide();
                if (!nextId) { return; }
                waitFor(function () {
                    var r = navRowById(nextId);
                    return (r && r.offsetParent !== null) ? r : null;
                }, function (r) {
                    if (r) { raFocusRow(r); }
                });
            });
        }

        function ensureRowActions() {
            var container = document.querySelector('.uniRightPanel .uniModTree__container');
            if (!container) { return; }
            var box = raBuild();
            if (box.parentElement !== container) {
                // After the row scroller (the container's unclassed first child) and
                // before the favourites strip: Tab order runs rows → Duplicate →
                // Delete → favourites. position:fixed keeps it out of the layout.
                var scroller = container.firstElementChild;
                container.insertBefore(box, scroller ? scroller.nextElementSibling : null);
            }
            raSync();
            var panel = document.querySelector('.uniRightPanel');
            if (!panel) { return; }
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, panel, 'row-actions-pointerover', 'pointerover', raPointerOver);
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, panel, 'row-actions-pointerout', 'pointerout', raPointerOut);
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, panel, 'row-actions-focusin', 'focusin', raFocusIn);
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, panel, 'row-actions-focusout', 'focusout', raFocusOut);
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, panel, 'row-actions-scroll', 'scroll', raOnScroll, true);
            // A native drag means the row rects are about to churn — get out of the
            // way until it settles. Document-level: dragstart fires on the row <li>.
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'row-actions-dragstart', 'dragstart', function () {
                raSuppressed = true;
                raHide();
            });
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'row-actions-dragend', 'dragend', function () { raSuppressed = false; });
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'row-actions-drop', 'drop', function () { raSuppressed = false; });
            // A REAL context menu on a row supersedes the cluster; our own invisible
            // auto-driven menus (html.dbe-auto-ctx) must not knock it out mid-action.
            dbeBindOwnedHook(DBE_COMMANDS_OWNER, 'builderius.contextMenu.show', 'dbeRowActionsYield', function () {
                if (!document.documentElement.classList.contains('dbe-auto-ctx')) { raHide(); }
            });
        }

        function dbeRememberContextTarget(e) {
            dbeSelectorMenuTarget = e.target.closest && e.target.closest('.uniSelectorsCss__item');
            if (dbeSelectorMenuTarget) { return; }
            var btn = e.target.closest && e.target.closest('.uniModTree__item');
            if (!btn) { return; }
            if (!e.dbePreviewContext) { dbeDiscardPreviewContext(false); }
            var match = btn.className.toString().match(/uni-tree-node-(\w+)/);
            if (!match) { return; }
            setContextTarget(match[1]);
            if (dbeMultiSel.size && !dbeMultiSel.has(contextTarget()) &&
                !document.documentElement.classList.contains('dbe-auto-ctx')) {
                clearMultiSel();
            }
        }

        function dbeNavigatorContextMenuKeydown(e) {
            if (e.key !== 'ContextMenu' && !(e.key === 'F10' && e.shiftKey)) { return; }
            var row = e.target && e.target.closest && e.target.closest('.uniRightPanel .uniModTree__item');
            if (!row || document.querySelector('dialog.uniBuilderContextMenu[open]')) { return; }
            e.preventDefault();
            e.stopPropagation();
            var rect = row.getBoundingClientRect();
            row.dispatchEvent(new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: rect.left + Math.min(rect.width / 2, 48),
                clientY: rect.top + rect.height / 2
            }));
        }

        function dbeObserveCommands() {
            var needMain = on('command_palette') || on('keyboard_shortcuts') || on('navigator_keyboard') ||
                on('reveal_selected') || on('preview_context_menu') || on('context_menu') || NEED_NAV_BUTTONS || on('tree_search') ||
                on('navigator_row_actions');
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
            if (submenuCloseTimer) {
                clearTimeout(submenuCloseTimer);
                submenuCloseTimer = null;
            }
            document.querySelectorAll(
                '.dbe-palette-btn, dialog.dbe-palette, dialog.dbe-shortcuts, dialog.dbe-el-picker, ' +
                '.dbe-canvas-editing-indicator, .dbe-canvas-status, .dbe-save-menu-btn, ' +
                '.dbe-canvas-selection-context, .dbe-collapse-subtrees, .dbe-expand-all, ' +
                '.dbe-tree-search, .dbe-row-actions'
            ).forEach(function (node) { node.remove(); });
            document.querySelectorAll('.dbe-tree-filtered-out, .dbe-tree-dim').forEach(function (row) {
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
            init: function (context) {
                if (!context || !context.builderius) { return; }
                dbeCommandsControllerActive = true;
                if (NEED_CTX_MENU) {
                    dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'context-target', 'contextmenu', dbeRememberContextTarget, true);
                    dbeBindOwnedHook(DBE_COMMANDS_OWNER, 'builderius.contextMenu.show', 'dbeWrapMenu', onContextMenuShow);
                    dbeBindOwnedHook(DBE_COMMANDS_OWNER, 'builderius.contextMenu.hide', 'dbeWrapMenuHide', function () {
                        removeSubmenus();
                        // The dialog's close event restores preview focus after
                        // native top-layer focus handling finishes. Keep a short
                        // fallback for Builderius versions that remove the menu
                        // without dispatching close.
                        if (dbePreviewContextState) {
                            dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, function () {
                                if (dbePreviewContextState) { dbeDiscardPreviewContext(true); }
                            }, 200);
                        }
                    });
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
            refresh: function (reason) {
                if (reason) { dbeRefreshCommands(); }
            },
            destroy: function () {
                destroyCommands();
            }
        }, NEED_CTX_MENU || on('footer_toolbar') || on('preview_context_menu') || on('preview_rename') || on('context_menu') || on('navigator_paste') ||
            on('shortcuts_overlay') || on('keyboard_shortcuts') || on('command_palette') ||
            on('navigator_keyboard') || on('reveal_selected') || on('save_split_button') ||
            NEED_NAV_BUTTONS || on('tree_search') || on('navigator_row_actions'));
        host.setCommandsApi(Object.freeze({
            driveContextMenuItem: driveContextMenuItem,
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
