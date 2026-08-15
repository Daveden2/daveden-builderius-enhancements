(function () {
    'use strict';

    const chunks = window.dbeBuilderChunks || {};

    chunks.integrations = function (host) {
        const on = host.on;
        const CFG = host.config || {};
        const dbeT = host.translate;
        const dbeQuery = host.query;
        const dbeControllers = host.controllers;
        const dbeObserveChrome = host.observe;
        const dbeObserveFooter = host.observeFooter;
        const dbeUnobserveFooter = host.unobserveFooter;
        const dbeEnsureGroup = host.ensureGroup;
        const dbeRememberOwnedAttributes = host.rememberOwnedAttributes;
        const dbeBindOwnedEvent = host.bindOwnedEvent;
        const dbeUnbindOwnedEvent = host.unbindOwnedEvent;
        const dbeSetOwnedTimeout = host.setOwnedTimeout;
        const dbeSetOwnedInterval = host.setOwnedInterval;
        const dbeDestroyOwnedActivity = host.destroyOwnedActivity;
        const dbeDestroyOwnedGroups = host.destroyOwnedGroups;
        const dbeHasUnsavedChanges = host.editing.hasUnsavedChanges;

        /* Sense AI terminal tabs. When a remote agent (Claude Code, Gemini
           CLI…) is connected, the panel shows a strip of session tabs above
           the terminal. Retrofit the strip as an APG tablist, the new-session
           control as a menu button and the terminal frame with an explicit
           keyboard escape route. */
        const DBE_TERMINAL_OWNER = 'integrations/terminal';
        let dbeTermAiNode = null;
        let dbeTerminalControllerActive = false;
        let dbeTerminalFooterAttempts = 0;
        let dbeTerminalFrameDocuments = [];
        let dbeTerminalEscapeHintNode = null;
        let dbeTerminalEscapeHintOwned = false;

        function dbeObserveTerminalBar() {
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
            dbeObserveChrome('integrations-terminal-panel', ai, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
        }

        const DBE_AI_MENU_ID = 'dbe-ai-agent-menu';
        let dbeAgentMenuWasOpen = false;

        function dbeAgentMenuItems() {
            const menu = document.querySelector('.uniAiChat__agentPicker');
            return menu ? [].slice.call(menu.querySelectorAll('.uniAiChat__agentPickerItem')).filter((element) => {
                return element.offsetParent !== null;
            }) : [];
        }

        function dbeCloseAgentMenu(add) {
            if (document.querySelector('.uniAiChat__agentPicker') && add) {
                try { add.click(); } catch (e) {}
            }
            if (add) { add.focus(); }
        }

        function dbeEnsureAgentPicker(add) {
            if (!add) { return; }
            dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, add, ['aria-haspopup', 'aria-expanded', 'aria-controls']);
            if (add.getAttribute('aria-haspopup') !== 'menu') { add.setAttribute('aria-haspopup', 'menu'); }
            const menu = document.querySelector('.uniAiChat__agentPicker');
            const open = !!menu;
            if (add.getAttribute('aria-expanded') !== String(open)) { add.setAttribute('aria-expanded', String(open)); }
            if (open) {
                dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, menu, ['id', 'role', 'aria-label']);
                if (!menu.id) { menu.id = DBE_AI_MENU_ID; }
                if (add.getAttribute('aria-controls') !== menu.id) { add.setAttribute('aria-controls', menu.id); }
                if (menu.getAttribute('role') !== 'menu') { menu.setAttribute('role', 'menu'); }
                if (!menu.getAttribute('aria-label')) { menu.setAttribute('aria-label', dbeT('terminalAgentMenu', 'Choose an agent')); }
                [].slice.call(menu.querySelectorAll('.uniAiChat__agentPickerItem')).forEach((item) => {
                    dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, item, ['role', 'tabindex']);
                    if (item.getAttribute('role') !== 'menuitem') { item.setAttribute('role', 'menuitem'); }
                    if (item.getAttribute('tabindex') !== '-1') { item.setAttribute('tabindex', '-1'); }
                });
                if (!dbeAgentMenuWasOpen && document.activeElement === add) {
                    const first = dbeAgentMenuItems()[0];
                    if (first) { first.focus(); }
                }
            } else if (add.getAttribute('aria-controls')) {
                add.removeAttribute('aria-controls');
            }
            dbeAgentMenuWasOpen = open;
        }

        function dbeBindAgentPickerKeys() {
            dbeBindOwnedEvent(DBE_TERMINAL_OWNER, document, 'terminal-agent-picker-keys', 'keydown', (event) => {
                const addButton = event.target && event.target.closest ? event.target.closest('.uniAiChat__terminalAddTabBtn') : null;
                if (addButton) {
                    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') { return; }
                    event.preventDefault();
                    const last = event.key === 'ArrowUp';
                    if (!document.querySelector('.uniAiChat__agentPicker')) {
                        try { addButton.click(); } catch (error) {}
                    }
                    let tries = 0;
                    (function focusItem() {
                        if (!dbeTerminalControllerActive) { return; }
                        const options = dbeAgentMenuItems();
                        if (options.length) { (last ? options[options.length - 1] : options[0]).focus(); }
                        else if (tries++ < 10) { dbeSetOwnedTimeout(DBE_TERMINAL_OWNER, focusItem, 20); }
                    })();
                    return;
                }
                const inMenu = event.target && event.target.closest ? event.target.closest('.uniAiChat__agentPicker') : null;
                if (!inMenu) { return; }
                const items = dbeAgentMenuItems();
                if (!items.length) { return; }
                const add = document.querySelector('.uniAiChat__terminalAddTabBtn');
                const index = items.indexOf(document.activeElement);
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    items[index < 0 ? 0 : (index + 1) % items.length].focus();
                } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    items[index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length].focus();
                } else if (event.key === 'Home') {
                    event.preventDefault();
                    items[0].focus();
                } else if (event.key === 'End') {
                    event.preventDefault();
                    items[items.length - 1].focus();
                } else if (event.key === 'Escape' || event.key === 'Tab') {
                    event.preventDefault();
                    dbeCloseAgentMenu(add);
                }
            });
        }

        const DBE_AI_PANEL_ID = 'dbe-ai-terminal-panel';
        const DBE_AI_ESCAPE_HINT_ID = 'dbe-ai-terminal-escape-hint';

        function dbeTerminalEscapeHint() {
            let hint = document.getElementById(DBE_AI_ESCAPE_HINT_ID);
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

        function dbeTerminalEscapeKeydown(event) {
            if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.code !== 'Backquote') { return; }
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            const tab = document.querySelector('.uniAiChat__terminalTab--active') || document.querySelector('.uniAiChat__terminalTab');
            const panel = document.querySelector('.uniAiChat__terminalFrameWrap');
            const target = tab || panel;
            if (target) {
                try { target.focus(); } catch (error) {}
            }
        }

        function dbePruneTerminalFrameDocuments() {
            dbeTerminalFrameDocuments = dbeTerminalFrameDocuments.filter((record) => {
                if (record.frame.isConnected) { return true; }
                dbeUnbindOwnedEvent(DBE_TERMINAL_OWNER, record.doc, 'terminal-escape-keys');
                return false;
            });
        }

        function dbeBindTerminalEscape(frame) {
            if (!frame) { return; }
            let doc;
            try { doc = frame.contentDocument; } catch (e) { doc = null; }
            let record = dbeTerminalFrameDocuments.filter((item) => { return item.frame === frame; })[0];
            if (record && record.doc !== doc) {
                dbeUnbindOwnedEvent(DBE_TERMINAL_OWNER, record.doc, 'terminal-escape-keys');
                dbeTerminalFrameDocuments = dbeTerminalFrameDocuments.filter((item) => { return item !== record; });
                record = null;
            }
            if (doc && !record) {
                dbeBindOwnedEvent(DBE_TERMINAL_OWNER, doc, 'terminal-escape-keys', 'keydown', dbeTerminalEscapeKeydown, true);
                dbeTerminalFrameDocuments.push({ frame, doc });
                const hint = dbeTerminalEscapeHint();
                dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, frame, ['aria-describedby']);
                if (frame.getAttribute('aria-describedby') !== hint.id) { frame.setAttribute('aria-describedby', hint.id); }
            }
            dbeBindOwnedEvent(DBE_TERMINAL_OWNER, frame, 'terminal-frame-load', 'load', () => {
                if (dbeTerminalControllerActive) { dbeBindTerminalEscape(frame); }
            });
        }

        function ensureTerminalEscapeKeys() {
            dbePruneTerminalFrameDocuments();
            document.querySelectorAll('.uniAiChat__terminalFrame').forEach(dbeBindTerminalEscape);
        }

        function ensureTerminalTabs() {
            const list = document.querySelector('.uniAiChat__terminalTabList');
            if (!list) { return; }
            const panel = document.querySelector('.uniAiChat__terminalFrameWrap');
            if (panel) {
                dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, panel, ['id', 'role', 'tabindex', 'aria-labelledby']);
                if (!panel.id) { panel.id = DBE_AI_PANEL_ID; }
                if (panel.getAttribute('role') !== 'tabpanel') { panel.setAttribute('role', 'tabpanel'); }
                if (panel.getAttribute('tabindex') !== '0') { panel.setAttribute('tabindex', '0'); }
            }
            ensureTerminalEscapeKeys();
            let active = null;
            [].slice.call(list.querySelectorAll('.uniAiChat__terminalTab')).forEach((tab, index) => {
                dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, tab, ['id', 'aria-controls']);
                if (!tab.id) { tab.id = 'dbe-ai-terminal-tab-' + index; }
                if (panel && tab.getAttribute('aria-controls') !== panel.id) { tab.setAttribute('aria-controls', panel.id); }
                if (tab.classList.contains('uniAiChat__terminalTab--active')) { active = tab; }
            });
            if (panel && active && panel.getAttribute('aria-labelledby') !== active.id) {
                panel.setAttribute('aria-labelledby', active.id);
            }
            const add = list.querySelector('.uniAiChat__terminalAddTabBtn');
            if (add) {
                dbeRememberOwnedAttributes(DBE_TERMINAL_OWNER, add, ['aria-label']);
                const label = dbeT('terminalNewTab', 'New chat session');
                if (add.getAttribute('aria-label') !== label) { add.setAttribute('aria-label', label); }
            }
            dbeEnsureAgentPicker(add);
            dbeBindAgentPickerKeys();
            dbeEnsureGroup(list, dbeT('terminalTablist', 'AI chat sessions'), '.uniAiChat__terminalTab', {
                role: 'tablist',
                itemRole: 'tab',
                selectAttr: 'aria-selected',
                selectOnMove: true,
                activeClass: 'uniAiChat__terminalTab--active',
                owner: DBE_TERMINAL_OWNER
            });
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
            dbeSetOwnedTimeout(DBE_TERMINAL_OWNER, () => {
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

        function registerTerminalIntegration() {
            dbeControllers.register(DBE_TERMINAL_OWNER, {
                init (context) {
                    if (!context || !context.builderius) { return; }
                    dbeTerminalControllerActive = true;
                    dbeBindAgentPickerKeys();
                    dbeRefreshTerminalIntegration();
                    dbeRetryTerminalFooter();
                },
                refresh (reason) {
                    if (reason) { dbeRefreshTerminalIntegration(); }
                },
                destroy () {
                    destroyTerminalIntegration();
                }
            }, on('ai_terminal_tabs'));
        }

        /* Presence has two audiences: the front-end admin-bar guard reads a
           local heartbeat before opening a second builder tab, while server-side
           agent abilities read the REST heartbeat before committing changes. */
        const DBE_PRESENCE_OWNER = 'integrations/presence';
        let dbePresenceActive = false;
        let dbePresenceHeartbeat = null;
        let dbePresenceServer = null;
        let dbePresenceTabId = '';
        let dbePresenceServerLastDirty = null;
        let dbePresenceServerLastSent = 0;
        let dbePresenceDirtyChanged = function () {};

        function dbePresenceLocalRecords() {
            let records = {};
            if (!dbePresenceHeartbeat) { return records; }
            const key = dbePresenceHeartbeat.key || 'dbeBuilderiusOpen';
            const staleAfter = dbePresenceHeartbeat.staleAfter || 8000;
            let stored = null;
            try { stored = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
            if (stored && stored.tabs && typeof stored.tabs === 'object' && !Array.isArray(stored.tabs)) {
                records = stored.tabs;
            } else if (stored && typeof stored.t === 'number') {
                records.legacy = { t: stored.t, title: stored.title || '' };
            }
            Object.keys(records).forEach((id) => {
                const record = records[id];
                if (!record || typeof record.t !== 'number' || (Date.now() - record.t) > staleAfter) {
                    delete records[id];
                }
            });
            return records;
        }

        function dbePresenceCreateTabId() {
            let id;
            try {
                const records = dbePresenceLocalRecords();
                id = sessionStorage.getItem('dbeBuilderiusTabId') || '';
                if (id && records[id]) { id = ''; }
                if (!id) {
                    const random = new Uint32Array(4);
                    crypto.getRandomValues(random);
                    id = 'tab-' + [].map.call(random, (number) => {
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
            const key = dbePresenceHeartbeat.key || 'dbeBuilderiusOpen';
            const records = dbePresenceLocalRecords();
            records[dbePresenceTabId] = { t: Date.now(), title: document.title };
            try { localStorage.setItem(key, JSON.stringify({ version: 2, tabs: records })); } catch (e) {}
        }

        function dbePresenceClearLocalBeat() {
            if (!dbePresenceHeartbeat || !dbePresenceTabId) { return; }
            const key = dbePresenceHeartbeat.key || 'dbeBuilderiusOpen';
            const records = dbePresenceLocalRecords();
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
            const server = dbePresenceServer || {};
            const slug = dbePresenceSlug();
            if (!server.url || !server.nonce || !slug || !dbePresenceTabId) { return; }
            const dirty = clear ? false : (typeof knownDirty === 'boolean' ? knownDirty : dbePresenceDirty());
            const now = Date.now();
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
                    body: JSON.stringify({ entity: slug, tab: dbePresenceTabId, dirty })
                }).catch(() => {});
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
            dbeSetOwnedInterval(DBE_PRESENCE_OWNER, dbePresenceWriteLocalBeat, dbePresenceHeartbeat.interval || 2500);

            if (dbePresenceServer.url && dbePresenceServer.nonce) {
                dbePresenceDirtyChanged = function (dirty) {
                    dbePresenceSendServerBeat(false, false, dirty);
                };
                dbePresenceSendServerBeat(true);
                dbeSetOwnedInterval(DBE_PRESENCE_OWNER, () => {
                    if (dbePresenceServerLastDirty === true) {
                        dbePresenceSendServerBeat(true, false, true);
                    }
                }, dbePresenceServer.interval || 20000);
                if (!on('save_state_cue')) {
                    dbeSetOwnedInterval(DBE_PRESENCE_OWNER, () => {
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

        function registerPresenceIntegration() {
            dbeControllers.register(DBE_PRESENCE_OWNER, {
                init (context) {
                    if (!context || !context.builderius) { return; }
                    dbePresenceInit();
                },
                refresh () {},
                destroy () {
                    dbePresenceDestroy();
                }
            }, on('presence_heartbeat'));
        }

        host.setIntegrationsApi(Object.freeze({
            registerTerminal: registerTerminalIntegration,
            registerPresence: registerPresenceIntegration,
            presenceDirtyChanged (dirty) {
                return dbePresenceDirtyChanged(dirty);
            }
        }));
    };
})();
