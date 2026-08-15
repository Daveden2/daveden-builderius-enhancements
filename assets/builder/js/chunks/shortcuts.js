(function () {
    'use strict';

    /* Shortcut discovery is a coherent, independently cacheable command
       surface. The commands controller still owns its events and cleanup; this
       chunk supplies the native extension, fallback dialog and `?` binding. */
    var chunks = window.dbeBuilderChunks || {};

    chunks.shortcuts = function (host) {
        var on = host.on;
        var dbeT = host.translate;
        var CFG = host.config;
        var clickSeq = host.click;
        var waitFor = host.waitFor;
        var dbeAccel = host.accelerator;
        var dbeBindOwnedEvent = host.bindOwnedEvent;
        var dbeSetOwnedTimeout = host.setOwnedTimeout;
        var renameActive = host.renameActive;
        var DBE_COMMANDS_OWNER = 'commands';

        function sc(key, options) { return dbeAccel(key, options); }
        function dbePaletteAccel() {
            var choice = (CFG.palette || {}).shortcut || 'mod-k';
            return dbeAccel(choice === 'mod-slash' ? '/' : 'K', {
                cmd: true,
                shift: choice === 'mod-shift-k'
            });
        }

        var nativeShortcutPanel = !!(((CFG.builderius || {}).native || {}).shortcutPanel);
        var SHORTCUT_GROUPS = [
            [dbeT('scGroupGeneral', 'General'), [
                ['?', dbeT('scOpenOverlay', 'Open keyboard shortcuts')],
                ['Esc', on('multi_select') ?
                    dbeT('scEscape', 'Close menus and dialogs; clear the multi-selection') :
                    dbeT('scEscapeClose', 'Close menus and dialogs')],
                ['Delete', dbeT('scDelete', 'Remove the selected element (Builderius)'), true],
                [sc('C', { cmd: true }) + ' · ' + sc('V', { cmd: true }), dbeT('scCopyPaste', 'Copy / paste the selected element (Builderius)'), true]
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
                    [sc('Z', { cmd: true }), dbeT('scUndo', 'Undo the last element change'), true],
                    [sc('Z', { cmd: true, shift: true }), dbeT('scRedo', 'Redo the element change'), true]
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
                [sc('D', { cmd: true, shift: true }), dbeT('scDuplicate', 'Duplicate'), true],
                [sc('X', { cmd: true }), dbeT('scCut', 'Cut'), true],
                [sc('T', { cmd: true, alt: true }), dbeT('scAddBefore', 'Add an element before')],
                [sc('Y', { cmd: true, alt: true }), dbeT('scAddAfter', 'Add an element after')],
                ['F2', dbeT('scRename', 'Rename'), true],
                ['Esc', dbeT('scFinishCanvasText', 'Finish editing text in the canvas')],
                [sc('C', { cmd: true }) + ' · ' + sc('V', { cmd: true }) + ' · Delete', dbeT('scCopyPasteDelete', 'Copy / paste / delete the element (Builderius)'), true]
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

        function dbeNativeShortcutGroups() {
            return SHORTCUT_GROUPS.map(function (group) {
                return [group[0], group[1].filter(function (pair) { return !pair[2]; })];
            }).filter(function (group) { return group[1].length; });
        }

        function ensureNativeShortcuts() {
            if (!nativeShortcutPanel) { return; }
            var panel = document.querySelector('.uniTabShortcuts');
            if (!panel || panel.querySelector('.dbe-native-shortcuts-group')) { return; }
            dbeNativeShortcutGroups().forEach(function (group) {
                var section = document.createElement('div');
                section.className = 'uniTabShortcuts__group dbe-native-shortcuts-group';
                var title = document.createElement('h4');
                title.className = 'uniTabShortcuts__groupTitle';
                title.textContent = 'DBE · ' + group[0];
                var list = document.createElement('ul');
                list.className = 'uniTabShortcuts__list';
                group[1].forEach(function (pair) {
                    var row = document.createElement('li');
                    row.className = 'uniTabShortcuts__row';
                    var label = document.createElement('span');
                    label.textContent = pair[1];
                    var shortcut = document.createElement('span');
                    shortcut.className = 'uniContextMenu__shortcut';
                    shortcut.textContent = pair[0];
                    row.appendChild(label);
                    row.appendChild(shortcut);
                    list.appendChild(row);
                });
                section.appendChild(title);
                section.appendChild(list);
                panel.appendChild(section);
            });
        }

        function dbeOpenNativeShortcuts() {
            var panel = document.querySelector('.uniTabShortcuts');
            if (panel) { ensureNativeShortcuts(); return true; }
            var button = document.querySelector('.tooltipId__footer_shortcuts .uniPanelIconButton--footer');
            if (!button) { return false; }
            clickSeq(button);
            waitFor(function () { return document.querySelector('.uniTabShortcuts'); }, ensureNativeShortcuts);
            return true;
        }

        var dbeShortcutFocusReturn = null;
        function openShortcutsDialog() {
            if (nativeShortcutPanel && dbeOpenNativeShortcuts()) { return; }
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
                        pair[0].split(' · ').forEach(function (combo, index) {
                            if (index) { kd.appendChild(document.createTextNode(' ')); }
                            var kbd = document.createElement('kbd');
                            kbd.textContent = combo;
                            kd.appendChild(kbd);
                        });
                        var description = document.createElement('td');
                        description.textContent = pair[1];
                        tr.appendChild(kd);
                        tr.appendChild(description);
                        table.appendChild(tr);
                    });
                });
                dlg.appendChild(table);
                dlg.addEventListener('keydown', function (event) {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        dlg.close();
                    }
                    event.stopPropagation();
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
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'shortcut-help-key', 'keydown', function (event) {
                if (event.key !== '?') { return; }
                if (renameActive()) { return; }
                var target = event.target;
                if (target && target.closest && target.closest('input, textarea, [contenteditable="true"], .monaco-editor')) { return; }
                if (document.querySelector('dialog[open]')) { return; }
                event.preventDefault();
                event.stopPropagation();
                openShortcutsDialog();
            }, true);
        }

        host.setShortcutsApi(Object.freeze({
            ensure: ensureNativeShortcuts,
            open: openShortcutsDialog,
            bind: bindShortcutsKey
        }));
    };

    window.dbeBuilderChunks = chunks;
})();
