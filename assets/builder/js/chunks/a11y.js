(function () {
    'use strict';

    /* Accessibility controllers are registered by builder.js after its shared
       host services exist. Loading this file first keeps dependency order
       explicit without making the chunk boot the application independently. */
    const chunks = window.dbeBuilderChunks || {};

    chunks.a11y = function (host) {
        let records = [];

        function rememberAttributes(element, attributes) {
            let record = records.filter((item) => { return item.node === element; })[0];
            if (!record) {
                record = { node: element, attributes: {} };
                records.push(record);
            }
            attributes.forEach((name) => {
                if (Object.prototype.hasOwnProperty.call(record.attributes, name)) { return; }
                record.attributes[name] = element.hasAttribute(name) ? element.getAttribute(name) : null;
            });
        }

        /* Tooltip labelling is still a shared host service because workspace
           and command controls consume it. Give that service this controller's
           reversible attribute recorder before any controller initialises. */
        host.setAttributeRecorder(rememberAttributes);

        function ensureChromeLandmarks() {
            function stamp(element, label, shortcutKey) {
                if (!element || !label) { return; }
                rememberAttributes(element, ['role', 'aria-label', 'aria-keyshortcuts']);
                if (element.getAttribute('role') !== 'region') { element.setAttribute('role', 'region'); }
                if (element.getAttribute('aria-label') !== label) { element.setAttribute('aria-label', label); }
                const shortcut = host.on('keyboard_shortcuts') && shortcutKey
                    ? host.areaAriaShortcut(shortcutKey)
                    : '';
                if (shortcut && element.getAttribute('aria-keyshortcuts') !== shortcut) {
                    element.setAttribute('aria-keyshortcuts', shortcut);
                } else if (!shortcut && element.hasAttribute('aria-keyshortcuts')) {
                    element.removeAttribute('aria-keyshortcuts');
                }
            }

            stamp(host.query('topPanel'), host.translate('regionTopBar', 'Top toolbar'));
            const left = host.query('leftPanelOuter') || host.query('leftPanel');
            if (left) {
                const isInserter = !!left.querySelector('.uniModList');
                stamp(
                    left,
                    isInserter
                        ? host.translate('regionInserter', 'Element library')
                        : host.translate('regionSettings', 'Element settings'),
                    isInserter ? 'L' : 'E'
                );
            }
            stamp(host.query('canvasPanel'), host.translate('regionCanvas', 'Canvas'), 'P');
            const iframe = host.query('previewFrame');
            const iframeTitle = host.translate('canvasPreview', 'Canvas preview');
            if (iframe) {
                rememberAttributes(iframe, ['title']);
                if (iframe.getAttribute('title') !== iframeTitle) { iframe.setAttribute('title', iframeTitle); }
            }
            stamp(host.query('navigatorPanel'), host.translate('regionNavigator', 'Navigator'), 'O');
            stamp(host.query('footerPanel'), host.translate('regionFooter', 'Footer bar'), 'B');
        }

        function observeChrome() {
            const main = host.query('mainPanel');
            if (main) {
                host.observe('a11y-chrome-main', main, {
                    childList: true,
                    subtree: true,
                    characterData: host.on('tooltips'),
                    attributes: true,
                    attributeFilter: ['class', 'style']
                });
            }
            const top = host.query('topPanel');
            if (top) { host.observe('a11y-chrome-top', top, { childList: true, subtree: true }); }
            const footer = host.query('footerPanel');
            if (footer && host.on('tooltips')) {
                host.observe('a11y-chrome-footer', footer, { childList: true, subtree: true });
            }
        }

        function destroyChrome() {
            host.observe('a11y-chrome-main', null);
            host.observe('a11y-chrome-top', null);
            host.observe('a11y-chrome-footer', null);
            host.unbindTooltips();
            records.forEach((record) => {
                Object.keys(record.attributes).forEach((name) => {
                    const value = record.attributes[name];
                    if (value === null) { record.node.removeAttribute(name); }
                    else { record.node.setAttribute(name, value); }
                });
            });
            records = [];
        }

        host.controllers.register('a11y/chrome', {
            init (context) {
                if (!context || !context.builderius) { return; }
                observeChrome();
                if (host.on('chrome_landmarks')) { ensureChromeLandmarks(); }
                if (host.on('tooltips')) {
                    host.bindTooltips();
                    host.labelChromeIcons();
                }
            },
            refresh (reason) {
                if (!reason) { return; }
                observeChrome();
                if (host.on('chrome_landmarks')) { ensureChromeLandmarks(); }
                if (host.on('tooltips')) { host.labelChromeIcons(); }
            },
            destroy () {
                destroyChrome();
            }
        }, host.on('chrome_landmarks') || host.on('tooltips'));
    };

    window.dbeBuilderChunks = chunks;
})();
