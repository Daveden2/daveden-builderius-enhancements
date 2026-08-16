(function () {
    'use strict';

    /* Shared infrastructure for the Builderius enhancement controllers. Keep
       this file small and dependency-free: it loads immediately before
       builder.js and exposes one factory, which builder.js captures once. */

    const DBE_BUILDERIUS_ADAPTERS = {
        '1.3': {
            testedVersion: '1.3.6-beta',
            bridgeGlobal: 'dbeBuilderiusStoreFns',
            storeGlobal: '__builderiusStoreFns',
            selectors: {
                mainPanel: '.uniMainPanel',
                topPanel: '.uniTopPanel',
                leftPanel: '.uniLeftPanel',
                leftPanelOuter: '.uniLeftPanelOuter',
                navigatorPanel: '.uniRightPanel',
                navigatorRows: '.uniRightPanel .uniModTree__item',
                navigatorTree: '.uniRightPanel .uniModTree .uniModTree__list',
                navigatorFirstRow: '.uniRightPanel .uniModTree__list button.uniModTree__item',
                navigatorRowPrefix: '.uniRightPanel .uni-tree-node-',
                canvasPanel: '.uniIframePanel',
                canvasOuter: '.uniIframePanel__outer',
                canvasInner: '.uniIframePanel__inner',
                previewFrame: '#builderInner',
                footerPanel: '.uniFooterPanel',
                footerBar: '.uniFooterPanelBar',
                saveButton: '.uniTopPanel .uniPanelButtonPrimary.saveBtn'
            }
        }
    };

    function createTranslations(config) {
        const strings = config.i18n || {};

        function translate(key, fallback) { return strings[key] || fallback; }
        function format(value) {
            const args = [].slice.call(arguments, 1);
            let index = 0;
            return String(value).replace(/%(\d+\$)?s/g, (match, position) => {
                return String(position ? args[parseInt(position, 10) - 1] : args[index++]);
            });
        }
        function plural(count, keyOne, fallbackOne, keyMany, fallbackMany) {
            return count === 1 ? translate(keyOne, fallbackOne) : translate(keyMany, fallbackMany);
        }

        return Object.freeze({
            translate,
            format,
            plural
        });
    }

    function createBuilderiusAdapter(config) {
        const version = String((config.builderius && config.builderius.version) || '');
        const versionMatch = version.match(/^(\d+\.\d+)/);
        const family = versionMatch ? versionMatch[1] : '';
        const compatible = !!DBE_BUILDERIUS_ADAPTERS[family];
        const key = compatible ? family : '1.3';
        const definition = DBE_BUILDERIUS_ADAPTERS[key];
        const tested = version === definition.testedVersion;
        let storeReference = null;
        const root = document.documentElement;

        function captureStore(reference) {
            if (!reference || typeof reference.storeGet !== 'function' || typeof reference.storeSet !== 'function') {
                return false;
            }
            storeReference = reference;
            root.dataset.dbeBuilderiusStore = 'captured';
            return true;
        }
        captureStore(window[definition.bridgeGlobal] || window[definition.storeGlobal]);

        function selector(name) { return definition.selectors[name] || ''; }
        function query(name, queryRoot) {
            const value = selector(name);
            return value ? (queryRoot || document).querySelector(value) : null;
        }
        function queryAll(name, queryRoot) {
            const value = selector(name);
            return value ? (queryRoot || document).querySelectorAll(value) : [];
        }
        function navigatorRow(id) {
            return id ? document.querySelector(selector('navigatorRowPrefix') + id) : null;
        }
        function store() {
            if (!storeReference) {
                captureStore(window[definition.bridgeGlobal] || window[definition.storeGlobal]);
            }
            return storeReference;
        }
        function modules() {
            try { return store().storeGet('modules'); } catch (error) { return null; }
        }
        function activeId() {
            try { return store().storeGet('activeModule'); } catch (error) { return null; }
        }

        /* Builderius removes its temporary globals after start-up. Keep support
           diagnostics on the document root, where they remain inspectable. */
        root.dataset.dbeBuilderiusAdapter = key;
        root.dataset.dbeBuilderiusVersion = version || 'unknown';
        root.dataset.dbeBuilderiusTestedVersion = definition.testedVersion;
        root.dataset.dbeBuilderiusCompatible = String(compatible);
        root.dataset.dbeBuilderiusTested = String(tested);
        root.dataset.dbeBuilderiusStore = storeReference ? 'captured' : 'missing';

        if (version && !tested && window.console && console.warn) {
            console.warn('[DBE] Builderius ' + version + ' is using the ' + key +
                ' compatibility adapter tested against ' + definition.testedVersion + '. Re-audit the adapter contract.');
        }

        return Object.freeze({
            key,
            testedVersion: definition.testedVersion,
            selector,
            query,
            queryAll,
            navigatorRow,
            store,
            modules,
            activeId
        });
    }

    function createScheduler(refresh) {
        let frame = 0;

        function schedule() {
            if (frame) { return; }
            frame = requestAnimationFrame(() => {
                frame = 0;
                refresh();
            });
        }
        schedule.cancel = function () {
            if (!frame) { return; }
            cancelAnimationFrame(frame);
            frame = 0;
        };

        return schedule;
    }

    function createMutationRouter(refresh) {
        let observer = null;
        let observations = {};

        function mergeOptions(target, source) {
            const targetHasUnfilteredAttributes = target.attributes && !target.attributeFilter;
            ['childList', 'subtree', 'characterData', 'attributes', 'characterDataOldValue', 'attributeOldValue'].forEach((name) => {
                if (source[name]) { target[name] = true; }
            });
            if (source.attributes) {
                if (!source.attributeFilter || targetHasUnfilteredAttributes) {
                    delete target.attributeFilter;
                } else {
                    target.attributeFilter = (target.attributeFilter || []).concat(source.attributeFilter).filter((name, index, values) => {
                        return values.indexOf(name) === index;
                    });
                }
            }
            return target;
        }
        function mergedObservations() {
            const merged = [];
            Object.keys(observations).forEach((key) => {
                const observation = observations[key];
                const existing = merged.filter((item) => { return item.node === observation.node; })[0];
                if (existing) { mergeOptions(existing.options, observation.options); }
                else { merged.push({ node: observation.node, options: mergeOptions({}, observation.options) }); }
            });
            return merged;
        }
        function rebuild() {
            if (!window.MutationObserver) { return; }
            if (!observer) { observer = new MutationObserver(refresh); }
            else { observer.disconnect(); }
            const merged = mergedObservations();
            merged.forEach((observation) => {
                try { observer.observe(observation.node, observation.options); } catch (error) {}
            });
            document.documentElement.dataset.dbeObserverRoots = String(merged.length);
        }
        function observe(key, node, options) {
            const current = observations[key];
            if (!node) {
                if (!current) { return; }
                delete observations[key];
                rebuild();
                return;
            }
            if (current && current.node === node) { return; }
            observations[key] = { node, options };
            rebuild();
        }
        function disconnect() {
            observations = {};
            if (observer) { observer.disconnect(); }
            observer = null;
            document.documentElement.dataset.dbeObserverRoots = '0';
        }

        return Object.freeze({
            observe,
            disconnect
        });
    }

    function createControllerRegistry(context) {
        const controllers = [];
        let running = false;
        let pagehideBound = false;
        const root = document.documentElement;

        function reportError(item, phase, error) {
            root.dataset.dbeControllerError = item.id + ':' + phase;
            if (window.console && console.error) {
                console.error('[DBE] Controller ' + item.id + ' failed during ' + phase + '.', error);
            }
        }
        function invoke(item, phase, value) {
            const callback = item.controller[phase];
            if (typeof callback !== 'function') { return true; }
            try {
                if (phase === 'init') { callback(context); }
                else if (phase === 'refresh') { callback(value); }
                else { callback(); }
                return true;
            } catch (error) {
                reportError(item, phase, error);
                return false;
            }
        }
        function updateDiagnostics() {
            const active = controllers.filter((item) => { return item.initialised; });
            root.dataset.dbeControllerCount = String(active.length);
            root.dataset.dbeControllers = active.map((item) => { return item.id; }).join(',');
        }
        function initialise(item) {
            if (!item.enabled || item.initialised) { return; }
            item.initialised = invoke(item, 'init');
        }
        function register(id, controller, enabled) {
            if (!id || !controller || controllers.some((item) => { return item.id === id; })) {
                return registry;
            }
            const item = {
                id,
                controller,
                enabled: !!enabled,
                initialised: false
            };
            controllers.push(item);
            if (running) {
                initialise(item);
                updateDiagnostics();
            }
            return registry;
        }
        function init() {
            if (running) { return; }
            running = true;
            controllers.forEach(initialise);
            updateDiagnostics();
            if (!pagehideBound) {
                pagehideBound = true;
                window.addEventListener('pagehide', destroy, { once: true });
            }
        }
        function refresh(reason) {
            if (!running) { init(); }
            controllers.forEach((item) => {
                if (item.initialised) { invoke(item, 'refresh', reason || 'scheduled'); }
            });
        }
        function destroy() {
            if (!running) { return; }
            controllers.slice().reverse().forEach((item) => {
                if (!item.initialised) { return; }
                invoke(item, 'destroy');
                item.initialised = false;
            });
            running = false;
            updateDiagnostics();
        }

        const registry = Object.freeze({
            register,
            init,
            refresh,
            destroy
        });

        return registry;
    }

    function whenReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback, { once: true });
        } else {
            callback();
        }
    }

    window.dbeBuilderRuntime = Object.freeze({
        create (config) {
            const safeConfig = config || {};
            const featureInput = safeConfig.features || {};
            let features = Object.create(null);
            Object.keys(featureInput).forEach((id) => {
                features[id] = !!featureInput[id];
            });
            // Capability-gated flags come from the server. Snapshot and freeze
            // them so changing the public config object after boot cannot turn
            // a restricted feature back on through the shared `on()` closure.
            features = Object.freeze(features);
            const translations = createTranslations(safeConfig);

            return Object.freeze({
                config: safeConfig,
                on (id) { return !!features[id]; },
                translate: translations.translate,
                format: translations.format,
                plural: translations.plural,
                builderius: createBuilderiusAdapter(safeConfig),
                createScheduler,
                createMutationRouter,
                createControllerRegistry,
                whenReady
            });
        }
    });
})();
