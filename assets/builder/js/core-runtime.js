(function () {
    'use strict';

    /* Shared infrastructure for the Builderius enhancement controllers. Keep
       this file small and dependency-free: it loads immediately before
       builder.js and exposes one factory, which builder.js captures once. */

    var DBE_BUILDERIUS_ADAPTERS = {
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
        var strings = config.i18n || {};

        function translate(key, fallback) { return strings[key] || fallback; }
        function format(value) {
            var args = [].slice.call(arguments, 1);
            var index = 0;
            return String(value).replace(/%(\d+\$)?s/g, function (match, position) {
                return String(position ? args[parseInt(position, 10) - 1] : args[index++]);
            });
        }
        function plural(count, keyOne, fallbackOne, keyMany, fallbackMany) {
            return count === 1 ? translate(keyOne, fallbackOne) : translate(keyMany, fallbackMany);
        }

        return Object.freeze({
            translate: translate,
            format: format,
            plural: plural
        });
    }

    function createBuilderiusAdapter(config) {
        var version = String((config.builderius && config.builderius.version) || '');
        var versionMatch = version.match(/^(\d+\.\d+)/);
        var family = versionMatch ? versionMatch[1] : '';
        var compatible = !!DBE_BUILDERIUS_ADAPTERS[family];
        var key = compatible ? family : '1.3';
        var definition = DBE_BUILDERIUS_ADAPTERS[key];
        var tested = version === definition.testedVersion;
        var storeReference = null;
        var root = document.documentElement;

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
            var value = selector(name);
            return value ? (queryRoot || document).querySelector(value) : null;
        }
        function queryAll(name, queryRoot) {
            var value = selector(name);
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
            key: key,
            testedVersion: definition.testedVersion,
            selector: selector,
            query: query,
            queryAll: queryAll,
            navigatorRow: navigatorRow,
            store: store,
            modules: modules,
            activeId: activeId
        });
    }

    function createScheduler(refresh) {
        var frame = 0;

        function schedule() {
            if (frame) { return; }
            frame = requestAnimationFrame(function () {
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
        var observer = null;
        var observations = {};

        function mergeOptions(target, source) {
            var targetHasUnfilteredAttributes = target.attributes && !target.attributeFilter;
            ['childList', 'subtree', 'characterData', 'attributes', 'characterDataOldValue', 'attributeOldValue'].forEach(function (name) {
                if (source[name]) { target[name] = true; }
            });
            if (source.attributes) {
                if (!source.attributeFilter || targetHasUnfilteredAttributes) {
                    delete target.attributeFilter;
                } else {
                    target.attributeFilter = (target.attributeFilter || []).concat(source.attributeFilter).filter(function (name, index, values) {
                        return values.indexOf(name) === index;
                    });
                }
            }
            return target;
        }
        function mergedObservations() {
            var merged = [];
            Object.keys(observations).forEach(function (key) {
                var observation = observations[key];
                var existing = merged.filter(function (item) { return item.node === observation.node; })[0];
                if (existing) { mergeOptions(existing.options, observation.options); }
                else { merged.push({ node: observation.node, options: mergeOptions({}, observation.options) }); }
            });
            return merged;
        }
        function rebuild() {
            if (!window.MutationObserver) { return; }
            if (!observer) { observer = new MutationObserver(refresh); }
            else { observer.disconnect(); }
            var merged = mergedObservations();
            merged.forEach(function (observation) {
                try { observer.observe(observation.node, observation.options); } catch (error) {}
            });
            document.documentElement.dataset.dbeObserverRoots = String(merged.length);
        }
        function observe(key, node, options) {
            var current = observations[key];
            if (!node) {
                if (!current) { return; }
                delete observations[key];
                rebuild();
                return;
            }
            if (current && current.node === node) { return; }
            observations[key] = { node: node, options: options };
            rebuild();
        }
        function disconnect() {
            observations = {};
            if (observer) { observer.disconnect(); }
            observer = null;
            document.documentElement.dataset.dbeObserverRoots = '0';
        }

        return Object.freeze({
            observe: observe,
            disconnect: disconnect
        });
    }

    function createControllerRegistry(context) {
        var controllers = [];
        var running = false;
        var pagehideBound = false;
        var root = document.documentElement;

        function reportError(item, phase, error) {
            root.dataset.dbeControllerError = item.id + ':' + phase;
            if (window.console && console.error) {
                console.error('[DBE] Controller ' + item.id + ' failed during ' + phase + '.', error);
            }
        }
        function invoke(item, phase, value) {
            var callback = item.controller[phase];
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
            var active = controllers.filter(function (item) { return item.initialised; });
            root.dataset.dbeControllerCount = String(active.length);
            root.dataset.dbeControllers = active.map(function (item) { return item.id; }).join(',');
        }
        function initialise(item) {
            if (!item.enabled || item.initialised) { return; }
            item.initialised = invoke(item, 'init');
        }
        function register(id, controller, enabled) {
            if (!id || !controller || controllers.some(function (item) { return item.id === id; })) {
                return registry;
            }
            var item = {
                id: id,
                controller: controller,
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
            controllers.forEach(function (item) {
                if (item.initialised) { invoke(item, 'refresh', reason || 'scheduled'); }
            });
        }
        function destroy() {
            if (!running) { return; }
            controllers.slice().reverse().forEach(function (item) {
                if (!item.initialised) { return; }
                invoke(item, 'destroy');
                item.initialised = false;
            });
            running = false;
            updateDiagnostics();
        }

        var registry = Object.freeze({
            register: register,
            init: init,
            refresh: refresh,
            destroy: destroy
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
        create: function (config) {
            var safeConfig = config || {};
            var featureInput = safeConfig.features || {};
            var features = Object.create(null);
            Object.keys(featureInput).forEach(function (id) {
                features[id] = !!featureInput[id];
            });
            // Capability-gated flags come from the server. Snapshot and freeze
            // them so changing the public config object after boot cannot turn
            // a restricted feature back on through the shared `on()` closure.
            features = Object.freeze(features);
            var translations = createTranslations(safeConfig);

            return Object.freeze({
                config: safeConfig,
                on: function (id) { return !!features[id]; },
                translate: translations.translate,
                format: translations.format,
                plural: translations.plural,
                builderius: createBuilderiusAdapter(safeConfig),
                createScheduler: createScheduler,
                createMutationRouter: createMutationRouter,
                createControllerRegistry: createControllerRegistry,
                whenReady: whenReady
            });
        }
    });
})();
