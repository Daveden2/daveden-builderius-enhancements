(function () {
    'use strict';

    /* Shortcut discovery is a coherent, independently cacheable command
       surface. The commands controller still owns its events and cleanup; this
       chunk supplies the native extension, fallback dialog and `?` binding. */
    const chunks = window.dbeBuilderChunks || {};

    chunks.shortcuts = function (host) {
        const on = host.on;
        const dbeT = host.translate;
        const CFG = host.config;
        const clickSeq = host.click;
        const waitFor = host.waitFor;
        const dbeAccel = host.accelerator;
        const dbeBindOwnedEvent = host.bindOwnedEvent;
        const dbeSetOwnedTimeout = host.setOwnedTimeout;
        const renameActive = host.renameActive;
        const DBE_COMMANDS_OWNER = 'commands';

        function sc(key, options) { return dbeAccel(key, options); }
        function dbePaletteAccel() {
            const choice = (CFG.palette || {}).shortcut || 'mod-k';
            return dbeAccel(choice === 'mod-slash' ? '/' : 'K', {
                cmd: true,
                shift: choice === 'mod-shift-k'
            });
        }

        const nativeShortcutPanel = !!(((CFG.builderius || {}).native || {}).shortcutPanel);
        const SHORTCUT_GROUPS = [
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
            return SHORTCUT_GROUPS.map((group) => {
                return [group[0], group[1].filter((pair) => { return !pair[2]; })];
            }).filter((group) => { return group[1].length; });
        }

        function ensureNativeShortcuts() {
            if (!nativeShortcutPanel) { return; }
            const panel = document.querySelector('.uniTabShortcuts');
            if (!panel || panel.querySelector('.dbe-native-shortcuts-group')) { return; }
            dbeNativeShortcutGroups().forEach((group) => {
                const section = document.createElement('div');
                section.className = 'uniTabShortcuts__group dbe-native-shortcuts-group';
                const title = document.createElement('h4');
                title.className = 'uniTabShortcuts__groupTitle';
                title.textContent = 'DBE · ' + group[0];
                const list = document.createElement('ul');
                list.className = 'uniTabShortcuts__list';
                group[1].forEach((pair) => {
                    const row = document.createElement('li');
                    row.className = 'uniTabShortcuts__row';
                    const label = document.createElement('span');
                    label.textContent = pair[1];
                    const shortcut = document.createElement('span');
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
            const panel = document.querySelector('.uniTabShortcuts');
            if (panel) { ensureNativeShortcuts(); return true; }
            const button = document.querySelector('.tooltipId__footer_shortcuts .uniPanelIconButton--footer');
            if (!button) { return false; }
            clickSeq(button);
            waitFor(() => { return document.querySelector('.uniTabShortcuts'); }, ensureNativeShortcuts);
            return true;
        }

        let dbeShortcutFocusReturn = null;
        function openShortcutsDialog() {
            if (nativeShortcutPanel && dbeOpenNativeShortcuts()) { return; }
            let dlg = document.querySelector('dialog.dbe-shortcuts');
            if (!dlg) {
                dlg = document.createElement('dialog');
                dlg.className = 'dbe-shortcuts';
                dlg.setAttribute('aria-label', dbeT('keyboardShortcuts', 'Keyboard shortcuts'));
                const head = document.createElement('div');
                head.className = 'dbe-shortcuts__head';
                const title = document.createElement('h2');
                title.className = 'dbe-shortcuts__title';
                title.textContent = dbeT('keyboardShortcuts', 'Keyboard shortcuts');
                const close = document.createElement('button');
                close.type = 'button';
                close.className = 'dbe-shortcuts__close';
                close.setAttribute('aria-label', dbeT('close', 'Close'));
                close.textContent = '✕';
                close.addEventListener('click', () => { dlg.close(); });
                head.appendChild(title);
                head.appendChild(close);
                dlg.appendChild(head);
                const table = document.createElement('table');
                SHORTCUT_GROUPS.forEach((group) => {
                    const th = document.createElement('tr');
                    const thCell = document.createElement('th');
                    thCell.colSpan = 2;
                    thCell.textContent = group[0];
                    th.appendChild(thCell);
                    table.appendChild(th);
                    group[1].forEach((pair) => {
                        const tr = document.createElement('tr');
                        const kd = document.createElement('td');
                        pair[0].split(' · ').forEach((combo, index) => {
                            if (index) { kd.appendChild(document.createTextNode(' ')); }
                            const kbd = document.createElement('kbd');
                            kbd.textContent = combo;
                            kd.appendChild(kbd);
                        });
                        const description = document.createElement('td');
                        description.textContent = pair[1];
                        tr.appendChild(kd);
                        tr.appendChild(description);
                        table.appendChild(tr);
                    });
                });
                dlg.appendChild(table);
                dlg.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        dlg.close();
                    }
                    event.stopPropagation();
                });
                dlg.addEventListener('close', () => {
                    const target = dbeShortcutFocusReturn;
                    dbeShortcutFocusReturn = null;
                    if (target && target.isConnected && typeof target.focus === 'function') {
                        dbeSetOwnedTimeout(DBE_COMMANDS_OWNER, () => { target.focus(); }, 0);
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
            dbeBindOwnedEvent(DBE_COMMANDS_OWNER, document, 'shortcut-help-key', 'keydown', (event) => {
                if (event.key !== '?') { return; }
                if (renameActive()) { return; }
                const target = event.target;
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
